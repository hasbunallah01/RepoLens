/**
 * Tokenization + lightweight stemming for the ranking engine.
 *
 * The ranking engine operates on file *metadata* (path, name, folder,
 * extension) so we only need a tiny normaliser — no full NLP, no models.
 * The point is that "auth", "Auth", "authentication", and "auth-service"
 * should all share a common base token ("auth") so question ↔ file
 * matching is robust.
 *
 * This module is intentionally self-contained: it does NOT import from
 * `lib/retrieval`. The two engines share the same general approach but
 * are free to evolve independently. If we ever want a shared tokenizer
 * we can extract it into `lib/text/` later.
 *
 * Pure functions only. No I/O, no globals.
 */

/** Common English stopwords that carry no retrieval signal. */
const STOPWORDS: ReadonlySet<string> = new Set([
  "a", "an", "and", "are", "as", "at", "be", "by", "for", "from",
  "has", "have", "how", "i", "in", "is", "it", "its", "of", "on",
  "or", "that", "the", "this", "to", "was", "were", "what", "when",
  "where", "which", "who", "why", "will", "with", "you", "your",
  "do", "does", "done", "can", "could", "should", "would", "may",
  "might", "shall", "any", "all", "some", "most", "more", "less",
  "very", "just", "about", "into", "out", "up", "down", "over",
  "under", "again", "than", "then", "so", "if", "no", "not", "only",
  "own", "same", "too", "also",
]);

/**
 * A minimal suffix-stripping stemmer. Deliberately conservative — we only
 * want to fold a handful of obvious plural/gerund forms so we don't risk
 * collapsing unrelated words. Anything we don't recognise is returned
 * as-is.
 *
 * Examples:
 *   "authentication" -> "auth"    (strips "entication")
 *   "configuration"  -> "config"  (strips "uration")
 *   "configs"        -> "config"  (strips "s")
 *   "services"       -> "service" (strips "s", not "es")
 *   "running"        -> "runn"    (strips "ing")
 *   "tests"          -> "test"    (strips "s")
 */
function stem(token: string): string {
  if (token.length <= 4) return token;
  // Long suffix table — sorted strictly by length descending so the
  // longest possible match always wins. This is critical for words like
  // "authentication" where we want "entication" (10) to beat "ication" (7).
  const LONG_SUFFIXES: readonly string[] = [
    "ifications",      // 11
    "entication",      // 10
    "ification",       // 10
    "izations",        // 8
    "ications",        // 8
    "uration",         // 7
    "ization",         // 7
    "ication",         // 7
    "ations",          // 6
    "ments",           // 6
    "ities",           // 6
    "ation",           // 5
    "ment",            // 5
    "ity",             // 4
  ];
  for (const s of LONG_SUFFIXES) {
    if (token.endsWith(s) && token.length - s.length >= 3) {
      return token.slice(0, -s.length);
    }
  }
  // Short suffix table. We list "s" before "es" so that "services"
  // -> "service" (strip just "s") and "configs" -> "config".
  const SHORT_SUFFIXES: readonly string[] = ["ings", "ing", "ed", "s"];
  for (const s of SHORT_SUFFIXES) {
    if (token.endsWith(s) && token.length - s.length >= 3) {
      return token.slice(0, -s.length);
    }
  }
  return token;
}

/**
 * Split a string into lowercase tokens, with a small set of symbol splits
 * that are common in code/file naming.
 *
 *   "auth-service.ts"   -> ["auth", "service", "ts"]
 *   "How does auth work?" -> ["how", "does", "auth", "work"]
 *   "src/lib/utils.ts"   -> ["src", "lib", "utils", "ts"]
 */
export function tokenize(input: string): string[] {
  if (!input) return [];
  return input
    .toLowerCase()
    .replace(/[._/\\-]+/g, " ")   // common code-path separators
    .replace(/([a-z])([A-Z])/g, "$1 $2") // camelCase split (input already lowercased above)
    .replace(/[^a-z0-9\s]+/g, " ") // strip remaining punctuation
    .split(/\s+/)
    .filter((t) => t.length > 0);
}

/**
 * Tokenize, drop stopwords, and apply the lightweight stemmer.
 *
 *   tokenizeQuery("How does authentication work?")
 *     -> ["auth", "work"]
 *
 * This is what the ranking engine matches against — a small, high-signal
 * set of question keywords.
 */
export function tokenizeQuery(input: string): string[] {
  const tokens = tokenize(input);
  const out: string[] = [];
  for (const t of tokens) {
    if (STOPWORDS.has(t)) continue;
    if (t.length < 2) continue;
    out.push(stem(t));
  }
  return out;
}

/**
 * Tokenize an IndexedFile's path/name/folder, with the same stem rules as
 * the query tokens. We don't drop stopwords from file tokens because folder
 * and filename tokens like "src" or "lib" are still meaningful for ranking,
 * even if they would be stopwords in natural language.
 */
export function tokenizeFilePath(input: string): string[] {
  return tokenize(input)
    .map(stem)
    .filter((t) => t.length >= 1);
}

/** Convenience: tokenize the filename only (without extension). */
export function tokenizeFileName(name: string): string[] {
  // Strip the extension before tokenizing so e.g. "auth.ts" -> ["auth"].
  const base = name.replace(/\.[^.]+$/, "");
  return tokenizeFilePath(base);
}

/** Convenience: tokenize a folder path. */
export function tokenizeFolder(folder: string): string[] {
  if (!folder) return [];
  return tokenizeFilePath(folder);
}
