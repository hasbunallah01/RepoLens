"use client";

import { useState, useId, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/Button";

const EXAMPLES = ["vercel/next.js", "facebook/react", "microsoft/vscode"];

/**
 * Landing-page repository quick-search. Lightweight, client-only: it just
 * hands off to the /analyze route, where the real validation + fetch
 * pipeline (RepoUrlInput, useRepoAnalysis) takes over.
 */
export function RepoQuickSearch() {
  const router = useRouter();
  const [value, setValue] = useState("");
  const inputId = useId();

  const goToAnalyze = () => router.push("/analyze");

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    goToAnalyze();
  };

  return (
    <div className="w-full">
      <form
        onSubmit={handleSubmit}
        className="flex w-full flex-col gap-3 rounded-xl border border-slate-200 bg-white p-2 shadow-sm shadow-slate-200/50 transition-colors focus-within:border-brand-teal/50 sm:flex-row sm:items-center sm:p-1.5"
      >
        <label htmlFor={inputId} className="sr-only">
          GitHub repository URL
        </label>
        <div className="flex flex-1 items-center gap-3 px-3">
          <GithubIcon className="h-5 w-5 shrink-0 text-slate-400" />
          <input
            id={inputId}
            type="text"
            inputMode="url"
            autoComplete="off"
            spellCheck={false}
            placeholder="Paste a GitHub repository URL…"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className="h-11 w-full bg-transparent text-sm text-brand-navy placeholder:text-slate-400 focus:outline-none"
          />
        </div>
        <Button type="submit" variant="brand" size="lg" className="w-full sm:w-auto">
          <SearchIcon className="h-4 w-4" />
          Analyze Repository
        </Button>
      </form>

      <div className="mt-4 flex flex-wrap items-center gap-2 text-sm">
        <span className="text-slate-400">Try these examples</span>
        {EXAMPLES.map((example) => (
          <button
            key={example}
            type="button"
            onClick={goToAnalyze}
            className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-600 transition-colors hover:border-brand-teal/40 hover:text-brand-navy"
          >
            <GithubIcon className="h-3.5 w-3.5 text-slate-400" />
            {example}
          </button>
        ))}
      </div>
    </div>
  );
}

function GithubIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
      <path d="M12 .5C5.65.5.5 5.65.5 12c0 5.08 3.29 9.39 7.86 10.91.58.11.79-.25.79-.55v-2.13c-3.2.7-3.87-1.37-3.87-1.37-.52-1.33-1.28-1.68-1.28-1.68-1.04-.72.08-.7.08-.7 1.15.08 1.76 1.18 1.76 1.18 1.03 1.77 2.7 1.26 3.36.96.1-.75.4-1.26.73-1.55-2.55-.29-5.24-1.28-5.24-5.69 0-1.26.45-2.29 1.18-3.1-.12-.29-.51-1.46.11-3.04 0 0 .96-.31 3.15 1.18a10.9 10.9 0 0 1 5.74 0c2.18-1.49 3.14-1.18 3.14-1.18.62 1.58.23 2.75.11 3.04.73.81 1.18 1.84 1.18 3.1 0 4.42-2.7 5.39-5.27 5.68.41.36.78 1.07.78 2.17v3.21c0 .31.21.67.8.55C20.21 21.39 23.5 17.08 23.5 12 23.5 5.65 18.35.5 12 .5Z" />
    </svg>
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
