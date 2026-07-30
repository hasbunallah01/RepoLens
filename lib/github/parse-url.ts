/**
 * GitHub URL parsing and validation.
 *
 * Accepts any of the common user-facing shapes:
 *   - https://github.com/owner/repo
 *   - https://github.com/owner/repo.git
 *   - https://github.com/owner/repo/tree/branch/optional/path
 *   - git@github.com:owner/repo.git
 *   - owner/repo  (bare shorthand)
 *
 * Returns a discriminated result so the UI can render precise errors.
 */

import type { ParsedRepoUrl } from "@/types/repository";

const OWNER_RE = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})$/; // GitHub username rules
const REPO_RE = /^[A-Za-z0-9._-]{1,100}$/; // permissive repo name

export type ParseResult =
  | { ok: true; value: ParsedRepoUrl }
  | { ok: false; reason: string };

function ok(owner: string, repo: string, raw: string): ParseResult {
  return { ok: true, value: { owner, repo, raw } };
}

function fail(reason: string): ParseResult {
  return { ok: false, reason };
}

export function parseGitHubUrl(input: string): ParseResult {
  const raw = input.trim();
  if (!raw) {
    return fail("Please paste a GitHub repository URL.");
  }

  // Bare "owner/repo" shorthand
  if (/^[\w.-]+\/[\w.-]+$/.test(raw) && !raw.includes("://") && !raw.startsWith("git@")) {
    const [owner, repo] = raw.split("/", 2);
    if (!owner || !repo) return fail("URL is missing the repository name.");
    return validate(owner, repo, raw);
  }

  // SSH form: git@github.com:owner/repo(.git)
  if (raw.startsWith("git@")) {
    const m = raw.match(/^git@github\.com:([^/\s]+)\/([^/\s]+?)(?:\.git)?\/?$/i);
    if (!m) return fail("That SSH URL doesn't look like a valid GitHub repository.");
    return validate(m[1]!, m[2]!, raw);
  }

  // HTTP(S) form
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return fail("That doesn't look like a valid URL.");
  }

  if (!/^(www\.)?github\.com$/i.test(url.hostname)) {
    return fail("Only github.com repositories are supported.");
  }

  const segments = url.pathname.split("/").filter(Boolean);
  if (segments.length < 2) {
    return fail("URL is missing the repository name.");
  }

  const owner = segments[0]!;
  const repo = segments[1]!.replace(/\.git$/i, "");

  // Disallow "settings", "about", "pulls", etc. — those aren't repo roots.
  const reserved = new Set([
    "settings",
    "about",
    "pulls",
    "issues",
    "actions",
    "projects",
    "wiki",
    "security",
    "pulse",
    "graphs",
    "network",
    "stargazers",
    "watchers",
    "forks",
    "releases",
    "tags",
    "branches",
    "commits",
    "search",
    "orgs",
    "users",
    "topics",
  ]);
  if (reserved.has(owner.toLowerCase())) {
    return fail("That doesn't look like a repository URL.");
  }

  return validate(owner, repo, raw);
}

function validate(owner: string, repo: string, raw: string): ParseResult {
  if (!OWNER_RE.test(owner)) {
    return fail("The repository owner segment isn't a valid GitHub username.");
  }
  if (!REPO_RE.test(repo)) {
    return fail("The repository name contains invalid characters.");
  }
  return ok(owner, repo, raw);
}

/** Convenience: returns null on success, or a friendly reason on failure. */
export function validateGitHubUrl(input: string): string | null {
  const result = parseGitHubUrl(input);
  return result.ok ? null : result.reason;
}
