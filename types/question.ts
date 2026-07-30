/**
 * Domain types for Phase 3A — the developer-facing question interface.
 *
 * These types describe the data shown in the UI (recent questions, suggested
 * prompts, etc.) for the ask panel. AI submission, retrieval, and Paritok are
 * intentionally NOT modeled here — they arrive in later sub-phases.
 */

/** A single example prompt that users can click to populate the textarea. */
export interface QuestionExample {
  id: string;
  /** The full prompt text copied into the textarea on click. */
  prompt: string;
  /** Optional short category label (e.g. "Auth", "Architecture"). */
  category?: string;
}

/** A mock recent question shown in the sidebar. */
export interface RecentQuestion {
  id: string;
  prompt: string;
  /** Short repo label the question was asked about, e.g. "vercel/next.js". */
  repo: string;
  /** Optional short preview of the answer (mock only in Phase 3A). */
  preview?: string;
  /** ISO timestamp. */
  askedAt: string;
  /** Approximate token count saved (mock). */
  tokensSaved?: number;
}
