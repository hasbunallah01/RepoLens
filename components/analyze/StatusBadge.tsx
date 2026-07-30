/**
 * "Repository Indexed" status badge shown in the result header.
 */
export function StatusBadge({ totalFiles }: { totalFiles: number }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-300">
      <span className="relative flex h-2 w-2">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
      </span>
      Repository Indexed · {totalFiles.toLocaleString()} file{totalFiles === 1 ? "" : "s"}
    </span>
  );
}
