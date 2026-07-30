/**
 * Tiny in-memory cache for analysis results.
 *
 * Scope: one process, one session. Survives route changes in the browser
 * because we store the latest result on `window`. Each entry is keyed
 * by the canonical `owner/repo` pair.
 *
 * Deliberately not a `Map` singleton on the server side — this is
 * client-only state to avoid cache poisoning across users on a
 * serverless deploy.
 */

import type { AnalysisResult } from "@/types/repository";

const KEY = "repolens:cache:v1";

interface CacheShape {
  byRepo: Record<string, AnalysisResult>;
}

function readAll(): CacheShape {
  if (typeof window === "undefined") return { byRepo: {} };
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return { byRepo: {} };
    const parsed = JSON.parse(raw) as Partial<CacheShape>;
    return { byRepo: parsed.byRepo ?? {} };
  } catch {
    return { byRepo: {} };
  }
}

function writeAll(state: CacheShape): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* quota or disabled storage — silently drop */
  }
}

export function cacheGet(fullName: string): AnalysisResult | null {
  if (typeof window === "undefined") return null;
  const all = readAll();
  return all.byRepo[fullName] ?? null;
}

export function cacheSet(result: AnalysisResult): void {
  if (typeof window === "undefined") return;
  const all = readAll();
  all.byRepo[result.metadata.fullName] = result;
  writeAll(all);
}

export function cacheList(): AnalysisResult[] {
  if (typeof window === "undefined") return [];
  return Object.values(readAll().byRepo).sort(
    (a, b) => Date.parse(b.fetchedAt) - Date.parse(a.fetchedAt),
  );
}

export function cacheClear(): void {
  if (typeof window === "undefined") return;
  writeAll({ byRepo: {} });
}
