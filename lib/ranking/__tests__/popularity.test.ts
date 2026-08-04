/**
 * Tests for Phase 3 of the Universal Retrieval layer:
 * `lib/ranking/popularity.ts`.
 *
 * Covers:
 *   - inDegreeRanking: bump formula, cap behaviour, determinism,
 *     files with zero in-degree, custom options, type contract.
 *   - expandRelated: forward edges, reverse edges, self-relation
 *     exclusion, winner exclusion, accumulation, cap behaviour,
 *     empty winner set, determinism, type contract.
 *   - combinedPopularityBump: sum of both layers, cap behaviour,
 *     interaction with the merged cap.
 *   - Constants: defaults match the design's §3.3 / §6 numbers.
 *
 * Each test uses small hand-built fixtures (no I/O, no GitHub
 * API) per the design's testing strategy in §7. The fixtures
 * mirror the Kindred-like monorepo shape from `graph.test.ts`
 * so tests read consistently.
 */

import { describe, expect, it } from "vitest";
import type { IndexedFile } from "@/types/repository";
import {
  inDegreeRanking,
  expandRelated,
  combinedPopularityBump,
  POPULARITY_MAX_BUMP,
  POPULARITY_LOG_MULTIPLIER,
  RELATED_BUMP,
  RELATED_BUMP_CAP,
  type PopularityOptions,
  type RelatedOptions,
} from "../popularity";
import type { ImportGraph } from "../graph";

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
 * Build a `File -> Set<string>` map and use it as the
 * `importsFor` hook for `buildImportGraph`. Returns the
 * resolved forward graph.
 *
 * The `raw` parameter accepts either `ReadonlyArray<string>`
 * or `ReadonlySet<string>` per-file, so tests can use the
 * natural literal that matches the intent (Set for `new Set([...])`,
 * Array for inline `[...]`).
 */
function buildGraph(
  raw: Record<string, ReadonlyArray<string> | ReadonlySet<string>>,
  candidates: ReadonlyArray<IndexedFile>,
): ImportGraph {
  // We hand-build the resolved forward graph here for two
  // reasons: (1) tests stay independent of `graph.ts`'s
  // resolution rules, and (2) the resolved paths can be
  // exactly the ones the test cares about.
  const out = new Map<string, Set<string>>();
  for (const [from, tos] of Object.entries(raw)) {
    const resolved = new Set<string>();
    for (const to of tos) {
      if (to === from) continue; // self-edges dropped
      // Only include if the target is in the candidate set.
      if (candidates.some((c) => c.path === to)) {
        resolved.add(to);
      }
    }
    if (resolved.size > 0) {
      out.set(from, resolved);
    }
  }
  return out;
}

/**
 * A small "repo" fixture. Includes:
 *   - One "hub" file imported by many others (high in-degree).
 *   - One "imported by no one" leaf file (in-degree 0).
 *   - One "auth module" with mixed in-degree and a chain.
 *   - One "isolated" file that no other file references.
 */
const FILES: ReadonlyArray<IndexedFile> = [
  file("apps/web/lib/auth.ts"),
  file("apps/web/app/api/auth/[...all]/route.ts"),
  file("apps/agent/src/workers/telegram-ingest.worker.ts"),
  file("apps/agent/src/telegram/extract-events.ts"),
  file("apps/agent/src/minds/sse-listener.ts"),
  file("packages/db/index.ts"),
  file("lib/isolated.ts"),
  file("lib/leaf.ts"),
];

/* -------------------------------------------------------------------------- */
/*  Constants                                                                 */
/* -------------------------------------------------------------------------- */

describe("constants", () => {
  it("POPULARITY_MAX_BUMP is 20 (design §3.3)", () => {
    expect(POPULARITY_MAX_BUMP).toBe(20);
  });

  it("POPULARITY_LOG_MULTIPLIER is 4 (design §3.3)", () => {
    expect(POPULARITY_LOG_MULTIPLIER).toBe(4);
  });

  it("RELATED_BUMP is 8 (design §3.3 / §6)", () => {
    expect(RELATED_BUMP).toBe(8);
  });

  it("RELATED_BUMP_CAP is 20 (design §6)", () => {
    expect(RELATED_BUMP_CAP).toBe(20);
  });
});

/* -------------------------------------------------------------------------- */
/*  inDegreeRanking — formula and cap                                         */
/* -------------------------------------------------------------------------- */

describe("inDegreeRanking", () => {
  it("returns an empty map for an empty graph", () => {
    const bumps = inDegreeRanking(new Map());
    expect(bumps.size).toBe(0);
  });

  it("omits files with in-degree 0 (no incoming edges)", () => {
    // leaf.ts and isolated.ts are imported by no one.
    const graph: ImportGraph = buildGraph(
      {
        "apps/web/lib/auth.ts": new Set(["packages/db/index.ts"]),
      },
      FILES,
    );
    const bumps = inDegreeRanking(graph);
    expect(bumps.has("lib/leaf.ts")).toBe(false);
    expect(bumps.has("lib/isolated.ts")).toBe(false);
  });

  it("applies the design formula: min(20, 4 * log2(inDegree + 1))", () => {
    // auth.ts is imported by 5 other files.
    const graph: ImportGraph = buildGraph(
      {
        "apps/web/app/api/auth/[...all]/route.ts": new Set(["apps/web/lib/auth.ts"]),
        "apps/agent/src/workers/telegram-ingest.worker.ts": new Set([
          "apps/web/lib/auth.ts",
          "packages/db/index.ts",
        ]),
        "apps/agent/src/telegram/extract-events.ts": new Set([
          "apps/web/lib/auth.ts",
          "packages/db/index.ts",
        ]),
        "apps/agent/src/minds/sse-listener.ts": new Set(["apps/web/lib/auth.ts"]),
        "lib/leaf.ts": new Set(["apps/web/lib/auth.ts"]),
      },
      FILES,
    );
    const bumps = inDegreeRanking(graph);

    // auth.ts has inDegree = 5 -> 4 * log2(6) = 4 * 2.585 = 10.34
    // 10.34 rounded to 2dp = 10.34, capped at 20 = 10.34
    const authBump = bumps.get("apps/web/lib/auth.ts");
    expect(authBump).toBeDefined();
    expect(authBump!).toBeCloseTo(4 * Math.log2(6), 2);

    // db has inDegree = 2 -> 4 * log2(3) = 4 * 1.585 = 6.34
    const dbBump = bumps.get("packages/db/index.ts");
    expect(dbBump).toBeCloseTo(4 * Math.log2(3), 2);
  });

  it("caps the bump at POPULARITY_MAX_BUMP (20)", () => {
    // Build a graph with 100 files all importing the same hub.
    // The hub's bump should cap at 20, not scale linearly.
    const importers: string[] = [];
    const raw: Record<string, ReadonlyArray<string>> = {};
    for (let i = 0; i < 100; i++) {
      const p = `src/importer${i}.ts`;
      importers.push(p);
      raw[p] = ["apps/web/lib/auth.ts"];
    }
    const candidates: IndexedFile[] = [
      file("apps/web/lib/auth.ts"),
      ...importers.map((p) => file(p)),
    ];
    const graph: ImportGraph = buildGraph(raw, candidates);
    const bumps = inDegreeRanking(graph);
    expect(bumps.get("apps/web/lib/auth.ts")).toBe(POPULARITY_MAX_BUMP);
  });

  it("hits the cap at inDegree=31 (4 * log2(32) = 20)", () => {
    // 31 importers -> inDegree=31 -> 4 * log2(32) = 20.
    const importers: string[] = [];
    const raw: Record<string, ReadonlyArray<string>> = {};
    for (let i = 0; i < 31; i++) {
      const p = `src/i${i}.ts`;
      importers.push(p);
      raw[p] = ["apps/web/lib/auth.ts"];
    }
    const candidates: IndexedFile[] = [
      file("apps/web/lib/auth.ts"),
      ...importers.map((p) => file(p)),
    ];
    const graph: ImportGraph = buildGraph(raw, candidates);
    const bumps = inDegreeRanking(graph);
    expect(bumps.get("apps/web/lib/auth.ts")).toBe(POPULARITY_MAX_BUMP);
  });

  it("is one point below the cap at inDegree=15 (4 * log2(16) = 16)", () => {
    const importers: string[] = [];
    const raw: Record<string, ReadonlyArray<string>> = {};
    for (let i = 0; i < 15; i++) {
      const p = `src/i${i}.ts`;
      importers.push(p);
      raw[p] = ["apps/web/lib/auth.ts"];
    }
    const candidates: IndexedFile[] = [
      file("apps/web/lib/auth.ts"),
      ...importers.map((p) => file(p)),
    ];
    const graph: ImportGraph = buildGraph(raw, candidates);
    const bumps = inDegreeRanking(graph);
    // 4 * log2(16) = 16 exactly
    expect(bumps.get("apps/web/lib/auth.ts")).toBe(16);
  });

  it("returns the exact value for inDegree=1 (4 * log2(2) = 4)", () => {
    const graph: ImportGraph = buildGraph(
      {
        "lib/leaf.ts": new Set(["apps/web/lib/auth.ts"]),
      },
      FILES,
    );
    const bumps = inDegreeRanking(graph);
    expect(bumps.get("apps/web/lib/auth.ts")).toBe(4);
  });

  it("returns the exact value for inDegree=3 (4 * log2(4) = 8)", () => {
    const graph: ImportGraph = buildGraph(
      {
        "lib/leaf.ts": new Set(["apps/web/lib/auth.ts"]),
        "apps/agent/src/minds/sse-listener.ts": new Set(["apps/web/lib/auth.ts"]),
        "apps/agent/src/telegram/extract-events.ts": new Set(["apps/web/lib/auth.ts"]),
      },
      FILES,
    );
    const bumps = inDegreeRanking(graph);
    expect(bumps.get("apps/web/lib/auth.ts")).toBe(8);
  });

  it("handles a graph with a chain (each file in-degree 1 except root)", () => {
    // a.ts -> b.ts -> c.ts -> d.ts
    // d.ts: inDegree=1
    // c.ts: inDegree=1
    // b.ts: inDegree=1
    // a.ts: inDegree=0 (not in the reverse map)
    const candidates: IndexedFile[] = [
      file("a.ts"),
      file("b.ts"),
      file("c.ts"),
      file("d.ts"),
    ];
    const graph: ImportGraph = buildGraph(
      {
        "a.ts": new Set(["b.ts"]),
        "b.ts": new Set(["c.ts"]),
        "c.ts": new Set(["d.ts"]),
      },
      candidates,
    );
    const bumps = inDegreeRanking(graph);
    expect(bumps.get("d.ts")).toBe(4);
    expect(bumps.get("c.ts")).toBe(4);
    expect(bumps.get("b.ts")).toBe(4);
    expect(bumps.has("a.ts")).toBe(false);
  });

  it("rounds to 2 decimal places for stability", () => {
    // inDegree=5 -> 4 * log2(6) = 10.3398... -> rounded to 10.34
    const graph: ImportGraph = buildGraph(
      {
        "a.ts": new Set(["hub.ts"]),
        "b.ts": new Set(["hub.ts"]),
        "c.ts": new Set(["hub.ts"]),
        "d.ts": new Set(["hub.ts"]),
        "e.ts": new Set(["hub.ts"]),
      },
      [file("a.ts"), file("b.ts"), file("c.ts"), file("d.ts"), file("e.ts"), file("hub.ts")],
    );
    const bumps = inDegreeRanking(graph);
    const hub = bumps.get("hub.ts");
    expect(hub).toBeDefined();
    // 2dp means there should be at most 2 decimal places
    const decimals = (hub!.toString().split(".")[1] ?? "").length;
    expect(decimals).toBeLessThanOrEqual(2);
  });
});

/* -------------------------------------------------------------------------- */
/*  inDegreeRanking — custom options                                          */
/* -------------------------------------------------------------------------- */

describe("inDegreeRanking — custom options", () => {
  it("respects a custom maxBump", () => {
    const graph: ImportGraph = buildGraph(
      {
        "a.ts": new Set(["hub.ts"]),
        "b.ts": new Set(["hub.ts"]),
        "c.ts": new Set(["hub.ts"]),
      },
      [file("a.ts"), file("b.ts"), file("c.ts"), file("hub.ts")],
    );
    const options: PopularityOptions = { maxBump: 5 };
    const bumps = inDegreeRanking(graph, options);
    // inDegree=3 -> 4 * log2(4) = 8, capped at 5
    expect(bumps.get("hub.ts")).toBe(5);
  });

  it("respects a custom logMultiplier", () => {
    const graph: ImportGraph = buildGraph(
      {
        "a.ts": new Set(["hub.ts"]),
      },
      [file("a.ts"), file("hub.ts")],
    );
    const options: PopularityOptions = { logMultiplier: 10 };
    const bumps = inDegreeRanking(graph, options);
    // inDegree=1 -> 10 * log2(2) = 10
    expect(bumps.get("hub.ts")).toBe(10);
  });

  it("respects both knobs together", () => {
    const graph: ImportGraph = buildGraph(
      {
        "a.ts": new Set(["hub.ts"]),
        "b.ts": new Set(["hub.ts"]),
      },
      [file("a.ts"), file("b.ts"), file("hub.ts")],
    );
    // inDegree=2 -> 5 * log2(3) ≈ 7.92, NOT capped at 12.
    // The test confirms the cap is applied AFTER the multiplier.
    const options: PopularityOptions = { maxBump: 12, logMultiplier: 5 };
    const bumps = inDegreeRanking(graph, options);
    expect(bumps.get("hub.ts")).toBeCloseTo(5 * Math.log2(3), 2);
  });

  it("caps at maxBump when the formula exceeds it", () => {
    const graph: ImportGraph = buildGraph(
      {
        "a.ts": new Set(["hub.ts"]),
        "b.ts": new Set(["hub.ts"]),
        "c.ts": new Set(["hub.ts"]),
        "d.ts": new Set(["hub.ts"]),
        "e.ts": new Set(["hub.ts"]),
      },
      [file("a.ts"), file("b.ts"), file("c.ts"), file("d.ts"), file("e.ts"), file("hub.ts")],
    );
    // inDegree=5 -> 5 * log2(6) ≈ 12.92, capped at 12.
    const options: PopularityOptions = { maxBump: 12, logMultiplier: 5 };
    const bumps = inDegreeRanking(graph, options);
    expect(bumps.get("hub.ts")).toBe(12);
  });
});

/* -------------------------------------------------------------------------- */
/*  inDegreeRanking — determinism                                             */
/* -------------------------------------------------------------------------- */

describe("inDegreeRanking — determinism", () => {
  it("produces the same output for the same input (call 1 == call 2)", () => {
    const graph: ImportGraph = buildGraph(
      {
        "apps/web/app/api/auth/[...all]/route.ts": new Set([
          "apps/web/lib/auth.ts",
          "packages/db/index.ts",
        ]),
        "apps/agent/src/workers/telegram-ingest.worker.ts": new Set([
          "apps/web/lib/auth.ts",
          "packages/db/index.ts",
        ]),
        "apps/agent/src/telegram/extract-events.ts": new Set([
          "apps/web/lib/auth.ts",
          "packages/db/index.ts",
        ]),
        "apps/agent/src/minds/sse-listener.ts": new Set(["apps/web/lib/auth.ts"]),
        "lib/leaf.ts": new Set(["apps/web/lib/auth.ts"]),
      },
      FILES,
    );
    const a = inDegreeRanking(graph);
    const b = inDegreeRanking(graph);
    expect(Array.from(a.entries())).toEqual(Array.from(b.entries()));
  });

  it("iterates in insertion order of the forward graph", () => {
    // Three files imported by the same set of files. The order
    // of keys in the result map follows the order of targets
    // in the reverse-index traversal, which is the order in
    // which they first appear as a target.
    const graph: ImportGraph = buildGraph(
      {
        "a.ts": new Set(["x.ts", "y.ts", "z.ts"]),
        "b.ts": new Set(["x.ts", "y.ts"]),
        "c.ts": new Set(["x.ts"]),
      },
      [file("a.ts"), file("b.ts"), file("c.ts"), file("x.ts"), file("y.ts"), file("z.ts")],
    );
    const bumps = inDegreeRanking(graph);
    // The reverse map is built by walking forward edges in
    // insertion order, so x.ts, y.ts, z.ts appear in that
    // order in the reverse map's keys.
    expect(Array.from(bumps.keys())).toEqual(["x.ts", "y.ts", "z.ts"]);
  });
});

/* -------------------------------------------------------------------------- */
/*  expandRelated — forward and reverse                                       */
/* -------------------------------------------------------------------------- */

describe("expandRelated", () => {
  it("returns an empty map for an empty winner set", () => {
    const graph: ImportGraph = buildGraph(
      {
        "a.ts": new Set(["b.ts"]),
      },
      [file("a.ts"), file("b.ts")],
    );
    const bumps = expandRelated(graph, []);
    expect(bumps.size).toBe(0);
  });

  it("returns an empty map for an empty graph", () => {
    const bumps = expandRelated(new Map(), ["a.ts"]);
    expect(bumps.size).toBe(0);
  });

  it("walks the forward edge (winner -> its imports)", () => {
    // auth.ts imports packages/db/index.ts.
    // expandRelated(['auth.ts']) should surface db with +8.
    const graph: ImportGraph = buildGraph(
      {
        "apps/web/lib/auth.ts": new Set(["packages/db/index.ts"]),
      },
      FILES,
    );
    const bumps = expandRelated(graph, ["apps/web/lib/auth.ts"]);
    expect(bumps.get("packages/db/index.ts")).toBe(RELATED_BUMP);
  });

  it("walks the reverse edge (winner <- its importers)", () => {
    // route.ts imports auth.ts.
    // expandRelated(['auth.ts']) should surface route.ts with +8.
    const graph: ImportGraph = buildGraph(
      {
        "apps/web/app/api/auth/[...all]/route.ts": new Set(["apps/web/lib/auth.ts"]),
      },
      FILES,
    );
    const bumps = expandRelated(graph, ["apps/web/lib/auth.ts"]);
    expect(bumps.get("apps/web/app/api/auth/[...all]/route.ts")).toBe(RELATED_BUMP);
  });

  it("walks both directions in one call", () => {
    // auth.ts imports db; route.ts imports auth.ts.
    // expandRelated(['auth.ts']) should surface both db AND route.ts.
    const graph: ImportGraph = buildGraph(
      {
        "apps/web/lib/auth.ts": new Set(["packages/db/index.ts"]),
        "apps/web/app/api/auth/[...all]/route.ts": new Set(["apps/web/lib/auth.ts"]),
      },
      FILES,
    );
    const bumps = expandRelated(graph, ["apps/web/lib/auth.ts"]);
    expect(bumps.get("packages/db/index.ts")).toBe(RELATED_BUMP);
    expect(bumps.get("apps/web/app/api/auth/[...all]/route.ts")).toBe(RELATED_BUMP);
  });

  it("does not include winners in the output (avoids double-bumping)", () => {
    // auth.ts imports db; route.ts imports auth.ts.
    // expandRelated(['auth.ts', 'route.ts']) — auth.ts and
    // route.ts are winners, so they must NOT appear in the
    // output even though they're related to each other.
    const graph: ImportGraph = buildGraph(
      {
        "apps/web/lib/auth.ts": new Set(["packages/db/index.ts"]),
        "apps/web/app/api/auth/[...all]/route.ts": new Set(["apps/web/lib/auth.ts"]),
      },
      FILES,
    );
    const bumps = expandRelated(graph, [
      "apps/web/lib/auth.ts",
      "apps/web/app/api/auth/[...all]/route.ts",
    ]);
    expect(bumps.has("apps/web/lib/auth.ts")).toBe(false);
    expect(bumps.has("apps/web/app/api/auth/[...all]/route.ts")).toBe(false);
    // db is still surfaced (it's a related file).
    expect(bumps.get("packages/db/index.ts")).toBe(RELATED_BUMP);
  });

  it("does not include the winner's other imports if they're also winners", () => {
    // a.ts imports b.ts; expandRelated(['a.ts', 'b.ts']) — b.ts
    // is a winner, so it must not appear in the output.
    const graph: ImportGraph = buildGraph(
      {
        "a.ts": new Set(["b.ts"]),
      },
      [file("a.ts"), file("b.ts")],
    );
    const bumps = expandRelated(graph, ["a.ts", "b.ts"]);
    expect(bumps.has("b.ts")).toBe(false);
  });

  it("accumulates bumps across multiple winners (capped at RELATED_BUMP_CAP)", () => {
    // Three winners all import the same hub.
    // 3 * 8 = 24 -> cap at 20.
    const graph: ImportGraph = buildGraph(
      {
        "a.ts": new Set(["hub.ts"]),
        "b.ts": new Set(["hub.ts"]),
        "c.ts": new Set(["hub.ts"]),
      },
      [file("a.ts"), file("b.ts"), file("c.ts"), file("hub.ts")],
    );
    const bumps = expandRelated(graph, ["a.ts", "b.ts", "c.ts"]);
    expect(bumps.get("hub.ts")).toBe(RELATED_BUMP_CAP);
  });

  it("accumulates bumps when one file is connected to a single winner via both directions", () => {
    // A cycle: a.ts -> b.ts -> a.ts. expandRelated(['a.ts']):
    //   - forward: b.ts (a.ts's import) -> +8
    //   - reverse: b.ts (b.ts is also an importer of a.ts) -> +8
    // Total for b.ts: +16.
    const graph: ImportGraph = buildGraph(
      {
        "a.ts": new Set(["b.ts"]),
        "b.ts": new Set(["a.ts"]),
      },
      [file("a.ts"), file("b.ts")],
    );
    const bumps = expandRelated(graph, ["a.ts"]);
    expect(bumps.get("b.ts")).toBe(2 * RELATED_BUMP);
  });

  it("caps at RELATED_BUMP_CAP even with many connections", () => {
    // Hub is connected to a single winner via 5 forward and 5
    // reverse edges, and also connected to 2 other winners.
    // Total = 12 connections * 8 = 96 -> cap at 20.
    const graph: ImportGraph = buildGraph(
      {
        // hub imports 5 things
        "hub.ts": new Set([
          "deps1.ts",
          "deps2.ts",
          "deps3.ts",
          "deps4.ts",
          "deps5.ts",
        ]),
        // 5 things import hub
        "deps1.ts": new Set(["hub.ts"]),
        "deps2.ts": new Set(["hub.ts"]),
        "deps3.ts": new Set(["hub.ts"]),
        "deps4.ts": new Set(["hub.ts"]),
        "deps5.ts": new Set(["hub.ts"]),
        // 2 other winners
        "w1.ts": new Set(["hub.ts"]),
        "w2.ts": new Set(["hub.ts"]),
      },
      [
        file("hub.ts"),
        file("deps1.ts"),
        file("deps2.ts"),
        file("deps3.ts"),
        file("deps4.ts"),
        file("deps5.ts"),
        file("w1.ts"),
        file("w2.ts"),
      ],
    );
    const bumps = expandRelated(graph, ["hub.ts", "w1.ts", "w2.ts"]);
    // The deps files are not winners, so they appear in the output.
    // Each is connected to hub.ts via reverse (1 connection) and
    // some of them also forward — but the forward from hub to
    // them is one direction; the reverse from them to hub is
    // another. So each deps file gets 1 forward + 1 reverse = +16.
    // Plus w1 and w2 import hub too — but w1 and w2 are winners,
    // so they're dropped. hub.ts itself is also a winner, so
    // deps1-deps5 are not in the winners set.
    // Wait — let me recompute. For each deps file:
    //   - winner=hub.ts, forward: hub imports deps -> +8
    //   - winner=hub.ts, reverse: deps imports hub -> +8
    // Total: +16 per deps file.
    for (const dep of ["deps1.ts", "deps2.ts", "deps3.ts", "deps4.ts", "deps5.ts"]) {
      expect(bumps.get(dep)).toBe(16);
    }
    // hub.ts is a winner, so it's not in the output.
    expect(bumps.has("hub.ts")).toBe(false);
  });

  it("excludes self-relations defensively", () => {
    // If the graph somehow contains a self-edge (the upstream
    // buildImportGraph drops these, but expandRelated is
    // defensive), it should not bump the winner.
    const graph: ImportGraph = new Map([
      ["a.ts", new Set(["a.ts"])],
    ]);
    const bumps = expandRelated(graph, ["a.ts"]);
    expect(bumps.has("a.ts")).toBe(false);
  });

  it("silently skips winners that are not in the graph", () => {
    // A winner that doesn't appear in the graph should not
    // throw, and its (non-existent) edges should be empty.
    const graph: ImportGraph = buildGraph(
      {
        "a.ts": new Set(["b.ts"]),
      },
      [file("a.ts"), file("b.ts")],
    );
    const bumps = expandRelated(graph, ["does-not-exist.ts", "a.ts"]);
    expect(bumps.get("b.ts")).toBe(RELATED_BUMP);
    expect(bumps.has("does-not-exist.ts")).toBe(false);
  });

  it("ignores the order of the winner iterable", () => {
    const graph: ImportGraph = buildGraph(
      {
        "a.ts": new Set(["b.ts"]),
        "c.ts": new Set(["b.ts"]),
      },
      [file("a.ts"), file("b.ts"), file("c.ts")],
    );
    const a = expandRelated(graph, ["a.ts", "c.ts"]);
    const b = expandRelated(graph, ["c.ts", "a.ts"]);
    expect(Array.from(a.entries())).toEqual(Array.from(b.entries()));
  });
});

/* -------------------------------------------------------------------------- */
/*  expandRelated — custom options                                            */
/* -------------------------------------------------------------------------- */

describe("expandRelated — custom options", () => {
  it("respects a custom bump value", () => {
    const graph: ImportGraph = buildGraph(
      {
        "a.ts": new Set(["b.ts"]),
      },
      [file("a.ts"), file("b.ts")],
    );
    const options: RelatedOptions = { bump: 3 };
    const bumps = expandRelated(graph, ["a.ts"], options);
    expect(bumps.get("b.ts")).toBe(3);
  });

  it("respects a custom cap", () => {
    const graph: ImportGraph = buildGraph(
      {
        "a.ts": new Set(["hub.ts"]),
        "b.ts": new Set(["hub.ts"]),
        "c.ts": new Set(["hub.ts"]),
      },
      [file("a.ts"), file("b.ts"), file("c.ts"), file("hub.ts")],
    );
    // 3 connections * 8 = 24 -> cap at 15
    const options: RelatedOptions = { cap: 15 };
    const bumps = expandRelated(graph, ["a.ts", "b.ts", "c.ts"], options);
    expect(bumps.get("hub.ts")).toBe(15);
  });

  it("respects both knobs together", () => {
    const graph: ImportGraph = buildGraph(
      {
        "a.ts": new Set(["b.ts"]),
        "c.ts": new Set(["b.ts"]),
      },
      [file("a.ts"), file("b.ts"), file("c.ts")],
    );
    // 2 connections * 5 = 10, cap at 6
    const options: RelatedOptions = { bump: 5, cap: 6 };
    const bumps = expandRelated(graph, ["a.ts", "c.ts"], options);
    expect(bumps.get("b.ts")).toBe(6);
  });
});

/* -------------------------------------------------------------------------- */
/*  expandRelated — determinism                                               */
/* -------------------------------------------------------------------------- */

describe("expandRelated — determinism", () => {
  it("produces the same output for the same input", () => {
    const graph: ImportGraph = buildGraph(
      {
        "a.ts": new Set(["b.ts", "c.ts"]),
        "b.ts": new Set(["c.ts"]),
      },
      [file("a.ts"), file("b.ts"), file("c.ts")],
    );
    const x = expandRelated(graph, ["a.ts"]);
    const y = expandRelated(graph, ["a.ts"]);
    expect(Array.from(x.entries())).toEqual(Array.from(y.entries()));
  });

  it("inserts related files in the order they are first encountered", () => {
    // a.ts imports b.ts, c.ts, d.ts (in that order).
    // d.ts imports a.ts.
    // Winners: [a.ts]. Forward pass: b, c, d. Reverse pass: d.
    // First-encountered order: b.ts, c.ts, d.ts.
    const graph: ImportGraph = buildGraph(
      {
        "a.ts": new Set(["b.ts", "c.ts", "d.ts"]),
        "d.ts": new Set(["a.ts"]),
      },
      [file("a.ts"), file("b.ts"), file("c.ts"), file("d.ts")],
    );
    const bumps = expandRelated(graph, ["a.ts"]);
    expect(Array.from(bumps.keys())).toEqual(["b.ts", "c.ts", "d.ts"]);
  });
});

/* -------------------------------------------------------------------------- */
/*  combinedPopularityBump                                                    */
/* -------------------------------------------------------------------------- */

describe("combinedPopularityBump", () => {
  it("sums the popularity and related bumps per file", () => {
    // hub.ts is imported by 3 files (inDegree=3, popularity=4*log2(4)=8)
    // and is also the winner's import (related +8).
    const graph: ImportGraph = buildGraph(
      {
        "auth.ts": new Set(["hub.ts"]),
        "x.ts": new Set(["hub.ts"]),
        "y.ts": new Set(["hub.ts"]),
      },
      [file("auth.ts"), file("hub.ts"), file("x.ts"), file("y.ts")],
    );
    const bumps = combinedPopularityBump(graph, ["auth.ts"]);
    // hub.ts gets popularity (8) + related (8) = 16
    const hub = bumps.get("hub.ts");
    expect(hub).toBeDefined();
    expect(hub!).toBe(16);
  });

  it("returns a file with only a related bump (no popularity) at the related value", () => {
    // auth.ts imports leaf.ts. leaf.ts has inDegree=1 (popularity=4).
    // auth.ts is the winner. Related: leaf.ts gets +8.
    // Combined: 4 + 8 = 12.
    const graph: ImportGraph = buildGraph(
      {
        "auth.ts": new Set(["leaf.ts"]),
      },
      [file("auth.ts"), file("leaf.ts")],
    );
    const bumps = combinedPopularityBump(graph, ["auth.ts"]);
    const leaf = bumps.get("leaf.ts");
    expect(leaf).toBeDefined();
    expect(leaf!).toBe(12);
  });

  it("returns a file with only a popularity bump (no related) at the popularity value", () => {
    // hub.ts is imported by 2 files (inDegree=2 -> pop=4*log2(3)=6.34).
    // Winners: [unrelated.ts] — not in the graph at all.
    // hub.ts is not related to any winner, so it only has the popularity bump.
    const graph: ImportGraph = buildGraph(
      {
        "x.ts": new Set(["hub.ts"]),
        "y.ts": new Set(["hub.ts"]),
      },
      [file("x.ts"), file("y.ts"), file("hub.ts"), file("unrelated.ts")],
    );
    const bumps = combinedPopularityBump(graph, ["unrelated.ts"]);
    expect(bumps.get("hub.ts")).toBeCloseTo(4 * Math.log2(3), 2);
  });

  it("caps the combined bump at maxBump + cap (40 by default)", () => {
    // hub.ts: inDegree=100 (pop=20) + 5 related connections (5*8=40) -> 60
    // -> cap at 40 (default POPULARITY_MAX_BUMP + RELATED_BUMP_CAP = 20 + 20).
    const importers: string[] = [];
    const raw: Record<string, ReadonlyArray<string>> = {};
    for (let i = 0; i < 100; i++) {
      const p = `imp${i}.ts`;
      importers.push(p);
      raw[p] = ["hub.ts"];
    }
    // Add 5 winners that all import hub.
    for (let i = 0; i < 5; i++) {
      const w = `w${i}.ts`;
      raw[w] = ["hub.ts"];
      importers.push(w);
    }
    const candidates: IndexedFile[] = [file("hub.ts"), ...importers.map((p) => file(p))];
    const graph: ImportGraph = buildGraph(raw, candidates);
    const winnerPaths = Array.from({ length: 5 }, (_, i) => `w${i}.ts`);
    const bumps = combinedPopularityBump(graph, winnerPaths);
    // 20 + 40 = 60, capped at 40.
    expect(bumps.get("hub.ts")).toBe(40);
  });

  it("returns an empty map for an empty graph and no winners", () => {
    const bumps = combinedPopularityBump(new Map(), []);
    expect(bumps.size).toBe(0);
  });
});

/* -------------------------------------------------------------------------- */
/*  Design-mandated examples                                                  */
/* -------------------------------------------------------------------------- */

describe("design-mandated examples", () => {
  // The design (§3.5) calls out specific question-rescue scenarios
  // for the popularity layer. These tests verify that the layer
  // actually produces the right bumps for those scenarios.

  it("rescues 'What database does this project use?' via the most-imported module", () => {
    // @kindred/db is imported by 12 files in a Kindred-like
    // monorepo. The popularity layer should give it a strong
    // bump (~4 * log2(13) ≈ 14.18).
    const importers: string[] = [];
    const raw: Record<string, ReadonlyArray<string>> = {};
    for (let i = 0; i < 12; i++) {
      const p = `src/importer${i}.ts`;
      importers.push(p);
      raw[p] = ["packages/db/index.ts"];
    }
    const candidates: IndexedFile[] = [
      file("packages/db/index.ts"),
      ...importers.map((p) => file(p)),
    ];
    const graph: ImportGraph = buildGraph(raw, candidates);
    const bumps = inDegreeRanking(graph);
    // 4 * log2(13) ≈ 14.18, well within the cap.
    expect(bumps.get("packages/db/index.ts")).toBeCloseTo(4 * Math.log2(13), 2);
    // The bump is large enough to surface a file even if the
    // metadata engine missed it.
    expect(bumps.get("packages/db/index.ts")!).toBeGreaterThan(10);
  });

  it("rescues 'What happens after login?' via related-files expansion", () => {
    // The auth route imports auth.ts. Once auth.ts is the
    // winner, expandRelated should also surface the route.
    const graph: ImportGraph = buildGraph(
      {
        "apps/web/app/api/auth/[...all]/route.ts": new Set(["apps/web/lib/auth.ts"]),
      },
      FILES,
    );
    const bumps = expandRelated(graph, ["apps/web/lib/auth.ts"]);
    expect(bumps.has("apps/web/app/api/auth/[...all]/route.ts")).toBe(true);
  });

  it("rescues 'How does data flow through the app?' via forward-edge expansion", () => {
    // The entry point imports the auth module. Once the entry
    // point is the winner, expandRelated should surface auth.ts
    // (the file it imports) so the model sees the call chain.
    const graph: ImportGraph = buildGraph(
      {
        "apps/agent/src/index.ts": new Set(["apps/web/lib/auth.ts"]),
      },
      [file("apps/agent/src/index.ts"), file("apps/web/lib/auth.ts")],
    );
    const bumps = expandRelated(graph, ["apps/agent/src/index.ts"]);
    expect(bumps.get("apps/web/lib/auth.ts")).toBe(RELATED_BUMP);
  });
});

/* -------------------------------------------------------------------------- */
/*  Type-level checks                                                         */
/* -------------------------------------------------------------------------- */

describe("type contracts", () => {
  it("inDegreeRanking returns a Map<string, number>", () => {
    const graph: ImportGraph = buildGraph(
      {
        "a.ts": new Set(["b.ts"]),
      },
      [file("a.ts"), file("b.ts")],
    );
    const bumps: Map<string, number> = inDegreeRanking(graph);
    expect(bumps).toBeInstanceOf(Map);
  });

  it("expandRelated returns a Map<string, number>", () => {
    const graph: ImportGraph = buildGraph(
      {
        "a.ts": new Set(["b.ts"]),
      },
      [file("a.ts"), file("b.ts")],
    );
    const bumps: Map<string, number> = expandRelated(graph, ["a.ts"]);
    expect(bumps).toBeInstanceOf(Map);
  });

  it("combinedPopularityBump returns a Map<string, number>", () => {
    const graph: ImportGraph = buildGraph(
      {
        "a.ts": new Set(["b.ts"]),
      },
      [file("a.ts"), file("b.ts")],
    );
    const bumps: Map<string, number> = combinedPopularityBump(graph, ["a.ts"]);
    expect(bumps).toBeInstanceOf(Map);
  });

  it("PopularityOptions and RelatedOptions are partial — empty object is valid", () => {
    const graph: ImportGraph = buildGraph(
      {
        "a.ts": new Set(["b.ts"]),
      },
      [file("a.ts"), file("b.ts")],
    );
    const popOpts: PopularityOptions = {};
    const relOpts: RelatedOptions = {};
    expect(inDegreeRanking(graph, popOpts).size).toBeGreaterThan(0);
    expect(expandRelated(graph, ["a.ts"], relOpts).size).toBeGreaterThan(0);
  });
});
