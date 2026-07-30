# RepoLens

> Understand any codebase with fewer tokens.

RepoLens helps developers understand any GitHub repository by retrieving only
the relevant code before sending requests through **Paritok**, reducing token
usage while maintaining answer quality.

Built for the **Build with Paritok: The Token-Efficiency Hackathon**.

---

## Vision

Developers waste money and time because AI assistants repeatedly receive huge
amounts of repository context that isn't actually needed. RepoLens treats token
efficiency as a first-class concern: we analyze the structure of a repo,
retrieve only the slices of code that matter for a given question, and then
optimize that context through Paritok before any model is called.

**Paritok is the core optimization layer of this project — not an afterthought.**

---

## Planned Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Next.js 15 App                       │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────────────┐  │
│  │  Home / About│  │  Analyze UI  │  │   API Routes      │  │
│  │  (Phase 1 ✓) │  │  (Phase 2 ✓) │  │  /api/health ✓    │  │
│  │              │  │              │  │  /api/analyze ✓   │  │
│  └──────────────┘  └──────────────┘  └──────────────┬──────┘  │
└─────────────────────────────────────────────────────┼────────┘
                                                      │
                  ┌───────────────────────────────────┘
                  ▼
        ┌─────────────────────┐
        │  GitHub API Client  │  ◀── Phase 2 ✓
        │  (metadata+tree)    │      metadata, tree, commits
        └──────────┬──────────┘
                   │
                   ▼
        ┌─────────────────────┐
        │  Indexer            │  ◀── Phase 2 ✓
        │  (filter + language)│      ignore rules, language map
        └──────────┬──────────┘
                   │
                   ▼
        ┌─────────────────────┐
        │  Local Search       │  ◀── Phase 2 ✓
        └──────────┬──────────┘
                   │
                   ▼
        ┌─────────────────────┐
        │  Paritok Optimizer  │  ◀── Paritok API (Phase 3)
        │  (token reduction)  │
        └──────────┬──────────┘
                   │
                   ▼
        ┌─────────────────────┐
        │   LLM (OpenAI)      │  ◀── OpenAI (Phase 3)
        └──────────┬──────────┘
                   │
                   ▼
        ┌─────────────────────┐
        │  Prompt Analytics   │  ◀── Phase 3
        └─────────────────────┘
```

### Tech Stack

- **Frontend:** Next.js 15 (App Router) · TypeScript (strict) · Tailwind CSS
- **Backend:** Next.js API Routes
- **Phase 2 integrations:** GitHub REST API (metadata, tree, commits)
- **Future integrations (placeholders in Phase 1):** Paritok · OpenAI

### Repository Layout

```
app/         # App Router routes (home, about, analyze, api/analyze)
components/  # Reusable presentational + analyze components
lib/         # Pure utilities
  github/    # URL parser, API client, typed endpoints
  indexer/   # Ignore rules, language map, build-index
  search/    # Local file search
  cache.ts   # Session-scoped result cache
hooks/       # useRepoAnalysis
types/       # Shared TypeScript types
public/      # Static assets
styles/      # Global styles (currently in app/globals.css)
docs/        # Additional documentation
```

---

## Development Roadmap

| Phase | Scope | Status |
|------:|-------|--------|
| **1** | Project foundation & scaffolding (UI shell, design system, docs) | ✅ Done |
| **2** | GitHub repository ingestion + smart retrieval of relevant files | ✅ Done |
| **3A** | Question interface (textarea, examples, char counter, recent list) | ✅ Done |
| **3B** | Paritok-powered retrieval + OpenAI Q&A | 🔜 Planned |
| **3C** | Prompt analytics dashboard | 🔜 Planned |
| **4** | Polish, deploy, demo for hackathon submission | 🔜 Planned |

---

## Getting Started

```bash
# Install dependencies
npm install

# Run the dev server
npm run dev

# Type-check, lint, and format
npm run type-check
npm run lint
npm run format
```

Then open <http://localhost:3000>.

> The current build renders the home, about, analyze, and ask pages. Phase 2
> fetches repository metadata + tree from the GitHub API, filters out noise
> (binaries, lockfiles, build output, etc.), and provides local search.
> Phase 3A adds the question interface at `/ask` — a focused developer panel
> with a large textarea, example prompts, character counter, and a sidebar
> of recent questions. Submissions are echoed to the browser console only;
> Paritok optimization and AI Q&A are intentionally not implemented yet —
> they arrive in Phase 3B.

---

## Built for the Build with Paritok Hackathon

RepoLens is a hackathon project. The goal is to demonstrate that a
deliberately small, Paritok-aware retrieval pipeline can deliver the same
answer quality as a "throw the whole repo at the LLM" approach, at a fraction
of the token cost.

---

## License

Released under the [Apache License 2.0](./LICENSE).

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md).
