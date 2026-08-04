# Universal Retrieval — Design Document

**Status:** Design only. Not implemented. Awaiting approval.
**Scope:** Retrieval layer only. Paritok, OpenAI, compression, and the
`/api/ask` response contract are all out of scope and must remain
unchanged.

---

## 1. Audit — what the current retrieval layer actually uses

The retrieval engine is the **ranking layer** at `lib/ranking/`. It
has three concrete entry points today, in increasing order of
sophistication:

| Entry point | File | Signals | I/O |
|---|---|---|---|
| `rankRelevantFiles` | `lib/ranking/rank.ts` | filename, folder, path keyword, extension | none |
| `rankRelevantFilesHybrid` | `lib/ranking/hybrid.ts` | metadata + conceptual doc boost + content fallback (first 2000 chars) | via `fetchContent` hook |
| (retrieval engine — separate, unused in `/api/ask`) | `lib/retrieval/retrieve.ts` | filename, folder, path keyword, extension, README boost | none |

The `/api/ask` production route uses `rankRelevantFilesHybrid`.

### 1.1 Every signal currently in play

**From `lib/ranking/scoring.ts`** (metadata engine):

1. **`scoreFilename`** — Jaccard + query coverage over the file name
   tokens (extension stripped). Strongest single signal. The brief
   notes "Show me the API routes" works because the path contains
   both "api" and "route".
2. **`scoreFolder`** — Jaccard + coverage over the folder-path
   tokens.
3. **`scoreKeywordFrequency`** — square-rooted coverage of question
   tokens over the full path tokens. Rewards deep-nested files
   when multiple keywords match.
4. **`scoreExtension`** — a small `EXTENSION_HINTS` table maps
   question keywords (test, config, build, doc, style) to file
   extensions. Plus a hard-coded README boost for natural
   overview-flavored questions (repository, project, codebase,
   app, library, summary, about, etc.).

**From `lib/ranking/hybrid.ts`** (the layer I added in the previous
turn):

5. **Conceptual doc boost** — README, docs/\*, ARCHITECTURE.md,
   DESIGN.md, BLUEPRINT.md, ROADMAP.md, OVERVIEW.md,
   CONTRIBUTING.md, AGENTS.md get a +15 score bump (or are added
   with a starting score of 60) when the question contains
   conceptual intent tokens (architectur, design, overview,
   explain, intro, blueprint, roadmap, stack, framework,
   hierarchy, …).
6. **Content fallback** — when metadata is weak (top score ≤ 35
   OR fewer than 3 ranked files), read the first 2000 chars of up
   to 25 candidate files and re-score on body-keyword coverage.

### 1.2 What the metadata engine does NOT see

The current engine is **path-only by default**. Content is only
read for the *fallback* path, and only the first 2000 chars. It
has no awareness of any of the following:

| Missing signal | Concrete example question it breaks |
|---|---|
| **Symbol names** (function/class/interface names) | "Where is the Telegram bot implemented?" — the answer lives in `telegram-ingest.worker.ts` but the *exported* symbol is `telegramIngestWorker`; the filename doesn't contain "telegram" (well, it does here, but the file is also reachable as `apps/agent/src/workers/...`). More importantly, "Bot" matches `Bot` in a class name, "sse" matches `SseListenerHandle`, "milestone scanner" matches `milestoneScannerWorker`. |
| **Import / export graph** | "How are users created?" — the actual code is in a helper imported by the user creation route, not in the route itself. The route imports the helper. We have no way to follow that edge today. |
| **File popularity (in-degree)** | `prisma` (or `auth`) is imported by dozens of files. A question about "the database" should be able to find the *client* file (`prisma.ts`) by its centrality, not by filename. |
| **README body content** | The README mentions "Telegram", "Minds", "BullMQ" by name. The metadata engine can't see any of that — only the filename. |
| **Module / package name** | "@kindred/db" is a workspace package. "What database does this project use?" → the `db` package is the answer. |
| **Environment variable names** | "Where are environment variables used?" → `process.env.REDIS_URL`, `process.env.OPENAI_API_KEY`, `sanitizeEnvValue` are all in the body. We don't see them. |
| **Top-level declaration / doc-comment keywords** | Most Kindred files start with a long doc-comment block describing what the file does ("Persistent connection to SubscribeEvents…", "Raw message context → structured RelationshipEvent candidates…"). Those comment blocks are the single most reliable source of "what does this file do" for conceptual questions. |

### 1.3 Where the current layer genuinely fails

Walked against the brief's example questions:

| Question | Today | Why |
|---|---|---|
| "Explain the architecture" | Hybrid surfaces README + AGENTS via conceptual boost (✓ improved in prev turn) | Still no symbol / body content for true architectural docs. |
| "How does authentication work?" | Metadata hits `src/auth/auth.service.ts` (✓ works) | But "where is `sanitizeEnvValue` called" is invisible. |
| "Where is caching implemented?" | Empty or weak (no file named "cache") | Likely the cache is a Redis call inside an import. |
| "How are users created?" | Empty (no `user.create` symbol visible) | The route file is `apps/web/app/api/auth/[...all]/route.ts` — generic. The actual logic is in an imported `createUser` function. |
| "What happens after login?" | Empty | "After login" is a flow question — needs the import graph to walk. |
| "How does data flow through the app?" | Empty | Flow question. Needs entry points + their imports. |
| "Where is the Telegram bot implemented?" | Hits `apps/agent/src/telegram/extract-events.ts` via folder + maybe filename. | Works by luck; the import-side is invisible. |
| "Which files handle SSE?" | Maybe hits `sse-listener.ts` | Works by filename luck; the *interface* `SseListenerHandle` is the real answer. |
| "What is the purpose of this project?" | README (✓ works) | OK. |
| "Explain the build pipeline." | `.github/workflows/ci.yml` via extension hint (✓ works) | OK. |
| "How are API requests processed?" | Generic `route.ts` files via path (weak) | The processing logic is in a shared handler, not the route file. |
| "Where are environment variables used?" | Empty | `process.env.XXX` is a body-only signal. |
| "What database does this project use?" | Maybe hits `prisma.ts` | Works by filename; would miss `@kindred/db` package if it weren't aliased. |

**Bottom line:** the current layer is path-first. ~7 of 13 example
questions are weak or empty. The brief asks for a true "any
natural-language repository question" layer.

---

## 2. Design goals (in priority order)

1. **Handle every example question** in the brief without any of
   them returning zero files.
2. **Don't regress the questions that already work.** "Show me
   the API routes" must still surface the four `route.ts` files at
   the top.
3. **Same return shape.** The function must return `RankResult` (or
   a strict superset). No new top-level fields are required; if we
   add diagnostics, they live on a `universal` sub-object that
   downstream code can ignore.
4. **No new dependencies. No embeddings. No vector DB. No LLM
   calls.** Same constraint as the previous turn.
5. **Bounded I/O.** Reading file content is expensive. Cap total
   files read at a configurable number (default 50) and run all
   reads in parallel. The hard cap is what makes this layer
   "production-quality" rather than a research demo.
6. **Per-file failure isolation.** A 404 on one file must never
   poison the rest of the scan. The existing `fetchContent` hook
   already enforces this; we keep the contract.
7. **Cheap path stays cheap.** When the metadata engine produces
   a strong result on its own, the new content / symbol /
   popularity passes should be no-ops. The engine must short-
   circuit on the "strong" path the same way the hybrid layer
   does.
8. **Long-term maintainability.** No giant new abstractions. The
   design should be 4–5 small focused files, not one mega-module.

---

## 3. New architecture — the **Universal Retrieval** layer

A new sibling to `lib/ranking/hybrid.ts`:
`lib/ranking/universal.ts` exporting
`rankRelevantFilesUniversal`. The hybrid layer stays in place
(backward compat) and the `/api/ask` route is rewired to the
universal layer.

### 3.1 Signal budget (cheap → expensive)

| Stage | Signal | Cost | Always runs? |
|---|---|---|---|
| 1 | metadata (filename / folder / path keyword / extension) | 0 I/O | yes |
| 1b | conceptual doc boost (existing) | 0 I/O | yes, when question has conceptual intent |
| 1c | symbol boost (NEW) | covered by Stage 2 content fetch | no — only if Stage 2 fetches content |
| 1d | popularity / import graph boost (NEW) | covered by Stage 2 | no — only if Stage 2 fetches content |
| 2 | content fallback — body keyword coverage (existing) | bounded I/O (≤ N files) | only if Stage 1 result is weak |
| 3 | doc-comment keyword coverage (NEW) | covered by Stage 2 | no — only if Stage 2 fetches content |
| 4 | related-file expansion via import graph (NEW) | 0 I/O (re-uses Stage 2 graph) | no — only if a winner exists |
| 5 | merge by path, keep highest score, accumulate reasons | 0 I/O | yes |

The single "fetch content" pass is Stage 2. Stages 1c, 1d, 3, and 4
all consume the data Stage 2 already loaded. Total I/O = one
`fetchContent(path)` per candidate file, parallel.

### 3.2 What we read from each fetched file

For each candidate file's first ~2000 chars we extract, in
order, four small things. Each is a tiny pure function. No AST
parser, no new deps.

1. **Top-level exported symbols.** Regex per language family:
   - TypeScript / JavaScript:
     `export (default\s+)?(function|class|interface|type|enum|const|let|var)\s+(\w+)`
   - Python:
     `^(class|def)\s+(\w+)` (top-level only)
   - Go:
     `^func\s+(\w+)` and `^type\s+(\w+)\s+(struct|interface)`
   - Other / unknown: skip silently.
   Output: a `Set<string>` of camelCase / snake_case names.
   Camel-case is split into stems (`telegramIngestWorker` →
   `["telegram", "ingest", "worker"]`) and matched against the
   stemmed question tokens the same way `tokenizeQuery` does.

2. **Top-of-file doc-comment block.** The first contiguous run of
   `//`, `#`, or `/* */` lines. Capped at 1000 chars. Used by Stage
   3 the same way Stage 2 uses the body, but weighted higher
   (these blocks are the file's "what is this" text).

3. **Import statements.** Lightweight:
   - TS/JS: `import ... from "..."` and `import "..."`
   - Python: `import X` and `from X import Y`
   - Go: `import "..."`
   Path resolution:
     - Relative (`./foo`, `../bar`, no leading `@`) → resolve
       against the importing file's folder.
     - Workspace alias (`@/...`, `@kindred/...`, `~`) → resolve
       against a configured alias map (see §6.4) or fall back to
       "matches by basename only".
   Output: a `Set<string>` of *resolved* file paths this file
   imports. Resolved-but-not-found imports are dropped.

4. **Environment-variable references.** Regex:
   - TS/JS: `process\.env\.([A-Z_][A-Z0-9_]*)`
   - Python: `os\.environ(?:\[['\"])?([A-Z_][A-Z0-9_]*)` and
     `os\.getenv\(['\"]([A-Z_][A-Z0-9_]*)`
   - Go: `os\.Getenv\(['\"]([A-Z_][A-Z0-9_]*)`
   - `.env.example` parsing: each `KEY=value` line.
   Output: a `Set<string>` of env-var names.

All four extractors share one small helper: read the file's first
~3000 chars (slightly more than the 2000 we read for body
keyword matching) and run all four regex passes against the same
slice. Anything that lives past the slice is invisible — that is
the cost of "no AST parser".

### 3.3 The seven signals, in detail

| Signal | Input | Output | Score shape |
|---|---|---|---|
| **Metadata** | filename / folder / path / extension | `RankResult` from `rankRelevantFiles` (unchanged) | existing 0..100 |
| **Conceptual doc** | `isConceptualDoc(file)` + conceptual intent | added/bumped entries | additive +15 or start at 60 |
| **Symbol** | `Set<symbolNames>` × `queryTokens` | per-file Jaccard + coverage | 0..100, blended with metadata weight if metadata is weak |
| **Popularity** | in-degree of file in import graph (built from Stage 2) | bump per file | `+min(20, 4 * log2(inDegree + 1))` |
| **Body keyword** | first 2000 chars × queryTokens | `ContentScore` (existing) | 0..100, square-rooted coverage |
| **Doc-comment keyword** | first 1000 chars of comment block × queryTokens | `ContentScore`-shaped | 0..100, 1.2× the body score (comments are denser signal) |
| **Related files** | import graph + initial winners | expand result set | additive +8 per related file (capped at +20 total) |

### 3.4 Weak vs. strong detection

The current `weakScoreThreshold = 35` and
`weakFileCountThreshold = 3` are reused unchanged. They are
checked **after** the conceptual doc boost, so conceptual
questions can pass the "weak" gate via the boosted README entry
and skip the content scan — keeping the cheap path cheap.

The content scan now has two thresholds (both configurable):

- `contentScanCap`: max files to read for content (default 50).
  Replaces the previous 25.
- `symbolScanCap`: same set; we re-use the read, so this is not
  a separate budget.

### 3.5 Why each new signal is needed (mapped to the brief's
questions)

| Signal | Questions it rescues |
|---|---|
| **Symbol** | "Where is the Telegram bot implemented?" (→ `TelegramBot`, `telegramIngestWorker`); "Which files handle SSE?" (→ `SseListenerHandle`); "Where is caching implemented?" (→ any exported `cache` / `Cache` / `getCached` symbol). |
| **Import graph + popularity** | "How are users created?" (→ find the `user.create` symbol and walk its imports); "What database does this project use?" (→ `prisma` is the most-imported module, `imports: { prisma: 12 }`); "Where are environment variables used?" (→ file has 5 env-var references). |
| **Doc-comment** | "Explain the architecture", "What is the purpose of this project?", "What happens after login?" — comment blocks are the only place these concepts are *written down*. |
| **Related files** | "What happens after login?" — once `auth.service.ts` is found, also surface the route that calls it. "How does data flow through the app?" — once the entry point is found, also surface its direct imports so the model sees the call chain. |

### 3.6 Merge strategy (Stage 5)

`mergeRankings(...)` becomes a list-of-lists merge:

```
input:  Stage 1 ranked list (metadata + conceptual boost)
        Stage 1c/d contributions (per-file symbol + popularity bumps)
        Stage 2   ranked list (body keywords)
        Stage 3   ranked list (doc-comment keywords)
        Stage 4   related files (per-file +related bump)

output: dedup by path, keep max score, accumulate reason strings
        (delimited by "; "), re-sort by score desc with alphabetic
        tiebreaker.
```

Reason strings are now multi-signal, e.g.:
`"Filename closely matches the question (contains \"auth\"). Also: body contains keyword \"login\"; imported by 7 files; exported symbol \"AuthService\" matches question."`

The downstream consumers (`fetchRankedFileContents`,
`buildProductionContext`, Paritok) treat `reason` as opaque text
for UI, so the longer string is a free UX win.

### 3.7 Output contract

```ts
interface UniversalRankResult extends RankResult {
  universal: {
    contentFetched: number;         // files we actually read
    symbolHits: string[];           // paths that scored via symbol match
    popularityBoosted: string[];    // paths boosted by import in-degree
    docCommentHits: string[];       // paths that scored via comment block
    relatedAdded: string[];         // paths added by the related-files stage
    relatedGraphEdges: number;      // total edges in the resolved import graph
    stagesExecuted: ReadonlyArray<"metadata" | "conceptual" | "symbol" | "popularity" | "body" | "doc-comment" | "related">;
  };
}
```

The base `RankResult` fields (`question`, `ranked`, `totalCandidates`,
`weights`) are exactly what `rankRelevantFiles` already returns.
`buildProductionContextFromMetadata` reads only `ranked`, so it
works without change.

---

## 4. File layout

Five new files. No new abstractions; the existing `ranking/`
folder is the home for everything retrieval-related.

| File | Purpose | Lines (est.) |
|---|---|---|
| `lib/ranking/symbols.ts` | Symbol-name + doc-comment + import + env-var extractors (regex-based, no AST) | ~250 |
| `lib/ranking/graph.ts` | Resolve relative + alias imports into a `Map<path, Set<path>>` (the import graph) | ~120 |
| `lib/ranking/popularity.ts` | In-degree + related-file expansion | ~80 |
| `lib/ranking/universal.ts` | Orchestrator. Wires stages together. Exports `rankRelevantFilesUniversal` + `UniversalRankResult` | ~300 |
| `lib/ranking/__tests__/universal.test.ts` | Tests for all four new files (mocks the fetchContent hook) | ~350 |

The existing files stay in place:
- `lib/ranking/rank.ts` — unchanged.
- `lib/ranking/scoring.ts` — unchanged.
- `lib/ranking/content.ts` — unchanged (reused by universal).
- `lib/ranking/hybrid.ts` — unchanged (kept for back-compat; can
  be deprecated later if unused).
- `lib/ranking/index.ts` — adds 4 new exports.

### 4.1 One concrete question the new layer must answer

**"Where are environment variables used?"**

- Question tokens (after stem): `[env, var, us]`. Wait — the
  stemmer drops "variables" to "vari" and then the suffix
  table may or may not fold it. Let me check… The token "used"
  is 4 chars, hits the `if (token.length <= 4) return token;`
  early return, stays as "used". "env" stays. "var" stays. So
  we have a `used` query token. That's a generic verb; it
  doesn't help.
- The new env-var extractor returns env-var *names* from each
  file: e.g. `REDIS_URL`, `OPENAI_API_KEY`. We don't match
  those against the question tokens; instead we check the
  *count* of env-var references per file.
- Stage "env-var relevance" = `min(100, 10 × reference_count)`.
  This surfaces files with 3+ env-var references for a question
  that asks about env vars, with zero dependency on filename
  matching. A `process.env.X` regex pass costs ~1ms per file.

That's the only signal added in this design that doesn't follow
the "match question tokens" pattern. It's a one-line extension
to the symbol extractor and lives in the same file.

---

## 5. Wire-up changes

Three small edits to existing files. None of them touch Paritok,
OpenAI, the response shape, or the answer pipeline.

### 5.1 `lib/ranking/index.ts`

Add four new exports:

```ts
export { rankRelevantFilesUniversal } from "./universal";
export { extractSymbols, extractDocComment, extractEnvVarRefs } from "./symbols";
export { buildImportGraph, resolveImportPath } from "./graph";
export { inDegreeRanking, expandRelated } from "./popularity";
export type { UniversalRankOptions, UniversalRankResult } from "./universal";
```

### 5.2 `app/api/ask/route.ts`

Replace one import and one call site:

```ts
// before
import { fetchRankedFileContents, rankRelevantFilesHybrid } from "@/lib/ranking";
const ranked = await rankRelevantFilesHybrid(question, index.files, { fetchContent: ... });

// after
import { fetchRankedFileContents, rankRelevantFilesUniversal } from "@/lib/ranking";
const ranked = await rankRelevantFilesUniversal(question, index.files, { fetchContent: ... });
```

Net diff: ~10 lines in the route. The `hybridContentFetcher`
helper moves verbatim into the universal call (universal
re-exports the same `fetchContent: (path) => Promise<string|null>`
contract).

### 5.3 `types/ranking.ts`

Add the `UniversalRankResult` type (extends `RankResult`). No
changes to `RankResult`, `RankedFile`, or the existing weights.

---

## 6. Tunable thresholds (all defaults shown)

| Constant | Default | What it controls |
|---|---|---|
| `WEAK_SCORE_THRESHOLD` | 35 | Top metadata score below this → triggers content scan |
| `WEAK_FILE_COUNT_THRESHOLD` | 3 | Fewer than this many ranked files → triggers content scan |
| `CONTENT_SCAN_CAP` | 50 | Max files to fetch content for |
| `DOC_COMMENT_MAX_CHARS` | 1000 | How much of the comment block to read |
| `BODY_SCAN_MAX_CHARS` | 2000 | Reused from `content.ts` |
| `SYMBOL_MATCH_WEIGHT` | 0.6 | How heavily a symbol match is blended into the final score |
| `POPULARITY_BUMP_DIVISOR` | 4 | `bump = min(20, log2(inDegree+1) / divisor * 100)` — tbd; numbers below |
| `DOC_COMMENT_BODY_RATIO` | 1.2 | Doc-comment score is weighted this multiple of body score |
| `RELATED_BUMP` | 8 | Per-related-file additive bump |
| `RELATED_BUMP_CAP` | 20 | Maximum total related-file bump per file |
| `ENV_VAR_REF_BUMP_PER_REF` | 10 | Per env-var reference (capped at 100) |

All exposed on `UniversalRankOptions` with sensible defaults so
callers don't have to know any of them.

### 6.1 Workspace-alias map

`graph.ts` needs to resolve `@kindred/db` (and any other
workspace alias) to a real file path. Today the indexer doesn't
track workspace aliases, so we have two options:

- **(a) Detect at scan time** — when the import path starts with
  `@`, treat it as a workspace alias and match by *basename*
  across the candidate set. Cheap, no config needed.
- **(b) Plumb aliases through `IndexedFile`** — add an
  `importAliases?: string[]` field to `IndexedFile` populated by
  `lib/indexer/build-index.ts` from `package.json` `workspaces`.

I recommend (a) for the first cut. (b) is a separate, low-risk
follow-up if (a) is too lossy in practice.

### 6.2 Reusing the existing tokeniser

`tokenizeQuery` (in `lib/ranking/tokens.ts`) is reused verbatim
for matching symbol names against question tokens. The stemmer
already handles camelCase via the `tokenize()` step's
`[._/\\-]+` and `[a-z][A-Z]` splits. We don't need a separate
symbol stemmer.

### 6.3 What we do NOT do

- No embeddings. No vector DB. No LLM call. (Per the brief.)
- No AST parser. Regex only. (Per the brief; also keeps deps
  zero.)
- No write-through caching. Each `/api/ask` call rescans. The
  `IndexedFile` index from the GitHub API is already cached at
  the indexer level; the content scan is a separate cost we
  accept.
- No changes to `lib/retrieval/` (the parallel retrieval engine
  the ask pipeline doesn't use).

### 6.4 Forward compat: keep the same fetchContent contract

The `fetchContent` hook signature is unchanged:
`(path: string) => Promise<string | null>`. Universal reads
content in parallel up to `CONTENT_SCAN_CAP` files, same as
hybrid did. Per-file failures return `null` and are isolated.
The hook is the only I/O surface; everything else is pure.

---

## 7. Testing strategy

Three test files, all in `lib/ranking/__tests__/`:

1. **`symbols.test.ts`** (NEW) — extractor unit tests:
   - TypeScript: `export class AuthService` → `["AuthService"]`,
     `export function telegramIngestWorker` →
     `["telegramIngestWorker"]`, etc.
   - Doc-comment: extracts the first contiguous `//` block.
   - Env-vars: matches `process.env.REDIS_URL` →
     `["REDIS_URL"]`.
   - Python and Go regex paths (a few representative cases
     each).

2. **`graph.test.ts`** (NEW) — import resolution tests:
   - Relative imports (`./foo`, `../bar`).
   - Workspace aliases (`@kindred/db`) resolved by basename.
   - Files that are imported by many others.
   - Files that are not in the candidate set are dropped from
     the graph (so the graph is bounded by what we scanned).

3. **`universal.test.ts`** (NEW) — orchestrator tests:
   - Every brief-listed question has at least one match.
   - The questions that already worked (API routes) are
     unchanged.
   - "Telegram bot" finds `telegram-ingest.worker.ts`.
   - "Which files handle SSE?" finds `sse-listener.ts`.
   - "Where are environment variables used?" finds files
     with env-var references.
   - Reason strings include multiple signals.
   - Per-file failure is isolated (mocked hook returns null
     for one path; rest still rank).
   - The returned `RankResult` shape is byte-compatible with
     `rankRelevantFiles` (same keys, same types).

A **benchmark script** (`scripts/benchmark-universal.ts`,
cloned from `scripts/benchmark-hybrid.ts`) runs the same four
target questions plus the brief's 13 example questions against
the Kindred repo and prints a side-by-side report. Output is
captured to `benchmark-universal-output.txt` and committed so
the improvement is auditable.

### 7.1 Specific assertions to make the brief's questions green

Each of the brief's 13 questions must, in the unit test, return
a non-empty `ranked` list with the expected top-1:

| Question | Expected top-1 (from Kindred codebase) |
|---|---|
| "Explain the architecture" | `KINDRED_IMPLEMENTATION_BLUEPRINT.md` or `README.md` |
| "How does authentication work?" | `apps/web/app/api/auth/[...all]/route.ts` or `apps/web/lib/auth.ts` |
| "Where is caching implemented?" | A file with a `cache`/`Cache` symbol or `redis` reference |
| "How are users created?" | File that contains a `createUser` / `createMember` symbol |
| "What happens after login?" | The auth route + the file it calls |
| "How does data flow through the app?" | Entry-point file (`apps/agent/src/index.ts`) |
| "Where is the Telegram bot implemented?" | `telegram-ingest.worker.ts` or `extract-events.ts` |
| "Which files handle SSE?" | `apps/agent/src/minds/sse-listener.ts` |
| "What is the purpose of this project?" | `README.md` |
| "Explain the build pipeline." | `.github/workflows/ci.yml` (unchanged) |
| "Summarize this repository." | `README.md` (unchanged) |
| "How are API requests processed?" | `apps/web/app/api/insights/ask/route.ts` (or any route.ts) |
| "Where are environment variables used?" | File with the most `process.env.XXX` refs |
| "What database does this project use?" | The `prisma` client import — the file that re-exports it |

The mock fixture for these tests can be a small hand-written
list of 6–10 fake `IndexedFile`s with bodies, mimicking the
Kindred shapes. We don't need to fetch the real repo in unit
tests; the benchmark script does that.

---

## 8. Risks and open questions

| Risk | Mitigation |
|---|---|
| Regex-based symbol extraction misses real-world syntax (decorators, multi-line declarations, etc.) | The current `scoreContent` reads only the first 2000 chars; we read the first 3000 for the regex pass. Multi-line declarations like `export class Foo<T>` spanning lines 50–100 will be missed. Acceptable for v1 — comment blocks are the more reliable signal anyway. |
| Import path resolution for monorepos is fragile | We use basename matching for aliases and relative-path resolution for the rest. If a file is imported but not in the candidate set, the edge is dropped. |
| 50 file reads × N ms latency on a real repo | The reads are parallel (`Promise.all`). On a 200ms-RTT GitHub API that's 200ms total wall-clock. Acceptable for `/api/ask`. |
| A 50-file scan on a 5000-file repo doesn't cover everything | The candidate set is a deterministic alphabetic slice. A 5000-file repo with conceptual questions would be better served by a "scan the first 200 chars of every file's header" pre-pass — but that doubles the I/O. Out of scope for v1. |
| New `rankRelevantFilesUniversal` is async — same as `rankRelevantFilesHybrid` | No signature change for the metadata engine. No call site of the metadata engine has to change. |
| Reason strings get long and noisy in the UI | The UI already passes `reason` through as text. We can add a UI-side "max length 200" later. |
| We touch `/api/ask` route even though "Paritok / OpenAI / answer generation" is out of scope | Touching the *retrieval call site* inside the route is in scope (the brief says "improve the retrieval stage"). The route's compression, Paritok, and OpenAI calls are untouched. |

---

## 9. Estimated work breakdown

| Step | Effort | Notes |
|---|---|---|
| `lib/ranking/symbols.ts` | 1 unit | Regex + tests |
| `lib/ranking/graph.ts` | 0.5 unit | Resolution + tests |
| `lib/ranking/popularity.ts` | 0.5 unit | In-degree + related expansion |
| `lib/ranking/universal.ts` | 1.5 units | Orchestrator, all stages |
| Wire into `app/api/ask/route.ts` | 0.25 unit | 1 import + 1 call site |
| `lib/ranking/index.ts` updates | 0.1 unit | Re-exports |
| `scripts/benchmark-universal.ts` | 0.25 unit | Cloned from hybrid benchmark |
| Tests (3 files) | 1.5 units | Including the 13-question fixture |
| Run tsc / lint / tests / build | 0.25 unit | Verification |
| Re-run benchmark against Kindred | 0.25 unit | Capture output |
| Commit + push | 0.1 unit | Single commit |
| **Total** | **~6 units** | Comparable to the previous turn |

---

## 10. Decision points for you

1. **Keep `rankRelevantFilesHybrid` in place as a back-compat
   alias, or delete it?** I recommend keeping it; the tests stay
   green and any external consumer (none today, but possible
   later) keeps working.

2. **Default `CONTENT_SCAN_CAP` to 50 (was 25 in hybrid).** This
   is the right number to cover the 13 brief questions on a
   mid-size repo, but it doubles the I/O cost. Open to feedback.

3. **Use basename matching for workspace aliases in v1 (option
   (a) in §6.1).** I think this is right; plumbing aliases
   through the indexer is a separate, low-priority follow-up.

4. **Single `rankRelevantFilesUniversal` entry point vs. an
   opt-in flag on `rankRelevantFilesHybrid`.** I prefer a new
   function. The new behavior is strictly additive, but the
   return shape now includes multi-signal reasons, and that
   changes UI output. Calling it out explicitly in a new
   function is cleaner than overloading the old one.

5. **Should the `RankResult.reason` field become a list of
   signals (e.g. `reasons: string[]`) rather than a single
   string?** That's a breaking change to `RankResult`. I would
   keep `reason` as a single, semicolon-joined string for v1
   (zero downstream impact) and revisit in v2.

---

*End of design document. Awaiting approval before any code is
written.*
