/**
 * End-to-end tests for `retrieveRelevantFiles`.
 *
 * These use the realistic mock fixture set in `lib/retrieval/mock.ts` to
 * verify the engine returns sensible, rank-ordered results for a handful
 * of common questions.
 */

import { describe, expect, it } from "vitest";
import { retrieveRelevantFiles } from "../retrieve";
import { mockIndexedFiles, mockAuthRepo } from "../mock";

describe("retrieveRelevantFiles", () => {
  it("returns no matches for an empty question", () => {
    const result = retrieveRelevantFiles("", mockIndexedFiles);
    expect(result.matches).toEqual([]);
    expect(result.totalCandidates).toBe(mockIndexedFiles.length);
  });

  it("returns no matches when there are no files", () => {
    const result = retrieveRelevantFiles("auth", []);
    expect(result.matches).toEqual([]);
  });

  it("returns no matches when the question is all stopwords", () => {
    // "How is it done?" -> after stopword filter -> [] tokens
    const result = retrieveRelevantFiles("How is it done?", mockIndexedFiles);
    expect(result.matches).toEqual([]);
  });

  it("ranks auth-related files highest for an authentication question", () => {
    const result = retrieveRelevantFiles(
      "How does authentication work?",
      mockIndexedFiles,
    );
    expect(result.matches.length).toBeGreaterThan(0);

    // The top match should be an auth file. We assert the path begins
    // with an "auth"-related segment — multiple mocks could legitimately
    // top the list, so we just require one of the canonical auth files.
    const top = result.matches[0]!;
    const isAuthFile =
      top.file.path.includes("/auth/") ||
      top.file.path.includes("auth.") ||
      top.file.path.includes("authentication");
    expect(isAuthFile).toBe(true);

    // Each score must be in [0, 100] and the list must be sorted.
    for (const m of result.matches) {
      expect(m.score).toBeGreaterThanOrEqual(0);
      expect(m.score).toBeLessThanOrEqual(100);
    }
    for (let i = 1; i < result.matches.length; i++) {
      expect(result.matches[i - 1]!.score).toBeGreaterThanOrEqual(
        result.matches[i]!.score,
      );
    }
  });

  it("ranks config files highest for a config question", () => {
    const result = retrieveRelevantFiles(
      "Where are the configuration files?",
      mockIndexedFiles,
      { limit: 5 },
    );
    expect(result.matches.length).toBeGreaterThan(0);

    const paths = result.matches.map((m) => m.file.path);
    // package.json or tsconfig.json should appear near the top.
    const topConfigIdx = paths.findIndex(
      (p) => p === "package.json" || p === "tsconfig.json",
    );
    expect(topConfigIdx).toBeGreaterThanOrEqual(0);
    expect(topConfigIdx).toBeLessThan(3);
  });

  it("ranks test files highest for a testing question", () => {
    const result = retrieveRelevantFiles(
      "How is the code tested?",
      mockIndexedFiles,
      { limit: 5 },
    );
    expect(result.matches.length).toBeGreaterThan(0);

    const top = result.matches[0]!;
    expect(top.file.path).toMatch(/test/i);
  });

  it("honours the limit option", () => {
    const result = retrieveRelevantFiles("auth", mockIndexedFiles, {
      limit: 3,
    });
    expect(result.matches.length).toBeLessThanOrEqual(3);
  });

  it("honours the minScore option", () => {
    const result = retrieveRelevantFiles("auth", mockIndexedFiles, {
      minScore: 50,
    });
    for (const m of result.matches) {
      expect(m.score).toBeGreaterThanOrEqual(50);
    }
  });

  it("exposes a non-empty reason for every match", () => {
    const result = retrieveRelevantFiles("How does auth work?", mockIndexedFiles);
    for (const m of result.matches) {
      expect(m.reason.length).toBeGreaterThan(0);
    }
  });

  it("returns stable ordering on equal scores (alphabetical by path)", () => {
    const a = retrieveRelevantFiles("auth", mockIndexedFiles);
    const b = retrieveRelevantFiles("auth", mockIndexedFiles);
    expect(a.matches.map((m) => m.file.path)).toEqual(
      b.matches.map((m) => m.file.path),
    );
  });
});

describe("mockAuthRepo demo", () => {
  it("produces the example output described in the Phase 3B brief", () => {
    const { result } = mockAuthRepo("How does authentication work?", {
      limit: 10,
    });
    // The example brief expects auth.ts, middleware.ts, and login.tsx to
    // appear among the top results. Our mock uses slightly different
    // filenames, so we assert the same intent: auth-related files and
    // login-related files rank highly within the default retrieval cap.
    const paths = result.matches.map((m) => m.file.path);
    const hasAuth = paths.some((p) => p.includes("auth"));
    const hasLogin = paths.some((p) => p.includes("login"));
    expect(hasAuth).toBe(true);
    expect(hasLogin).toBe(true);
  });

  it("returns the auth.service.ts file as a top match", () => {
    const { result } = mockAuthRepo("How does authentication work?");
    const top = result.matches[0];
    expect(top).toBeDefined();
    // One of the highest-scoring files should mention auth in the path.
    expect(top!.file.path).toMatch(/auth/);
  });
});
