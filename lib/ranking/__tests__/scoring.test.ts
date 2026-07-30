/**
 * Tests for the per-signal scoring functions in `lib/ranking/scoring.ts`.
 *
 * Each signal is tested in isolation so failures point to a single rule.
 */

import { describe, expect, it } from "vitest";
import type { IndexedFile } from "@/types/repository";
import {
  scoreExtension,
  scoreFilename,
  scoreFolder,
  scoreKeywordFrequency,
} from "../scoring";

function file(over: Partial<IndexedFile>): IndexedFile {
  return {
    path: "src/auth.ts",
    name: "auth.ts",
    extension: ".ts",
    extKey: "ts",
    language: "TypeScript",
    folder: "src",
    sizeBytes: 1024,
    ...over,
  };
}

describe("scoreFilename", () => {
  it("returns 100 for an exact full-name match", () => {
    const f = file({ path: "auth.ts", name: "auth.ts", folder: "" });
    expect(scoreFilename(f, ["auth"])).toBe(100);
  });

  it("returns a positive partial score when the filename contains a query token", () => {
    const f = file({ path: "src/auth.service.ts", name: "auth.service.ts" });
    const result = scoreFilename(f, ["auth", "service"]);
    expect(result).toBeGreaterThan(0);
    expect(result).toBeLessThanOrEqual(100);
  });

  it("returns 0 when nothing matches", () => {
    const f = file({ name: "utils.ts" });
    expect(scoreFilename(f, ["auth"])).toBe(0);
  });

  it("returns 0 for an empty query", () => {
    const f = file({});
    expect(scoreFilename(f, [])).toBe(0);
  });

  it("never exceeds 100", () => {
    const f = file({ name: "auth.ts" });
    expect(scoreFilename(f, ["auth", "auth", "auth"])).toBeLessThanOrEqual(100);
  });
});

describe("scoreFolder", () => {
  it("scores positively when a folder segment matches a query token", () => {
    const f = file({ path: "src/auth/middleware.ts", folder: "src/auth" });
    const result = scoreFolder(f, ["auth"]);
    expect(result).toBeGreaterThan(0);
  });

  it("returns 0 for root-level files", () => {
    const f = file({ folder: "" });
    expect(scoreFolder(f, ["auth"])).toBe(0);
  });

  it("returns 0 for an empty query", () => {
    const f = file({});
    expect(scoreFolder(f, [])).toBe(0);
  });
});

describe("scoreKeywordFrequency", () => {
  it("scores higher when more query tokens appear in the full path", () => {
    const f = file({ path: "src/auth/login/auth.service.ts" });
    const one = scoreKeywordFrequency(f, ["auth"]);
    const two = scoreKeywordFrequency(f, ["auth", "login"]);
    expect(two).toBeGreaterThanOrEqual(one);
  });

  it("returns 0 when no query token appears in the path", () => {
    const f = file({ path: "src/utils/format.ts" });
    expect(scoreKeywordFrequency(f, ["auth"])).toBe(0);
  });

  it("returns 100 when every query token appears in the path", () => {
    const f = file({ path: "src/auth/service.ts" });
    // Both "auth" and "service" appear in the path.
    expect(scoreKeywordFrequency(f, ["auth", "service"])).toBe(100);
  });

  it("returns 0 for an empty query", () => {
    const f = file({});
    expect(scoreKeywordFrequency(f, [])).toBe(0);
  });
});

describe("scoreExtension", () => {
  it("boosts the README for documentation-style questions", () => {
    const f = file({
      path: "README.md",
      name: "README.md",
      extension: ".md",
      extKey: "md",
      folder: "",
    });
    const result = scoreExtension(f, ["documentation", "overview"]);
    expect(result).toBeGreaterThan(0);
  });

  it("boosts .ts files when the question mentions 'test'", () => {
    const f = file({ extKey: "ts" });
    expect(scoreExtension(f, ["test", "auth"])).toBeGreaterThan(0);
  });

  it("boosts .json files when the question mentions 'config'", () => {
    const f = file({ extKey: "json" });
    expect(scoreExtension(f, ["config"])).toBeGreaterThan(0);
  });

  it("returns 0 when the extension doesn't match any hint", () => {
    const f = file({ extKey: "ts" });
    expect(scoreExtension(f, ["config"])).toBe(0);
  });

  it("returns 0 for an empty query", () => {
    const f = file({});
    expect(scoreExtension(f, [])).toBe(0);
  });
});
