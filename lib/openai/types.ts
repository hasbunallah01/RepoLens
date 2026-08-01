/**
 * Types for the OpenAI service (Phase 5A).
 *
 * The service exposes a single public function: {@link generateAnswer}.
 * It returns a *Result* (discriminated union) rather than throwing, so
 * callers cannot accidentally let a missing key or a network blip
 * crash the application.
 *
 * Future phases (5B, 5C) will plug this service into the UI / pipeline.
 * For now, nothing in the app calls it — it is a self-contained module.
 */

/** Stable error codes the UI / pipeline can switch on. */
export type OpenAIErrorCode = "MISSING_API_KEY" | "NETWORK" | "API_ERROR" | "INVALID_RESPONSE";

/** Typed error returned on failure. */
export interface OpenAIError {
  code: OpenAIErrorCode;
  /** Human-readable description. Safe to log. */
  message: string;
  /** HTTP status from OpenAI, when available. */
  status?: number;
}

/** Token usage as reported by the Chat Completions API. */
export interface OpenAIUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

/** Input to {@link generateAnswer}. */
export interface GenerateAnswerOptions {
  /** Compressed context (typically Paritok output). Required. */
  context: string;
  /** User's natural-language question. Required. */
  question: string;
  /**
   * Chat Completions model. Defaults to `gpt-4o-mini` — small, fast and
   * cheap; perfect for a hackathon demo. Override per-call if needed.
   */
  model?: string;
  /** Sampling temperature in [0, 2]. Defaults to 0.2 for grounded answers. */
  temperature?: number;
  /** Cap on completion tokens. Defaults to 800. */
  maxTokens?: number;
}

/** Successful response. */
export interface GenerateAnswerSuccess {
  ok: true;
  /** Plain-text answer from the model. */
  answer: string;
  /** The actual model that produced the answer (echoed from the API). */
  model: string;
  /** Token usage when the API returned it. */
  usage?: OpenAIUsage;
}

/** Failed response. */
export interface GenerateAnswerFailure {
  ok: false;
  error: OpenAIError;
}

/** Discriminated union returned by {@link generateAnswer}. */
export type GenerateAnswerResult = GenerateAnswerSuccess | GenerateAnswerFailure;
