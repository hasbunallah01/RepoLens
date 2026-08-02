"use client";

import { useId, useState, type FormEvent } from "react";
import { Button } from "@/components/Button";
import { GitHubIcon, SearchIcon } from "@/components/icons";
import { parseGitHubUrl } from "@/lib/github/parse-url";

interface RepositoryInputProps {
  onSubmit: (url: string) => void;
  disabled?: boolean;
  initialValue?: string;
}

/**
 * Repository URL input + "Analyze Repository" button.
 * Validates client-side with the same `parseGitHubUrl` used elsewhere,
 * then hands the raw URL up to the caller — no fetching here.
 */
export function RepositoryInput({ onSubmit, disabled, initialValue = "" }: RepositoryInputProps) {
  const [value, setValue] = useState(initialValue);
  const [error, setError] = useState<string | null>(null);
  const inputId = useId();

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const parsed = parseGitHubUrl(value);
    if (!parsed.ok) {
      setError(parsed.reason);
      return;
    }
    setError(null);
    onSubmit(parsed.value.raw);
  };

  return (
    <div className="mx-auto w-full max-w-2xl">
      <form onSubmit={handleSubmit} className="flex flex-col gap-3 sm:flex-row">
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
            placeholder="https://github.com/owner/repository"
            value={value}
            disabled={disabled}
            onChange={(e) => {
              setValue(e.target.value);
              if (error) setError(null);
            }}
            className="h-full w-full bg-transparent text-sm text-brand-navy placeholder:text-slate-400 focus:outline-none disabled:opacity-60"
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? `${inputId}-error` : undefined}
          />
        </div>
        <Button type="submit" size="lg" disabled={disabled} className="shrink-0">
          <SearchIcon className="h-4 w-4" />
          Analyze Repository
        </Button>
      </form>
      {error ? (
        <p id={`${inputId}-error`} className="mt-2 text-center text-sm text-red-500 sm:text-left" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
