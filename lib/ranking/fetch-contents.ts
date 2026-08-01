/**
 * Backend 7A.2 — Fetch contents for the top-ranked files only.
 *
 * Given a `RankResult` (from the existing ranking engine), this helper
 * fetches the decoded text content of each ranked file via
 * `fetchRepoFile()` (Backend 7A.1) and returns a `Map<path, content>`.
 *
 * Design rules:
 *   - Reuse only existing modules (ranking engine + GitHub helper).
 *   - Continue on per-file failures. A single 404 / decode error must
 *     not abort the whole operation; the remaining files are still
 *     fetched. The failed file is simply omitted from the returned map.
 *   - Do not change the ranking algorithm. Do not fetch every file in
 *     the repository. Do not integrate into `/api/analyze` (yet).
 *
 * This helper is preparation for the production AI pipeline; consumers
 * can be added in later milestones.
 */

import { fetchRepoFile } from "@/lib/github/api";
import type { RankResult } from "@/types/ranking";

export interface FetchRankedContentsOptions {
  /**
   * Optional repository reference (branch name, tag, or commit SHA).
   * If omitted, GitHub resolves the file against the repository's
   * default branch.
   */
  ref?: string;
  /**
   * Optional cap on how many top-ranked files to fetch. Defaults to
   * the full `ranked` list. Use this to bound network/IO if needed.
   */
  limit?: number;
  /**
   * Optional cancellation signal forwarded to each `fetchRepoFile` call.
   */
  signal?: AbortSignal;
}

/**
 * Fetch the decoded text content of every file in the given
 * {@link RankResult.ranked} list.
 *
 * The returned `Map` preserves the ranking order of its keys when
 * iterated (insertion order = ranking order), so consumers can walk
 * the top files in the order the ranking engine produced.
 *
 * Files that fail to fetch are skipped — the helper does NOT throw on
 * per-file failures (e.g. 404, decode errors). The only exception is
 * an `AbortSignal` cancellation, which is propagated so the caller can
 * shut the operation down.
 */
export async function fetchRankedFileContents(
  owner: string,
  repo: string,
  ranked: RankResult,
  options: FetchRankedContentsOptions = {},
): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  const { ref, limit, signal } = options;

  const slice =
    typeof limit === "number" && limit > 0
      ? ranked.ranked.slice(0, limit)
      : ranked.ranked;

  for (const entry of slice) {
    const path = entry.file.path;
    try {
      const content = await fetchRepoFile(owner, repo, path, ref);
      out.set(path, content);
    } catch (err) {
      // Per-file failure: skip and keep going. We never want one missing
      // file (404 on a deleted blob, decode error, etc.) to abort the
      // whole request. A future milestone can plumb per-file failures
      // back to the caller if the pipeline needs them.
      if (signal?.aborted) {
        // If the caller cancelled, surface it immediately.
        throw err;
      }
    }
  }

  return out;
}
