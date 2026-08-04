/**
 * Hybrid (metadata + content) ranking engine.
 *
 * Sits on top of the existing {@link rankRelevantFiles} (Phase 3C1)
 * and adds two narrow enhancements:
 *
 *   1. **Conceptual document boost** — README, docs/*, ARCHITECTURE,
 *      DESIGN, BLUEPRINT, ROADMAP, OVERVIEW, and CONTRIBUTING docs
 *      are surfaced for "explain the architecture / design / overview"
 *      style questions. This is a pure metadata adjustment (no
 *      content I/O) and runs unconditionally because it is cheap.
 *
 *   2. **Content fallback** — when the metadata-only result is
 *      "weak" (too few ranked files OR all top scores below a
 *      threshold), the engine reads the first ~2000 chars of a
 *      small set of candidate files via a caller-supplied
 *      `fetchContent` hook, re-scores them on body-keyword overlap,
 *      and merges the two ranked lists.
 *
 * The output is the exact same `RankResult` shape produced by the
 * metadata engine so the downstream pipeline (fetchRankedFileContents
 * → buildProductionContext → Paritok → OpenAI) is unchanged.
 *
 * Constraints (per project brief):
 *   - No embeddings, no vector DB, no LLM call.
 *   - No new dependencies. No I/O outside the caller-supplied
 *     `fetchContent` hook.
 *   - Reuses the existing `tokenizeQuery` stemmer + scoring rules.
 *
 * Diagnostics:
 *   The result extends `RankResult` with a `hybrid` field that
 *   reports whether the content fallback executed, the threshold
 *   used, and the candidate-set sizes. The base `RankResult` is
 *   exactly the metadata engine's output, so existing consumers
 *   ignore the extra field without noticing.
 */

import type { IndexedFile } from "@/types/repository";
import type {
  RankedFile,
  RankOptions,
  RankResult,
} from "@/types/ranking";
import { rankRelevantFiles } from "./rank";
import { explainRank } from "./explain";
import { scoreContent } from "./content";
import { tokenizeQuery } from "./tokens";

/* -------------------------------------------------------------------------- */
/*  Defaults                                                                  */
/* -------------------------------------------------------------------------- */

/** Default char cap per file when reading content for fallback scoring. */
export const HYBRID_DEFAULT_CONTENT_CHARS = 2000;

/**
 * Below this score (inclusive), a single metadata-only match is
 * considered too weak to be the sole answer. A hybrid result whose
 * top metadata match is below this threshold will trigger the
 * content fallback.
 */
export const HYBRID_DEFAULT_WEAK_SCORE_THRESHOLD = 35;

/**
 * If the metadata result has fewer than this many ranked files, the
 * content fallback runs regardless of the top score. The reasoning:
 * an empty or near-empty ranked list means the question produced
 * no useful filename/folder/path matches, so a content-based search
 * is more likely to surface the right files.
 */
export const HYBRID_DEFAULT_WEAK_FILE_COUNT = 3;

/**
 * Cap on how many candidate files the content fallback will scan.
 * The candidates are chosen from a stable, deterministic ordering
 * (alphabetic by path) so the result is reproducible.
 */
export const HYBRID_DEFAULT_MAX_CONTENT_SCAN = 25;

/* -------------------------------------------------------------------------- */
/*  Conceptual document boost                                                  */
/* -------------------------------------------------------------------------- */

/**
 * Document filenames (lower-cased) that explain what a project IS
 * rather than what it CONTAINS. Surfacing these on conceptual
 * questions is a metadata-only fix — no content I/O.
 */
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

/**
 * File paths considered "in a docs folder" for the conceptual boost.
 * Matched on the lower-cased path; we require a leading `/` to avoid
 * false positives like `mydocs/`.
 */
function isInDocsFolder(lowerPath: string): boolean {
  return (
    lowerPath.startsWith("docs/") ||
    lowerPath.includes("/docs/") ||
    lowerPath.startsWith("documentation/") ||
    lowerPath.includes("/documentation/")
  );
}

/**
 * Question tokens (post-stem) that signal a conceptual / overview
 * question. Conservative — only obvious "tell me about the project"
 * intents. We deliberately do NOT include broad verbs like "how" or
 * "what" because those already have their own metadata signals.
 */
const CONCEPTUAL_INTENT_TOKENS: ReadonlySet<string> = new Set([
  "architectur",  // after stem: "architecture"
  "design",
  "overview",
  "explain",
  "intro",
  "introduction",
  "concept",
  "blueprint",
  "roadmap",
  "high",          // "high level"
  "structured",    // "structured around"
  "structure",
  "lay",           // "layout"
  "organ",         // "organized", "organize"
  "stack",
  "framework",
  "hierarchy",
]);

/**
 * True if the question tokens contain any token that signals a
 * conceptual / overview question. Uses the stemmed form so
 * "architecture" / "architectural" both match.
 */
function hasConceptualIntent(queryTokens: ReadonlyArray<string>): boolean {
  for (const t of queryTokens) {
    if (CONCEPTUAL_INTENT_TOKENS.has(t)) return true;
  }
  return false;
}

/**
 * True if the file is one of the canonical "explain what this is"
 * documents — by name or by living in a `docs/` folder.
 */
function isConceptualDoc(file: IndexedFile): boolean {
  const lowerName = file.name.toLowerCase();
  if (CONCEPTUAL_DOC_NAMES.has(lowerName)) return true;
  // Bare names (no extension) are unusual but possible (e.g. "README").
  if (CONCEPTUAL_DOC_NAMES.has(file.name)) return true;
  // "docs/<file>.md" or "docs/<file>" — any extension. We require the
  // path to be inside a docs/ folder and the file to look like a
  // document (no code extension).
  const lowerPath = file.path.toLowerCase();
  if (isInDocsFolder(lowerPath)) {
    const ext = file.extKey;
    if (
      ext === "md" ||
      ext === "mdx" ||
      ext === "rst" ||
      ext === "txt" ||
      ext === "" // no extension (unusual but valid)
    ) {
      return true;
    }
  }
  return false;
}

/**
 * Add a deterministic conceptual-document boost to a metadata
 * ranking. The boost has two effects:
 *
 *   1. **Bump existing entries** — for any conceptual doc that
 *      already appears in the metadata ranking, we add a small
 *      score (capped at 100). This is the cheap path: it never
 *      changes which files appear in the result, only the order.
 *
 *   2. **Surface missing conceptual docs** — for any conceptual
 *      doc that is NOT in the metadata ranking, we *add* it with a
 *      reasonable starting score (60). This is the load-bearing
 *      path: it is the only way an "Explain the architecture"
 *      question that matches zero filenames/paths still returns a
 *      non-empty ranked list.
 *
 * Both effects fire only when the question contains a conceptual
 * intent token (architecture, design, overview, …). We never apply
 * the boost to non-doc files, so an "auth" question with the word
 * "design" in it will not surface a random design doc by accident.
 *
 * The boost is intentionally metadata-only: no content I/O. The
 * brief is "naturally surface documents such as README/docs/
 * ARCHITECTURE.md" — content-keyword ranking stays in the
 * fallback path so this stays cheap.
 */
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
      // Path 1: bump the existing entry.
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
      // Path 2: surface a missing conceptual doc. The starting
      // score (60) is high enough to appear at the top of a weak
      // metadata result (which is when this path fires) but low
      // enough to be beaten by any strong metadata match.
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
/*  Content fallback                                                          */
/* -------------------------------------------------------------------------- */

/** A small per-file result produced by the content fallback stage. */
interface ContentScanEntry {
  file: IndexedFile;
  contentScore: number;
  hits: string[];
  reason: string;
}

/**
 * Run a lightweight content scan over a small set of candidate files
 * and return them scored by body-keyword overlap.
 *
 * The function:
 *   1. Picks up to {@link maxScan} candidates from the *original*
 *      file list (not just the metadata-ranked ones — when the
 *      metadata result is weak, the metadata list is misleading).
 *   2. Calls the caller-supplied `fetchContent` hook for each
 *      candidate in parallel. The hook returns `null` on failure
 *      (network, decode, oversized) and the candidate is skipped.
 *   3. Truncates the body to {@link maxChars} characters and scores
 *      the body via {@link scoreContent}.
 *   4. Returns a list sorted by descending content score.
 *
 * Files that were already in the metadata result are still scanned
 * — the merge step (Stage 3) will dedupe and keep the highest
 * score, so re-scanning a known-good metadata match can only
 * reinforce it, not weaken it.
 */
async function runContentScan(
  candidates: ReadonlyArray<IndexedFile>,
  queryTokens: ReadonlyArray<string>,
  fetchContent: (path: string) => Promise<string | null>,
  maxChars: number,
  maxScan: number,
): Promise<ContentScanEntry[]> {
  if (queryTokens.length === 0 || candidates.length === 0) return [];

  // Pick a stable, deterministic slice of candidates. We sort
  // alphabetic by path so the same input always scans the same
  // files, regardless of any upstream ordering.
  const sorted = [...candidates].sort((a, b) =>
    a.path.localeCompare(b.path),
  );
  const slice = sorted.slice(0, Math.max(0, maxScan));

  // Fetch all contents in parallel. Per-file failures are caught by
  // the hook (returning null) so a single bad fetch never aborts
  // the rest of the scan.
  const fetched = await Promise.all(
    slice.map(async (file) => {
      try {
        const content = await fetchContent(file.path);
        return { file, content };
      } catch {
        return { file, content: null as string | null };
      }
    }),
  );

  const scored: ContentScanEntry[] = [];
  for (const { file, content } of fetched) {
    if (content === null) continue;
    const s = scoreContent(file, queryTokens, content, { maxChars });
    if (s.score <= 0) continue;
    scored.push({
      file,
      contentScore: s.score,
      hits: s.hits,
      reason: s.reason,
    });
  }

  scored.sort((a, b) => b.contentScore - a.contentScore);
  return scored;
}

/* -------------------------------------------------------------------------- */
/*  Hybrid merge                                                              */
/* -------------------------------------------------------------------------- */

/**
 * Merge the metadata ranking and the content ranking into a single
 * `RankedFile[]`:
 *   - Deduplicate by `file.path`.
 *   - Keep the highest score (content or metadata) per path.
 *   - Prefer the metadata reason for known files; if the content
 *     reason wins, keep it.
 *   - Re-sort by descending score, then alphabetic by path.
 */
function mergeRankings(
  metadata: RankedFile[],
  content: ContentScanEntry[],
): RankedFile[] {
  const byPath = new Map<string, RankedFile>();
  for (const m of metadata) byPath.set(m.file.path, m);
  for (const c of content) {
    const existing = byPath.get(c.file.path);
    if (!existing) {
      byPath.set(c.file.path, {
        file: c.file,
        score: c.contentScore,
        reason: c.reason,
      });
      continue;
    }
    if (c.contentScore > existing.score) {
      byPath.set(c.file.path, {
        file: existing.file,
        score: c.contentScore,
        reason: c.reason,
      });
    }
  }
  const out = Array.from(byPath.values());
  out.sort(
    (a, b) => b.score - a.score || a.file.path.localeCompare(b.file.path),
  );
  return out;
}

/* -------------------------------------------------------------------------- */
/*  Public API                                                                */
/* -------------------------------------------------------------------------- */

/** Options accepted by {@link rankRelevantFilesHybrid}. */
export interface HybridRankOptions extends RankOptions {
  /**
   * Async hook used by the content-fallback stage to fetch a
   * file's text body. Should return `null` on any per-file failure
   * (404, decode error, oversized file, …) so the fallback can
   * skip it and keep going. If omitted, the content fallback is
   * disabled and the function falls back to the metadata-only
   * result (still with the conceptual-doc boost).
   */
  fetchContent?: (path: string) => Promise<string | null>;

  /**
   * Number of characters per file to read during the content scan.
   * Defaults to {@link HYBRID_DEFAULT_CONTENT_CHARS} (2000).
   */
  contentChars?: number;

  /**
   * Score threshold (0..100). When the top metadata match is at or
   * below this value, the result is considered "weak" and the
   * content fallback runs. Defaults to
   * {@link HYBRID_DEFAULT_WEAK_SCORE_THRESHOLD} (35).
   */
  weakScoreThreshold?: number;

  /**
   * File-count threshold. When the metadata result has fewer than
   * this many ranked files, the result is considered "weak" and
   * the content fallback runs. Defaults to
   * {@link HYBRID_DEFAULT_WEAK_FILE_COUNT} (3).
   */
  weakFileCountThreshold?: number;

  /**
   * Maximum number of candidate files the content fallback will
   * inspect. Defaults to {@link HYBRID_DEFAULT_MAX_CONTENT_SCAN} (25).
   */
  maxContentScan?: number;
}

/**
 * Hybrid `RankResult`. Extends the metadata engine's `RankResult`
 * with a `hybrid` field that reports whether the content fallback
 * ran and the candidate-set sizes. The base fields are exactly the
 * shape produced by the metadata engine so existing consumers (the
 * ask pipeline) ignore the extra field without any change.
 */
export interface HybridRankResult extends RankResult {
  hybrid: {
    /** True iff the content-fallback stage executed. */
    contentFallbackExecuted: boolean;
    /** Number of candidate files the content stage scanned. */
    contentScanned: number;
    /** Number of candidate files that produced a positive content score. */
    contentMatched: number;
    /** Paths that received the conceptual-document boost (if any). */
    conceptualBoosted: string[];
    /**
     * Top score from the metadata-only ranking (pre-boost), or 0
     * when the metadata stage produced no matches.
     */
    metadataTopScore: number;
  };
}

/**
 * Run the hybrid ranking engine.
 *
 * Algorithm (matches the brief):
 *   1. Run the metadata engine unchanged.
 *   2. Apply the conceptual-document boost (no I/O).
 *   3. If the boosted metadata result is "weak" AND a
 *      {@link HybridRankOptions.fetchContent} hook is provided,
 *      run a small content scan on a candidate set.
 *   4. Merge metadata + content by `file.path`, keep highest score.
 *   5. Return the same `RankResult` shape (with extra diagnostics).
 *
 * The function is async ONLY because the content fallback awaits
 * the `fetchContent` hook. If no hook is provided, the function
 * still returns a `Promise<HybridRankResult>` (resolved
 * synchronously) so callers don't need a sync/async fork.
 */
export async function rankRelevantFilesHybrid(
  question: string,
  candidateFiles: ReadonlyArray<IndexedFile>,
  options: HybridRankOptions = {},
): Promise<HybridRankResult> {
  // Stage 1 — metadata ranking, untouched.
  const metadataResult = rankRelevantFiles(
    question,
    candidateFiles,
    options,
  );

  // Stage 1b — conceptual doc boost (pure, no I/O).
  const tokens = scoreContentQueryTokens(question);
  const { ranked: conceptualRanked, boosted: conceptualBoosted } =
    applyConceptualDocBoost(metadataResult.ranked, candidateFiles, tokens);

  const topScore = conceptualRanked.length > 0 ? conceptualRanked[0]!.score : 0;
  const rankedCount = conceptualRanked.length;

  const weakScoreThreshold =
    options.weakScoreThreshold ?? HYBRID_DEFAULT_WEAK_SCORE_THRESHOLD;
  const weakFileCountThreshold =
    options.weakFileCountThreshold ?? HYBRID_DEFAULT_WEAK_FILE_COUNT;
  const contentChars =
    options.contentChars ?? HYBRID_DEFAULT_CONTENT_CHARS;
  const maxContentScan =
    options.maxContentScan ?? HYBRID_DEFAULT_MAX_CONTENT_SCAN;

  // Stage 2 — content fallback, only when warranted.
  const isWeak =
    rankedCount < weakFileCountThreshold || topScore <= weakScoreThreshold;
  const canFallback =
    isWeak && typeof options.fetchContent === "function" && tokens.length > 0;

  if (!canFallback) {
    return {
      ...metadataResult,
      ranked: conceptualRanked,
      hybrid: {
        contentFallbackExecuted: false,
        contentScanned: 0,
        contentMatched: 0,
        conceptualBoosted,
        metadataTopScore: topScore,
      },
    };
  }

  // Pick a candidate set: the full input file list, not the
  // metadata ranking, so files the metadata engine missed can still
  // be rescued by the content scan.
  const contentScanned = await runContentScan(
    candidateFiles,
    tokens,
    options.fetchContent!,
    contentChars,
    maxContentScan,
  );

  // Stage 3 — merge metadata + content.
  const merged = mergeRankings(conceptualRanked, contentScanned);

  // Re-attach explainability reasons for any path that survived the
  // merge but lost its metadata reason (i.e. surfaced ONLY by the
  // content scan). The hybrid path-keyword reason from the
  // content scorer is already human-readable, so this is a no-op
  // for content-only matches; the existing `reason` is kept for
  // metadata matches.
  const final: RankedFile[] = merged.map((entry) => {
    if (entry.reason && entry.reason.length > 0) return entry;
    return {
      ...entry,
      reason: explainRank(entry.file, tokens),
    };
  });

  // Cap to the requested limit, if any. `rankRelevantFiles` already
  // capped the metadata half, so we only re-cap when the content
  // stage introduced new top files.
  const limit = options.limit ?? 0;
  const capped = limit > 0 ? final.slice(0, limit) : final;

  return {
    ...metadataResult,
    ranked: capped,
    hybrid: {
      contentFallbackExecuted: true,
      contentScanned: Math.min(maxContentScan, candidateFiles.length),
      contentMatched: contentScanned.length,
      conceptualBoosted,
      metadataTopScore: topScore,
    },
  };
}

/* -------------------------------------------------------------------------- */
/*  Helpers                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * Thin wrapper around `tokenizeQuery` that returns the question
 * tokens once for both the conceptual-boost and content-scan
 * stages. Split out so the per-call cost is one allocation.
 */
function scoreContentQueryTokens(question: string): string[] {
  return tokenizeQuery(question);
}
