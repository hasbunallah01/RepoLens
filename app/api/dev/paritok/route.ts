/**
 * POST /api/dev/paritok
 *
 * Dev-only route used to verify the Paritok compression service
 * (Phase 4A) is wired up end-to-end. It:
 *
 *   1. Builds a Context Package from the mock auth repo
 *      (see `lib/context/mock`).
 *   2. Sends it to Paritok via `compressContextPackage`.
 *   3. Returns the result as JSON.
 *
 * Response shape (mirrors `ParitokServiceResult`):
 *   { ok: true,  data: ParitokCompressionResult, package: { question, fileCount, ... } }
 *   { ok: false, error: { code, message, status? } }
 *
 * This route is **not** linked from the main navigation. It is
 * intended for local development and for the dev mock page at
 * `/dev/paritok`. The real ask pipeline (Phase 4B) will replace
 * this with a route that builds the Context Package from the
 * currently-loaded repo.
 */

import { NextResponse } from "next/server";

import { compressContextPackage } from "@/lib/paritok";
import { mockAuthContext } from "@/lib/context/mock";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  // Optional override for the question — defaults to the same
  // question the mock builder is built around.
  let question = "How does authentication work?";
  try {
    const body = (await request.json().catch(() => null)) as {
      question?: string;
      limit?: number;
    } | null;
    if (body && typeof body.question === "string" && body.question.trim().length > 0) {
      question = body.question;
    }
  } catch {
    // No body or invalid JSON — fall back to the default.
  }

  const { result } = mockAuthContext(question, { limit: 5 });
  const ctx = result.package;

  // Quick sanity: a Context Package should always come back, even
  // if some files failed to resolve.
  if (!ctx) {
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: "MISSING_FIELDS",
          message: "Context builder returned no package.",
        },
      },
      { status: 500 },
    );
  }

  const compressed = await compressContextPackage(ctx);

  if (!compressed.ok) {
    // Surface Paritok errors with their natural status so the dev
    // page can render a useful message.
    const status = compressed.error.status ?? 502;
    return NextResponse.json(
      { ok: false, error: compressed.error },
      { status },
    );
  }

  return NextResponse.json({
    ok: true,
    data: compressed.data,
    package: {
      question: ctx.question,
      repository: ctx.repository,
      fileCount: ctx.files.length,
      filePaths: ctx.files.map((f) => f.path),
      builtAt: ctx.repository.builtAt,
    },
  });
}

export async function GET() {
  // Allow GET as a convenience for the dev mock page so it can be
  // hit with a browser refresh. POST is the canonical verb.
  return POST(new Request("http://local", { method: "POST" }));
}
