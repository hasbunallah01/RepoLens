/**
 * POST /api/dev/openai
 *
 * Dev-only route used to verify the OpenAI service (Phase 5A) is
 * wired up end-to-end behind the compression pipeline. It:
 *
 *   1. Receives the compressed context (the payload Paritok
 *      returned) and the user's original question in the request
 *      body.
 *   2. Forwards both into the existing `generateAnswer()` function
 *      from `@/lib/openai`.
 *   3. Returns the discriminated result as JSON.
 *
 * The route does NOT build the context itself — compression is the
 * responsibility of `/api/dev/paritok` (or the in-page pipeline in
 * `app/dev/paritok/page.tsx`). This route is the second leg only.
 *
 * Response shape (mirrors `GenerateAnswerResult`):
 *   { ok: true,  data: { answer, model, usage? } }
 *   { ok: false, error: { code, message, status? } }
 *
 * The route is **not** linked from the main navigation. It is
 * intended for local development and for the dev mock page at
 * `/dev/paritok` to call after a successful compression. Phase 5C
 * will replace this with a route that uses the real ask pipeline.
 */

import { NextResponse } from "next/server";

import { generateAnswer } from "@/lib/openai";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

interface RequestBody {
  context?: unknown;
  question?: unknown;
}

export async function POST(request: Request) {
  // Parse the body defensively — the dev page is the only caller
  // and we want clear errors rather than a 500 when it's wrong.
  let body: RequestBody;
  try {
    body = (await request.json()) as RequestBody;
  } catch {
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: "INVALID_REQUEST",
          message: "Request body must be valid JSON.",
        },
      },
      { status: 400 },
    );
  }

  const context = typeof body.context === "string" ? body.context : null;
  const question = typeof body.question === "string" ? body.question : null;

  if (context === null) {
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: "INVALID_REQUEST",
          message: "Missing or invalid 'context' (string required).",
        },
      },
      { status: 400 },
    );
  }
  if (question === null || question.trim().length === 0) {
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: "INVALID_REQUEST",
          message: "Missing or empty 'question' (non-empty string required).",
        },
      },
      { status: 400 },
    );
  }

  // Hand off to the existing OpenAI service. The service returns a
  // discriminated result — it never throws. We surface that shape
  // verbatim so the dev page can render either branch without
  // re-checking the field names.
  const result = await generateAnswer({ context, question });

  if (!result.ok) {
    // Map our own error codes onto HTTP statuses so curl / the dev
    // page can see the difference between a config problem and an
    // upstream failure. The OpenAI service does not dictate a
    // status; the route picks a reasonable one.
    const status = mapErrorStatus(result.error.code, result.error.status);
    return NextResponse.json(
      { ok: false, error: result.error },
      { status },
    );
  }

  return NextResponse.json({
    ok: true,
    data: {
      answer: result.answer,
      model: result.model,
      ...(result.usage ? { usage: result.usage } : {}),
    },
  });
}

export async function GET() {
  // Allow GET as a convenience for the dev mock page so it can be
  // hit with a browser refresh. POST is the canonical verb; this
  // delegate exists for parity with `/api/dev/paritok`.
  return POST(
    new Request("http://local", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        context: "(no context — use POST)",
        question: "How does authentication work?",
      }),
    }),
  );
}

/* -------------------------------------------------------------------------- */
/*  Internals                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * Map an OpenAI error code onto a sensible HTTP status. The dev
 * page already handles all of these shapes, so we keep the status
 * codes conservative:
 *
 *   - MISSING_API_KEY  → 503 (service not configured)
 *   - NETWORK          → 502 (bad gateway — upstream unreachable)
 *   - API_ERROR        → echo the upstream status when present,
 *                        otherwise 502
 *   - INVALID_RESPONSE → 502 (upstream gave us something unusable)
 */
function mapErrorStatus(
  code: string,
  upstreamStatus: number | undefined,
): number {
  if (code === "MISSING_API_KEY") return 503;
  if (code === "NETWORK") return 502;
  if (code === "API_ERROR") {
    if (typeof upstreamStatus === "number" && upstreamStatus >= 400 && upstreamStatus < 600) {
      return upstreamStatus;
    }
    return 502;
  }
  if (code === "INVALID_RESPONSE") return 502;
  return 500;
}
