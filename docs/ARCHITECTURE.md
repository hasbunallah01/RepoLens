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
| `types/` | Shared TypeScript types |
| `public/` | Static assets served at the site root |
| `docs/` | Project documentation |
