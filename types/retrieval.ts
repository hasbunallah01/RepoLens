/**
 * Domain types for Phase 3B — the local retrieval engine.
 *
 * The retrieval engine is the "what files matter for this question?" layer
 * that sits between indexing and the (future) Paritok + LLM stages. It is
 * intentionally model-free: no embeddings, no vector DB, no LLM calls. Just
 * deterministic heuristics over the {@link IndexedFile} metadata.
 *
 * Later phases are expected to layer Paritok and an LLM on top of these
 * results, but the contract here is stable.
 */

import type { IndexedFile } from "./repository";

/**
 * A single file surfaced by the retrieval engine.
 *
 * `score` is normalized to a 0–100 integer where 100 = best possible match
 * given the question. `reason` is a short human-readable explanation of why
 * the file was matched (suitable for showing in the UI).
 */
export interface RetrievalMatch {
  file: IndexedFile;
  /** Normalized relevance score in the inclusive range [0, 100]. */
  score: number;
  /** Short human-readable reason explaining the match. */
  reason: string;
}

/** A retrieval engine response. */
export interface RetrievalResult {
  /** The original question, echoed back for context. */
  question: string;
  /** Files ranked by descending score. May be empty. */
  matches: RetrievalMatch[];
  /** How many files were considered before ranking. */
  totalCandidates: number;
  /** Small breakdown of the active signal weights, for debugging/UI. */
  weights: RetrievalSignalWeights;
}

/**
 * Per-signal weights used by the retrieval engine.
 *
 * All weights are non-negative. The defaults are tuned for a balanced
 * "filename + folder + path keyword" bias, which is what most natural
 * questions benefit from. Callers can override individual weights via
 * {@link RetrievalOptions.weights}.
 */
export interface RetrievalSignalWeights {
  filename: number;
  folder: number;
  pathKeywords: number;
  extension: number;
  readme: number;
}

/** Options accepted by `retrieveRelevantFiles`. */
export interface RetrievalOptions {
  /**
   * Maximum number of matches to return. Defaults to 10.
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
  weights?: Partial<RetrievalSignalWeights>;
  /**
   * Optional list of file paths the README is known to reference.
   * These paths get a small {@link RetrievalSignalWeights.readme} boost.
   * If omitted, only the README file itself is boosted.
   */
  readmeReferencedPaths?: ReadonlySet<string>;
}

/** Default signal weights. */
export const DEFAULT_RETRIEVAL_WEIGHTS: RetrievalSignalWeights = {
  filename: 50,
  folder: 20,
  pathKeywords: 20,
  extension: 5,
  readme: 5,
};
