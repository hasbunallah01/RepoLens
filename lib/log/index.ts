/**
 * Production-safe structured logger for the RepoLens backend.
 *
 * Goals
 * -----
 *  - Emit one single-line JSON object per stage so Vercel Runtime
 *    Logs (and any log collector that understands NDJSON) can parse,
 *    filter, and chart it without post-processing.
 *  - Always carry the same four fields: `timestamp`, `requestId`,
 *    `stage`, and `elapsedMs` (time since the previous stage in the
 *    same request).
 *  - Never log secrets, source code, prompts, or responses. The
 *    logger accepts an optional `data` bag, but the route layer is
 *    responsible for keeping that bag small and free of sensitive
 *    material. See the `STAGE_LOG_ALLOWLIST` constants in each
 *    route for the exact keys that are considered safe.
 *
 * Wire format
 * -----------
 *
 *   {"timestamp":"2025-01-01T00:00:00.000Z","requestId":"...","stage":"...","elapsedMs":123,"data":{...}}
 *
 * Why a tiny custom logger?
 * -------------------------
 * The project deliberately avoids a logging dependency. The shape
 * is small, the volume is low (one line per stage, not per request),
 * and the surface is easy to audit. If a future phase needs richer
 * behaviour (sampling, redaction middleware, transports) we can
 * swap this out without changing the call sites because the public
 * API only exposes `createRequestLogger` and `logStage`.
 */

import { randomBytes } from "node:crypto";

/* -------------------------------------------------------------------------- */
/*  Types                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * The names of the pipeline stages the backend logs. Centralised so
 * the route handlers, the README, and the verification checklist
 * stay in sync. Adding a stage here is a deliberate change — make
 * sure it has a real call site before extending the union.
 */
export type StageName =
  | "request_received"
  | "repo_url_received"
  | "github_fetch_started"
  | "github_fetch_completed"
  | "ranking_started"
  | "ranking_completed"
  | "context_builder_started"
  | "context_builder_completed"
  | "paritok_request_started"
  | "paritok_response_received"
  | "openai_request_started"
  | "openai_response_received"
  | "response_returned";

/**
 * A bag of extra context that callers can attach to a stage. Values
 * MUST be JSON-serialisable primitives or arrays/objects of the
 * same. Callers are responsible for keeping this bag free of
 * secrets — the logger does not inspect it.
 */
export type StageData = Readonly<Record<string, unknown>>;

export interface RequestLogger {
  /** Stable per-request id, included in every stage line. */
  readonly requestId: string;
  /** Emit a single stage line with elapsed time since the previous stage. */
  logStage(stage: StageName, data?: StageData): void;
  /** Emit a stage with a duration measured at the call site. */
  logStageWithDuration(
    stage: StageName,
    durationMs: number,
    data?: StageData,
  ): void;
}

/* -------------------------------------------------------------------------- */
/*  Internals                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * Generate a short, URL-safe request id. We avoid the longer UUID
 * form because the log volume per request is small and human eyes
 * look at these lines in Vercel Runtime Logs.
 */
function newRequestId(): string {
  // 6 bytes → 8 chars of base64url after stripping padding. Plenty
  // of entropy to disambiguate concurrent requests on a single
  // function instance.
  return randomBytes(6).toString("base64url");
}

/**
 * Render a stage as a single NDJSON line. We use `console.log` so
 * the line goes to stdout under the Next.js runtime — that is the
 * stream Vercel Runtime Logs captures. We deliberately do NOT use
 * `console.error`; error-level logging is reserved for actual
 * failures and is handled by `withApiHandler` in `lib/api`.
 */
function emit(
  requestId: string,
  stage: StageName,
  elapsedMs: number,
  data: StageData | undefined,
): void {
  const line = {
    timestamp: new Date().toISOString(),
    requestId,
    stage,
    elapsedMs,
    ...(data ? { data } : {}),
  };
  // eslint-disable-next-line no-console
  console.log(JSON.stringify(line));
}

/* -------------------------------------------------------------------------- */
/*  Stage metadata                                                            */
/* -------------------------------------------------------------------------- */

/**
 * Human-readable label for each stage. Kept in this module so the
 * NDJSON `stage` field stays short and machine-friendly while the
 * Vercel UI (or a future dashboard) can render the long form by
 * looking it up here.
 */
export const STAGE_LABEL: Readonly<Record<StageName, string>> = {
  request_received: "Request received",
  repo_url_received: "Repository URL received",
  github_fetch_started: "GitHub fetch started",
  github_fetch_completed: "GitHub fetch completed",
  ranking_started: "Ranking started",
  ranking_completed: "Ranking completed",
  context_builder_started: "Context builder started",
  context_builder_completed: "Context builder completed",
  paritok_request_started: "Paritok request started",
  paritok_response_received: "Paritok response received",
  openai_request_started: "OpenAI request started",
  openai_response_received: "OpenAI response received",
  response_returned: "Response returned",
};

/* -------------------------------------------------------------------------- */
/*  Public API                                                                */
/* -------------------------------------------------------------------------- */

/**
 * Create a logger bound to a single request. The first stage
 * emitted by this logger will have `elapsedMs = 0` because there
 * is no previous stage to compare against.
 *
 * Example:
 *
 *   const log = createRequestLogger();
 *   log.logStage("request_received");
 *   // ... later ...
 *   log.logStage("github_fetch_completed");
 */
export function createRequestLogger(): RequestLogger {
  const requestId = newRequestId();
  // We anchor "now" to the moment the logger is created so the
  // first stage's elapsedMs is exactly zero. Subsequent stages
  // are measured against the previous emission.
  const start = Date.now();
  let last = start;

  return {
    requestId,
    logStage(stage, data) {
      const now = Date.now();
      const elapsedMs = now - last;
      last = now;
      emit(requestId, stage, elapsedMs, data);
    },
    logStageWithDuration(stage, durationMs, data) {
      // Caller measured the duration themselves (e.g. wrapping a
      // `fetch` call). We still bump `last` so the next stage's
      // elapsed time is measured from the end of this one, not
      // from the start of the call.
      const now = Date.now();
      last = now;
      emit(requestId, stage, durationMs, data);
    },
  };
}
