"use client";

import { GitHubIcon } from "@/components/icons";
import { EXAMPLE_REPOS } from "@/lib/mock-analyze-data";

interface ExampleRepositoriesProps {
  onSelect: (repo: string) => void;
  disabled?: boolean;
}

/**
 * Quick-pick example repository pills shown under the URL input.
 */
export function ExampleRepositories({ onSelect, disabled }: ExampleRepositoriesProps) {
  return (
    <div className="mt-5 flex flex-wrap items-center justify-center gap-2.5">
      {EXAMPLE_REPOS.map((repo) => (
        <button
          key={repo}
          type="button"
          disabled={disabled}
          onClick={() => onSelect(repo)}
          className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3.5 py-1.5 text-sm text-brand-navy transition-colors hover:border-brand-teal/40 hover:bg-brand-teal-50 disabled:pointer-events-none disabled:opacity-50"
        >
          <GitHubIcon className="h-3.5 w-3.5 text-slate-500" />
          {repo}
        </button>
      ))}
    </div>
  );
}
