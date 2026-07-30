/**
 * Ignore rules for repository indexing.
 *
 * Goal: keep only meaningful source files in the index so retrieval
 * (Phase 3+) starts with a clean, small surface area.
 */

const EXACT_DIRS = new Set([
  "node_modules",
  ".git",
  "dist",
  "build",
  "coverage",
  ".next",
  ".nuxt",
  ".svelte-kit",
  ".cache",
  ".turbo",
  ".vercel",
  "out",
  "vendor",
  "Pods",
  "target", // rust
  "venv",
  ".venv",
  "__pycache__",
]);

const EXACT_FILES = new Set([
  ".DS_Store",
  "Thumbs.db",
  "package-lock.json",
  "yarn.lock",
  "pnpm-lock.yaml",
  "bun.lockb",
  "composer.lock",
  "Cargo.lock",
  "Pipfile.lock",
  "poetry.lock",
  "Gemfile.lock",
  "go.sum",
]);

const ARCHIVE_EXT = new Set([
  "zip",
  "tar",
  "tgz",
  "gz",
  "bz2",
  "xz",
  "7z",
  "rar",
  "jar",
  "war",
  "ear",
  "whl",
]);

const IMAGE_EXT = new Set([
  "png",
  "jpg",
  "jpeg",
  "gif",
  "webp",
  "svg",
  "ico",
  "bmp",
  "tiff",
  "heic",
  "avif",
]);

const VIDEO_EXT = new Set(["mp4", "mov", "webm", "mkv", "avi", "flv", "wmv", "m4v"]);

const AUDIO_EXT = new Set(["mp3", "wav", "ogg", "flac", "m4a", "aac"]);

const BINARY_EXT = new Set([
  "exe",
  "dll",
  "so",
  "dylib",
  "bin",
  "class",
  "o",
  "a",
  "lib",
  "pdb",
  "pyc",
  "wasm",
]);

const FONT_EXT = new Set(["ttf", "otf", "woff", "woff2", "eot"]);

const DOC_BINARY_EXT = new Set([
  "pdf",
  "doc",
  "docx",
  "xls",
  "xlsx",
  "ppt",
  "pptx",
]);

/** Folders whose contents we never want to index. */
export const IGNORED_FOLDERS: readonly string[] = Array.from(EXACT_DIRS);

/** Files we never want to index. */
export const IGNORED_FILES: readonly string[] = Array.from(EXACT_FILES);

/** A file path is "ignorable" if it matches any of these. */
export function shouldIgnorePath(path: string): boolean {
  const segments = path.split("/").filter(Boolean);
  if (segments.length === 0) return true;

  // Hidden dotfiles/dirs at depth 1 are usually config — keep selectively.
  for (const seg of segments) {
    if (EXACT_DIRS.has(seg)) return true;
  }
  const fileName = segments[segments.length - 1]!;
  if (EXACT_FILES.has(fileName)) return true;
  if (fileName.startsWith(".env") && fileName !== ".env.example") return true;

  const ext = fileName.includes(".") ? fileName.split(".").pop()!.toLowerCase() : "";
  if (!ext) return false;

  if (ARCHIVE_EXT.has(ext)) return true;
  if (IMAGE_EXT.has(ext)) return true;
  if (VIDEO_EXT.has(ext)) return true;
  if (AUDIO_EXT.has(ext)) return true;
  if (BINARY_EXT.has(ext)) return true;
  if (FONT_EXT.has(ext)) return true;
  if (DOC_BINARY_EXT.has(ext)) return true;

  // Generated files heuristics
  if (fileName.endsWith(".min.js") || fileName.endsWith(".min.css")) return true;
  if (fileName.endsWith(".bundle.js") || fileName.endsWith(".bundle.css")) return true;
  if (fileName.endsWith(".map")) return true; // source maps

  return false;
}
