/**
 * GET /api/analyze?url=<github-url>
 * GET /api/analyze?url=<github-url>&question=<question>
 *
 * Production route. Fetches a public GitHub repository's metadata,
 * tree, and recent commits, then runs them through the local
 * indexer. Server-side because we never want to leak `GITHUB_TOKEN`
 * to the browser and we want a single place to handle errors.
 *
 * When `question` is supplied the route also runs the existing
 * production pipeline on top of the indexed files:
 *
 *   Repository URL
 *     ↓ Existing GitHub retrieval
 *     ↓ Existing indexing
 *     ↓ Existing Ranking Engine
 *     ↓ Existing `fetchRankedFileContents()`
 *     ↓ Existing `buildProductionContextFromMetadata()`
 *
 * The base response envelope is unchanged (see `lib/api` for the
 * full contract):
 *   { ok: true,  data: AnalysisResult }
 *   { ok: false, error: { code: AnalysisErrorCode, message, status? } }
 *
 * When `question` is supplied, the success body gains an extra
 * `package` field (the built Context Package + a small summary)
 * so the call site can inspect what would be handed to Paritok /
 * OpenAI in a later milestone. The base `data` shape is preserved.
 *
 * Status codes:
 *   200 — success
 *   400 — invalid `url` query parameter
 *   500 — unexpected internal error (sanitised, no stack trace)
 *   502 — upstream GitHub error (status echoed from GitHub)
 *   503 — missing required environment variable
 */

import { NextResponse } from "next/server";
import { ConfigError, validateConfig } from "@/lib/config";
import { errorResponse, okResponse, withApiHandler } from "@/lib/api";
import { parseGitHubUrl } from "@/lib/github/parse-url";
import { fetchRecentCommits, fetchRepoMetadata, fetchRepoTree } from "@/lib/github/api";
import { GitHubApiError } from "@/lib/github/client";
import { buildIndex } from "@/lib/indexer";
import {
  fetchRankedFileContents,
  rankRelevantFiles,
} from "@/lib/ranking";
import { buildProductionContextFromMetadata } from "@/lib/context";
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
  const questionRaw = searchParams.get("question") ?? "";
  // A `question` is only considered "supplied" when the caller sent a
  // non-empty, non-whitespace string. An empty `?question=` query
  // param is treated as no question so the base response shape
  // stays untouched for existing callers.
  const hasQuestion = questionRaw.trim().length > 0;
  const question = questionRaw;

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

    // No `question` query param: this is the original production
    // request shape. Return immediately with the analysis result
    // and nothing else, so existing callers see a byte-for-byte
    // identical response.
    if (!hasQuestion) {
      log.logStage("response_returned", { status: 200 });
      return okResponse(result);
    }

    // ----------------------------------------------------------------
    //  Production pipeline (Backend 7A.4)
    //  Reuses the existing ranking engine, `fetchRankedFileContents`,
    //  and `buildProductionContextFromMetadata`. No new pipeline is
    //  created here; this is the thin orchestrator the previous
    //  milestones anticipated.
    // ----------------------------------------------------------------

    // Ranking engine over the same `IndexedFile[]` the rest of the
    // app already uses. The default `limit` (10) is intentionally
    // preserved — the Context Builder caps the package size
    // independently via `DEFAULT_CONTEXT_LIMIT`.
    log.logStage("ranking_started");
    const rankingStart = Date.now();
    const ranked = rankRelevantFiles(question, index.files);
    log.logStageWithDuration("ranking_completed", Date.now() - rankingStart, {
      rankedCount: ranked.ranked.length,
      totalCandidates: ranked.totalCandidates,
    });

    // Fetch the decoded text content of every top-ranked file. This
    // helper is the one introduced in Backend 7A.2 — per-file
    // failures are swallowed by design so a single 404 never
    // aborts the request.
    const fileContents = await fetchRankedFileContents(
      owner,
      repo,
      ranked,
      { ref: metadata.defaultBranch },
    );

    // Build the production Context Package using inline file
    // contents. `buildProductionContextFromMetadata` is the
    // metadata-aware overload of `buildProductionContext`
    // (Backend 7A.3); it just projects `RepoMetadata` into the
    // minimal repo-info shape the Context Builder needs.
    log.logStage("context_builder_started");
    const contextStart = Date.now();
    const contextResult = buildProductionContextFromMetadata(
      metadata,
      question,
      ranked,
      fileContents,
    );
    log.logStageWithDuration("context_builder_completed", Date.now() - contextStart, {
      fileCount: contextResult.package?.files.length ?? 0,
      errorCount: contextResult.errors.length,
    });

    // The existing `data` shape is preserved verbatim; the Context
    // Package is attached as an extra top-level `package` field on
    // the success body so existing consumers (and the dashboard)
    // keep working unchanged. A future milestone can promote this
    // to the canonical response shape once the rest of the AI
    // pipeline (Paritok + OpenAI) is wired in.
    const pkg = contextResult.package;
    log.logStage("response_returned", { status: 200 });
    return NextResponse.json(
      {
        ok: true as const,
        data: result,
        package: {
          question,
          repository: pkg?.repository,
          fileCount: pkg?.files.length ?? 0,
          filePaths: pkg?.files.map((f) => f.path) ?? [],
          builtAt: pkg?.repository.builtAt,
        },
        contextPackage: pkg,
      },
      { status: 200 },
    );
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
