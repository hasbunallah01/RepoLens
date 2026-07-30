import { StatusBadge } from "./StatusBadge";
import type { RepoMetadata } from "@/types/repository";

interface RepoHeaderProps {
  metadata: RepoMetadata;
  totalFiles: number;
}

/**
 * The big card at the top of the analysis result.
 * Shows identity, description, primary language, license, topics, and the
 * "Repository Indexed" status badge.
 */
export function RepoHeader({ metadata, totalFiles }: RepoHeaderProps) {
  return (
    <div className="rounded-2xl border border-navy-800/70 bg-navy-900/40 p-6 sm:p-8">
      <div className="flex flex-col gap-5">
        <div className="flex flex-wrap items-center gap-3">
          <StatusBadge totalFiles={totalFiles} />
          {metadata.isPrivate ? (
            <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-xs font-medium text-amber-300">
              Private
            </span>
          ) : null}
          {metadata.isArchived ? (
            <span className="rounded-full border border-navy-700 bg-navy-800 px-3 py-1 text-xs font-medium text-navy-200">
              Archived
            </span>
          ) : null}
        </div>

        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
            {metadata.fullName}
          </h1>
          {metadata.description ? (
            <p className="mt-2 max-w-3xl text-sm text-navy-200 sm:text-base">
              {metadata.description}
            </p>
          ) : (
            <p className="mt-2 text-sm italic text-navy-400">No description provided.</p>
          )}
        </div>

        <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Stat label="Stars" value={metadata.stars.toLocaleString()} />
          <Stat label="Forks" value={metadata.forks.toLocaleString()} />
          <Stat label="Watchers" value={metadata.watchers.toLocaleString()} />
          <Stat label="Last updated" value={formatDate(metadata.lastUpdated)} />
        </dl>

        <div className="flex flex-wrap gap-2 text-xs text-navy-200">
          {metadata.primaryLanguage ? <Pill>{metadata.primaryLanguage}</Pill> : null}
          {metadata.license ? <Pill>{metadata.license}</Pill> : null}
          <Pill>default branch: {metadata.defaultBranch}</Pill>
          {metadata.topics.slice(0, 8).map((t) => (
            <Pill key={t} accent>
              #{t}
            </Pill>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-3 pt-1">
          <a
            href={metadata.htmlUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-md border border-navy-700 bg-navy-900/60 px-3 py-1.5 text-sm text-navy-100 transition-colors hover:border-emerald-500/40 hover:text-white"
          >
            View on GitHub
            <ArrowIcon className="h-3.5 w-3.5" />
          </a>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-navy-800/60 bg-navy-950/40 p-3">
      <dt className="text-xs uppercase tracking-wide text-navy-400">{label}</dt>
      <dd className="mt-1 text-lg font-semibold text-white">{value}</dd>
    </div>
  );
}

function Pill({ children, accent = false }: { children: React.ReactNode; accent?: boolean }) {
  return (
    <span
      className={
        accent
          ? "rounded-full bg-emerald-500/10 px-2.5 py-1 text-emerald-300 ring-1 ring-emerald-500/20"
          : "rounded-full bg-navy-800/60 px-2.5 py-1 text-navy-200 ring-1 ring-navy-700"
      }
    >
      {children}
    </span>
  );
}

function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
  } catch {
    return iso;
  }
}

function ArrowIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path d="M7 17L17 7M9 7h8v8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
