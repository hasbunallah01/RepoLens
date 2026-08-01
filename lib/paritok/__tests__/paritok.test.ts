/**
 * Tests for the Paritok compression service (Phase 4A).
 *
 * The tests stub the global `fetch` so the suite never touches the
 * network. We cover the full surface of the public API:
 *
 *   - API key resolution (env + override)
 *   - request body mapping (content / query / kind / clientId)
 *   - successful response parsing
 *   - every error code: MISSING_API_KEY, NETWORK, API_ERROR,
 *     INVALID_RESPONSE, MISSING_FIELDS, ABORTED, TIMEOUT
 *
 * The Context Package fixtures come from `lib/context/mock` so the
 * tests exercise the same code path the dev page does.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  compressContextPackage,
  resolveParitokApiKey,
  buildParitokRequest,
  sendParitokRequest,
  PARITOK_API_KEY_ENV,
  PARITOK_API_URL,
  PARITOK_SCHEMA_VERSION,
} from "../index";
import { DEFAULT_PARITOK_KIND } from "../types";
import { mockAuthContext, mockRepository } from "@/lib/context/mock";
import type { ContextPackage } from "@/lib/context";

/* -------------------------------------------------------------------------- */
/*  Test helpers                                                              */
/* -------------------------------------------------------------------------- */

function buildContextPackage(question: string): ContextPackage {
  const { result } = mockAuthContext(question, { limit: 3 });
  return result.package;
}

function makeContextPackage(): ContextPackage {
  return buildContextPackage("How does authentication work?");
}

/**
 * Build a `Response`-like object that satisfies the subset of
 * the fetch API we use. Keeping this small keeps the test
 * fixtures focused on the behaviour we care about.
 */
interface MockResponseInit {
  status?: number;
  ok?: boolean;
  body?: unknown;
  raw?: string;
  delayMs?: number;
}

function makeResponse(init: MockResponseInit = {}): Response {
  const status = init.status ?? 200;
  // `ok` is accepted so callers can override the default status-class
  // check; we just keep its value here for future-proofing.
  const _ok = init.ok ?? (status >= 200 && status < 300);
  void _ok;
  const bodyText =
    init.raw !== undefined
      ? init.raw
      : init.body === undefined
        ? ""
        : JSON.stringify(init.body);
  return new Response(bodyText, {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function installFetchMock(
  impl: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>,
): ReturnType<typeof vi.fn> {
  const fn = vi.fn(impl);
  // `fetch` lives on the global object in Node 20+.
  vi.stubGlobal("fetch", fn);
  return fn;
}

function lastRequestJson(fetchMock: ReturnType<typeof vi.fn>): {
  url: string;
  method: string;
  headers: Record<string, string>;
  body: Record<string, unknown> | null;
} {
  expect(fetchMock).toHaveBeenCalledTimes(1);
  const call = fetchMock.mock.calls[0];
  if (!call) {
    throw new Error("fetch was not called");
  }
  const [url, init] = call as [string, RequestInit];
  const headers: Record<string, string> = {};
  if (init.headers) {
    const entries =
      init.headers instanceof Headers
        ? Array.from(init.headers.entries())
        : Object.entries(init.headers as Record<string, string>);
    for (const [k, v] of entries) {
      headers[k] = v;
    }
  }
  let body: Record<string, unknown> | null = null;
  if (typeof init.body === "string" && init.body.length > 0) {
    body = JSON.parse(init.body) as Record<string, unknown>;
  }
  return { url, method: init.method ?? "GET", headers, body };
}

/* -------------------------------------------------------------------------- */
/*  Setup / teardown                                                          */
/* -------------------------------------------------------------------------- */

let originalKey: string | undefined;

beforeEach(() => {
  originalKey = process.env[PARITOK_API_KEY_ENV];
  process.env[PARITOK_API_KEY_ENV] = "test-key-123";
});

afterEach(() => {
  vi.unstubAllGlobals();
  if (originalKey === undefined) {
    delete process.env[PARITOK_API_KEY_ENV];
  } else {
    process.env[PARITOK_API_KEY_ENV] = originalKey;
  }
});

/* -------------------------------------------------------------------------- */
/*  API key resolution                                                        */
/* -------------------------------------------------------------------------- */

describe("resolveParitokApiKey", () => {
  it("returns the env value when no override is given", () => {
    process.env[PARITOK_API_KEY_ENV] = "from-env";
    expect(resolveParitokApiKey()).toBe("from-env");
  });

  it("trims whitespace from the env value", () => {
    process.env[PARITOK_API_KEY_ENV] = "  spaced-key  ";
    expect(resolveParitokApiKey()).toBe("spaced-key");
  });

  it("prefers a non-empty override over the env value", () => {
    process.env[PARITOK_API_KEY_ENV] = "from-env";
    expect(resolveParitokApiKey("override-key")).toBe("override-key");
  });

  it("uses the override even when blank, so callers can force the missing-key path", () => {
    process.env[PARITOK_API_KEY_ENV] = "from-env";
    expect(resolveParitokApiKey("   ")).toBe("");
  });

  it("returns an empty string when neither is set", () => {
    delete process.env[PARITOK_API_KEY_ENV];
    expect(resolveParitokApiKey()).toBe("");
  });
});

/* -------------------------------------------------------------------------- */
/*  Request mapping                                                           */
/* -------------------------------------------------------------------------- */

describe("buildParitokRequest", () => {
  it("defaults to the file_read compression kind", () => {
    const pkg = makeContextPackage();
    const req = buildParitokRequest(pkg);
    expect(req.kind).toBe(DEFAULT_PARITOK_KIND);
    expect(req.kind).toBe("file_read");
  });

  it("echoes the question back as the query", () => {
    const pkg = buildContextPackage("What is signIn?");
    const req = buildParitokRequest(pkg);
    expect(req.query).toBe("What is signIn?");
  });

  it("concatenates every file with an attribution header", () => {
    const pkg = makeContextPackage();
    const req = buildParitokRequest(pkg);
    expect(typeof req.content).toBe("string");
    expect(req.content.length).toBeGreaterThan(0);
    for (const file of pkg.files) {
      expect(req.content).toContain(`==== file: ${file.path} ====`);
    }
  });

  it("preserves the rank order of the input files", () => {
    const pkg = makeContextPackage();
    const req = buildParitokRequest(pkg);
    let cursor = 0;
    for (const file of pkg.files) {
      const header = `==== file: ${file.path} ====`;
      const idx = req.content.indexOf(header, cursor);
      expect(idx).toBeGreaterThanOrEqual(0);
      cursor = idx + header.length;
    }
  });

  it("honours a caller-supplied kind", () => {
    const pkg = makeContextPackage();
    const req = buildParitokRequest(pkg, { kind: "docs_read" });
    expect(req.kind).toBe("docs_read");
  });

  it("embeds the repository and schema version in the clientId", () => {
    const pkg = makeContextPackage();
    const req = buildParitokRequest(pkg);
    expect(req.clientId).toBe(`repolens-${pkg.repository.fullName}-${pkg.version}`);
  });
});

/* -------------------------------------------------------------------------- */
/*  Success path                                                              */
/* -------------------------------------------------------------------------- */

describe("compressContextPackage — success", () => {
  it("posts to the Paritok endpoint with the documented headers", async () => {
    const fetchMock = installFetchMock(async () =>
      makeResponse({ body: { compressed: "ok", gpu_available: true } }),
    );

    const result = await compressContextPackage(makeContextPackage());

    expect(result.ok).toBe(true);
    const sent = lastRequestJson(fetchMock);
    expect(sent.method).toBe("POST");
    expect(sent.url).toBe(PARITOK_API_URL);
    expect(sent.headers["Content-Type"]).toBe("application/json");
    expect(sent.headers["Authorization"]).toBe("Bearer test-key-123");
  });

  it("parses the documented response shape", async () => {
    installFetchMock(async () =>
      makeResponse({
        body: {
          compressed: "the compressed payload",
          gpu_available: true,
        },
      }),
    );

    const result = await compressContextPackage(makeContextPackage());

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.compressed).toBe("the compressed payload");
    expect(result.data.gpu_available).toBe(true);
    expect(result.data.schemaVersion).toBe(PARITOK_SCHEMA_VERSION);
  });

  it("echoes the clientId back from the request", async () => {
    installFetchMock(async () =>
      makeResponse({
        body: { compressed: "ok", gpu_available: false },
      }),
    );

    const result = await compressContextPackage(makeContextPackage());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.clientId).toBe(
      `repolens-${mockRepository.fullName}-3D1`,
    );
  });

  it("sends the body fields Paritok expects", async () => {
    const fetchMock = installFetchMock(async () =>
      makeResponse({ body: { compressed: "ok", gpu_available: true } }),
    );

    await compressContextPackage(
      buildContextPackage("How does signIn work?"),
    );

    const sent = lastRequestJson(fetchMock);
    expect(sent.body).not.toBeNull();
    expect(sent.body!.content).toEqual(expect.any(String));
    expect(sent.body!.query).toBe("How does signIn work?");
    expect(sent.body!.kind).toBe("file_read");
    expect(sent.body!.clientId).toEqual(expect.any(String));
  });

  it("honours a custom endpoint for stub servers", async () => {
    const fetchMock = installFetchMock(async () =>
      makeResponse({ body: { compressed: "ok", gpu_available: true } }),
    );

    const result = await compressContextPackage(makeContextPackage(), {
      endpoint: "http://localhost:7777/api/compress",
    });

    expect(result.ok).toBe(true);
    const sent = lastRequestJson(fetchMock);
    expect(sent.url).toBe("http://localhost:7777/api/compress");
  });
});

/* -------------------------------------------------------------------------- */
/*  Error paths                                                               */
/* -------------------------------------------------------------------------- */

describe("compressContextPackage — errors", () => {
  it("returns MISSING_API_KEY when the env value is blank", async () => {
    delete process.env[PARITOK_API_KEY_ENV];
    const result = await compressContextPackage(makeContextPackage());
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("MISSING_API_KEY");
  });

  it("returns MISSING_API_KEY when a blank override is passed", async () => {
    const result = await compressContextPackage(makeContextPackage(), {
      apiKey: "   ",
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("MISSING_API_KEY");
  });

  it("returns NETWORK when fetch throws and the signal is not aborted", async () => {
    installFetchMock(async () => {
      throw new Error("ECONNREFUSED");
    });

    const result = await compressContextPackage(makeContextPackage());
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("NETWORK");
    expect(result.error.message).toMatch(/ECONNREFUSED/);
  });

  it("returns API_ERROR with the upstream status on a 5xx", async () => {
    installFetchMock(async () =>
      makeResponse({ status: 503, body: { message: "down" } }),
    );

    const result = await compressContextPackage(makeContextPackage());
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("API_ERROR");
    expect(result.error.status).toBe(503);
    expect(result.error.message).toMatch(/down/);
  });

  it("returns API_ERROR on a 401 with a clear message about the API key", async () => {
    installFetchMock(async () =>
      makeResponse({ status: 401, body: { message: "bad token" } }),
    );

    const result = await compressContextPackage(makeContextPackage());
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("API_ERROR");
    expect(result.error.status).toBe(401);
    expect(result.error.message.toLowerCase()).toContain("api key");
  });

  it("returns API_ERROR on a 429 rate limit", async () => {
    installFetchMock(async () =>
      makeResponse({ status: 429, body: { message: "slow down" } }),
    );

    const result = await compressContextPackage(makeContextPackage());
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("API_ERROR");
    expect(result.error.status).toBe(429);
    expect(result.error.message.toLowerCase()).toContain("rate limit");
  });

  it("returns INVALID_RESPONSE when the body is not JSON", async () => {
    installFetchMock(async () =>
      makeResponse({ status: 200, raw: "<html>not json</html>" }),
    );

    const result = await compressContextPackage(makeContextPackage());
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("INVALID_RESPONSE");
  });

  it("returns MISSING_FIELDS when required fields are absent", async () => {
    installFetchMock(async () =>
      makeResponse({ status: 200, body: { compressed: "only this" } }),
    );

    const result = await compressContextPackage(makeContextPackage());
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("MISSING_FIELDS");
  });

  it("returns MISSING_FIELDS when the body is not an object", async () => {
    installFetchMock(async () => makeResponse({ status: 200, raw: "true" }));

    const result = await compressContextPackage(makeContextPackage());
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("MISSING_FIELDS");
  });

  it("returns ABORTED when the caller aborts the request", async () => {
    installFetchMock(async (_input, init) => {
      return new Promise<Response>((_, reject) => {
        const signal = init?.signal;
        if (!signal) {
          reject(new Error("no signal"));
          return;
        }
        signal.addEventListener("abort", () => {
          const err = new Error("aborted");
          err.name = "AbortError";
          reject(err);
        });
      });
    });

    const controller = new AbortController();
    const promise = compressContextPackage(makeContextPackage(), {
      signal: controller.signal,
    });
    controller.abort();
    const result = await promise;

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("ABORTED");
  });

  it("returns TIMEOUT when the request exceeds the configured timeout", async () => {
    installFetchMock(async (_input, init) => {
      return new Promise<Response>((_, reject) => {
        const signal = init?.signal;
        if (!signal) {
          reject(new Error("no signal"));
          return;
        }
        signal.addEventListener("abort", () => {
          const err = new Error("aborted");
          err.name = "AbortError";
          reject(err);
        });
      });
    });

    const result = await compressContextPackage(makeContextPackage(), {
      timeoutMs: 25,
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("TIMEOUT");
  });
});

/* -------------------------------------------------------------------------- */
/*  sendParitokRequest (low-level entry point)                                */
/* -------------------------------------------------------------------------- */

describe("sendParitokRequest", () => {
  it("forwards a pre-built request to Paritok", async () => {
    const fetchMock = installFetchMock(async () =>
      makeResponse({ body: { compressed: "ok", gpu_available: true } }),
    );

    const result = await sendParitokRequest({
      content: "hello world",
      query: "what does it say?",
      kind: "file_read",
    });

    expect(result.ok).toBe(true);
    const sent = lastRequestJson(fetchMock);
    expect(sent.body!.content).toBe("hello world");
    expect(sent.body!.query).toBe("what does it say?");
  });

  it("returns MISSING_API_KEY without calling fetch", async () => {
    const fetchMock = installFetchMock(async () =>
      makeResponse({ body: { compressed: "ok", gpu_available: true } }),
    );

    const result = await sendParitokRequest(
      { content: "x", query: "q", kind: "file_read" },
      { apiKey: "  " },
    );

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("MISSING_API_KEY");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
