/**
 * Mock data for the Phase 3A question interface.
 *
 * These arrays drive the example chips and the recent-questions list. They
 * exist purely to make the UI feel alive while the AI / retrieval / Paritok
 * pieces are still being built.
 */

import type { QuestionExample, RecentQuestion } from "@/types/question";

export const QUESTION_EXAMPLES: QuestionExample[] = [
  {
    id: "auth",
    category: "Auth",
    prompt: "How does authentication work?",
  },
  {
    id: "routing",
    category: "Architecture",
    prompt: "Explain the routing architecture.",
  },
  {
    id: "endpoints",
    category: "API",
    prompt: "Where are API endpoints defined?",
  },
  {
    id: "error-handling",
    category: "Errors",
    prompt: "How is error handling done across the codebase?",
  },
  {
    id: "state",
    category: "State",
    prompt: "Where is global state managed?",
  },
  {
    id: "build",
    category: "Tooling",
    prompt: "What does the build pipeline look like?",
  },
];

export const RECENT_QUESTIONS: RecentQuestion[] = [
  {
    id: "r1",
    prompt: "How does authentication work?",
    repo: "vercel/next.js",
    preview:
      "NextAuth.js handles session-based auth with JWT and database adapters; middleware in /lib guards routes…",
    askedAt: minutesAgo(8),
    tokensSaved: 4821,
  },
  {
    id: "r2",
    prompt: "Explain the routing architecture.",
    repo: "vercel/next.js",
    preview:
      "App Router uses file-system based routes under /app; each folder is a segment, page.tsx is the leaf…",
    askedAt: minutesAgo(34),
    tokensSaved: 3210,
  },
  {
    id: "r3",
    prompt: "Where are API endpoints defined?",
    repo: "facebook/react",
    preview:
      "Public endpoints live in /packages/react/src/ as exported functions; the reconciler entry is ReactDOM…",
    askedAt: hoursAgo(2),
    tokensSaved: 5980,
  },
  {
    id: "r4",
    prompt: "How is state shared between server and client components?",
    repo: "vercel/next.js",
    preview:
      "Props are serialized across the RSC boundary; use client components for interactivity and context…",
    askedAt: hoursAgo(5),
    tokensSaved: 2104,
  },
  {
    id: "r5",
    prompt: "Where is the database connection initialised?",
    repo: "prisma/prisma",
    preview:
      "A singleton client lives in /packages/fetch-engine/src; it lazily opens a pool on first query…",
    askedAt: hoursAgo(11),
    tokensSaved: 1875,
  },
  {
    id: "r6",
    prompt: "What testing strategy does the repo use?",
    repo: "supabase/supabase",
    preview:
      "Vitest for unit tests, Playwright for E2E; CI runs them in parallel across the docker-compose harness…",
    askedAt: daysAgo(1),
    tokensSaved: 2640,
  },
  {
    id: "r7",
    prompt: "Where is feature flagging implemented?",
    repo: "vercel/next.js",
    preview:
      "Feature flags are read from a runtime config injected by the edge; the /lib/flags module exposes…",
    askedAt: daysAgo(2),
    tokensSaved: 1330,
  },
  {
    id: "r8",
    prompt: "Explain the caching layer in this project.",
    repo: "facebook/react",
    preview:
      "Two-tier cache: a per-request Map for the duration of a render, plus an LRU module-level cache…",
    askedAt: daysAgo(3),
    tokensSaved: 4222,
  },
];

/* -------------------------------------------------------------------------- */
/*  Tiny date helpers (mock data only).                                       */
/* -------------------------------------------------------------------------- */

function minutesAgo(m: number): string {
  return new Date(Date.now() - m * 60_000).toISOString();
}

function hoursAgo(h: number): string {
  return new Date(Date.now() - h * 60 * 60_000).toISOString();
}

function daysAgo(d: number): string {
  return new Date(Date.now() - d * 24 * 60 * 60_000).toISOString();
}
