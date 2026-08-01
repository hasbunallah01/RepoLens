/**
 * Phase 4B1 — public types for the Context Builder → Paritok pipeline.
 *
 * The pipeline module (`compress-context.ts`) does not introduce new
 * domain types of its own — it composes the existing
 * {@link import("@/lib/context").ContextPackage} and
 * {@link import("@/lib/paritok").ParitokServiceResult} shapes. The
 * only things this file adds are the *options* bag accepted by
 * {@link import("./compress-context").compressContext} and the
 * *result* shape it returns.
 *
 * Design rules:
 *
 *   - All option fields are optional and have safe defaults.
 *   - Result fields are stable: new ones may be added in later
 *     phases, existing ones will not be renamed or removed without
 *     a major bump.
 *   - Options that map directly onto the Context Builder or
 *     Paritok service are intentionally named the same way (e.g.
 *     `kind`, `timeoutMs`, `signal`) so a caller can build one
 *     `options` object and forward the relevant slice to each
 *     leg without translation.
 */

import type {
  ContextError,
  ContextPackage,
} from "@/lib/context";
import type {
  ParitokCompressionKind,
  ParitokServiceResult,
} from "@/lib/paritok";

/**
 * `ContextContentSource` lives in the private types file of the
 * Context module (`lib/context/types.ts`) and is intentionally
 * NOT re-exported from `@/lib/context`. The pipeline mirrors
 * the same string-literal union here so we do not have to reach
 * into the internal module layout. Adding a new value here in
 * the future would be a coordinated change with the Context
 * module's `types.ts`.
 */
type ContextContentSource = "indexer" | "inline";

/* -------------------------------------------------------------------------- */
/*  Options                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * Options bag for {@link import("./compress-context").compressContext}.
 *
 * Every field is optional. Unspecified fields are forwarded as
 * `undefined` to the underlying Context Builder / Paritok service
 * which then apply their own documented defaults.
 */
export interface CompressContextOptions {
  /* ---- Context Builder leg -------------------------------------- */

  /**
   * Maximum number of files to include in the Context Package.
   * Forwarded verbatim to {@link import("@/lib/context").buildContextPackage}.
   * Defaults to 5 (the Context Builder's own default).
   */
  limit?: number;

  /**
   * Content source for the Context Builder.
   *
   * - `"inline"` (the default for this pipeline) — file contents
   *   come from the `contents` map.
   * - `"indexer"` — file contents come from the in-memory indexer
   *   registry, used in production.
   *
   * Forwarded verbatim to the Context Builder.
   */
  contentSource?: ContextContentSource;

  /**
   * Inline file contents (path → source). Required when
   * `contentSource` is `"inline"`; ignored otherwise.
   * Forwarded verbatim to the Context Builder.
   */
  contents?: ReadonlyMap<string, string>;

  /* ---- Paritok leg ---------------------------------------------- */

  /**
   * Compression strategy. Defaults to `"file_read"`.
   * Forwarded verbatim to {@link import("@/lib/paritok").compressContextPackage}.
   */
  kind?: ParitokCompressionKind;

  /**
   * Per-request timeout in milliseconds. Defaults to 20 000.
   * Forwarded verbatim to the Paritok service.
   */
  timeoutMs?: number;

  /**
   * Caller-supplied abort signal. If the signal aborts, the
   * Paritok leg returns `{ ok: false, error: { code: "ABORTED" } }`
   * and the Context Package that was built before the abort is
   * still returned to the caller.
   */
  signal?: AbortSignal;

  /**
   * Override the Paritok endpoint URL. Defaults to
   * `https://www.paritok.com/api/compress`. Used by tests and the
   * dev mock page to point at a stub server.
   */
  endpoint?: string;

  /**
   * Override the Paritok API key. Defaults to the
   * `PARITOK_API_KEY` environment variable. Used by tests; should
   * not be set in production code.
   */
  apiKey?: string;
}

/* -------------------------------------------------------------------------- */
/*  Result                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * The shape returned by
 * {@link import("./compress-context").compressContext}.
 *
 * Both halves of the pipeline are always present so callers can
 * decide what to do with a Paritok failure (e.g. fall back to the
 * raw Context Package) without re-running the builder.
 */
export interface CompressContextResult {
  /**
   * The Context Package produced by the Context Builder. Always
   * defined, even if some files had to be skipped (see
   * `contextErrors`).
   */
  package: ContextPackage;

  /**
   * Non-fatal errors reported by the Context Builder while it was
   * resolving file contents. Empty when every selected file
   * resolved cleanly. The package itself is still returned
   * regardless of this list.
   */
  contextErrors: ContextError[];

  /**
   * The Paritok compression result. Mirrors
   * {@link import("@/lib/paritok").ParitokServiceResult} —
   * discriminated between success (`ok: true, data`) and failure
   * (`ok: false, error`).
   */
  compressed: ParitokServiceResult;
}
