/**
 * Tests for the per-signal scoring functions in `lib/retrieval/scoring.ts`.
 *
 * Each signal is tested in isolation so failures point to a single rule.
 */

import { describe, expect, it } from "vitest";
import type { IndexedFile } from "@/types/repository";
import {
  makeContext,
  runAllSignals,
  scoreExtension,
  scoreFilename,
  scoreFolder,
  scorePathKeywords,
  scoreReadme,
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
    const result = scoreFilename(f, ["auth"]);
    expect(result.score).toBe(100);
    expect(result.reason).toContain("auth");
  });

  it("returns a positive partial score when the filename contains a query token", () => {
    const f = file({ path: "src/auth.service.ts", name: "auth.service.ts" });
    const result = scoreFilename(f, ["auth", "service"]);
    expect(result.score).toBeGreaterThan(0);
  });

  it("returns 0 when nothing matches", () => {
    const f = file({ name: "utils.ts" });
    expect(scoreFilename(f, ["auth"]).score).toBe(0);
  });

  it("returns 0 for an empty query", () => {
    const f = file({});
    expect(scoreFilename(f, []).score).toBe(0);
  });
});

describe("scoreFolder", () => {
  it("scores positively when a folder segment matches a query token", () => {
    const f = file({ path: "src/auth/middleware.ts", folder: "src/auth" });
    const result = scoreFolder(f, ["auth"]);
    expect(result.score).toBeGreaterThan(0);
  });

  it("returns 0 for root-level files", () => {
    const f = file({ folder: "" });
    expect(scoreFolder(f, ["auth"]).score).toBe(0);
  });
});

describe("scorePathKeywords", () => {
  it("scores higher when more query tokens appear in the full path", () => {
    const f = file({ path: "src/auth/login/auth.service.ts" });
    const one = scorePathKeywords(f, ["auth"]);
    const two = scorePathKeywords(f, ["auth", "login"]);
    expect(two.score).toBeGreaterThanOrEqual(one.score);
  });

  it("returns 0 when no query token appears in the path", () => {
    const f = file({ path: "src/utils/format.ts" });
    expect(scorePathKeywords(f, ["auth"]).score).toBe(0);
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
    expect(result.score).toBeGreaterThan(0);
  });

  it("boosts .ts files when the question mentions 'test'", () => {
    const f = file({ extKey: "ts" });
    const result = scoreExtension(f, ["test", "auth"]);
    expect(result.score).toBeGreaterThan(0);
  });

  it("boosts .json files when the question mentions 'config'", () => {
    const f = file({ extKey: "json" });
    const result = scoreExtension(f, ["config"]);
    expect(result.score).toBeGreaterThan(0);
  });

  it("returns 0 when the extension doesn't match any hint", () => {
    const f = file({ extKey: "ts" });
    expect(scoreExtension(f, ["config"]).score).toBe(0);
  });
});

describe("scoreReadme", () => {
  it("boosts the README itself for overview questions", () => {
    const f = file({
      path: "README.md",
      name: "README.md",
      extension: ".md",
      extKey: "md",
      folder: "",
    });
    const ctx = makeContext("What is this project?", true);
    const result = scoreReadme(f, ctx);
    expect(result.score).toBeGreaterThan(0);
  });

  it("boosts a file whose path is in the readmeReferencedPaths set", () => {
    const f = file({ path: "src/auth.ts" });
    const ctx = makeContext("anything", true, new Set(["src/auth.ts"]));
    const result = scoreReadme(f, ctx);
    expect(result.score).toBe(100);
  });

  it("returns 0 for unrelated files with no README reference", () => {
    const f = file({ path: "src/utils/format.ts", folder: "src/utils" });
    const ctx = makeContext("auth", true);
    expect(scoreReadme(f, ctx).score).toBe(0);
  });
});

describe("runAllSignals", () => {
  it("returns one entry per signal", () => {
    const f = file({});
    const ctx = makeContext("auth", true);
    const all = runAllSignals(f, ctx);
    expect(all).toHaveProperty("filename");
    expect(all).toHaveProperty("folder");
    expect(all).toHaveProperty("pathKeywords");
    expect(all).toHaveProperty("extension");
    expect(all).toHaveProperty("readme");
  });
});
