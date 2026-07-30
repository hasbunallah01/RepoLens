/**
 * Tests for the Context Builder (Phase 3D1).
 *
 * The tests deliberately exercise both the inline content source (the
 * default in tests) and the indexer content source (the production
 * path) so we know the package shape is identical for both.
 *
 * They also verify the two failure modes we expect to see in
 * production: a missing inline map and a path with no registered
 * content. Both must be reported as errors and must not throw.
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { rankRelevantFiles } from "@/lib/ranking";
import type { RankedFile } from "@/types/ranking";
import type { IndexedFile } from "@/types/repository";

import {
  CONTEXT_PACKAGE_VERSION,
  FileContentRegistry,
  buildContextPackage,
  getDefaultContentRegistry,
  resetDefaultContentRegistry,
} from "../index";
import { mockAuthContext, mockFileContents, mockIndexedFiles, mockRepository } from "../mock";

/* -------------------------------------------------------------------------- */
/*  Test helpers                                                              */
/* -------------------------------------------------------------------------- */

function rankFor(question: string, files: IndexedFile[] = mockIndexedFiles): RankedFile[] {
  return rankRelevantFiles(question, files, { limit: 50 }).ranked;
}

function sampleRepo() {
  return { ...mockRepository, builtAt: "2026-07-30T00:00:00.000Z" };
}

/* -------------------------------------------------------------------------- */
/*  Setup / teardown                                                          */
/* -------------------------------------------------------------------------- */

beforeEach(() => {
  resetDefaultContentRegistry();
});

afterEach(() => {
  resetDefaultContentRegistry();
});

/* -------------------------------------------------------------------------- */
/*  Selection                                                                 */
/* -------------------------------------------------------------------------- */

describe("buildContextPackage — selection", () => {
  it("selects at most 5 files by default", () => {
    const ranked = rankFor("How does authentication work?");
    const result = buildContextPackage("How does authentication work?", ranked, sampleRepo(), {
      contentSource: "inline",
      contents: mockFileContents,
    });
    expect(result.package.files.length).toBeLessThanOrEqual(5);
  });

  it("selects exactly the top N files (limit option)", () => {
    const ranked = rankFor("auth");
    const result = buildContextPackage("auth", ranked, sampleRepo(), {
      contentSource: "inline",
      contents: mockFileContents,
      limit: 3,
    });
    expect(result.package.files).toHaveLength(3);
    expect(result.package.limit).toBe(3);
    expect(result.package.selectedCount).toBe(3);
  });

  it("preserves the input order (highest score first)", () => {
    const ranked = rankFor("How does authentication work?");
    const result = buildContextPackage("How does authentication work?", ranked, sampleRepo(), {
      contentSource: "inline",
      contents: mockFileContents,
      limit: 4,
    });
    const inputPaths = ranked.slice(0, 4).map((r) => r.file.path);
    const outputPaths = result.package.files.map((f) => f.path);
    expect(outputPaths).toEqual(inputPaths);
  });

  it("includes the original score and reason for each file", () => {
    const ranked = rankFor("How does authentication work?");
    const result = buildContextPackage("How does authentication work?", ranked, sampleRepo(), {
      contentSource: "inline",
      contents: mockFileContents,
      limit: 3,
    });
    for (const entry of result.package.files) {
      const source = ranked.find((r) => r.file.path === entry.path);
      expect(source).toBeDefined();
      expect(entry.score).toBe(source!.score);
      expect(entry.reason).toBe(source!.reason);
    }
  });

  it("does not mutate or rewrite file contents", () => {
    const ranked = rankFor("How does authentication work?");
    const result = buildContextPackage("How does authentication work?", ranked, sampleRepo(), {
      contentSource: "inline",
      contents: mockFileContents,
      limit: 5,
    });
    for (const entry of result.package.files) {
      const original = mockFileContents.get(entry.path);
      expect(entry.content).toBe(original);
    }
  });

  it("treats limit=0 as 'no cap' (returns all ranked files that have content)", () => {
    const ranked = rankFor("auth");
    const result = buildContextPackage("auth", ranked, sampleRepo(), {
      contentSource: "inline",
      contents: mockFileContents,
      limit: 0,
    });
    expect(result.package.limit).toBe(0);
    expect(result.package.files.length).toBeGreaterThan(0);
    expect(result.package.files.length).toBeLessThanOrEqual(ranked.length);
  });

  it("produces an empty package for an empty ranked list", () => {
    const result = buildContextPackage("anything", [], sampleRepo(), {
      contentSource: "inline",
      contents: mockFileContents,
    });
    expect(result.package.files).toEqual([]);
    expect(result.package.selectedCount).toBe(0);
    expect(result.package.totalCandidates).toBe(0);
    expect(result.errors).toEqual([]);
  });
});

/* -------------------------------------------------------------------------- */
/*  Package structure                                                         */
/* -------------------------------------------------------------------------- */

describe("buildContextPackage — structure", () => {
  it("includes all the required top-level fields", () => {
    const ranked = rankFor("How does authentication work?");
    const result = buildContextPackage("How does authentication work?", ranked, sampleRepo(), {
      contentSource: "inline",
      contents: mockFileContents,
    });
    const pkg = result.package;
    expect(pkg.version).toBe(CONTEXT_PACKAGE_VERSION);
    expect(pkg.question).toBe("How does authentication work?");
    expect(pkg.repository).toEqual(sampleRepo());
    expect(Array.isArray(pkg.files)).toBe(true);
    expect(typeof pkg.totalCandidates).toBe("number");
    expect(typeof pkg.selectedCount).toBe("number");
    expect(typeof pkg.limit).toBe("number");
  });

  it("echoes the question back exactly", () => {
    const q = "  How does AUTHENTICATION work?  ";
    const ranked = rankFor(q);
    const result = buildContextPackage(q, ranked, sampleRepo(), {
      contentSource: "inline",
      contents: mockFileContents,
    });
    expect(result.package.question).toBe(q);
  });

  it("each file entry has every required field", () => {
    const ranked = rankFor("How does authentication work?");
    const result = buildContextPackage("How does authentication work?", ranked, sampleRepo(), {
      contentSource: "inline",
      contents: mockFileContents,
      limit: 2,
    });
    for (const entry of result.package.files) {
      expect(typeof entry.path).toBe("string");
      expect(typeof entry.name).toBe("string");
      expect(typeof entry.extKey).toBe("string");
      expect(typeof entry.language).toBe("string");
      expect(typeof entry.content).toBe("string");
      expect(typeof entry.score).toBe("number");
      expect(typeof entry.reason).toBe("string");
      expect(entry.metadata).toBeDefined();
      expect(entry.metadata.path).toBe(entry.path);
    }
  });

  it("is JSON-serializable (future optimizers may pipe it through JSON)", () => {
    const ranked = rankFor("How does authentication work?");
    const result = buildContextPackage("How does authentication work?", ranked, sampleRepo(), {
      contentSource: "inline",
      contents: mockFileContents,
      limit: 3,
    });
    const round = JSON.parse(JSON.stringify(result.package));
    expect(round.files[0].content).toBe(result.package.files[0]!.content);
    expect(round.question).toBe("How does authentication work?");
  });

  it("selectedCount equals files.length", () => {
    const ranked = rankFor("How does authentication work?");
    const result = buildContextPackage("How does authentication work?", ranked, sampleRepo(), {
      contentSource: "inline",
      contents: mockFileContents,
      limit: 5,
    });
    expect(result.package.selectedCount).toBe(result.package.files.length);
  });
});

/* -------------------------------------------------------------------------- */
/*  Content sources                                                           */
/* -------------------------------------------------------------------------- */

describe("buildContextPackage — content sources", () => {
  it("reads contents from the inline map when contentSource=inline", () => {
    const ranked = rankFor("How does authentication work?");
    const result = buildContextPackage("How does authentication work?", ranked, sampleRepo(), {
      contentSource: "inline",
      contents: mockFileContents,
    });
    expect(result.errors).toEqual([]);
    expect(result.package.files[0]!.content).toBe(
      mockFileContents.get(result.package.files[0]!.path),
    );
  });

  it("reads contents from the indexer registry when contentSource=indexer", () => {
    const registry: FileContentRegistry = getDefaultContentRegistry();
    const ranked = rankFor("How does authentication work?");
    for (const r of ranked) {
      registry.set(r.file.path, mockFileContents.get(r.file.path) ?? "");
    }

    const result = buildContextPackage("How does authentication work?", ranked, sampleRepo(), {
      contentSource: "indexer",
    });
    expect(result.errors).toEqual([]);
    expect(result.package.files[0]!.content).toBe(
      mockFileContents.get(result.package.files[0]!.path),
    );
  });

  it("returns a MISSING_INLINE_CONTENTS error when inline is selected but no map is provided", () => {
    const ranked = rankFor("How does authentication work?");
    const result = buildContextPackage("How does authentication work?", ranked, sampleRepo(), {
      contentSource: "inline",
    });
    expect(result.package.files).toEqual([]);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors[0]!.code).toBe("MISSING_INLINE_CONTENTS");
  });

  it("returns a CONTENT_NOT_FOUND error for a path with no registered content", () => {
    const ranked = rankFor("How does authentication work?");
    // Provide contents for only one of the top files; the others
    // should fall through to the error list.
    const partial = new Map<string, string>([
      [ranked[0]!.file.path, "only one file has content"],
    ]);
    const result = buildContextPackage("How does authentication work?", ranked, sampleRepo(), {
      contentSource: "inline",
      contents: partial,
    });
    // The file with content should be in the package.
    expect(result.package.files).toHaveLength(1);
    expect(result.package.files[0]!.path).toBe(ranked[0]!.file.path);
    // Every missing file should be reported.
    expect(result.errors.length).toBe(ranked.length - 1);
    for (const err of result.errors) {
      expect(err.code).toBe("CONTENT_NOT_FOUND");
      expect(err.path).toBeDefined();
    }
  });
});

/* -------------------------------------------------------------------------- */
/*  Mock demo                                                                 */
/* -------------------------------------------------------------------------- */

describe("mockAuthContext demo", () => {
  it("produces a package whose top file is auth.service.ts", () => {
    const { result, ranked } = mockAuthContext("How does authentication work?");
    expect(ranked.length).toBeGreaterThan(0);
    expect(result.package.files.length).toBeGreaterThan(0);
    expect(result.package.files[0]!.path).toBe("src/auth/auth.service.ts");
  });

  it("includes a non-empty content field on every file", () => {
    const { result } = mockAuthContext("How does authentication work?");
    for (const entry of result.package.files) {
      expect(entry.content.length).toBeGreaterThan(0);
    }
  });

  it("respects the limit option on the demo entry point", () => {
    const { result } = mockAuthContext("How does authentication work?", { limit: 2 });
    expect(result.package.files).toHaveLength(2);
  });

  it("does not report any errors for the demo question", () => {
    const { result } = mockAuthContext("How does authentication work?");
    expect(result.errors).toEqual([]);
  });
});
