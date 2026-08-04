"use client";

import { ChevronRightIcon, FileIcon, FolderIcon } from "@/components/icons";

export interface TopFileItem {
  path: string;
  lines?: number;
  relevance?: number;
}

interface TopFilesCardProps {
  files: TopFileItem[];
  onViewAll?: () => void;
}

export function TopFilesCard({ files, onViewAll }: TopFilesCardProps) {
  const visibleFiles = files.slice(0, 5);

  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm shadow-slate-100">
      <h3 className="text-sm font-bold text-brand-navy">Top Files</h3>
      <p className="mt-0.5 text-xs text-slate-500">Most relevant files in this repository</p>

      <ul className="mt-4 space-y-2.5">
        {visibleFiles.map((file, index) => (
          <li key={file.path} className="flex items-center gap-2 text-sm">
            <FileIcon className="h-4 w-4 shrink-0 text-slate-400" />
            <span className="min-w-0 flex-1 truncate text-brand-navy">{file.path}</span>
            <span className="shrink-0 text-xs text-slate-400">{formatLines(file.lines ?? 0)} lines</span>
            <span className="shrink-0 rounded-full bg-brand-teal-50 px-2 py-0.5 text-xs font-semibold text-brand-teal">
              {file.relevance ?? Math.max(100 - index * 10, 25)}%
            </span>
          </li>
        ))}
      </ul>

      <button
        type="button"
        onClick={onViewAll}
        disabled={!onViewAll}
        className="mt-4 flex w-full items-center justify-between rounded-lg border border-slate-100 px-3 py-2 text-sm font-medium text-brand-navy transition-colors hover:border-brand-teal/40 hover:bg-brand-teal-50 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <span className="flex items-center gap-2">
          <FolderIcon className="h-4 w-4 text-brand-teal" />
          View All Files
        </span>
        <ChevronRightIcon className="h-4 w-4 text-slate-400" />
      </button>
    </div>
  );
}

function formatLines(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return n.toLocaleString();
}
