/**
 * Tests for the Context Metrics engine (Phase 3D2).
 *
 * These tests construct small `ContextPackage` fixtures directly
 * (no need to go through the full builder) so the math is easy to
 * reason about. A separate block uses the builder to confirm the
 * metrics update correctly when more or fewer files are selected.
 */

import { describe, expect, it } from "vitest";

import {
  CHARS_PER_TOKEN,
  calculateContextMetrics,
  countLines,
} from "../index";
import type { ContextFileEntry, ContextPackage, ContextRepositoryInfo } from "../index";
import {
  mockAuthContext,
  mockFileContents,
  mockIndexedFiles,
  mockRepository,
} from "../mock";
import { rankRelevantFiles } from "@/lib/ranking";
import { buildContextPackage } from "../index";
import type { IndexedFile } from "@/types/repository";

/* -------------------------------------------------------------------------- */
/*  Fixture helpers                                                           */
/* -------------------------------------------------------------------------- */

function makeFile(path: string, content: string, language = "TypeScript"): ContextFileEntry {
  const name = path.split("/").pop() ?? path;
  const lastDot = name.lastIndexOf(".");
  const extKey = lastDot >= 0 ? name.slice(lastDot + 1).toLowerCase() : "";
  const metadata: IndexedFile = {
    path,
    name,
    extension: lastDot >= 0 ? name.slice(lastDot) : "",
    extKey,
    language,
    folder: path.includes("/") ? path.slice(0, path.lastIndexOf("/")) : "",
    sizeBytes: content.length,
  };
  return {
    path,
    name,
    extKey,
    language,
    content,
    score: 0,
    reason: "test fixture",
    metadata,
  };
}

function makePackage(files: ContextFileEntry[], repo: Partial<ContextRepositoryInfo> = {}): ContextPackage {
  return {
    version: "3D1",
    question: "test question",
    repository: { ...mockRepository, ...repo },
    files,
    totalCandidates: files.length,
    selectedCount: files.length,
    limit: 5,
  };
}

/* -------------------------------------------------------------------------- */
/*  countLines                                                                */
/* -------------------------------------------------------------------------- */

describe("countLines", () => {
  it("counts 0 for the empty string", () => {
    expect(countLines("")).toBe(0);
  });

  it("counts 1 for a single line with no trailing newline", () => {
    expect(countLines("hello")).toBe(1);
  });

  it("counts 1 for a single line with a trailing newline", () => {
    expect(countLines("hello\n")).toBe(1);
  });

  it("counts 2 for two lines", () => {
    expect(countLines("a\nb")).toBe(2);
    expect(countLines("a\nb\n")).toBe(2);
  });

  it("counts many lines", () => {
    expect(countLines("a\nb\nc\nd")).toBe(4);
  });

  it("treats CRLF and CR like LF", () => {
    expect(countLines("a\r\nb")).toBe(2);
    expect(countLines("a\rb")).toBe(2);
    expect(countLines("a\r\nb\r\n")).toBe(2);
  });
});

/* -------------------------------------------------------------------------- */
/*  calculateContextMetrics — small fixtures                                  */
/* -------------------------------------------------------------------------- */

describe("calculateContextMetrics — small fixtures", () => {
  it("returns all zeros for an empty package", () => {
    const m = calculateContextMetrics(makePackage([]));
    expect(m).toEqual({
      filesCount: 0,
      lineCount: 0,
      characterCount: 0,
      estimatedTokens: 0,
      averageFileSize: 0,
    });
  });

  it("counts files, characters, and lines correctly for a single file", () => {
    const content = "abc\ndef\nghi"; // 11 chars, 3 lines
    const pkg = makePackage([makeFile("a.ts", content)]);
    const m = calculateContextMetrics(pkg);
    expect(m.filesCount).toBe(1);
    expect(m.characterCount).toBe(11);
    expect(m.lineCount).toBe(3);
    expect(m.estimatedTokens).toBe(Math.ceil(11 / CHARS_PER_TOKEN));
    expect(m.averageFileSize).toBe(11);
  });

  it("aggregates counts across multiple files", () => {
    const pkg = makePackage([
      makeFile("a.ts", "abc\n"),   // 4 chars, 1 line
      makeFile("b.ts", "de\nfg"),  // 5 chars, 2 lines
      makeFile("c.ts", "h"),       // 1 char,  1 line
    ]);
    const m = calculateContextMetrics(pkg);
    expect(m.filesCount).toBe(3);
    expect(m.characterCount).toBe(10);
    expect(m.lineCount).toBe(4);
    // 10/3 = 3.33 → rounds to 3.
    expect(m.averageFileSize).toBe(3);
    expect(m.estimatedTokens).toBe(Math.ceil(10 / CHARS_PER_TOKEN));
  });

  it("estimatedTokens is a ceiling so a single-char file still gets 1", () => {
    const m = calculateContextMetrics(makePackage([makeFile("a.ts", "x")]));
    expect(m.characterCount).toBe(1);
    expect(m.estimatedTokens).toBe(1);
  });
});

/* -------------------------------------------------------------------------- */
/*  Token heuristic                                                            */
/* -------------------------------------------------------------------------- */

describe("calculateContextMetrics — token heuristic", () => {
  it("default charsPerToken is 4", () => {
    expect(CHARS_PER_TOKEN).toBe(4);
  });

  it("default heuristic yields ceil(chars / 4)", () => {
    const content = "a".repeat(17); // 17 chars → ceil(17/4) = 5
    const m = calculateContextMetrics(makePackage([makeFile("a.ts", content)]));
    expect(m.estimatedTokens).toBe(5);
  });

  it("honors the charsPerToken override", () => {
    const content = "a".repeat(20);
    const m = calculateContextMetrics(
      makePackage([makeFile("a.ts", content)]),
      { charsPerToken: 2 },
    );
    expect(m.estimatedTokens).toBe(10);
  });

  it("falls back to the default for invalid overrides", () => {
    const content = "a".repeat(8);
    const m = calculateContextMetrics(
      makePackage([makeFile("a.ts", content)]),
      { charsPerToken: 0 },
    );
    expect(m.estimatedTokens).toBe(2);
    const m2 = calculateContextMetrics(
      makePackage([makeFile("a.ts", content)]),
      { charsPerToken: Number.NaN },
    );
    expect(m2.estimatedTokens).toBe(2);
  });
});

/* -------------------------------------------------------------------------- */
/*  Validation: metrics change with selection size                            */
/* -------------------------------------------------------------------------- */

describe("calculateContextMetrics — scales with selection size", () => {
  it("more files → larger metrics", () => {
    const ranked = rankRelevantFiles("How does authentication work?", mockIndexedFilesForRanking(), {
      limit: 50,
    }).ranked;
    const small = buildContextPackage("How does authentication work?", ranked.slice(0, 1), mockRepository, {
      contentSource: "inline",
      contents: mockFileContents,
      limit: 1,
    });
    const big = buildContextPackage("How does authentication work?", ranked.slice(0, 4), mockRepository, {
      contentSource: "inline",
      contents: mockFileContents,
      limit: 4,
    });
    const mSmall = calculateContextMetrics(small.package);
    const mBig = calculateContextMetrics(big.package);

    expect(mSmall.filesCount).toBe(1);
    expect(mBig.filesCount).toBe(4);
    expect(mBig.characterCount).toBeGreaterThan(mSmall.characterCount);
    expect(mBig.lineCount).toBeGreaterThan(mSmall.lineCount);
    expect(mBig.estimatedTokens).toBeGreaterThan(mSmall.estimatedTokens);
  });

  it("fewer files → smaller metrics", () => {
    const ranked = rankRelevantFiles("How does authentication work?", mockIndexedFilesForRanking(), {
      limit: 50,
    }).ranked;
    const three = buildContextPackage("How does authentication work?", ranked.slice(0, 3), mockRepository, {
      contentSource: "inline",
      contents: mockFileContents,
      limit: 3,
    });
    const one = buildContextPackage("How does authentication work?", ranked.slice(0, 1), mockRepository, {
      contentSource: "inline",
      contents: mockFileContents,
      limit: 1,
    });
    const mThree = calculateContextMetrics(three.package);
    const mOne = calculateContextMetrics(one.package);

    expect(mThree.filesCount).toBe(3);
    expect(mOne.filesCount).toBe(1);
    expect(mThree.characterCount).toBeGreaterThan(mOne.characterCount);
  });

  it("works for a different repository (different question / different files)", () => {
    // A repo with a single tiny file.
    const pkg = makePackage([makeFile("notes.md", "# Hello\n\nWorld")]);
    const m = calculateContextMetrics(pkg);
    expect(m.filesCount).toBe(1);
    expect(m.lineCount).toBe(3);
    expect(m.characterCount).toBe("# Hello\n\nWorld".length);
  });
});

/* -------------------------------------------------------------------------- */
/*  Real auth repo: end-to-end through the builder                            */
/* -------------------------------------------------------------------------- */

describe("calculateContextMetrics — through the real builder", () => {
  it("produces sensible metrics for the mock auth repo", () => {
    const { result } = mockAuthContext("How does authentication work?", { limit: 3 });
    const m = calculateContextMetrics(result.package);

    expect(m.filesCount).toBe(3);
    expect(m.characterCount).toBeGreaterThan(0);
    expect(m.lineCount).toBeGreaterThan(0);
    expect(m.estimatedTokens).toBeGreaterThan(0);
    // Average file size is characterCount / filesCount rounded.
    expect(m.averageFileSize).toBe(
      Math.round(m.characterCount / m.filesCount),
    );
  });

  it("recomputes correctly when the limit changes (same question)", () => {
    const small = mockAuthContext("How does authentication work?", { limit: 1 });
    const big = mockAuthContext("How does authentication work?", { limit: 5 });
    const mSmall = calculateContextMetrics(small.result.package);
    const mBig = calculateContextMetrics(big.result.package);

    expect(mSmall.filesCount).toBe(1);
    expect(mBig.filesCount).toBeGreaterThan(mSmall.filesCount);
    expect(mBig.characterCount).toBeGreaterThan(mSmall.characterCount);
    expect(mBig.estimatedTokens).toBeGreaterThan(mSmall.estimatedTokens);
  });
});

/* -------------------------------------------------------------------------- */
/*  Independence / purity                                                     */
/* -------------------------------------------------------------------------- */

describe("calculateContextMetrics — purity", () => {
  it("does not mutate the package", () => {
    const pkg = makePackage([makeFile("a.ts", "hello\n"), makeFile("b.ts", "world")]);
    const snapshot = JSON.stringify(pkg);
    calculateContextMetrics(pkg);
    expect(JSON.stringify(pkg)).toBe(snapshot);
  });

  it("is deterministic for the same input", () => {
    const pkg = makePackage([
      makeFile("a.ts", "abc\n"),
      makeFile("b.ts", "def\nghi"),
    ]);
    const m1 = calculateContextMetrics(pkg);
    const m2 = calculateContextMetrics(pkg);
    expect(m1).toEqual(m2);
  });
});

/* -------------------------------------------------------------------------- */
/*  Local helper                                                              */
/* -------------------------------------------------------------------------- */

function mockIndexedFilesForRanking(): IndexedFile[] {
  return mockIndexedFiles;
}
