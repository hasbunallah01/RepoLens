/**
 * POST /api/dev/paritok  [DEV-ONLY]
 *
 * ⚠️  Development / debugging endpoint. Not part of the production
 *     surface. In a production build this route is gated by
 *     `devOnly()` and returns 404.
 *
 * Used to verify the Paritok compression service (Phase 4A) is
 * wired up end-to-end. It:
 *
 *   1. Builds a Context Package from the mock auth repo
 *      (see `lib/context/mock`).
 *   2. Sends it to Paritok via `compressContextPackage`.
 *   3. Returns the result as JSON.
 *
 * Response envelope (see `lib/api` for the full contract):
 *   { ok: true,  data: ParitokCompressionResult, package: { ... } }
 *   { ok: false, error: { code, message, status? } }
 *
 * Note: the success body carries an extra `package` summary field
 * (request metadata — question, file count, paths) so the dev
 * mock page can render the request alongside the response. The
 * envelope still follows the `{ ok, ... }` contract.
 *
 * This route is **not** linked from the main navigation. It is
 * intended for local development and for the dev mock page at
 * `/dev/paritok`. The real ask pipeline (Phase 4B) will replace
 * this with a route that builds the Context Package from the
 * currently-loaded repo.
 */

import { NextResponse } from "next/server";
import { devOnly, errorResponse, withApiHandler } from "@/lib/api";
import { compressContextPackage } from "@/lib/paritok";
import { mockAuthContext } from "@/lib/context/mock";
import { createRequestLogger } from "@/lib/log";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

interface RequestBody {
  question?: unknown;
  limit?: unknown;
}

const handler = withApiHandler(async (request: Request) => {
  const log = createRequestLogger();
  log.logStage("request_received");

  let question = "How does authentication work?";
  try {
    const body = (await request.json().catch(() => null)) as RequestBody | null;
    if (body && typeof body.question === "string" && body.question.trim().length > 0) {
      question = body.question;
    }
  } catch {
    // No body or invalid JSON — fall back to the default.
  }

  // `mockAuthContext` is the demo repository baked into the
  // build, so we label the log line with it instead of any
  // user-supplied field.
  log.logStage("repo_url_received", { owner: "demo", repo: "mock-auth" });
  log.logStage("github_fetch_started");
  // The mock path never actually hits GitHub — the demo
  // repository is pre-baked in `lib/context/mock`. We still
  // emit a `github_fetch_completed` line so the Vercel log
  // timeline matches the production route's shape.
  log.logStageWithDuration("github_fetch_completed", 0, {
    owner: "demo",
    repo: "mock-auth",
    source: "mock",
  });

  // Ranking + context are bundled inside `mockAuthContext`. We
  // log the boundary markers around it so the operator can see
  // how long the local steps took.
  log.logStage("ranking_started");
  const rankingStart = Date.now();
  const { result, ranked } = mockAuthContext(question, { limit: 5 });
  log.logStageWithDuration("ranking_completed", Date.now() - rankingStart, {
    rankedCount: ranked.length,
  });

  log.logStage("context_builder_started");
  const contextStart = Date.now();
  const ctx = result.package;
  log.logStageWithDuration("context_builder_completed", Date.now() - contextStart, {
    fileCount: ctx?.files.length ?? 0,
    errorCount: result.errors.length,
  });

  // Quick sanity: a Context Package should always come back, even
  // if some files failed to resolve.
  if (!ctx) {
    log.logStage("response_returned", { status: 500, code: "MISSING_FIELDS" });
    return errorResponse(
      "MISSING_FIELDS",
      "Context builder returned no package.",
      500,
    );
  }

  log.logStage("paritok_request_started", { fileCount: ctx.files.length });
  const paritokStart = Date.now();
  const compressed = await compressContextPackage(ctx);
  log.logStageWithDuration("paritok_response_received", Date.now() - paritokStart, {
    ok: compressed.ok,
    fileCount: ctx.files.length,
  });

  if (!compressed.ok) {
    // Surface Paritok errors with their natural status so the dev
    // page can render a useful message.
    log.logStage("response_returned", {
      status: compressed.error.status ?? 502,
      code: compressed.error.code,
    });
    return errorResponse(
      compressed.error.code,
      compressed.error.message,
      compressed.error.status ?? 502,
      { status: compressed.error.status },
    );
  }

  log.logStage("response_returned", { status: 200 });
  return NextResponse.json(
    {
      ok: true as const,
      data: compressed.data,
      package: {
        question: ctx.question,
        repository: ctx.repository,
        fileCount: ctx.files.length,
        filePaths: ctx.files.map((f) => f.path),
        builtAt: ctx.repository.builtAt,
      },
    },
    { status: 200 },
  );
});

// POST is the canonical verb. The handler above is wrapped in
// `withApiHandler` for sanitised error reporting and then in
// `devOnly` so production deploys return 404.
export const POST = devOnly(handler);

// GET is gated the same way. It exists only as a convenience for
// the dev mock page so the route can be hit with a browser refresh.
export const GET = devOnly(async () =>
  handler(new Request("http://local", { method: "POST" })),
);
