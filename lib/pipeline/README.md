# Context Builder → Paritok pipeline (Phase 4B1)

A thin orchestrator that wires together the two independent
subsystems that already exist in RepoLens:

- **Context Builder** (Phase 3D1, `lib/context/`) — assembles a
  clean `ContextPackage` from the user's question and the
  ranked files.
- **Paritok compression service** (Phase 4A, `lib/paritok/`) —
  POSTs the `ContextPackage` to Paritok and returns the compressed
  content.

The pipeline does **not** re-implement either side. It only
orchestrates them.

## Flow

```
ranked files  →  Context Builder  →  ContextPackage  →  Paritok  →  compressed
                  (build-context)                       (compressContextPackage)
```

## Public API

```ts
import { compressContext } from "@/lib/pipeline";
import { rankRelevantFiles } from "@/lib/ranking";
import { mockFileContents, mockIndexedFiles, mockRepository } from "@/lib/context/mock";

const ranked = rankRelevantFiles(
  "How does authentication work?",
  mockIndexedFiles,
).ranked;

const result = await compressContext(
  "How does authentication work?",
  ranked,
  mockRepository,
  { contents: mockFileContents, limit: 5 },
);

console.log(result.package.files.length); // e.g. 5
if (result.compressed.ok) {
  console.log(result.compressed.data.compressed);
} else {
  console.error(result.compressed.error.code, result.compressed.error.message);
}
```

## Options

`CompressContextOptions` is a flat bag. Every field is optional and
has a safe default.

| Field | Forwarded to | Default |
|------|--------------|---------|
| `limit` | Context Builder | `5` |
| `contentSource` | Context Builder | `"inline"` |
| `contents` | Context Builder | — |
| `kind` | Paritok | `"file_read"` |
| `timeoutMs` | Paritok | `20 000` |
| `signal` | Paritok | — |
| `endpoint` | Paritok | `https://www.paritok.com/api/compress` |
| `apiKey` | Paritok | `process.env.PARITOK_API_KEY` |

## Result

`CompressContextResult` always contains the Context Package, even
if Paritok failed — so callers can decide whether to fall back to
the raw package or surface the error.

```ts
interface CompressContextResult {
  package: ContextPackage;       // always defined
  contextErrors: ContextError[]; // non-fatal file-resolution errors
  compressed: ParitokServiceResult; // { ok: true, data } | { ok: false, error }
}
```

## Independence

- No LLM / AI imports.
- No duplication of the Context Builder's logic or the Paritok
  client's logic.
- No direct `fetch` calls; the Paritok leg fully owns the HTTP
  surface.
- The Context and Paritok modules continue to work standalone.

## Extensibility

Future phases (4B2, 4C, 5, …) can compose `compressContext()` with
other steps (metrics, caching, LLM call) without changing this
module.

## File contents

```
lib/pipeline/
├── compress-context.ts   # orchestrator
├── types.ts              # options + result types
├── index.ts              # public re-exports
└── README.md             # this file
```

## Testing

```sh
npm test
```

Unit tests live in `lib/pipeline/__tests__/`. They stub `fetch`
(via `vi.stubGlobal`) and verify that:

- the Context Package produced upstream is forwarded to Paritok
  unchanged (same `question`, same `files`, same `repository`),
- the documented Paritok response is parsed and returned,
- the pipeline surfaces every Paritok error code without throwing.

A temporary development test script also lives at
`scripts/dev-pipeline-4b1.ts` — run it with

```sh
npx tsx scripts/dev-pipeline-4b1.ts
```

to see the full `Context Package → Paritok → Compressed Context`
flow run live and log the result to the console.
