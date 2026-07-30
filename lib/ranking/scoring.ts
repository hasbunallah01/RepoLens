/**
 * Per-signal scoring for the ranking engine.
 *
 * Every signal is a small pure function with the same shape:
 *   (file, queryTokens) -> number in [0, 100]
 *
 * The top-level `rankRelevantFiles` function aggregates these signals
 * with caller-configurable weights and normalizes the final score to
 * 0..100. This keeps each signal independent, testable, and easy to
 * swap or add to in later phases.
 *
 * Active signals (Phase 3C1):
 *   - Filename similarity     (how well the filename matches the question)
 *   - Folder similarity       (how well the folder path matches the question)
 *   - Keyword frequency       (how many question tokens appear in the file's full path)
 *   - File extension relevance (small boost when extension fits question topic)
 *
 * Future phases can add more signals (e.g. recency, popularity) by
 * extending {@link RankSignalWeights} and adding a new function here.
 */

import type { IndexedFile } from "@/types/repository";
import {
  tokenizeFileName,
  tokenizeFilePath,
  tokenizeFolder,
} from "./tokens";

/* -------------------------------------------------------------------------- */
/*  Helpers                                                                   */
/* -------------------------------------------------------------------------- */

/** Jaccard similarity between two token sets, in [0, 1]. */
function jaccard(a: ReadonlySet<string>, b: ReadonlySet<string>): number {
  if (a.size === 0 && b.size === 0) return 0;
  let inter = 0;
  for (const t of a) if (b.has(t)) inter += 1;
  const union = a.size + b.size - inter;
  return union === 0 ? 0 : inter / union;
}

/** Fraction of query tokens found in a candidate token set, in [0, 1]. */
function queryCoverage(
  queryTokens: ReadonlyArray<string>,
  candidateTokens: ReadonlySet<string>,
): number {
  if (queryTokens.length === 0) return 0;
  let hits = 0;
  for (const q of queryTokens) if (candidateTokens.has(q)) hits += 1;
  return hits / queryTokens.length;
}

/** Clamp n to the inclusive range [lo, hi]. */
function clamp(n: number, lo: number, hi: number): number {
  if (n < lo) return lo;
  if (n > hi) return hi;
  return n;
}

/* -------------------------------------------------------------------------- */
/*  Signal 1: filename similarity                                             */
/* -------------------------------------------------------------------------- */

/**
 * Score how well the filename matches the question, on a 0..100 scale.
 *
 * Uses Jaccard similarity on the stemmed tokens plus a small boost for an
 * exact full-filename match. The filename is the strongest single signal
 * for most code-search questions, which is why it has the highest default
 * weight in {@link DEFAULT_RANK_WEIGHTS}.
 */
export function scoreFilename(
  file: IndexedFile,
  queryTokens: ReadonlyArray<string>,
): number {
  if (queryTokens.length === 0) return 0;

  const nameTokens = new Set(tokenizeFileName(file.name));
  const qSet = new Set(queryTokens);
  if (nameTokens.size === 0) return 0;

  // Exact full-name match (e.g. question = "auth", filename = "auth.ts").
  const lowerName = file.name.toLowerCase().replace(/\.[^.]+$/, "");
  const joinedQ = queryTokens.join(" ");
  if (lowerName && lowerName === joinedQ) {
    return 100;
  }

  const jac = jaccard(nameTokens, qSet);              // 0..1
  const cov = queryCoverage(queryTokens, nameTokens); // 0..1

  // Blend Jaccard (symmetric) with query coverage (asymmetric: how much
  // of the question does this filename cover?).
  const blended = Math.max(jac * 1.2, jac * 0.6 + cov * 0.6);
  return clamp(Math.round(blended * 100), 0, 100);
}

/* -------------------------------------------------------------------------- */
/*  Signal 2: folder similarity                                               */
/* -------------------------------------------------------------------------- */

/**
 * Score how well the folder path matches the question, on a 0..100 scale.
 *
 * Folder context is useful for questions like "where are the API endpoints
 * defined?" — the folder name (e.g. "routes", "controllers", "api") is
 * often more informative than the file name alone.
 */
export function scoreFolder(
  file: IndexedFile,
  queryTokens: ReadonlyArray<string>,
): number {
  if (queryTokens.length === 0) return 0;
  if (!file.folder) return 0;

  const folderTokens = new Set(tokenizeFolder(file.folder));
  if (folderTokens.size === 0) return 0;
  const qSet = new Set(queryTokens);

  const jac = jaccard(folderTokens, qSet);
  const cov = queryCoverage(queryTokens, folderTokens);
  const blended = jac * 0.6 + cov * 0.6;
  return clamp(Math.round(blended * 100), 0, 100);
}

/* -------------------------------------------------------------------------- */
/*  Signal 3: keyword frequency                                               */
/* -------------------------------------------------------------------------- */

/**
 * Score based on the raw count of question tokens that appear anywhere in
 * the file's full path, on a 0..100 scale.
 *
 * This is the "keyword frequency" signal — files whose paths contain more
 * of the question's keywords are more likely to be about the topic. We
 * use the *raw* full path (not just name or folder) so that deeply
 * nested files like `src/features/auth/login/auth.service.ts` can win
 * over a shallow `auth.ts` when the question is specifically about the
 * login flow.
 *
 * The score is shaped so a single hit gives a meaningful but not maximal
 * score, and additional hits keep adding value (with diminishing returns
 * via square-root) all the way to 100.
 */
export function scoreKeywordFrequency(
  file: IndexedFile,
  queryTokens: ReadonlyArray<string>,
): number {
  if (queryTokens.length === 0) return 0;

  const pathTokens = new Set(tokenizeFilePath(file.path));
  if (pathTokens.size === 0) return 0;

  // Count the *raw* number of query tokens present in the path. Note
  // we deliberately allow the same path token to satisfy multiple query
  // tokens if they all stem to the same root (e.g. "auth", "auth", "auth"
  // all match a single "auth" in the path). Each query token is checked
  // independently.
  const matchedSet = new Set<string>();
  for (const q of queryTokens) {
    if (pathTokens.has(q)) matchedSet.add(q);
  }
  const hits = matchedSet.size;

  // Coverage (0..1) so a 1-of-1 hit still produces 100, while a 1-of-3
  // hit stays around ~58 after the square-root shape.
  const coverage = hits / queryTokens.length;
  const shaped = Math.sqrt(coverage);
  return clamp(Math.round(shaped * 100), 0, 100);
}

/* -------------------------------------------------------------------------- */
/*  Signal 4: file extension relevance                                        */
/* -------------------------------------------------------------------------- */

/**
 * A small built-in map of question keywords to file extensions that are
 * most likely to contain the answer. This is intentionally narrow — we
 * only want a tiny nudge in the score, not a hard filter, because we
 * don't actually know the file contents.
 */
const EXTENSION_HINTS: ReadonlyArray<{
  keywords: readonly string[];
  /** Plain file extensions (e.g. "json"). */
  exts: readonly string[];
  /** Filename patterns to match (lowercased), e.g. "*.test.ts". */
  namePatterns?: readonly RegExp[];
  /** Path substring patterns (lowercased) to match, e.g. "/tests/". */
  pathIncludes?: readonly string[];
}> = [
  {
    keywords: ["test", "spec", "testing"],
    exts: ["ts", "tsx", "js", "jsx"],
    namePatterns: [/\.test\.[a-z0-9]+$/, /\.spec\.[a-z0-9]+$/],
    pathIncludes: ["/tests/", "/test/", "/__tests__/"],
  },
  {
    keywords: ["config", "configuration", "setting", "settings"],
    exts: ["json", "yaml", "yml", "toml", "ini", "env"],
    namePatterns: [/^config\.[a-z0-9]+$/, /\.config\.[a-z0-9]+$/, /rc\.[a-z0-9]+$/],
  },
  {
    keywords: ["build", "ci", "deploy", "pipeline", "workflow"],
    exts: ["yml", "yaml", "dockerfile", "sh", "toml"],
    pathIncludes: [".github/workflows/", "/scripts/", "/deploy/"],
  },
  {
    keywords: ["doc", "docs", "documentation"],
    exts: ["md", "mdx", "rst", "txt"],
    pathIncludes: ["/docs/"],
  },
  {
    keywords: ["style", "css", "ui", "design", "theme", "layout"],
    exts: ["css", "scss", "sass", "less", "tsx", "jsx"],
    pathIncludes: ["/styles/", "/components/"],
  },
];

/** True if a string is a README filename (any common casing/extension). */
function isReadmeName(name: string): boolean {
  const n = name.toLowerCase();
  return n === "readme" || n.startsWith("readme.");
}

/**
 * Score the relevance of the file's extension to the question, on a
 * 0..100 scale. Uses the {@link EXTENSION_HINTS} table to give a small
 * boost when the question explicitly mentions a concept (test, config,
 * build, etc.) and the file is of a matching type. README files are also
 * treated as documentation for "what is this project / how do I get
 * started" questions.
 */
export function scoreExtension(
  file: IndexedFile,
  queryTokens: ReadonlyArray<string>,
): number {
  if (queryTokens.length === 0) return 0;

  const qSet = new Set(queryTokens);
  const extKey = file.extKey.toLowerCase();
  const lowerName = file.name.toLowerCase();
  const lowerPath = file.path.toLowerCase();

  // README boost for documentation-flavored questions.
  if (isReadmeName(lowerName)) {
    const docKeywords = ["doc", "docs", "documentation", "readme", "overview", "intro"];
    if (qSet.has("readme") || docKeywords.some((k) => qSet.has(k))) {
      return 100;
    }
    if (qSet.has("what") || qSet.has("how") || qSet.has("project")) {
      return 60;
    }
  }

  for (const hint of EXTENSION_HINTS) {
    const hit = hint.keywords.find((k) => qSet.has(k));
    if (!hit) continue;

    // Filename pattern match (e.g. "auth.test.ts" for "test" keyword).
    if (hint.namePatterns) {
      for (const p of hint.namePatterns) {
        if (p.test(lowerName)) {
          return 100;
        }
      }
    }

    // Path substring match (e.g. "/tests/" for "test" keyword).
    if (hint.pathIncludes) {
      for (const inc of hint.pathIncludes) {
        if (lowerPath.includes(inc)) {
          return 90;
        }
      }
    }

    // Plain extension match.
    if (hint.exts.includes(extKey)) {
      return 100;
    }
  }

  return 0;
}
