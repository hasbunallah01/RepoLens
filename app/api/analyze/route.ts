/**
 * GET /api/analyze?url=<github-url>
 *
 * Production route. Fetches a public GitHub repository's metadata,
 * tree, and recent commits, then runs them through the local
 * indexer. Server-side because we never want to leak `GITHUB_TOKEN`
 * to the browser and we want a single place to handle errors.
 *
 * Response envelope (see `lib/api` for the full contract):
 *   { ok: true,  data: AnalysisResult }
 *   { ok: false, error: { code: AnalysisErrorCode, message, status? } }
 *
 * Status codes:
 *   200 — success
 *   400 — invalid `url` query parameter
 *   500 — unexpected internal error (sanitised, no stack trace)
 *   502 — upstream GitHub error (status echoed from GitHub)
 *   503 — missing required environment variable
 */

import { ConfigError, validateConfig } from "@/lib/config";
import { errorResponse, okResponse, withApiHandler } from "@/lib/api";
import { parseGitHubUrl } from "@/lib/github/parse-url";
import { fetchRecentCommits, fetchRepoMetadata, fetchRepoTree } from "@/lib/github/api";
import { GitHubApiError } from "@/lib/github/client";
import { buildIndex } from "@/lib/indexer";
import { createRequestLogger } from "@/lib/log";
import type { AnalysisResult } from "@/types/repository";

// Avoid caching — each call is a fresh analysis.
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export const GET = withApiHandler(async (request: Request) => {
  // Fail fast on missing required environment variables so the
  // developer sees a clear, actionable error instead of a generic
  // 5xx from the upstream service.
  try {
    validateConfig();
  } catch (err) {
    if (err instanceof ConfigError) {
      return errorResponse("MISSING_CONFIG", err.message, 503);
    }
    // Anything else from `validateConfig` is a programmer error —
    // let the top-level wrapper convert it to a sanitised 500.
    throw err;
  }

  // One logger per request. Every stage we emit from here is
  // bound to the same requestId so a Vercel Runtime Logs search
  // for that id reconstructs the timeline.
  const log = createRequestLogger();
  log.logStage("request_received");

  const { searchParams } = new URL(request.url);
  const url = searchParams.get("url") ?? "";

  const parsed = parseGitHubUrl(url);
  if (!parsed.ok) {
    log.logStage("response_returned", { status: 400, code: "INVALID_URL" });
    return errorResponse("INVALID_URL", parsed.reason, 400);
  }

  const { owner, repo } = parsed.value;
  // Only the parsed owner/repo are logged. The raw `url` query
  // string is intentionally omitted — it can include fragments,
  // query params, and user-supplied tokens we never want in logs.
  log.logStage("repo_url_received", { owner, repo });

  try {
    log.logStage("github_fetch_started");
    const fetchStart = Date.now();
    const metadata = await fetchRepoMetadata(owner, repo);
    const [tree, commits] = await Promise.all([
      fetchRepoTree(owner, repo, metadata.defaultBranch),
      fetchRecentCommits(owner, repo, 5).catch(() => [] as AnalysisResult["commits"]),
    ]);
    log.logStageWithDuration("github_fetch_completed", Date.now() - fetchStart, {
      owner,
      repo,
      defaultBranch: metadata.defaultBranch,
      treeSize: tree.tree.length,
      truncated: tree.truncated,
      commitCount: commits.length,
    });

    const index = buildIndex({
      sha: "",
      url: "",
      tree: tree.tree,
      truncated: tree.truncated,
    });

    const result: AnalysisResult = {
      url: parsed.value.raw,
      metadata,
      index,
      commits,
      fetchedAt: new Date().toISOString(),
    };

    log.logStage("response_returned", { status: 200 });
    return okResponse(result);
  } catch (err) {
    if (err instanceof GitHubApiError) {
      // `err.toAnalysisError()` returns a message that has already
      // been sanitised by the GitHub client — safe to forward.
      const upstream = err.toAnalysisError();
      log.logStage("response_returned", {
        status: upstream.status ?? 502,
        code: upstream.code,
      });
      return errorResponse(
        upstream.code,
        upstream.message,
        upstream.status ?? 502,
        { status: upstream.status },
      );
    }
    // Anything we did not classify is a true internal error —
    // re-throw so the top-level wrapper returns a sanitised 500
    // and we never leak the original message to the client.
    log.logStage("response_returned", { status: 500, code: "INTERNAL" });
    throw err;
  }
});
