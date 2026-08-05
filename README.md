<div align="center">
  <img src="public/assets/logo.png" alt="RepoLens" width="420" />
</div>

# RepoLens

> Understand any codebase with fewer tokens.

RepoLens helps developers understand any GitHub repository by intelligently
retrieving only the relevant code, compressing it through **Paritok**, and
generating accurate answers — all while using significantly fewer tokens than
sending entire repositories to an LLM.

Paritok is the core optimization layer of this project — not an afterthought.

Built for the **Build with Paritok: The Token-Efficiency Hackathon**.

---

## Features

- **Analyze any public GitHub repository** — enter a repo URL and start asking questions
- **Intelligent repository indexing** — static analysis builds a rich metadata layer over every file
- **Universal Retrieval Engine** — combines multiple lightweight retrieval strategies without embeddings or vector databases
- **Symbol extraction** — identifies classes, functions, types, and exports across the codebase
- **Import graph analysis** — maps dependency chains to surface transitively relevant files
- **Popularity-based ranking** — scores files by how frequently they're imported or referenced
- **Related-file expansion** — broadens results to include sibling modules and co-located utilities
- **Hybrid ranking pipeline** — fuses metadata, content, symbol, graph, and popularity signals into a single relevance score
- **Context compression with Paritok** — token-level compression that preserves meaning while reducing context size
- **AI-powered repository Q&A** — ask natural language questions and get grounded answers from the actual codebase
- **Interactive repository exploration** — browse files, language breakdown, commit history, and file tree
- **Clean Next.js interface** — responsive, fast, and minimal

---

## Architecture

```
GitHub Repository
        ↓
Repository Analysis
  (metadata, tree, commits)
        ↓
Repository Index
  (file list, language map, ignore rules)
        ↓
Universal Retrieval Engine
  ├── Metadata ranking
  ├── Conceptual doc boost
  ├── Symbol search
  ├── Import graph traversal
  ├── Popularity scoring
  ├── Body keyword coverage
  ├── Doc-comment keyword coverage
  ├── Env-var relevance
  └── Related-file expansion
        ↓
    Hybrid ranking
        ↓
  Context Builder
        ↓
Paritok Compression
        ↓
      OpenAI
        ↓
Answer Generation
```

Retrieval happens **before** Paritok compression. The Universal Retrieval
Engine selects only the most relevant files for the specific question, then
Paritok compresses that already-narrow context to minimize token usage before
sending it to the LLM.

---

## Universal Retrieval

RepoLens replaces traditional embedding-based retrieval with a set of
lightweight, composable strategies that work without vector databases or
external services:

| Strategy | What it does |
|---|---|
| **Metadata ranking** | Scores files based on filename, folder path, file extension, and keyword frequency |
| **Conceptual doc boost** | Surfaces README, architecture docs, and design docs for high-level questions |
| **Symbol search** | Finds files that define or reference specific classes, functions, types, and exports |
| **Import graph traversal** | Follows dependency chains to include upstream imports and downstream dependents |
| **Popularity scoring** | Ranks files by import in-degree — files referenced by many others are structurally important |
| **Body keyword coverage** | Scans file contents for question-relevant keywords |
| **Doc-comment keyword coverage** | Weighted 1.2× body coverage for JSDoc/TSDoc blocks (denser signal than body text) |
| **Env-var relevance** | Surfaces files that reference `process.env` for config-related questions |
| **Related-file expansion** | Adds sibling modules and co-located utilities from the import graph |

All signals are combined in a single deterministic pass with bounded I/O —
at most 50 files are read per call, in parallel, with per-file failure
isolation.

This approach handles conceptual questions effectively:

- *"Explain the architecture"*
- *"How does routing work?"*
- *"Where is authentication handled?"*
- *"How does data flow through the system?"*
- *"Where are environment variables used?"*
- *"Summarize this repository"*

Without requiring embeddings, vector stores, or expensive pre-computation.
See [docs/universal-retrieval-design.md](docs/universal-retrieval-design.md)
for the full design document.

---

## Token Efficiency

```
Repository
    ↓
Retrieve only relevant files
  (Universal Retrieval Engine)
    ↓
Build context
  (Context Builder — formatting, truncation, file markers)
    ↓
Compress with Paritok
  (token-level optimization — remove noise, preserve semantics)
    ↓
Send optimized prompt
    ↓
Generate answer
  (OpenAI)
```

Traditional approaches send entire repositories — or large file subsets —
to the LLM, burning thousands of tokens on files irrelevant to the question.
RepoLens applies a two-stage optimization:

1. **Retrieval** — the Universal Retrieval Engine narrows the repository to the most relevant files for the specific query
2. **Compression** — Paritok compresses the retrieved context, preserving semantic meaning while removing redundant tokens

The result is a dramatically smaller prompt that still contains all the
information the model needs to answer accurately.

---

## Tech Stack

- **Framework:** Next.js 15 (App Router)
- **Language:** TypeScript (strict)
- **UI:** Tailwind CSS, Lucide React icons
- **Testing:** Vitest
- **Formatting:** Prettier, ESLint
- **Compression:** [Paritok](https://www.paritok.com/)
- **AI:** OpenAI API
- **GitHub Integration:** GitHub REST API (metadata, tree, commits)

---

## Repository Structure

```
repolens/
├── app/                          # Next.js App Router
│   ├── about/                    # About page
│   ├── analyze/                  # Repository analysis page
│   ├── ask/                      # Q&A conversation page
│   ├── dev/paritok/              # Paritok dev mock page
│   └── api/
│       ├── analyze/              # POST — analyze a repository
│       ├── ask/                  # POST — ask a question
│       ├── health/               # GET — health check
│       └── dev/
│           ├── openai/           # Dev OpenAI endpoint
│           └── paritok/          # Dev Paritok endpoint
├── components/                   # React components
│   ├── about/                    # About page sections
│   ├── analyze/                  # Analysis UI components
│   └── ask/                      # Q&A UI components
├── docs/                         # Documentation
├── hooks/                        # React hooks (useRepoAnalysis)
├── lib/
│   ├── api/                      # Client-side API helpers
│   ├── brand/                    # Colors and branding
│   ├── cache.ts                  # Session-scoped result cache
│   ├── config/                   # Configuration constants
│   ├── context/                  # Context Builder — assembles context packages
│   ├── github/                   # GitHub API client, URL parser
│   ├── indexer/                  # Repository analysis and indexing
│   ├── integrations.ts           # Integration utilities
│   ├── log/                      # Structured logging
│   ├── mock-*.ts                 # Mock data for development
│   ├── openai/                   # OpenAI client and types
│   ├── paritok/                  # Paritok compression service
│   ├── pipeline/                 # Context Builder → Paritok orchestrator
│   ├── ranking/                  # Universal Retrieval Engine
│   │   ├── universal.ts          #   Orchestrator (all signals)
│   │   ├── hybrid.ts             #   Hybrid ranking combiner
│   │   ├── rank.ts               #   Metadata-based ranking
│   │   ├── scoring.ts            #   Individual scoring signals
│   │   ├── symbols.ts            #   Symbol extraction and search
│   │   ├── graph.ts              #   Import graph construction and traversal
│   │   ├── popularity.ts         #   In-degree ranking and related-file expansion
│   │   ├── content.ts            #   Body keyword coverage
│   │   ├── tokens.ts             #   Query tokenization
│   │   ├── explain.ts            #   Rank reason explanations
│   │   └── cache.ts              #   Ranking cache
│   ├── repo/                     # Repository loading
│   └── search/                   # Local file search
├── public/                       # Static assets
├── styles/                       # Global styles
└── types/                        # Shared TypeScript types
```

---

## Documentation

- [Universal Retrieval Design](docs/universal-retrieval-design.md) — full design document for the retrieval engine
- [Architecture Overview](docs/ARCHITECTURE.md) — high-level system architecture
- [Deployment Guide](docs/DEPLOYMENT.md) — environment variables, build commands, troubleshooting
- [Startup Checklist](docs/STARTUP-CHECKLIST.md) — step-by-step deployment verification
- [Ranking Engine](lib/ranking/README.md) — scoring signals, API, extensibility
- [Context Builder → Paritok Pipeline](lib/pipeline/README.md) — orchestrator flow and API
- [Paritok Compression Service](lib/paritok/README.md) — request/response format, error handling

---

## Getting Started

### Prerequisites

- Node.js 18+
- npm
- An OpenAI API key
- A [Paritok](https://www.paritok.com/) API key
- A GitHub personal access token (for higher rate limits)

### Installation

```bash
git clone https://github.com/hasbunallah01/RepoLens.git
cd repolens
npm install
```

### Configuration

Copy the environment template and fill in your keys:

```bash
cp .env.example .env.local
```

Required variables:

```env
OPENAI_API_KEY=your_openai_api_key
PARITOK_API_KEY=your_paritok_api_key
GITHUB_TOKEN=your_github_token
```

### Running

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Scripts

```bash
npm run dev          # Start dev server
npm run build        # Production build
npm run start        # Start production server
npm run type-check   # TypeScript type-check
npm run lint         # ESLint
npm run format       # Prettier
npm test             # Run Vitest test suite
npm run test:watch   # Vitest in watch mode
```

---

## Demo

1. **Analyze a repository** — paste a public GitHub repository URL into the analyze page
2. **Ask questions** — try questions like:
   - "How does authentication work?"
   - "Explain the overall architecture"
   - "Where is the database connection configured?"
3. **Observe the pipeline** — RepoLens retrieves only the relevant files, compresses them with Paritok, and generates an answer grounded in the actual codebase

The retrieval step is transparent — you can see which files were selected
and how they were ranked before compression occurs.

---

## Hackathon

RepoLens was built for the **Build with Paritok: The Token-Efficiency Hackathon**
to demonstrate **retrieval-first AI** for code understanding.

The key insight: instead of sending entire repositories to an LLM and hoping
the model finds the right files, RepoLens retrieves the relevant context
*first*, then uses Paritok to minimize token usage on the already-optimized
selection.

This two-stage approach — intelligent retrieval followed by compression —
delivers more accurate answers at a fraction of the token cost of naive
full-repository ingestion. The Universal Retrieval Engine combines metadata,
symbol extraction, import graph traversal, popularity scoring, content
analysis, and related-file expansion into a single deterministic pipeline
that requires no embeddings, no vector databases, and no external services.

Paritok sits at the core of this pipeline, compressing the retrieved context
to maximize token efficiency without sacrificing answer quality.

---

## License

Released under the [Apache License 2.0](./LICENSE).

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md).
