/**
 * Public surface of the OpenAI service (Phase 5A).
 *
 * Consumers (UI in Phase 5B, pipeline in Phase 5C) should import from
 * this barrel only — the internal modules may be reorganised later
 * without breaking callers.
 */

export { generateAnswer } from "./client";
export type {
  GenerateAnswerOptions,
  GenerateAnswerResult,
  GenerateAnswerSuccess,
  GenerateAnswerFailure,
  OpenAIError,
  OpenAIErrorCode,
  OpenAIUsage,
} from "./types";
