/**
 * Per-signal scoring for the retrieval engine.
 *
 * Every signal is a small pure function with the same shape:
 *   (file, queryTokens, ctx) -> { score: 0..100, reason?: string }
 *
 * The top-level `retrieveRelevantFiles` function aggregates these signals
 * with caller-configurable weights and normalizes the final score to
 * 0..100. This keeps each signal independent, testable, and easy to swap
 * or add to in later phases.
 */

import type { IndexedFile } from "@/types/repository";
import {
  tokenizeFileName,
  tokenizeFilePath,
  tokenizeFolder,
  tokenizeQuery,
} from "./tokens";

/** A single scoring result. */
export interface SignalScore {
  /** 0..100 — contribution from this signal alone, before weighting. */
  score: number;
  /** Optional short reason for this signal's contribution. */
  reason?: string;
}

/** Shared context passed to every signal. */
export interface SignalContext {
  /** Stemmed, stopword-filtered question tokens. */
  queryTokens: string[];
  /** Whether the repo has a README, mirrored from RepoIndex.hasReadme. */
  hasReadme: boolean;
  /** Optional set of paths referenced by the README. */
  readmeReferencedPaths?: ReadonlySet<string>;
}

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

/* -------------------------------------------------------------------------- */
/*  Filename signal                                                           */
/* -------------------------------------------------------------------------- */

/**
 * Score how well the filename matches the question.
 *
 * Uses Jaccard similarity on the stemmed tokens plus a small boost for an
 * exact full-filename match. The filename is the strongest single signal
 * in most code-search use cases, which is why it has the highest default
 * weight in {@link DEFAULT_RETRIEVAL_WEIGHTS}.
 */
export function scoreFilename(
  file: IndexedFile,
  queryTokens: ReadonlyArray<string>,
): SignalScore {
  if (queryTokens.length === 0) return { score: 0 };

  const nameTokens = new Set(tokenizeFileName(file.name));
  const qSet = new Set(queryTokens);
  if (nameTokens.size === 0) return { score: 0 };

  // Exact full-name match (e.g. question = "auth", filename = "auth.ts").
  const lowerName = file.name.toLowerCase().replace(/\.[^.]+$/, "");
  const joinedQ = queryTokens.join(" ");
  if (lowerName && lowerName === joinedQ) {
    return { score: 100, reason: `Filename matches "${lowerName}"` };
  }

  const jac = jaccard(nameTokens, qSet);              // 0..1
  const cov = queryCoverage(queryTokens, nameTokens); // 0..1

  // Blend Jaccard (symmetric) with query coverage (asymmetric: how much of
  // the question does this filename cover?). Empirically this matches the
  // way humans phrase questions about specific files.
  const blended = Math.max(jac * 1.2, jac * 0.6 + cov * 0.6);
  const score = Math.max(0, Math.min(100, Math.round(blended * 100)));

  if (score <= 0) return { score: 0 };

  // Pick a representative matched token for the reason string.
  const hit = queryTokens.find((q) => nameTokens.has(q));
  const reason = hit
    ? `Filename contains "${hit}"`
    : "Filename overlaps with question";
  return { score, reason };
}

/* -------------------------------------------------------------------------- */
/*  Folder signal                                                             */
/* -------------------------------------------------------------------------- */

/**
 * Score how well the folder path matches the question. Folder context is
 * useful for questions like "where are the API endpoints defined?" —
 * the folder name (e.g. "routes", "controllers", "api") is often more
 * informative than the file name.
 */
export function scoreFolder(
  file: IndexedFile,
  queryTokens: ReadonlyArray<string>,
): SignalScore {
  if (queryTokens.length === 0) return { score: 0 };
  if (!file.folder) return { score: 0 };

  const folderTokens = new Set(tokenizeFolder(file.folder));
  if (folderTokens.size === 0) return { score: 0 };
  const qSet = new Set(queryTokens);

  const jac = jaccard(folderTokens, qSet);
  const cov = queryCoverage(queryTokens, folderTokens);
  const blended = jac * 0.6 + cov * 0.6;
  const score = Math.max(0, Math.min(100, Math.round(blended * 100)));
  if (score <= 0) return { score: 0 };

  const hit = queryTokens.find((q) => folderTokens.has(q));
  const reason = hit
    ? `Folder path contains "${hit}"`
    : "Folder path overlaps with question";
  return { score, reason };
}

/* -------------------------------------------------------------------------- */
/*  Path keyword frequency signal                                             */
/* -------------------------------------------------------------------------- */

/**
 * Score based on the total number of query tokens that appear anywhere in
 * the file's full path. This is the "keyword frequency" signal — files
 * whose paths contain more of the question's keywords are more likely to
 * be about the topic.
 *
 * We use the *raw* full path (not just name or folder) so that deeply
 * nested files like `src/features/auth/login/auth.service.ts` can win
 * over shallow `auth.ts` when the question is specifically about the
 * login flow.
 */
export function scorePathKeywords(
  file: IndexedFile,
  queryTokens: ReadonlyArray<string>,
): SignalScore {
  if (queryTokens.length === 0) return { score: 0 };

  const pathTokens = new Set(tokenizeFilePath(file.path));
  if (pathTokens.size === 0) return { score: 0 };

  const cov = queryCoverage(queryTokens, pathTokens);
  // Square-root the coverage so that 100% coverage doesn't immediately
  // max out the score — we want a path that hits 3/3 keywords to beat one
  // that hits 2/3, but not by 50%.
  const shaped = Math.sqrt(cov);
  const score = Math.max(0, Math.min(100, Math.round(shaped * 100)));
  if (score <= 0) return { score: 0 };

  const hits = queryTokens.filter((q) => pathTokens.has(q));
  const reason =
    hits.length === 1
      ? `Path contains keyword "${hits[0]}"`
      : `Path contains ${hits.length} question keywords`;
  return { score, reason };
}

/* -------------------------------------------------------------------------- */
/*  Extension relevance signal                                                */
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
 * Score the relevance of the file's extension to the question. Uses the
 * {@link EXTENSION_HINTS} table to give a small boost when the question
 * explicitly mentions a concept (test, config, build, etc.) and the file
 * is of a matching type. README files are also treated as documentation
 * for "what is this project / how do I get started" questions.
 */
export function scoreExtension(
  file: IndexedFile,
  queryTokens: ReadonlyArray<string>,
): SignalScore {
  if (queryTokens.length === 0) return { score: 0 };

  const qSet = new Set(queryTokens);
  const extKey = file.extKey.toLowerCase();
  const lowerName = file.name.toLowerCase();
  const lowerPath = file.path.toLowerCase();

  // README boost for documentation-flavored questions.
  if (isReadmeName(lowerName)) {
    const docKeywords = ["doc", "docs", "documentation", "readme", "overview", "intro"];
    if (qSet.has("readme") || docKeywords.some((k) => qSet.has(k))) {
      return { score: 100, reason: "README — likely the canonical overview" };
    }
    if (qSet.has("what") || qSet.has("how") || qSet.has("project")) {
      return { score: 60, reason: "README — project overview" };
    }
  }

  for (const hint of EXTENSION_HINTS) {
    const hit = hint.keywords.find((k) => qSet.has(k));
    if (!hit) continue;

    // Filename pattern match (e.g. "auth.test.ts" for "test" keyword).
    if (hint.namePatterns) {
      for (const p of hint.namePatterns) {
        if (p.test(lowerName)) {
          return { score: 100, reason: `Filename matches "${hit}" pattern` };
        }
      }
    }

    // Path substring match (e.g. "/tests/" for "test" keyword).
    if (hint.pathIncludes) {
      for (const inc of hint.pathIncludes) {
        if (lowerPath.includes(inc)) {
          return { score: 90, reason: `Path matches "${hit}" context (${inc})` };
        }
      }
    }

    // Plain extension match.
    if (hint.exts.includes(extKey)) {
      const reason = `Extension matches "${hit}" topic`;
      return { score: 100, reason };
    }
  }

  return { score: 0 };
}

/* -------------------------------------------------------------------------- */
/*  README reference signal                                                   */
/* -------------------------------------------------------------------------- */

/**
 * Score files that are either the README itself or are explicitly
 * referenced by the README. In Phase 3B we don't read README content, so
 * this signal is small — it just gives a tiny boost to the README file
 * and to any caller-provided list of "files the README mentions".
 */
export function scoreReadme(
  file: IndexedFile,
  ctx: SignalContext,
): SignalScore {
  const lowerName = file.name.toLowerCase();
  const isReadme = isReadmeName(lowerName);

  if (isReadme) {
    // README is always a reasonable "what is this project" answer.
    const q = ctx.queryTokens;
    const overviewish = q.some((t) =>
      ["what", "how", "why", "project", "overview", "intro", "start"].includes(t),
    );
    if (overviewish || q.length === 0) {
      return { score: 80, reason: "README is the canonical overview" };
    }
    return { score: 30, reason: "README present in repository" };
  }

  if (ctx.readmeReferencedPaths && ctx.readmeReferencedPaths.has(file.path)) {
    return { score: 100, reason: "Referenced by README" };
  }

  return { score: 0 };
}

/* -------------------------------------------------------------------------- */
/*  Convenience: run every signal                                             */
/* -------------------------------------------------------------------------- */

export interface AllSignals {
  filename: SignalScore;
  folder: SignalScore;
  pathKeywords: SignalScore;
  extension: SignalScore;
  readme: SignalScore;
}

/** Run every retrieval signal against a single file. */
export function runAllSignals(
  file: IndexedFile,
  ctx: SignalContext,
): AllSignals {
  return {
    filename: scoreFilename(file, ctx.queryTokens),
    folder: scoreFolder(file, ctx.queryTokens),
    pathKeywords: scorePathKeywords(file, ctx.queryTokens),
    extension: scoreExtension(file, ctx.queryTokens),
    readme: scoreReadme(file, ctx),
  };
}

/**
 * Re-derive a SignalContext from a raw question string. Useful for
 * callers that just want to pass a string in.
 */
export function makeContext(
  question: string,
  hasReadme: boolean,
  readmeReferencedPaths?: ReadonlySet<string>,
): SignalContext {
  return {
    queryTokens: tokenizeQuery(question),
    hasReadme,
    readmeReferencedPaths,
  };
}
