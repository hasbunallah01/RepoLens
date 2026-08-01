/**
 * OpenAI Chat Completions client (Phase 5A).
 *
 * One public function, {@link generateAnswer}, that:
 *   - reads OPENAI_API_KEY from the environment
 *   - builds a grounded-answer prompt from the supplied compressed context
 *   - POSTs to https://api.openai.com/v1/chat/completions
 *   - returns a typed {@link GenerateAnswerResult} (never throws)
 *
 * No streaming, no history, no retries beyond the single request.
 * Phase 5B will wire this into the UI.
 */

import type {
  GenerateAnswerOptions,
  GenerateAnswerResult,
  OpenAIError,
  OpenAIUsage,
} from "./types";

const DEFAULT_MODEL = "gpt-4o-mini";
const DEFAULT_TEMPERATURE = 0.2;
const DEFAULT_MAX_TOKENS = 800;
const API_URL = "https://api.openai.com/v1/chat/completions";
const REQUEST_TIMEOUT_MS = 30_000;

const SYSTEM_PROMPT = [
  "You are RepoLens, a developer assistant that answers questions about a codebase.",
  "You are given a compressed set of code excerpts and a developer's question.",
  "Answer the question using ONLY the information in the provided context.",
  "If the context does not contain the answer, say so explicitly — do not invent code, file paths, or behaviour.",
  "When you reference a file, include its path so the developer can jump straight to it.",
  "Be concise. Prefer short paragraphs and small bullet lists over long prose.",
].join(" ");

/**
 * Generate an answer to a question, grounded in a compressed context.
 *
 * Returns a discriminated union; the application cannot crash on a
 * missing key, network failure, API error, or malformed response.
 *
 * ```ts
 * const result = await generateAnswer({ context, question });
 * if (result.ok) {
 *   console.log(result.answer);
 * } else {
 *   console.error(result.error.code, result.error.message);
 * }
 * ```
 */
export async function generateAnswer(
  options: GenerateAnswerOptions,
): Promise<GenerateAnswerResult> {
  const { context, question } = options;
  const model = options.model ?? DEFAULT_MODEL;
  const temperature = options.temperature ?? DEFAULT_TEMPERATURE;
  const maxTokens = options.maxTokens ?? DEFAULT_MAX_TOKENS;

  // Input validation — never call the API with empty payloads.
  if (!question || !question.trim()) {
    return failure("INVALID_RESPONSE", "Question must be a non-empty string.");
  }
  if (typeof context !== "string") {
    return failure("INVALID_RESPONSE", "Context must be a string.");
  }

  // Resolve the API key up-front so the error is fast and typed.
  const apiKey = readApiKey();
  if (!apiKey) {
    return failure(
      "MISSING_API_KEY",
      "OPENAI_API_KEY is not set. Add it to .env.local before calling generateAnswer().",
    );
  }

  // Build the request body.
  const body = {
    model,
    temperature,
    max_tokens: maxTokens,
    stream: false,
    messages: [
      { role: "system" as const, content: SYSTEM_PROMPT },
      {
        role: "user" as const,
        content: buildUserPrompt(context, question),
      },
    ],
  };

  // Issue the request with a hard timeout.
  let response: Response;
  try {
    response = await fetchWithTimeout(
      API_URL,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(body),
      },
      REQUEST_TIMEOUT_MS,
    );
  } catch (err) {
    return failure("NETWORK", networkErrorMessage(err));
  }

  // Non-2xx: surface the OpenAI error payload.
  if (!response.ok) {
    let detail = "";
    try {
      const payload = (await response.json()) as {
        error?: { message?: string; type?: string };
      };
      detail = payload?.error?.message ?? "";
    } catch {
      // body wasn't JSON; fall back to statusText
    }
    return failure(
      "API_ERROR",
      `OpenAI request failed (${response.status} ${response.statusText || "Error"})${detail ? `: ${detail}` : ""}.`,
      response.status,
    );
  }

  // Parse the response body defensively — OpenAI's response shape is
  // stable but a malformed payload should not crash the app.
  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    return failure("INVALID_RESPONSE", "OpenAI returned a non-JSON response body.");
  }

  const parsed = parseCompletion(payload);
  if (!parsed.ok) return failure("INVALID_RESPONSE", parsed.reason);

  return {
    ok: true,
    answer: parsed.answer,
    model: parsed.model,
    usage: parsed.usage,
  };
}

/* -------------------------------------------------------------------------- */
/*  Internals                                                                 */
/* -------------------------------------------------------------------------- */

function failure(
  code: OpenAIError["code"],
  message: string,
  status?: number,
): GenerateAnswerResult {
  return {
    ok: false,
    error: status === undefined ? { code, message } : { code, message, status },
  };
}

function readApiKey(): string | null {
  // `process.env` is the canonical source for Next.js server-side code.
  // We accept either the bare key or the trimmed form to be forgiving.
  const raw = process.env.OPENAI_API_KEY;
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function buildUserPrompt(context: string, question: string): string {
  // The model is told to answer ONLY from the context; we keep the
  // context and question visually distinct so it doesn't get confused.
  return [
    "### Code context (already compressed, may be truncated):",
    "",
    context.trim() || "(no context provided)",
    "",
    "### Question:",
    question.trim(),
  ].join("\n");
}

async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

function networkErrorMessage(err: unknown): string {
  if (err instanceof Error) {
    if (err.name === "AbortError") {
      return `OpenAI request timed out after ${REQUEST_TIMEOUT_MS / 1000}s.`;
    }
    return err.message;
  }
  return "Unknown network error while contacting OpenAI.";
}

/* -------------------------------------------------------------------------- */
/*  Response parsing                                                          */
/* -------------------------------------------------------------------------- */

type ParseOk = {
  ok: true;
  answer: string;
  model: string;
  usage?: OpenAIUsage;
};
type ParseErr = { ok: false; reason: string };

function parseCompletion(payload: unknown): ParseOk | ParseErr {
  if (!payload || typeof payload !== "object") {
    return { ok: false, reason: "OpenAI response was not a JSON object." };
  }
  const root = payload as Record<string, unknown>;

  // The model field is set on every successful response.
  const model = typeof root.model === "string" ? root.model : null;
  if (!model) return { ok: false, reason: "OpenAI response missing 'model' field." };

  const choices = root.choices;
  if (!Array.isArray(choices) || choices.length === 0) {
    return { ok: false, reason: "OpenAI response had no 'choices'." };
  }

  const first = choices[0] as Record<string, unknown> | undefined;
  if (!first || typeof first !== "object") {
    return { ok: false, reason: "OpenAI response had a malformed 'choices[0]'." };
  }
  const message = first.message as Record<string, unknown> | undefined;
  const content = message?.content;
  if (typeof content !== "string" || content.length === 0) {
    return { ok: false, reason: "OpenAI response had no message content." };
  }

  const usage = parseUsage(root.usage);
  const result: ParseOk = { ok: true, answer: content, model };
  if (usage) result.usage = usage;
  return result;
}

function parseUsage(raw: unknown): OpenAIUsage | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const u = raw as Record<string, unknown>;
  const prompt = numOrZero(u.prompt_tokens);
  const completion = numOrZero(u.completion_tokens);
  const total = numOrZero(u.total_tokens);
  if (prompt === 0 && completion === 0 && total === 0) return undefined;
  return {
    promptTokens: prompt,
    completionTokens: completion,
    totalTokens: total,
  };
}

function numOrZero(v: unknown): number {
  return typeof v === "number" && Number.isFinite(v) ? v : 0;
}
