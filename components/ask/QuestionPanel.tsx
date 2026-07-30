"use client";

import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
  type KeyboardEvent,
} from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/Button";
import type { QuestionExample } from "@/types/question";

interface QuestionPanelProps {
  /** The repository label currently being asked about, e.g. "vercel/next.js". */
  repoLabel?: string | null;
  /** Maximum characters allowed in the textarea. */
  maxLength?: number;
  /**
   * Placeholder examples shown as clickable chips. They are also used as the
   * textarea placeholder (cycling or first example).
   */
  examples: QuestionExample[];
  /** Called when the user submits a non-empty question. */
  onAsk?: (question: string) => void;
  className?: string;
}

const SOFT_LIMIT = 0.8; // when the counter turns amber

/**
 * Developer-style question panel.
 *
 * - Large textarea with auto-grow up to a comfortable max height
 * - Character counter (color shifts as the user approaches the cap)
 * - Ask + Clear buttons
 * - Enter submits, Shift+Enter inserts a newline
 * - Click an example chip to populate the textarea
 *
 * NOTE: this is UI only in Phase 3A. The `onAsk` handler is the only
 * side-effect (a console log from the page) — no AI, no retrieval, no
 * Paritok. Those arrive in Phase 3B / 3C.
 */
export function QuestionPanel({
  repoLabel,
  maxLength = 1000,
  examples,
  onAsk,
  className,
}: QuestionPanelProps) {
  const [value, setValue] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [focused, setFocused] = useState(false);
  const textareaId = useId();
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  // Auto-grow the textarea as the user types — up to a max height so it
  // never takes over the whole viewport.
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 360)}px`;
  }, [value]);

  const ratio = value.length / maxLength;
  const counterTone = useMemo(() => {
    if (ratio >= 1) return "text-red-300";
    if (ratio >= SOFT_LIMIT) return "text-amber-300";
    return "text-navy-400";
  }, [ratio]);

  const trimmed = value.trim();
  const canSubmit = trimmed.length > 0 && trimmed.length <= maxLength && !submitting;

  const handleChange = useCallback(
    (e: ChangeEvent<HTMLTextAreaElement>) => {
      // Hard-cap at maxLength so the user can never exceed the limit.
      const next = e.target.value.slice(0, maxLength);
      setValue(next);
    },
    [maxLength],
  );

  const handleSubmit = useCallback(
    (e?: FormEvent) => {
      e?.preventDefault();
      if (!canSubmit) return;
      setSubmitting(true);
      // Simulate the smallest possible "submission" so the button has a
      // visible moment of feedback. In later phases this becomes a real
      // request to the backend.
      const submitted = trimmed;
      window.setTimeout(() => {
        onAsk?.(submitted);
        setSubmitting(false);
        setValue("");
      }, 180);
    },
    [canSubmit, onAsk, trimmed],
  );

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      // Enter submits, Shift+Enter inserts a newline. Ignore IME composition.
      if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
        e.preventDefault();
        handleSubmit();
      }
    },
    [handleSubmit],
  );

  const handleClear = useCallback(() => {
    setValue("");
    textareaRef.current?.focus();
  }, []);

  const handleExample = useCallback((prompt: string) => {
    setValue(prompt);
    textareaRef.current?.focus();
  }, []);

  return (
    <section
      className={cn(
        "rounded-2xl border border-navy-800/70 bg-navy-900/50 p-5 shadow-lg shadow-black/20 sm:p-6",
        "transition-colors focus-within:border-emerald-500/50",
        className,
      )}
      aria-label="Ask a question about the repository"
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {/* Header row */}
        <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-emerald-500/10 text-emerald-400 ring-1 ring-emerald-500/20">
                <AskIcon className="h-4 w-4" />
              </span>
              <h2 className="text-base font-semibold text-white sm:text-lg">
                Ask anything about {repoLabel ?? "this repository"}
              </h2>
            </div>
            <p className="mt-1 text-xs text-navy-300 sm:text-sm">
              Natural-language questions, grounded in the code.{" "}
              <span className="hidden text-navy-400 sm:inline">
                Press <Kbd>Enter</Kbd> to submit, <Kbd>Shift</Kbd>+<Kbd>Enter</Kbd> for a new line.
              </span>
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <span
              className={cn(
                "rounded-md border border-navy-800 bg-navy-950/60 px-2 py-1 font-mono",
                counterTone,
              )}
              aria-live="polite"
              aria-label={`${value.length} of ${maxLength} characters used`}
            >
              {value.length.toLocaleString()}/{maxLength.toLocaleString()}
            </span>
          </div>
        </div>

        {/* Textarea */}
        <div
          className={cn(
            "rounded-xl border bg-navy-950/60 transition-colors",
            focused
              ? "border-emerald-500/50 shadow-[0_0_0_3px_rgba(16,185,129,0.12)]"
              : "border-navy-800",
          )}
        >
          <div className="flex items-center justify-between border-b border-navy-800/70 px-3 py-1.5 text-[11px] text-navy-400">
            <div className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-red-400/70" />
              <span className="h-2 w-2 rounded-full bg-amber-400/70" />
              <span className="h-2 w-2 rounded-full bg-emerald-400/70" />
              <span className="ml-2 font-mono">question.md</span>
            </div>
            <div className="hidden items-center gap-2 sm:flex">
              <span className="font-mono">UTF-8</span>
              <span className="text-navy-700">·</span>
              <span className="font-mono">Markdown</span>
            </div>
          </div>
          <label htmlFor={textareaId} className="sr-only">
            Ask a question about the repository
          </label>
          <textarea
            id={textareaId}
            ref={textareaRef}
            value={value}
            onChange={handleChange}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            onKeyDown={handleKeyDown}
            placeholder={buildPlaceholder(examples)}
            rows={5}
            spellCheck={true}
            className={cn(
              "block w-full resize-none bg-transparent px-4 py-3 text-sm leading-relaxed text-white sm:text-[15px]",
              "placeholder:font-normal placeholder:text-navy-500 focus:outline-none",
              "min-h-[140px] sm:min-h-[160px]",
            )}
            aria-describedby={`${textareaId}-help`}
            maxLength={maxLength}
          />
          <div
            id={`${textareaId}-help`}
            className="flex flex-wrap items-center justify-between gap-2 border-t border-navy-800/70 bg-navy-950/40 px-3 py-2 text-[11px] text-navy-400"
          >
            <div className="flex items-center gap-3">
              <span className="inline-flex items-center gap-1">
                <KeyboardIcon className="h-3.5 w-3.5" />
                <Kbd>Enter</Kbd> submit
              </span>
              <span className="inline-flex items-center gap-1">
                <Kbd>Shift</Kbd>+<Kbd>Enter</Kbd> newline
              </span>
            </div>
            <span className="font-mono">
              lines {value.length === 0 ? 1 : value.split("\n").length}
            </span>
          </div>
        </div>

        {/* Example chips */}
        <div className="flex flex-col gap-2">
          <span className="text-xs font-medium uppercase tracking-wider text-navy-400">
            Try a question
          </span>
          <div className="flex flex-wrap gap-2">
            {examples.map((ex) => (
              <button
                key={ex.id}
                type="button"
                onClick={() => handleExample(ex.prompt)}
                className={cn(
                  "group inline-flex max-w-full items-center gap-2 rounded-full border border-navy-700 bg-navy-900/50 px-3 py-1.5 text-left text-xs text-navy-100",
                  "transition-colors hover:border-emerald-500/50 hover:bg-navy-900/80 hover:text-white",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 focus-visible:ring-offset-navy-950",
                )}
                title={ex.prompt}
              >
                {ex.category ? (
                  <span className="rounded bg-emerald-500/10 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider text-emerald-300">
                    {ex.category}
                  </span>
                ) : null}
                <span className="truncate">{ex.prompt}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Action row */}
        <div className="flex flex-col-reverse items-stretch gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2 text-xs text-navy-400">
            <ShieldIcon className="h-3.5 w-3.5 text-emerald-400" />
            <span>Answers will be grounded in the indexed code.</span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              size="md"
              onClick={handleClear}
              disabled={value.length === 0 || submitting}
            >
              Clear
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="md"
              disabled={!canSubmit}
              className="min-w-[120px]"
            >
              {submitting ? (
                <span className="inline-flex items-center gap-2">
                  <SpinnerIcon className="h-4 w-4" />
                  Asking…
                </span>
              ) : (
                <span className="inline-flex items-center gap-2">
                  <SendIcon className="h-4 w-4" />
                  Ask
                </span>
              )}
            </Button>
          </div>
        </div>
      </form>
    </section>
  );
}

function buildPlaceholder(examples: QuestionExample[]): string {
  // Use the first three example prompts as a rotating-feeling placeholder.
  const first = examples[0]?.prompt;
  if (!first) return "Ask anything about this repository…";
  return `e.g. ${first}`;
}

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="inline-flex h-4 min-w-[1rem] items-center justify-center rounded border border-navy-700 bg-navy-900 px-1 font-mono text-[10px] font-medium text-navy-200">
      {children}
    </kbd>
  );
}

function AskIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" aria-hidden="true">
      <path
        d="M21 12a9 9 0 1 1-3.51-7.13M21 4v5h-5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function SendIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" aria-hidden="true">
      <path
        d="M22 2 11 13M22 2l-7 20-4-9-9-4 20-7Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}

function KeyboardIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" aria-hidden="true">
      <rect x="2" y="6" width="20" height="12" rx="2" stroke="currentColor" strokeWidth="2" />
      <path
        d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M6 14h.01M10 14h.01M14 14h.01M18 14h.01M8 18h8"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function ShieldIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" aria-hidden="true">
      <path
        d="M12 3 4 6v6c0 4.5 3.4 8.4 8 9 4.6-.6 8-4.5 8-9V6l-8-3Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path
        d="m9 12 2 2 4-4"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function SpinnerIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={cn("animate-spin", className)}
      fill="none"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" strokeOpacity="0.3" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
