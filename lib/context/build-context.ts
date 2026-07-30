/**
 * The Context Builder (Phase 3D1).
 *
 * Takes the highest-ranked files from the local ranking engine and
 * assembles a clean {@link ContextPackage} that future optimization
 * engines (e.g. Paritok, Phase 4) can consume directly.
 *
 * This module is intentionally small and side-effect-free:
 *
 *   - It does NOT summarize, compress, or rewrite file contents.
 *   - It does NOT call any AI / LLM / embedding service.
 *   - It does NOT integrate with Paritok.
 *   - It does NOT touch the network or the filesystem.
 *
 * The only "input" beyond the ranked files is the
 * {@link FileContentRegistry} (or an inline map) that holds the
 * original file contents, which the indexing pipeline populates.
 *
 * Errors at the file level are non-fatal: a single unreadable file
 * is reported in `errors` and skipped. The rest of the package is
 * still returned so downstream optimizers always have something
 * to work with.
 */

import type { BuildContextOptions, BuildContextResult, ContextFileEntry, ContextPackage, ContextRepositoryInfo } from "./types";
import { getDefaultContentRegistry, readFileContent } from "./contents";
import type { RankedFile } from "@/types/ranking";

/* -------------------------------------------------------------------------- */
/*  Constants                                                                 */
/* -------------------------------------------------------------------------- */

/** Default number of files included in a context package. */
export const DEFAULT_CONTEXT_LIMIT = 5;

/**
 * Schema version baked into every package. Bump this if the shape of
 * {@link ContextPackage} changes in a way downstream optimizers need
 * to know about.
 */
export const CONTEXT_PACKAGE_VERSION = "3D1" as const;

/* -------------------------------------------------------------------------- */
/*  Public API                                                                */
/* -------------------------------------------------------------------------- */

/**
 * Build a {@link ContextPackage} from the user's question and the
 * ranked-file list produced by the ranking engine.
 *
 * The package is the single contract between the Context Builder and
 * any downstream optimization engine. It is safe to serialize (e.g.
 * with `JSON.stringify`) and pass to another process.
 *
 * @param question        The user's original question.
 * @param rankedFiles     The ranked files, highest score first.
 * @param repository      Repository identity attached to the package.
 * @param options         See {@link BuildContextOptions}.
 */
export function buildContextPackage(
  question: string,
  rankedFiles: ReadonlyArray<RankedFile>,
  repository: ContextRepositoryInfo,
  options: BuildContextOptions = {},
): BuildContextResult {
  const limit = normaliseLimit(options.limit);
  const contentSource = options.contentSource ?? "indexer";
  const registry = getDefaultContentRegistry();

  // We always echo back how many candidates the ranking engine saw,
  // even if we end up including zero files.
  const totalCandidates = rankedFiles.length;

  // Pre-compute the slice we will iterate over so the package is
  // deterministic regardless of how the caller mutates `rankedFiles`
  // after the call returns. A `limit` of 0 means "no cap" by
  // convention (see {@link BuildContextOptions.limit}).
  const topSlice = limit > 0 ? rankedFiles.slice(0, limit) : [...rankedFiles];
  const files: ContextFileEntry[] = [];
  const errors = [];

  for (const ranked of topSlice) {
    const path = ranked.file.path;
    const lookup = readFileContent(path, contentSource, options.contents, registry);
    if ("error" in lookup) {
      // Single file failure is non-fatal: record it and keep going.
      errors.push(lookup.error);
      continue;
    }
    files.push({
      path,
      name: ranked.file.name,
      extKey: ranked.file.extKey,
      language: ranked.file.language,
      content: lookup.content,
      score: ranked.score,
      reason: ranked.reason,
      metadata: ranked.file,
    });
  }

  const pkg: ContextPackage = {
    version: CONTEXT_PACKAGE_VERSION,
    question,
    repository,
    files,
    totalCandidates,
    selectedCount: files.length,
    limit,
  };

  return { package: pkg, errors };
}

/* -------------------------------------------------------------------------- */
/*  Helpers                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * Resolve the effective file limit. Anything that isn't a positive
 * finite integer collapses to "include all ranked files" (limit=0
 * means "no cap" by convention).
 */
function normaliseLimit(limit: number | undefined): number {
  if (limit === undefined) return DEFAULT_CONTEXT_LIMIT;
  if (!Number.isFinite(limit) || limit < 0) return 0;
  return Math.floor(limit);
}

/* -------------------------------------------------------------------------- */
/*  Re-exports                                                                */
/* -------------------------------------------------------------------------- */

export type {
  BuildContextOptions,
  BuildContextResult,
  ContextError,
  ContextErrorCode,
  ContextFileEntry,
  ContextPackage,
  ContextRepositoryInfo,
} from "./types";
