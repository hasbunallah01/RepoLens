"use client";

import { useState, useId, type FormEvent } from "react";
import { Button } from "@/components/Button";
import { parseGitHubUrl } from "@/lib/github/parse-url";

interface RepoUrlInputProps {
  onAnalyze: (url: string) => void;
  loading: boolean;
  defaultValue?: string;
  /** Show an inline error coming back from the server. */
  serverError?: string | null;
}

/**
 * The hero input on the analyze page. Validates client-side
 * for instant feedback, defers heavy work to the parent.
 */
export function RepoUrlInput({ onAnalyze, loading, defaultValue = "", serverError }: RepoUrlInputProps) {
  const [value, setValue] = useState(defaultValue);
  const [clientError, setClientError] = useState<string | null>(null);
  const inputId = useId();

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const parsed = parseGitHubUrl(value);
    if (!parsed.ok) {
      setClientError(parsed.reason);
      return;
    }
    setClientError(null);
    onAnalyze(parsed.value.raw);
  };

  const error = clientError ?? serverError ?? null;

  return (
    <form onSubmit={handleSubmit} className="w-full">
      <label htmlFor={inputId} className="sr-only">
        GitHub repository URL
      </label>
      <div
        className={`flex w-full flex-col gap-3 rounded-xl border bg-navy-900/60 p-2 transition-colors sm:flex-row sm:items-center sm:p-1.5 ${
          error ? "border-red-500/60" : "border-navy-700 focus-within:border-emerald-500/60"
        }`}
      >
        <div className="flex flex-1 items-center gap-3 px-3">
          <GithubIcon className="h-5 w-5 shrink-0 text-navy-300" />
          <input
            id={inputId}
            type="url"
            inputMode="url"
            autoComplete="off"
            spellCheck={false}
            placeholder="https://github.com/owner/repository"
            value={value}
            onChange={(e) => {
              setValue(e.target.value);
              if (clientError) setClientError(null);
            }}
            disabled={loading}
            className="h-11 w-full bg-transparent text-sm text-white placeholder:text-navy-400 focus:outline-none disabled:opacity-60"
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? `${inputId}-error` : undefined}
          />
        </div>
        <Button
          type="submit"
          size="lg"
          className="w-full sm:w-auto"
          disabled={loading || value.trim().length === 0}
        >
          {loading ? "Analyzing…" : "Analyze"}
        </Button>
      </div>
      <div className="mt-3 min-h-[1.25rem] text-sm">
        {error ? (
          <p id={`${inputId}-error`} className="text-red-300" role="alert">
            {error}
          </p>
        ) : (
          <p className="text-navy-300">
            Try{" "}
            <button
              type="button"
              className="text-emerald-400 underline-offset-2 hover:underline"
              onClick={() => setValue("https://github.com/vercel/next.js")}
            >
              vercel/next.js
            </button>{" "}
            or{" "}
            <button
              type="button"
              className="text-emerald-400 underline-offset-2 hover:underline"
              onClick={() => setValue("https://github.com/facebook/react")}
            >
              facebook/react
            </button>
            .
          </p>
        )}
      </div>
    </form>
  );
}

function GithubIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
      <path d="M12 .5C5.65.5.5 5.65.5 12c0 5.08 3.29 9.39 7.86 10.91.58.11.79-.25.79-.55v-2.13c-3.2.7-3.87-1.37-3.87-1.37-.52-1.33-1.28-1.68-1.28-1.68-1.04-.72.08-.7.08-.7 1.15.08 1.76 1.18 1.76 1.18 1.03 1.77 2.7 1.26 3.36.96.1-.75.4-1.26.73-1.55-2.55-.29-5.24-1.28-5.24-5.69 0-1.26.45-2.29 1.18-3.1-.12-.29-.51-1.46.11-3.04 0 0 .96-.31 3.15 1.18a10.9 10.9 0 0 1 5.74 0c2.18-1.49 3.14-1.18 3.14-1.18.62 1.58.23 2.75.11 3.04.73.81 1.18 1.84 1.18 3.1 0 4.42-2.7 5.39-5.27 5.68.41.36.78 1.07.78 2.17v3.21c0 .31.21.67.8.55C20.21 21.39 23.5 17.08 23.5 12 23.5 5.65 18.35.5 12 .5Z" />
    </svg>
  );
}
