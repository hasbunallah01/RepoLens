/**
 * Content-based scoring for the hybrid (metadata + content) ranking
 * engine.
 *
 * The hybrid engine's Stage 2 (content fallback) needs a small, pure
 * scoring function that measures how well a file's *contents* match
 * the question — without reading every byte and without any
 * embeddings, vector DB, or external service. This module reuses
 * exactly the same tokeniser and stemmer as the rest of the ranking
 * engine, so the per-signal semantics are consistent: a token
 * recognised as a question keyword here is the same token that fired
 * any metadata signal upstream.
 *
 * Constraints (per project brief):
 *   - Inspect at most {@link MAX_CONTENT_CHARS} characters per file.
 *   - No embeddings, no vector DB, no LLM call.
 *   - No new dependencies. No I/O. Pure functions only.
 *
 * The function returns a 0..100 score plus a short reason suitable
 * for human-readable explanations. The reason is the same shape used
 * by the metadata engine so the downstream pipeline can keep treating
 * `reason` as an opaque string.
 */

import type { IndexedFile } from "@/types/repository";
import { tokenizeQuery } from "./tokens";

/** Default cap on characters read per file. */
export const MAX_CONTENT_CHARS = 2000;

/** Clamp a number to the inclusive range [lo, hi]. */
function clamp(n: number, lo: number, hi: number): number {
  if (n < lo) return lo;
  if (n > hi) return hi;
  return n;
}

/**
 * Tokenise raw file content using the same `tokenize` rules as the
 * rest of the ranking engine (lowercase, split on common code
 * separators, strip punctuation). Stopwords are kept here — code
 * files legitimately contain words like "the" / "is" inside
 * identifiers and prose comments, but they're noise for the question
 * ↔ body match, so we drop them the same way `tokenizeQuery` does.
 *
 * Exported so tests can verify the tokeniser behaves as expected on
 * real code bodies.
 */
export function tokenizeContent(content: string): string[] {
  return tokenizeQuery(content);
}

/**
 * Score a file's content against the question tokens, on a 0..100
 * scale. Returns 0 when there is no signal (no overlap, no content).
 *
 * Strategy: identical to the keyword-frequency metadata signal, but
 * applied to the file *body* instead of the file *path*. Coverage is
 * the fraction of question tokens found in the body; we shape it
 * with a square-root so a 1-of-3 hit doesn't drop to a tiny score
 * and a 3-of-3 hit doesn't immediately max out. The shape keeps
 * single-keyword matches meaningful while still rewarding files that
 * mention multiple question concepts.
 *
 * The "scaled-up" coefficient (`* 100` * 1.4) is intentional: a body
 * that contains every question keyword is a strong match, and we
 * want the content signal to be able to comfortably exceed the
 * metadata signal in the hybrid merge step. Capped at 100.
 */
export interface ContentScore {
  /** 0..100, contribution of this signal alone. */
  score: number;
  /** Short human-readable reason. */
  reason: string;
  /** First few matching tokens (for diagnostics + explainability). */
  hits: string[];
}

export function scoreContent(
  file: IndexedFile,
  queryTokens: ReadonlyArray<string>,
  content: string,
  options: { maxChars?: number } = {},
): ContentScore {
  if (queryTokens.length === 0) return { score: 0, reason: "", hits: [] };
  if (!content || content.length === 0) {
    return { score: 0, reason: "", hits: [] };
  }

  const cap = options.maxChars ?? MAX_CONTENT_CHARS;
  const sample = content.length > cap ? content.slice(0, cap) : content;
  const bodyTokens = new Set(tokenizeContent(sample));
  if (bodyTokens.size === 0) {
    return { score: 0, reason: "", hits: [] };
  }

  const hits: string[] = [];
  const seen = new Set<string>();
  for (const q of queryTokens) {
    if (bodyTokens.has(q) && !seen.has(q)) {
      seen.add(q);
      hits.push(q);
    }
  }

  if (hits.length === 0) {
    return { score: 0, reason: "", hits: [] };
  }

  const coverage = hits.length / queryTokens.length;
  // Square-root the coverage so a single-keyword hit still scores
  // meaningfully (e.g. 1/1 -> 100, 1/3 -> 58, 2/3 -> 82, 3/3 -> 100).
  // Then a small multiplier gives the content signal headroom to
  // beat a metadata-only match that has 0 content overlap, but we
  // cap at 100 so a metadata match with 3/3 path keywords still
  // beats a body with 1/3 keyword coverage after the cap.
  const shaped = Math.sqrt(coverage) * 100;
  const score = clamp(Math.round(shaped * 1.0), 0, 100);

  const reason =
    hits.length === 1
      ? `Body contains keyword "${hits[0]}"`
      : `Body contains ${hits.length} question keywords (${hits.slice(0, 3).join(", ")})`;

  return { score, reason, hits };
}
