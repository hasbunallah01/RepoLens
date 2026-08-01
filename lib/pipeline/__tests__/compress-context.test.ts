/**
 * Tests for the Phase 4B1 pipeline.
 *
 * The tests stub the global `fetch` so the suite never touches the
 * network. We cover:
 *
 *   - The Context Package produced upstream is forwarded to Paritok
 *     unchanged (same `question`, same `files`, same `repository`).
 *   - The Context Builder's per-file errors are surfaced on
 *     `result.contextErrors` (and do NOT fail the pipeline).
 *   - A successful Paritok response is parsed and returned.
 *   - Every Paritok error code propagates through the pipeline
 *     without throwing.
 *   - The pipeline never duplicates the Context Builder's logic or
 *     the Paritok client's logic — it only orchestrates them.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { compressContext } from "../index";
import { buildContextPackage } from "@/lib/context";
import {
  mockFileContents,
  mockIndexedFiles,
  mockRepository,
} from "@/lib/context/mock";
import { rankRelevantFiles } from "@/lib/ranking";
import {
  PARITOK_API_KEY_ENV,
  PARITOK_API_URL,
  PARITOK_SCHEMA_VERSION,
} from "@/lib/paritok";

/* -------------------------------------------------------------------------- */
/*  Test helpers                                                              */
/* -------------------------------------------------------------------------- */

function buildRanked(): ReturnType<typeof rankRelevantFiles>["ranked"] {
  return rankRelevantFiles("How does authentication work?", mockIndexedFiles, {
    limit: 20,
  }).ranked;
}

/**
 * Build a ranked list and a matching inline-content map so the
 * Context Builder can resolve every file. Mirrors the helper used
 * in `lib/context/__tests__/build-context.test.ts`.
 */
function makeInput(limit = 3): {
  ranked: ReturnType<typeof rankRelevantFiles>["ranked"];
} {
  return { ranked: buildRanked().slice(0, limit) };
}

function makeResponse(init: {
  status?: number;
  body?: unknown;
  raw?: string;
} = {}): Response {
  const status = init.status ?? 200;
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
  if (!call) throw new Error("fetch was not called");
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
  process.env[PARITOK_API_KEY_ENV] = "test-pipeline-key";
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
/*  Forwarding the Context Package                                            */
/* -------------------------------------------------------------------------- */

describe("compressContext — Context Builder → Paritok forwarding", () => {
  it("builds a Context Package and forwards it to Paritok", async () => {
    const fetchMock = installFetchMock(async () =>
      makeResponse({
        body: { compressed: "compressed-payload", gpu_available: true },
      }),
    );

    const { ranked } = makeInput(3);
    const result = await compressContext(
      "How does authentication work?",
      ranked,
      mockRepository,
      { contentSource: "inline", contents: mockFileContents, limit: 3 },
    );

    expect(result.package.question).toBe("How does authentication work?");
    expect(result.package.repository).toEqual(mockRepository);
    expect(result.package.files.length).toBeGreaterThan(0);
    expect(result.package.files.length).toBeLessThanOrEqual(3);

    const sent = lastRequestJson(fetchMock);
    expect(sent.method).toBe("POST");
    expect(sent.url).toBe(PARITOK_API_URL);
    expect(sent.headers["Authorization"]).toBe("Bearer test-pipeline-key");
    expect(sent.body!.query).toBe("How does authentication work?");
    expect(sent.body!.kind).toBe("file_read");
  });

  it("does not duplicate Context Builder logic — the package equals what buildContextPackage returns", async () => {
    installFetchMock(async () =>
      makeResponse({
        body: { compressed: "ok", gpu_available: true },
      }),
    );

    // Build a fresh package via the Context Builder directly with
    // the same arguments the pipeline will use.
    const ranked = buildRanked();
    const built = buildContextPackage(
      "How does authentication work?",
      ranked,
      mockRepository,
      { contentSource: "inline", contents: mockFileContents, limit: 4 },
    );

    const result = await compressContext(
      "How does authentication work?",
      ranked,
      mockRepository,
      { contentSource: "inline", contents: mockFileContents, limit: 4 },
    );

    // The pipeline must produce the *same* package the Context
    // Builder would have produced on its own.
    expect(result.package).toEqual(built.package);
    expect(result.contextErrors).toEqual(built.errors);
  });

  it("forwards the limit to the Context Builder", async () => {
    installFetchMock(async () =>
      makeResponse({ body: { compressed: "ok", gpu_available: true } }),
    );

    const { ranked } = makeInput(5);
    const result = await compressContext(
      "How does authentication work?",
      ranked,
      mockRepository,
      { contentSource: "inline", contents: mockFileContents, limit: 1 },
    );

    expect(result.package.limit).toBe(1);
    expect(result.package.files.length).toBe(1);
  });

  it("surfaces Context Builder per-file errors on result.contextErrors", async () => {
    installFetchMock(async () =>
      makeResponse({ body: { compressed: "ok", gpu_available: true } }),
    );

    // Use a contents map that is *missing* one of the ranked files
    // so the Context Builder reports a non-fatal error.
    const partialContents = new Map<string, string>();
    const ranked = buildRanked();
    const first = ranked[0];
    if (!first) throw new Error("expected at least one ranked file");
    partialContents.set(first.file.path, "// only one file's content");

    const result = await compressContext(
      "How does authentication work?",
      ranked,
      mockRepository,
      { contentSource: "inline", contents: partialContents, limit: 5 },
    );

    expect(result.package.files.length).toBe(1);
    expect(result.contextErrors.length).toBeGreaterThan(0);
    // The error must not stop the pipeline.
    expect(result.compressed.ok).toBe(true);
  });
});

/* -------------------------------------------------------------------------- */
/*  Success path                                                              */
/* -------------------------------------------------------------------------- */

describe("compressContext — success path", () => {
  it("returns the parsed Paritok result on success", async () => {
    installFetchMock(async () =>
      makeResponse({
        body: {
          compressed: "the compressed payload",
          gpu_available: true,
        },
      }),
    );

    const { ranked } = makeInput(3);
    const result = await compressContext(
      "How does authentication work?",
      ranked,
      mockRepository,
      { contentSource: "inline", contents: mockFileContents, limit: 3 },
    );

    expect(result.compressed.ok).toBe(true);
    if (!result.compressed.ok) return;
    expect(result.compressed.data.compressed).toBe("the compressed payload");
    expect(result.compressed.data.gpu_available).toBe(true);
    expect(result.compressed.data.schemaVersion).toBe(PARITOK_SCHEMA_VERSION);
  });
});

/* -------------------------------------------------------------------------- */
/*  Error path propagation                                                    */
/* -------------------------------------------------------------------------- */

describe("compressContext — error path propagation", () => {
  it("returns MISSING_API_KEY without calling fetch", async () => {
    delete process.env[PARITOK_API_KEY_ENV];
    const fetchMock = installFetchMock(async () =>
      makeResponse({ body: { compressed: "ok", gpu_available: true } }),
    );

    const { ranked } = makeInput(3);
    const result = await compressContext(
      "How does authentication work?",
      ranked,
      mockRepository,
      { contentSource: "inline", contents: mockFileContents, limit: 3 },
    );

    expect(result.compressed.ok).toBe(false);
    if (result.compressed.ok) return;
    expect(result.compressed.error.code).toBe("MISSING_API_KEY");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("propagates NETWORK errors", async () => {
    installFetchMock(async () => {
      throw new Error("ECONNREFUSED");
    });

    const { ranked } = makeInput(3);
    const result = await compressContext(
      "How does authentication work?",
      ranked,
      mockRepository,
      { contentSource: "inline", contents: mockFileContents, limit: 3 },
    );

    expect(result.compressed.ok).toBe(false);
    if (result.compressed.ok) return;
    expect(result.compressed.error.code).toBe("NETWORK");
  });

  it("propagates API_ERROR with status on a 5xx", async () => {
    installFetchMock(async () =>
      makeResponse({ status: 503, body: { message: "down" } }),
    );

    const { ranked } = makeInput(3);
    const result = await compressContext(
      "How does authentication work?",
      ranked,
      mockRepository,
      { contentSource: "inline", contents: mockFileContents, limit: 3 },
    );

    expect(result.compressed.ok).toBe(false);
    if (result.compressed.ok) return;
    expect(result.compressed.error.code).toBe("API_ERROR");
    expect(result.compressed.error.status).toBe(503);
  });

  it("propagates INVALID_RESPONSE when the body is not JSON", async () => {
    installFetchMock(async () =>
      makeResponse({ status: 200, raw: "<html>nope</html>" }),
    );

    const { ranked } = makeInput(3);
    const result = await compressContext(
      "How does authentication work?",
      ranked,
      mockRepository,
      { contentSource: "inline", contents: mockFileContents, limit: 3 },
    );

    expect(result.compressed.ok).toBe(false);
    if (result.compressed.ok) return;
    expect(result.compressed.error.code).toBe("INVALID_RESPONSE");
  });

  it("propagates MISSING_FIELDS when required fields are absent", async () => {
    installFetchMock(async () =>
      makeResponse({ status: 200, body: { compressed: "only this" } }),
    );

    const { ranked } = makeInput(3);
    const result = await compressContext(
      "How does authentication work?",
      ranked,
      mockRepository,
      { contentSource: "inline", contents: mockFileContents, limit: 3 },
    );

    expect(result.compressed.ok).toBe(false);
    if (result.compressed.ok) return;
    expect(result.compressed.error.code).toBe("MISSING_FIELDS");
  });

  it("propagates TIMEOUT", async () => {
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

    const { ranked } = makeInput(3);
    const result = await compressContext(
      "How does authentication work?",
      ranked,
      mockRepository,
      {
        contentSource: "inline",
        contents: mockFileContents,
        limit: 3,
        timeoutMs: 25,
      },
    );

    expect(result.compressed.ok).toBe(false);
    if (result.compressed.ok) return;
    expect(result.compressed.error.code).toBe("TIMEOUT");
  });

  it("returns the Context Package even when Paritok fails", async () => {
    installFetchMock(async () =>
      makeResponse({ status: 500, body: { message: "boom" } }),
    );

    const { ranked } = makeInput(3);
    const result = await compressContext(
      "How does authentication work?",
      ranked,
      mockRepository,
      { contentSource: "inline", contents: mockFileContents, limit: 3 },
    );

    // The package must still be there so the caller can decide
    // whether to fall back to the raw context.
    expect(result.package.question).toBe("How does authentication work?");
    expect(result.package.files.length).toBeGreaterThan(0);
    expect(result.compressed.ok).toBe(false);
  });
});
