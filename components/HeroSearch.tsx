"use client";

import { useRouter } from "next/navigation";
import { useId, useState, type FormEvent } from "react";
import { Button } from "@/components/Button";
import { GitHubIcon, RocketIcon } from "@/components/icons";
import { parseGitHubUrl } from "@/lib/github/parse-url";

const EXAMPLES = ["vercel/next.js", "facebook/react", "microsoft/vscode"];

/**
 * Hero repository search bar. Validates client-side, then hands off to the
 * existing /analyze flow via a deep-linked query param — no changes to the
 * analyze page itself.
 */
export function HeroSearch() {
  const router = useRouter();
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const inputId = useId();

  const goToAnalyze = (raw: string) => {
    const parsed = parseGitHubUrl(raw);
    if (!parsed.ok) {
      setError(parsed.reason);
      return;
    }
    setError(null);
    router.push(`/analyze?url=${encodeURIComponent(parsed.value.raw)}`);
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    goToAnalyze(value);
  };

  return (
    <div className="w-full">
      <form
        onSubmit={handleSubmit}
        className="flex w-full flex-col gap-3 sm:flex-row"
      >
        <label htmlFor={inputId} className="sr-only">
          GitHub repository URL
        </label>
        <div
          className={`flex h-12 flex-1 items-center gap-2.5 rounded-lg border bg-white px-4 transition-colors ${
            error ? "border-red-300" : "border-slate-200 focus-within:border-brand-teal"
          }`}
        >
          <GitHubIcon className="h-5 w-5 shrink-0 text-slate-400" />
          <input
            id={inputId}
            type="text"
            inputMode="url"
            autoComplete="off"
            spellCheck={false}
            placeholder="Paste a GitHub repository URL..."
            value={value}
            onChange={(e) => {
              setValue(e.target.value);
              if (error) setError(null);
            }}
            className="h-full w-full bg-transparent text-sm text-brand-navy placeholder:text-slate-400 focus:outline-none"
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? `${inputId}-error` : undefined}
          />
        </div>
        <Button type="submit" size="lg" className="shrink-0">
          <RocketIcon className="h-4 w-4" />
          Analyze Repository
        </Button>
      </form>

      {error ? (
        <p id={`${inputId}-error`} className="mt-2 text-sm text-red-500" role="alert">
          {error}
        </p>
      ) : null}

      <div className="mt-6">
        <p className="text-sm text-slate-500">Try these examples</p>
        <div className="mt-3 flex flex-wrap gap-2.5">
          {EXAMPLES.map((example) => (
            <button
              key={example}
              type="button"
              onClick={() => goToAnalyze(example)}
              className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3.5 py-1.5 text-sm text-brand-navy transition-colors hover:border-brand-teal/40 hover:bg-brand-teal-50"
            >
              <GitHubIcon className="h-3.5 w-3.5 text-slate-500" />
              {example}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
