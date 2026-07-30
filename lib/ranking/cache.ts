/**
 * Session-scoped cache for ranking results (Phase 3C2).
 *
 * Avoids recalculating the same question against the same candidate set
 * repeatedly during a browser session. Keys are a simple hash of
 * (question + sorted candidate paths). Values are the full RankResult.
 *
 * Client-only: uses sessionStorage so results survive route changes
 * within the tab but do not persist across browser restarts or users.
 */

import type { RankResult } from "@/types/ranking";

const KEY = "repolens:ranking-cache:v1";
const MAX_ENTRIES = 40;

interface CacheShape {
  entries: Record<string, RankResult>;
  /** Insertion order for simple LRU-ish eviction. */
  order: string[];
}

function readAll(): CacheShape {
  if (typeof window === "undefined") return { entries: {}, order: [] };
  try {
    const raw = window.sessionStorage.getItem(KEY);
    if (!raw) return { entries: {}, order: [] };
    const parsed = JSON.parse(raw) as Partial<CacheShape>;
    return {
      entries: parsed.entries ?? {},
      order: parsed.order ?? [],
    };
  } catch {
    return { entries: {}, order: [] };
  }
}

function writeAll(state: CacheShape): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* quota or disabled storage — silently drop */
  }
}

/**
 * Build a stable cache key from the question and the candidate file paths.
 * Paths are sorted so the same set of files always produces the same key
 * regardless of input order.
 */
export function rankingCacheKey(
  question: string,
  candidatePaths: ReadonlyArray<string>,
): string {
  const q = question.trim().toLowerCase();
  const paths = [...candidatePaths].sort().join("|");
  return `\( {q}:: \){paths}`;
}

export function rankingCacheGet(key: string): RankResult | null {
  if (typeof window === "undefined") return null;
  const all = readAll();
  return all.entries[key] ?? null;
}

export function rankingCacheSet(key: string, result: RankResult): void {
  if (typeof window === "undefined") return;
  const all = readAll();

  all.order = all.order.filter((k) => k !== key);
  all.order.push(key);
  all.entries[key] = result;

  while (all.order.length > MAX_ENTRIES) {
    const oldest = all.order.shift();
    if (oldest) delete all.entries[oldest];
  }

  writeAll(all);
}

export function rankingCacheClear(): void {
  if (typeof window === "undefined") return;
  writeAll({ entries: {}, order: [] });
      }
