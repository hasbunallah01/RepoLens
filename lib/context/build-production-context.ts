/**
 * Backend 7A.3 — Build a production-ready Context Package from ranked
 * file contents.
 *
 * This helper stitches together:
 *   - the existing local ranking engine's output (`RankResult`)
 *   - the file-content `Map` produced by Backend 7A.2's
 *     `fetchRankedFileContents`
 *   - the existing Context Builder (`buildContextPackage`)
 *
 * It does NOT modify any of those modules. It is a thin orchestrator
 * that picks the inline content source so the Context Builder reads
 * the per-request `Map` instead of the global indexer cache, and
 * returns the {@link ContextPackage} unchanged in shape — ready to be
 * handed to Paritok in a later milestone.
 *
 * This helper is not yet wired into `/api/analyze`. It exists so the
 * next pipeline stage can call it directly.
 */

import {
  buildContextPackage,
  DEFAULT_CONTEXT_LIMIT,
} from "./build-context";
import type {
  BuildContextResult,
  ContextRepositoryInfo,
} from "./types";
import type { RankResult } from "@/types/ranking";
import type { RepoMetadata } from "@/types/repository";

/**
 * Minimal repository identity required to build a context package.
 *
 * Kept as a small, dedicated shape (rather than reusing the full
 * `RepoMetadata` or the bare `owner/repo` strings) so the call site
 * stays explicit about what the Context Builder actually needs, and
 * so we don't leak unrelated metadata fields into the package.
 */
export interface ProductionContextRepoInfo {
  /** Repository owner, e.g. "vercel". */
  owner: string;
  /** Repository name, e.g. "next.js". */
  repo: string;
  /** Default branch to attach to the package. */
  defaultBranch: string;
  /** Primary language reported by GitHub, or null if unknown. */
  primaryLanguage: string | null;
}

export interface BuildProductionContextOptions {
  /**
   * Maximum number of files to include in the package. Defaults to
   * {@link DEFAULT_CONTEXT_LIMIT} (5). Set to 0 to include all
   * ranked files. Any value the Context Builder doesn't accept is
   * forwarded as-is — the builder normalises it.
   */
  limit?: number;
}

/**
 * Build a production-ready {@link BuildContextResult} for the given
 * ranked files, using the per-request `fileContents` map as the
 * content source.
 *
 * The helper never throws on per-file failures (the underlying
 * Context Builder already reports them via `result.errors` and skips
 * the missing file). It only returns a `BuildContextResult` whose
 * `package` is always populated, even when the file-content map was
 * empty.
 */
export function buildProductionContext(
  repository: ProductionContextRepoInfo,
  question: string,
  ranked: RankResult,
  fileContents: ReadonlyMap<string, string>,
  options: BuildProductionContextOptions = {},
): BuildContextResult {
  const contextRepo: ContextRepositoryInfo = {
    fullName: `${repository.owner}/${repository.repo}`,
    defaultBranch: repository.defaultBranch,
    primaryLanguage: repository.primaryLanguage,
    builtAt: new Date().toISOString(),
  };

  return buildContextPackage(
    question,
    ranked.ranked,
    contextRepo,
    {
      limit: options.limit ?? DEFAULT_CONTEXT_LIMIT,
      contentSource: "inline",
      contents: fileContents,
    },
  );
}

/**
 * Convenience overload: accept a full {@link RepoMetadata} (as
 * produced by `fetchRepoMetadata`) and project it into the minimal
 * shape the Context Builder needs. Lets future pipeline stages pass
 * the metadata they already have on hand.
 */
export function buildProductionContextFromMetadata(
  metadata: RepoMetadata,
  question: string,
  ranked: RankResult,
  fileContents: ReadonlyMap<string, string>,
  options: BuildProductionContextOptions = {},
): BuildContextResult {
  return buildProductionContext(
    {
      owner: metadata.owner,
      repo: metadata.name,
      defaultBranch: metadata.defaultBranch,
      primaryLanguage: metadata.primaryLanguage,
    },
    question,
    ranked,
    fileContents,
    options,
  );
}
