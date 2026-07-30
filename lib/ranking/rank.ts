/**
 * `rankRelevantFiles` — the public entry point of the local ranking
 * engine (Phase 3C1).
 *
 * Given a question and a list of candidate files, this function returns
 * the same files sorted from highest relevance to lowest, with a single
 * 0..100 score attached to each. It is **completely local**: no
 * embeddings, no vector DB, no LLM call. Just deterministic heuristics
 * over file metadata.
 *
 * The engine is designed to be plug-compatible with future phases:
 *   - The output shape (`{ file, score }[]`) is stable so Paritok and the
 *     LLM can sit on top without changes.
 *   - Per-signal weights are exposed via {@link RankOptions.weights}.
 *   - New signals can be added by extending {@link RankSignalWeights} and
 *     a new scorer in `scoring.ts`.
 *
 * Example:
 *   const result = rankRelevantFiles(
 *     "How does authentication work?",
 *     indexedFiles,
 *   );
 *   // result.ranked[0].file.path -> "src/auth/auth.service.ts"
 *   // result.ranked[0].score     -> 96
 */

import type { IndexedFile } from "@/types/repository";
import {
  DEFAULT_RANK_WEIGHTS,
  type RankedFile,
  type RankOptions,
  type RankResult,
  type RankSignalWeights,
} from "@/types/ranking";
import { tokenizeQuery } from "./tokens";
import {
  scoreExtension,
  scoreFilename,
  scoreFolder,
  scoreKeywordFrequency,
} from "./scoring";

/** Default cap on returned ranked files. */
const DEFAULT_LIMIT = 10;

/* -------------------------------------------------------------------------- */
/*  Public API                                                                */
/* -------------------------------------------------------------------------- */

/**
 * Rank the given candidate files by relevance to the question and return
 * them sorted from highest score to lowest. Files that score 0 (no signal
 * fired) are excluded.
 *
 * The score returned in each entry is a normalized 0..100 integer, with
 * 100 = best possible match given the question. The score is a weighted
 * blend of the four active signals: filename, folder, keyword frequency,
 * and extension.
 */
export function rankRelevantFiles(
  question: string,
  candidateFiles: ReadonlyArray<IndexedFile>,
  options: RankOptions = {},
): RankResult {
  const weights = mergeWeights(options.weights);
  const totalWeight =
    weights.filename +
    weights.folder +
    weights.keywordFrequency +
    weights.extension;

  // Defensive: degenerate options shouldn't crash the caller.
  if (
    !question ||
    !question.trim() ||
    candidateFiles.length === 0 ||
    totalWeight === 0
  ) {
    return {
      question: question ?? "",
      ranked: [],
      totalCandidates: candidateFiles.length,
      weights,
    };
  }

  // If the question was all stopwords (e.g. "How is it done?"), we have
  // no useful tokens to match on. Return early with an empty result so
  // the caller can decide what to do.
  const queryTokens = tokenizeQuery(question);
  if (queryTokens.length === 0) {
    return {
      question,
      ranked: [],
      totalCandidates: candidateFiles.length,
      weights,
    };
  }

  const minScore = options.minScore ?? 0;
  const limit = options.limit ?? DEFAULT_LIMIT;

  const ranked: RankedFile[] = [];

  for (const file of candidateFiles) {
    const score = aggregate(file, queryTokens, weights, totalWeight);
    if (score <= 0) continue;
    if (score < minScore) continue;
    ranked.push({ file, score });
  }

  // Highest first, with a stable alphabetical tiebreaker so test
  // assertions are deterministic.
  ranked.sort(
    (a, b) => b.score - a.score || a.file.path.localeCompare(b.file.path),
  );

  const finalLimit = limit > 0 ? limit : ranked.length;
  return {
    question,
    ranked: ranked.slice(0, finalLimit),
    totalCandidates: candidateFiles.length,
    weights,
  };
}

/* -------------------------------------------------------------------------- */
/*  Internals                                                                 */
/* -------------------------------------------------------------------------- */

function mergeWeights(partial: Partial<RankSignalWeights> | undefined): RankSignalWeights {
  return {
    filename: partial?.filename ?? DEFAULT_RANK_WEIGHTS.filename,
    folder: partial?.folder ?? DEFAULT_RANK_WEIGHTS.folder,
    keywordFrequency:
      partial?.keywordFrequency ?? DEFAULT_RANK_WEIGHTS.keywordFrequency,
    extension: partial?.extension ?? DEFAULT_RANK_WEIGHTS.extension,
  };
}

/**
 * Blend the four signal scores into a single 0..100 integer.
 *
 * Strategy: weighted average of the four signals, where each signal is
 * already normalized to [0, 100]. The blend is then rescaled to keep
 * top matches in the 70-100 range (matching the brief's intent that a
 * "best match" should look obviously best).
 */
function aggregate(
  file: IndexedFile,
  queryTokens: ReadonlyArray<string>,
  weights: RankSignalWeights,
  totalWeight: number,
): number {
  const sFilename = scoreFilename(file, queryTokens);
  const sFolder = scoreFolder(file, queryTokens);
  const sKeyword = scoreKeywordFrequency(file, queryTokens);
  const sExtension = scoreExtension(file, queryTokens);

  const weightedSum =
    sFilename * weights.filename +
    sFolder * weights.folder +
    sKeyword * weights.keywordFrequency +
    sExtension * weights.extension;

  const avg = totalWeight === 0 ? 0 : weightedSum / totalWeight;

  return clamp(Math.round(avg), 0, 100);
}

function clamp(n: number, lo: number, hi: number): number {
  if (n < lo) return lo;
  if (n > hi) return hi;
  return n;
}
