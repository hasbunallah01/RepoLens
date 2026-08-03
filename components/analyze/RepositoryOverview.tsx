import { CheckCircleIcon } from "@/components/icons";
import { RepositoryStats } from "./RepositoryStats";
import type { RepoMetadata } from "@/types/repository";

interface RepositoryOverviewProps {
  metadata: RepoMetadata;
  totalFiles: number;
  totalDirectories: number;
  linesOfCode: string;
}

/**
 * "Repository Overview" card: identity, description, URL, and the stat grid.
 */
export function RepositoryOverview({
  metadata,
  totalFiles,
  totalDirectories,
  linesOfCode,
}: RepositoryOverviewProps) {
  const initial = metadata.owner.charAt(0).toUpperCase();

  return (
    <div className="flex h-full flex-col rounded-2xl border border-slate-100 bg-white p-5 shadow-sm shadow-slate-100">
      <h3 className="text-sm font-bold text-brand-navy">Repository Overview</h3>

      <div className="mt-4 flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-navy text-sm font-bold text-white">
          {initial}
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <h4 className="truncate text-sm font-bold text-brand-navy">{metadata.fullName}</h4>
            <CheckCircleIcon className="h-4 w-4 shrink-0 text-brand-teal" aria-label="Analyzed" />
          </div>
          {metadata.description ? (
            <p className="mt-0.5 text-xs leading-relaxed text-slate-500">{metadata.description}</p>
          ) : null}
          <a
            href={metadata.htmlUrl}
            target="_blank"
            rel="noreferrer noopener"
            className="mt-1 block truncate text-xs text-brand-teal hover:underline"
          >
            {metadata.htmlUrl.replace(/^https?:\/\//, "")}
          </a>
        </div>
      </div>

      <RepositoryStats
        stars={metadata.stars}
        forks={metadata.forks}
        totalFiles={totalFiles}
        totalDirectories={totalDirectories}
        linesOfCode={linesOfCode}
        primaryLanguage={metadata.primaryLanguage}
      />
    </div>
  );
}
