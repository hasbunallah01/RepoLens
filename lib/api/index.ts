/**
 * Shared HTTP helpers for RepoLens route handlers (Backend 6B).
 *
 * Goals
 * -----
 *  - Every route returns a consistent JSON envelope.
 *  - Error responses never leak stack traces, internal request objects,
 *    environment variables, or raw upstream error payloads.
 *  - Status codes follow a small, documented convention.
 *  - Unhandled exceptions are caught and converted to a safe 500
 *    JSON response — never an HTML error page or a `throw` that
 *    surfaces Next.js's default debug output.
 *
 * Wire format
 * -----------
 *
 *   Success: { ok: true,  data: T }
 *   Failure: { ok: false, error: { code: string, message: string, status?: number } }
 *
 * The `code` field is a short, stable string the client can branch on
 * (e.g. `"INVALID_URL"`, `"RATE_LIMITED"`, `"INTERNAL"`). The `message`
 * field is human-readable and safe to display.
 *
 * HTTP status conventions
 * -----------------------
 *   200  Success.
 *   400  Caller error — invalid input, missing fields, malformed body.
 *   404  Resource not found (or dev endpoint disabled in production).
 *   405  Method not allowed.
 *   500  Internal server error — unexpected, unclassified failure.
 *   502  Upstream service (GitHub, Paritok, OpenAI) returned an error.
 *   503  Service not configured (missing required env var, etc.).
 *
 * Anything outside that list should be justified in a comment at the
 * call site.
 */

import { NextResponse } from "next/server";

/* -------------------------------------------------------------------------- */
/*  Types                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * Stable, application-wide error codes used by route handlers.
 *
 * Each route is free to introduce its own code (e.g. `INVALID_URL` for
 * `/api/analyze`) but it should always be a short, uppercase, machine-
 * readable string. Routes MUST NOT return a code that begins with
 * `INTERNAL_` — that prefix is reserved for the catch-all handler.
 */
export type ApiErrorCode = string;

export interface ApiError {
  code: ApiErrorCode;
  message: string;
  /**
   * Optional HTTP status from an upstream service. Echoed verbatim
   * so the client can distinguish a 429 from a 500, but never set to
   * a value the upstream leaked about *us* (e.g. our own auth state).
   */
  status?: number;
}

export interface ApiSuccess<T> {
  ok: true;
  data: T;
}

export interface ApiFailure {
  ok: false;
  error: ApiError;
}

export type ApiResponse<T> = ApiSuccess<T> | ApiFailure;

/* -------------------------------------------------------------------------- */
/*  Success / failure builders                                                */
/* -------------------------------------------------------------------------- */

/**
 * Build a success envelope.
 *
 *   { ok: true, data }
 */
export function okResponse<T>(data: T, init?: ResponseInit): NextResponse<ApiSuccess<T>> {
  return NextResponse.json<ApiSuccess<T>>({ ok: true, data }, init);
}

/**
 * Build an error envelope with a status code.
 *
 *   { ok: false, error: { code, message, status? } }
 *
 * The status is also set on the HTTP response. When `status` is
 * `undefined` on the error object, only the HTTP status is applied.
 */
export function errorResponse(
  code: ApiErrorCode,
  message: string,
  httpStatus: number,
  options: { status?: number; headers?: HeadersInit } = {},
): NextResponse<ApiFailure> {
  const body: ApiError = { code, message };
  if (typeof options.status === "number") {
    body.status = options.status;
  }
  return NextResponse.json<ApiFailure>({ ok: false, error: body }, {
    status: httpStatus,
    ...(options.headers ? { headers: options.headers } : {}),
  });
}

/* -------------------------------------------------------------------------- */
/*  Top-level route wrapper                                                   */
/* -------------------------------------------------------------------------- */

/**
 * Wrap a Next.js route handler so that any uncaught throw is converted
 * to a safe 500 JSON response. Without this wrapper, an unhandled
 * `throw` inside a route can bubble up as Next.js's default error
 * page (or, in development, a stack-trace response) — both of which
 * violate the production-readiness contract.
 *
 * Behaviour:
 *   - The handler's return value is forwarded as-is when it is a
 *     `NextResponse`.
 *   - Any thrown value is caught and reported as
 *     `{ ok: false, error: { code: "INTERNAL", message: ... } }`
 *     with HTTP 500. The original error is logged server-side via
 *     `console.error` so operators can still diagnose it; the
 *     message returned to the client is intentionally generic.
 *
 * Usage:
 *
 *   export const GET = withApiHandler(async (request) => {
 *     // ... happy path returns a NextResponse via okResponse / errorResponse
 *   });
 */
export function withApiHandler<Args extends unknown[]>(
  handler: (...args: Args) => Promise<Response>,
): (...args: Args) => Promise<Response> {
  return async (...args: Args): Promise<Response> => {
    try {
      return await handler(...args);
    } catch (err) {
      // Log the full error server-side so operators can diagnose.
      // We deliberately do NOT echo the original message to the
      // client — it may contain filesystem paths, internal token
      // fragments, or upstream payloads we are not allowed to leak.
      // eslint-disable-next-line no-console
      console.error("[api] unhandled error:", err);
      return errorResponse(
        "INTERNAL",
        "An unexpected error occurred. Please try again later.",
        500,
      );
    }
  };
}

/* -------------------------------------------------------------------------- */
/*  Dev-only gate                                                             */
/* -------------------------------------------------------------------------- */

/**
 * Wrap a dev-only route handler so it returns a 404 in production
 * (when `process.env.NODE_ENV === "production"`).
 *
 * The behaviour in non-production environments is unchanged: the
 * handler runs as normal. This means the dev mock page at
 * `/dev/paritok` and its companion API routes keep working in
 * `next dev` and in tests.
 *
 * Production deploys therefore cannot accidentally expose the dev
 * mock even if a future change accidentally links to it.
 */
export function devOnly<Args extends unknown[]>(
  handler: (...args: Args) => Promise<Response>,
): (...args: Args) => Promise<Response> {
  return async (...args: Args): Promise<Response> => {
    if (process.env.NODE_ENV === "production") {
      return errorResponse("NOT_FOUND", "Not found.", 404);
    }
    return handler(...args);
  };
}
