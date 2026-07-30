"use client";

import { cn } from "@/lib/utils";
import type { RankedFile, RankResult } from "@/types/ranking";

interface RankingResultsProps {
  result: RankResult | null;
  loading?: boolean;
  className?: string;
}

/**
 * Ranking results panel (Phase 3C2).
 *
 * Renders a clean, developer-focused card for every ranked file with:
 *   - Rank badge (#1, #2, …)
 *   - Relevance score badge (0–100)
 *   - File icon
 *   - File name + path
 *   - Short deterministic explanation
 *
 * Responsive and polished; no AI involved.
 */
export function RankingResults({
  result,
  loading = false,
  className,
}: RankingResultsProps) {
  if (loading) {
    return (
      <section
        className={cn(
          "rounded-2xl border border-navy-800/70 bg-navy-900/50 p-5 shadow-lg shadow-black/20 sm:p-6",
          className,
        )}
        aria-busy="true"
        aria-label="Ranking results loading"
      >
        <Header count={null} total={null} />
        <div className="mt-4 space-y-3">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="h-[88px] animate-pulse rounded-xl border border-navy-800/60 bg-navy-950/40"
            />
          ))}
        </div>
      </section>
    );
  }

  if (!result) return null;

  const { ranked, totalCandidates, question } = result;

  return (
    <section
      className={cn(
        "rounded-2xl border border-navy-800/70 bg-navy-900/50 p-5 shadow-lg shadow-black/20 sm:p-6",
        className,
      )}
      aria-label="Ranking results"
    >
      <Header count={ranked.length} total={totalCandidates} />

      {ranked.length === 0 ? (
        <EmptyState question={question} />
      ) : (
        <ul className="mt-4 flex flex-col gap-3">
          {ranked.map((item, index) => (
            <li key={item.file.path}>
              <ResultCard item={item} rank={index + 1} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function Header({
  count,
  total,
}: {
  count: number | null;
  total: number | null;
}) {
  return (
    <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
      <div className="flex items-center gap-2">
        <span className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-emerald-500/10 text-emerald-400 ring-1 ring-emerald-500/20">
          <RankIcon className="h-4 w-4" />
        </span>
        <div>
          <h2 className="text-base font-semibold text-white sm:text-lg">
            Ranked files
          </h2>
          <p className="text-xs text-navy-300 sm:text-sm">
            Transparent relevance ranking — no AI, just signals.
          </p>
        </div>
      </div>
      {count !== null && total !== null ? (
        <span className="mt-2 font-mono text-xs text-navy-400 sm:mt-0">
          {count} of {total.toLocaleString()} candidates
        </span>
      ) : null}
    </div>
  );
}

function EmptyState({ question }: { question: string }) {
  return (
    <div className="mt-6 rounded-xl border border-dashed border-navy-700 bg-navy-950/40 px-4 py-8 text-center">
      <p className="text-sm text-navy-200">
        No files ranked for this question.
      </p>
      <p className="mt-1 font-mono text-xs text-navy-500">
        {truncate(question, 80)}
      </p>
    </div>
  );
}

function ResultCard({
  item,
  rank,
}: {
  item: RankedFile;
  rank: number;
}) {
  const { file, score, reason } = item;
  const scoreTone = scoreToneClass(score);

  return (
    <article
      className={cn(
        "group relative rounded-xl border border-navy-800/70 bg-navy-950/50 p-4",
        "transition-colors hover:border-emerald-500/30 hover:bg-navy-950/80",
      )}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:gap-4">
        {/* Rank + score badges */}
        <div className="flex shrink-0 items-center gap-2">
          <span
            className={cn(
              "inline-flex h-8 min-w-[2rem] items-center justify-center rounded-lg px-2",
              "font-mono text-xs font-semibold ring-1",
              rank === 1
                ? "bg-emerald-500/15 text-emerald-300 ring-emerald-500/40"
                : rank === 2
                  ? "bg-navy-800 text-navy-100 ring-navy-600"
                  : "bg-navy-900 text-navy-300 ring-navy-700",
            )}
            aria-label={`Rank ${rank}`}
          >
            #{rank}
          </span>
          <span
            className={cn(
              "inline-flex h-8 min-w-[3rem] items-center justify-center rounded-lg px-2",
              "font-mono text-xs font-semibold ring-1",
              scoreTone,
            )}
            aria-label={`Relevance score ${score}`}
            title="Relevance score (0–100)"
          >
            {score}
          </span>
        </div>

        {/* File info */}
        <div className="min-w-0 flex-1">
          <div className="flex items-start gap-2.5">
            <span className="mt-0.5 shrink-0 text-navy-400">
              <FileIcon extension={file.extKey} className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-white">
                {file.name}
              </p>
              <p
                className="mt-0.5 truncate font-mono text-[11px] text-navy-400"
                title={file.path}
              >
                {file.path}
              </p>
            </div>
          </div>

          {/* Explanation */}
          <p className="mt-2.5 text-xs leading-relaxed text-navy-200 sm:text-[13px]">
            <span className="mr-1.5 inline-flex items-center rounded bg-navy-800/80 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider text-navy-300">
              why
            </span>
            {reason}
          </p>
        </div>
      </div>
    </article>
  );
}

function scoreToneClass(score: number): string {
  if (score >= 80) {
    return "bg-emerald-500/15 text-emerald-300 ring-emerald-500/40";
  }
  if (score >= 50) {
    return "bg-amber-500/10 text-amber-300 ring-amber-500/30";
  }
  return "bg-navy-800 text-navy-200 ring-navy-600";
}

function truncate(s: string, n: number): string {
  if (s.length <= n) return s;
  return `${s.slice(0, n - 1)}…`;
}

function RankIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" aria-hidden="true">
      <path
        d="M4 17h4v3H4v-3ZM10 11h4v9h-4v-9ZM16 7h4v13h-4V7Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path
        d="M4 10 10 4l4 4 6-6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function FileIcon({
  extension,
  className,
}: {
  extension: string;
  className?: string;
}) {
  void extension;
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" aria-hidden="true">
      <path
        d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path
        d="M14 2v6h6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
    </svg>
  );
}
