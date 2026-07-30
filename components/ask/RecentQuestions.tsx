"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import type { RecentQuestion } from "@/types/question";

interface RecentQuestionsProps {
  questions: RecentQuestion[];
  /** Called when the user clicks a recent question to re-ask it. */
  onSelect?: (q: RecentQuestion) => void;
  className?: string;
}

/**
 * Sidebar list of recent questions (mock data in Phase 3A).
 *
 * Pure presentation: clicking a question calls `onSelect`; the parent
 * decides what to do with it (typically: copy into the textarea).
 */
export function RecentQuestions({ questions, onSelect, className }: RecentQuestionsProps) {
  const [filter, setFilter] = useState<"all" | "today" | "week">("all");

  const filtered = filterQuestions(questions, filter);

  return (
    <section
      className={cn(
        "flex h-full flex-col rounded-2xl border border-navy-800/70 bg-navy-900/50 p-5 shadow-lg shadow-black/20",
        className,
      )}
      aria-label="Recent questions"
    >
      <header className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-emerald-500/10 text-emerald-400 ring-1 ring-emerald-500/20">
            <HistoryIcon className="h-4 w-4" />
          </span>
          <div>
            <h2 className="text-sm font-semibold text-white sm:text-base">Recent questions</h2>
            <p className="text-[11px] text-navy-400">
              {questions.length} mock entr{questions.length === 1 ? "y" : "ies"} · click to re-ask
            </p>
          </div>
        </div>
        <FilterTabs value={filter} onChange={setFilter} />
      </header>

      <div className="mt-4 flex-1 overflow-y-auto pr-1">
        {filtered.length === 0 ? (
          <EmptyState />
        ) : (
          <ul className="space-y-2.5">
            {filtered.map((q) => (
              <li key={q.id}>
                <button
                  type="button"
                  onClick={() => onSelect?.(q)}
                  className={cn(
                    "group block w-full rounded-lg border border-navy-800/70 bg-navy-950/40 p-3 text-left",
                    "transition-all hover:border-emerald-500/40 hover:bg-navy-900/60",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 focus-visible:ring-offset-navy-950",
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="line-clamp-2 text-sm font-medium text-navy-50 group-hover:text-white">
                      {q.prompt}
                    </p>
                    {typeof q.tokensSaved === "number" ? (
                      <span
                        className="shrink-0 rounded-md bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-mono font-medium text-emerald-300 ring-1 ring-emerald-500/20"
                        title="Tokens saved (mock)"
                      >
                        −{q.tokensSaved.toLocaleString()}t
                      </span>
                    ) : null}
                  </div>

                  {q.preview ? (
                    <p className="mt-1.5 line-clamp-2 text-xs text-navy-300">{q.preview}</p>
                  ) : null}

                  <div className="mt-2 flex items-center justify-between gap-2 text-[11px] text-navy-400">
                    <span className="inline-flex items-center gap-1 font-mono">
                      <RepoIcon className="h-3 w-3" />
                      {q.repo}
                    </span>
                    <time dateTime={q.askedAt} className="font-mono">
                      {formatRelative(q.askedAt)}
                    </time>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <footer className="mt-4 flex items-center justify-between border-t border-navy-800/70 pt-3 text-[11px] text-navy-400">
        <span className="inline-flex items-center gap-1.5">
          <SparklesIcon className="h-3.5 w-3.5 text-emerald-400" />
          Mock data · Phase 3A
        </span>
        <span className="font-mono">session · local</span>
      </footer>
    </section>
  );
}

function FilterTabs({
  value,
  onChange,
}: {
  value: "all" | "today" | "week";
  onChange: (v: "all" | "today" | "week") => void;
}) {
  const options: { value: "all" | "today" | "week"; label: string }[] = [
    { value: "all", label: "All" },
    { value: "today", label: "Today" },
    { value: "week", label: "Week" },
  ];
  return (
    <div
      role="tablist"
      aria-label="Filter recent questions"
      className="inline-flex items-center gap-1 rounded-md border border-navy-800 bg-navy-950/60 p-0.5"
    >
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(opt.value)}
            className={cn(
              "rounded px-2 py-1 text-[11px] font-medium transition-colors",
              active ? "bg-emerald-500/15 text-emerald-300" : "text-navy-300 hover:text-white",
            )}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="rounded-lg border border-dashed border-navy-800/80 bg-navy-950/30 p-6 text-center">
      <p className="text-sm text-navy-300">No questions in this window yet.</p>
      <p className="mt-1 text-xs text-navy-500">Ask your first question to populate this list.</p>
    </div>
  );
}

function filterQuestions(
  questions: RecentQuestion[],
  filter: "all" | "today" | "week",
): RecentQuestion[] {
  if (filter === "all") return questions;
  const now = Date.now();
  const windowMs = filter === "today" ? 24 * 60 * 60 * 1000 : 7 * 24 * 60 * 60 * 1000;
  return questions.filter((q) => {
    const t = Date.parse(q.askedAt);
    if (!Number.isFinite(t)) return false;
    return now - t <= windowMs;
  });
}

function formatRelative(iso: string): string {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return iso;
  const diffMs = Date.now() - t;
  const m = Math.floor(diffMs / 60_000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  const w = Math.floor(d / 7);
  if (w < 5) return `${w}w ago`;
  return new Date(t).toLocaleDateString();
}

function HistoryIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" aria-hidden="true">
      <path
        d="M3 12a9 9 0 1 0 3-6.7M3 3v6h6M12 7v5l3 2"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function RepoIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" aria-hidden="true">
      <path
        d="M4 6.5A2.5 2.5 0 0 1 6.5 4h11A2.5 2.5 0 0 1 20 6.5v8a2.5 2.5 0 0 1-2.5 2.5h-7L6 21v-4H6.5A2.5 2.5 0 0 1 4 14.5v-8Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function SparklesIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" aria-hidden="true">
      <path
        d="M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M5.6 18.4l2.8-2.8M15.6 8.4l2.8-2.8"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}
