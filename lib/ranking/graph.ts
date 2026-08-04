/**
 * Phase 2 of the Universal Retrieval layer: import graph builder.
 *
 * Resolves raw import specifiers (as produced by Phase 1's
 * `extractImports`) against a candidate set of {@link IndexedFile}s
 * and builds a directed import graph:
 *
 *     Map<importingPath, Set<resolvedImportedPath>>
 *
 * Per the design (`docs/universal-retrieval-design.md`):
 *
 *   - **Relative imports** — `./foo`, `../bar`, `/abs/path`, plus
 *     Python-style `from . import X` / `from ..pkg import Y` —
 *     resolve against the importing file's folder.
 *   - **Workspace aliases** — `@/...`, `@scope/pkg/...`, `~/...` —
 *     resolve by matching the *basename* of the alias against the
 *     candidate set (option (a) in §6.1). The full alias prefix is
 *     dropped, then the final path segment (extension-stripped) is
 *     matched against every candidate's name and final path segment.
 *   - **Bare module specifiers** — `react`, `fs`, `kindred/db`, `bullmq` —
 *     are dropped silently. We only resolve paths we can plausibly
 *     find in the candidate set, so packages outside the repo (and
 *     the in-repo `node_modules` tree) are not part of the graph.
 *   - **Unresolvable imports** — resolved but not in the candidate
 *     set — are dropped. The graph is bounded by what we scanned,
 *     so traversal is always O(candidates), never O(repo).
 *   - **Self-imports** — `target === importingFilePath` — are
 *     dropped to keep the graph acyclic at the trivial level.
 *
 * Pure functions. No I/O. No new dependencies. Reuses the existing
 * `IndexedFile` type from `@/types/repository`. The graph builder
 * itself does NOT read file content — the caller (Phase 4's
 * orchestrator) is expected to have already run `extractImports`
 * for each file and pass the result in via the `importsFor` hook.
 *
 * See design §3.2 (import extraction + path resolution), §4
 * (file layout), §6.1 (workspace-alias map), §7 (testing strategy).
 */

/* -------------------------------------------------------------------------- */
/*  Imports                                                                   */
/* -------------------------------------------------------------------------- */

import type { IndexedFile } from "@/types/repository";

/* -------------------------------------------------------------------------- */
/*  Types                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * Options for {@link buildImportGraph} and {@link resolveImportPath}.
 *
 * Kept intentionally small for the v1 cut. The (b) path in §6.1
 * (plumb an `importAliases` map through `IndexedFile`) is a
 * follow-up if the basename fallback turns out to be too lossy.
 */
export interface ImportGraphOptions {
  /**
   * If true (default), workspace-alias imports like
   * `@kindred/db`, `@/lib/auth`, `~/lib/auth` are resolved by
   * matching the alias's final path segment (extension-stripped)
   * against every candidate's name and final path segment.
   *
   * If false, alias imports are dropped (unresolved). The relative
   * import path is unaffected by this flag.
   */
  resolveAliasesByBasename?: boolean;

  /**
   * File extensions to try when a relative import points at a
   * path with no extension. The order is significant: the first
   * extension that yields a hit wins. Defaults cover the languages
   * the rest of the engine already supports.
   */
  extensionFallback?: ReadonlyArray<string>;
}

/**
 * The resolved import graph. Keys are the repository-relative paths
 * of importing files. Values are the set of repository-relative
 * paths that the key file imports — and only paths that exist in
 * the original candidate set.
 *
 * The graph is forward-only (edges go from importer to imported).
 * Reverse edges (popularity / in-degree) are computed downstream
 * in `popularity.ts` (Phase 3) by inverting this map.
 *
 * Insertion order: keys are emitted in the order they appear in
 * the input `candidateFiles` array, so the graph is deterministic
 * for a given input (helps tests, helps debug output).
 */
export type ImportGraph = ReadonlyMap<string, ReadonlySet<string>>;

/* -------------------------------------------------------------------------- */
/*  Defaults                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * Default extension fallback list. Used when a relative import
 * has no extension, e.g. `import x from "./foo"` — we try
 * `foo.ts`, `foo.tsx`, `foo.js`, etc. in order.
 *
 * `.ts` and `.tsx` lead because the repo under analysis is
 * overwhelmingly TypeScript. Python and Go are in the list for
 * completeness. Markdown / JSON / YAML are NOT included because
 * those files are rarely imported.
 */
const DEFAULT_EXTENSION_FALLBACK: ReadonlyArray<string> = [
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".mjs",
  ".cjs",
  ".py",
  ".go",
  ".mdx",
];

/* -------------------------------------------------------------------------- */
/*  Spec classification                                                       */
/* -------------------------------------------------------------------------- */

/**
 * True if `spec` is a relative import (POSIX or Python-style).
 *
 *   "./foo"      -> true
 *   "../bar"     -> true
 *   "../../baz" -> true
 *   "/abs/path"  -> true   (absolute within repo, JS-style)
 *   "."          -> true
 *   ".."         -> true
 *   ".utils"     -> true   (Python: from .utils import helper)
 *   "..pkg"      -> true   (Python: from ..pkg import x)
 *   "react"      -> false
 *   "@kindred/db"-> false
 *   "@/lib/auth" -> false
 *   "~"          -> false
 */
export function isRelativeImport(spec: string): boolean {
  if (!spec) return false;
  if (spec.startsWith("./") || spec.startsWith("../") || spec.startsWith("/")) {
    return true;
  }
  if (spec === "." || spec === "..") return true;
  // Python-style: one or more leading dots followed by a
  // letter/underscore/EOF. This catches `from . import x` (the
  // import side, which is the empty `""` after `from .` — handled
  // by the spec==="." case above) and `from .utils import helper`
  // and `from ..pkg import x`.
  if (spec[0] === ".") {
    let i = 1;
    while (i < spec.length && spec[i] === ".") i++;
    if (i >= spec.length) return true; // "..." etc.
    const next = spec[i] ?? "";
    if (/[A-Za-z_]/.test(next)) return true;
  }
  return false;
}

/**
 * True if `spec` is a workspace alias import.
 *
 *   "@/lib/auth"        -> true   (alias-style)
 *   "@kindred/db"       -> true   (npm-style workspace alias)
 *   "@scope/pkg/sub"    -> true
 *   "~/lib/auth"        -> true
 *   "./foo"             -> false
 *   "react"             -> false
 *   "@scope"            -> false  (no slash -> bare specifier, not an alias)
 */
export function isAliasImport(spec: string): boolean {
  if (!spec) return false;
  if (spec.startsWith("@/") || spec.startsWith("~/")) return true;
  if (spec[0] === "@") {
    // Scoped workspace: "@scope/..." with at least one slash.
    // Bare "@scope" is a malformed import and not an alias.
    return spec.includes("/");
  }
  return false;
}

/* -------------------------------------------------------------------------- */
/*  Internal: alias basename extraction                                       */
/* -------------------------------------------------------------------------- */

/**
 * Strip the alias prefix and return the *basename* (the final
 * path segment, extension-stripped) of the inner path. The
 * basename is what we match against the candidate set per
 * §6.1 (option a).
 *
 *   "@kindred/db"          -> "db"
 *   "@/lib/auth"           -> "auth"
 *   "@/lib/auth.ts"        -> "auth"
 *   "~/lib/auth"           -> "auth"
 *   "@scope/pkg/sub/foo"   -> "foo"
 *   "react"                -> null
 *   "./foo"                -> null
 */
function aliasBasename(spec: string): string | null {
  if (!isAliasImport(spec)) return null;
  let inner: string;
  if (spec.startsWith("@/")) {
    inner = spec.slice(2);
  } else if (spec.startsWith("~/")) {
    inner = spec.slice(2);
  } else {
    // Scoped: "@scope/..." — drop everything up to the first slash.
    const slash = spec.indexOf("/");
    inner = slash >= 0 ? spec.slice(slash + 1) : "";
  }
  if (!inner) return null;
  const segments = inner.split("/").filter((s) => s.length > 0);
  if (segments.length === 0) return null;
  const last = segments[segments.length - 1] ?? "";
  // Strip a trailing extension (.ts, .tsx, .js, etc.) so the
  // basename match is robust to both `import "@kindred/db"` and
  // `import "@kindred/db.ts"`.
  return last.replace(/\.[^.]+$/, "");
}

/* -------------------------------------------------------------------------- */
/*  Internal: relative path resolution                                        */
/* -------------------------------------------------------------------------- */

/**
 * Resolve a relative import specifier against the importing file's
 * directory. Returns a repo-relative target path (no leading "./"
 * or "../"), or null if the spec is not a relative import.
 *
 * The returned path is NOT guaranteed to exist in the candidate
 * set — that's the caller's job (via {@link matchResolvedPath}).
 *
 * Examples (with importingFilePath = "src/lib/foo.ts"):
 *
 *   "./bar"          -> "src/lib/bar"
 *   "../util"        -> "src/util"
 *   "../../shared"   -> "shared"
 *   "."              -> "src/lib"
 *   ".."             -> "src"
 *   "/abs/foo"       -> "abs/foo"
 *   ".utils"         -> "src/lib/utils"   (Python `from .utils import …`)
 *   "..pkg"          -> "src/pkg"         (Python `from ..pkg import …`)
 *   "react"          -> null              (not relative)
 */
export function resolveRelativeImport(importingFilePath: string, spec: string): string | null {
  if (!isRelativeImport(spec)) return null;

  // Special case: a leading "/" means "absolute within the repo
  // root" — ignore the importing file's directory and use the
  // rest of the spec verbatim. This matches the test for
  // `import "/abs/foo"` from any folder yielding `abs/foo`.
  if (spec.startsWith("/")) {
    const stripped = spec.slice(1);
    return stripped;
  }

  const lastSlash = importingFilePath.lastIndexOf("/");
  const fromDir = lastSlash >= 0 ? importingFilePath.slice(0, lastSlash) : "";

  // Normalise Python-style ".foo" / "..pkg" / "...deep" to
  // POSIX "./foo" / "../pkg" / "../../deep" so the segment
  // resolver below handles them uniformly. The trigger is one
  // or more leading dots followed by either EOF or a
  // letter/underscore — anything else is left alone (POSIX-
  // style "./foo" or "../foo" is already covered above).
  let normalised = spec;
  if (normalised[0] === ".") {
    let i = 0;
    while (i < normalised.length && normalised[i] === ".") i++;
    if (i > 0) {
      const rest = normalised.slice(i);
      if (rest === "" || /[A-Za-z_]/.test(rest[0] ?? "")) {
        // Python-style: `i` leading dots means "go up i levels
        // then walk down `rest`". Convert to POSIX: (i-1) "../"
        // then `rest`. (`.` = no up, `..` = one up, `...` = two
        // up, etc.) Note: `i === 1 && rest === ""` is `from .
        // import x`, which is "current dir", so the prefix is
        // empty — we fall through to the segment walker with an
        // empty `rel`, which gives us `fromDir` itself.
        const prefix = i > 1 ? "../".repeat(i - 1) : "";
        normalised = prefix + rest;
      }
    }
  }

  // Strip the spec prefix to get the relative path.
  let rel: string;
  if (normalised === ".") {
    rel = "";
  } else if (normalised === "..") {
    rel = "../";
  } else if (normalised.startsWith("./")) {
    rel = normalised.slice(2);
  } else if (normalised.startsWith("../")) {
    rel = normalised;
  } else {
    rel = normalised;
  }

  // Walk `fromDir` up for each "../" in `rel`, then append the rest.
  const parts = fromDir ? fromDir.split("/") : [];
  for (const seg of rel.split("/")) {
    if (seg === "" || seg === ".") continue;
    if (seg === "..") {
      parts.pop();
      continue;
    }
    parts.push(seg);
  }
  return parts.join("/");
}

/* -------------------------------------------------------------------------- */
/*  Internal: candidate-set matching                                          */
/* -------------------------------------------------------------------------- */

/**
 * Try to find a candidate whose path equals the given resolved
 * relative path, with a series of common-extension / index-file
 * fallbacks.
 *
 *   matchResolvedPath("src/lib/auth", candidates)
 *     -> "src/lib/auth.ts"        (if the .ts file exists)
 *     -> "src/lib/auth.tsx"       (if the .tsx file exists)
 *     -> "src/lib/auth.js"        (if the .js file exists)
 *     -> "src/lib/auth/index.ts"  (folder w/ index file)
 *     -> null
 *
 * Order matters: the first match wins. We try exact path first
 * (covers the case where the import already has an extension),
 * then extension fallbacks (covers the case where it does not),
 * then the `/index.<ext>` form (covers folder imports).
 */
function matchResolvedPath(
  resolved: string,
  candidateFiles: ReadonlyArray<IndexedFile>,
  extensions: ReadonlyArray<string>,
): string | null {
  const byPath = new Map<string, string>();
  for (const f of candidateFiles) byPath.set(f.path, f.path);
  if (byPath.has(resolved)) return resolved;

  for (const ext of extensions) {
    const candidate = resolved + ext;
    if (byPath.has(candidate)) return candidate;
  }
  for (const ext of extensions) {
    const candidate = resolved + "/index" + ext;
    if (byPath.has(candidate)) return candidate;
  }
  return null;
}

/**
 * Find a candidate whose filename (or final path segment, or
 * parent-directory name), extension-stripped, equals the given
 * basename. This is the §6.1 (a) fallback for workspace-alias
 * resolution.
 *
 *   matchByBasename("auth", candidates)
 *     -> "src/lib/auth.ts"             (filename match)
 *     -> "apps/web/lib/auth/server.ts" (final-segment match)
 *     -> "packages/db/index.ts"        (parent-dir match for
 *                                       basename "db")
 *     -> null
 *
 * The three passes are tried in this order, and the first
 * match wins. Pass 3 (parent directory) is what makes the
 * monorepo alias convention work: `packages/db/index.ts` is
 * imported as `@kindred/db`, and the file's filename is
 * `index.ts`, but its enclosing directory is `db`. The
 * "directory-as-package-name" rule is the v1 cut of §6.1.
 */
function matchByBasename(
  basename: string,
  candidateFiles: ReadonlyArray<IndexedFile>,
): string | null {
  if (!basename) return null;
  // Pass 1: exact filename match (ignoring extension). Files
  // like "auth.ts", "auth.py", "auth.go" all hit here.
  for (const f of candidateFiles) {
    const nameNoExt = f.name.replace(/\.[^.]+$/, "");
    if (nameNoExt === basename) return f.path;
  }
  // Pass 2: final path segment match. Catches "server/auth.ts"
  // for basename "auth" when there's no top-level "auth.ts".
  for (const f of candidateFiles) {
    const lastSeg = f.path.includes("/") ? f.path.slice(f.path.lastIndexOf("/") + 1) : f.path;
    const lastSegNoExt = lastSeg.replace(/\.[^.]+$/, "");
    if (lastSegNoExt === basename) return f.path;
  }
  // Pass 3: parent directory name match. This is the
  // "monorepo package" rule — `packages/db/index.ts` matches
  // basename "db" because its parent directory is `db/`. We
  // do NOT walk up the directory tree (no recursive
  // ancestry matching) to keep the heuristic bounded.
  for (const f of candidateFiles) {
    if (!f.folder) continue; // root-level file has no parent dir
    const segments = f.folder.split("/");
    const parent = segments[segments.length - 1] ?? "";
    if (parent === basename) return f.path;
  }
  return null;
}

/* -------------------------------------------------------------------------- */
/*  Public API: resolveImportPath                                             */
/* -------------------------------------------------------------------------- */

/**
 * Resolve a single raw import specifier against the candidate file
 * set. Returns the candidate's repository-relative path on success,
 * or `null` if the spec is unresolvable.
 *
 * Dispatch:
 *
 *   1. Relative import → {@link resolveRelativeImport} +
 *      {@link matchResolvedPath} (with extension / index fallbacks).
 *   2. Alias import   → {@link aliasBasename} +
 *      {@link matchByBasename} (only if `resolveAliasesByBasename`
 *      is not explicitly disabled).
 *   3. Bare specifier → `null`. We don't try to resolve `react` or
 *      `bullmq` or `kindred/db` against the candidate set; the
 *      graph stays inside the repo.
 *
 * Self-imports (target === importingFilePath) return `null` so
 * the caller never inserts a self-edge.
 */
export function resolveImportPath(
  spec: string,
  importingFilePath: string,
  candidateFiles: ReadonlyArray<IndexedFile>,
  options: ImportGraphOptions = {},
): string | null {
  if (!spec || !importingFilePath) return null;
  const resolveAliases = options.resolveAliasesByBasename !== false;
  const extensions = options.extensionFallback ?? DEFAULT_EXTENSION_FALLBACK;

  if (isRelativeImport(spec)) {
    const resolved = resolveRelativeImport(importingFilePath, spec);
    if (!resolved) return null;
    const target = matchResolvedPath(resolved, candidateFiles, extensions);
    if (target && target !== importingFilePath) return target;
    return null;
  }

  if (isAliasImport(spec)) {
    if (!resolveAliases) return null;
    const base = aliasBasename(spec);
    if (!base) return null;
    const target = matchByBasename(base, candidateFiles);
    if (target && target !== importingFilePath) return target;
    return null;
  }

  // Bare module specifier (no leading "./" / "@/" / "~/") — drop.
  return null;
}

/* -------------------------------------------------------------------------- */
/*  Public API: buildImportGraph                                              */
/* -------------------------------------------------------------------------- */

/**
 * Build the resolved import graph for a set of indexed files.
 *
 * For each file in `candidateFiles`:
 *
 *   1. Look up its raw import specifiers via `importsFor(path)`.
 *      The hook is supplied by the caller (Phase 4's orchestrator
 *      passes the per-file `imports` set produced by
 *      `extractImports` during the content-scan pass). The hook
 *      may return `null` to signal "no imports known" (e.g. the
 *      file wasn't scanned, or extraction returned an empty set);
 *      in that case the file is omitted from the graph.
 *   2. Resolve each specifier against the candidate set via
 *      {@link resolveImportPath}.
 *   3. Accumulate the resolved paths into a per-file `Set`,
 *      deduping by path.
 *   4. Files with zero resolved imports are omitted from the
 *      graph. The downstream `popularity.ts` (Phase 3) only
 *      needs the files that actually import something.
 *
 * The map is returned in input order: keys appear in the same
 * order as `candidateFiles`, so iteration is deterministic.
 *
 * The graph is bounded by the candidate set. Imports that
 * resolve to paths outside the candidate set (e.g. unindexed
 * files, files excluded by the indexer) are dropped silently.
 */
export function buildImportGraph(
  candidateFiles: ReadonlyArray<IndexedFile>,
  importsFor: (path: string) => ReadonlySet<string> | null,
  options: ImportGraphOptions = {},
): ImportGraph {
  const out = new Map<string, Set<string>>();
  for (const f of candidateFiles) {
    const rawImports = importsFor(f.path);
    if (!rawImports || rawImports.size === 0) continue;
    const resolved = new Set<string>();
    for (const spec of rawImports) {
      const target = resolveImportPath(spec, f.path, candidateFiles, options);
      if (target) resolved.add(target);
    }
    if (resolved.size > 0) {
      out.set(f.path, resolved);
    }
  }
  return out;
}

/* -------------------------------------------------------------------------- */
/*  Convenience: invert the graph (forward → backward)                        */
/* -------------------------------------------------------------------------- */

/**
 * Invert the import graph: for each target file, list the files
 * that import it. This is the "reverse index" that
 * `popularity.ts` (Phase 3) needs to compute in-degree.
 *
 * Files that no one imports are omitted from the result (a file
 * with in-degree 0 has no incoming edges, so it doesn't need a
 * bucket in the reverse map — the in-degree ranker can derive
 * that fact from `size === undefined`).
 *
 * Insertion order is by the order targets are first encountered
 * during the forward-graph traversal, which is deterministic for
 * a given input.
 */
export function invertImportGraph(graph: ImportGraph): ImportGraph {
  const out = new Map<string, Set<string>>();
  for (const [from, tos] of graph) {
    for (const to of tos) {
      let bucket = out.get(to);
      if (!bucket) {
        bucket = new Set<string>();
        out.set(to, bucket);
      }
      bucket.add(from);
    }
  }
  return out;
}
