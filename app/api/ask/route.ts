/**
 * POST /api/ask
 * Body: { "repository": "<owner/repo or GitHub URL>", "question": "<text>" }
 *
 * Dedicated question-answering route for the Ask page. This is the
 * permanent home for the chat pipeline — `/api/analyze` is
 * analysis-only and does not accept a question.
 *
 * Reuses existing, already-tested modules end to end; nothing here
 * re-implements ranking, context building, compression, or answer
 * generation:
 *
 *   Repository (owner/repo)
 *     ↓ `loadRepository()`            (@/lib/repo/load-repository — shared with /api/analyze)
 *     ↓ `rankRelevantFiles()`         (@/lib/ranking)
 *     ↓ `fetchRankedFileContents()`   (@/lib/ranking)
 *     ↓ `buildProductionContextFromMetadata()` (@/lib/context)
 *     ↓ `compressContextPackage()`    (@/lib/paritok)
 *     ↓ `generateAnswer()`            (@/lib/openai)
 *
 * Response envelope (see `lib/api` for the full contract):
 *   { ok: true,  data: AskResult }
 *   { ok: false, error: { code, message, status? } }
 *
 * Debug-only fields (`contextPackage`, `paritok`, and a bounded
 * `compressedPreview`) are attached to `data` only outside
 * production, mirroring the existing `/api/analyze` convention.
 *
 * Status codes:
 *   200 — success
 *   400 — invalid request body (missing/invalid `repository` or `question`)
 *   500 — unexpected internal error (sanitised, no stack trace)
 *   502 — upstream GitHub, Paritok, or OpenAI error (status echoed)
 *   503 — missing required environment variable
 */

import { NextResponse } from "next/server";
import { ConfigError, validateConfig } from "@/lib/config";
import { errorResponse, okResponse, withApiHandler } from "@/lib/api";
import { parseGitHubUrl } from "@/lib/github/parse-url";
import { GitHubApiError } from "@/lib/github/client";
import { loadRepository } from "@/lib/repo/load-repository";
import { fetchRankedFileContents, rankRelevantFiles } from "@/lib/ranking";
import { buildProductionContextFromMetadata } from "@/lib/context";
import { compressContextPackage } from "@/lib/paritok";
import { generateAnswer } from "@/lib/openai";
import { createRequestLogger } from "@/lib/log";
import type { OpenAIUsage } from "@/lib/openai";

// Fresh answer every call — never cache a chat response.
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const isProduction = process.env.NODE_ENV === "production";

/** Production-safe response payload for a successful `/api/ask` call. */
interface AskResult {
  question: string;
  repository: string;
  answer: {
    text: string;
    model: string;
    usage?: OpenAIUsage;
  };
  /** File paths sent to the model as context for this answer. */
  referencedFiles: string[];
  compression: {
    gpuAvailable: boolean;
    clientId?: string;
    schemaVersion?: string;
    compressedLength: number;
  };
  /**
   * Optional server-side diagnostics. Only attached to the response
   * outside production so the wire format stays clean for end users.
   * Intended for local development and future instrumentation work.
   */
  diagnostics?: AskDiagnostics;
}

/**
 * Server-side pipeline diagnostics, surfaced only when not in
 * production. Mirrors the structured log lines emitted by the route
   * (see `lib/log` + the `[diagnostics]` console output below) so a
   * developer can read them either from server logs or directly from
   * the API response when running `next dev`.
   */
interface AskDiagnostics {
  repository: string;
  filesRanked: number;
  filesSent: number;
  payloadBytes: number;
  payloadCharacters: number;
  paritok: {
    elapsedMs: number;
    compressedBytes: number;
    originalBytes: number;
    compressionRatio: number;
    gpuAvailable: boolean;
    timedOut: boolean;
  };
  openai: {
    elapsedMs: number;
    model: string;
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
  };
  totalRequestTimeMs: number;
}

interface AskRequestBody {
  repository?: unknown;
  question?: unknown;
}

export const POST = withApiHandler(async (request: Request) => {
  // Single timestamp used for the final "total request time" diagnostic.
  const routeStart = Date.now();

  // Fail fast on missing required environment variables, same as
  // `/api/analyze` — this route needs both PARITOK_API_KEY and
  // OPENAI_API_KEY to do anything useful.
  try {
    validateConfig();
  } catch (err) {
    if (err instanceof ConfigError) {
      return errorResponse("MISSING_CONFIG", err.message, 503);
    }
    throw err;
  }

  const log = createRequestLogger();
  log.logStage("request_received");

  // ------------------------------------------------------------------
  //  Diagnostics: server-side only, intended for performance evidence
  //  collection. These values are populated as the pipeline progresses
  //  and summarised in a single `[diagnostics] summary` line at the
  //  end of a successful request. Nothing in this block is ever sent
  //  to the client in production.
  // ------------------------------------------------------------------
  const diagnostics: {
    repository: string;
    filesRanked: number;
    filesSent: number;
    payloadBytes: number;
    payloadCharacters: number;
    paritok: {
      elapsedMs: number;
      compressedBytes: number;
      originalBytes: number;
      compressionRatio: number;
      gpuAvailable: boolean;
      timedOut: boolean;
    };
    openai: {
      elapsedMs: number;
      model: string;
      promptTokens?: number;
      completionTokens?: number;
      totalTokens?: number;
    };
    totalRequestTimeMs: number;
  } = {
    repository: "",
    filesRanked: 0,
    filesSent: 0,
    payloadBytes: 0,
    payloadCharacters: 0,
    paritok: {
      elapsedMs: 0,
      compressedBytes: 0,
      originalBytes: 0,
      compressionRatio: 0,
      gpuAvailable: false,
      timedOut: false,
    },
    openai: {
      elapsedMs: 0,
      model: "",
    },
    totalRequestTimeMs: 0,
  };

  /**
   * Emit a `[diagnostics]` line. We use `console.log` so the line
   * goes to stdout under the Next.js runtime (same channel as the
   * stage logger) and is never sent to the client. Sensitive fields
   * (questions, answers, file contents) are never passed in here —
   * only counts, sizes, durations, and the public repository name.
   */
  const logDiagnostics = (stage: string, data: Record<string, unknown>): void => {
    // eslint-disable-next-line no-console
    console.log(
      JSON.stringify({
        source: "diagnostics",
        timestamp: new Date().toISOString(),
        requestId: log.requestId,
        stage,
        data,
      }),
    );
  };

  let body: AskRequestBody;
  try {
    body = (await request.json()) as AskRequestBody;
  } catch {
    log.logStage("response_returned", { status: 400, code: "INVALID_BODY" });
    return errorResponse("INVALID_BODY", "Request body must be valid JSON.", 400);
  }

  const repository = typeof body.repository === "string" ? body.repository.trim() : "";
  const question = typeof body.question === "string" ? body.question.trim() : "";

  if (!question) {
    log.logStage("response_returned", { status: 400, code: "MISSING_QUESTION" });
    return errorResponse("MISSING_QUESTION", "A non-empty `question` is required.", 400);
  }

  const parsed = parseGitHubUrl(repository);
  if (!parsed.ok) {
    log.logStage("response_returned", { status: 400, code: "INVALID_URL" });
    return errorResponse("INVALID_URL", parsed.reason, 400);
  }

  const { owner, repo } = parsed.value;
  log.logStage("repo_url_received", { owner, repo });

  try {
    log.logStage("github_fetch_started");
    const fetchStart = Date.now();
    const { metadata, index } = await loadRepository(owner, repo);
    log.logStageWithDuration("github_fetch_completed", Date.now() - fetchStart, {
      owner,
      repo,
      defaultBranch: metadata.defaultBranch,
      indexedFiles: index.totalFiles,
    });

    // ------------------------------------------------------------
    //  Existing Ranking Engine
    // ------------------------------------------------------------
    log.logStage("ranking_started");
    const rankingStart = Date.now();
    const ranked = rankRelevantFiles(question, index.files);
    log.logStageWithDuration("ranking_completed", Date.now() - rankingStart, {
      rankedCount: ranked.ranked.length,
      totalCandidates: ranked.totalCandidates,
    });

    const fileContents = await fetchRankedFileContents(owner, repo, ranked, {
      ref: metadata.defaultBranch,
    });

    // ----------------------------------------------------------------
    //  1. Repository diagnostics — counts after ranking + fetching.
    // ----------------------------------------------------------------
    diagnostics.repository = metadata.fullName;
    diagnostics.filesRanked = ranked.ranked.length;
    diagnostics.filesSent = fileContents.size;
    logDiagnostics("repository", {
      repository: diagnostics.repository,
      filesRanked: diagnostics.filesRanked,
      filesSent: diagnostics.filesSent,
    });

    // ------------------------------------------------------------
    //  Existing Context Builder
    // ------------------------------------------------------------
    log.logStage("context_builder_started");
    const contextStart = Date.now();
    const contextResult = buildProductionContextFromMetadata(metadata, question, ranked, fileContents);
    log.logStageWithDuration("context_builder_completed", Date.now() - contextStart, {
      fileCount: contextResult.package?.files.length ?? 0,
      errorCount: contextResult.errors.length,
    });

    const pkg = contextResult.package;
    if (!pkg) {
      log.logStage("response_returned", { status: 500, code: "MISSING_FIELDS" });
      return errorResponse("MISSING_FIELDS", "Context builder returned no package.", 500);
    }

    // ----------------------------------------------------------------
    //  2. Context diagnostics — measured on the exact payload that
    //     will be shipped to Paritok. The Paritok client concatenates
    //     every file body with attribution headers into a single
    //     string; we measure that string (character count, UTF-8 byte
    //     count, average bytes per file) so the numbers reflect what
    //     actually travels over the wire.
    // ----------------------------------------------------------------
    const paritokSections = pkg.files.map((file) => `==== file: ${file.path} ====\n${file.content}`);
    const paritokPayload = paritokSections.join("\n\n");
    const paritokPayloadBytes = Buffer.byteLength(paritokPayload, "utf8");
    const paritokPayloadChars = paritokPayload.length;
    const paritokFileCount = pkg.files.length;
    const paritokAvgBytesPerFile =
      paritokFileCount > 0 ? Math.round(paritokPayloadBytes / paritokFileCount) : 0;

    diagnostics.payloadBytes = paritokPayloadBytes;
    diagnostics.payloadCharacters = paritokPayloadChars;
    logDiagnostics("context", {
      totalFiles: paritokFileCount,
      totalCharacters: paritokPayloadChars,
      utf8Bytes: paritokPayloadBytes,
      averageBytesPerFile: paritokAvgBytesPerFile,
    });

    // ------------------------------------------------------------
    //  Existing Paritok compression client
    // ------------------------------------------------------------
    log.logStage("paritok_request_started", { fileCount: pkg.files.length });
    const paritokStart = Date.now();
    const compressed = await compressContextPackage(pkg);
    const paritokElapsedMs = Date.now() - paritokStart;
    log.logStageWithDuration("paritok_response_received", paritokElapsedMs, {
      ok: compressed.ok,
      fileCount: pkg.files.length,
    });

    if (!compressed.ok) {
      // ----------------------------------------------------------------
      //  3. Paritok diagnostics (failure path) — record the elapsed time
      //     and the request size regardless of outcome, and flag
      //     timeouts so the log line carries the payload size + file
      //     count for follow-up analysis.
      // ----------------------------------------------------------------
      const timedOut = compressed.error.code === "TIMEOUT";
      diagnostics.paritok.elapsedMs = paritokElapsedMs;
      diagnostics.paritok.originalBytes = paritokPayloadBytes;
      diagnostics.paritok.timedOut = timedOut;
      if (timedOut) {
        logDiagnostics("paritok", {
          ok: false,
          elapsedMs: paritokElapsedMs,
          code: compressed.error.code,
          timeoutOccurred: true,
          payloadBytes: paritokPayloadBytes,
          payloadCharacters: paritokPayloadChars,
          fileCount: paritokFileCount,
        });
      } else {
        logDiagnostics("paritok", {
          ok: false,
          elapsedMs: paritokElapsedMs,
          code: compressed.error.code,
          timeoutOccurred: false,
        });
      }

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

    const compressedText = compressed.data.compressed;

    // ----------------------------------------------------------------
    //  3. Paritok diagnostics (success path) — compression ratio is
    //     defined as compressedBytes / originalBytes, matching the
    //     convention used elsewhere in the project.
    // ----------------------------------------------------------------
    const compressedBytes = Buffer.byteLength(compressedText, "utf8");
    const originalBytes = paritokPayloadBytes;
    const compressionRatio =
      originalBytes > 0 ? Number((compressedBytes / originalBytes).toFixed(4)) : 0;
    diagnostics.paritok.elapsedMs = paritokElapsedMs;
    diagnostics.paritok.compressedBytes = compressedBytes;
    diagnostics.paritok.originalBytes = originalBytes;
    diagnostics.paritok.compressionRatio = compressionRatio;
    diagnostics.paritok.gpuAvailable = compressed.data.gpu_available;
    diagnostics.paritok.timedOut = false;
    logDiagnostics("paritok", {
      ok: true,
      elapsedMs: paritokElapsedMs,
      compressedBytes,
      originalBytes,
      compressionRatio,
      gpuAvailable: compressed.data.gpu_available,
      timeoutOccurred: false,
    });

    // ------------------------------------------------------------
    //  Existing OpenAI answer generation
    // ------------------------------------------------------------
    log.logStage("openai_request_started", { compressedLength: compressedText.length });
    const openaiStart = Date.now();
    const ai = await generateAnswer({ context: compressedText, question });
    const openaiElapsedMs = Date.now() - openaiStart;
    log.logStageWithDuration("openai_response_received", openaiElapsedMs, {
      ok: ai.ok,
      model: ai.ok ? ai.model : undefined,
    });

    if (!ai.ok) {
      // ----------------------------------------------------------------
      //  4. OpenAI diagnostics (failure path) — log the elapsed time
      //     so we can still see how long the call took before the
      //     upstream rejected it.
      // ----------------------------------------------------------------
      diagnostics.openai.elapsedMs = openaiElapsedMs;
      logDiagnostics("openai", {
        ok: false,
        elapsedMs: openaiElapsedMs,
        code: ai.error.code,
      });
      log.logStage("response_returned", { status: ai.error.status ?? 502, code: ai.error.code });
      return errorResponse(ai.error.code, ai.error.message, ai.error.status ?? 502, {
        status: ai.error.status,
      });
    }

    // ----------------------------------------------------------------
    //  4. OpenAI diagnostics (success path) — duration, model, and
    //     token usage when OpenAI returns it.
    // ----------------------------------------------------------------
    diagnostics.openai.elapsedMs = openaiElapsedMs;
    diagnostics.openai.model = ai.model;
    if (ai.usage) {
      diagnostics.openai.promptTokens = ai.usage.promptTokens;
      diagnostics.openai.completionTokens = ai.usage.completionTokens;
      diagnostics.openai.totalTokens = ai.usage.totalTokens;
    }
    logDiagnostics("openai", {
      ok: true,
      elapsedMs: openaiElapsedMs,
      model: ai.model,
      promptTokens: ai.usage?.promptTokens,
      completionTokens: ai.usage?.completionTokens,
      totalTokens: ai.usage?.totalTokens,
    });

    log.logStage("response_returned", { status: 200 });

    // ----------------------------------------------------------------
    //  5. Final diagnostics — one structured summary line per
    //     successful request. Mirrors the order requested in the
    //     spec: repository, paritok, openai, total request time.
    // ----------------------------------------------------------------
    diagnostics.totalRequestTimeMs = Date.now() - routeStart;
    logDiagnostics("summary", {
      repository: diagnostics.repository,
      filesRanked: diagnostics.filesRanked,
      filesSent: diagnostics.filesSent,
      payloadBytes: diagnostics.payloadBytes,
      payloadCharacters: diagnostics.payloadCharacters,
      paritok: {
        elapsedMs: diagnostics.paritok.elapsedMs,
        compressedBytes: diagnostics.paritok.compressedBytes,
        compressionRatio: diagnostics.paritok.compressionRatio,
        gpuAvailable: diagnostics.paritok.gpuAvailable,
        timedOut: diagnostics.paritok.timedOut,
      },
      openai: {
        elapsedMs: diagnostics.openai.elapsedMs,
        model: diagnostics.openai.model,
        totalTokens: diagnostics.openai.totalTokens,
      },
      totalRequestTimeMs: diagnostics.totalRequestTimeMs,
    });

    const result: AskResult = {
      question,
      repository: metadata.fullName,
      answer: { text: ai.answer, model: ai.model, usage: ai.usage },
      referencedFiles: pkg.files.map((f) => f.path),
      compression: {
        gpuAvailable: compressed.data.gpu_available,
        clientId: compressed.data.clientId,
        schemaVersion: compressed.data.schemaVersion,
        compressedLength: compressedText.length,
      },
    };

    // Diagnostics object is only attached outside production so the
    // production response shape stays unchanged.
    if (!isProduction) {
      const debugDiagnostics: AskDiagnostics = {
        repository: diagnostics.repository,
        filesRanked: diagnostics.filesRanked,
        filesSent: diagnostics.filesSent,
        payloadBytes: diagnostics.payloadBytes,
        payloadCharacters: diagnostics.payloadCharacters,
        paritok: { ...diagnostics.paritok },
        openai: { ...diagnostics.openai },
        totalRequestTimeMs: diagnostics.totalRequestTimeMs,
      };
      result.diagnostics = debugDiagnostics;
    }

    if (isProduction) {
      return okResponse(result);
    }

    // Debug-only fields, same gating convention as `/api/analyze`.
    const COMPRESSION_PREVIEW_LIMIT = 2000;
    const debugBody: Record<string, unknown> = {
      ok: true,
      data: result,
      contextPackage: pkg,
      paritok: compressed.data,
      compressedPreview:
        compressedText.length <= COMPRESSION_PREVIEW_LIMIT
          ? compressedText
          : `${compressedText.slice(0, COMPRESSION_PREVIEW_LIMIT)}…`,
    };
    return NextResponse.json(debugBody, { status: 200 });
  } catch (err) {
    if (err instanceof GitHubApiError) {
      const upstream = err.toAnalysisError();
      log.logStage("response_returned", { status: upstream.status ?? 502, code: upstream.code });
      return errorResponse(upstream.code, upstream.message, upstream.status ?? 502, {
        status: upstream.status,
      });
    }
    log.logStage("response_returned", { status: 500, code: "INTERNAL" });
    throw err;
  }
});
