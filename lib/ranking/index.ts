/**
 * Public surface of the local ranking engine (Phase 3C1).
 *
 * Consumers should import from `@/lib/ranking` rather than reaching into
 * the individual files. The internal layout (scoring, tokens) is
 * deliberately not exported so the engine can be refactored in later
 * phases without breaking downstream callers.
 *
 * This module is independent from the retrieval engine (Phase 3B): they
 * do not import from each other. The two engines are kept side-by-side
 * so they can evolve on different timelines.
 */

export { rankRelevantFiles } from "./rank";
export {
  scoreFilename,
  scoreFolder,
  scoreKeywordFrequency,
  scoreExtension,
} from "./scoring";
export {
  tokenize,
  tokenizeQuery,
  tokenizeFilePath,
  tokenizeFileName,
  tokenizeFolder,
} from "./tokens";
export { mockIndexedFiles, mockAuthRepo } from "./mock";
