# Context Builder (Phase 3D1)

A small, deterministic service that takes the highest-ranked files
from the local ranking engine and assembles a clean **Context
Package** for future optimization engines (e.g. Paritok, Phase 4).

The builder is **completely passive**:

- it does **not** summarize, compress, or rewrite file contents,
- it does **not** call any AI / LLM / embedding service,
- it does **not** integrate with Paritok,
- it does **not** touch the network or the filesystem,
- it does **not** modify the existing retrieval / ranking pipeline.

It just reads file contents and packages them.

## Public API

```ts
import {
  buildContextPackage,
  FileContentRegistry,
  getDefaultContentRegistry,
} from "@/lib/context";

const registry = getDefaultContentRegistry();
registry.set("src/auth/auth.service.ts", sourceCode);

const { package: ctx, errors } = buildContextPackage(
  "How does authentication work?",
  rankedFiles,
  {
    fullName: "owner/repo",
    defaultBranch: "main",
    primaryLanguage: "TypeScript",
    builtAt: new Date().toISOString(),
  },
  { limit: 5 },
);

console.log(ctx.files[0].path);     // "src/auth/auth.service.ts"
console.log(ctx.files[0].content);  // full source, as-is
console.log(ctx.files[0].score);    // ranking score 0..100
```

## Output shape

```ts
interface ContextPackage {
  version: "3D1";
  question: string;                   // echoed back
  repository: ContextRepositoryInfo;  // fullName, defaultBranch, ...
  files: ContextFileEntry[];          // top-N ranked files, in rank order
  totalCandidates: number;            // how many files the ranking engine saw
  selectedCount: number;              // == files.length
  limit: number;                      // effective limit
}

interface ContextFileEntry {
  path: string;
  name: string;
  extKey: string;
  language: string;
  content: string;                    // full file contents, unchanged
  score: number;                      // from the ranking engine
  reason: string;                     // from the ranking engine
  metadata: IndexedFile;              // full IndexedFile for full-fidelity access
}
```

## File contents

The builder never reads from disk or the network itself. It looks up
file contents via a small `FileContentRegistry` abstraction:

- `"indexer"` (default): the production indexing pipeline registers
  file contents into `getDefaultContentRegistry()` before calling the
  builder.
- `"inline"`: the caller supplies a `Map<path, string>` directly. Used
  by the tests and the mock demo entry point.

Missing or unreadable files are **not fatal**: they are reported in
`result.errors` and skipped. The rest of the package is still
returned so downstream optimizers always have something to work with.

## Independence

The Context Builder is intentionally independent from:

- the retrieval engine (`lib/retrieval`),
- the ranking engine (`lib/ranking`),
- any future optimization engine (Paritok, etc.).

The only thing it imports from the ranking engine is its **output
type** (`RankedFile`). It does not import its implementation. This
means a future ranking refactor that keeps the type shape stable
will not break the Context Builder.

## Extensibility

New fields on `ContextPackage` or `ContextFileEntry` are additive —
downstream consumers should ignore unknown fields. Renaming or
removing fields requires bumping the `version` literal.

## Testing

```sh
npm test
```

Tests live in `lib/context/__tests__/` and cover:

- the default `limit=5` selection rule,
- the `limit` option being honored,
- the package structure for every required field,
- the inline content source,
- the indexer content source,
- error reporting when a file has no registered content,
- the mock demo entry point producing a sensible package.
