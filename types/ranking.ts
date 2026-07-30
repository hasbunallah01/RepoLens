/**
 * Domain types for Phase 3C1 / 3C2 — the local ranking engine.
 *
 * The ranking engine is a thin, pluggable layer that re-orders the files
 * returned by the retrieval engine. It is intentionally model-free: no
 * embeddings, no vector DB, no LLM calls. Just deterministic heuristics
 * over the {@link IndexedFile} metadata.
 *
 * Design goals:
 *   - Independent from the retrieval engine so the two can evolve
 *     separately.
 *   - Easy for future phases to add more scoring signals (just add a new
 *     weight to {@link RankSignalWeights} and a new scorer).
 *   - Output shape is stable: a list of `{ file, score, reason }` pairs
 *     sorted from highest score to lowest. Phase 3C2 adds the human-
 *     readable `reason` for UI explainability.
 */

import type { IndexedFile } from "./repository";

/**
 * A single ranked file.
 *
 * `score` is a normalized 0–100 integer where 100 = best possible match
 * given the question. The score is the weighted blend of the four active
 * signals (filename, folder, keyword frequency, extension).
 *
 * `reason` is a short (1–2 line) human-readable explanation of why the
 * file ranked where it did, derived deterministically from the scoring
 * signals — never from an AI model.
 */
export interface RankedFile {
  file: IndexedFile;
  /** Normalized relevance score in the inclusive range [0, 100]. */
  score: number;
  /** Short human-readable explanation of the ranking signal(s). */
  reason: string;
}

/** A ranking engine response. */
export interface RankResult {
  /** The original question, echoed back for context. */
  question: string;
  /**
   * Files ranked by descending score. May be empty.
   * Order is the entire point of this engine: callers can rely on
   * `result.ranked[0]` being the best match.
   */
  ranked: RankedFile[];
  /** How many files were considered before ranking. */
  totalCandidates: number;
  /** Small breakdown of the active signal weights, for debugging/UI. */
  weights: RankSignalWeights;
}

/**
 * Per-signal weights used by the ranking engine.
 *
 * All weights are non-negative. The defaults are tuned for a balanced
 * "filename + folder + path keyword" bias, with a small extension nudge.
 * Callers can override individual weights via {@link RankOptions.weights}.
 *
 * NOTE: This shape mirrors {@link RetrievalSignalWeights} for symmetry
 * but is intentionally a *separate type* so the ranking engine can add
 * new signals (e.g. recency, popularity) without churning the retrieval
 * type.
 */
export interface RankSignalWeights {
  filename: number;
  folder: number;
  keywordFrequency: number;
  extension: number;
}

/** Options accepted by `rankRelevantFiles`. */
export interface RankOptions {
  /**
   * Maximum number of files to return. Defaults to 10.
   * Set to 0 to disable the cap.
   */
  limit?: number;
  /**
   * Minimum normalized score a file must reach to be returned.
   * Files below this threshold are dropped. Defaults to 0 (no filter).
   */
  minScore?: number;
  /**
   * Override the per-signal weights. Any omitted field keeps the default.
   */
  weights?: Partial<RankSignalWeights>;
}

/** Default signal weights for the ranking engine. */
export const DEFAULT_RANK_WEIGHTS: RankSignalWeights = {
  filename: 40,
  folder: 20,
  keywordFrequency: 30,
  extension: 10,
};
