/**
 * Centralised environment configuration (Backend 6A).
 *
 * This module is the single place where RepoLens reads `process.env`.
 * Every other module is expected to import its configuration from here
 * instead of touching `process.env` directly, so that:
 *
 *   - The set of supported environment variables is documented in one
 *     place (`ENV_VARS` below + `REQUIRED_ENV_VARS`).
 *   - Required variables can be validated at startup with a single
 *     call to {@link validateConfig}, which throws a
 *     {@link ConfigError} with a developer-friendly message when
 *     something is missing.
 *   - All reads go through a small, well-typed surface
 *     ({@link AppConfig}) so call sites stay clean and testable.
 *
 * Implementation notes:
 *
 *   - Reads are *lazy*: {@link getConfig} and the individual getters
 *     inspect `process.env` at call time, not at module load. This
 *     keeps the existing Paritok / OpenAI tests working — they
 *     manipulate `process.env` in `beforeEach` and expect each
 *     function call to see the up-to-date value.
 *   - Whitespace is trimmed. An environment variable that exists but
 *     is blank (e.g. `OPENAI_API_KEY=`) is treated as missing so we
 *     never accidentally send an empty bearer token upstream.
 *   - The module never throws at import time. `next build` does not
 *     have a `.env.local` and should not fail. Callers that want
 *     "fail fast" semantics should invoke {@link validateConfig}
 *     from a server entry point (e.g. the analyze API route).
 */

/* -------------------------------------------------------------------------- */
/*  Environment variable names                                                 */
/* -------------------------------------------------------------------------- */

/**
 * Canonical names of every environment variable RepoLens understands.
 *
 * Re-exported as `PARITOK_API_KEY_ENV` from `@/lib/paritok` for
 * backward compatibility with the existing public surface and the
 * Paritok test suite.
 */
export const ENV_VARS = {
  OPENAI_API_KEY: "OPENAI_API_KEY",
  PARITOK_API_KEY: "PARITOK_API_KEY",
  PARITOK_API_URL: "PARITOK_API_URL",
  GITHUB_TOKEN: "GITHUB_TOKEN",
} as const;

/** Convenience alias for the Paritok env var. */
export const PARITOK_API_KEY_ENV = ENV_VARS.PARITOK_API_KEY;

/**
 * Subset of {@link ENV_VARS} that must be set for the application to
 * function. {@link validateConfig} throws when any of these is missing.
 */
export const REQUIRED_ENV_VARS: readonly string[] = [
  ENV_VARS.OPENAI_API_KEY,
  ENV_VARS.PARITOK_API_KEY,
] as const;

/* -------------------------------------------------------------------------- */
/*  Typed configuration shape                                                  */
/* -------------------------------------------------------------------------- */

/**
 * The typed configuration object that other modules import.
 *
 * Every value is nullable: an absent environment variable becomes
 * `null` rather than throwing. Callers that require a value (e.g.
 * the OpenAI client) should treat `null` as a hard failure via
 * {@link validateConfig} or by surfacing a typed error result.
 */
export interface AppConfig {
  openai: {
    /** OpenAI bearer token, or `null` if `OPENAI_API_KEY` is unset. */
    apiKey: string | null;
  };
  paritok: {
    /** Paritok bearer token, or `null` if `PARITOK_API_KEY` is unset. */
    apiKey: string | null;
    /**
     * Optional Paritok endpoint override. The Paritok client falls
     * back to its own default constant when this is `null`.
     */
    apiUrl: string | null;
  };
  github: {
    /** Optional GitHub token, or `null` if `GITHUB_TOKEN` is unset. */
    token: string | null;
  };
}

/* -------------------------------------------------------------------------- */
/*  Errors                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * Thrown by {@link validateConfig} when one or more required
 * environment variables are missing or blank.
 *
 * The `missing` field carries the list of offending variable names
 * so consumers (and tests) can branch on the cause without parsing
 * the human-readable message.
 */
export class ConfigError extends Error {
  readonly missing: readonly string[];

  constructor(message: string, missing: readonly string[]) {
    super(message);
    this.name = "ConfigError";
    this.missing = missing;
  }
}

/* -------------------------------------------------------------------------- */
/*  Internals                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * Read a single environment variable, trimmed, or return `null` when
 * it is absent or blank.
 *
 * Exposed only inside this module — callers should use the typed
 * getters below or {@link getConfig}.
 */
function readEnvString(name: string): string | null {
  if (typeof process === "undefined" || !process.env) return null;
  const raw = process.env[name];
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/* -------------------------------------------------------------------------- */
/*  Individual getters                                                         */
/* -------------------------------------------------------------------------- */

/** Returns the OpenAI API key, or `null` if `OPENAI_API_KEY` is unset. */
export function getOpenAIApiKey(): string | null {
  return readEnvString(ENV_VARS.OPENAI_API_KEY);
}

/** Returns the Paritok API key, or `null` if `PARITOK_API_KEY` is unset. */
export function getParitokApiKey(): string | null {
  return readEnvString(ENV_VARS.PARITOK_API_KEY);
}

/** Returns the Paritok API URL override, or `null` if `PARITOK_API_URL` is unset. */
export function getParitokApiUrl(): string | null {
  return readEnvString(ENV_VARS.PARITOK_API_URL);
}

/** Returns the GitHub token, or `null` if `GITHUB_TOKEN` is unset. */
export function getGitHubToken(): string | null {
  return readEnvString(ENV_VARS.GITHUB_TOKEN);
}

/* -------------------------------------------------------------------------- */
/*  Aggregated configuration                                                   */
/* -------------------------------------------------------------------------- */

/**
 * Build a fresh {@link AppConfig} snapshot from the current
 * `process.env`. Reads are performed at call time so tests that
 * mutate `process.env` between calls see the updated values.
 */
export function getConfig(): AppConfig {
  return {
    openai: { apiKey: getOpenAIApiKey() },
    paritok: {
      apiKey: getParitokApiKey(),
      apiUrl: getParitokApiUrl(),
    },
    github: { token: getGitHubToken() },
  };
}

/* -------------------------------------------------------------------------- */
/*  Validation                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * Validate that every variable in {@link REQUIRED_ENV_VARS} is set
 * to a non-blank value. Returns the validated {@link AppConfig} on
 * success.
 *
 * Throws a {@link ConfigError} with a developer-friendly message
 * when one or more required variables are missing or blank.
 *
 * Intended use: call once at server startup (for example from a
 * Next.js route handler, a server action, or `instrumentation.ts`)
 * to fail fast with a clear error before any business logic runs.
 */
export function validateConfig(): AppConfig {
  const missing: string[] = [];
  for (const name of REQUIRED_ENV_VARS) {
    if (readEnvString(name) === null) {
      missing.push(name);
    }
  }
  if (missing.length > 0) {
    const list = missing.join(", ");
    const message =
      `RepoLens is missing required environment variable(s): ${list}. ` +
      `Add them to your .env.local file before starting the application. ` +
      `See .env.example for the full list of supported variables.`;
    throw new ConfigError(message, missing);
  }
  return getConfig();
}
