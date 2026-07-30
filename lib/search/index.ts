/**
 * Local, indexed repository search.
 *
 * Not AI. Just substring + facet matching over the {@link IndexedFile}
 * list produced by the indexer. Designed to be fast and predictable.
 */

import type { IndexedFile } from "@/types/repository";

export type SearchScope = "all" | "name" | "extension" | "folder" | "language";

export interface SearchOptions {
  /** Case-insensitive substring. Required. */
  query: string;
  /** Restrict which fields are matched. Defaults to "all". */
  scope?: SearchScope;
  /** Optional hard cap on results. Defaults to 200. */
  limit?: number;
}

const DEFAULT_LIMIT = 200;

function matchesScope(file: IndexedFile, q: string, scope: SearchScope): boolean {
  const needle = q.toLowerCase();
  switch (scope) {
    case "name":
      return file.name.toLowerCase().includes(needle);
    case "extension":
      return file.extKey.toLowerCase().includes(needle);
    case "folder":
      return file.folder.toLowerCase().includes(needle);
    case "language":
      return file.language.toLowerCase().includes(needle);
    case "all":
    default:
      return (
        file.name.toLowerCase().includes(needle) ||
        file.path.toLowerCase().includes(needle) ||
        file.extKey.toLowerCase().includes(needle) ||
        file.folder.toLowerCase().includes(needle) ||
        file.language.toLowerCase().includes(needle)
      );
  }
}

/** Simple relevance score so better matches float to the top. */
function score(file: IndexedFile, q: string, scope: SearchScope): number {
  const needle = q.toLowerCase();
  const name = file.name.toLowerCase();
  let s = 0;
  if (name === needle) s += 100;
  else if (name.startsWith(needle)) s += 50;
  else if (name.includes(needle)) s += 25;

  if (file.path.toLowerCase().includes(needle)) s += 10;
  if (file.extKey.toLowerCase() === needle) s += 20;
  if (file.folder.toLowerCase().includes(needle)) s += 5;
  if (file.language.toLowerCase().includes(needle)) s += 2;

  if (scope !== "all" && matchesScope(file, q, scope)) s += 15;
  return s;
}

export function searchFiles(files: IndexedFile[], opts: SearchOptions): IndexedFile[] {
  const q = opts.query.trim();
  if (!q) return [];
  const scope = opts.scope ?? "all";
  const limit = opts.limit ?? DEFAULT_LIMIT;

  const matches: { file: IndexedFile; s: number }[] = [];
  for (const f of files) {
    if (!matchesScope(f, q, scope)) continue;
    matches.push({ file: f, s: score(f, q, scope) });
  }
  matches.sort((a, b) => b.s - a.s || a.file.path.localeCompare(b.file.path));
  return matches.slice(0, limit).map((m) => m.file);
}

/** Build the per-folder file counts for the search summary. */
export function summarizeByFolder(files: IndexedFile[]): { folder: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const f of files) {
    const key = f.folder || "(root)";
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .map(([folder, count]) => ({ folder, count }))
    .sort((a, b) => b.count - a.count);
}
