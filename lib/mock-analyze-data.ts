/**
 * Static, non-mock constants used by the Analyze page.
 *
 * Everything in this file is *configuration* (display labels, color
 * tokens, example inputs) — not mock analysis data. The analyze page
 * is wired to the real `useRepoAnalysis` hook → `/api/analyze`
 * pipeline; these constants only describe how the UI should render
 * the response.
 *
 * If you find yourself adding a hardcoded repository, fake commit,
 * or invented statistic here, stop — those belong in the backend
 * (see `app/api/analyze/route.ts` and `lib/indexer/`).
 */

import type { LanguageStat } from "@/types/repository";

/**
 * Quick-pick example repository pills shown under the URL input.
 * These are *user input shortcuts*, not analysis results — the
 * user can override them with any github.com URL.
 */
export const EXAMPLE_REPOS = ["vercel/next.js", "facebook/react", "microsoft/vscode"];

/**
 * Static color tokens for the language donut chart.
 *
 * Languages not in this map fall back to a neutral slate color in
 * `components/analyze/LanguageChart.tsx`. Add a token here when a
 * language becomes common enough to deserve its own brand color.
 */
export const LANGUAGE_COLORS: Record<string, string> = {
  TypeScript: "#0c8974",
  JavaScript: "#2f6fed",
  CSS: "#f1962a",
  MDX: "#a855f7",
  Other: "#cbd5e1",
};

/**
 * Analysis pipeline stages surfaced as the animated "Analysis in
 * Progress" checklist. The real backend today resolves `/api/analyze`
 * in a single round trip, so the component that consumes this array
 * (`AnalysisProgress.tsx`) drives it client-side as a simulation.
 * When the backend eventually streams per-stage progress, the same
 * labels can be matched to real stage events.
 */
export const ANALYSIS_STEPS = [
  "Fetching Repository",
  "Building File Index",
  "Analyzing Structure",
  "Loading Repository Data",
  "Rendering Analysis",
] as const;

/* -------------------------------------------------------------------------- */
/*  Display helpers                                                            */
/* -------------------------------------------------------------------------- */

/**
 * Format an estimated lines-of-code count as a human-friendly string.
 *
 * The backend returns a plain `number` (see `estimateLinesOfCode` in
 * `lib/indexer/lines-of-code.ts`). The UI displays it as e.g.
 * "1.2M", "247k", or "932" depending on magnitude.
 */
export function formatLinesOfCode(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return "0";
  if (n >= 1_000_000) {
    const m = n / 1_000_000;
    return `${m.toFixed(m >= 10 ? 0 : 1)}M`;
  }
  if (n >= 1_000) {
    const k = n / 1_000;
    return `${k.toFixed(k >= 10 ? 0 : 1)}k`;
  }
  return n.toLocaleString();
}

/**
 * Return up to `max` languages for the donut chart, rolling the
 * remainder into a single "Other" slice. The backend's
 * `RepoIndex.languages` already returns one row per language, but a
 * real-world repo can have 15+ language entries; the chart only has
 * room for ~5, so the long tail must collapse.
 */
export function topLanguages(
  languages: readonly LanguageStat[],
  max: number = 5,
): LanguageStat[] {
  if (languages.length <= max) return [...languages];
  const head = languages.slice(0, max - 1);
  const tail = languages.slice(max - 1);
  const otherFiles = tail.reduce((acc, l) => acc + l.files, 0);
  const otherBytes = tail.reduce((acc, l) => acc + l.bytes, 0);
  const otherPercent = tail.reduce((acc, l) => acc + l.percent, 0);
  return [
    ...head,
    {
      language: "Other",
      files: otherFiles,
      bytes: otherBytes,
      percent: otherPercent,
    },
  ];
}
