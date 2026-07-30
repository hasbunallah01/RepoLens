# Ranking engine (Phase 3C1)

A small, model-free ranking engine that scores and sorts files for a
given question. The engine is **completely local**: no embeddings, no
vector DB, no LLM call. Just deterministic heuristics over file
metadata.

## Public API

```ts
import { rankRelevantFiles } from "@/lib/ranking";

const result = rankRelevantFiles(
  "How does authentication work?",
  indexedFiles,
);
//   result.ranked[0].file.path -> "src/auth/auth.service.ts"
//   result.ranked[0].score     -> 96
```

The returned `RankResult` shape is:

```ts
interface RankResult {
  question: string;          // original question
  ranked: RankedFile[];      // highest score first
  totalCandidates: number;   // how many files were considered
  weights: RankSignalWeights; // active weights, for debugging/UI
}

interface RankedFile {
  file: IndexedFile;
  score: number;             // 0..100 integer
}
```

## Scoring signals

Every candidate file is scored on four independent signals, each
producing a value in `[0, 100]`:

| Signal             | What it measures                                              |
| ------------------ | ------------------------------------------------------------- |
| Filename           | How well the filename matches the question                    |
| Folder             | How well the folder path matches the question                 |
| Keyword frequency  | How many question tokens appear in the file's full path       |
| File extension     | Small boost when the extension matches the question topic     |

The final score is a weighted blend of the four signals, rescaled to a
single 0..100 integer. Default weights are tuned for a balanced bias:

```ts
{ filename: 40, folder: 20, keywordFrequency: 30, extension: 10 }
```

Callers can override individual weights via `RankOptions.weights`.

## Independence

The ranking engine is intentionally **independent** from the retrieval
engine (`lib/retrieval`, Phase 3B). The two engines:

- do not import from each other,
- ship their own tokenizers (kept in sync today, but free to diverge),
- maintain their own type definitions (`types/ranking.ts` vs
  `types/retrieval.ts`).

This keeps the two engines on separate timelines and lets future phases
add new signals to the ranking engine (e.g. recency, popularity) without
churning the retrieval code.

## Extensibility

Future phases can add a new scoring signal in three small steps:

1. Add a new field to `RankSignalWeights` in `types/ranking.ts` and a
   default value in `DEFAULT_RANK_WEIGHTS`.
2. Add a new `scoreXxx` function to `lib/ranking/scoring.ts`.
3. Call it from `aggregate()` in `lib/ranking/rank.ts` and add the
   weight to the `mergeWeights` defaults.

The shape of the output (`{ file, score }[]`) is stable, so downstream
consumers (Paritok, the LLM, the UI) don't have to change.

## Testing

```sh
npm test
```

Tests live in `lib/ranking/__tests__/` and cover tokenization, each
scoring signal in isolation, and the end-to-end `rankRelevantFiles`
behaviour.
