"use client";

import { useEffect, useRef, useState } from "react";
import { ClockIcon, PulseIcon } from "@/components/icons";
import { ANALYSIS_STEPS } from "@/lib/mock-analyze-data";

interface AnalysisProgressProps {
  onComplete: () => void;
  /**
   * Total file count used as the denominator for the "files
   * analyzed" counter. Defaults to a non-zero placeholder when no
   * data is in hand yet (e.g. before the first request resolves).
   */
  totalFiles?: number;
  /**
   * When `true`, the progress bar jumps to 100 % and `onComplete`
   * fires shortly after. Set this from the parent when the real
   * analysis response (or error) has arrived so the simulated
   * loading state yields to the real data without making the user
   * stare at a half-finished progress bar.
   */
  completed?: boolean;
  /** Total simulated duration in ms. Exposed for tests/tuning. */
  durationMs?: number;
}

type StepStatus = "done" | "active" | "pending";

/**
 * Animated "Analysis in Progress" card: staged steps, a progress bar,
 * an elapsed-time clock, and a live files-analyzed counter.
 *
 * The visual is a *client-side simulation*: the real `/api/analyze`
 * route resolves in a single round trip with no per-stage events.
 * We drive the steps off an elapsed-time fraction and let the parent
 * short-circuit the simulation the moment a real response (or error)
 * comes back via the `completed` prop — at which point the bar fills
 * to 100 % and `onComplete` fires.
 */
export function AnalysisProgress({
  onComplete,
  totalFiles,
  completed = false,
  durationMs = 6000,
}: AnalysisProgressProps) {
  const [percent, setPercent] = useState(0);
  const [elapsedMs, setElapsedMs] = useState(0);
  const startRef = useRef<number>(Date.now());
  const doneRef = useRef(false);

  // The denominator for the "files analyzed" counter. Until the
  // backend response arrives we have no real total; show 0/0 rather
  // than a fake number so the user knows the count is still pending.
  const fileDenominator = totalFiles ?? 0;

  // Simulated progress. Drives the visual bar / counter off
  // elapsed time, but only ever yields to the parent via the
  // `completed` prop — we never fire `onComplete` ourselves based
  // on a wall-clock duration, because the real backend may take
  // longer than the simulation (or finish sooner). Letting the
  // parent decide is what keeps the page from flashing an empty
  // "done" state ahead of the actual response.
  useEffect(() => {
    startRef.current = Date.now();
    const tick = setInterval(() => {
      const elapsed = Date.now() - startRef.current;
      setElapsedMs(elapsed);
      if (completed) return;
      const pct = Math.min(100, Math.round((elapsed / durationMs) * 100));
      setPercent(pct);
    }, 80);
    return () => clearInterval(tick);
  }, [durationMs, completed]);

  // When the parent says the real request is done, fill the bar and
  // call onComplete. Guarded so we only fire once per mount.
  useEffect(() => {
    if (!completed || doneRef.current) return;
    doneRef.current = true;
    setPercent(100);
    const t = setTimeout(() => onComplete(), 400);
    return () => clearTimeout(t);
  }, [completed, onComplete]);

  const getStatus = (i: number): StepStatus => {
    const threshold = ((i + 1) / ANALYSIS_STEPS.length) * 100;
    const prevThreshold = (i / ANALYSIS_STEPS.length) * 100;
    if (percent >= threshold) return "done";
    if (percent >= prevThreshold) return "active";
    return "pending";
  };

  const filesAnalyzed = Math.min(
    fileDenominator,
    Math.round((percent / 100) * fileDenominator),
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
          {fileDenominator > 0
            ? `Analyzing ${filesAnalyzed.toLocaleString()} / ${fileDenominator.toLocaleString()} files`
            : "Awaiting repository data…"}
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
