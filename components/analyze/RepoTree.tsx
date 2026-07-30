"use client";

import { useMemo, useState, useCallback } from "react";
import type { TreeNode } from "@/types/repository";

interface RepoTreeProps {
  root: TreeNode;
  /** Optional: total file count (for the footer). */
  totalFiles: number;
}

const MAX_RENDERED_NODES = 800; // Lazy cap to keep DOM light.

export function RepoTree({ root, totalFiles }: RepoTreeProps) {
  const [expanded, setExpanded] = useState<Set<string>>(() => {
    // Expand top-level by default.
    const next = new Set<string>();
    for (const c of root.children ?? []) {
      if (c.type === "folder") next.add(c.path);
    }
    return next;
  });
  const [showAll, setShowAll] = useState(false);

  const toggle = useCallback((path: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  }, []);

  const expandAll = useCallback(() => {
    const all = new Set<string>();
    function walk(n: TreeNode) {
      if (n.type === "folder") {
        all.add(n.path);
        for (const c of n.children ?? []) walk(c);
      }
    }
    for (const c of root.children ?? []) walk(c);
    setExpanded(all);
    setShowAll(true);
  }, [root]);

  const collapseAll = useCallback(() => {
    setExpanded(new Set());
  }, []);

  const renderedCount = useMemo(() => {
    let count = 0;
    function walk(n: TreeNode, parentExpanded: boolean) {
      if (count >= MAX_RENDERED_NODES) return;
      if (n.type === "file") {
        if (parentExpanded) count += 1;
        return;
      }
      for (const c of n.children ?? []) walk(c, parentExpanded && expanded.has(n.path));
    }
    for (const c of root.children ?? []) walk(c, true);
    return count;
  }, [root, expanded]);

  return (
    <div className="overflow-hidden rounded-xl border border-navy-800/70 bg-navy-900/40">
      <div className="flex items-center justify-between border-b border-navy-800/70 px-4 py-2.5">
        <h3 className="text-sm font-semibold text-white">Repository Tree</h3>
        <div className="flex items-center gap-2 text-xs">
          <button
            type="button"
            onClick={expandAll}
            className="rounded-md border border-navy-700 px-2 py-1 text-navy-200 hover:border-emerald-500/40 hover:text-white"
          >
            Expand all
          </button>
          <button
            type="button"
            onClick={collapseAll}
            className="rounded-md border border-navy-700 px-2 py-1 text-navy-200 hover:border-emerald-500/40 hover:text-white"
          >
            Collapse all
          </button>
        </div>
      </div>

      <div className="max-h-[520px] overflow-auto p-2 font-mono text-[13px] leading-6">
        {root.children?.length ? (
          (root.children ?? []).map((child) => (
            <TreeRow
              key={child.path}
              node={child}
              depth={0}
              expanded={expanded}
              onToggle={toggle}
              showAll={showAll}
            />
          ))
        ) : (
          <p className="px-2 py-4 text-sm text-navy-300">No files to display.</p>
        )}
      </div>

      <div className="flex items-center justify-between border-t border-navy-800/70 px-4 py-2 text-xs text-navy-400">
        <span>
          {renderedCount.toLocaleString()} of {totalFiles.toLocaleString()} files rendered
        </span>
        {!showAll && renderedCount >= MAX_RENDERED_NODES ? (
          <button
            type="button"
            onClick={() => setShowAll(true)}
            className="text-emerald-400 hover:underline"
          >
            Show more
          </button>
        ) : null}
      </div>
    </div>
  );
}

interface TreeRowProps {
  node: TreeNode;
  depth: number;
  expanded: Set<string>;
  onToggle: (path: string) => void;
  showAll: boolean;
}

function TreeRow({ node, depth, expanded, onToggle, showAll }: TreeRowProps) {
  if (node.type === "file") {
    return (
      <div
        className="flex items-center gap-1.5 rounded px-1 hover:bg-navy-800/40"
        style={{ paddingLeft: `${depth * 14 + 6}px` }}
        title={node.path}
      >
        <FileIcon className="h-3.5 w-3.5 shrink-0 text-navy-400" />
        <span className="truncate text-navy-100">{node.name}</span>
        {node.file ? (
          <span className="ml-auto pl-3 text-[10px] text-navy-500">
            {formatBytesShort(node.file.sizeBytes)}
          </span>
        ) : null}
      </div>
    );
  }

  const isOpen = expanded.has(node.path);
  return (
    <div>
      <button
        type="button"
        onClick={() => onToggle(node.path)}
        className="flex w-full items-center gap-1.5 rounded px-1 text-left hover:bg-navy-800/40"
        style={{ paddingLeft: `${depth * 14 + 6}px` }}
      >
        <Chevron open={isOpen} className="h-3.5 w-3.5 shrink-0 text-navy-400" />
        <FolderIcon className="h-3.5 w-3.5 shrink-0 text-emerald-400" />
        <span className="truncate text-navy-100">{node.name}</span>
      </button>
      {isOpen ? (
        <div>
          {node.children?.map((child) => (
            <TreeRow
              key={child.path}
              node={child}
              depth={depth + 1}
              expanded={expanded}
              onToggle={onToggle}
              showAll={showAll}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function Chevron({ open, className }: { open: boolean; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path
        d={open ? "M8 5l8 7-8 7" : "M9 6l6 6-6 6"}
        stroke="currentColor"
        strokeWidth="2"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function FolderIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
      <path d="M10 4H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-8l-2-2Z" />
    </svg>
  );
}

function FileIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9l-6-6Z" />
      <path d="M14 3v6h6" />
    </svg>
  );
}

function formatBytesShort(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}
