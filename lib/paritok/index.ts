/**
 * Public surface of the Paritok compression service (Phase 4A).
 *
 * Consumers should import from `@/lib/paritok` rather than reaching
 * into the individual files. The internal layout (client, types) is
 * deliberately kept private so the wire protocol and the parsing
 * logic can evolve without breaking call sites.
 *
 * Independence guarantees:
 *
 *   - The Paritok module does NOT import from any AI / LLM provider.
 *     Its only upstream dependency is the Context Package shape from
 *     `@/lib/context` (consumed as a *type* only).
 *   - The Paritok module does NOT mutate Context Packages. It only
 *     reads them and produces a strongly typed
 *     {@link ParitokCompressionResult}.
 *   - The Paritok module is safe to call from any server-side context
 *     (Next.js route handlers, server actions, scripts, tests).
 *
 * Future AI providers will consume the compressed output produced
 * here without ever having to change this module.
 */

export {
  compressContextPackage,
  sendParitokRequest,
  buildParitokRequest,
  resolveParitokApiKey,
  PARITOK_API_KEY_ENV,
  PARITOK_API_URL,
  DEFAULT_PARITOK_TIMEOUT_MS,
} from "./client";

export {
  DEFAULT_PARITOK_KIND,
  PARITOK_SCHEMA_VERSION,
} from "./types";

export type {
  ParitokCompressionKind,
  ParitokCompressionInput,
  ParitokCompressionRequest,
  ParitokCompressionResult,
  ParitokCompressionOptions,
  ParitokError,
  ParitokErrorCode,
  ParitokServiceResult,
} from "./types";
