import { ChevronRightIcon, FileIcon, FolderIcon } from "@/components/icons";
import type { TreeNode } from "@/types/repository";

interface RepositoryTreeProps {
  root: TreeNode;
  onViewFullTree?: () => void;
}

/**
 * "Repository Structure" card — top-level tree listing + CTA link.
 * Only renders the root's direct children (folders first), matching the
 * reference; deeper expansion is left to the future "View Full Tree" flow.
 */
export function RepositoryTree({ root, onViewFullTree }: RepositoryTreeProps) {
  const children = root.children ?? [];

  return (
    <div className="flex h-full flex-col rounded-2xl border border-slate-100 bg-white p-5 shadow-sm shadow-slate-100">
      <h3 className="text-sm font-bold text-brand-navy">Repository Structure</h3>

      <div className="mt-4 flex-1 space-y-0.5 overflow-y-auto text-sm">
        <div className="flex items-center gap-1.5 px-1 py-1 text-brand-navy">
          <ChevronRightIcon className="h-3.5 w-3.5 rotate-90 text-slate-400" />
          <FolderIcon className="h-4 w-4 text-brand-teal" />
          <span className="font-medium">{root.name || "/"}</span>
        </div>
        {children.map((node) => (
          <div key={node.path} className="flex items-center gap-1.5 py-1 pl-6 text-slate-600">
            {node.type === "folder" ? (
              <>
                <ChevronRightIcon className="h-3.5 w-3.5 text-slate-300" />
                <FolderIcon className="h-4 w-4 text-slate-400" />
              </>
            ) : (
              <>
                <span className="w-3.5" />
                <FileIcon className="h-4 w-4 text-slate-400" />
              </>
            )}
            <span>{node.name}</span>
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={onViewFullTree}
        className="mt-4 flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2 text-sm font-medium text-brand-navy transition-colors hover:border-brand-teal/40 hover:bg-brand-teal-50"
      >
        <span className="flex items-center gap-2">
          <FolderIcon className="h-4 w-4 text-brand-teal" />
          View Full Tree
        </span>
        <ChevronRightIcon className="h-4 w-4 text-slate-400" />
      </button>
    </div>
  );
}
