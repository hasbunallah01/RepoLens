import {
  CalendarIcon,
  CheckCircleIcon,
  CodeIcon,
  ExternalLinkIcon,
  ForkIcon,
  StarIcon,
} from "@/components/icons";
import type { RepoMetadata } from "@/types/repository";

interface AskRepoSummaryProps {
  metadata: RepoMetadata;
}

/**
 * Repository identity strip shown at the top of /ask: avatar, name,
 * description, key stats, and a link back to GitHub.
 */
export function AskRepoSummary({ metadata }: AskRepoSummaryProps) {
  const initial = metadata.owner.charAt(0).toUpperCase();
  const updated = relativeDays(metadata.lastUpdated);

  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm shadow-slate-100 sm:p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-brand-navy text-base font-bold text-white">
            {initial}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <h1 className="truncate text-base font-bold text-brand-navy">{metadata.fullName}</h1>
              <CheckCircleIcon className="h-4 w-4 shrink-0 text-brand-teal" aria-label="Analyzed" />
            </div>
            {metadata.description ? (
              <p className="mt-0.5 text-sm text-slate-500">{metadata.description}</p>
            ) : null}
          </div>
        </div>

        <div className="flex flex-wrap items-stretch gap-2.5">
          <StatChip icon={<StarIcon className="h-4 w-4 text-slate-400" />} value={formatCompact(metadata.stars)} label="Stars" />
          <StatChip icon={<ForkIcon className="h-4 w-4 text-slate-400" />} value={formatCompact(metadata.forks)} label="Forks" />
          <StatChip
            icon={<CodeIcon className="h-4 w-4 text-slate-400" />}
            value={metadata.primaryLanguage ?? "—"}
            label="Primary Language"
            className="hidden sm:flex"
          />
          <StatChip
            icon={<CalendarIcon className="h-4 w-4 text-slate-400" />}
            value={updated}
            label="Updated"
            className="hidden sm:flex"
          />
          {/* Compact language badge shown only on the narrowest widths */}
          <span className="flex items-center rounded-lg border border-slate-100 px-3 py-2 text-xs font-bold text-brand-teal sm:hidden">
            {metadata.primaryLanguage?.slice(0, 2).toUpperCase() ?? "—"}
          </span>
          <a
            href={metadata.htmlUrl}
            target="_blank"
            rel="noreferrer noopener"
            className="hidden shrink-0 items-center gap-1.5 rounded-lg border border-slate-200 px-3.5 py-2 text-sm font-medium text-brand-navy transition-colors hover:border-brand-teal/40 hover:bg-brand-teal-50 sm:flex"
          >
            View Repository
            <ExternalLinkIcon className="h-3.5 w-3.5 text-slate-400" />
          </a>
        </div>
      </div>
    </div>
  );
}

function StatChip({
  icon,
  value,
  label,
  className,
}: {
  icon: React.ReactNode;
  value: string;
  label: string;
  className?: string;
}) {
  return (
    <div
      className={`${className ?? "flex"} min-w-[92px] items-center gap-2 rounded-lg border border-slate-100 px-3 py-2`}
    >
      {icon}
      <div className="leading-tight">
        <p className="text-sm font-bold text-brand-navy">{value}</p>
        <p className="text-[11px] text-slate-500">{label}</p>
      </div>
    </div>
  );
}

function formatCompact(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(n % 1000 === 0 ? 0 : 1)}k`;
  return n.toLocaleString();
}

function relativeDays(iso: string): string {
  const days = Math.round((Date.now() - new Date(iso).getTime()) / (1000 * 60 * 60 * 24));
  if (days <= 0) return "today";
  if (days === 1) return "1 day ago";
  return `${days} days ago`;
}
