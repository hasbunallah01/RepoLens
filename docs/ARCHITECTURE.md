# RepoLens Architecture

RepoLens is a Next.js 15 (App Router) application. This document captures the
high-level shape of the project as it stands today and where each subsystem
will plug in.

## Layered Pipeline (planned)

1. **Ingestion** — fetch repository contents via the GitHub API.
2. **Indexing** — build a lightweight structural index (file tree, language
   hints, symbols).
3. **Retrieval** — for a given question, pick the smallest set of files /
   snippets that can answer it.
4. **Optimization** — push the retrieved context through Paritok to compress
   redundant or low-signal content.
5. **Generation** — call an LLM (OpenAI) with the optimized context.
6. **Analytics** — record token counts before/after Paritok and surface the
   savings.

## Phase status

| Phase | Status | What it adds |
|-------|--------|--------------|
| 1 — Scaffold | ✅ done | App shell, components, types. |
| 2 — GitHub engine | ✅ done | URL parsing, metadata + tree fetch, `RepoIndex`. |
| 3A — Question UI | ✅ done | Mock ask panel (`lib/ask/mock.ts`). |
| 3B — Local retrieval | ✅ done | `retrieveRelevantFiles` in `lib/retrieval/`. Pure heuristics, no AI. |
| 4 — Paritok | ⏳ planned | Token compression of retrieved context. |
| 5 — LLM | ⏳ planned | Generation step that consumes retrieved + compressed context. |

## Retrieval (Phase 3B)

The retrieval engine is a pure function over the file metadata produced by
the indexer. It uses a small set of heuristic signals — filename match,
folder match, path-keyword frequency, extension hints, and README
references — and ranks files by a weighted blend of those signals. The
output is a `RetrievalResult` with each match carrying a 0–100 score and a
short human-readable reason.

The engine has **no AI dependencies**: no embeddings, no vector DB, no LLM
calls. Future phases can layer Paritok and an LLM on top without changing
the retrieval contract.

## Why Paritok is Core

Treating Paritok as a first-class pipeline stage — not a post-processing
trick — is the entire point of RepoLens. Every other stage exists to make
the input to Paritok as high-signal as possible so its output is small,
relevant, and cheap to send to a model.

## Folder Map

| Folder | Purpose |
|--------|---------|
| `app/` | App Router routes (pages, layouts, API routes) |
| `components/` | Reusable presentational components |
| `lib/` | Pure utilities + integration placeholders |
| `lib/github/` | GitHub ingestion (URL parsing, REST client, tree). |
| `lib/indexer/` | Build the `RepoIndex` from a raw tree. |
| `lib/search/` | Substring/facet search over the index. |
| `lib/retrieval/` | **Phase 3B** — heuristic retrieval engine. |
| `types/` | Shared TypeScript types |
| `public/` | Static assets served at the site root |
| `docs/` | Project documentation |
