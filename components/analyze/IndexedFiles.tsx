import { FileIcon } from "@/components/icons";
import type { IndexedFile } from "@/types/repository";

interface IndexedFilesProps {
  files: IndexedFile[];
}

/**
 * "Indexed Files" card. Not visible in the cropped reference screenshot,
 * but listed explicitly in the component spec — styled to match the other
 * result cards so it slots in cleanly.
 */
export function IndexedFiles({ files }: IndexedFilesProps) {
  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm shadow-slate-100">
      <h3 className="text-sm font-bold text-brand-navy">Indexed Files</h3>
      <ul className="mt-4 max-h-64 space-y-1 overflow-y-auto">
        {files.map((file) => (
          <li
            key={file.path}
            className="flex items-center gap-2 rounded-md px-1.5 py-1.5 text-sm transition-colors hover:bg-slate-50"
          >
            <FileIcon className="h-4 w-4 shrink-0 text-slate-400" />
            <span className="min-w-0 flex-1 truncate text-brand-navy">{file.path}</span>
            <span className="shrink-0 rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[11px] uppercase text-slate-500">
              {file.extKey || file.language}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
