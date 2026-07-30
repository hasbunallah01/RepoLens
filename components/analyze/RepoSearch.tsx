"use client";

import { useMemo, useState, useDeferredValue, useId } from "react";
import type { IndexedFile } from "@/types/repository";
import { searchFiles, type SearchScope } from "@/lib/search";

interface RepoSearchProps {
  files: IndexedFile[];
  extensions: string[];
}

const SCOPES: { value: SearchScope; label: string }[] = [
  { value: "all", label: "All" },
  { value: "name", label: "Name" },
  { value: "extension", label: "Extension" },
  { value: "folder", label: "Folder" },
  { value: "language", label: "Language" },
];

export function RepoSearch({ files, extensions }: RepoSearchProps) {
  const [query, setQuery] = useState("");
  const [scope, setScope] = useState<SearchScope>("all");
  const deferred = useDeferredValue(query);
  const inputId = useId();

  const results = useMemo(
    () => searchFiles(files, { query: deferred, scope, limit: 100 }),
    [files, deferred, scope],
  );

  const extensionHint = useMemo(() => extensions.slice(0, 12).join(", "), [extensions]);

  return (
    <section className="rounded-xl border border-navy-800/70 bg-navy-900/40 p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h3 className="text-sm font-semibold text-white">Search indexed files</h3>
        <span className="text-xs text-navy-400">
          {query ? `${results.length} match${results.length === 1 ? "" : "es"}` : "Local index · not AI"}
        </span>
      </div>

      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <label htmlFor={inputId} className="sr-only">
          Search
        </label>
        <div className="flex flex-1 items-center gap-2 rounded-md border border-navy-700 bg-navy-950/50 px-3 focus-within:border-emerald-500/60">
          <SearchIcon className="h-4 w-4 text-navy-400" />
          <input
            id={inputId}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={`Try a name, an extension (${extensionHint || "ts, py, md"}), or a folder…`}
            className="h-10 w-full bg-transparent text-sm text-white placeholder:text-navy-400 focus:outline-none"
            spellCheck={false}
            autoComplete="off"
          />
        </div>
        <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Search scope">
          {SCOPES.map((s) => {
            const active = s.value === scope;
            return (
              <button
                key={s.value}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setScope(s.value)}
                className={
                  active
                    ? "rounded-md bg-emerald-500/15 px-2.5 py-1.5 text-xs font-medium text-emerald-300 ring-1 ring-emerald-500/30"
                    : "rounded-md border border-navy-700 px-2.5 py-1.5 text-xs text-navy-200 hover:border-emerald-500/40 hover:text-white"
                }
              >
                {s.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-4">
        {!query ? (
          <p className="text-sm text-navy-400">
            Start typing to search across {files.length.toLocaleString()} indexed files.
          </p>
        ) : results.length === 0 ? (
          <p className="text-sm text-navy-400">No files match your search.</p>
        ) : (
          <ul className="divide-y divide-navy-800/70 rounded-md border border-navy-800/60 bg-navy-950/40">
            {results.map((f) => (
              <li
                key={f.path}
                className="flex items-center justify-between gap-3 px-3 py-2 text-sm hover:bg-navy-900/60"
              >
                <span className="min-w-0 truncate font-mono text-navy-100" title={f.path}>
                  {highlight(f.path, query)}
                </span>
                <span className="shrink-0 text-xs text-navy-400">{f.language}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

function highlight(text: string, q: string) {
  if (!q) return text;
  const lower = text.toLowerCase();
  const needle = q.toLowerCase();
  const idx = lower.indexOf(needle);
  if (idx < 0) return text;
  return (
    <>
      {text.slice(0, idx)}
      <span className="bg-emerald-500/20 text-emerald-200">
        {text.slice(idx, idx + q.length)}
      </span>
      {text.slice(idx + q.length)}
    </>
  );
}

function SearchIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" aria-hidden="true">
      <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
      <path d="M20 20L16.65 16.65" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
