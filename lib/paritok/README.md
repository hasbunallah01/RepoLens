# Paritok Compression Service (Phase 4A)

A small, deterministic service that takes a **Context Package** (Phase 3D1)
and asks [Paritok](https://www.paritok.com/) to compress it before any
future AI request is made.

The service is **completely self-contained**:

- it does **not** call OpenAI or any other LLM,
- it does **not** summarise, rewrite, or rank the input itself,
- it does **not** cache responses,
- it does **not** integrate with the existing UI yet (that's Phase 4B),
- it does **not** modify the Context Builder or the ranking engine.

It just translates a `ContextPackage` into the JSON Paritok expects,
POSTs it to the compression endpoint, and returns a strongly typed
result. The rest of RepoLens (route handlers, server actions, the
future LLM call) reads the result and never has to know about
`fetch`, timeouts, or environment variables.

## Public API

```ts
import { compressContextPackage } from "@/lib/paritok";
import { mockAuthContext } from "@/lib/context/mock";

const { result: ctx } = mockAuthContext("How does authentication work?");
const compressed = await compressContextPackage(ctx.package);

if (compressed.ok) {
  console.log(compressed.data.compressed);       // Paritok's output
  console.log(compressed.data.gpu_available);    // was GPU used?
} else {
  console.error(compressed.error.code, compressed.error.message);
}
```

## Configuration

Set the API key in your environment (e.g. `.env.local`):

```bash
PARITOK_API_KEY=...
```

The service refuses to make a request if `PARITOK_API_KEY` is missing
or blank and returns:

```ts
{ ok: false, error: { code: "MISSING_API_KEY", message: "..." } }
```

The endpoint defaults to `https://www.paritok.com/api/compress` and
can be overridden per call via `options.endpoint` (used by tests
and the dev mock page to point at a stub server).

## Request format

The service maps a `ContextPackage` into the body Paritok expects:

```json
{
  "content": "==== file: src/auth/auth.service.ts ====\n...",
  "query":   "How does authentication work?",
  "kind":    "file_read"
}
```

- `content` — concatenation of every file body in the package, in
  rank order, each prefixed with an attribution header. The header
  uses `==== file: <path> ====` which is safe across every common
  source language (TypeScript, Python, Go, …).
- `query` — the user's original question.
- `kind` — `file_read` by default. Future callers can override
  this for log / docs / directory compression without changing the
  client.

## Response format

```ts
interface ParitokCompressionResult {
  compressed: string;     // the compressed content
  gpu_available: boolean; // was the GPU backend used?
  clientId?: string;      // echoed back from the request
  schemaVersion?: string; // bumped when the shape changes
}
```

## Error handling

The service never throws for expected failure modes. Every public
entry point returns a discriminated union:

```ts
type ParitokServiceResult =
  | { ok: true;  data: ParitokCompressionResult }
  | { ok: false; error: { code: ParitokErrorCode; message: string; status?: number } };
```

Codes:

| Code              | When it fires                                            |
|-------------------|----------------------------------------------------------|
| `MISSING_API_KEY` | `PARITOK_API_KEY` is not set.                            |
| `NETWORK`         | The HTTP call never completed.                           |
| `API_ERROR`       | Paritok returned a non-2xx status.                       |
| `INVALID_RESPONSE`| Paritok returned a 2xx but the body was not JSON.        |
| `MISSING_FIELDS`  | The response JSON was missing `compressed`/`gpu_available`. |
| `ABORTED`         | The caller aborted the request via `options.signal`.     |
| `TIMEOUT`         | The request exceeded `options.timeoutMs` (default 20s).  |

## File contents

```
lib/paritok/
├── client.ts   # HTTP client, request mapping, response parsing
├── types.ts    # Strongly typed request/response/options shapes
├── index.ts    # Public re-exports — import from here
└── README.md   # This file
```

## Extensibility

New fields on the request or response are additive. Renaming or
removing fields requires bumping `PARITOK_SCHEMA_VERSION` so the
rest of RepoLens can detect the change.

## Testing

Tests live in `lib/paritok/__tests__/`. They cover:

- API key resolution from env / override,
- request body shape (content, query, kind, clientId),
- success path parsing (`compressed`, `gpu_available`),
- every error code (`MISSING_API_KEY`, `NETWORK`, `API_ERROR`,
  `INVALID_RESPONSE`, `MISSING_FIELDS`, `ABORTED`, `TIMEOUT`),
- the dev mock page round-trip.

## Dev mock page

`app/dev/paritok/page.tsx` is a small development utility that
runs the full pipeline against the mock auth repo:

1. Build a `ContextPackage` from `lib/context/mock`.
2. Send it to Paritok.
3. Show the compressed output in the browser console and on the
   page.

It is **for development only** and is not linked from the main
navigation.
