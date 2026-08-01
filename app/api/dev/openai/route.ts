/**
 * POST /api/dev/openai  [DEV-ONLY]
 *
 * ⚠️  Development / debugging endpoint. Not part of the production
 *     surface. In a production build this route is gated by
 *     `devOnly()` and returns 404.
 *
 * Used to verify the OpenAI service (Phase 5A) is wired up
 * end-to-end behind the compression pipeline. It:
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
 * Response envelope (see `lib/api` for the full contract):
 *   { ok: true,  data: { answer, model, usage? } }
 *   { ok: false, error: { code, message, status? } }
 *
 * The route is **not** linked from the main navigation. It is
 * intended for local development and for the dev mock page at
 * `/dev/paritok` to call after a successful compression. Phase 5C
 * will replace this with a route that uses the real ask pipeline.
 */

import { devOnly, errorResponse, okResponse, withApiHandler } from "@/lib/api";
import { generateAnswer } from "@/lib/openai";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

interface RequestBody {
  context?: unknown;
  question?: unknown;
}

/**
 * Body parsing for the dev route. We do not echo `err.message`
 * back to the client — it may include Node internals — and we
 * always return a sanitised 400 instead.
 */
async function readBody(request: Request): Promise<RequestBody | null> {
  try {
    return (await request.json()) as RequestBody;
  } catch {
    return null;
  }
}

const handler = withApiHandler(async (request: Request) => {
  const body = await readBody(request);
  if (body === null) {
    return errorResponse(
      "INVALID_REQUEST",
      "Request body must be valid JSON.",
      400,
    );
  }

  const context = typeof body.context === "string" ? body.context : null;
  const question = typeof body.question === "string" ? body.question : null;

  if (context === null) {
    return errorResponse(
      "INVALID_REQUEST",
      "Missing or invalid 'context' (string required).",
      400,
    );
  }
  if (question === null || question.trim().length === 0) {
    return errorResponse(
      "INVALID_REQUEST",
      "Missing or empty 'question' (non-empty string required).",
      400,
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
    return errorResponse(result.error.code, result.error.message, status, {
      status: result.error.status,
    });
  }

  const data: { answer: string; model: string; usage?: typeof result.usage } = {
    answer: result.answer,
    model: result.model,
  };
  if (result.usage) {
    data.usage = result.usage;
  }
  return okResponse(data);
});

export const POST = devOnly(handler);

// GET is gated the same way. It exists only as a convenience for
// the dev mock page so the route can be hit with a browser refresh.
export const GET = devOnly(async () =>
  handler(
    new Request("http://local", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        context: "(no context — use POST)",
        question: "How does authentication work?",
      }),
    }),
  ),
);

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
