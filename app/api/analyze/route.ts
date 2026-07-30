/**
 * GET /api/analyze?url=<github-url>
 *
 * Phase 2 endpoint. Server-side because:
 *   - we don't want to leak any GITHUB_TOKEN to the browser
 *   - we want uniform rate-limit / error handling
 *   - we want a single place to assemble metadata + tree + commits
 *
 * Response: { ok: true, data: AnalysisResult } | { ok: false, error: AnalysisError }
 */

import { NextResponse } from "next/server";
import { parseGitHubUrl } from "@/lib/github/parse-url";
import { fetchRecentCommits, fetchRepoMetadata, fetchRepoTree } from "@/lib/github/api";
import { GitHubApiError } from "@/lib/github/client";
import { buildIndex } from "@/lib/indexer";
import type { AnalysisError, AnalysisResult } from "@/types/repository";

// Avoid caching — each call is a fresh analysis.
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const url = searchParams.get("url") ?? "";

  const parsed = parseGitHubUrl(url);
  if (!parsed.ok) {
    return NextResponse.json(
      { ok: false, error: { code: "INVALID_URL", message: parsed.reason } satisfies AnalysisError },
      { status: 400 },
    );
  }

  const { owner, repo } = parsed.value;

  try {
    const metadata = await fetchRepoMetadata(owner, repo);
    const [tree, commits] = await Promise.all([
      fetchRepoTree(owner, repo, metadata.defaultBranch),
      fetchRecentCommits(owner, repo, 5).catch(() => [] as AnalysisResult["commits"]),
    ]);

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

    return NextResponse.json({ ok: true, data: result });
  } catch (err) {
    if (err instanceof GitHubApiError) {
      return NextResponse.json(
        { ok: false, error: err.toAnalysisError() },
        { status: err.status ?? 502 },
      );
    }
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: "UNKNOWN",
          message: err instanceof Error ? err.message : "Unexpected error.",
        } satisfies AnalysisError,
      },
      { status: 500 },
    );
  }
}
