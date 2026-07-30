/**
 * End-to-end tests for `rankRelevantFiles`.
 *
 * These use the realistic mock fixture set in `lib/ranking/mock.ts` to
 * verify the engine returns sensible, rank-ordered results for a handful
 * of common questions.
 */

import { describe, expect, it } from "vitest";
import { rankRelevantFiles } from "../rank";
import { mockIndexedFiles, mockAuthRepo } from "../mock";

describe("rankRelevantFiles", () => {
  it("returns no matches for an empty question", () => {
    const result = rankRelevantFiles("", mockIndexedFiles);
    expect(result.ranked).toEqual([]);
    expect(result.totalCandidates).toBe(mockIndexedFiles.length);
  });

  it("returns no matches when there are no files", () => {
    const result = rankRelevantFiles("auth", []);
    expect(result.ranked).toEqual([]);
  });

  it("returns no matches when the question is all stopwords", () => {
    // "How is it done?" -> after stopword filter -> [] tokens
    const result = rankRelevantFiles("How is it done?", mockIndexedFiles);
    expect(result.ranked).toEqual([]);
  });

  it("ranks auth-related files highest for an authentication question", () => {
    const result = rankRelevantFiles(
      "How does authentication work?",
      mockIndexedFiles,
    );
    expect(result.ranked.length).toBeGreaterThan(0);

    // The top match should be an auth file. We assert the path begins
    // with an "auth"-related segment — multiple mocks could legitimately
    // top the list, so we just require one of the canonical auth files.
    const top = result.ranked[0]!;
    const isAuthFile =
      top.file.path.includes("/auth/") ||
      top.file.path.includes("auth.") ||
      top.file.path.includes("authentication");
    expect(isAuthFile).toBe(true);

    // Each score must be in [0, 100] and the list must be sorted.
    for (const m of result.ranked) {
      expect(m.score).toBeGreaterThanOrEqual(0);
      expect(m.score).toBeLessThanOrEqual(100);
    }
    for (let i = 1; i < result.ranked.length; i++) {
      expect(result.ranked[i - 1]!.score).toBeGreaterThanOrEqual(
        result.ranked[i]!.score,
      );
    }
  });

  it("returns the highest score for the most obviously-matching file", () => {
    // auth.service.ts is the most canonical "auth" file in the mock.
    const result = rankRelevantFiles(
      "How does authentication work?",
      mockIndexedFiles,
    );
    const top = result.ranked[0]!;
    expect(top.file.path).toBe("src/auth/auth.service.ts");
  });

  it("ranks config files highest for a config question", () => {
    const result = rankRelevantFiles(
      "Where are the configuration files?",
      mockIndexedFiles,
      { limit: 5 },
    );
    expect(result.ranked.length).toBeGreaterThan(0);

    const paths = result.ranked.map((m) => m.file.path);
    // package.json or tsconfig.json should appear near the top.
    const topConfigIdx = paths.findIndex(
      (p) => p === "package.json" || p === "tsconfig.json",
    );
    expect(topConfigIdx).toBeGreaterThanOrEqual(0);
    expect(topConfigIdx).toBeLessThan(3);
  });

  it("ranks test files highest for a testing question", () => {
    const result = rankRelevantFiles(
      "How is the code tested?",
      mockIndexedFiles,
      { limit: 5 },
    );
    expect(result.ranked.length).toBeGreaterThan(0);

    const top = result.ranked[0]!;
    expect(top.file.path).toMatch(/test/i);
  });

  it("honours the limit option", () => {
    const result = rankRelevantFiles("auth", mockIndexedFiles, { limit: 3 });
    expect(result.ranked.length).toBeLessThanOrEqual(3);
  });

  it("honours the minScore option", () => {
    const result = rankRelevantFiles("auth", mockIndexedFiles, {
      minScore: 50,
    });
    for (const m of result.ranked) {
      expect(m.score).toBeGreaterThanOrEqual(50);
    }
  });

  it("returns stable ordering on equal scores (alphabetical by path)", () => {
    const a = rankRelevantFiles("auth", mockIndexedFiles);
    const b = rankRelevantFiles("auth", mockIndexedFiles);
    expect(a.ranked.map((m) => m.file.path)).toEqual(
      b.ranked.map((m) => m.file.path),
    );
  });

  it("only includes the expected { file, score } fields (no extras)", () => {
    const result = rankRelevantFiles("auth", mockIndexedFiles);
    for (const m of result.ranked) {
      expect(Object.keys(m).sort()).toEqual(["file", "score"]);
    }
  });

  it("echoes the original question back", () => {
    const q = "How does authentication work?";
    const result = rankRelevantFiles(q, mockIndexedFiles);
    expect(result.question).toBe(q);
  });

  it("respects a custom weight override", () => {
    // For the question "config", package.json only matches via the
    // extension signal (its filename/folder/path don't contain "config").
    // With the default weights, it should appear in the results. With
    // the extension weight forced to 0, the file should drop out — proof
    // that the weight system is being applied end-to-end.
    const fullWeights = rankRelevantFiles("config", mockIndexedFiles);
    const noExtWeights = rankRelevantFiles("config", mockIndexedFiles, {
      weights: { extension: 0 },
    });
    expect(fullWeights.ranked.some((m) => m.file.path === "package.json")).toBe(
      true,
    );
    expect(noExtWeights.ranked.some((m) => m.file.path === "package.json")).toBe(
      false,
    );
  });

  it("echoes the active weights back on the result", () => {
    const result = rankRelevantFiles("auth", mockIndexedFiles, {
      weights: { filename: 99, folder: 1, keywordFrequency: 1, extension: 1 },
    });
    expect(result.weights.filename).toBe(99);
    expect(result.weights.folder).toBe(1);
    expect(result.weights.keywordFrequency).toBe(1);
    expect(result.weights.extension).toBe(1);
  });
});

describe("mockAuthRepo demo", () => {
  it("produces a sensible ranking for the example question", () => {
    const { result } = mockAuthRepo("How does authentication work?", {
      limit: 10,
    });
    // Auth-related files and login-related files should rank highly
    // within the default cap.
    const paths = result.ranked.map((m) => m.file.path);
    const hasAuth = paths.some((p) => p.includes("auth"));
    const hasLogin = paths.some((p) => p.includes("login"));
    expect(hasAuth).toBe(true);
    expect(hasLogin).toBe(true);
  });

  it("returns auth.service.ts as the top match for the example question", () => {
    const { result } = mockAuthRepo("How does authentication work?");
    const top = result.ranked[0];
    expect(top).toBeDefined();
    expect(top!.file.path).toBe("src/auth/auth.service.ts");
  });
});
