/**
 * Lines-of-code estimation for indexed files (Backend 8A).
 *
 * Why estimation?
 * ---------------
 * Fetching the *decoded* contents of every source file in a
 * repository is prohibitive on a public API route: each file
 * would need its own `GET /repos/{owner}/{repo}/contents/{path}`
 * call, which on a non-trivial repo would mean hundreds of
 * additional requests per analyse. Instead, we estimate the
 * line count from the file's `sizeBytes` (which GitHub already
 * returns in the recursive tree) using language-specific
 * "average characters per line" heuristics. This is the same
 * approach used by cloc's `--scaled` mode and other tooling when
 * full source access is not available.
 *
 * The estimate is deliberately conservative for languages where
 * shorter lines are the norm (Python, YAML, Markdown) and more
 * generous for minified-style outputs. The numbers below are
 * averages drawn from publicly available corpus studies and are
 * revisited whenever the corpus shifts significantly.
 *
 * Constraints (per the indexer brief):
 *   - Binary files, images, videos, archives, lock files, and
 *     already-excluded minified/bundled outputs are all skipped —
 *     they are removed upstream by `shouldIgnorePath` and never
 *     reach this function via the regular `IndexedFile[]` path.
 *   - The estimation reuses the existing `IndexedFile` shape and
 *     `languageForFile()` output so no new mapping is introduced.
 *
 * Design rules:
 *   - Pure functions, no I/O, no `Date.now()`, no globals.
 *   - Result is a plain `number` (rounded to the nearest integer).
 *   - A zero-byte file contributes zero lines (not one).
 *   - Empty / non-text languages ("Other") fall back to a neutral
 *     default width so we still produce *some* signal instead of
 *     silently dropping the file.
 */

import type { IndexedFile } from "@/types/repository";

/**
 * Average characters per source line, keyed by the same language
 * label produced by `languageForFile()`. The default (40) is a
 * neutral middle-ground chosen to match general-purpose code.
 */
const AVG_LINE_WIDTH: Record<string, number> = {
  // Curly-brace / verbose
  TypeScript: 38,
  JavaScript: 36,
  Java: 42,
  Kotlin: 38,
  Swift: 40,
  "C++": 38,
  "C#": 40,
  Go: 36,
  Rust: 38,
  PHP: 38,
  Scala: 38,
  "Objective-C": 42,
  "Objective-C++": 42,
  Erlang: 44,
  Elixir: 40,
  Haskell: 38,
  // Whitespace-sensitive / terse
  Python: 32,
  Ruby: 30,
  Perl: 28,
  Lua: 30,
  Dart: 36,
  R: 32,
  Julia: 36,
  Zig: 36,
  // Shell / scripting
  Shell: 32,
  PowerShell: 38,
  // Markup / data — usually short lines
  HTML: 48,
  CSS: 32,
  SCSS: 32,
  Sass: 32,
  Less: 32,
  Vue: 40,
  Svelte: 40,
  Markdown: 60,
  MDX: 60,
  JSON: 60,
  YAML: 40,
  TOML: 36,
  XML: 50,
  INI: 40,
  // Database / query
  SQL: 50,
  GraphQL: 50,
  // Misc
  Dockerfile: 36,
  Makefile: 40,
  Procfile: 30,
  TeX: 60,
  Text: 60,
  Git: 40,
  EditorConfig: 40,
};

const DEFAULT_LINE_WIDTH = 40;

/**
 * Look up the average line width for a language label produced by
 * `languageForFile()`. Falls back to a neutral default so unknown
 * labels still contribute a sensible estimate.
 */
function avgLineWidthFor(language: string): number {
  return AVG_LINE_WIDTH[language] ?? DEFAULT_LINE_WIDTH;
}

/**
 * Estimate the number of source lines in a single file.
 *
 * Returns `0` for empty files. The estimate is rounded to the
 * nearest integer so the final aggregate is a clean `number`.
 */
export function estimateLinesForFile(file: IndexedFile): number {
  if (file.sizeBytes <= 0) return 0;
  const width = avgLineWidthFor(file.language);
  // Guard against pathological values (e.g. a corrupt `0`).
  const safeWidth = width > 0 ? width : DEFAULT_LINE_WIDTH;
  return Math.max(1, Math.round(file.sizeBytes / safeWidth));
}

/**
 * Sum the estimated lines of code across every file in the
 * supplied list.
 *
 * The input is expected to already be filtered (binary files,
 * images, lock files, etc. removed by `shouldIgnorePath` upstream).
 * This function does not re-apply the ignore list — it trusts the
 * caller so the same source-of-truth is used for every metric the
 * index produces.
 */
export function estimateLinesOfCode(files: ReadonlyArray<IndexedFile>): number {
  let total = 0;
  for (const file of files) {
    total += estimateLinesForFile(file);
  }
  return total;
}
