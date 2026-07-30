/**
 * Domain types for Phase 3D1 — the Context Builder.
 *
 * The Context Builder is the layer between the local ranking engine
 * (Phase 3C) and any future optimization engine (e.g. Paritok, Phase 4).
 *
 * Design goals:
 *   - Zero coupling to the optimization engine. A future caller should
 *     be able to read a {@link ContextPackage} and never need to know
 *     who produced it.
 *   - Zero mutation. File contents are passed through verbatim. The
 *     builder never summarises, compresses, or rewrites them.
 *   - Stable shape. New fields may be added in later phases; existing
 *     ones will not be removed or renamed without a major bump.
 *
 * The package is the single output of `buildContextPackage()` and the
 * only thing downstream consumers should depend on.
 */

import type { IndexedFile } from "@/types/repository";
import type { RankedFile } from "@/types/ranking";

/* -------------------------------------------------------------------------- */
/*  Repository info                                                           */
/* -------------------------------------------------------------------------- */

/**
 * Minimal repository identity attached to every context package so
 * downstream optimizers (and humans reading logs) can tell which repo
 * the context was built for.
 *
 * Sourced from {@link RepoMetadata} but kept as a separate, narrow
 * shape so the Context Builder does not leak the full repository type
 * surface to its consumers.
 */
export interface ContextRepositoryInfo {
  /** "owner/repo". */
  fullName: string;
  /** Default branch at the time the context was built. */
  defaultBranch: string;
  /** Primary language reported by GitHub, or null if unknown. */
  primaryLanguage: string | null;
  /** ISO timestamp at which the package was assembled. */
  builtAt: string;
}

/* -------------------------------------------------------------------------- */
/*  Selected file entry                                                       */
/* -------------------------------------------------------------------------- */

/**
 * A single file slot in the context package.
 *
 * The `content` field is the file's full source text, read as-is.
 * No summarisation, no truncation, no comment-stripping. The optimizer
 * (or human reviewer) gets the exact bytes the indexer indexed.
 *
 * The original {@link RankedFile} is preserved as `source` so callers
 * can see the score and reason the ranking engine produced without
 * having to re-join against the original array.
 */
export interface ContextFileEntry {
  /** Repository-relative path. */
  path: string;
  /** File name only (no folder). */
  name: string;
  /** Lowercase extension without dot, e.g. "ts". */
  extKey: string;
  /** Detected language, e.g. "TypeScript". */
  language: string;
  /** Full file contents, exactly as read from the indexer. */
  content: string;
  /** Ranking engine score for this file (0–100). */
  score: number;
  /** Short human-readable reason from the ranking engine. */
  reason: string;
  /** Original {@link IndexedFile} metadata for full-fidelity access. */
  metadata: IndexedFile;
}

/* -------------------------------------------------------------------------- */
/*  Context package                                                           */
/* -------------------------------------------------------------------------- */

/**
 * The full context package produced by `buildContextPackage()`.
 *
 * This is the single contract between the Context Builder and any
 * downstream optimization engine (Paritok, future LLM re-rankers, etc).
 * Consumers should not need to read any other field from the rest of
 * RepoLens to act on the context.
 */
export interface ContextPackage {
  /** Schema version — bump if the shape changes. */
  version: "3D1";
  /** The user's original question, echoed back. */
  question: string;
  /** Repository the context was built for. */
  repository: ContextRepositoryInfo;
  /** Top-N ranked files in the same order as the input. */
  files: ContextFileEntry[];
  /** How many candidate files were considered before selection. */
  totalCandidates: number;
  /** How many files made it into the package (i.e. `files.length`). */
  selectedCount: number;
  /** Maximum number of files the builder was asked to include. */
  limit: number;
}

/* -------------------------------------------------------------------------- */
/*  Options                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * Options accepted by `buildContextPackage()`.
 */
export interface BuildContextOptions {
  /**
   * Maximum number of files to include in the package. Defaults to 5.
   * Set to 0 to include all ranked files.
   */
  limit?: number;
  /**
   * Strategy used to look up file contents. Defaults to
   * `"indexer"` which uses the in-memory indexer cache.
   *
   * Tests and the mock entry point can pass `"inline"` to inject
   * pre-built file contents via {@link BuildContextOptions.contents}.
   */
  contentSource?: ContextContentSource;
  /**
   * Inline file contents, keyed by repository-relative path.
   * Required when `contentSource` is `"inline"`. The builder never
   * falls back to the indexer if a path is missing here.
   */
  contents?: ReadonlyMap<string, string>;
}

/**
 * Where the Context Builder should look up file contents from.
 *
 * - `"indexer"`: the real, in-memory indexed repo. Used in production.
 * - `"inline"`:  the caller supplies the contents directly. Used by tests
 *   and by the mock entry point so we never touch `fs` or the network.
 */
export type ContextContentSource = "indexer" | "inline";

/* -------------------------------------------------------------------------- */
/*  Errors                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Codes returned by the Context Builder when a file cannot be resolved.
 * Kept narrow on purpose — the builder is supposed to be simple.
 */
export type ContextErrorCode =
  /** The package asked to use `"inline"` contents but didn't supply them. */
  | "MISSING_INLINE_CONTENTS"
  /** The selected file's path has no content registered anywhere. */
  | "CONTENT_NOT_FOUND"
  /** A content lookup threw an unexpected error. */
  | "READ_FAILED";

/**
 * Error shape returned by the builder when a file cannot be resolved.
 * Throwing would be heavy for what is expected to be a non-fatal
 * situation (one missing file should not nuke the whole package), so
 * the builder skips the missing file and reports it in `errors`.
 */
export interface ContextError {
  code: ContextErrorCode;
  message: string;
  /** Path of the file that triggered the error, if applicable. */
  path?: string;
}

/**
 * Result of building a context package. The package itself is always
 * returned, even if some files had to be skipped — see `errors`.
 */
export interface BuildContextResult {
  package: ContextPackage;
  errors: ContextError[];
}

/* -------------------------------------------------------------------------- */
/*  Re-exports                                                                */
/* -------------------------------------------------------------------------- */

export type { IndexedFile, RankedFile };
