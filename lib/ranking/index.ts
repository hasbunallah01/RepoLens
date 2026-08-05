/**
 * Public surface of the local ranking engine (Phase 3C1 + 3C2).
 *
 * Consumers should import from `@/lib/ranking` rather than reaching into
 * the individual files. The internal layout (scoring, tokens, explain) is
 * deliberately not fully exported so the engine can be refactored in later
 * phases without breaking downstream callers.
 *
 * This module is independent from the retrieval engine (Phase 3B): they
 * do not import from each other. The two engines are kept side-by-side
 * so they can evolve on different timelines.
 */

export { rankRelevantFiles } from "./rank";
export { explainRank } from "./explain";
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
export {
  rankingCacheGet,
  rankingCacheSet,
  rankingCacheClear,
  rankingCacheKey,
} from "./cache";
export {
  fetchRankedFileContents,
  type FetchRankedContentsOptions,
} from "./fetch-contents";
export {
  rankRelevantFilesHybrid,
  HYBRID_DEFAULT_CONTENT_CHARS,
  HYBRID_DEFAULT_WEAK_SCORE_THRESHOLD,
  HYBRID_DEFAULT_WEAK_FILE_COUNT,
  HYBRID_DEFAULT_MAX_CONTENT_SCAN,
  type HybridRankOptions,
  type HybridRankResult,
} from "./hybrid";
export {
  scoreContent,
  tokenizeContent,
  MAX_CONTENT_CHARS,
  type ContentScore,
} from "./content";
export {
  extractSymbols,
  extractDocComment,
  extractImports,
  extractEnvVarRefs,
  extractAll,
  tokenizeSymbolName,
  questionSymbolCoverage,
  SYMBOL_SCAN_MAX_CHARS,
  DOC_COMMENT_MAX_CHARS,
  type ExtractedSymbols,
} from "./symbols";
export {
  inDegreeRanking,
  expandRelated,
  combinedPopularityBump,
  POPULARITY_MAX_BUMP,
  POPULARITY_LOG_MULTIPLIER,
  RELATED_BUMP,
  RELATED_BUMP_CAP,
  type PopularityOptions,
  type RelatedOptions,
} from "./popularity";
export {
  rankRelevantFilesUniversal,
  UNIVERSAL_DEFAULT_CONTENT_SCAN_CAP,
  UNIVERSAL_DEFAULT_WEAK_SCORE_THRESHOLD,
  UNIVERSAL_DEFAULT_WEAK_FILE_COUNT,
  UNIVERSAL_DEFAULT_BODY_SCAN_CHARS,
  SYMBOL_MATCH_WEIGHT,
  ENV_VAR_REF_BUMP_PER_REF,
  ENV_VAR_REF_BUMP_CAP,
  DOC_COMMENT_BODY_RATIO,
  type UniversalRankOptions,
  type UniversalRankResult,
  type UniversalRankDiagnostics,
} from "./universal";
