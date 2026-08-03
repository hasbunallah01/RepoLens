/**
 * Mock data for the Analyze page.
 *
 * Every export here is shaped to match the *real* domain types in
 * `types/repository.ts` (RepoMetadata, LanguageStat, TreeNode, RepoCommit,
 * IndexedFile) so that swapping this module out for live `useRepoAnalysis`
 * data later is a prop-level change, not a component rewrite.
 *
 * Fields with no equivalent in the current backend response are marked
 * below — see the PR notes for the full list of backend gaps.
 */

import type {
  IndexedFile,
  LanguageStat,
  RepoCommit,
  RepoMetadata,
  TreeNode,
} from "@/types/repository";

export const EXAMPLE_REPOS = ["vercel/next.js", "facebook/react", "microsoft/vscode"];

export const MOCK_METADATA: RepoMetadata = {
  name: "next.js",
  owner: "vercel",
  fullName: "vercel/next.js",
  description: "The React Framework for the Web",
  stars: 125000,
  forks: 24300,
  watchers: 125000,
  primaryLanguage: "TypeScript",
  topics: ["react", "nextjs", "framework"],
  defaultBranch: "canary",
  license: "MIT",
  lastUpdated: new Date().toISOString(),
  htmlUrl: "https://github.com/vercel/next.js",
  sizeKb: 512000,
  isPrivate: false,
  isFork: false,
  isArchived: false,
};

/**
 * Not in RepoMetadata/RepoIndex today — the backend doesn't currently
 * compute a directory count or a lines-of-code total (only file count and
 * total byte size are indexed). Kept here as page-level extras so the UI
 * can show them now; see PR notes for what the backend would need to add.
 */
export const MOCK_EXTRA_STATS = {
  totalFiles: 2104,
  totalDirectories: 593,
  linesOfCode: "1.2M",
};

export const MOCK_LANGUAGES: LanguageStat[] = [
  { language: "TypeScript", files: 1264, bytes: 0, percent: 60.1 },
  { language: "JavaScript", files: 429, bytes: 0, percent: 20.4 },
  { language: "CSS", files: 183, bytes: 0, percent: 8.7 },
  { language: "MDX", files: 109, bytes: 0, percent: 5.2 },
  { language: "Other", files: 119, bytes: 0, percent: 5.6 },
];

export const LANGUAGE_COLORS: Record<string, string> = {
  TypeScript: "#0c8974",
  JavaScript: "#2f6fed",
  CSS: "#f1962a",
  MDX: "#a855f7",
  Other: "#cbd5e1",
};

export const MOCK_TREE: TreeNode = {
  name: "next.js",
  path: "",
  type: "folder",
  children: [
    { name: ".github", path: ".github", type: "folder", children: [] },
    { name: ".next", path: ".next", type: "folder", children: [] },
    { name: "apps", path: "apps", type: "folder", children: [] },
    { name: "packages", path: "packages", type: "folder", children: [] },
    { name: "scripts", path: "scripts", type: "folder", children: [] },
    { name: "test", path: "test", type: "folder", children: [] },
    { name: "tools", path: "tools", type: "folder", children: [] },
    { name: ".gitignore", path: ".gitignore", type: "file" },
    { name: ".npmrc", path: ".npmrc", type: "file" },
    { name: "README.md", path: "README.md", type: "file" },
    { name: "package.json", path: "package.json", type: "file" },
    { name: "tsconfig.json", path: "tsconfig.json", type: "file" },
  ],
};

export const MOCK_COMMITS: RepoCommit[] = [
  {
    sha: "a1b2c3d",
    message: "Update turbopack configuration",
    author: "ljharb",
    date: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
    url: "https://github.com/vercel/next.js/commit/a1b2c3d",
  },
  {
    sha: "d4e5f6g",
    message: "Fix: handle edge runtime headers correctly",
    author: "huozhi",
    date: new Date(Date.now() - 1000 * 60 * 60 * 5).toISOString(),
    url: "https://github.com/vercel/next.js/commit/d4e5f6g",
  },
  {
    sha: "h7i8j9k",
    message: "Docs: update getStaticProps examples",
    author: "icyJoseph",
    date: new Date(Date.now() - 1000 * 60 * 60 * 7).toISOString(),
    url: "https://github.com/vercel/next.js/commit/h7i8j9k",
  },
  {
    sha: "l0m1n2o",
    message: "Refactor: improve build output caching",
    author: "timneutkens",
    date: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
    url: "https://github.com/vercel/next.js/commit/l0m1n2o",
  },
];

export const MOCK_INDEXED_FILES: IndexedFile[] = [
  { path: "packages/next/src/server/app-render/app-render.tsx", name: "app-render.tsx", extension: ".tsx", extKey: "tsx", language: "TypeScript", folder: "packages/next/src/server/app-render", sizeBytes: 48213 },
  { path: "packages/next/src/server/request/index.ts", name: "index.ts", extension: ".ts", extKey: "ts", language: "TypeScript", folder: "packages/next/src/server/request", sizeBytes: 12044 },
  { path: "packages/next/src/client/app-index.tsx", name: "app-index.tsx", extension: ".tsx", extKey: "tsx", language: "TypeScript", folder: "packages/next/src/client", sizeBytes: 9021 },
  { path: "packages/next/build/index.ts", name: "index.ts", extension: ".ts", extKey: "ts", language: "TypeScript", folder: "packages/next/build", sizeBytes: 33021 },
  { path: "packages/next/package.json", name: "package.json", extension: ".json", extKey: "json", language: "JSON", folder: "packages/next", sizeBytes: 4210 },
  { path: "packages/next/README.md", name: "README.md", extension: ".md", extKey: "md", language: "Markdown", folder: "packages/next", sizeBytes: 2109 },
];

/** Fake staged progress for the loading experience — see PR notes. */
export const ANALYSIS_STEPS = [
  "Connecting to GitHub",
  "Fetching Repository",
  "Indexing Files",
  "Building Context",
  "Generating Insights",
] as const;
