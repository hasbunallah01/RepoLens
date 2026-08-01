/**
 * Public surface of the Context Builder → Paritok pipeline (Phase 4B1).
 *
 * This is the thin orchestrator that sits between
 *   - the Context Builder (Phase 3D1, `@/lib/context`)
 *   - the Paritok compression service (Phase 4A, `@/lib/paritok`)
 *
 * and exposes a single `compressContext()` function that runs the
 * full pipeline. Consumers should import from `@/lib/pipeline`
 * rather than reaching into the individual files.
 *
 * Independence guarantees:
 *
 *   - The pipeline module does NOT import from any LLM / AI
 *     provider. It only depends on the Context Package shape
 *     (consumed as a *type*) and the Paritok service.
 *   - The pipeline module does NOT duplicate any logic from the
 *     Context Builder or the Paritok service. It only orchestrates
 *     them.
 *   - The Context and Paritok modules continue to work standalone.
 *     Removing this integration would not break them.
 */

export { compressContext } from "./compress-context";

export type {
  CompressContextOptions,
  CompressContextResult,
} from "./types";
