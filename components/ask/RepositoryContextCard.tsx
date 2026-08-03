import { CalendarIcon, CodeIcon, FileIcon, GlobeIcon, LayersIcon } from "@/components/icons";
import { MOCK_REPO_CONTEXT } from "@/lib/mock-ask-data";

/**
 * "Repository Context" sidebar card — key indexing figures.
 *
 * Indexed Files lines up with RepoIndex.totalFiles; the rest (Code Lines,
 * Languages, Last Indexed, Repository Size) have no backend field yet —
 * see PR notes.
 */
export function RepositoryContextCard() {
  const rows = [
    { icon: <FileIcon className="h-4 w-4 text-slate-400" />, label: "Indexed Files", value: MOCK_REPO_CONTEXT.indexedFiles.toLocaleString() },
    { icon: <CodeIcon className="h-4 w-4 text-slate-400" />, label: "Code Lines", value: MOCK_REPO_CONTEXT.codeLines },
    { icon: <GlobeIcon className="h-4 w-4 text-slate-400" />, label: "Languages", value: String(MOCK_REPO_CONTEXT.languageCount) },
    { icon: <CalendarIcon className="h-4 w-4 text-slate-400" />, label: "Last Indexed", value: MOCK_REPO_CONTEXT.lastIndexed },
    { icon: <LayersIcon className="h-4 w-4 text-slate-400" />, label: "Repository Size", value: MOCK_REPO_CONTEXT.repositorySize },
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
