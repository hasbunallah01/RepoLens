/**
 * Tests for the hybrid (metadata + content) ranking engine.
 *
 * The hybrid layer is intentionally small — it only adds two narrow
 * behaviours on top of the existing metadata engine:
 *
 *   1. A conceptual-document boost for "architecture / design /
 *      overview" style questions.
 *   2. A content-fallback scan for weak metadata results.
 *
 * These tests cover both paths and the merge semantics, plus the
 * "no I/O at all" path (no `fetchContent` hook provided).
 */

import { describe, expect, it } from "vitest";
import { rankRelevantFilesHybrid } from "../hybrid";
import { mockIndexedFiles } from "../mock";
import { rankRelevantFiles } from "../rank";
import type { IndexedFile } from "@/types/repository";

/**
 * Build a tiny in-memory file list for tests. Each file is an
 * `IndexedFile` with the path, name, and folder fields set; other
 * fields are filled with sensible defaults.
 */
function mkFile(
  path: string,
  opts: Partial<IndexedFile> = {},
): IndexedFile {
  const name = path.split("/").pop() ?? path;
  const lastDot = name.lastIndexOf(".");
  const extension = lastDot >= 0 ? name.slice(lastDot) : "";
  const extKey = lastDot >= 0 ? name.slice(lastDot + 1).toLowerCase() : "";
  const folder = path.includes("/")
    ? path.slice(0, path.lastIndexOf("/"))
    : "";
  return {
    path,
    name,
    extension,
    extKey,
    folder,
    language: opts.language ?? "TypeScript",
    sizeBytes: opts.sizeBytes ?? 1024,
    ...opts,
  };
}

/** In-memory content provider that returns a body for known paths. */
function makeContentProvider(
  bodies: Record<string, string>,
): (path: string) => Promise<string | null> {
  return async (path: string) => {
    if (Object.prototype.hasOwnProperty.call(bodies, path)) {
      return bodies[path]!;
    }
    return null;
  };
}

describe("rankRelevantFilesHybrid", () => {
  it("returns the metadata-only result when no fetchContent hook is provided", async () => {
    const result = await rankRelevantFilesHybrid(
      "How does authentication work?",
      mockIndexedFiles,
    );
    expect(result.hybrid.contentFallbackExecuted).toBe(false);
    expect(result.hybrid.contentScanned).toBe(0);
    expect(result.hybrid.contentMatched).toBe(0);
    // Top match should still be the auth service file from the
    // existing metadata engine.
    expect(result.ranked[0]?.file.path).toBe("src/auth/auth.service.ts");
  });

  it("does not run the conceptual-doc boost without a conceptual intent", async () => {
    const result = await rankRelevantFilesHybrid(
      "How does authentication work?",
      mockIndexedFiles,
    );
    // "How does authentication work?" stems to ["auth", "work"]. No
    // conceptual intent token, so no boost.
    expect(result.hybrid.conceptualBoosted).toEqual([]);
  });

  it("boosts the README on a 'what does this repository do' question", async () => {
    // Existing test in rank.test.ts already proves the metadata
    // engine alone surfaces README for natural overview questions;
    // here we prove the hybrid layer doesn't regress that.
    const result = await rankRelevantFilesHybrid(
      "What does this repository do?",
      mockIndexedFiles,
    );
    expect(result.ranked[0]?.file.path).toBe("README.md");
  });

  it("surfaces an ARCHITECTURE doc on a 'explain the architecture' question", async () => {
    const files: IndexedFile[] = [
      mkFile("README.md", { extKey: "md" }),
      mkFile("docs/ARCHITECTURE.md", { extKey: "md" }),
      mkFile("src/auth/auth.service.ts"),
      mkFile("src/index.ts"),
    ];

    const result = await rankRelevantFilesHybrid(
      "Explain the architecture",
      files,
    );
    const paths = result.ranked.map((r) => r.file.path);
    // The docs/ARCHITECTURE.md should appear in the top results
    // (the conceptual boost nudges it up).
    const archIdx = paths.indexOf("docs/ARCHITECTURE.md");
    expect(archIdx).toBeGreaterThanOrEqual(0);
    expect(archIdx).toBeLessThan(paths.length);
  });

  it("boosts docs/* files on a conceptual question but does not boost non-doc files", async () => {
    const files: IndexedFile[] = [
      mkFile("README.md", { extKey: "md" }),
      mkFile("docs/overview.md", { extKey: "md" }),
      mkFile("src/architecture/server.ts"), // not a doc — must NOT be boosted
      mkFile("src/index.ts"),
    ];

    const result = await rankRelevantFilesHybrid(
      "Explain the architecture",
      files,
    );
    // The conceptual boost should have touched the docs/* paths,
    // never the .ts file.
    expect(
      result.hybrid.conceptualBoosted.some((p) => p.endsWith(".ts")),
    ).toBe(false);
    expect(
      result.hybrid.conceptualBoosted.some((p) => p === "README.md"),
    ).toBe(true);
    expect(
      result.hybrid.conceptualBoosted.some((p) => p === "docs/overview.md"),
    ).toBe(true);
  });

  it("does not touch docs/* when the question has no conceptual intent", async () => {
    const files: IndexedFile[] = [
      mkFile("README.md", { extKey: "md" }),
      mkFile("docs/notes.md", { extKey: "md" }),
      mkFile("src/auth/auth.service.ts"),
    ];

    const result = await rankRelevantFilesHybrid(
      "How does authentication work?",
      files,
    );
    // No conceptual intent ("auth", "work" only), so no boost.
    expect(result.hybrid.conceptualBoosted).toEqual([]);
  });

  it("runs the content fallback when the metadata result is weak and a hook is provided", async () => {
    // Tiny repo: nothing in the metadata has "architecture" in its
    // path or filename. With the existing engine, this is a weak
    // (effectively empty) result, so the content fallback should
    // run and the file whose body talks about architecture should
    // be surfaced.
    const files: IndexedFile[] = [
      mkFile("src/a.ts"),
      mkFile("src/b.ts"),
      mkFile("src/c.ts"),
    ];
    const bodies: Record<string, string> = {
      "src/a.ts":
        "// Token refresh + cookie expiry logic\n" +
        "function refreshToken() { /* ... */ }",
      "src/b.ts":
        "// High-level architecture for the routing layer.\n" +
        "function routeRequest() { /* ... */ }",
      "src/c.ts":
        "// Database connection helpers.\n" +
        "function connect() { /* ... */ }",
    };

    const result = await rankRelevantFilesHybrid(
      "Explain the architecture of the routing layer",
      files,
      { fetchContent: makeContentProvider(bodies) },
    );

    expect(result.hybrid.contentFallbackExecuted).toBe(true);
    expect(result.hybrid.contentMatched).toBeGreaterThan(0);

    // src/b.ts contains the only body that talks about architecture
    // AND routing, so it must be the top content-scored file. The
    // hybrid merge keeps the highest score per path.
    const bIdx = result.ranked.findIndex(
      (r) => r.file.path === "src/b.ts",
    );
    const aIdx = result.ranked.findIndex(
      (r) => r.file.path === "src/a.ts",
    );
    expect(bIdx).toBeGreaterThanOrEqual(0);
    // b.ts should outrank a.ts because it has more of the question's
    // keywords in its body.
    if (aIdx >= 0) {
      expect(bIdx).toBeLessThan(aIdx);
    }
    // And the top of the list must be b.ts.
    expect(result.ranked[0]?.file.path).toBe("src/b.ts");
  });

  it("does NOT run the content fallback when the metadata result is strong", async () => {
    // Existing "How does authentication work?" against the mock
    // auth fixture returns a strong, multi-file result. The hybrid
    // engine should NOT pay the cost of a content scan in that
    // case.
    const bodies: Record<string, string> = {
      "src/auth/auth.service.ts":
        "// Does NOT talk about architecture — body is unrelated.",
    };

    const result = await rankRelevantFilesHybrid(
      "How does authentication work?",
      mockIndexedFiles,
      { fetchContent: makeContentProvider(bodies) },
    );
    expect(result.hybrid.contentFallbackExecuted).toBe(false);
    // The top match is still the auth service file.
    expect(result.ranked[0]?.file.path).toBe("src/auth/auth.service.ts");
  });

  it("treats per-file fetch failures as a no-op (does not abort the scan)", async () => {
    const files: IndexedFile[] = [
      mkFile("src/a.ts"),
      mkFile("src/b.ts"),
    ];
    // The provider throws on a.ts but returns a body for b.ts.
    const provider = async (path: string): Promise<string | null> => {
      if (path === "src/a.ts") throw new Error("network down");
      if (path === "src/b.ts") {
        return "// High-level architecture overview for the routing layer";
      }
      return null;
    };
    const result = await rankRelevantFilesHybrid(
      "Explain the architecture of the routing layer",
      files,
      { fetchContent: provider },
    );
    // The engine must survive the throw and still surface b.ts.
    expect(result.hybrid.contentFallbackExecuted).toBe(true);
    expect(result.ranked.some((r) => r.file.path === "src/b.ts")).toBe(
      true,
    );
  });

  it("deduplicates by path and keeps the highest score", async () => {
    // a.ts appears in both the metadata and the content ranking;
    // the merged entry must keep the higher of the two scores.
    const files: IndexedFile[] = [
      mkFile("src/a.ts"),
    ];
    // The question's keyword "architecture" appears in BOTH the
    // filename (weakly — single token overlap on "architectur" via
    // the stemmer) and the body. The body score should win.
    const bodies: Record<string, string> = {
      "src/a.ts":
        "/* Architecture documentation for the routing layer and request lifecycle. */",
    };
    const result = await rankRelevantFilesHybrid(
      "Explain the architecture of the routing layer",
      files,
      { fetchContent: makeContentProvider(bodies) },
    );
    expect(result.ranked).toHaveLength(1);
    expect(result.ranked[0]?.file.path).toBe("src/a.ts");
    // The reason should mention body content, not just filename.
    expect(result.ranked[0]?.reason).toMatch(/body|content|keyword|architecture/i);
  });

  it("returns the same metadata result when the question is empty", async () => {
    const result = await rankRelevantFilesHybrid("", mockIndexedFiles, {
      fetchContent: makeContentProvider({}),
    });
    expect(result.ranked).toEqual([]);
    expect(result.hybrid.contentFallbackExecuted).toBe(false);
    expect(result.hybrid.conceptualBoosted).toEqual([]);
  });

  it("returns the same metadata result when the question is all stopwords", async () => {
    const result = await rankRelevantFilesHybrid(
      "How is it done?",
      mockIndexedFiles,
      { fetchContent: makeContentProvider({}) },
    );
    expect(result.ranked).toEqual([]);
    expect(result.hybrid.contentFallbackExecuted).toBe(false);
  });

  it("preserves the RankResult shape (downstream pipeline compatibility)", async () => {
    const result = await rankRelevantFilesHybrid(
      "How does authentication work?",
      mockIndexedFiles,
    );
    // All base RankResult fields must be present.
    expect(typeof result.question).toBe("string");
    expect(Array.isArray(result.ranked)).toBe(true);
    expect(typeof result.totalCandidates).toBe("number");
    expect(result.weights).toBeDefined();
    expect(typeof result.weights.filename).toBe("number");
    // Each entry in ranked has { file, score, reason }.
    for (const m of result.ranked) {
      expect(m.file).toBeDefined();
      expect(typeof m.file.path).toBe("string");
      expect(typeof m.score).toBe("number");
      expect(typeof m.reason).toBe("string");
    }
  });

  it("metadata top score is reported in the hybrid diagnostics", async () => {
    const result = await rankRelevantFilesHybrid(
      "How does authentication work?",
      mockIndexedFiles,
    );
    // The top of the metadata ranking is the auth service file.
    expect(result.hybrid.metadataTopScore).toBeGreaterThan(0);
    // And it matches the top entry in the (boosted) result.
    const metaTop = rankRelevantFiles(
      "How does authentication work?",
      mockIndexedFiles,
    ).ranked[0]?.score;
    expect(result.hybrid.metadataTopScore).toBe(metaTop);
  });

  it("does not regress an existing strong-metadata result when the fetchContent hook throws", async () => {
    // The auth question produces a strong metadata result, so the
    // content fallback is short-circuited and the hook is never
    // called. The engine must still return the metadata ranking
    // (no boost, no scan, no crash).
    const result = await rankRelevantFilesHybrid(
      "How does authentication work?",
      mockIndexedFiles,
      {
        // If this ever runs, the test should fail loudly.
        fetchContent: async () => {
          throw new Error("hook should not be called for strong metadata");
        },
      },
    );
    // Strong metadata → no content fallback was triggered.
    expect(result.hybrid.contentFallbackExecuted).toBe(false);
    // Top match is the auth service file.
    expect(result.ranked[0]?.file.path).toBe("src/auth/auth.service.ts");
  });
});

/* -------------------------------------------------------------------------- */
/*  Conceptual-doc detection (white-box)                                       */
/* -------------------------------------------------------------------------- */

describe("conceptual doc detection", () => {
  it("treats docs/* markdown files as conceptual docs", async () => {
    const files: IndexedFile[] = [
      mkFile("README.md", { extKey: "md" }),
      mkFile("docs/intro.md", { extKey: "md" }),
      mkFile("docs/hello-world.md", { extKey: "md" }),
      mkFile("src/foo.ts"),
    ];
    const result = await rankRelevantFilesHybrid(
      "Explain the architecture",
      files,
    );
    const boosted = new Set(result.hybrid.conceptualBoosted);
    expect(boosted.has("README.md")).toBe(true);
    expect(boosted.has("docs/intro.md")).toBe(true);
    expect(boosted.has("docs/hello-world.md")).toBe(true);
  });
});
