/**
 * Thin, typed wrapper around the Paritok compression API.
 *
 * This is the only file in the Paritok module that knows about
 * HTTP, JSON, timeouts, or environment variables. Everything else
 * (the public `index.ts` and the dev mock page) talks to
 * `compressContextPackage()` and never has to touch `fetch`.
 *
 *   POST https://www.paritok.com/api/compress
 *   Authorization: Bearer <PARITOK_API_KEY>
 *   Content-Type:  application/json
 *
 *   {
 *     "content": "...",
 *     "query":   "...",
 *     "kind":    "file_read"
 *   }
 *
 * Every public entry point returns a {@link ParitokServiceResult}
 * so callers never have to `try/catch` for expected failure modes
 * (missing key, network, HTTP error, malformed body, timeout). The
 * client may still `throw` for *unexpected* errors (e.g. a programmer
 * mistake) so those surface in dev rather than being swallowed.
 */

import { getParitokApiKey, PARITOK_API_KEY_ENV } from "@/lib/config";
import type { ContextPackage } from "@/lib/context";
import type {
  ParitokCompressionKind,
  ParitokCompressionOptions,
  ParitokCompressionRequest,
  ParitokCompressionResult,
  ParitokError,
  ParitokErrorCode,
  ParitokServiceResult,
} from "./types";
import {
  DEFAULT_PARITOK_KIND,
  PARITOK_SCHEMA_VERSION,
} from "./types";

/* -------------------------------------------------------------------------- */
/*  Constants                                                                 */
/* -------------------------------------------------------------------------- */

/** Default Paritok endpoint. */
export const PARITOK_API_URL = "https://www.paritok.com/api/compress";

/** Default per-request timeout, in milliseconds. */
export const DEFAULT_PARITOK_TIMEOUT_MS = 20_000;

/**
 * Environment variable holding the Paritok bearer token.
 *
 * Re-exported from `@/lib/config` so existing imports
 * (`import { PARITOK_API_KEY_ENV } from "@/lib/paritok"`) keep
 * working, and so the constant has a single source of truth.
 */
export { PARITOK_API_KEY_ENV };

/* -------------------------------------------------------------------------- */
/*  Result helpers                                                            */
/* -------------------------------------------------------------------------- */

function ok(data: ParitokCompressionResult): ParitokServiceResult {
  return { ok: true, data };
}

function fail(
  code: ParitokErrorCode,
  message: string,
  status?: number,
): ParitokServiceResult {
  const error: ParitokError =
    status === undefined ? { code, message } : { code, message, status };
  return { ok: false, error };
}

/* -------------------------------------------------------------------------- */
/*  API key resolution                                                        */
/* -------------------------------------------------------------------------- */

/**
 * Resolve the Paritok API key from the supplied override or the
 * `PARITOK_API_KEY` environment variable.
 *
 * Resolution rules, in order:
 *
 *   1. If `override` is provided (even as a blank string), that
 *      value is used verbatim after trimming. This lets tests
 *      deterministically force the "missing key" branch by passing
 *      an empty string.
 *   2. Otherwise, the centralised config module reads
 *      `process.env.PARITOK_API_KEY` (trimmed) lazily so that tests
 *      which mutate `process.env` between calls still see the
 *      updated value.
 *   3. Otherwise, an empty string is returned.
 *
 * Callers should treat an empty result as a hard failure — we
 * never want to send a request with a blank bearer token.
 */
export function resolveParitokApiKey(override?: string): string {
  if (override !== undefined) {
    return override.trim();
  }
  return getParitokApiKey() ?? "";
}

/* -------------------------------------------------------------------------- */
/*  Request mapping                                                           */
/* -------------------------------------------------------------------------- */

/**
 * Map a single {@link ContextPackage} into the body Paritok
 * expects.
 *
 * The mapping is intentionally tiny:
 *
 *   - `content` ← concatenation of all included file bodies, in
 *     the same rank order the Context Builder produced them, each
 *     one prefixed with a header line so Paritok can attribute
 *     slices back to their source file.
 *   - `query`  ← the user's original question.
 *   - `kind`   ← `file_read` by default; overridable per call.
 *
 * The header line uses a comment-style prefix that does not
 * collide with any common source language (no `//` / `#` / `--` /
 * `%`) so Paritok can tokenize the content without getting
 * confused by attribution markers.
 */
export function buildParitokRequest(
  pkg: ContextPackage,
  options: ParitokCompressionOptions = {},
): ParitokCompressionRequest {
  const kind: ParitokCompressionKind = options.kind ?? DEFAULT_PARITOK_KIND;

  const sections = pkg.files.map((file) => {
    // `==== file: <path> ====` is safe across every language we
    // expect to ship through Paritok (TypeScript, Python, Go, …).
    return `==== file: ${file.path} ====\n${file.content}`;
  });

  return {
    content: sections.join("\n\n"),
    query: pkg.question,
    kind,
    clientId: `repolens-${pkg.repository.fullName}-${pkg.version}`,
  };
}

/* -------------------------------------------------------------------------- */
/*  Response parsing                                                          */
/* -------------------------------------------------------------------------- */

/**
 * Parse Paritok's raw JSON response into our strongly-typed
 * {@link ParitokCompressionResult}.
 *
 * Returns `null` (and never throws) when the body is missing a
 * field the rest of RepoLens needs.
 */
function parseParitokResponse(
  raw: unknown,
  clientId: string | undefined,
): ParitokCompressionResult | null {
  if (typeof raw !== "object" || raw === null) {
    return null;
  }
  const body = raw as Record<string, unknown>;
  const compressed = body.compressed;
  if (typeof compressed !== "string" || compressed.length === 0) {
    return null;
  }
  const gpuAvailable = body.gpu_available;
  if (typeof gpuAvailable !== "boolean") {
    return null;
  }

  const result: ParitokCompressionResult = {
    compressed,
    gpu_available: gpuAvailable,
    schemaVersion: PARITOK_SCHEMA_VERSION,
  };
  if (clientId !== undefined) {
    result.clientId = clientId;
  }
  // Honour an upstream schemaVersion if Paritok ships one. We still
  // fall back to our own constant above so the field is always set.
  if (typeof body.schemaVersion === "string") {
    result.schemaVersion = body.schemaVersion;
  }
  return result;
}

/* -------------------------------------------------------------------------- */
/*  Status → error code mapping                                               */
/* -------------------------------------------------------------------------- */

function mapStatusToCode(status: number): {
  code: ParitokErrorCode;
  message: string;
} {
  if (status === 401 || status === 403) {
    return {
      code: "API_ERROR",
      message:
        "Paritok rejected the API key. Double-check PARITOK_API_KEY in your environment.",
    };
  }
  if (status === 429) {
    return {
      code: "API_ERROR",
      message:
        "Paritok rate limit reached. Wait a moment before retrying, or check your plan.",
    };
  }
  if (status >= 500) {
    return {
      code: "API_ERROR",
      message:
        "Paritok is having trouble right now. Please try again in a moment.",
    };
  }
  return {
    code: "API_ERROR",
    message: `Unexpected Paritok response (HTTP ${status}).`,
  };
}

/* -------------------------------------------------------------------------- */
/*  Timeout helper                                                            */
/* -------------------------------------------------------------------------- */

/**
 * Build a combined abort signal from a caller's `signal` and a
 * timeout. The returned signal aborts when *either* source fires.
 */
function withTimeout(
  signal: AbortSignal | undefined,
  timeoutMs: number,
): { signal: AbortSignal; cleanup: () => void; timedOut: () => boolean } {
  const controller = new AbortController();
  let timedOutFlag = false;

  const timer = setTimeout(() => {
    timedOutFlag = true;
    controller.abort();
  }, timeoutMs);

  // Forward caller-initiated aborts to our controller.
  const onCallerAbort = () => controller.abort();
  if (signal) {
    if (signal.aborted) {
      controller.abort();
    } else {
      signal.addEventListener("abort", onCallerAbort, { once: true });
    }
  }

  return {
    signal: controller.signal,
    timedOut: () => timedOutFlag,
    cleanup: () => {
      clearTimeout(timer);
      if (signal) {
        signal.removeEventListener("abort", onCallerAbort);
      }
    },
  };
}

/* -------------------------------------------------------------------------- */
/*  Public entry point                                                        */
/* -------------------------------------------------------------------------- */

/**
 * Send a {@link ContextPackage} to Paritok and return the compressed
 * version.
 *
 * Always returns a {@link ParitokServiceResult}. Never throws for
 * expected failure modes (missing key, network, HTTP error, malformed
 * body, timeout).
 *
 * The function is `async` so it can be awaited from any caller in
 * the RepoLens pipeline (route handlers, server actions, the dev
 * mock page, tests).
 */
export async function compressContextPackage(
  pkg: ContextPackage,
  options: ParitokCompressionOptions = {},
): Promise<ParitokServiceResult> {
  // 1. API key. We refuse to even build the request if it is missing.
  const apiKey = resolveParitokApiKey(options.apiKey);
  if (apiKey.length === 0) {
    return fail(
      "MISSING_API_KEY",
      "PARITOK_API_KEY is not set. Add it to your environment before calling Paritok.",
    );
  }

  // 2. Build the request body.
  const request = buildParitokRequest(pkg, options);

  // 3. Compose the abort signal (caller abort + timeout).
  const timeoutMs = options.timeoutMs ?? DEFAULT_PARITOK_TIMEOUT_MS;
  const { signal, cleanup, timedOut } = withTimeout(options.signal, timeoutMs);

  // 4. Endpoint. Honour the override for tests / mock servers.
  const endpoint = options.endpoint ?? PARITOK_API_URL;

  try {
    let res: Response;
    try {
      res = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
          Accept: "application/json",
          "User-Agent": "RepoLens/Phase4A",
        },
        body: JSON.stringify(request),
        cache: "no-store",
        signal,
      });
    } catch (err) {
      // Caller-initiated abort takes precedence over a generic
      // network failure so the UI can show a clean "request
      // cancelled" message.
      if (options.signal?.aborted) {
        return fail("ABORTED", "Paritok request was aborted by the caller.");
      }
      if (timedOut()) {
        return fail(
          "TIMEOUT",
          `Paritok did not respond within ${timeoutMs}ms. Try again or increase the timeout.`,
        );
      }
      const message =
        err instanceof Error ? err.message : "Unknown network error";
      return fail(
        "NETWORK",
        `Could not reach Paritok. Check your connection and try again. (${message})`,
      );
    }

    if (!res.ok) {
      // Try to extract a more specific error message from the body,
      // but do not fail the parse if the body is not JSON.
      let apiMessage: string | null = null;
      try {
        const body = (await res.json()) as { message?: string; error?: string };
        apiMessage = body.message ?? body.error ?? null;
      } catch {
        /* non-JSON body, ignore */
      }
      const mapped = mapStatusToCode(res.status);
      const finalMessage = apiMessage
        ? `${mapped.message} (${apiMessage})`
        : mapped.message;
      return fail(mapped.code, finalMessage, res.status);
    }

    // 5. Parse the body. Anything that does not look like our
    //    documented response is reported as INVALID_RESPONSE.
    let raw: unknown;
    try {
      raw = await res.json();
    } catch {
      return fail(
        "INVALID_RESPONSE",
        "Paritok returned a non-JSON body. The upstream service may be misbehaving.",
      );
    }

    const parsed = parseParitokResponse(raw, request.clientId);
    if (parsed === null) {
      return fail(
        "MISSING_FIELDS",
        "Paritok response is missing required fields (compressed, gpu_available).",
      );
    }

    return ok(parsed);
  } finally {
    cleanup();
  }
}

/* -------------------------------------------------------------------------- */
/*  Thin low-level wrapper                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Send a pre-built Paritok request and return the response.
 *
 * Most callers should use {@link compressContextPackage} instead —
 * this entry point exists for tests, the dev mock page, and any
 * future caller that needs to bypass the Context Package mapping
 * (e.g. log compression, README summarisation).
 */
export async function sendParitokRequest(
  request: ParitokCompressionRequest,
  options: ParitokCompressionOptions = {},
): Promise<ParitokServiceResult> {
  const apiKey = resolveParitokApiKey(options.apiKey);
  if (apiKey.length === 0) {
    return fail(
      "MISSING_API_KEY",
      "PARITOK_API_KEY is not set. Add it to your environment before calling Paritok.",
    );
  }

  const timeoutMs = options.timeoutMs ?? DEFAULT_PARITOK_TIMEOUT_MS;
  const { signal, cleanup, timedOut } = withTimeout(options.signal, timeoutMs);
  const endpoint = options.endpoint ?? PARITOK_API_URL;

  try {
    let res: Response;
    try {
      res = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
          Accept: "application/json",
          "User-Agent": "RepoLens/Phase4A",
        },
        body: JSON.stringify(request),
        cache: "no-store",
        signal,
      });
    } catch (err) {
      if (options.signal?.aborted) {
        return fail("ABORTED", "Paritok request was aborted by the caller.");
      }
      if (timedOut()) {
        return fail(
          "TIMEOUT",
          `Paritok did not respond within ${timeoutMs}ms. Try again or increase the timeout.`,
        );
      }
      const message =
        err instanceof Error ? err.message : "Unknown network error";
      return fail(
        "NETWORK",
        `Could not reach Paritok. Check your connection and try again. (${message})`,
      );
    }

    if (!res.ok) {
      let apiMessage: string | null = null;
      try {
        const body = (await res.json()) as { message?: string; error?: string };
        apiMessage = body.message ?? body.error ?? null;
      } catch {
        /* non-JSON body, ignore */
      }
      const mapped = mapStatusToCode(res.status);
      const finalMessage = apiMessage
        ? `${mapped.message} (${apiMessage})`
        : mapped.message;
      return fail(mapped.code, finalMessage, res.status);
    }

    let raw: unknown;
    try {
      raw = await res.json();
    } catch {
      return fail(
        "INVALID_RESPONSE",
        "Paritok returned a non-JSON body. The upstream service may be misbehaving.",
      );
    }

    const parsed = parseParitokResponse(raw, request.clientId);
    if (parsed === null) {
      return fail(
        "MISSING_FIELDS",
        "Paritok response is missing required fields (compressed, gpu_available).",
      );
    }
    return ok(parsed);
  } finally {
    cleanup();
  }
}
