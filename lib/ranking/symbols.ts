/**
 * Phase 1 of the Universal Retrieval layer: per-file signal extractors.
 *
 * Reads the first few KB of a file's content and pulls out four
 * small, structured signals the rest of the retrieval pipeline can
 * consume:
 *
 *   1. **Exported top-level symbols** — function / class / interface /
 *      type / enum / const / let / var names. Per-language regex.
 *   2. **Leading doc-comment block** — the first contiguous run of
 *      comment lines (//, /* * /, or #) at the top of the file. This
 *      is the file's "what does this do" text in natural prose and is
 *      the strongest single signal for conceptual questions.
 *   3. **Import statements** — the raw import specifiers exactly as
 *      written in the file. Path resolution happens in Phase 2
 *      (graph.ts), not here — this module is pure string handling.
 *   4. **Environment-variable references** — `process.env.XXX`,
 *      `os.environ`, `os.getenv`, `os.Getenv` etc. Per-language.
 *
 * Constraints (per the Universal Retrieval design):
 *   - No new dependencies. No AST parser. Regex only.
 *   - Pure functions. No I/O outside the caller's `fetchContent` hook.
 *   - Reads at most the first `maxChars` of content (default 3000),
 *      matching the design's "first 3000 chars" budget.
 *   - Reuses the existing `tokenizeQuery` stemmer where it makes
 *      sense (caller does the actual stemmer pass).
 *
 * Supported languages (anything else gracefully no-ops on the
 * language-specific paths and falls through to a permissive
 * TypeScript-style default):
 *   - TypeScript / JavaScript (incl. .ts/.tsx/.js/.jsx/.mjs/.cjs)
 *   - Python (.py)
 *   - Go (.go)
 *
 * Everything else (Markdown, JSON, YAML, etc.) extracts the doc-
 * comment as the first `maxChars` chars of the file (no comment
 * syntax to strip) and skips the language-specific extractors.
 */

import { tokenize } from "./tokens";

/* -------------------------------------------------------------------------- */
/*  Defaults & types                                                          */
/* -------------------------------------------------------------------------- */

/**
 * Default character cap on the slice of a file that all extractors
 * read. Matches the design's "first 3000 chars" budget. Anything
 * past this slice is invisible to the symbol extractor — that's
 * the cost of "no AST parser".
 */
export const SYMBOL_SCAN_MAX_CHARS = 3000;

/**
 * Default cap on the leading doc-comment block. The design calls
 * for 1000 chars; this constant exists so tests can override it.
 */
export const DOC_COMMENT_MAX_CHARS = 1000;

/** Set of language labels the C-style extractor handles. */
const C_STYLE_LANGUAGES: ReadonlySet<string> = new Set([
  "TypeScript",
  "JavaScript",
  "TSX",
  "JSX",
  "Go",
  "Java",
  "Kotlin",
  "Rust",
  "C",
  "C++",
  "C#",
  "Swift",
  "Objective-C",
  "Objective-C++",
  "PHP",
]);

/** Set of language labels that use `#` for line comments. */
const HASH_STYLE_LANGUAGES: ReadonlySet<string> = new Set([
  "Python",
  "Ruby",
  "Shell",
  "Bash",
  "Zsh",
  "PowerShell",
  "YAML",
  "TOML",
]);

/** Languages that have no real comment syntax — treat the file head as prose. */
const PROSE_LANGUAGES: ReadonlySet<string> = new Set([
  "Markdown",
  "MDX",
  "JSON",
  "reStructuredText",
  "Text",
  "Plain Text",
]);

/** True if the language uses C-style comments. */
function isCStyle(lang: string): boolean {
  return C_STYLE_LANGUAGES.has(lang);
}

/** True if the language uses `#` line comments. */
function isHashStyle(lang: string): boolean {
  return HASH_STYLE_LANGUAGES.has(lang);
}

/** True if the language is a prose / no-comment language. */
function isProse(lang: string): boolean {
  return PROSE_LANGUAGES.has(lang);
}

/**
 * All four signals extracted from a single file. The shape is
 * stable across all three supported language families so the
 * orchestrator (Phase 4) can consume the result uniformly.
 */
export interface ExtractedSymbols {
  /** Top-level exported symbol names. e.g. `AuthService`, `telegramIngestWorker`. */
  symbols: ReadonlySet<string>;
  /** Leading doc-comment block, capped at {@link DOC_COMMENT_MAX_CHARS} chars. */
  docComment: string;
  /** Import specifiers exactly as written in the file. Phase 2 resolves them. */
  imports: ReadonlySet<string>;
  /** Environment variable names referenced in the file. */
  envVars: ReadonlySet<string>;
}

/* -------------------------------------------------------------------------- */
/*  Symbol name tokenization                                                  */
/* -------------------------------------------------------------------------- */

/**
 * Split a camelCase / snake_case symbol name into lowercased
 * word stems, the same way the rest of the engine splits question
 * words. The existing `tokenize` already handles snake_case
 * separators but it lowercases the input BEFORE its camelCase
 * split, so a symbol like `telegramIngestWorker` would never be
 * split. This helper does the camelCase split first.
 *
 * The output of this function is the same shape as
 * `tokenizeQuery`'s output (lowercased word stems), so a question
 * like "telegram bot" can be compared to a symbol like
 * `telegramIngestWorker` with a single `Set` intersection.
 */
export function tokenizeSymbolName(name: string): string[] {
  if (!name) return [];
  return name
    // Split camelCase BEFORE lowercasing. Handles:
    //   fooBar   -> foo Bar
    //   fooBAR   -> foo BAR (so the consumer can drop the ALL-CAPS tail)
    //   HTTPSConn -> HTTPS Conn
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2")
    // Now lowercase and split on common separators, just like
    // the rest of the engine.
    .toLowerCase()
    .replace(/[._/\\-]+/g, " ")
    .replace(/[^a-z0-9\s]+/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 0);
}

/* -------------------------------------------------------------------------- */
/*  1. Exported top-level symbols                                             */
/* -------------------------------------------------------------------------- */

/**
 * TypeScript / JavaScript / similar — match top-level `export ...`
 * declarations. Catches:
 *
 *   export function foo() {}        -> "foo"
 *   export default function foo(){} -> "foo"
 *   export class Foo {}             -> "Foo"
 *   export interface Foo {}         -> "Foo"
 *   export type Foo = ...           -> "Foo"
 *   export enum Foo {}              -> "Foo"
 *   export const foo = ...          -> "foo"
 *   export async function bar() {}  -> "bar"
 *
 * The regex uses multiline mode so a declaration on its own line is
 * captured even if the keyword is at the very start. The `^` anchor
 * ensures we only match top-level declarations, not nested ones.
 *
 * Limitations (documented in the design):
 *   - `export const { a, b } = ...` destructuring: we capture "a"
 *     and "b" only if they appear as a single identifier on the
 *     same line. Real destructuring across multiple lines is missed.
 *   - Multi-line declarations like:
 *         export class
 *           Foo<T> { ... }
 *     are missed because `Foo` is on a different line. This is
 *     accepted as the cost of regex-only parsing.
 */
const TS_SYMBOL_REGEX =
  /^export\s+(?:default\s+)?(?:async\s+)?(?:function\s+|class\s+|interface\s+|type\s+|enum\s+|const\s+|let\s+|var\s+)([A-Za-z_$][\w$]*)/gm;

/**
 * Python — match top-level `class` and `def` declarations. The
 * `^` anchor with the multiline flag means indented (nested)
 * defs are not captured.
 *
 *   class AuthService:        -> "AuthService"
 *   def telegram_ingest():    -> "telegram_ingest"
 *
 * Limitations:
 *   - Decorated classes / functions:
 *         @dataclass
 *         class Foo: pass
 *     still match because the `class Foo` line is captured.
 *   - Methods / nested defs are skipped by the `^` anchor.
 */
const PY_SYMBOL_REGEX = /^(?:class|def)\s+([A-Za-z_]\w*)/gm;

/**
 * Go — match top-level `func` and `type` declarations.
 *
 *   func Foo() {}                       -> "Foo"
 *   func (r *Receiver) Bar() {}         -> "Bar"
 *   type Foo struct {}                  -> "Foo"
 *   type Bar interface {}               -> "Bar"
 *
 * The `^` anchor ensures we only match package-level declarations.
 */
const GO_FUNC_REGEX = /^func\s+(?:\([^)]*\)\s+)?([A-Za-z_]\w*)/gm;
const GO_TYPE_REGEX = /^type\s+([A-Za-z_]\w*)\s+(?:struct|interface)/gm;

/**
 * Extract the set of top-level exported symbol names from a file.
 *
 * Pure function: same inputs → same output. No I/O. Capped at
 * `maxChars` characters of input (default
 * {@link SYMBOL_SCAN_MAX_CHARS} = 3000) so the regex doesn't run
 * over a 50KB body when we only care about the head.
 */
export function extractSymbols(
  content: string,
  language: string,
  options: { maxChars?: number } = {},
): ReadonlySet<string> {
  const cap = options.maxChars ?? SYMBOL_SCAN_MAX_CHARS;
  const slice = content.length > cap ? content.slice(0, cap) : content;
  const out = new Set<string>();

  if (isCStyle(language) || language === "") {
    // Treat unknown languages as C-style — covers most modern
    // programming languages and is harmless for prose files
    // (which will produce no matches because the `export` keyword
    // doesn't appear in them).
    for (const m of slice.matchAll(TS_SYMBOL_REGEX)) {
      const name = m[1];
      if (name) out.add(name);
    }
  } else if (isHashStyle(language)) {
    if (language === "Python") {
      for (const m of slice.matchAll(PY_SYMBOL_REGEX)) {
        const name = m[1];
        if (name) out.add(name);
      }
    }
    // Ruby / Shell / YAML / TOML don't typically export
    // identifiable named symbols; skip silently.
  } else if (isProse(language)) {
    // No symbol syntax in prose. Return empty set.
  }

  if (language === "Go") {
    for (const m of slice.matchAll(GO_FUNC_REGEX)) {
      const name = m[1];
      if (name) out.add(name);
    }
    for (const m of slice.matchAll(GO_TYPE_REGEX)) {
      const name = m[1];
      if (name) out.add(name);
    }
  }

  return out;
}

/* -------------------------------------------------------------------------- */
/*  2. Leading doc-comment block                                              */
/* -------------------------------------------------------------------------- */

/**
 * Extract the leading doc-comment block from a file. The block is
 * the first contiguous run of comment lines (C-style `//` or
 * `/* * /`, or hash-style `#`) and blank lines between them,
 * starting at the top of the file. The block ends at the first
 * non-comment, non-blank line.
 *
 * For prose languages (Markdown, JSON, YAML) there is no comment
 * syntax to strip, so the function returns the first
 * `maxChars` characters of the file directly.
 *
 * The function is intentionally permissive: a doc-comment that
 * has a typo or unusual formatting is still better than nothing.
 *
 * Pure function. Capped at `maxChars` characters of output
 * (default {@link DOC_COMMENT_MAX_CHARS} = 1000).
 */
export function extractDocComment(
  content: string,
  language: string,
  options: { maxChars?: number } = {},
): string {
  const cap = options.maxChars ?? DOC_COMMENT_MAX_CHARS;
  if (!content) return "";

  // Prose files: the whole "doc comment" is the file's preamble.
  if (isProse(language)) {
    return content.length > cap ? content.slice(0, cap) : content;
  }

  // Unknown / C-style: try C-style extraction.
  // Hash-style: try hash-style extraction.
  // Either way, fall through to the body if we found nothing.
  if (isCStyle(language) || language === "") {
    const out = extractCStyleDocComment(content, cap);
    if (out.length > 0) return out;
  }
  if (isHashStyle(language)) {
    const out = extractHashStyleDocComment(content, cap);
    if (out.length > 0) return out;
  }
  return "";
}

/**
 * C-style doc-comment extractor. Walks the file line by line,
 * collecting `//` and `/* * /` blocks (and the blank lines
 * between them) until the first non-comment non-blank line.
 */
function extractCStyleDocComment(content: string, cap: number): string {
  const lines = content.split("\n");
  const out: string[] = [];
  let total = 0;
  let inBlock = false;
  let hasStarted = false;

  for (let i = 0; i < lines.length; i++) {
    if (total >= cap) break;
    const line = lines[i]!;
    const trimmed = line.trim();

    if (inBlock) {
      hasStarted = true;
      const endIdx = line.indexOf("*/");
      if (endIdx >= 0) {
        const piece = line.slice(0, endIdx);
        out.push(stripBlockPrefix(piece));
        total += endIdx;
        inBlock = false;
      } else {
        out.push(stripBlockPrefix(line));
        total += line.length;
      }
      continue;
    }

    if (trimmed.startsWith("//")) {
      hasStarted = true;
      out.push(trimmed.slice(2).trim());
      total += line.length;
      continue;
    }

    if (trimmed.startsWith("/*")) {
      hasStarted = true;
      inBlock = true;
      const endIdx = trimmed.indexOf("*/", 2);
      if (endIdx >= 0) {
        out.push(stripBlockPrefix(trimmed.slice(2, endIdx)));
        total += endIdx;
        inBlock = false;
      } else {
        out.push(stripBlockPrefix(trimmed.slice(2)));
        total += line.length;
      }
      continue;
    }

    if (trimmed === "") {
      // Blank line — only collect if we've started, and only
      // while we're still potentially inside the doc-comment
      // (i.e. the next non-blank line could still be a comment).
      if (hasStarted) {
        out.push("");
        total += line.length;
      }
      continue;
    }

    // First non-comment, non-blank line — the doc-comment is over.
    break;
  }

  // Strip trailing blank lines so callers can `reason.startsWith`
  // the result without trailing noise.
  while (out.length > 0 && out[out.length - 1] === "") out.pop();

  const joined = out.join("\n");
  return joined.length > cap ? joined.slice(0, cap) : joined;
}

/**
 * Hash-style doc-comment extractor. Walks the file line by line,
 * collecting `#` lines (and blank lines between them) until the
 * first non-comment, non-blank line. Skips a shebang and a
 * PEP-263 encoding declaration if they appear at the very top.
 */
function extractHashStyleDocComment(content: string, cap: number): string {
  const lines = content.split("\n");
  const out: string[] = [];
  let total = 0;
  let hasStarted = false;
  let i = 0;

  // Skip a shebang on line 1.
  if (lines.length > 0 && (lines[0] ?? "").startsWith("#!")) {
    i = 1;
  }
  // Skip a `# -*- coding: ... -*-` declaration on the next line.
  if (lines.length > i) {
    const next = (lines[i] ?? "").trim();
    if (next.startsWith("#!") || /coding[=:]/i.test(next)) {
      i += 1;
    }
  }

  for (; i < lines.length; i++) {
    if (total >= cap) break;
    const line = lines[i]!;
    const trimmed = line.trim();

    if (trimmed.startsWith("#")) {
      hasStarted = true;
      // Strip a single leading '#' and any following space.
      out.push(trimmed.replace(/^#+\s?/, ""));
      total += line.length;
      continue;
    }

    if (trimmed === "") {
      if (hasStarted) {
        out.push("");
        total += line.length;
      }
      continue;
    }

    break;
  }

  while (out.length > 0 && out[out.length - 1] === "") out.pop();

  const joined = out.join("\n");
  return joined.length > cap ? joined.slice(0, cap) : joined;
}

/**
 * Strip the common ` * ` prefix from inside a `/* ... * /` block
 * so the returned text reads naturally. Lines that are just ` *`
 * become empty strings.
 */
function stripBlockPrefix(line: string): string {
  // Remove a single leading `*` and a following space. This is a
  // best-effort pass — doc-comments with unusual formatting will
  // retain some `*` characters, which is fine for keyword matching.
  return line.replace(/^\s*\*\s?/, "").trimEnd();
}

/* -------------------------------------------------------------------------- */
/*  3. Import statements                                                      */
/* -------------------------------------------------------------------------- */

/**
 * TypeScript / JavaScript import / re-export specifier extraction.
 * Captures the *string* inside the quotes — path resolution is
 * Phase 2's job.
 *
 * Matches:
 *   import x from "./foo"          -> "./foo"
 *   import { y } from "./bar"      -> "./bar"
 *   import * as z from "./baz"     -> "./baz"
 *   import "./side-effect"         -> "./side-effect"
 *   export { a } from "./reexport"  -> "./reexport"
 *   export * from "./all"          -> "./all"
 *
 * Does not match:
 *   - `import type` declarations (treated the same — still import
 *     path; we capture the path)
 *   - dynamic `import("./lazy")` calls (intentionally; these
 *     aren't module-level dependencies for retrieval purposes)
 */
const TS_IMPORT_REGEX =
  /(?:^|\n)\s*(?:import|export)\s+(?:[^'"]*?from\s+)?['"]([^'"]+)['"]/g;

/**
 * Python import specifier extraction. Captures the dotted module
 * name. Phase 2 resolves it against the candidate file set.
 *
 *   import kindred.db                 -> "kindred.db"
 *   from kindred.db import prisma     -> "kindred.db"
 *   from . import utils               -> "."
 *   from ..sibling import x           -> "..sibling"
 *   from .utils import helper         -> ".utils"
 */
const PY_IMPORT_REGEX = /^(?:from\s+(\S+)\s+import|import\s+(\S+))/gm;

/**
 * Go single-line import. Captures the path.
 *   import "fmt"            -> "fmt"
 */
const GO_IMPORT_SINGLE_REGEX = /import\s+["']([^"']+)["']/g;

/**
 * Go import block opener + body. We capture the body in one pass
 * and then sweep all quoted strings inside it, so a single
 * `import ( ... )` block can contribute many paths.
 *   import (
 *     "fmt"                 -> "fmt"
 *     "github.com/x/y"      -> "github.com/x/y"
 *   )
 */
const GO_IMPORT_BLOCK_REGEX = /import\s*\(([\s\S]*?)\)/g;
const GO_IMPORT_BLOCK_PATH_REGEX = /["']([^"']+)["']/g;

/**
 * Extract the set of raw import specifiers from a file body.
 *
 * Returns the strings EXACTLY as written in the file. Path
 * resolution (relative paths → absolute repo paths, alias paths
 * like `@/lib/auth` → real file paths) is performed by Phase 2
 * (graph.ts), not here. This module is pure string handling.
 *
 * Go is dispatched before the C-style branch because, although Go
 * uses C-style comments, its `import` syntax is its own — without
 * the early check, the TS regex (which expects `import ... from`)
 * would match nothing useful and the Go regex would never run.
 */
export function extractImports(
  content: string,
  language: string,
  options: { maxChars?: number } = {},
): ReadonlySet<string> {
  const cap = options.maxChars ?? SYMBOL_SCAN_MAX_CHARS;
  const slice = content.length > cap ? content.slice(0, cap) : content;
  const out = new Set<string>();

  if (language === "Go") {
    // Single-line `import "x"` statements.
    for (const m of slice.matchAll(GO_IMPORT_SINGLE_REGEX)) {
      const spec = m[1];
      if (spec) out.add(spec);
    }
    // Parenthesised `import ( "x" "y" )` blocks — sweep every
    // quoted string in each block body.
    for (const m of slice.matchAll(GO_IMPORT_BLOCK_REGEX)) {
      const block = m[1];
      if (!block) continue;
      for (const p of block.matchAll(GO_IMPORT_BLOCK_PATH_REGEX)) {
        if (p[1]) out.add(p[1]);
      }
    }
  } else if (isCStyle(language) || language === "") {
    for (const m of slice.matchAll(TS_IMPORT_REGEX)) {
      const spec = m[1];
      if (spec) out.add(spec);
    }
  } else if (language === "Python") {
    for (const m of slice.matchAll(PY_IMPORT_REGEX)) {
      const spec = m[1] ?? m[2];
      if (spec) out.add(spec);
    }
  }
  // Hash-style non-Python and prose languages have no import syntax.

  return out;
}

/* -------------------------------------------------------------------------- */
/*  4. Environment-variable references                                        */
/* -------------------------------------------------------------------------- */

/**
 * TypeScript / JavaScript env-var references. Matches:
 *   process.env.REDIS_URL            -> "REDIS_URL"
 *   process.env["REDIS_URL"]         -> "REDIS_URL"
 *   process.env[`REDIS_URL`]         -> "REDIS_URL"
 *
 * Also matches `process.env.NODE_ENV` (lowercase) for completeness,
 * but env-var names are conventionally UPPER_SNAKE.
 */
const TS_ENV_REGEX =
  /process\.env(?:\.|\[(?:"|'|`))([A-Za-z_][A-Za-z0-9_]*)/g;

/**
 * Python env-var references. Captures the *first* capture group
 * in every match, regardless of which alternative fired:
 *   os.environ["REDIS_URL"]          -> "REDIS_URL"
 *   os.environ.get("REDIS_URL")      -> "REDIS_URL"
 *   os.getenv("REDIS_URL")           -> "REDIS_URL"
 *   os.getenv("REDIS_URL", default)  -> "REDIS_URL"
 */
const PY_ENV_REGEX =
  /os\.(?:environ\s*\[\s*["']([A-Za-z_][A-Za-z0-9_]*)["']|environ\.get\s*\(\s*["']([A-Za-z_][A-Za-z0-9_]*)["']|getenv\s*\(\s*["']([A-Za-z_][A-Za-z0-9_]*)["'])/g;

/**
 * Go env-var references. Matches:
 *   os.Getenv("REDIS_URL")           -> "REDIS_URL"
 */
const GO_ENV_REGEX = /os\.Getenv\s*\(\s*["']([A-Za-z_][A-Za-z0-9_]*)["']/g;

/**
 * Extract the set of environment-variable names referenced in
 * the file. Useful for questions like "where are environment
 * variables used?" — the answer is the files that reference
 * many env-vars, not the files that define them.
 *
 * Pure function. Reads at most `maxChars` characters of input.
 *
 * Note: Go is in {@link C_STYLE_LANGUAGES} for comment / symbol
 * extraction, but its env-var syntax (`os.Getenv`) is its own
 * thing — so we check Go first, then fall through to the
 * C-style branch for the other C-style languages.
 */
export function extractEnvVarRefs(
  content: string,
  language: string,
  options: { maxChars?: number } = {},
): ReadonlySet<string> {
  const cap = options.maxChars ?? SYMBOL_SCAN_MAX_CHARS;
  const slice = content.length > cap ? content.slice(0, cap) : content;
  const out = new Set<string>();

  if (language === "Go") {
    for (const m of slice.matchAll(GO_ENV_REGEX)) {
      const name = m[1];
      if (name) out.add(name);
    }
  } else if (isCStyle(language) || language === "") {
    for (const m of slice.matchAll(TS_ENV_REGEX)) {
      const name = m[1];
      if (name) out.add(name);
    }
  } else if (language === "Python") {
    for (const m of slice.matchAll(PY_ENV_REGEX)) {
      const name = m[1] ?? m[2] ?? m[3];
      if (name) out.add(name);
    }
  }
  // Hash-style non-Python and prose languages have no in-file
  // env-var reference syntax.

  return out;
}

/* -------------------------------------------------------------------------- */
/*  Convenience: one-shot extraction                                          */
/* -------------------------------------------------------------------------- */

/**
 * Run every extractor against a single file's content in one pass.
 * Convenience for Phase 4's orchestrator, which reads a file once
 * and wants all four signals at once.
 *
 * All four extractors read from the same `maxChars` slice, so
 * this is one logical "read" of the file, not four. The function
 * is still O(n) in content length because each regex does its
 * own scan, but the constant factor is small.
 */
export function extractAll(
  content: string,
  language: string,
  options: { maxChars?: number } = {},
): ExtractedSymbols {
  const cap = options.maxChars ?? SYMBOL_SCAN_MAX_CHARS;
  const slice = content.length > cap ? content.slice(0, cap) : content;

  return {
    symbols: extractSymbols(slice, language, { maxChars: cap }),
    docComment: extractDocComment(slice, language),
    imports: extractImports(slice, language, { maxChars: cap }),
    envVars: extractEnvVarRefs(slice, language, { maxChars: cap }),
  };
}

/* -------------------------------------------------------------------------- */
/*  Cross-check helper: does a question token match any symbol?               */
/* -------------------------------------------------------------------------- */

/**
 * Compute the symbol-name coverage of a question: the fraction of
 * question tokens that appear as a stem in at least one of the
 * file's exported symbol names. Returned as a number in [0, 1].
 *
 * This is the load-bearing function for Phase 4's symbol boost
 * stage — "Telegram bot" vs `telegramIngestWorker` should yield a
 * coverage of 1.0, and "How does authentication work" vs
 * `class AuthService` should also yield a strong signal.
 *
 * Both the question tokens and the symbol names are normalised
 * via {@link tokenizeSymbolName} so the comparison is a plain
 * `Set` intersection.
 */
export function questionSymbolCoverage(
  queryTokens: ReadonlyArray<string>,
  symbolNames: ReadonlySet<string>,
): { coverage: number; hits: string[] } {
  if (queryTokens.length === 0 || symbolNames.size === 0) {
    return { coverage: 0, hits: [] };
  }
  // Build the bag of symbol stems.
  const symbolStems = new Set<string>();
  for (const name of symbolNames) {
    for (const stem of tokenizeSymbolName(name)) {
      if (stem.length >= 2) symbolStems.add(stem);
    }
  }
  if (symbolStems.size === 0) return { coverage: 0, hits: [] };

  const hits: string[] = [];
  const seen = new Set<string>();
  for (const q of queryTokens) {
    if (symbolStems.has(q) && !seen.has(q)) {
      seen.add(q);
      hits.push(q);
    }
  }
  return {
    coverage: hits.length / queryTokens.length,
    hits,
  };
}

/**
 * Re-export `tokenize` so consumers don't have to import it from
 * the tokens module directly when they need to flatten a string
 * the same way the symbol extractors do.
 */
export { tokenize };
