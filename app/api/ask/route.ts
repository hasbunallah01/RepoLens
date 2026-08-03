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
}

interface AskRequestBody {
  repository?: unknown;
  question?: unknown;
}

export const POST = withApiHandler(async (request: Request) => {
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

    // ------------------------------------------------------------
    //  Existing Paritok compression client
    // ------------------------------------------------------------
    log.logStage("paritok_request_started", { fileCount: pkg.files.length });
    const paritokStart = Date.now();
    const compressed = await compressContextPackage(pkg);
    log.logStageWithDuration("paritok_response_received", Date.now() - paritokStart, {
      ok: compressed.ok,
      fileCount: pkg.files.length,
    });

    if (!compressed.ok) {
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

    // ------------------------------------------------------------
    //  Existing OpenAI answer generation
    // ------------------------------------------------------------
    log.logStage("openai_request_started", { compressedLength: compressedText.length });
    const openaiStart = Date.now();
    const ai = await generateAnswer({ context: compressedText, question });
    log.logStageWithDuration("openai_response_received", Date.now() - openaiStart, {
      ok: ai.ok,
      model: ai.ok ? ai.model : undefined,
    });

    if (!ai.ok) {
      log.logStage("response_returned", { status: ai.error.status ?? 502, code: ai.error.code });
      return errorResponse(ai.error.code, ai.error.message, ai.error.status ?? 502, {
        status: ai.error.status,
      });
    }

    log.logStage("response_returned", { status: 200 });

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
