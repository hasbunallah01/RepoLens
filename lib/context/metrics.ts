/**
 * Domain types for Phase 3D2 — the Context Metrics Engine.
 *
 * The metrics engine is a *read-only* observer over a
 * {@link ContextPackage} (Phase 3D1). It produces a small bag of
 * numbers that:
 *
 *   - let the UI show "how much context did we just build?"
 *   - act as the **baseline** that future optimization engines
 *     (e.g. Paritok, Phase 4) will compare against.
 *
 * Design goals:
 *
 *   - **Independent.** This module imports nothing from the
 *     optimization side. A future Paritok module consumes
 *     {@link ContextMetrics} without ever touching this file.
 *   - **Pure / deterministic.** Same package in → same metrics out.
 *     No clock, no randomness, no I/O.
 *   - **Replaceable token heuristic.** The token estimate is an
 *     approximation, deliberately isolated behind a single constant
 *     (see {@link CHARS_PER_TOKEN}). When real Paritok numbers land,
 *     callers can either swap the constant or compare their numbers
 *     against this baseline.
 */

/* -------------------------------------------------------------------------- */
/*  Public types                                                              */
/* -------------------------------------------------------------------------- */

/**
 * The metrics computed from a single {@link ContextPackage}.
 *
 * All numbers are non-negative integers (or zero). `estimatedTokens`
 * is an integer floor of the heuristic so the value is stable and
 * diff-friendly in logs.
 */
export interface ContextMetrics {
  /** Number of files included in the package. */
  filesCount: number;
  /** Sum of the line counts across every included file. */
  lineCount: number;
  /** Sum of the character counts across every included file. */
  characterCount: number;
  /**
   * Approximate token count for the package.
   *
   * Currently computed as `ceil(characterCount / CHARS_PER_TOKEN)`.
   * The exact value is not guaranteed to match any specific tokenizer;
   * it is a stable approximation suitable for "before vs. after"
   * comparisons.
   */
  estimatedTokens: number;
  /**
   * Mean file size in characters, rounded to the nearest integer.
   * Zero when the package is empty.
   */
  averageFileSize: number;
}

/* -------------------------------------------------------------------------- */
/*  Constants                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * Approximate characters-per-token used by the heuristic.
 *
 * Background:
 *   - OpenAI's published rule of thumb is ~4 characters per token for
 *     English/code mixes.
 *   - tiktoken's cl100k_base averages ~3.5–4 chars/token for code.
 *   - Anthropic reports ~3.5 chars/token for Claude.
 *
 * We use 4 as a deliberately round, conservative number. It is
 * intentionally a single named constant so a future phase can swap
 * it (or pass in a custom value) without touching the rest of the
 * code.
 */
export const CHARS_PER_TOKEN = 4;

/* -------------------------------------------------------------------------- */
/*  Public API                                                                */
/* -------------------------------------------------------------------------- */

/**
 * Compute {@link ContextMetrics} for a {@link ContextPackage}.
 *
 * The function is pure: it reads the package, does not mutate it,
 * and produces the same output every time for the same input.
 *
 * @param contextPackage The package to measure.
 * @param options        Optional overrides for the token heuristic.
 */
export function calculateContextMetrics(
  contextPackage: import("./types").ContextPackage,
  options: CalculateContextMetricsOptions = {},
): ContextMetrics {
  const charsPerToken = normaliseCharsPerToken(options.charsPerToken);
  const files = contextPackage.files;

  let characterCount = 0;
  let lineCount = 0;
  for (const file of files) {
    characterCount += file.content.length;
    lineCount += countLines(file.content);
  }

  const filesCount = files.length;
  // Use Math.round so an empty package yields 0 (rather than NaN).
  const averageFileSize =
    filesCount === 0 ? 0 : Math.round(characterCount / filesCount);

  // Integer ceiling so a single file always has a token estimate
  // proportional to its size, and an empty package is exactly 0.
  const estimatedTokens =
    characterCount === 0 ? 0 : Math.ceil(characterCount / charsPerToken);

  return {
    filesCount,
    lineCount,
    characterCount,
    estimatedTokens,
    averageFileSize,
  };
}

/**
 * Options accepted by {@link calculateContextMetrics}.
 */
export interface CalculateContextMetricsOptions {
  /**
   * Override the {@link CHARS_PER_TOKEN} heuristic for this call.
   * Must be a positive finite number; otherwise the default is used.
   */
  charsPerToken?: number;
}

/* -------------------------------------------------------------------------- */
/*  Helpers                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * Count the number of lines in a single file's content.
 *
 * Semantics:
 *   - The empty string is 0 lines.
 *   - A trailing newline does NOT add an extra empty line.
 *   - CRLF and bare CR are treated like LF for counting purposes
 *     (one line break, regardless of which one).
 *   - A line of "a\nb" is 2 lines, "a\n" is 1 line, "a" is 1 line.
 */
export function countLines(content: string): number {
  if (content.length === 0) return 0;
  // Normalise CRLF / bare CR to LF, then count.
  const normalised = content.replace(/\r\n?/g, "\n");
  // Number of line breaks + 1, but drop the trailing break if the
  // string ended with one (so "a\n" counts as 1 line, not 2).
  let count = 0;
  for (let i = 0; i < normalised.length; i++) {
    if (normalised.charCodeAt(i) === 10) count++;
  }
  if (normalised.endsWith("\n")) count--;
  return count + 1;
}

/** Coerce the chars-per-token override to a safe positive number. */
function normaliseCharsPerToken(value: number | undefined): number {
  if (value === undefined) return CHARS_PER_TOKEN;
  if (!Number.isFinite(value) || value <= 0) return CHARS_PER_TOKEN;
  return value;
}
