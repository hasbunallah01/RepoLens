import type { ReactNode } from "react";
import { CodeIcon, FileIcon, ForkIcon, FolderIcon, StarIcon } from "@/components/icons";

interface RepositoryStatsProps {
  stars: number;
  forks: number;
  totalFiles: number;
  totalDirectories: number;
  linesOfCode: string;
  primaryLanguage: string | null;
}

/**
 * 2x3 stat grid used inside the Repository Overview card.
 *
 * `totalDirectories` and `linesOfCode` have no backend equivalent yet —
 * the real RepoIndex only tracks total file count and total byte size.
 * See PR notes for what the pipeline would need to add to compute these.
 */
export function RepositoryStats({
  stars,
  forks,
  totalFiles,
  totalDirectories,
  linesOfCode,
  primaryLanguage,
}: RepositoryStatsProps) {
  return (
    <div className="mt-4 grid grid-cols-3 gap-2.5">
      <StatBox icon={<StarIcon className="h-4 w-4 text-slate-400" />} value={formatCompact(stars)} label="Stars" />
      <StatBox icon={<ForkIcon className="h-4 w-4 text-slate-400" />} value={formatCompact(forks)} label="Forks" />
      <StatBox icon={<FileIcon className="h-4 w-4 text-slate-400" />} value={totalFiles.toLocaleString()} label="Files" />
      <StatBox icon={<FolderIcon className="h-4 w-4 text-slate-400" />} value={totalDirectories.toLocaleString()} label="Directories" />
      <StatBox icon={<CodeIcon className="h-4 w-4 text-slate-400" />} value={linesOfCode} label="Lines of Code" />
      <StatBox value={primaryLanguage ?? "—"} label="Primary Language" />
    </div>
  );
}

function StatBox({ icon, value, label }: { icon?: ReactNode; value: string; label: string }) {
  return (
    <div className="rounded-lg border border-slate-100 p-3">
      <div className="flex items-center gap-1.5">
        {icon}
        <span className="text-sm font-bold text-brand-navy">{value}</span>
      </div>
      <p className="mt-1 text-xs text-slate-500">{label}</p>
    </div>
  );
}

function formatCompact(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(n % 1000 === 0 ? 0 : 1)}k`;
  return n.toLocaleString();
}
