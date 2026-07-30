/**
 * Public surface of the local retrieval engine (Phase 3B).
 *
 * Consumers should import from `@/lib/retrieval` rather than reaching into
 * the individual files. The internal layout (scoring, tokens) is
 * deliberately not exported so the engine can be refactored in later
 * phases without breaking downstream callers.
 */

export { retrieveRelevantFiles } from "./retrieve";
export {
  scoreFilename,
  scoreFolder,
  scorePathKeywords,
  scoreExtension,
  scoreReadme,
  runAllSignals,
  makeContext,
} from "./scoring";
export type {
  AllSignals,
  SignalScore,
  SignalContext,
} from "./scoring";
export {
  tokenize,
  tokenizeQuery,
  tokenizeFilePath,
  tokenizeFileName,
  tokenizeFolder,
} from "./tokens";
export { mockIndexedFiles, mockAuthRepo } from "./mock";
