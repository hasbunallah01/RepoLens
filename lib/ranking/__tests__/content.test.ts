/**
 * Tests for the content-scoring helper.
 *
 * The scoring rules are deliberately simple: re-use the existing
 * `tokenizeQuery` (which already drops stopwords and stems), measure
 * query-token coverage in the body, and shape the score so a
 * single-keyword hit still scores meaningfully.
 */

import { describe, expect, it } from "vitest";
import { scoreContent, tokenizeContent, MAX_CONTENT_CHARS } from "../content";
import { tokenizeQuery } from "../tokens";
import type { IndexedFile } from "@/types/repository";

function mkFile(path: string): IndexedFile {
  const name = path.split("/").pop() ?? path;
  const lastDot = name.lastIndexOf(".");
  const extension = lastDot >= 0 ? name.slice(lastDot) : "";
  const extKey = lastDot >= 0 ? name.slice(lastDot + 1).toLowerCase() : "";
  const folder = path.includes("/")
    ? path.slice(0, path.lastIndexOf("/"))
    : "";
  return { path, name, extension, extKey, language: "TypeScript", folder, sizeBytes: 1024 };
}

describe("tokenizeContent", () => {
  it("drops stopwords the same way tokenizeQuery does", () => {
    const text = "The architecture is a high level overview of the system";
    const tokens = tokenizeContent(text);
    const qTokens = tokenizeQuery(text);
    expect(tokens).toEqual(qTokens);
    // "the", "is", "a", "of" must be filtered.
    expect(tokens).not.toContain("the");
    expect(tokens).not.toContain("is");
    expect(tokens).not.toContain("a");
    expect(tokens).not.toContain("of");
  });

  it("stems long words like the rest of the engine", () => {
    // Use a word the stemmer actually folds. "authentication" ->
    // "auth" via the LONG_SUFFIXES table.
    const text = "The authentication documentation is the canonical source";
    const tokens = tokenizeContent(text);
    expect(tokens).toContain("auth");
  });
});

describe("scoreContent", () => {
  it("returns 0 for an empty content string", () => {
    const file = mkFile("src/foo.ts");
    const tokens = tokenizeQuery("architecture");
    const s = scoreContent(file, tokens, "");
    expect(s.score).toBe(0);
    expect(s.hits).toEqual([]);
  });

  it("returns 0 when the body has no matching tokens", () => {
    const file = mkFile("src/foo.ts");
    const tokens = tokenizeQuery("authentication");
    const s = scoreContent(
      file,
      tokens,
      "// Just a comment about parsing CSV files",
    );
    expect(s.score).toBe(0);
  });

  it("returns a high score for a body that matches every question keyword", () => {
    const file = mkFile("src/foo.ts");
    const tokens = tokenizeQuery("authentication routing layer");
    const s = scoreContent(
      file,
      tokens,
      "/* High level authentication for the routing layer. */",
    );
    expect(s.score).toBe(100);
    expect(s.hits.length).toBeGreaterThan(0);
  });

  it("returns a positive score for a body that matches one of N keywords", () => {
    const file = mkFile("src/foo.ts");
    const tokens = tokenizeQuery("authentication database migration");
    // Body only mentions authentication.
    const s = scoreContent(
      file,
      tokens,
      "// Authentication overview",
    );
    expect(s.score).toBeGreaterThan(0);
    expect(s.score).toBeLessThan(100);
    expect(s.hits).toContain("auth");
  });

  it("truncates very large bodies to the default cap", () => {
    const file = mkFile("src/foo.ts");
    const tokens = tokenizeQuery("authentication");
    // Pad a long body that does NOT contain "authentication" until
    // well past the 2000-char cap, then add the keyword past it.
    const longBody = "x".repeat(MAX_CONTENT_CHARS + 100) + " authentication";
    const s = scoreContent(file, tokens, longBody);
    // Should be 0 because the keyword sits past the cap.
    expect(s.score).toBe(0);
  });

  it("respects an explicit maxChars override", () => {
    const file = mkFile("src/foo.ts");
    const tokens = tokenizeQuery("authentication");
    // With a much larger cap, the keyword past 2000 chars becomes
    // visible.
    const longBody = "x".repeat(MAX_CONTENT_CHARS + 100) + " authentication";
    const s = scoreContent(file, tokens, longBody, {
      maxChars: MAX_CONTENT_CHARS + 200,
    });
    expect(s.score).toBeGreaterThan(0);
  });
});
