"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Github, Rocket } from "lucide-react";
import { cn } from "@/lib/utils";

const EXAMPLES = ["vercel/next.js", "facebook/react", "microsoft/vscode"];

interface SearchBarProps {
  className?: string;
  /** Placeholder text for the input. */
  placeholder?: string;
  /** Show the "Try these examples" chips. Defaults to true. */
  showExamples?: boolean;
}

/**
 * Hero search bar: paste a GitHub repo URL and analyze.
 * Stacks vertically on mobile, inline on larger screens.
 */
export function SearchBar({
  className,
  placeholder = "Paste a GitHub repository URL...",
  showExamples = true,
}: SearchBarProps) {
  const router = useRouter();
  const [value, setValue] = useState("");

  const go = (repo: string) => {
    const q = repo.trim();
    if (!q) return;
    router.push(`/analyze?url=${encodeURIComponent(q)}`);
  };

  return (
    <div className={cn("w-full", className)}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          go(value);
        }}
        className="flex flex-col gap-3 sm:flex-row"
      >
        <div className="relative flex-1">
          <Github className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={placeholder}
            aria-label="GitHub repository URL"
            className="w-full rounded-xl border border-border bg-card py-3.5 pl-12 pr-4 text-sm text-brand-navy shadow-soft outline-none transition placeholder:text-muted-foreground focus:border-brand-teal focus:ring-2 focus:ring-brand-teal/20"
          />
        </div>
        <button
          type="submit"
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-brand-teal px-6 py-3.5 text-sm font-semibold text-white shadow-soft transition-colors hover:bg-brand-teal-600"
        >
          <Rocket className="h-4 w-4" />
          Analyze Repository
        </button>
      </form>

      {showExamples && (
        <div className="mt-4">
          <p className="mb-2 text-sm font-medium text-brand-navy/70">
            Try these examples
          </p>
          <div className="flex flex-wrap gap-2">
            {EXAMPLES.map((ex) => (
              <button
                key={ex}
                type="button"
                onClick={() => go(ex)}
                className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-3.5 py-2 text-sm font-medium text-brand-navy/80 shadow-soft transition-colors hover:border-brand-teal/40 hover:text-brand-navy"
              >
                <Github className="h-4 w-4 text-muted-foreground" />
                {ex}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
