/**
 * Deterministic ranking explainability (Phase 3C2).
 *
 * Produces a short (1–2 line) human-readable reason for why a file ranked
 * where it did, based solely on the same scoring signals used by the
 * ranking engine. No AI, no embeddings, no external calls.
 *
 * Examples of output:
 *   - Filename closely matches the question.
 *   - Folder name is relevant.
 *   - Contains multiple matching keywords.
 *   - File extension is appropriate for the requested topic.
 */

import type { IndexedFile } from "@/types/repository";
import {
  scoreExtension,
  scoreFilename,
  scoreFolder,
  scoreKeywordFrequency,
} from "./scoring";
import {
  tokenizeFileName,
  tokenizeFilePath,
  tokenizeFolder,
} from "./tokens";

/** Per-signal scores used only for picking an explanation. */
interface SignalBreakdown {
  filename: number;
  folder: number;
  keywordFrequency: number;
  extension: number;
}

/**
 * Build a concise explanation for a ranked file given the question tokens.
 *
 * The primary reason is taken from the strongest contributing signal.
 * When a secondary signal also contributes meaningfully, a short clause
 * is appended so the user sees multi-signal matches.
 */
export function explainRank(
  file: IndexedFile,
  queryTokens: ReadonlyArray<string>,
): string {
  if (queryTokens.length === 0) {
    return "Matched question keywords";
  }

  const signals: SignalBreakdown = {
    filename: scoreFilename(file, queryTokens),
    folder: scoreFolder(file, queryTokens),
    keywordFrequency: scoreKeywordFrequency(file, queryTokens),
    extension: scoreExtension(file, queryTokens),
  };

  const primary = pickPrimary(signals);
  const primaryText = reasonFor(primary, file, queryTokens, signals[primary]);

  const secondary = pickSecondary(signals, primary);
  if (secondary && signals[secondary] >= 40) {
    const secondaryText = reasonFor(
      secondary,
      file,
      queryTokens,
      signals[secondary],
    );
    if (secondaryText && secondaryText !== primaryText) {
      return `${primaryText} Also: \( {secondaryText.charAt(0).toLowerCase()} \){secondaryText.slice(1)}`;
    }
  }

  return primaryText;
}

type SignalKey = keyof SignalBreakdown;

const PRIORITY: readonly SignalKey[] = [
  "filename",
  "keywordFrequency",
  "folder",
  "extension",
];

function pickPrimary(signals: SignalBreakdown): SignalKey {
  let best: SignalKey = "filename";
  let bestVal = -1;
  for (const key of PRIORITY) {
    if (signals[key] > bestVal) {
      bestVal = signals[key];
      best = key;
    }
  }
  return best;
}

function pickSecondary(
  signals: SignalBreakdown,
  primary: SignalKey,
): SignalKey | null {
  let best: SignalKey | null = null;
  let bestVal = -1;
  for (const key of PRIORITY) {
    if (key === primary) continue;
    if (signals[key] > bestVal) {
      bestVal = signals[key];
      best = key;
    }
  }
  return best;
}

function reasonFor(
  key: SignalKey,
  file: IndexedFile,
  queryTokens: ReadonlyArray<string>,
  score: number,
): string {
  if (score <= 0) return "Matched question keywords";

  switch (key) {
    case "filename":
      return filenameReason(file, queryTokens);
    case "folder":
      return folderReason(file, queryTokens);
    case "keywordFrequency":
      return keywordReason(file, queryTokens);
    case "extension":
      return extensionReason(file, queryTokens);
    default:
      return "Matched question keywords";
  }
}

function filenameReason(
  file: IndexedFile,
  queryTokens: ReadonlyArray<string>,
): string {
  const tokens = new Set(tokenizeFileName(file.name));

  const lowerName = file.name.toLowerCase().replace(/\.[^.]+$/, "");
  const joinedQ = queryTokens.join(" ");
  if (lowerName && lowerName === joinedQ) {
    return `Filename closely matches the question ("${lowerName}").`;
  }

  const hit = queryTokens.find((q) => tokens.has(q));
  if (hit) {
    return `Filename closely matches the question (contains "${hit}").`;
  }
  return "Filename closely matches the question.";
}

function folderReason(
  file: IndexedFile,
  queryTokens: ReadonlyArray<string>,
): string {
  if (!file.folder) return "Folder name is relevant.";
  const folderTokens = new Set(tokenizeFolder(file.folder));
  const hit = queryTokens.find((q) => folderTokens.has(q));
  if (hit) {
    return `Folder name is relevant ("${hit}" in path).`;
  }
  return "Folder name is relevant.";
}

function keywordReason(
  file: IndexedFile,
  queryTokens: ReadonlyArray<string>,
): string {
  const pathTokens = new Set(tokenizeFilePath(file.path));
  const hits = queryTokens.filter((q) => pathTokens.has(q));
  if (hits.length >= 2) {
    return `Contains multiple matching keywords (${hits.slice(0, 3).join(", ")}).`;
  }
  if (hits.length === 1) {
    return `Path contains matching keyword "${hits[0]}".`;
  }
  return "Contains matching keywords in the path.";
}

function extensionReason(
  file: IndexedFile,
  queryTokens: ReadonlyArray<string>,
): string {
  const lowerName = file.name.toLowerCase();
  const isReadme =
    lowerName === "readme" || lowerName.startsWith("readme.");
  if (isReadme) {
    return "File extension is appropriate for the requested topic (README / docs).";
  }
  const ext = file.extKey || file.extension.replace(/^\./, "") || "unknown";
  const q = new Set(queryTokens);
  if (["test", "spec", "testing"].some((k) => q.has(k))) {
    return `File extension is appropriate for the requested topic (test-related .${ext}).`;
  }
  if (
    ["config", "configuration", "setting", "settings"].some((k) => q.has(k))
  ) {
    return `File extension is appropriate for the requested topic (config .${ext}).`;
  }
  if (["doc", "docs", "documentation"].some((k) => q.has(k))) {
    return `File extension is appropriate for the requested topic (docs .${ext}).`;
  }
  return `File extension is appropriate for the requested topic (.${ext}).`;
}
