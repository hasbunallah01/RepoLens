"use client";

import { useEffect, useRef, useState } from "react";
import { ClockIcon, PulseIcon } from "@/components/icons";
import { ANALYSIS_STEPS, MOCK_EXTRA_STATS } from "@/lib/mock-analyze-data";

interface AnalysisProgressProps {
  onComplete: () => void;
  /** Total simulated duration in ms. Exposed for tests/tuning. */
  durationMs?: number;
}

type StepStatus = "done" | "active" | "pending";

/**
 * Animated "Analysis in Progress" card: staged steps, a progress bar,
 * an elapsed-time clock, and a live files-analyzed counter.
 *
 * This is a client-side simulation — the real /api/analyze endpoint
 * today resolves in a single round trip with no step-level progress
 * events. See PR notes for what the backend would need to stream this
 * for real (SSE/WebSocket progress events per pipeline stage).
 */
export function AnalysisProgress({ onComplete, durationMs = 6000 }: AnalysisProgressProps) {
  const [percent, setPercent] = useState(0);
  const [elapsedMs, setElapsedMs] = useState(0);
  const startRef = useRef<number>(Date.now());
  const doneRef = useRef(false);

  useEffect(() => {
    startRef.current = Date.now();
    const tick = setInterval(() => {
      const elapsed = Date.now() - startRef.current;
      setElapsedMs(elapsed);
      const pct = Math.min(100, Math.round((elapsed / durationMs) * 100));
      setPercent(pct);
      if (pct >= 100 && !doneRef.current) {
        doneRef.current = true;
        clearInterval(tick);
        setTimeout(onComplete, 500);
      }
    }, 80);
    return () => clearInterval(tick);
  }, [durationMs, onComplete]);

  const getStatus = (i: number): StepStatus => {
    const threshold = ((i + 1) / ANALYSIS_STEPS.length) * 100;
    const prevThreshold = (i / ANALYSIS_STEPS.length) * 100;
    if (percent >= threshold) return "done";
    if (percent >= prevThreshold) return "active";
    return "pending";
  };

  const filesAnalyzed = Math.min(
    MOCK_EXTRA_STATS.totalFiles,
    Math.round((percent / 100) * MOCK_EXTRA_STATS.totalFiles),
  );

  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm shadow-slate-100 sm:p-7">
      <div className="flex items-center gap-2.5">
        <PulseIcon className="h-5 w-5 text-brand-teal" />
        <div>
          <h2 className="text-base font-bold text-brand-navy">Analysis in Progress</h2>
          <p className="text-sm text-slate-500">
            RepoLens is scanning, indexing and understanding this repository.
          </p>
        </div>
      </div>

      {/* Desktop: horizontal steps with connectors */}
      <div className="mt-6 hidden items-center sm:flex">
        {ANALYSIS_STEPS.map((label, i) => (
          <div key={label} className="flex flex-1 items-center last:flex-none">
            <StepBadge index={i} status={getStatus(i)} label={label} />
            {i < ANALYSIS_STEPS.length - 1 ? (
              <div
                className={`mx-3 h-px flex-1 ${
                  getStatus(i) === "done" ? "bg-brand-teal" : "bg-slate-200"
                }`}
              />
            ) : null}
          </div>
        ))}
      </div>

      {/* Mobile: vertical checklist */}
      <div className="mt-6 flex flex-col gap-3 sm:hidden">
        {ANALYSIS_STEPS.map((label, i) => (
          <div key={label} className="flex items-center gap-2.5">
            <StatusIcon index={i} status={getStatus(i)} />
            <span
              className={
                getStatus(i) === "active"
                  ? "text-sm font-semibold text-brand-navy"
                  : getStatus(i) === "done"
                    ? "text-sm text-brand-navy"
                    : "text-sm text-slate-400"
              }
            >
              {label}
            </span>
          </div>
        ))}
      </div>

      <div className="mt-6 flex items-center gap-4">
        <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
          <div
            className="h-full rounded-full bg-brand-teal transition-[width] duration-150 ease-linear"
            style={{ width: `${percent}%` }}
          />
        </div>
        <span className="w-10 shrink-0 text-right text-sm font-semibold text-brand-navy">
          {percent}%
        </span>
      </div>

      <div className="mt-4 flex flex-col gap-1.5 text-sm text-slate-500 sm:flex-row sm:items-center sm:justify-between">
        <span className="inline-flex items-center gap-1.5">
          <ClockIcon className="h-4 w-4" />
          Elapsed time: {formatElapsed(elapsedMs)}
        </span>
        <span>
          Analyzing {filesAnalyzed.toLocaleString()} / {MOCK_EXTRA_STATS.totalFiles.toLocaleString()} files
        </span>
      </div>
    </div>
  );
}

function StepBadge({ index, status, label }: { index: number; status: StepStatus; label: string }) {
  return (
    <div className="flex items-center gap-2 whitespace-nowrap">
      <StatusIcon index={index} status={status} />
      <span
        className={
          status === "active"
            ? "text-sm font-semibold text-brand-navy"
            : status === "done"
              ? "text-sm text-brand-navy"
              : "text-sm text-slate-400"
        }
      >
        {label}
      </span>
    </div>
  );
}

function StatusIcon({ index, status }: { index: number; status: StepStatus }) {
  if (status === "done") {
    return (
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-teal text-white">
        <svg viewBox="0 0 24 24" fill="none" className="h-3.5 w-3.5" aria-hidden="true">
          <path d="m5 13 4 4 10-10" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
    );
  }
  if (status === "active") {
    return (
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-teal text-xs font-bold text-white">
        {index + 1}
      </span>
    );
  }
  return (
    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 border-slate-200 text-xs font-bold text-slate-400">
      {index + 1}
    </span>
  );
}

function formatElapsed(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}
