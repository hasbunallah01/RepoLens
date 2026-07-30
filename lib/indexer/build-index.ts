/**
 * Build a {@link RepoIndex} from a raw GitHub tree.
 *
 * Steps:
 *   1. Filter out ignored paths (see `./ignore.ts`).
 *   2. Convert each remaining blob to an {@link IndexedFile}.
 *   3. Roll the files up into a nested {@link TreeNode} tree.
 *   4. Aggregate language stats and totals.
 */

import { shouldIgnorePath } from "./ignore";
import { extensionOf, languageForFile } from "./language";
import type {
  IndexedFile,
  LanguageStat,
  RepoIndex,
  TreeNode,
} from "@/types/repository";
import type { RawTree } from "@/lib/github/api";

export interface BuildIndexOptions {
  /** Known filenames that should be flagged as README presence. */
  readmeNames?: ReadonlySet<string>;
}

const DEFAULT_README = new Set([
  "README.md",
  "README.markdown",
  "README.rst",
  "README.txt",
  "README",
  "readme.md",
  "Readme.md",
]);

/**
 * Build the full index. Always returns a usable structure — an empty
 * repo just produces an empty `files` array and a single root node.
 */
export function buildIndex(rawTree: RawTree, options: BuildIndexOptions = {}): RepoIndex {
  const readmeNames = options.readmeNames ?? DEFAULT_README;

  const files: IndexedFile[] = [];
  let totalSizeBytes = 0;
  let hasReadme = false;

  for (const entry of rawTree.tree) {
    if (entry.type !== "blob") continue;
    if (shouldIgnorePath(entry.path)) continue;
    if (entry.size === undefined) continue; // tree truncated by GitHub
    if (entry.size < 0) continue;

    const fileName = entry.path.split("/").pop() ?? entry.path;
    const { ext, key } = extensionOf(entry.path);
    const folder = entry.path.includes("/")
      ? entry.path.slice(0, entry.path.lastIndexOf("/"))
      : "";

    const file: IndexedFile = {
      path: entry.path,
      name: fileName,
      extension: ext,
      extKey: key,
      language: languageForFile(entry.path),
      folder,
      sizeBytes: entry.size,
    };
    files.push(file);
    totalSizeBytes += entry.size;
    if (readmeNames.has(fileName)) hasReadme = true;
  }

  files.sort((a, b) => a.path.localeCompare(b.path));

  const tree = buildTree(files);
  const languages = aggregateLanguages(files, totalSizeBytes);
  const rootFolders = collectRootFolders(files);
  const extensions = collectExtensions(files);

  return {
    files,
    tree,
    languages,
    totalFiles: files.length,
    totalSizeBytes,
    hasReadme,
    rootFolders,
    extensions,
  };
}

function buildTree(files: IndexedFile[]): TreeNode {
  const root: TreeNode = { name: "", path: "", type: "folder", children: [] };

  for (const file of files) {
    const parts = file.path.split("/");
    let cursor = root;
    let acc = "";
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i]!;
      acc = acc ? `${acc}/${part}` : part;
      const isLeaf = i === parts.length - 1;

      if (isLeaf) {
        cursor.children!.push({
          name: part,
          path: acc,
          type: "file",
          file,
        });
      } else {
        let next = cursor.children!.find(
          (c) => c.type === "folder" && c.name === part,
        );
        if (!next) {
          next = { name: part, path: acc, type: "folder", children: [] };
          cursor.children!.push(next);
        }
        cursor = next;
      }
    }
  }

  // Sort: folders first, then files; alphabetical within each group.
  sortTree(root);
  return root;
}

function sortTree(node: TreeNode): void {
  if (!node.children) return;
  node.children.sort((a, b) => {
    if (a.type !== b.type) return a.type === "folder" ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
  for (const child of node.children) sortTree(child);
}

function aggregateLanguages(files: IndexedFile[], totalSize: number): LanguageStat[] {
  if (files.length === 0) return [];
  const byLang = new Map<string, { files: number; bytes: number }>();
  for (const f of files) {
    const entry = byLang.get(f.language) ?? { files: 0, bytes: 0 };
    entry.files += 1;
    entry.bytes += f.sizeBytes;
    byLang.set(f.language, entry);
  }
  const stats: LanguageStat[] = Array.from(byLang.entries()).map(([language, v]) => ({
    language,
    files: v.files,
    bytes: v.bytes,
    percent: totalSize === 0 ? 0 : Math.round((v.bytes / totalSize) * 1000) / 10,
  }));
  stats.sort((a, b) => b.bytes - a.bytes);
  return stats;
}

function collectRootFolders(files: IndexedFile[]): string[] {
  const set = new Set<string>();
  for (const f of files) {
    const first = f.path.split("/")[0];
    if (first && first !== f.name) set.add(first);
  }
  return Array.from(set).sort();
}

function collectExtensions(files: IndexedFile[]): string[] {
  const set = new Set<string>();
  for (const f of files) if (f.extKey) set.add(f.extKey);
  return Array.from(set).sort();
}

/** Walk the tree, returning up to `max` file nodes (DFS). */
export function* walkTreeFiles(node: TreeNode, max = Infinity): Generator<TreeNode> {
  let count = 0;
  function* walk(n: TreeNode): Generator<TreeNode> {
    if (count >= max) return;
    if (n.type === "file") {
      yield n;
      count += 1;
      return;
    }
    for (const c of n.children ?? []) {
      if (count >= max) return;
      yield* walk(c);
    }
  }
  yield* walk(node);
}
