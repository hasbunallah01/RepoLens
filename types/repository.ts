/**
 * Domain types for Phase 2 — GitHub repository ingestion & indexing.
 *
 * These describe *our* internal model after we've parsed a URL, fetched
 * metadata, walked the tree, and built an index. They are intentionally
 * decoupled from the raw GitHub REST response shapes.
 */

/** A parsed GitHub repository URL. */
export interface ParsedRepoUrl {
  owner: string;
  repo: string;
  /** Original URL the user pasted. */
  raw: string;
}

/** Public-facing repository metadata. */
export interface RepoMetadata {
  name: string;
  owner: string;
  fullName: string; // "owner/repo"
  description: string | null;
  stars: number;
  forks: number;
  watchers: number;
  primaryLanguage: string | null;
  topics: string[];
  defaultBranch: string;
  license: string | null;
  lastUpdated: string; // ISO timestamp
  htmlUrl: string;
  sizeKb: number;
  isPrivate: boolean;
  isFork: boolean;
  isArchived: boolean;
}

/** A single commit summary shown in the dashboard. */
export interface RepoCommit {
  sha: string;
  message: string;
  author: string;
  date: string; // ISO
  url: string;
}

/** Language breakdown derived from the indexed files. */
export interface LanguageStat {
  language: string;
  files: number;
  bytes: number;
  /** Percentage 0–100, rounded to one decimal. */
  percent: number;
}

/** A single indexed file. */
export interface IndexedFile {
  /** Repository-relative path, e.g. "src/lib/utils.ts". */
  path: string;
  name: string;
  extension: string; // ".ts" (with dot) or "" for files without one
  /** Lowercase extension without dot, e.g. "ts". */
  extKey: string;
  language: string;
  folder: string; // "" for root
  sizeBytes: number;
}

/** Folder node in the file tree. */
export interface TreeNode {
  name: string;
  path: string;
  type: "file" | "folder";
  children?: TreeNode[];
  /** Only present for files. */
  file?: IndexedFile;
}

/** The full index the rest of the app reads. */
export interface RepoIndex {
  files: IndexedFile[];
  tree: TreeNode;
  languages: LanguageStat[];
  totalFiles: number;
  totalSizeBytes: number;
  hasReadme: boolean;
  /** All distinct top-level folders at root. */
  rootFolders: string[];
  /** All distinct file extensions. */
  extensions: string[];
}

/** Bundle returned by the /api/analyze route. */
export interface AnalysisResult {
  url: string;
  metadata: RepoMetadata;
  index: RepoIndex;
  commits: RepoCommit[];
  fetchedAt: string; // ISO
}

/* -------------------------------------------------------------------------- */
/*  Error model                                                               */
/* -------------------------------------------------------------------------- */

export type AnalysisErrorCode =
  | "INVALID_URL"
  | "REPO_NOT_FOUND"
  | "REPO_PRIVATE"
  | "RATE_LIMITED"
  | "NETWORK"
  | "UNKNOWN";

export interface AnalysisError {
  code: AnalysisErrorCode;
  message: string;
  /** Optional GitHub-specific detail. */
  status?: number;
}
