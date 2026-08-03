/**
 * Tests for the Backend 8A additions to the indexer:
 *   - `directoryCount` on the `RepoIndex` returned by `buildIndex`
 *   - `linesOfCode` estimation (via `estimateLinesOfCode`)
 *
 * Both additions reuse the same `IndexedFile[]` shape the rest of
 * the indexer already operates on, so the tests only need a small
 * synthetic `RawTree` to exercise the code paths.
 */

import { describe, expect, it } from "vitest";
import { buildIndex } from "@/lib/indexer/build-index";
import { estimateLinesOfCode, estimateLinesForFile } from "@/lib/indexer/lines-of-code";
import type { IndexedFile } from "@/types/repository";

// `RawTree` lives in `@/lib/github/api` as an unexported shape. We
// mirror the slice the indexer actually consumes so the test
// stays self-contained.
interface RawTree {
  sha: string;
  url: string;
  truncated: boolean;
  tree: Array<{
    path: string;
    mode: string;
    type: "blob" | "tree";
    sha: string;
    size?: number;
    url: string;
  }>;
}

function makeTree(
  entries: Array<{ path: string; size?: number; type?: "blob" | "tree" }>,
): RawTree {
  return {
    sha: "fake-sha",
    url: "https://example.invalid",
    truncated: false,
    tree: entries.map((e) => ({
      path: e.path,
      mode: "100644",
      type: e.type ?? "blob",
      sha: `sha-${e.path}`,
      size: e.size ?? 100,
      url: `https://example.invalid/${e.path}`,
    })),
  };
}

describe("buildIndex — directoryCount (Backend 8A)", () => {
  it("returns 0 for an empty repository (no files, no root)", () => {
    const idx = buildIndex(makeTree([]));
    // The `countDirectories` helper counts the implicit root only
    // when at least one file is present. An entirely empty tree
    // therefore yields 0.
    expect(idx.directoryCount).toBe(0);
  });

  it("counts the implicit root for a single root-level file", () => {
    const idx = buildIndex(makeTree([{ path: "README.md" }]));
    expect(idx.directoryCount).toBe(1);
  });

  it("counts every unique parent directory", () => {
    const idx = buildIndex(
      makeTree([
        { path: "README.md" },
        { path: "src/index.ts" },
        { path: "src/lib/utils.ts" },
        { path: "docs/intro.md" },
        { path: "docs/api/endpoints.md" },
      ]),
    );
    // root + src + src/lib + docs + docs/api = 5
    expect(idx.directoryCount).toBe(5);
  });

  it("does not double-count when multiple files share a directory", () => {
    const idx = buildIndex(
      makeTree([
        { path: "src/a.ts" },
        { path: "src/b.ts" },
        { path: "src/c.ts" },
      ]),
    );
    // root + src = 2
    expect(idx.directoryCount).toBe(2);
  });

  it("ignores filtered-out paths when computing directoryCount", () => {
    // `node_modules` and `package-lock.json` are filtered by
    // `shouldIgnorePath`. The directory count should not include
    // `node_modules` even if files reference it.
    const idx = buildIndex(
      makeTree([
        { path: "src/index.ts" },
        { path: "node_modules/lodash/index.js" },
        { path: "package-lock.json" },
      ]),
    );
    // root + src = 2
    expect(idx.directoryCount).toBe(2);
  });
});

describe("estimateLinesForFile (Backend 8A)", () => {
  it("returns 0 for an empty file", () => {
    const file: IndexedFile = {
      path: "empty.ts",
      name: "empty.ts",
      extension: ".ts",
      extKey: "ts",
      language: "TypeScript",
      folder: "",
      sizeBytes: 0,
    };
    expect(estimateLinesForFile(file)).toBe(0);
  });

  it("rounds the estimate to the nearest integer", () => {
    // 1 KB TypeScript at 38 chars/line ≈ 26.9 → 27
    const file: IndexedFile = {
      path: "src/sample.ts",
      name: "sample.ts",
      extension: ".ts",
      extKey: "ts",
      language: "TypeScript",
      folder: "src",
      sizeBytes: 1024,
    };
    const lines = estimateLinesForFile(file);
    expect(Number.isInteger(lines)).toBe(true);
    expect(lines).toBeGreaterThan(0);
  });

  it("uses a wider average for Markdown than for Python", () => {
    const md: IndexedFile = {
      path: "README.md",
      name: "README.md",
      extension: ".md",
      extKey: "md",
      language: "Markdown",
      folder: "",
      sizeBytes: 10_000,
    };
    const py: IndexedFile = {
      path: "main.py",
      name: "main.py",
      extension: ".py",
      extKey: "py",
      language: "Python",
      folder: "",
      sizeBytes: 10_000,
    };
    expect(estimateLinesForFile(md)).toBeLessThan(estimateLinesForFile(py));
  });

  it("falls back to a neutral default for unknown languages", () => {
    const known: IndexedFile = {
      path: "f.ts",
      name: "f.ts",
      extension: ".ts",
      extKey: "ts",
      language: "TypeScript",
      folder: "",
      sizeBytes: 1000,
    };
    const unknown: IndexedFile = {
      ...known,
      language: "Other",
    };
    // Both should produce a positive integer; the unknown fallback
    // is close to the TypeScript average.
    expect(estimateLinesForFile(unknown)).toBeGreaterThan(0);
    expect(Math.abs(estimateLinesForFile(unknown) - estimateLinesForFile(known))).toBeLessThan(10);
  });
});

describe("estimateLinesOfCode (Backend 8A)", () => {
  it("returns 0 for an empty file list", () => {
    expect(estimateLinesOfCode([])).toBe(0);
  });

  it("sums per-file estimates", () => {
    const files: IndexedFile[] = [
      {
        path: "a.ts",
        name: "a.ts",
        extension: ".ts",
        extKey: "ts",
        language: "TypeScript",
        folder: "",
        sizeBytes: 380,
      },
      {
        path: "b.py",
        name: "b.py",
        extension: ".py",
        extKey: "py",
        language: "Python",
        folder: "",
        sizeBytes: 320,
      },
    ];
    const total = estimateLinesOfCode(files);
    const sumOfParts = estimateLinesForFile(files[0]!) + estimateLinesForFile(files[1]!);
    expect(total).toBe(sumOfParts);
  });

  it("produces a non-zero estimate for a realistic TypeScript project", () => {
    // 50 files, 4 KB each, all TypeScript → ~5263 lines at 38 chars/line.
    const files: IndexedFile[] = Array.from({ length: 50 }, (_, i) => ({
      path: `src/file-${i}.ts`,
      name: `file-${i}.ts`,
      extension: ".ts",
      extKey: "ts",
      language: "TypeScript",
      folder: "src",
      sizeBytes: 4_000,
    }));
    const total = estimateLinesOfCode(files);
    expect(total).toBeGreaterThan(4_000);
    expect(total).toBeLessThan(7_000);
  });

  it("skips files that have already been filtered out by the indexer", () => {
    // The indexer never hands binary / image / lock files to the
    // estimation routine — they are removed upstream by
    // `shouldIgnorePath`. We verify that contract: an
    // `IndexedFile[]` produced by `buildIndex` only contains
    // indexable files.
    const idx = buildIndex(
      makeTree([
        { path: "src/index.ts", size: 1_000 },
        { path: "image.png", size: 5_000 },
        { path: "package-lock.json", size: 50_000 },
      ]),
    );
    const total = estimateLinesOfCode(idx.files);
    // Only `src/index.ts` survives; the PNG and the lock file are
    // already removed by `shouldIgnorePath`.
    expect(idx.files).toHaveLength(1);
    expect(total).toBe(estimateLinesForFile(idx.files[0]!));
  });
});
