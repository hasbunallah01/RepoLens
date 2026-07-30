/**
 * File-content resolution for the Context Builder (Phase 3D1).
 *
 * The Context Builder never summarises, compresses, or rewrites file
 * contents — it just needs the original bytes for the files the
 * ranking engine selected. This module is the only place that knows
 * how to get those bytes.
 *
 * Two sources are supported:
 *   - `"indexer"`: an in-memory {@link FileContentRegistry} populated
 *     by the indexing pipeline. Production code uses this.
 *   - `"inline"`:  a caller-supplied {@link BuildContextOptions.contents}
 *     map. Tests and the mock entry point use this.
 *
 * The registry is intentionally tiny. It is a thin layer on top of a
 * `Map<string, string>` so it is trivial to plug in a real reader
 * (filesystem, GitHub raw API, in-memory cache) later without
 * changing the Context Builder's public API.
 */

import type { ContextError, ContextErrorCode } from "./types";

/* -------------------------------------------------------------------------- */
/*  Registry                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * In-memory registry of file contents keyed by repository-relative path.
 *
 * The Context Builder treats this as the canonical "where do I read
 * file contents from" handle. The indexing pipeline owns the lifecycle
 * of the registry; the Context Builder only consumes it.
 */
export class FileContentRegistry {
  private readonly store = new Map<string, string>();

  /** Register (or replace) the contents for a path. */
  set(path: string, content: string): void {
    this.store.set(path, content);
  }

  /**
   * Read the contents for a path, or `undefined` if no entry exists.
   * Throws never — a missing entry is just `undefined`, the caller
   * decides how to handle that.
   */
  get(path: string): string | undefined {
    return this.store.get(path);
  }

  /** Whether a path is currently registered. */
  has(path: string): boolean {
    return this.store.has(path);
  }

  /** How many paths are currently registered. */
  get size(): number {
    return this.store.size;
  }

  /** Remove every entry. Useful for tests. */
  clear(): void {
    this.store.clear();
  }
}

/* -------------------------------------------------------------------------- */
/*  Process-wide singleton                                                    */
/* -------------------------------------------------------------------------- */

/**
 * A process-wide content registry. Production code path reads from
 * `getDefaultContentRegistry()`. The registry is created lazily so
 * importing this module from a test never allocates state.
 *
 * This is intentionally NOT a global mutable cache with TTL or any
 * other cleverness. The indexing pipeline owns writing; the Context
 * Builder owns reading. Both happen in-process; restart clears the
 * store, which is exactly what we want.
 */
let defaultRegistry: FileContentRegistry | null = null;

export function getDefaultContentRegistry(): FileContentRegistry {
  if (!defaultRegistry) {
    defaultRegistry = new FileContentRegistry();
  }
  return defaultRegistry;
}

/** Reset the process-wide registry. Tests only. */
export function resetDefaultContentRegistry(): void {
  if (defaultRegistry) defaultRegistry.clear();
  defaultRegistry = null;
}

/* -------------------------------------------------------------------------- */
/*  Read helper                                                               */
/* -------------------------------------------------------------------------- */

/**
 * Read the contents for a single path, returning the bytes or a
 * {@link ContextError} describing why the read failed.
 *
 * The function never throws. A failure to resolve a single file is
 * reported as an error so the Context Builder can skip the file
 * without aborting the whole package.
 */
export function readFileContent(
  path: string,
  source: "indexer" | "inline",
  inline: ReadonlyMap<string, string> | undefined,
  registry: FileContentRegistry,
): { content: string } | { error: ContextError } {
  if (source === "inline") {
    if (!inline) {
      return {
        error: makeError(
          "MISSING_INLINE_CONTENTS",
          "Inline content source was selected but no `contents` map was provided.",
          path,
        ),
      };
    }
    if (!inline.has(path)) {
      return {
        error: makeError(
          "CONTENT_NOT_FOUND",
          `No inline content registered for "${path}".`,
          path,
        ),
      };
    }
    // `has()` returned true, so `get()` is guaranteed to be defined.
    return { content: inline.get(path) as string };
  }

  // source === "indexer"
  let content: string | undefined;
  try {
    content = registry.get(path);
  } catch (err) {
    return {
      error: makeError(
        "READ_FAILED",
        `Failed to read "${path}" from the indexer: ${describeError(err)}`,
        path,
      ),
    };
  }
  if (content === undefined) {
    return {
      error: makeError(
        "CONTENT_NOT_FOUND",
        `No content registered in the indexer for "${path}".`,
        path,
      ),
    };
  }
  return { content };
}

function makeError(
  code: ContextErrorCode,
  message: string,
  path?: string,
): ContextError {
  const err: ContextError = { code, message };
  if (path !== undefined) err.path = path;
  return err;
}

function describeError(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err);
}
