/**
 * Shared application types.
 *
 * Phase 1 only defines the surface area that the UI scaffold needs.
 * Backend / domain types (Repository, FileTree, ChatMessage, ParitokUsage, etc.)
 * will be added in later phases.
 */

/** A single feature highlighted on the home page. */
export interface Feature {
  title: string;
  description: string;
  icon: "search" | "message" | "sparkles" | "chart";
}

/** Navigation link used by the Navbar and Footer. */
export interface NavLink {
  label: string;
  href: string;
}

// Re-export retrieval types so consumers can `import type { RetrievalMatch } from "@/types"`.
export type {
  RetrievalMatch,
  RetrievalResult,
  RetrievalOptions,
  RetrievalSignalWeights,
} from "./retrieval";
export { DEFAULT_RETRIEVAL_WEIGHTS } from "./retrieval";
