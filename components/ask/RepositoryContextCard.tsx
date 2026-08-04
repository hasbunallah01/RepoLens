"use client";

import { CalendarIcon, CodeIcon, FileIcon, GlobeIcon, LayersIcon } from "@/components/icons";

interface RepositoryContextCardProps {
  indexedFiles: number;
  codeLines: number;
  languageCount: number;
  lastIndexed: string;
  repositorySize: string;
}

export function RepositoryContextCard({
  indexedFiles,
  codeLines,
  languageCount,
  lastIndexed,
  repositorySize,
}: RepositoryContextCardProps) {
  const rows = [
    { icon: <FileIcon className="h-4 w-4 text-slate-400" />, label: "Indexed Files", value: indexedFiles.toLocaleString() },
    { icon: <CodeIcon className="h-4 w-4 text-slate-400" />, label: "Code Lines", value: codeLines.toLocaleString() },
    { icon: <GlobeIcon className="h-4 w-4 text-slate-400" />, label: "Languages", value: String(languageCount) },
    { icon: <CalendarIcon className="h-4 w-4 text-slate-400" />, label: "Last Indexed", value: lastIndexed },
    { icon: <LayersIcon className="h-4 w-4 text-slate-400" />, label: "Repository Size", value: repositorySize },
  ];

  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm shadow-slate-100">
      <h3 className="text-sm font-bold text-brand-navy">Repository Context</h3>
      <p className="mt-0.5 text-xs text-slate-500">Key information about this repository</p>

      <dl className="mt-4 space-y-3">
        {rows.map((row) => (
          <div key={row.label} className="flex items-center justify-between text-sm">
            <dt className="flex items-center gap-2 text-slate-500">
              {row.icon}
              {row.label}
            </dt>
            <dd className="font-semibold text-brand-navy">{row.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
