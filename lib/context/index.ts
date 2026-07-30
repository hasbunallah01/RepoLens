/**
 * Public surface of the Context Builder + Metrics (Phases 3D1 + 3D2).
 *
 * Consumers should import from `@/lib/context` rather than reaching
 * into the individual files. The internal layout (build-context,
 * contents, types, mock, metrics) is deliberately kept private so the
 * builder can be refactored in later phases without breaking callers.
 *
 * Independence guarantees:
 *
 *   - The Context module does NOT import from any AI / Paritok
 *     module. It only depends on the local ranking engine's output
 *     shape and the file-content registry.
 *   - The Context module never mutates file contents. It only reads
 *     them via {@link FileContentRegistry} or an inline map.
 *   - The output shape ({@link ContextPackage}) and metrics shape
 *     ({@link ContextMetrics}) are the only contracts with downstream
 *     optimization engines. They should not need to know anything
 *     about the rest of RepoLens.
 */

export {
  buildContextPackage,
  DEFAULT_CONTEXT_LIMIT,
  CONTEXT_PACKAGE_VERSION,
} from "./build-context";
export {
  FileContentRegistry,
  getDefaultContentRegistry,
  resetDefaultContentRegistry,
  readFileContent,
} from "./contents";
export {
  mockAuthContext,
  mockFileContents,
  mockIndexedFiles,
  mockRepository,
} from "./mock";
export {
  calculateContextMetrics,
  countLines,
  CHARS_PER_TOKEN,
} from "./metrics";

export type {
  BuildContextOptions,
  BuildContextResult,
  ContextError,
  ContextErrorCode,
  ContextFileEntry,
  ContextPackage,
  ContextRepositoryInfo,
} from "./types";
export type {
  ContextMetrics,
  CalculateContextMetricsOptions,
} from "./metrics";
