/**
 * Domain types for Phase 4A — the Paritok compression service.
 *
 * The Paritok module is the *first* optimization engine in the RepoLens
 * pipeline. It takes a {@link import("@/lib/context").ContextPackage}
 * (Phase 3D1), asks the Paritok API to compress the relevant slices of
 * code, and returns a smaller, token-efficient version that any future
 * AI provider (OpenAI, Anthropic, …) can consume without having to
 * know anything about how the compression was produced.
 *
 * Design goals:
 *
 *   - **Independent.** This module does not import from any LLM
 *     provider. It does not embed retrieval or ranking logic. Its
 *     only upstream dependency is the {@link import("@/lib/context").ContextPackage}
 *     shape — and that is consumed as a *type* only.
 *   - **Strongly typed.** Every field on the request and response is
 *     modelled. The service never returns `any` to the rest of the
 *     application.
 *   - **Deterministic in shape.** New fields may be added in future
 *     Paritok revisions; existing ones will not be removed or renamed
 *     without bumping {@link PARITOK_SCHEMA_VERSION}.
 *   - **Friendly to testing.** Both the request and the response can
 *     be serialised to plain JSON, so the dev mock page and the unit
 *     tests can round-trip them without faking the network.
 */

/* -------------------------------------------------------------------------- */
/*  Schema version                                                            */
/* -------------------------------------------------------------------------- */

/**
 * Schema version baked into every Paritok service response. Bump this
 * if the shape of {@link ParitokCompressionResult} changes in a way
 * downstream consumers (the future LLM call, analytics UI, …) need
 * to know about.
 */
export const PARITOK_SCHEMA_VERSION = "4A" as const;

/* -------------------------------------------------------------------------- */
/*  Compression kind                                                          */
/* -------------------------------------------------------------------------- */

/**
 * The kind of content being compressed.
 *
 * Paritok uses `kind` to pick the right compression strategy for the
 * shape of the input. RepoLens only ever produces `file_read` style
 * payloads — one slice of code per call — but the type is left open
 * so future callers (e.g. log compression, README summarisation) can
 * reuse the same client without changing the wire format.
 *
 * `file_read` is the documented default and is what we use when the
 * caller does not specify a kind explicitly.
 */
export type ParitokCompressionKind =
  | "file_read"
  | "directory_read"
  | "repo_read"
  | "log_read"
  | "docs_read";

/** The default compression kind. */
export const DEFAULT_PARITOK_KIND: ParitokCompressionKind = "file_read";

/* -------------------------------------------------------------------------- */
/*  Request                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * A single slice of content to be compressed.
 *
 * Today this is always a file body from the Context Builder. The
 * shape is intentionally tiny so future call sites (e.g. one
 * directory listing, one log line, one README section) can reuse
 * the same type without growing it.
 */
export interface ParitokCompressionInput {
  /** Full text of the slice to compress. */
  content: string;
  /**
   * The user's question this slice is meant to inform. Paritok uses
   * this to keep the parts of the content that actually answer the
   * question and drop the rest.
   */
  query: string;
  /**
   * Compression strategy. Defaults to `file_read` when the caller
   * does not pass one.
   */
  kind: ParitokCompressionKind;
}

/**
 * The full request body the service POSTs to Paritok.
 *
 * The shape mirrors what Paritok's public API expects:
 *
 *   POST /api/compress
 *   {
 *     "content": "...",
 *     "query":   "...",
 *     "kind":    "file_read"
 *   }
 *
 * If Paritok ever adds more fields we will extend this type
 * additively (no breaking renames).
 */
export interface ParitokCompressionRequest extends ParitokCompressionInput {
  /**
   * Optional client-supplied identifier echoed back in the response
   * so callers can correlate a result with a specific slice when
   * batching. The current RepoLens integration always sends one
   * slice per request, so this is optional.
   */
  clientId?: string;
}

/* -------------------------------------------------------------------------- */
/*  Response                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * The successful response shape from Paritok.
 *
 * Only the fields RepoLens actually consumes are required; everything
 * else is optional so the service keeps working if Paritok ships a
 * newer or older payload.
 */
export interface ParitokCompressionResult {
  /** The compressed (token-efficient) content. */
  compressed: string;
  /**
   * Whether the Paritok GPU backend was available when the request
   * was served. Useful for telemetry and for the dev mock page
   * (the user can see at a glance whether compression was
   * GPU-accelerated or fell back to CPU).
   */
  gpu_available: boolean;
  /**
   * Echoed back from the request when the caller supplied one.
   * Always present for RepoLens calls because we set it ourselves.
   */
  clientId?: string;
  /**
   * Schema version echoed back by the service. Defaults to
   * {@link PARITOK_SCHEMA_VERSION} when the upstream does not
   * provide one.
   */
  schemaVersion?: string;
}

/* -------------------------------------------------------------------------- */
/*  Errors                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Narrow error codes raised by the Paritok compression service.
 *
 * Kept intentionally small so the rest of RepoLens can decide
 * whether to retry, fall back to raw context, or surface a user-
 * facing error. The full message is also returned so the UI / log
 * pipeline can show a developer-friendly description.
 */
export type ParitokErrorCode =
  /** `PARITOK_API_KEY` is missing or blank. */
  | "MISSING_API_KEY"
  /** The HTTP call never completed (DNS, connection reset, abort, …). */
  | "NETWORK"
  /** The HTTP call returned a non-2xx status code. */
  | "API_ERROR"
  /** The HTTP call returned a 2xx status but the body was not valid JSON. */
  | "INVALID_RESPONSE"
  /** The response JSON was valid but missing required fields. */
  | "MISSING_FIELDS"
  /** The request was aborted via {@link ParitokCompressionOptions.signal}. */
  | "ABORTED"
  /** The request exceeded the configured timeout. */
  | "TIMEOUT";

/**
 * The error shape returned to the rest of RepoLens.
 *
 * Mirrors the `{ ok: false, error: { code, message } }` envelope
 * used elsewhere in the codebase so route handlers can convert
 * these into JSON without writing a translation layer.
 */
export interface ParitokError {
  code: ParitokErrorCode;
  message: string;
  /** HTTP status code, when known. */
  status?: number;
}

/**
 * Discriminated result type returned by the service.
 *
 *   - `ok: true`  → a {@link ParitokCompressionResult} is available.
 *   - `ok: false` → a {@link ParitokError} is available.
 *
 * This shape is stable: every public entry point in the Paritok
 * module returns one of these so callers always know exactly which
 * branch they are in.
 */
export type ParitokServiceResult =
  | { ok: true; data: ParitokCompressionResult }
  | { ok: false; error: ParitokError };

/* -------------------------------------------------------------------------- */
/*  Options                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * Optional knobs accepted by `compressContextPackage()`.
 *
 * Every field has a safe default. Production callers usually only
 * need to set `kind` (or rely on the `file_read` default) and
 * `timeoutMs` (already tuned to Paritok's documented SLA).
 */
export interface ParitokCompressionOptions {
  /**
   * Compression strategy. Defaults to `file_read` — the documented
   * fit for "I have a slice of code and a question, give me the
   * parts that answer it".
   */
  kind?: ParitokCompressionKind;
  /**
   * Per-request timeout in milliseconds. Defaults to
   * {@link DEFAULT_PARITOK_TIMEOUT_MS}. The timer is implemented
   * with `AbortController` so it is also honoured when the caller
   * passes their own `signal`.
   */
  timeoutMs?: number;
  /**
   * Caller-supplied abort signal. If the signal aborts, the
   * service returns `{ ok: false, error: { code: "ABORTED" } }`.
   */
  signal?: AbortSignal;
  /**
   * Override the API base URL. Defaults to
   * `https://www.paritok.com/api/compress`. Exposed mainly so the
   * dev mock page and tests can point at a stub server without
   * touching the network.
   */
  endpoint?: string;
  /**
   * Override the bearer token. Defaults to
   * `process.env.PARITOK_API_KEY`. Used by tests; should not be
   * set in production code.
   */
  apiKey?: string;
}

/* -------------------------------------------------------------------------- */
/*  Re-exports                                                                */
/* -------------------------------------------------------------------------- */
