/**
 * Tests for the tokenization helpers in `lib/ranking/tokens.ts`.
 *
 * Tokenization is the foundation of every signal, so we cover:
 *   - lowercase + punctuation handling
 *   - code-path separator handling (. _ - /)
 *   - stopword removal
 *   - lightweight stemming (plurals, gerunds, "authentication" -> "auth")
 *   - filename extension stripping
 */

import { describe, expect, it } from "vitest";
import {
  tokenize,
  tokenizeQuery,
  tokenizeFilePath,
  tokenizeFileName,
  tokenizeFolder,
} from "../tokens";

describe("tokenize", () => {
  it("lowercases and strips punctuation", () => {
    expect(tokenize("Hello, World!")).toEqual(["hello", "world"]);
  });

  it("splits common code-path separators", () => {
    expect(tokenize("auth-service.ts")).toEqual(["auth", "service", "ts"]);
    expect(tokenize("src/lib/utils.ts")).toEqual(["src", "lib", "utils", "ts"]);
    expect(tokenize("user_profile.config")).toEqual(["user", "profile", "config"]);
  });

  it("returns an empty array for empty input", () => {
    expect(tokenize("")).toEqual([]);
  });
});

describe("tokenizeQuery", () => {
  it("removes common stopwords", () => {
    expect(tokenizeQuery("How does it work?")).toEqual(["work"]);
  });

  it("stems obvious plural/gerund forms", () => {
    expect(tokenizeQuery("running tests")).toEqual(["runn", "test"]);
  });

  it("stems long words to a recognisable root", () => {
    // "authentication" -> "auth" via suffix stripping.
    expect(tokenizeQuery("authentication")).toContain("auth");
  });

  it("ignores very short tokens", () => {
    expect(tokenizeQuery("a b c auth")).toEqual(["auth"]);
  });
});

describe("tokenizeFilePath", () => {
  it("splits paths into individual segments", () => {
    expect(tokenizeFilePath("src/auth/auth.service.ts")).toEqual([
      "src",
      "auth",
      "auth",
      "service",
      "ts",
    ]);
  });

  it("keeps folder-style tokens like 'src' and 'lib' (no stopword filter)", () => {
    const tokens = tokenizeFilePath("src/lib/auth.ts");
    expect(tokens).toContain("src");
    expect(tokens).toContain("lib");
  });
});

describe("tokenizeFileName", () => {
  it("strips the extension before tokenizing", () => {
    expect(tokenizeFileName("auth.service.ts")).toEqual([
      "auth",
      "service",
    ]);
  });

  it("handles a file with no extension", () => {
    expect(tokenizeFileName("Makefile")).toEqual(["makefile"]);
  });
});

describe("tokenizeFolder", () => {
  it("returns [] for the root folder", () => {
    expect(tokenizeFolder("")).toEqual([]);
  });

  it("splits a nested folder path", () => {
    expect(tokenizeFolder("src/auth/services")).toEqual([
      "src",
      "auth",
      "service",
    ]);
  });
});
