/**
 * Shared "load a repository" step.
 *
 * Both `/api/analyze` (full repository analysis) and `/api/ask`
 * (question answering) need the same starting point: fetch a
 * repository's metadata + file tree + recent commits from GitHub,
 * then build the local index over that tree. This module is the
 * single place that does that fetch-and-index work so neither route
 * duplicates it.
 *
 * This module intentionally does NOT know about ranking, context
 * building, Paritok, or OpenAI — it only produces the
 * {@link LoadedRepository} shape those later stages consume.
 */

import { fetchRecentCommits, fetchRepoMetadata, fetchRepoTree } from "@/lib/github/api";
import { buildIndex, estimateLinesOfCode } from "@/lib/indexer";
import type { RepoCommit, RepoIndex, RepoMetadata } from "@/types/repository";

export interface LoadedRepository {
  metadata: RepoMetadata;
  index: RepoIndex;
  commits: RepoCommit[];
  linesOfCode: number;
}

/**
 * Fetch a repository's metadata, tree, and recent commits from
 * GitHub, then build the local index. Commit fetch failures are
 * swallowed (an empty commit list is returned) so a single flaky
 * upstream call never aborts the whole request — this mirrors the
 * original behaviour in the `/api/analyze` route.
 *
 * Throws {@link GitHubApiError} (from `@/lib/github/client`) on
 * metadata/tree fetch failure; callers are expected to catch it the
 * same way the existing `/api/analyze` route does.
 */
export async function loadRepository(owner: string, repo: string): Promise<LoadedRepository> {
  const metadata = await fetchRepoMetadata(owner, repo);
  const [tree, commits] = await Promise.all([
    fetchRepoTree(owner, repo, metadata.defaultBranch),
    fetchRecentCommits(owner, repo, 5).catch(() => [] as RepoCommit[]),
  ]);

  const index = buildIndex({
    sha: "",
    url: "",
    tree: tree.tree,
    truncated: tree.truncated,
  });

  const linesOfCode = estimateLinesOfCode(index.files);

  return { metadata, index, commits, linesOfCode };
}
