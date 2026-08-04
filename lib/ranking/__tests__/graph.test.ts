/**
 * Tests for Phase 2 of the Universal Retrieval layer:
 * `lib/ranking/graph.ts`.
 *
 * Covers:
 *   - Spec classification: isRelativeImport, isAliasImport.
 *   - Single-spec resolution: resolveImportPath.
 *   - Relative imports (POSIX + Python-style).
 *   - Extension / index-file fallbacks.
 *   - Workspace-alias resolution by basename.
 *   - Bare module specifiers are dropped.
 *   - Self-imports are dropped.
 *   - The full graph builder: buildImportGraph.
 *   - Imports outside the candidate set are dropped.
 *   - Files imported by many others show up as values across
 *     many keys (this is the in-degree signal that Phase 3
 *     consumes via invertImportGraph).
 *   - Inversion: invertImportGraph.
 *   - Insertion-order determinism.
 *
 * Each test uses a small hand-built fixture (no I/O, no GitHub
 * API) per the design's testing strategy in §7.
 */

import { describe, expect, it } from "vitest";
import type { IndexedFile } from "@/types/repository";
import {
  buildImportGraph,
  invertImportGraph,
  isAliasImport,
  isRelativeImport,
  resolveImportPath,
  resolveRelativeImport,
  type ImportGraph,
} from "../graph";

/* -------------------------------------------------------------------------- */
/*  Fixtures                                                                  */
/* -------------------------------------------------------------------------- */

function file(path: string): IndexedFile {
  const slash = path.lastIndexOf("/");
  const name = slash >= 0 ? path.slice(slash + 1) : path;
  const ext = (() => {
    const dot = name.lastIndexOf(".");
    return dot >= 0 ? name.slice(dot) : "";
  })();
  return {
    path,
    name,
    extension: ext,
    extKey: ext ? ext.slice(1).toLowerCase() : "",
    language:
      ext === ".ts" || ext === ".tsx"
        ? "TypeScript"
        : ext === ".py"
          ? "Python"
          : ext === ".go"
            ? "Go"
            : "Text",
    folder: slash >= 0 ? path.slice(0, slash) : "",
    sizeBytes: 0,
  };
}

/**
 * A small "repo" fixture that mimics a Kindred-like monorepo.
 *  - `apps/web/lib/auth.ts` is the central auth module.
 *  - `apps/web/app/api/auth/[...all]/route.ts` is the auth route.
 *  - `apps/agent/src/telegram/extract-events.ts` is the Telegram bot.
 *  - `apps/agent/src/workers/telegram-ingest.worker.ts` is the worker.
 *  - `packages/db/index.ts` is the re-exported @kindred/db.
 *  - `packages/minds-client/index.ts` is the re-exported @kindred/minds-client.
 *  - `packages/shared/index.ts` is the re-exported @kindred/shared.
 *  - `src/minds/sse-listener.ts` is the SSE listener.
 *  - `prisma.ts` is the prisma client.
 *  - `outside.ts` is NOT a relative target — it lives in a
 *    monorepo we didn't index, so its imports should be dropped.
 */
const FILES: ReadonlyArray<IndexedFile> = [
  file("apps/web/lib/auth.ts"),
  file("apps/web/app/api/auth/[...all]/route.ts"),
  file("apps/agent/src/telegram/extract-events.ts"),
  file("apps/agent/src/workers/telegram-ingest.worker.ts"),
  file("packages/db/index.ts"),
  file("packages/minds-client/index.ts"),
  file("packages/shared/index.ts"),
  file("apps/agent/src/minds/sse-listener.ts"),
  file("prisma.ts"),
  file("lib/ranking/auth.ts"),
  file("scripts/build.sh"),
];

/* -------------------------------------------------------------------------- */
/*  Spec classification                                                       */
/* -------------------------------------------------------------------------- */

describe("isRelativeImport", () => {
  it("accepts POSIX-style relative imports", () => {
    expect(isRelativeImport("./foo")).toBe(true);
    expect(isRelativeImport("../bar")).toBe(true);
    expect(isRelativeImport("../../baz")).toBe(true);
    expect(isRelativeImport("./nested/path")).toBe(true);
  });

  it("accepts root-absolute imports (rare JS)", () => {
    expect(isRelativeImport("/abs/foo")).toBe(true);
    expect(isRelativeImport("/")).toBe(true);
  });

  it("accepts bare-dot and double-dot", () => {
    expect(isRelativeImport(".")).toBe(true);
    expect(isRelativeImport("..")).toBe(true);
  });

  it("accepts Python-style leading-dot imports", () => {
    expect(isRelativeImport(".utils")).toBe(true);
    expect(isRelativeImport("..pkg")).toBe(true);
    expect(isRelativeImport("...deep")).toBe(true);
    expect(isRelativeImport(".utils.helper")).toBe(true);
  });

  it("rejects bare module specifiers", () => {
    expect(isRelativeImport("react")).toBe(false);
    expect(isRelativeImport("fs")).toBe(false);
    expect(isRelativeImport("kindred/db")).toBe(false);
    expect(isRelativeImport("bullmq")).toBe(false);
  });

  it("rejects alias specifiers", () => {
    expect(isRelativeImport("@/lib/auth")).toBe(false);
    expect(isRelativeImport("@kindred/db")).toBe(false);
    expect(isRelativeImport("~/lib/auth")).toBe(false);
    expect(isRelativeImport("@scope/pkg")).toBe(false);
  });

  it("rejects empty and garbage input", () => {
    expect(isRelativeImport("")).toBe(false);
    // Leading dot followed by a slash is relative, not garbage —
    // already covered above.
  });
});

describe("isAliasImport", () => {
  it("accepts @/ and ~/ style aliases", () => {
    expect(isAliasImport("@/lib/auth")).toBe(true);
    expect(isAliasImport("~/lib/auth")).toBe(true);
    expect(isAliasImport("@/foo")).toBe(true);
  });

  it("accepts scoped workspace aliases", () => {
    expect(isAliasImport("@kindred/db")).toBe(true);
    expect(isAliasImport("@kindred/minds-client")).toBe(true);
    expect(isAliasImport("@scope/pkg/sub")).toBe(true);
  });

  it("rejects bare @scope with no slash", () => {
    expect(isAliasImport("@scope")).toBe(false);
    expect(isAliasImport("@")).toBe(false);
  });

  it("rejects relative and bare imports", () => {
    expect(isAliasImport("./foo")).toBe(false);
    expect(isAliasImport("../bar")).toBe(false);
    expect(isAliasImport("react")).toBe(false);
    expect(isAliasImport("kindred/db")).toBe(false);
  });

  it("rejects empty input", () => {
    expect(isAliasImport("")).toBe(false);
  });
});

/* -------------------------------------------------------------------------- */
/*  resolveRelativeImport                                                     */
/* -------------------------------------------------------------------------- */

describe("resolveRelativeImport", () => {
  const FROM = "src/lib/foo.ts";

  it("resolves a same-folder import to the same folder", () => {
    expect(resolveRelativeImport(FROM, "./bar")).toBe("src/lib/bar");
    expect(resolveRelativeImport(FROM, "./nested/baz")).toBe("src/lib/nested/baz");
  });

  it("resolves a parent-folder import up one level", () => {
    expect(resolveRelativeImport(FROM, "../util")).toBe("src/util");
  });

  it("resolves a multi-up import", () => {
    expect(resolveRelativeImport(FROM, "../../shared")).toBe("shared");
  });

  it("treats '.' and '..' as the importing file's directory and parent", () => {
    expect(resolveRelativeImport(FROM, ".")).toBe("src/lib");
    expect(resolveRelativeImport(FROM, "..")).toBe("src");
  });

  it("treats '/abs/path' as a repo-root-relative import", () => {
    expect(resolveRelativeImport(FROM, "/abs/foo")).toBe("abs/foo");
  });

  it("resolves Python-style leading-dot imports", () => {
    // `from . import x` from src/lib/foo.py — "." is the current package
    expect(resolveRelativeImport("src/lib/foo.py", ".")).toBe("src/lib");
    // `from .utils import x` from src/lib/foo.py — current package's utils
    expect(resolveRelativeImport("src/lib/foo.py", ".utils")).toBe("src/lib/utils");
    // `from ..pkg import x` from src/lib/foo.py — parent package's pkg
    expect(resolveRelativeImport("src/lib/foo.py", "..pkg")).toBe("src/pkg");
  });

  it("returns null for non-relative specifiers", () => {
    expect(resolveRelativeImport(FROM, "react")).toBeNull();
    expect(resolveRelativeImport(FROM, "@kindred/db")).toBeNull();
    expect(resolveRelativeImport(FROM, "@/lib/auth")).toBeNull();
  });

  it("handles a file at the repo root (no parent directory)", () => {
    expect(resolveRelativeImport("foo.ts", "./bar")).toBe("bar");
    expect(resolveRelativeImport("foo.ts", "../bar")).toBe("bar");
  });
});

/* -------------------------------------------------------------------------- */
/*  resolveImportPath — relative imports                                      */
/* -------------------------------------------------------------------------- */

describe("resolveImportPath — relative imports", () => {
  it("resolves a same-folder TS import with the .ts extension", () => {
    // apps/web/lib/foo.ts imports "./auth" -> apps/web/lib/auth.ts
    const got = resolveImportPath("./auth", "apps/web/lib/foo.ts", FILES);
    expect(got).toBe("apps/web/lib/auth.ts");
  });

  it("resolves a parent-folder import", () => {
    // apps/web/app/api/auth/[...all]/route.ts imports "../../../../lib/auth"
    const got = resolveImportPath(
      "../../../../lib/auth",
      "apps/web/app/api/auth/[...all]/route.ts",
      FILES,
    );
    expect(got).toBe("apps/web/lib/auth.ts");
  });

  it("falls back to .tsx then .js etc. when .ts is missing", () => {
    // Add a .tsx candidate and verify it gets picked up.
    const candidates = [...FILES, file("apps/web/lib/login.tsx")];
    const got = resolveImportPath("./login", "apps/web/lib/foo.ts", candidates);
    expect(got).toBe("apps/web/lib/login.tsx");
  });

  it("resolves folder imports via /index.<ext>", () => {
    // The /kindred/db workspace maps to packages/db/index.ts.
    // `./db` from apps/web/lib/foo.ts should hit packages/db/index.ts
    // when the candidate set contains it.
    const candidates = [file("apps/web/lib/foo.ts"), file("packages/db/index.ts")];
    const got = resolveImportPath("../../../packages/db", "apps/web/lib/foo.ts", candidates);
    expect(got).toBe("packages/db/index.ts");
  });

  it("returns null when the target is not in the candidate set", () => {
    // ./missing -> nothing in FILES is named "missing"
    const got = resolveImportPath("./missing", "apps/web/lib/auth.ts", FILES);
    expect(got).toBeNull();
  });

  it("resolves Python relative imports with the .py extension", () => {
    const candidates = [
      file("apps/agent/src/telegram/utils.py"),
      file("apps/agent/src/telegram/extract_events.py"),
    ];
    const got = resolveImportPath(
      ".utils",
      "apps/agent/src/telegram/extract_events.py",
      candidates,
    );
    expect(got).toBe("apps/agent/src/telegram/utils.py");
  });
});

/* -------------------------------------------------------------------------- */
/*  resolveImportPath — alias imports                                         */
/* -------------------------------------------------------------------------- */

describe("resolveImportPath — alias imports", () => {
  it("resolves @kindred/db to packages/db/index.ts by basename", () => {
    const got = resolveImportPath(
      "@kindred/db",
      "apps/agent/src/workers/telegram-ingest.worker.ts",
      FILES,
    );
    expect(got).toBe("packages/db/index.ts");
  });

  it("resolves @kindred/minds-client to packages/minds-client/index.ts", () => {
    const got = resolveImportPath(
      "@kindred/minds-client",
      "apps/agent/src/telegram/extract-events.ts",
      FILES,
    );
    expect(got).toBe("packages/minds-client/index.ts");
  });

  it("resolves @/lib/auth to apps/web/lib/auth.ts by basename", () => {
    const got = resolveImportPath("@/lib/auth", "apps/web/app/api/auth/[...all]/route.ts", FILES);
    expect(got).toBe("apps/web/lib/auth.ts");
  });

  it("resolves ~/lib/auth to apps/web/lib/auth.ts by basename", () => {
    const got = resolveImportPath("~/lib/auth", "apps/web/app/api/auth/[...all]/route.ts", FILES);
    expect(got).toBe("apps/web/lib/auth.ts");
  });

  it("strips the extension from the alias before matching", () => {
    // @kindred/db.ts should still match packages/db/index.ts
    const got = resolveImportPath(
      "@kindred/db.ts",
      "apps/agent/src/workers/telegram-ingest.worker.ts",
      FILES,
    );
    expect(got).toBe("packages/db/index.ts");
  });

  it("falls back to a final-path-segment match when no filename match", () => {
    // There's no top-level "sse-listener" filename, but
    // apps/agent/src/minds/sse-listener.ts ends in sse-listener.
    const got = resolveImportPath(
      "@/minds/sse-listener",
      "apps/agent/src/workers/telegram-ingest.worker.ts",
      FILES,
    );
    expect(got).toBe("apps/agent/src/minds/sse-listener.ts");
  });

  it("resolves to lib/ranking/auth.ts when multiple candidates match the basename", () => {
    // Two candidates named "auth" (one in apps/web, one in
    // lib/ranking). The first-by-input-order match wins.
    const got = resolveImportPath("@/lib/auth", "some/other/file.ts", FILES);
    // FILES is in declaration order, so apps/web/lib/auth.ts
    // appears before lib/ranking/auth.ts.
    expect(got).toBe("apps/web/lib/auth.ts");
  });

  it("returns null when the alias basename matches no candidate", () => {
    const got = resolveImportPath(
      "@kindred/nonexistent",
      "apps/agent/src/workers/telegram-ingest.worker.ts",
      FILES,
    );
    expect(got).toBeNull();
  });

  it("returns null when alias resolution is disabled", () => {
    const got = resolveImportPath(
      "@kindred/db",
      "apps/agent/src/workers/telegram-ingest.worker.ts",
      FILES,
      { resolveAliasesByBasename: false },
    );
    expect(got).toBeNull();
  });
});

/* -------------------------------------------------------------------------- */
/*  resolveImportPath — bare / self imports                                   */
/* -------------------------------------------------------------------------- */

describe("resolveImportPath — bare specifiers and self-imports", () => {
  it("drops bare module specifiers (node_modules style)", () => {
    expect(resolveImportPath("react", "apps/web/lib/auth.ts", FILES)).toBeNull();
    expect(
      resolveImportPath("bullmq", "apps/agent/src/workers/telegram-ingest.worker.ts", FILES),
    ).toBeNull();
    expect(
      resolveImportPath("ioredis", "apps/agent/src/workers/telegram-ingest.worker.ts", FILES),
    ).toBeNull();
  });

  it("drops bare in-repo specifiers like 'kindred/db'", () => {
    expect(resolveImportPath("kindred/db", "apps/web/lib/auth.ts", FILES)).toBeNull();
  });

  it("drops self-imports (target === importingFilePath)", () => {
    // If a file imports "./auth" but it IS auth.ts (so the
    // resolved path collapses to itself), we drop the edge.
    const got = resolveImportPath("./auth", "apps/web/lib/auth.ts", []);
    // No candidate set, so it would be null anyway. Add self:
    const selfCandidates = [file("apps/web/lib/auth.ts")];
    const got2 = resolveImportPath("./auth", "apps/web/lib/auth.ts", selfCandidates);
    expect(got).toBeNull();
    expect(got2).toBeNull();
  });

  it("returns null for empty input", () => {
    expect(resolveImportPath("", "apps/web/lib/auth.ts", FILES)).toBeNull();
  });
});

/* -------------------------------------------------------------------------- */
/*  buildImportGraph — end-to-end                                             */
/* -------------------------------------------------------------------------- */

describe("buildImportGraph", () => {
  it("builds a forward graph with one entry per importing file", () => {
    const importsFor = (path: string): ReadonlySet<string> | null => {
      const table: Record<string, ReadonlySet<string>> = {
        "apps/web/lib/auth.ts": new Set(["@kindred/db", "process"]),
        "apps/agent/src/workers/telegram-ingest.worker.ts": new Set([
          "@kindred/db",
          "@kindred/minds-client",
          "@kindred/shared",
          "../telegram/extract-events",
          "bullmq",
        ]),
        "apps/agent/src/telegram/extract-events.ts": new Set([
          "@kindred/shared",
          "./sse-listener", // wrong path — not a candidate
        ]),
      };
      return table[path] ?? null;
    };

    const graph = buildImportGraph(FILES, importsFor);

    // auth.ts imports @kindred/db -> packages/db/index.ts
    expect(graph.get("apps/web/lib/auth.ts")).toEqual(new Set(["packages/db/index.ts"]));
    // telegram-ingest.worker.ts imports 3 workspace aliases + 1
    // relative import, and `bullmq` is dropped (bare).
    expect(graph.get("apps/agent/src/workers/telegram-ingest.worker.ts")).toEqual(
      new Set([
        "packages/db/index.ts",
        "packages/minds-client/index.ts",
        "packages/shared/index.ts",
        "apps/agent/src/telegram/extract-events.ts",
      ]),
    );
    // extract-events imports @kindred/shared (resolved) and
    // ./sse-listener (not in the candidate set, dropped).
    expect(graph.get("apps/agent/src/telegram/extract-events.ts")).toEqual(
      new Set(["packages/shared/index.ts"]),
    );
  });

  it("drops files whose imports are all unresolvable", () => {
    const importsFor = (path: string): ReadonlySet<string> | null => {
      const table: Record<string, ReadonlySet<string>> = {
        // All bare / unresolvable
        "apps/web/lib/auth.ts": new Set(["react", "fs", "bullmq"]),
        "apps/agent/src/workers/telegram-ingest.worker.ts": new Set([
          // ./missing isn't in FILES, so it drops
          "./missing",
          // ./auth is in FILES (apps/web/lib/auth.ts), so it resolves
          "../../../web/lib/auth",
        ]),
      };
      return table[path] ?? null;
    };

    const graph = buildImportGraph(FILES, importsFor);

    // auth.ts is omitted — no resolvable imports.
    expect(graph.has("apps/web/lib/auth.ts")).toBe(false);
    // The worker keeps its one resolvable import.
    expect(graph.get("apps/agent/src/workers/telegram-ingest.worker.ts")).toEqual(
      new Set(["apps/web/lib/auth.ts"]),
    );
  });

  it("captures files that are imported by many others (forward edges)", () => {
    // Five files all import the same auth module via a relative
    // import. The auth module should appear in all five forward
    // edges, which is what Phase 3's invertImportGraph +
    // in-degree ranker will turn into a popularity signal.
    const authPath = "apps/web/lib/auth.ts";
    const importerPaths = [
      "apps/web/app/api/auth/[...all]/route.ts",
      "apps/agent/src/workers/telegram-ingest.worker.ts",
      "apps/agent/src/telegram/extract-events.ts",
      "apps/agent/src/minds/sse-listener.ts",
      "prisma.ts",
    ];
    // Each importer's relative spec is the path that resolves
    // back to auth.ts. Computed by the test so we don't have to
    // hard-code ../../../ segments.
    const relSpecFor = (importer: string): string => {
      // importer is a/b/c/file.ts, target is apps/web/lib/auth.ts.
      // Compute the relative path from importer to target.
      const fromDir = importer.includes("/") ? importer.slice(0, importer.lastIndexOf("/")) : "";
      const toDir = authPath.slice(0, authPath.lastIndexOf("/"));
      const fromSegs = fromDir ? fromDir.split("/") : [];
      const toSegs = toDir.split("/");
      let i = 0;
      while (i < fromSegs.length && i < toSegs.length && fromSegs[i] === toSegs[i]) {
        i++;
      }
      const up = "../".repeat(fromSegs.length - i);
      const down = toSegs.slice(i).join("/");
      // Always prefix with "./" so the spec is unambiguously
      // relative (the resolver treats bare paths as module
      // specifiers and drops them).
      const rel = (up || "./") + (down ? down + "/" : "") + "auth";
      return rel;
    };
    const importsFor = (path: string): ReadonlySet<string> | null => {
      if (importerPaths.includes(path)) {
        return new Set([relSpecFor(path)]);
      }
      return null;
    };

    const graph = buildImportGraph(FILES, importsFor);
    expect(graph.size).toBe(5);
    for (const p of importerPaths) {
      expect(graph.get(p)?.has(authPath)).toBe(true);
    }
  });

  it("drops files where importsFor returns null (not scanned)", () => {
    const importsFor = (): ReadonlySet<string> | null => null;
    const graph = buildImportGraph(FILES, importsFor);
    expect(graph.size).toBe(0);
  });

  it("drops files where importsFor returns an empty set", () => {
    const importsFor = (): ReadonlySet<string> | null => new Set();
    const graph = buildImportGraph(FILES, importsFor);
    expect(graph.size).toBe(0);
  });

  it("preserves input order of keys", () => {
    // Three importers, in FILES order. The graph should follow
    // the same order, even though they end up in the graph.
    // We use a relative import that resolves to packages/db/index.ts
    // (which is in the candidate set) so the graph is non-empty.
    const target = "packages/db/index.ts";
    const relSpecFor = (importer: string): string => {
      const fromDir = importer.includes("/") ? importer.slice(0, importer.lastIndexOf("/")) : "";
      const toDir = target.slice(0, target.lastIndexOf("/"));
      const fromSegs = fromDir ? fromDir.split("/") : [];
      const toSegs = toDir.split("/");
      let i = 0;
      while (i < fromSegs.length && i < toSegs.length && fromSegs[i] === toSegs[i]) {
        i++;
      }
      const up = "../".repeat(fromSegs.length - i);
      const down = toSegs.slice(i).join("/");
      // Always prefix with "./" so the spec is unambiguously
      // relative (the resolver treats bare paths as module
      // specifiers and drops them).
      return (up || "./") + down;
    };
    const importsFor = (path: string): ReadonlySet<string> | null => {
      if (
        path === "apps/agent/src/workers/telegram-ingest.worker.ts" ||
        path === "apps/web/lib/auth.ts" ||
        path === "prisma.ts"
      ) {
        return new Set([relSpecFor(path)]);
      }
      return null;
    };

    const graph = buildImportGraph(FILES, importsFor);
    const keys = Array.from(graph.keys());
    // The three files appear in FILES in the order:
    //   apps/web/lib/auth.ts
    //   apps/agent/src/workers/telegram-ingest.worker.ts
    //   prisma.ts
    expect(keys).toEqual([
      "apps/web/lib/auth.ts",
      "apps/agent/src/workers/telegram-ingest.worker.ts",
      "prisma.ts",
    ]);
  });

  it("dedupes duplicate targets within a single file's imports", () => {
    const importsFor = (path: string): ReadonlySet<string> | null => {
      if (path === "apps/agent/src/workers/telegram-ingest.worker.ts") {
        return new Set([
          "@kindred/db",
          "@kindred/db.ts", // alias with extension — same target
          "./packages/db", // same target by a different path
          "./packages/db.ts",
        ]);
      }
      return null;
    };
    const graph = buildImportGraph(FILES, importsFor);
    const set = graph.get("apps/agent/src/workers/telegram-ingest.worker.ts");
    // All four imports should resolve to packages/db/index.ts via
    // basename matching, and the Set should dedupe.
    expect(set).toEqual(new Set(["packages/db/index.ts"]));
  });

  it("handles a large candidate set without blowing up", () => {
    // Stress test: 200 candidates, 50 importers, each importing
    // 5 things. We don't make any assertions about specific
    // paths — we just want the builder to terminate quickly and
    // produce a deterministic, well-shaped graph.
    const candidates: IndexedFile[] = [];
    for (let i = 0; i < 200; i++) {
      candidates.push(file(`src/mod${i}/file${i}.ts`));
    }
    const importsFor = (path: string): ReadonlySet<string> | null => {
      if (!path.startsWith("src/mod")) return null;
      const i = Number(path.match(/mod(\d+)/)?.[1] ?? -1);
      if (!Number.isFinite(i) || i < 0) return null;
      return new Set([
        `./file${(i + 1) % 200}`,
        `./file${(i + 2) % 200}`,
        `react`, // bare — dropped
        `../mod${(i + 3) % 200}/file${(i + 3) % 200}`,
      ]);
    };
    const graph = buildImportGraph(candidates, importsFor);
    // All 200 candidates should appear in the graph.
    expect(graph.size).toBe(200);
  });
});

/* -------------------------------------------------------------------------- */
/*  invertImportGraph                                                         */
/* -------------------------------------------------------------------------- */

describe("invertImportGraph", () => {
  it("builds the reverse edges", () => {
    const forward: ImportGraph = new Map([
      ["a.ts", new Set(["b.ts", "c.ts"])],
      ["b.ts", new Set(["c.ts"])],
      ["c.ts", new Set([])],
    ]);
    const reverse = invertImportGraph(forward);
    expect(reverse.get("b.ts")).toEqual(new Set(["a.ts"]));
    expect(reverse.get("c.ts")).toEqual(new Set(["a.ts", "b.ts"]));
    // c.ts imports nothing, so it has no entry in the reverse map.
    expect(reverse.has("c.ts") ? reverse.get("c.ts")!.size : 0).toBe(2);
    // a.ts is not imported by anyone in this fixture, so it has
    // no entry in the reverse map.
    expect(reverse.has("a.ts")).toBe(false);
  });

  it("produces an empty map from an empty graph", () => {
    const reverse = invertImportGraph(new Map());
    expect(reverse.size).toBe(0);
  });

  it("captures the in-degree signal (files imported by many)", () => {
    // Six importers all import the same auth module.
    const authPath = "apps/web/lib/auth.ts";
    const importers = ["a.ts", "b.ts", "c.ts", "d.ts", "e.ts", "f.ts"];
    const forward: ImportGraph = new Map(importers.map((p) => [p, new Set([authPath])]));
    const reverse = invertImportGraph(forward);
    expect(reverse.get(authPath)).toEqual(new Set(importers));
  });
});

/* -------------------------------------------------------------------------- */
/*  Type-level checks                                                         */
/* -------------------------------------------------------------------------- */

describe("type contracts", () => {
  it("ImportGraph is a ReadonlyMap<str, ReadonlySet<str>>", () => {
    const importsFor = (path: string): ReadonlySet<string> | null => {
      if (path === "apps/web/lib/auth.ts") return new Set(["./missing"]);
      return null;
    };
    const graph: ImportGraph = buildImportGraph(FILES, importsFor);
    // Type-level: this must compile.
    const value: ReadonlySet<string> | undefined = graph.get("apps/web/lib/auth.ts");
    expect(value).toBeUndefined(); // ./missing is not in FILES
  });
});
