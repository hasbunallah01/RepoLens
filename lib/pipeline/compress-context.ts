/**
 * Phase 4B1 — Context Builder → Paritok integration.
 *
 * This module is the **orchestrator** that wires together the two
 * independent subsystems that already exist in RepoLens:
 *
 *   - {@link buildContextPackage}  (Phase 3D1, `@/lib/context`)
 *   - {@link compressContextPackage} (Phase 4A,  `@/lib/paritok`)
 *
 * It does **not** re-implement either side. It only:
 *
 *   1. Calls the Context Builder with the user's question and the
 *      ranked files produced upstream (e.g. by the ranking engine).
 *   2. Forwards the resulting {@link ContextPackage} to the Paritok
 *      compression service.
 *   3. Returns both halves (the package and the compressed result)
 *      so callers can log, cache, or surface the savings.
 *
 * Independence guarantees:
 *
 *   - This module does **not** import any LLM / AI provider.
 *   - This module does **not** mutate the Context Package.
 *   - This module does **not** call `fetch` directly; it delegates
 *     to {@link compressContextPackage} which already owns the
 *     HTTP / timeout / error-handling surface.
 *   - The Context and Paritok modules continue to work standalone.
 *     Removing this integration would not break them.
 *
 * Future phases (4B2, 4C, 5, …) can compose `compressContext` with
 * other steps (metrics, caching, LLM call) without changing this
 * file.
 */

import { buildContextPackage } from "@/lib/context";
import type {
  BuildContextOptions,
  BuildContextResult,
  ContextPackage,
  ContextRepositoryInfo,
} from "@/lib/context";
import { compressContextPackage } from "@/lib/paritok";
import type {
  ParitokCompressionOptions,
  ParitokServiceResult,
} from "@/lib/paritok";
import type { RankedFile } from "@/types/ranking";
import type { CompressContextOptions, CompressContextResult } from "./types";

/* -------------------------------------------------------------------------- */
/*  Public API                                                                */
/* -------------------------------------------------------------------------- */

/**
 * Run the full Phase 4B1 pipeline:
 *
 *   ranked files → Context Builder → ContextPackage → Paritok → compressed
 *
 * The function is `async` because the Paritok leg performs an HTTP
 * call. It never throws for expected failure modes (missing file
 * contents, missing API key, network error, malformed Paritok
 * response); those are surfaced as discriminated values inside the
 * returned object.
 *
 * @param question       The user's original question.
 * @param rankedFiles    Ranked files (highest score first) — typically
 *                       the output of the ranking engine.
 * @param repository     Repository identity attached to the package.
 * @param options        See {@link CompressContextOptions}.
 */
export async function compressContext(
  question: string,
  rankedFiles: ReadonlyArray<RankedFile>,
  repository: ContextRepositoryInfo,
  options: CompressContextOptions = {},
): Promise<CompressContextResult> {
  // 1. Forward to the Context Builder with the caller's knobs.
  //    Inline contents are the default in tests / dev; production
  //    callers can opt into the indexer by passing
  //    `contextOptions.contentSource = "indexer"`.
  const buildOptions: BuildContextOptions = {
    limit: options.limit,
    contentSource: options.contentSource,
    contents: options.contents,
  };
  const build: BuildContextResult = buildContextPackage(
    question,
    rankedFiles,
    repository,
    buildOptions,
  );

  // 2. Forward the package to Paritok. The Compression service
  //    already handles the "empty package" case (it will POST an
  //    empty `content` field and Paritok will decide what to do), so
  //    we deliberately don't short-circuit here — keeping the call
  //    unconditional makes the failure modes uniform and easier to
  //    test.
  const paritokOptions: ParitokCompressionOptions = {
    kind: options.kind,
    timeoutMs: options.timeoutMs,
    signal: options.signal,
    endpoint: options.endpoint,
    apiKey: options.apiKey,
  };
  const compressed: ParitokServiceResult = await compressContextPackage(
    build.package,
    paritokOptions,
  );

  return {
    package: build.package,
    contextErrors: build.errors,
    compressed,
  };
}

/* -------------------------------------------------------------------------- */
/*  Re-exports                                                                */
/* -------------------------------------------------------------------------- */

export type {
  CompressContextOptions,
  CompressContextResult,
} from "./types";
export type { ContextPackage };
