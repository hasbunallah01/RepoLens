/**
 * Typed wrappers for the small set of GitHub endpoints RepoLens uses.
 *
 * Endpoints:
 *   - GET /repos/{owner}/{repo}                  → metadata
 *   - GET /repos/{owner}/{repo}/git/trees/{sha}?recursive=1  → file tree
 *   - GET /repos/{owner}/{repo}/commits?per_page=5          → recent commits
 */

import { request } from "./client";
import type { RepoCommit, RepoMetadata } from "@/types/repository";

interface RawRepo {
  name: string;
  full_name: string;
  description: string | null;
  stargazers_count: number;
  forks_count: number;
  subscribers_count?: number;
  language: string | null;
  topics?: string[];
  default_branch: string;
  license: { spdx_id: string | null; name: string } | null;
  updated_at: string;
  html_url: string;
  size: number; // in KB
  private: boolean;
  fork: boolean;
  archived: boolean;
  owner: { login: string };
}

interface RawTreeEntry {
  path: string;
  mode: string;
  type: "blob" | "tree";
  sha: string;
  size?: number;
  url: string;
}

interface RawTree {
  sha: string;
  url: string;
  tree: RawTreeEntry[];
  truncated: boolean;
}

interface RawCommit {
  sha: string;
  html_url: string;
  commit: {
    message: string;
    author: { name: string; date: string };
  };
}

export async function fetchRepoMetadata(owner: string, repo: string): Promise<RepoMetadata> {
  const raw = await request<RawRepo>(`/repos/${owner}/${repo}`);
  return {
    name: raw.name,
    owner: raw.owner.login,
    fullName: raw.full_name,
    description: raw.description,
    stars: raw.stargazers_count,
    forks: raw.forks_count,
    watchers: raw.subscribers_count ?? 0,
    primaryLanguage: raw.language,
    topics: raw.topics ?? [],
    defaultBranch: raw.default_branch,
    license: raw.license?.spdx_id ?? raw.license?.name ?? null,
    lastUpdated: raw.updated_at,
    htmlUrl: raw.html_url,
    sizeKb: raw.size,
    isPrivate: raw.private,
    isFork: raw.fork,
    isArchived: raw.archived,
  };
}

export async function fetchRepoTree(
  owner: string,
  repo: string,
  defaultBranch: string,
): Promise<RawTree> {
  return request<RawTree>(`/repos/${owner}/${repo}/git/trees/${defaultBranch}?recursive=1`);
}

export async function fetchRecentCommits(
  owner: string,
  repo: string,
  perPage = 5,
): Promise<RepoCommit[]> {
  const raw = await request<RawCommit[]>(`/repos/${owner}/${repo}/commits?per_page=${perPage}`);
  return raw.map((c) => ({
    sha: c.sha,
    message: c.commit.message,
    author: c.commit.author?.name ?? "unknown",
    date: c.commit.author?.date ?? new Date().toISOString(),
    url: c.html_url,
  }));
}

export type { RawTree, RawTreeEntry };
