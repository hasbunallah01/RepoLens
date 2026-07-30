/**
 * `retrieveRelevantFiles` — the public entry point of the local retrieval
 * engine.
 *
 * Given a question and the indexed file list produced by the indexer, this
 * function returns a ranked list of files that look most likely to contain
 * the answer. It is **completely local**: no embeddings, no vector DB, no
 * LLM call. Just deterministic heuristics over the file metadata.
 *
 * The engine is designed to be plug-compatible with future phases:
 *   - The output shape is the same regardless of how files are ranked, so
 *     Paritok and the LLM can sit on top without changes.
 *   - Per-signal weights are exposed via {@link RetrievalOptions.weights}.
 *
 * Example:
 *   const result = retrieveRelevantFiles(
 *     "How does authentication work?",
 *     indexedFiles,
 *   );
 *   // result.matches[0].file.path -> "src/auth/auth.service.ts"
 *   // result.matches[0].score     -> 96
 *   // result.matches[0].reason    -> "Filename matches \"auth\""
 */

import type { IndexedFile } from "@/types/repository";
import {
  DEFAULT_RETRIEVAL_WEIGHTS,
  type RetrievalMatch,
  type RetrievalOptions,
  type RetrievalResult,
  type RetrievalSignalWeights,
} from "@/types/retrieval";
import {
  runAllSignals,
  makeContext,
  type AllSignals,
} from "./scoring";

/** Default cap on returned matches. */
const DEFAULT_LIMIT = 10;

/* -------------------------------------------------------------------------- */
/*  Public API                                                                */
/* -------------------------------------------------------------------------- */

/**
 * Rank the given files by relevance to the question and return the top
 * matches. Files that score 0 (no signal fired) are excluded.
 *
 * The score returned in each match is a normalized 0..100 integer, with
 * 100 = best possible match given the question. Score is the weighted
 * average of the per-signal contributions, rescaled to 0..100.
 */
export function retrieveRelevantFiles(
  question: string,
  indexedFiles: ReadonlyArray<IndexedFile>,
  options: RetrievalOptions = {},
): RetrievalResult {
  const weights = mergeWeights(options.weights);
  const totalWeight =
    weights.filename +
    weights.folder +
    weights.pathKeywords +
    weights.extension +
    weights.readme;

  // Defensive: degenerate options shouldn't crash the caller.
  if (!question || !question.trim() || indexedFiles.length === 0 || totalWeight === 0) {
    return {
      question: question ?? "",
      matches: [],
      totalCandidates: indexedFiles.length,
      weights,
    };
  }

  const ctx = makeContext(
    question,
    detectReadmePresence(indexedFiles, options.readmeReferencedPaths),
    options.readmeReferencedPaths,
  );

  // If the question was all stopwords (e.g. "How is it done?"), we have
  // no useful tokens to match on. Return early with an empty result so
  // the caller can decide what to do.
  if (ctx.queryTokens.length === 0) {
    return {
      question,
      matches: [],
      totalCandidates: indexedFiles.length,
      weights,
    };
  }

  const minScore = options.minScore ?? 0;
  const limit = options.limit ?? DEFAULT_LIMIT;

  const ranked: RetrievalMatch[] = [];

  for (const file of indexedFiles) {
    const signals = runAllSignals(file, ctx);
    const { score, reason } = aggregate(signals, weights, totalWeight);
    if (score <= 0) continue;
    if (score < minScore) continue;
    ranked.push({ file, score, reason });
  }

  // Highest first, with a stable alphabetical tiebreaker so test
  // assertions are deterministic.
  ranked.sort((a, b) => b.score - a.score || a.file.path.localeCompare(b.file.path));

  const finalLimit = limit > 0 ? limit : ranked.length;
  return {
    question,
    matches: ranked.slice(0, finalLimit),
    totalCandidates: indexedFiles.length,
    weights,
  };
}

/* -------------------------------------------------------------------------- */
/*  Internals                                                                 */
/* -------------------------------------------------------------------------- */

function mergeWeights(
  partial: Partial<RetrievalSignalWeights> | undefined,
): RetrievalSignalWeights {
  return {
    filename: partial?.filename ?? DEFAULT_RETRIEVAL_WEIGHTS.filename,
    folder: partial?.folder ?? DEFAULT_RETRIEVAL_WEIGHTS.folder,
    pathKeywords: partial?.pathKeywords ?? DEFAULT_RETRIEVAL_WEIGHTS.pathKeywords,
    extension: partial?.extension ?? DEFAULT_RETRIEVAL_WEIGHTS.extension,
    readme: partial?.readme ?? DEFAULT_RETRIEVAL_WEIGHTS.readme,
  };
}

/**
 * Pick a "best" reason from the contributing signals. The signal with
 * the highest weighted contribution wins; ties are broken by signal
 * importance order (filename > pathKeywords > folder > extension >
 * readme) so the explanation stays stable and human-meaningful.
 */
const REASON_PRIORITY = [
  "filename",
  "pathKeywords",
  "folder",
  "extension",
  "readme",
] as const;

function pickReason(
  signals: AllSignals,
  weighted: Record<keyof AllSignals, number>,
): string {
  // First pass: prefer the signal with the highest weighted contribution.
  let bestKey: keyof AllSignals = "filename";
  let bestVal = -Infinity;
  for (const key of REASON_PRIORITY) {
    if (weighted[key] > bestVal) {
      bestVal = weighted[key];
      bestKey = key;
    }
  }
  if (bestVal > 0) {
    const reason = signals[bestKey].reason;
    if (reason) return reason;
  }
  // Fallback: any non-zero signal with a reason.
  for (const key of REASON_PRIORITY) {
    const reason = signals[key].reason;
    if (signals[key].score > 0 && reason) return reason;
  }
  return "Matched question keywords";
}

function aggregate(
  signals: AllSignals,
  weights: RetrievalSignalWeights,
  totalWeight: number,
): { score: number; reason: string } {
  const weighted = {
    filename: signals.filename.score * weights.filename,
    folder: signals.folder.score * weights.folder,
    pathKeywords: signals.pathKeywords.score * weights.pathKeywords,
    extension: signals.extension.score * weights.extension,
    readme: signals.readme.score * weights.readme,
  } as const;

  // Compute both axes:
  //   peak  — the strongest single signal (drives the "primary reason" score)
  //   avg   — the weighted average of all signals (captures cumulative strength)
  // The final score blends the two: peak ensures a single strong match
  // ranks highly, while the average rewards files that match on multiple
  // dimensions. This produces scores in the 70-100 range for top matches,
  // matching the brief's intent.
  const signalScores = [
    signals.filename.score,
    signals.folder.score,
    signals.pathKeywords.score,
    signals.extension.score,
    signals.readme.score,
  ];
  const peak = signalScores.reduce((m, s) => (s > m ? s : m), 0);

  const weightedSum =
    weighted.filename +
    weighted.folder +
    weighted.pathKeywords +
    weighted.extension +
    weighted.readme;
  const avg = totalWeight === 0 ? 0 : weightedSum / totalWeight;

  const blended = peak * 0.75 + avg * 0.35;
  return {
    score: clamp(Math.round(blended), 0, 100),
    reason: pickReason(signals, weighted),
  };
}

function clamp(n: number, lo: number, hi: number): number {
  if (n < lo) return lo;
  if (n > hi) return hi;
  return n;
}

/**
 * Best-effort detection of whether a README is present in the indexed
 * files. We don't need a full RepoIndex here — we just scan filenames.
 * If a list of README-referenced paths is provided, we know the README
 * exists (since the references were derived from it).
 */
function detectReadmePresence(
  files: ReadonlyArray<IndexedFile>,
  readmeReferencedPaths?: ReadonlySet<string>,
): boolean {
  if (readmeReferencedPaths && readmeReferencedPaths.size > 0) return true;
  for (const f of files) {
    const n = f.name.toLowerCase();
    if (n === "readme" || n.startsWith("readme.")) return true;
  }
  return false;
}
