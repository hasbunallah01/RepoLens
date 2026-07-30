/**
 * Thin, typed wrapper around the GitHub REST API.
 *
 * Uses `fetch` (no extra dependencies) and respects an optional
 * `GITHUB_TOKEN` env var for higher rate limits. All callers go
 * through `request()`, which normalises GitHub's error responses
 * into our `AnalysisError` shape.
 */

import type { AnalysisError, AnalysisErrorCode } from "@/types/repository";

const GITHUB_API = "https://api.github.com";

interface RequestOptions {
  /** Request signal so callers can cancel. */
  signal?: AbortSignal;
}

export class GitHubApiError extends Error {
  readonly code: AnalysisErrorCode;
  readonly status: number | undefined;

  constructor(code: AnalysisErrorCode, message: string, status?: number) {
    super(message);
    this.name = "GitHubApiError";
    this.code = code;
    this.status = status;
  }

  toAnalysisError(): AnalysisError {
    return { code: this.code, message: this.message, status: this.status };
  }
}

function authHeaders(): Record<string, string> {
  const token = process.env.GITHUB_TOKEN?.trim();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function mapStatusToCode(status: number, apiMessage?: string | null): {
  code: AnalysisErrorCode;
  message: string;
} {
  if (status === 404) {
    // GitHub's 404 message is a strong signal: if it includes "Not Found"
    // it's a missing repo; if it mentions private/visibility, treat as private.
    if (apiMessage && /private|visibility/i.test(apiMessage)) {
      return { code: "REPO_PRIVATE", message: "This repository is private or does not exist." };
    }
    return { code: "REPO_NOT_FOUND", message: "We couldn't find that repository on GitHub." };
  }
  if (status === 403 || status === 429) {
    return {
      code: "RATE_LIMITED",
      message:
        "GitHub API rate limit reached. Add a GITHUB_TOKEN to .env.local to lift this limit.",
    };
  }
  if (status >= 500) {
    return {
      code: "NETWORK",
      message: "GitHub is having trouble right now. Please try again in a moment.",
    };
  }
  return { code: "UNKNOWN", message: `Unexpected GitHub response (HTTP ${status}).` };
}

export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const url = `${GITHUB_API}${path}`;

  let res: Response;
  try {
    res = await fetch(url, {
      headers: {
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "RepoLens",
        ...authHeaders(),
      },
      // No Next.js cache by default — callers decide.
      cache: "no-store",
      signal: options.signal,
    });
  } catch (err) {
    if ((err as { name?: string })?.name === "AbortError") {
      throw err;
    }
    throw new GitHubApiError(
      "NETWORK",
      "Could not reach GitHub. Check your connection and try again.",
    );
  }

  if (res.status === 401) {
    throw new GitHubApiError(
      "RATE_LIMITED",
      "GitHub rejected the request. If you're using a GITHUB_TOKEN, verify it's valid.",
      401,
    );
  }

  if (!res.ok) {
    // Try to extract a more specific error message.
    let apiMessage: string | null = null;
    try {
      const body = (await res.json()) as { message?: string };
      apiMessage = body.message ?? null;
    } catch {
      /* non-JSON body, ignore */
    }

    const mapped = mapStatusToCode(res.status, apiMessage);
    const finalMessage =
      apiMessage && res.status === 404
        ? mapped.message
        : apiMessage
          ? `${mapped.message} (${apiMessage})`
          : mapped.message;

    throw new GitHubApiError(mapped.code, finalMessage, res.status);
  }

  return (await res.json()) as T;
}
