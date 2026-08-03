/**
 * Mock data for the Ask page.
 *
 * Shaped against the real domain types in `types/repository.ts` so this
 * can be swapped for live data later without touching the components.
 * Fields with no backend equivalent today are called out below and in
 * the PR notes.
 */

import type { RepoMetadata } from "@/types/repository";

export const MOCK_ASK_METADATA: RepoMetadata = {
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
  lastUpdated: new Date(Date.now() - 1000 * 60 * 60 * 24 * 2).toISOString(),
  htmlUrl: "https://github.com/vercel/next.js",
  sizeKb: 512000,
  isPrivate: false,
  isFork: false,
  isArchived: false,
};

/**
 * "Repository Context" panel figures. Indexed Files and Code Lines line up
 * conceptually with RepoIndex.totalFiles / a future LOC counter — but the
 * backend doesn't compute a lines-of-code total yet, and "Languages" /
 * "Last Indexed" / "Repository Size" (indexed-content size, not raw repo
 * size) have no backend field at all today. See PR notes.
 */
export const MOCK_REPO_CONTEXT = {
  indexedFiles: 2104,
  codeLines: "1.2M",
  languageCount: 6,
  lastIndexed: "2 days ago",
  repositorySize: "45.6 MB",
};

export interface MockTopFile {
  path: string;
  lines: number;
  relevance: number;
}

/** Not in the backend yet — there's no per-file "relevance %" concept
 * computed anywhere (lib/ranking scores are relative to a *question*,
 * not a fixed per-repo ranking). See PR notes. */
export const MOCK_TOP_FILES: MockTopFile[] = [
  { path: "app/layout.tsx", lines: 1200, relevance: 92 },
  { path: "app/page.tsx", lines: 856, relevance: 88 },
  { path: "next.config.js", lines: 312, relevance: 85 },
  { path: "package.json", lines: 156, relevance: 80 },
  { path: "app/api/route.ts", lines: 342, relevance: 78 },
];

export interface SuggestedQuestion {
  id: string;
  title: string;
  subtitle: string;
}

export const SUGGESTED_QUESTIONS: SuggestedQuestion[] = [
  { id: "architecture", title: "Explain the architecture", subtitle: "How is Next.js structured?" },
  { id: "routing", title: "How does routing work?", subtitle: "Explain the App Router in Next.js" },
  { id: "auth", title: "Where is authentication handled?", subtitle: "Show me the auth implementation" },
  { id: "data-fetching", title: "How does data fetching work?", subtitle: "Explain SSR, SSG, and ISR" },
  { id: "caching", title: "How is caching implemented?", subtitle: "Explain Next.js caching strategies" },
  { id: "api-routes", title: "Show me the API routes", subtitle: "Where are the API endpoints?" },
];

export const TIPS: string[] = [
  "Be specific for better answers",
  "Mention file names for targeted help",
  "Use natural language",
  "I can explain code, find bugs, and suggest improvements",
];
