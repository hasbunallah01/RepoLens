/**
 * Phase 3 of the Universal Retrieval layer: file popularity and
 * related-file expansion.
 *
 * Two independent pure functions that consume the import graph
 * built by Phase 2 (`graph.ts`) and produce **additive** per-file
 * score bumps. Both functions are:
 *
 *   - **Pure** — no I/O, no shared state, no module-level cache.
 *   - **Deterministic** — same input → same output. Iteration
 *     order is the insertion order of the input graph, so the
 *     output is reproducible.
 *   - **Additive** — they return bump values in `[0, 20]`, not
 *     absolute scores. The orchestrator (Phase 4) merges them
 *     into the existing per-file score.
 *   - **Bounded** — every bump is capped, so a 1000-importer
 *     "hot" file still receives at most the same boost as a
 *     30-importer file.
 *   - **Self-relation-free** — a file is never related to itself.
 *
 * No new dependencies. Reuses the existing `ImportGraph` type
 * from `./graph` (Phase 2) and the existing `IndexedFile` type
 * from `@/types/repository`.
 *
 * ---
 *
 * ## 1. `inDegreeRanking` — file popularity by import in-degree
 *
 * Computes, for every file in the graph, an additive bump based
 * on how many OTHER files import it. The formula is per
 * design §3.3:
 *
 *     bump = min(POPULARITY_MAX_BUMP, POPULARITY_LOG_MULTIPLIER * log2(inDegree + 1))
 *
 * Worked examples (with the default `POPULARITY_MAX_BUMP = 20`
 * and `POPULARITY_LOG_MULTIPLIER = 4`):
 *
 *     inDegree=0  -> +0    (file is not in the reverse graph,
 *                          so it does not appear in the result)
 *     inDegree=1  -> +4    (one importer)
 *     inDegree=3  -> +8    (two importers' worth of centrality)
 *     inDegree=7  -> +12
 *     inDegree=15 -> +16
 *     inDegree=31 -> +20   (cap)
 *     inDegree=63 -> +20   (cap)
 *
 * The `log2` curve gives a smooth gradient: the first importer
 * is the strongest signal, additional importers add smaller and
 * smaller increments, and the curve asymptotes at the cap. This
 * matches the design's note that "prisma is the most-imported
 * module, imports: 12" should be a strong but not unbounded
 * signal.
 *
 * The function takes the **forward** import graph (the same one
 * `buildImportGraph` returns) and inverts it internally via
 * `invertImportGraph`. Files with in-degree 0 (no one imports
 * them) are omitted from the result map, consistent with
 * `invertImportGraph`'s contract. The orchestrator can short-
 * circuit with `if (popularity.has(file.path)) score += popularity.get(file.path)!`.
 *
 * ---
 *
 * ## 2. `expandRelated` — one-hop related-file expansion
 *
 * Given a set of "winners" (the initial top files from the
 * metadata stage), walks one hop in BOTH directions of the
 * import graph and adds an additive bump for each neighbor:
 *
 *   - **Forward edge** — the winner's imports (its
 *     dependencies). "How does data flow through the app?"
 *     → once the entry point is found, also surface its direct
 *     imports.
 *   - **Reverse edge** — the winner's importers (its
 *     dependents). "What happens after login?" → once
 *     `auth.service.ts` is found, also surface the route that
 *     calls it.
 *
 * For each related file, the function adds `RELATED_BUMP` (8 by
 * default) per connection to a winner, capped at
 * `RELATED_BUMP_CAP` (20 by default) per file. Self-relations
 * and relations between two winners are dropped (a winner
 * already has its own score and shouldn't be double-bumped by
 * being "related" to another winner).
 *
 * Worked examples (with the defaults):
 *
 *     1 winner, 1 related file                       -> +8
 *     1 winner, 3 related files (all distinct)       -> +8 each
 *     1 winner, 1 file that is both an import AND an
 *           importer of the winner (cycle neighbor)   -> +16
 *     1 winner, 3 winners (all related to each other) -> no bumps
 *     2 winners, 1 file connected to both            -> +16
 *     2 winners, 1 file connected to both, file also
 *           connected via both directions to a single
 *           winner                                    -> +24 -> cap at +20
 *
 * The output map is keyed by the related file's path. Files
 * that are winners are NOT in the output (the orchestrator
 * already has them). The related-files stage is what surfaces
 * files that the metadata engine alone would have missed —
 * they're added to the result set with their bump as the
 * starting score (or, more typically, blended with a small
 * baseline score so they don't out-rank a strong metadata hit).
 *
 * ---
 *
 * See design §3.3 (signals), §3.5 (which questions each signal
 * rescues), §4 (file layout), §6 (tunable thresholds), and §7
 * (testing strategy).
 */

/* -------------------------------------------------------------------------- */
/*  Imports                                                                   */
/* -------------------------------------------------------------------------- */

import { invertImportGraph, type ImportGraph } from "./graph";

/* -------------------------------------------------------------------------- */
/*  Defaults                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * Maximum total popularity bump any single file can receive
 * from `inDegreeRanking`. Matches design §3.3's score shape
 * (`+min(20, 4 * log2(inDegree + 1))`).
 */
export const POPULARITY_MAX_BUMP = 20;

/**
 * Multiplier on the `log2(inDegree + 1)` curve. With the default
 * value of 4, the curve hits the cap at inDegree=31. See the
 * table in the module docstring for the full worked table.
 */
export const POPULARITY_LOG_MULTIPLIER = 4;

/**
 * Additive bump per related-file connection. A file that is a
 * one-hop neighbor of one winner gets `RELATED_BUMP` points; a
 * file connected to N distinct winners (or connected to one
 * winner via both forward and reverse edges) gets
 * `N * RELATED_BUMP` points, capped at `RELATED_BUMP_CAP`.
 *
 * Matches design §3.3 and §6.
 */
export const RELATED_BUMP = 8;

/**
 * Maximum total related-files bump any single file can receive
 * from `expandRelated`. The cap leaves room for future stages
 * (e.g. second-degree related expansion) and prevents a single
 * "hub" file from drowning out the metadata score.
 */
export const RELATED_BUMP_CAP = 20;

/* -------------------------------------------------------------------------- */
/*  Public types                                                              */
/* -------------------------------------------------------------------------- */

/**
 * Options for {@link inDegreeRanking}.
 *
 * The defaults reproduce the design's §3.3 formula
 * (`min(20, 4 * log2(inDegree + 1))`). Tests can override
 * individual knobs without re-implementing the function.
 */
export interface PopularityOptions {
  /**
   * Maximum bump value (clamp). Default {@link POPULARITY_MAX_BUMP} (20).
   * The bump is `min(maxBump, logMultiplier * log2(inDegree + 1))`.
   */
  maxBump?: number;
  /**
   * Multiplier on the `log2(inDegree + 1)` curve. Default
   * {@link POPULARITY_LOG_MULTIPLIER} (4).
   */
  logMultiplier?: number;
}

/**
 * Options for {@link expandRelated}.
 *
 * The defaults reproduce the design's §3.3 formula
 * (`+RELATED_BUMP` per connection, capped at `RELATED_BUMP_CAP`).
 */
export interface RelatedOptions {
  /**
   * Per-connection additive bump. Default {@link RELATED_BUMP} (8).
   * Each connection between a winner and a related file
   * (forward or reverse, one per direction) adds this much to
   * the related file's total bump.
   */
  bump?: number;
  /**
   * Maximum total bump a single file can receive from the
   * related-files stage. Default {@link RELATED_BUMP_CAP} (20).
   */
  cap?: number;
}

/* -------------------------------------------------------------------------- */
/*  Internal helpers                                                          */
/* -------------------------------------------------------------------------- */

/**
 * Add `delta` to `map[key]`, clamped to `cap`. Idempotent and
 * total — a no-op for empty / null deltas.
 */
function addBump(
  map: Map<string, number>,
  key: string,
  delta: number,
  cap: number,
): void {
  if (!key || delta <= 0) return;
  const current = map.get(key) ?? 0;
  const next = Math.min(cap, current + delta);
  map.set(key, next);
}

/**
 * Build the reverse index (target → set of importers) from a
 * forward import graph. Equivalent to
 * {@link invertImportGraph}, but kept local to this module so
 * `expandRelated` doesn't pay the cost of allocating a public
 * `ReadonlyMap` view when the caller just wants the forward
 * graph and the related-files output.
 */
function buildReverseIndex(graph: ImportGraph): Map<string, Set<string>> {
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

/* -------------------------------------------------------------------------- */
/*  Public API: inDegreeRanking                                               */
/* -------------------------------------------------------------------------- */

/**
 * Compute the per-file popularity bump from an import graph.
 *
 * For every file in the graph, computes the in-degree (number
 * of other files that import it) and turns it into an additive
 * bump:
 *
 *     bump = min(maxBump, logMultiplier * log2(inDegree + 1))
 *
 * Returns a map keyed by repository-relative path. Files with
 * in-degree 0 are omitted (consistent with `invertImportGraph`'s
 * contract — a file with no incoming edges does not appear in
 * the reverse map).
 *
 * Insertion order of the result map is the order in which
 * files first appear as a target during the reverse-index
 * traversal, which is deterministic for a given input.
 *
 * Pure function. No I/O. Re-uses the existing
 * {@link invertImportGraph} helper.
 */
export function inDegreeRanking(
  graph: ImportGraph,
  options: PopularityOptions = {},
): Map<string, number> {
  const maxBump = options.maxBump ?? POPULARITY_MAX_BUMP;
  const logMultiplier = options.logMultiplier ?? POPULARITY_LOG_MULTIPLIER;
  const reverse = invertImportGraph(graph);
  const bumps = new Map<string, number>();

  for (const [path, importers] of reverse) {
    const inDegree = importers.size;
    // `inDegree === 0` is unreachable for a key in `reverse`
    // (invertImportGraph only emits keys with at least one
    // incoming edge), but the defensive check makes the
    // formula self-evidently correct.
    if (inDegree <= 0) continue;
    // `Math.log2` on `inDegree + 1`:
    //   inDegree=1 -> log2(2) = 1
    //   inDegree=2 -> log2(3) ≈ 1.585
    //   inDegree=3 -> log2(4) = 2
    //   inDegree=7 -> log2(8) = 3
    //   inDegree=15 -> log2(16) = 4
    //   inDegree=31 -> log2(32) = 5
    //   inDegree=63 -> log2(64) = 6
    const raw = logMultiplier * Math.log2(inDegree + 1);
    const bump = Math.min(maxBump, raw);
    // Round to at most 2 decimal places so the output is
    // stable across float quirks. Bumps are additive scores,
    // not displayed values, so 2dp is plenty of precision.
    const rounded = Math.round(bump * 100) / 100;
    bumps.set(path, rounded);
  }

  return bumps;
}

/* -------------------------------------------------------------------------- */
/*  Public API: expandRelated                                                 */
/* -------------------------------------------------------------------------- */

/**
 * Expand the result set by one hop in the import graph, starting
 * from the given set of `winners`.
 *
 * For each winner, walks BOTH directions:
 *
 *   - **Forward** — the winner's imports (its dependencies).
 *   - **Reverse** — files that import the winner (its
 *     dependents).
 *
 * Each non-winner neighbor receives an additive bump of
 * `RELATED_BUMP` per connection (so a file connected to one
 * winner via both directions gets `2 * RELATED_BUMP`),
 * capped at `RELATED_BUMP_CAP` per file.
 *
 * The returned map is keyed by the related file's path. Winners
 * are NOT in the output — the orchestrator already has them
 * with their metadata score, and double-counting would inflate
 * the ranking. The `winners` set is treated as opaque: any
 * string in the set is considered a winner, regardless of
 * whether the file is in the graph or in the candidate set.
 *
 * Files that are connected to a winner via a self-loop (the
 * graph builder drops self-imports upstream, so this should
 * not occur in practice, but the check is defensive) are also
 * dropped.
 *
 * Insertion order of the result map is the order in which
 * related files are first encountered during the traversal
 * (forward pass first, then reverse pass, in winner order),
 * which is deterministic for a given input.
 *
 * Pure function. No I/O.
 */
export function expandRelated(
  graph: ImportGraph,
  winners: Iterable<string>,
  options: RelatedOptions = {},
): Map<string, number> {
  const bumpPer = options.bump ?? RELATED_BUMP;
  const cap = options.cap ?? RELATED_BUMP_CAP;
  const winnerSet = new Set<string>(winners);
  const bumps = new Map<string, number>();

  if (winnerSet.size === 0) return bumps;

  // Build the reverse index once. The cost is O(edges), which
  // is bounded by the candidate set.
  const reverse = buildReverseIndex(graph);

  // Pass 1: forward edges (winner -> its imports).
  for (const winner of winnerSet) {
    const imports = graph.get(winner);
    if (!imports) continue;
    for (const imported of imports) {
      if (imported === winner) continue;
      if (winnerSet.has(imported)) continue;
      addBump(bumps, imported, bumpPer, cap);
    }
  }

  // Pass 2: reverse edges (winner -> its importers).
  for (const winner of winnerSet) {
    const importers = reverse.get(winner);
    if (!importers) continue;
    for (const importer of importers) {
      if (importer === winner) continue;
      if (winnerSet.has(importer)) continue;
      addBump(bumps, importer, bumpPer, cap);
    }
  }

  return bumps;
}

/* -------------------------------------------------------------------------- */
/*  Convenience: combined ranking (popularity + related)                      */
/* -------------------------------------------------------------------------- */

/**
 * Convenience wrapper that runs both `inDegreeRanking` and
 * `expandRelated` against a graph and a set of winners, and
 * returns a single map of `path -> total additive bump`.
 *
 * This is NOT a public Stage 4 contract — the orchestrator
 * may choose to apply the two stages separately (e.g. apply
 * popularity first, then add related-files bumps on top).
 * The combined view exists for:
 *
 *   - **Tests** — easier to assert against a single map.
 *   - **Debug output** — a single "popularity layer" view
 *     of the graph.
 *   - **Future stages** — if Phase 4 wants to log or expose
 *     the combined layer for UI, the wrapper is ready.
 *
 * Files that receive both a popularity bump AND a related
 * bump get the sum (capped at the union of the two caps; in
 * practice both caps are 20, so the final cap is 40 — which
 * is well within the design's "additive, no single signal
 * dominates" intent).
 *
 * Pure function. No I/O.
 */
export function combinedPopularityBump(
  graph: ImportGraph,
  winners: Iterable<string>,
  options: PopularityOptions & RelatedOptions = {},
): Map<string, number> {
  const popBumps = inDegreeRanking(graph, options);
  const relBumps = expandRelated(graph, winners, options);
  const out = new Map<string, number>();
  // Merged cap: popularity max + related cap. Both default
  // to 20, so the union is 40.
  const popCap = options.maxBump ?? POPULARITY_MAX_BUMP;
  const relCap = options.cap ?? RELATED_BUMP_CAP;
  const mergedCap = popCap + relCap;

  for (const [path, bump] of popBumps) {
    out.set(path, Math.min(mergedCap, bump));
  }
  for (const [path, bump] of relBumps) {
    const current = out.get(path) ?? 0;
    out.set(path, Math.min(mergedCap, current + bump));
  }
  return out;
}
