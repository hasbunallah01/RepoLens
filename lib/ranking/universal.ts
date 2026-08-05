/**
 * Phase 4 of the Universal Retrieval layer: the orchestrator.
 *
 * Wires the per-file extractors (`symbols.ts`), the import graph
 * (`graph.ts`), the popularity / related-file layer (`popularity.ts`),
 * and the existing metadata + content engine (`rank.ts` /
 * `hybrid.ts`) into a single `rankRelevantFilesUniversal` entry point.
 *
 * Signal budget (cheap -> expensive), per design §3.1:
 *
 *   Stage 1   - metadata ranking (filename / folder / path / ext)
 *   Stage 1b  - conceptual doc boost (cheap, no I/O)
 *   Stage 1c  - symbol boost (consumes the Stage 2 extract; no extra I/O)
 *   Stage 1d  - popularity / import graph boost (consumes Stage 2; no I/O)
 *   Stage 2   - content scan (body + doc-comment keyword coverage)
 *   Stage 3   - doc-comment keyword coverage (re-uses Stage 2 reads)
 *   Stage 4   - related-file expansion (re-uses the import graph)
 *   Stage 5   - merge by path, keep highest score, accumulate reasons
 *
 * The single "fetch content" pass is Stage 2. Stages 1c, 1d, 3, and
 * 4 all consume the data Stage 2 already loaded. Total I/O = one
 * `fetchContent(path)` per candidate file, parallel.
 *
 * Output contract (per design §3.7): same base `RankResult` shape
 * produced by `rankRelevantFiles` / `rankRelevantFilesHybrid`, plus
 * a `universal` sub-object with diagnostics. Downstream consumers
 * (`buildProductionContextFromMetadata`, Paritok, OpenAI) read only
 * the base `ranked` field, so the new layer is wire-compatible.
 *
 * Constraints (per the brief):
 *   - No embeddings. No vector DB. No LLM call.
 *   - No AST parser. Regex only. No new dependencies.
 *   - Bounded I/O. At most `CONTENT_SCAN_CAP` files read per call.
 *   - Per-file failure isolation. A 404 on one file must not poison
 *     the rest of the scan.
 *   - Deterministic ordering. Same input -> same output, byte for
 *     byte. Sort key: score desc, path asc.
 */

import type { IndexedFile } from "@/types/repository";
import type {
  RankedFile,
  RankResult,
  RankSignalWeights,
} from "@/types/ranking";
import { rankRelevantFiles } from "./rank";
import { explainRank } from "./explain";
import { scoreContent } from "./content";
import { tokenizeQuery } from "./tokens";
import {
  extractAll,
  questionSymbolCoverage,
  DOC_COMMENT_MAX_CHARS,
} from "./symbols";
import { buildImportGraph, type ImportGraph } from "./graph";
import {
  inDegreeRanking,
  expandRelated,
  POPULARITY_MAX_BUMP,
  POPULARITY_LOG_MULTIPLIER,
  RELATED_BUMP,
  RELATED_BUMP_CAP,
} from "./popularity";

/* -------------------------------------------------------------------------- */
/*  Defaults                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * Max files the content scan will read in a single call. Doubles
 * the previous hybrid default (25 -> 50) per design §3.4 / §6.
 * All reads are parallel; the wall-clock cost is bounded by the
 * slowest single fetch.
 */
export const UNIVERSAL_DEFAULT_CONTENT_SCAN_CAP = 50;

/**
 * Same threshold the hybrid layer used to detect "weak metadata
 * results" (top score at or below -> run the content scan). Kept
 * the same value so the cheap path stays cheap.
 */
export const UNIVERSAL_DEFAULT_WEAK_SCORE_THRESHOLD = 35;

/**
 * File-count threshold (under -> "weak"). Kept the same as hybrid.
 */
export const UNIVERSAL_DEFAULT_WEAK_FILE_COUNT = 3;

/**
 * Per-file body char cap for keyword coverage. Matches the design's
 * "first 2000 chars" budget (reused from `content.ts`).
 */
export const UNIVERSAL_DEFAULT_BODY_SCAN_CHARS = 2000;

/**
 * How heavily a symbol-coverage signal is blended into the per-file
 * score. 0..1; 0.6 matches design §3.3.
 */
export const SYMBOL_MATCH_WEIGHT = 0.6;

/**
 * Per env-var reference additive bump, capped at 100. The "where
 * are environment variables used?" question has no good question-
 * token match, so we use the *count* of `process.env.X` references
 * per file as a per-file relevance signal.
 */
export const ENV_VAR_REF_BUMP_PER_REF = 10;
export const ENV_VAR_REF_BUMP_CAP = 100;

/**
 * Doc-comment keyword coverage is weighted this multiple of the
 * body keyword coverage (design §3.3 / §6). Doc-comment blocks
 * are denser signal than body text.
 */
export const DOC_COMMENT_BODY_RATIO = 1.2;

/* -------------------------------------------------------------------------- */
/*  Public types                                                              */
/* -------------------------------------------------------------------------- */

/** Options accepted by {@link rankRelevantFilesUniversal}. */
export interface UniversalRankOptions {
  /**
   * Async hook used to fetch a file's text body. Per-file failures
   * (404, decode, oversized) should return `null` so a single bad
   * fetch never aborts the rest of the scan. If omitted, the
   * content / symbol / popularity stages are skipped and the
   * function reduces to a metadata + conceptual-doc ranking.
   */
  fetchContent?: (path: string) => Promise<string | null>;

  /** Max files the content scan will read. Default 50. */
  contentScanCap?: number;

  /** Per-file body char cap for keyword coverage. Default 2000. */
  bodyScanChars?: number;

  /** Weak-score threshold. Top metadata score <= this -> content scan. */
  weakScoreThreshold?: number;

  /** Weak-file-count threshold. < this many ranked files -> content scan. */
  weakFileCountThreshold?: number;

  /** Cap on the number of files returned. Default 10. */
  limit?: number;

  /** Per-signal weights forwarded to the metadata engine. */
  weights?: Partial<RankSignalWeights>;
}

/**
 * The orchestrator's diagnostics. Lives on a `universal` sub-object
 * so downstream consumers (which read only the base `RankResult`
 * fields) ignore it without noticing. The shape is fixed: every
 * field is always present, with sensible defaults when a stage
 * didn't run.
 */
export interface UniversalRankDiagnostics {
  /** Number of files we actually fetched content for. */
  contentFetched: number;
  /** Paths that scored via a symbol-coverage match (after the weight). */
  symbolHits: string[];
  /** Paths boosted by import in-degree. */
  popularityBoosted: string[];
  /** Paths that scored via doc-comment keyword coverage. */
  docCommentHits: string[];
  /** Paths added by the related-files stage (not in the input ranking). */
  relatedAdded: string[];
  /** Total edges in the resolved import graph. */
  relatedGraphEdges: number;
  /** Which stages actually executed, in order. */
  stagesExecuted: ReadonlyArray<
    | "metadata"
    | "conceptual"
    | "symbol"
    | "popularity"
    | "body"
    | "doc-comment"
    | "related"
  >;
  /** Top score from the metadata-only ranking, pre-boost. 0 when none. */
  metadataTopScore: number;
  /** Whether the content scan executed. */
  contentFallbackExecuted: boolean;
  /** Paths that received the conceptual-document boost. */
  conceptualBoosted: string[];
}

/**
 * Universal `RankResult`. Extends the base `RankResult` with a
 * `universal` diagnostics field. The base fields are exactly the
 * shape produced by the metadata engine, so the existing pipeline
 * (`buildProductionContextFromMetadata`, Paritok, OpenAI) keeps
 * working without changes.
 */
export interface UniversalRankResult extends RankResult {
  universal: UniversalRankDiagnostics;
}

/* -------------------------------------------------------------------------- */
/*  Helpers                                                                   */
/* -------------------------------------------------------------------------- */

function clamp(n: number, lo: number, hi: number): number {
  if (n < lo) return lo;
  if (n > hi) return hi;
  return n;
}

/* -------------------------------------------------------------------------- */
/*  Conceptual doc boost (lifted from hybrid.ts so the universal layer is     */
/*  independent of the hybrid one). Identical behavior.                        */
/* -------------------------------------------------------------------------- */

const CONCEPTUAL_DOC_NAMES: ReadonlySet<string> = new Set([
  "readme.md",
  "readme.rst",
  "readme.txt",
  "readme",
  "architecture.md",
  "design.md",
  "blueprint.md",
  "roadmap.md",
  "overview.md",
  "contributing.md",
  "contributing.rst",
  "agents.md",
]);

function isInDocsFolder(lowerPath: string): boolean {
  return (
    lowerPath.startsWith("docs/") ||
    lowerPath.includes("/docs/") ||
    lowerPath.startsWith("documentation/") ||
    lowerPath.includes("/documentation/")
  );
}

const CONCEPTUAL_INTENT_TOKENS: ReadonlySet<string> = new Set([
  "architectur",
  "design",
  "overview",
  "explain",
  "intro",
  "introduction",
  "concept",
  "blueprint",
  "roadmap",
  "high",
  "structured",
  "structure",
  "lay",
  "organ",
  "stack",
  "framework",
  "hierarchy",
]);

function hasConceptualIntent(queryTokens: ReadonlyArray<string>): boolean {
  for (const t of queryTokens) {
    if (CONCEPTUAL_INTENT_TOKENS.has(t)) return true;
  }
  return false;
}

function isConceptualDoc(file: IndexedFile): boolean {
  const lowerName = file.name.toLowerCase();
  if (CONCEPTUAL_DOC_NAMES.has(lowerName)) return true;
  if (CONCEPTUAL_DOC_NAMES.has(file.name)) return true;
  const lowerPath = file.path.toLowerCase();
  if (isInDocsFolder(lowerPath)) {
    const ext = file.extKey;
    if (
      ext === "md" ||
      ext === "mdx" ||
      ext === "rst" ||
      ext === "txt" ||
      ext === ""
    ) {
      return true;
    }
  }
  return false;
}

function applyConceptualDocBoost(
  ranked: RankedFile[],
  allFiles: ReadonlyArray<IndexedFile>,
  queryTokens: ReadonlyArray<string>,
): { ranked: RankedFile[]; boosted: string[] } {
  if (!hasConceptualIntent(queryTokens)) return { ranked, boosted: [] };
  if (allFiles.length === 0) return { ranked, boosted: [] };

  const byPath = new Map<string, RankedFile>();
  for (const r of ranked) byPath.set(r.file.path, r);

  const boosted: string[] = [];

  for (const file of allFiles) {
    if (!isConceptualDoc(file)) continue;
    const existing = byPath.get(file.path);
    if (existing) {
      const bump = 15;
      const newScore = Math.min(100, existing.score + bump);
      if (newScore !== existing.score) {
        byPath.set(file.path, {
          ...existing,
          score: newScore,
          reason: `${existing.reason} (boosted: conceptual doc)`,
        });
        boosted.push(file.path);
      }
    } else {
      const reason = explainRank(file, queryTokens);
      byPath.set(file.path, {
        file,
        score: 60,
        reason: `${reason} (boosted: conceptual doc)`,
      });
      boosted.push(file.path);
    }
  }

  if (boosted.length === 0) return { ranked, boosted: [] };

  const next = Array.from(byPath.values());
  next.sort(
    (a, b) => b.score - a.score || a.file.path.localeCompare(b.file.path),
  );
  return { ranked: next, boosted };
}

/* -------------------------------------------------------------------------- */
/*  Stage 2: parallel content scan                                             */
/* -------------------------------------------------------------------------- */

interface ContentScanEntry {
  file: IndexedFile;
  contentScore: number;
  hits: string[];
  reason: string;
}

interface ExtractedFile {
  file: IndexedFile;
  content: string;
  symbols: ReadonlySet<string>;
  docComment: string;
  imports: ReadonlySet<string>;
  envVars: ReadonlySet<string>;
}

/**
 * Pick a stable, deterministic slice of candidates for the content
 * scan. We sort alphabetic by path so the same input always scans
 * the same files, regardless of any upstream ordering. The cap
 * keeps the parallel-read cost bounded.
 */
function pickCandidates(
  all: ReadonlyArray<IndexedFile>,
  cap: number,
): IndexedFile[] {
  const sorted = [...all].sort((a, b) => a.path.localeCompare(b.path));
  return sorted.slice(0, Math.max(0, cap));
}

/**
 * Read content for a candidate set via the caller's `fetchContent`
 * hook, in parallel. Per-file failures (return null OR throw) are
 * isolated — a single bad fetch never aborts the rest.
 *
 * Also runs `extractAll` against every successfully-fetched body
 * so downstream stages (symbol / doc-comment / import graph) can
 * consume the per-file signals without re-reading.
 */
async function readAndExtract(
  candidates: ReadonlyArray<IndexedFile>,
  fetchContent: (path: string) => Promise<string | null>,
  bodyScanChars: number,
): Promise<ExtractedFile[]> {
  const fetched = await Promise.all(
    candidates.map(async (file) => {
      try {
        const content = await fetchContent(file.path);
        return { file, content };
      } catch {
        return { file, content: null as string | null };
      }
    }),
  );
  const out: ExtractedFile[] = [];
  for (const { file, content } of fetched) {
    if (content === null) continue;
    const language = file.language || "TypeScript";
    const cap = Math.max(bodyScanChars, DOC_COMMENT_MAX_CHARS);
    const extracted = extractAll(content, language, { maxChars: cap });
    out.push({
      file,
      content,
      symbols: extracted.symbols,
      docComment: extracted.docComment,
      imports: extracted.imports,
      envVars: extracted.envVars,
    });
  }
  return out;
}

/**
 * Compute body-keyword coverage for every extracted file against
 * the question tokens. Uses the existing `scoreContent` for shape
 * consistency with the hybrid layer.
 */
function scoreBody(
  extracted: ExtractedFile[],
  queryTokens: ReadonlyArray<string>,
  bodyScanChars: number,
): ContentScanEntry[] {
  if (queryTokens.length === 0) return [];
  const out: ContentScanEntry[] = [];
  for (const e of extracted) {
    const s = scoreContent(e.file, queryTokens, e.content, {
      maxChars: bodyScanChars,
    });
    if (s.score <= 0) continue;
    out.push({
      file: e.file,
      contentScore: s.score,
      hits: s.hits,
      reason: s.reason,
    });
  }
  out.sort((a, b) => b.contentScore - a.contentScore);
  return out;
}

/**
 * Compute doc-comment-keyword coverage. Same shape as
 * `scoreContent` but weighted by `DOC_COMMENT_BODY_RATIO` (1.2x)
 * per design §3.3 / §6.
 */
function scoreDocComment(
  extracted: ExtractedFile[],
  queryTokens: ReadonlyArray<string>,
): ContentScanEntry[] {
  if (queryTokens.length === 0) return [];
  const out: ContentScanEntry[] = [];
  for (const e of extracted) {
    if (!e.docComment) continue;
    // Reuse scoreContent's shape: it tokenizes the input via the
    // same `tokenizeQuery` and applies the same sqrt coverage curve.
    const s = scoreContent(e.file, queryTokens, e.docComment, {
      maxChars: DOC_COMMENT_MAX_CHARS,
    });
    if (s.score <= 0) continue;
    const weighted = clamp(
      Math.round(s.score * DOC_COMMENT_BODY_RATIO),
      0,
      100,
    );
    out.push({
      file: e.file,
      contentScore: weighted,
      hits: s.hits,
      reason: s.reason,
    });
  }
  out.sort((a, b) => b.contentScore - a.contentScore);
  return out;
}

/* -------------------------------------------------------------------------- */
/*  Stage 1c: symbol coverage -> additive bump per file                       */
/* -------------------------------------------------------------------------- */

/**
 * For every extracted file, compute its symbol-stem coverage against
 * the question and turn it into a 0..100 symbol score. The result is
 * later blended into the per-file final score with weight
 * {@link SYMBOL_MATCH_WEIGHT}.
 */
function scoreSymbols(
  extracted: ExtractedFile[],
  queryTokens: ReadonlyArray<string>,
): Map<string, { score: number; hits: string[] }> {
  const out = new Map<string, { score: number; hits: string[] }>();
  if (queryTokens.length === 0) return out;
  for (const e of extracted) {
    if (e.symbols.size === 0) continue;
    const r = questionSymbolCoverage(queryTokens, e.symbols);
    if (r.coverage <= 0) continue;
    // coverage in [0, 1] -> shaped score in [0, 100]. Square root
    // gives a smooth curve (1/1 -> 100, 1/2 -> 71, 1/3 -> 58, 2/3
    // -> 82, 3/3 -> 100).
    const shaped = clamp(Math.round(Math.sqrt(r.coverage) * 100), 0, 100);
    out.set(e.file.path, { score: shaped, hits: r.hits });
  }
  return out;
}

/* -------------------------------------------------------------------------- */
/*  Env-var relevance                                                          */
/* -------------------------------------------------------------------------- */

/**
 * Per-file additive bump for "where are environment variables used?"
 * type questions: `min(100, 10 * refCount)`. The boost is keyed on
 * the count of `process.env.X` references in the file's first
 * `bodyScanChars` chars, NOT on a question-token match.
 */
function scoreEnvVarRefs(extracted: ExtractedFile[]): Map<string, number> {
  const out = new Map<string, number>();
  for (const e of extracted) {
    if (e.envVars.size === 0) continue;
    const bump = clamp(
      e.envVars.size * ENV_VAR_REF_BUMP_PER_REF,
      0,
      ENV_VAR_REF_BUMP_CAP,
    );
    out.set(e.file.path, bump);
  }
  return out;
}

/* -------------------------------------------------------------------------- */
/*  Stage 4: related-file expansion (one-hop)                                 */
/* -------------------------------------------------------------------------- */

function buildGraphForExtracted(
  extracted: ExtractedFile[],
  allCandidates: ReadonlyArray<IndexedFile>,
): ImportGraph {
  // Map file.path -> extracted (for O(1) lookup). Files in the
  // candidate set but not in `extracted` (i.e. content read failed)
  // have an empty imports set, so the graph builder drops them
  // naturally.
  const byPath = new Map<string, ExtractedFile>();
  for (const e of extracted) byPath.set(e.file.path, e);
  return buildImportGraph(allCandidates, (p) => {
    const e = byPath.get(p);
    return e ? e.imports : null;
  });
}

function countEdges(graph: ImportGraph): number {
  let n = 0;
  for (const v of graph.values()) n += v.size;
  return n;
}

/* -------------------------------------------------------------------------- */
/*  Stage 5: merge everything                                                 */
/* -------------------------------------------------------------------------- */

interface MergeAcc {
  score: number;
  reasons: string[];
  path: string;
  file: IndexedFile;
  signals: {
    metadata?: number;
    conceptual?: boolean;
    symbol?: { score: number; hits: string[] };
    popularity?: number;
    body?: { score: number; hits: string[] };
    docComment?: { score: number; hits: string[] };
    envVars?: number;
    related?: number;
  };
}

function addReason(acc: MergeAcc, reason: string): void {
  if (reason && !acc.reasons.includes(reason)) acc.reasons.push(reason);
}

/* -------------------------------------------------------------------------- */
/*  Public API                                                                */
/* -------------------------------------------------------------------------- */

/**
 * Run the Universal Retrieval layer.
 *
 * Stages (per design §3.1):
 *   1. metadata ranking (cheap, no I/O)
 *   1b. conceptual doc boost (cheap, no I/O)
 *   1c. symbol boost (consumes Stage 2; no extra I/O)
 *   1d. popularity / import graph (consumes Stage 2; no extra I/O)
 *   2. content scan (body + doc-comment keyword coverage)
 *   3. doc-comment keyword coverage (re-uses Stage 2)
 *   4. related-file expansion (re-uses Stage 2 graph)
 *   5. merge by path, keep highest score, accumulate reasons
 *
 * The output is the same `RankResult` shape produced by the
 * metadata engine, plus a `universal` diagnostics object.
 *
 * If no `fetchContent` hook is provided the function still runs
 * (Stages 1 + 1b only) and returns a `Promise<UniversalRankResult>`
 * so callers don't need a sync/async fork.
 */
export async function rankRelevantFilesUniversal(
  question: string,
  candidateFiles: ReadonlyArray<IndexedFile>,
  options: UniversalRankOptions = {},
): Promise<UniversalRankResult> {
  const limit = options.limit ?? 10;
  const contentScanCap =
    options.contentScanCap ?? UNIVERSAL_DEFAULT_CONTENT_SCAN_CAP;
  const bodyScanChars =
    options.bodyScanChars ?? UNIVERSAL_DEFAULT_BODY_SCAN_CHARS;
  const weakScoreThreshold =
    options.weakScoreThreshold ?? UNIVERSAL_DEFAULT_WEAK_SCORE_THRESHOLD;
  const weakFileCountThreshold =
    options.weakFileCountThreshold ?? UNIVERSAL_DEFAULT_WEAK_FILE_COUNT;

  // Stage 1 — metadata ranking, untouched.
  const metadataResult = rankRelevantFiles(question, candidateFiles, {
    limit: 0, // we cap at the end after merge
    weights: options.weights,
  });

  const queryTokens = tokenizeQuery(question);
  const stagesExecuted: Array<
    "metadata" | "conceptual" | "symbol" | "popularity" | "body" | "doc-comment" | "related"
  > = ["metadata"];

  // Stage 1b — conceptual doc boost (no I/O).
  const { ranked: conceptualRanked, boosted: conceptualBoosted } =
    applyConceptualDocBoost(metadataResult.ranked, candidateFiles, queryTokens);
  if (conceptualBoosted.length > 0) stagesExecuted.push("conceptual");

  const topScore =
    conceptualRanked.length > 0 ? conceptualRanked[0]!.score : 0;
  const rankedCount = conceptualRanked.length;
  const isWeak =
    rankedCount < weakFileCountThreshold || topScore <= weakScoreThreshold;
  const canScan =
    isWeak &&
    typeof options.fetchContent === "function" &&
    queryTokens.length > 0 &&
    candidateFiles.length > 0;

  if (!canScan) {
    // Cheap path: no content scan. Return the metadata + conceptual
    // result as-is, capped to the requested limit.
    const final = capRanked(conceptualRanked, limit);
    return {
      ...metadataResult,
      ranked: final,
      universal: {
        contentFetched: 0,
        symbolHits: [],
        popularityBoosted: [],
        docCommentHits: [],
        relatedAdded: [],
        relatedGraphEdges: 0,
        stagesExecuted,
        metadataTopScore: topScore,
        contentFallbackExecuted: false,
        conceptualBoosted,
      },
    };
  }

  // Stage 2 — content scan.
  const candidates = pickCandidates(candidateFiles, contentScanCap);
  const extracted = await readAndExtract(
    candidates,
    options.fetchContent!,
    bodyScanChars,
  );

  // Stage 1c — symbol score.
  const symbolScores = scoreSymbols(extracted, queryTokens);
  if (symbolScores.size > 0) stagesExecuted.push("symbol");

  // Stage 2b — body keyword coverage.
  const bodyRanked = scoreBody(extracted, queryTokens, bodyScanChars);
  if (bodyRanked.length > 0) stagesExecuted.push("body");

  // Stage 3 — doc-comment keyword coverage.
  const docCommentRanked = scoreDocComment(extracted, queryTokens);
  if (docCommentRanked.length > 0) stagesExecuted.push("doc-comment");

  // Env-var relevance (used by the merge step; not a "stage" on its
  // own, but a per-file additive bump).
  const envVarBumps = scoreEnvVarRefs(extracted);

  // Stage 1d — popularity / import graph.
  const graph = buildGraphForExtracted(extracted, candidateFiles);
  const popularityMap = inDegreeRanking(graph);
  if (popularityMap.size > 0) stagesExecuted.push("popularity");

  // Stage 4 — related-file expansion. Winners are the top 5 of the
  // (metadata + conceptual) ranking, so the related-files stage
  // surfaces both upstream callers (importers) and downstream
  // callees (imports) of the strong candidates.
  const winnerSet = new Set<string>(
    conceptualRanked.slice(0, 5).map((r) => r.file.path),
  );
  const relatedMap = expandRelated(graph, winnerSet);
  if (relatedMap.size > 0) stagesExecuted.push("related");

  const graphEdges = countEdges(graph);

  // ----------------------------------------------------------------
  //  Stage 5 — merge everything.
  // ----------------------------------------------------------------
  const acc = new Map<string, MergeAcc>();

  // Seed from the metadata + conceptual ranking. We treat this as
  // the "base score" for each path; every other signal is additive
  // or blended.
  for (const r of conceptualRanked) {
    acc.set(r.file.path, {
      path: r.file.path,
      file: r.file,
      score: r.score,
      reasons: [r.reason],
      signals: { metadata: r.score, conceptual: conceptualBoosted.includes(r.file.path) },
    });
  }

  // Body keyword coverage.
  for (const b of bodyRanked) {
    let entry = acc.get(b.file.path);
    if (!entry) {
      entry = {
        path: b.file.path,
        file: b.file,
        score: 0,
        reasons: [],
        signals: {},
      };
      acc.set(b.file.path, entry);
    }
    if (b.contentScore > entry.score) entry.score = b.contentScore;
    entry.signals.body = { score: b.contentScore, hits: b.hits };
    addReason(entry, b.reason);
  }

  // Doc-comment keyword coverage.
  for (const d of docCommentRanked) {
    let entry = acc.get(d.file.path);
    if (!entry) {
      entry = {
        path: d.file.path,
        file: d.file,
        score: 0,
        reasons: [],
        signals: {},
      };
      acc.set(d.file.path, entry);
    }
    if (d.contentScore > entry.score) entry.score = d.contentScore;
    entry.signals.docComment = { score: d.contentScore, hits: d.hits };
    addReason(
      entry,
      `doc-comment mentions ${d.hits.length} question keyword${d.hits.length === 1 ? "" : "s"} (${d.hits.slice(0, 3).join(", ")})`,
    );
  }

  // Symbol coverage. Blended into the final score: final = max(metadata, body, docComment) * (1 - SYMBOL_MATCH_WEIGHT) + symbolScore * SYMBOL_MATCH_WEIGHT.
  // When metadata is missing (the file was surfaced by the content
  // stage only), the symbol score contributes 100% of its weight.
  const symbolHits: string[] = [];
  for (const [path, sym] of symbolScores) {
    let entry = acc.get(path);
    if (!entry) {
      entry = {
        path,
        file: extracted.find((e) => e.file.path === path)!.file,
        score: 0,
        reasons: [],
        signals: {},
      };
      acc.set(path, entry);
    }
    const base = entry.score;
    const blended = clamp(
      Math.round(base * (1 - SYMBOL_MATCH_WEIGHT) + sym.score * SYMBOL_MATCH_WEIGHT),
      0,
      100,
    );
    entry.score = Math.max(entry.score, blended);
    entry.signals.symbol = sym;
    symbolHits.push(path);
    addReason(
      entry,
      `exported symbol stem matches ${sym.hits.length} question token${sym.hits.length === 1 ? "" : "s"} (${sym.hits.slice(0, 3).join(", ")})`,
    );
  }

  // Popularity bump (additive).
  const popularityBoosted: string[] = [];
  for (const [path, bump] of popularityMap) {
    let entry = acc.get(path);
    if (!entry) {
      // File referenced by the graph but not in the input candidate
      // set. We still want to surface it; seed it with a small
      // starting score so the ranking engine doesn't return 0.
      const found = candidateFiles.find((c) => c.path === path);
      if (!found) continue;
      entry = {
        path,
        file: found,
        score: 0,
        reasons: [],
        signals: {},
      };
      acc.set(path, entry);
    }
    entry.score = clamp(entry.score + bump, 0, 100);
    entry.signals.popularity = bump;
    popularityBoosted.push(path);
    addReason(entry, `imported by ${popularityMap.get(path) === bump ? "many" : "other"} files (popularity +${bump})`);
  }

  // Env-var reference bump (additive).
  for (const [path, bump] of envVarBumps) {
    let entry = acc.get(path);
    if (!entry) {
      const found = candidateFiles.find((c) => c.path === path);
      if (!found) continue;
      entry = {
        path,
        file: found,
        score: 0,
        reasons: [],
        signals: {},
      };
      acc.set(path, entry);
    }
    entry.score = clamp(entry.score + bump, 0, 100);
    entry.signals.envVars = bump;
    addReason(
      entry,
      `references ${envVarBumps.get(path) === bump ? "multiple" : "an"} environment variable${bump > ENV_VAR_REF_BUMP_PER_REF ? "s" : ""} (env-var +${bump})`,
    );
  }

  // Related-file bump (additive).
  const relatedAdded: string[] = [];
  for (const [path, bump] of relatedMap) {
    let entry = acc.get(path);
    if (!entry) {
      const found = candidateFiles.find((c) => c.path === path);
      if (!found) continue;
      entry = {
        path,
        file: found,
        score: 0,
        reasons: [],
        signals: {},
      };
      acc.set(path, entry);
      relatedAdded.push(path);
    }
    entry.score = clamp(entry.score + bump, 0, 100);
    entry.signals.related = bump;
    addReason(entry, `related via import graph (+${bump})`);
  }

  // Materialize the merged ranked list.
  const merged: RankedFile[] = Array.from(acc.values()).map((e) => {
    const score = clamp(Math.round(e.score), 0, 100);
    return {
      file: e.file,
      score,
      reason: e.reasons.length > 0 ? e.reasons.join("; ") : explainRank(e.file, queryTokens),
    };
  });

  // Sort: score desc, path asc. Deterministic.
  merged.sort(
    (a, b) => b.score - a.score || a.file.path.localeCompare(b.file.path),
  );
  const capped = capRanked(merged, limit);

  // Build the docCommentHits from what actually fired.
  const docCommentHits = docCommentRanked.map((d) => d.file.path);

  return {
    ...metadataResult,
    ranked: capped,
    universal: {
      contentFetched: extracted.length,
      symbolHits,
      popularityBoosted,
      docCommentHits,
      relatedAdded,
      relatedGraphEdges: graphEdges,
      stagesExecuted,
      metadataTopScore: topScore,
      contentFallbackExecuted: true,
      conceptualBoosted,
    },
  };
}

function capRanked(ranked: RankedFile[], limit: number): RankedFile[] {
  if (limit > 0 && ranked.length > limit) return ranked.slice(0, limit);
  return ranked;
}

/* -------------------------------------------------------------------------- */
/*  Re-exports for the public surface                                          */
/* -------------------------------------------------------------------------- */

export {
  POPULARITY_MAX_BUMP,
  POPULARITY_LOG_MULTIPLIER,
  RELATED_BUMP,
  RELATED_BUMP_CAP,
};
