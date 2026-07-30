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
│  │  (Phase 1 ✓) │  │  (Phase 2)   │  │  /api/health ✓    │  │
│  └──────────────┘  └──────────────┘  └──────────────┬──────┘  │
└─────────────────────────────────────────────────────┼────────┘
                                                      │
                  ┌───────────────────────────────────┘
                  ▼
        ┌─────────────────────┐
        │  Retrieval Engine   │  ◀── GitHub API (Phase 2)
        │  (file selection)   │
        └──────────┬──────────┘
                   │
                   ▼
        ┌─────────────────────┐
        │  Paritok Optimizer  │  ◀── Paritok API (Phase 2/3)
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
- **Future integrations (placeholders in Phase 1):** GitHub API · Paritok · OpenAI

### Repository Layout

```
app/         # App Router routes (home, about, future /analyze, /chat)
components/  # Reusable presentational components
lib/         # Pure utilities and integration placeholders
types/       # Shared TypeScript types
public/      # Static assets
styles/      # Global styles (currently in app/globals.css)
docs/        # Additional documentation
```

---

## Development Roadmap

| Phase | Scope | Status |
|------:|-------|--------|
| **1** | Project foundation & scaffolding (UI shell, design system, docs) | ✅ In progress |
| **2** | GitHub repository ingestion + smart retrieval of relevant files | 🔜 Planned |
| **3** | Paritok integration, OpenAI Q&A, prompt analytics dashboard | 🔜 Planned |
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

> The current build only renders the home and about pages. Analysis,
> Paritok optimization, and AI Q&A are intentionally not implemented yet —
> they arrive in Phase 2 and Phase 3.

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
