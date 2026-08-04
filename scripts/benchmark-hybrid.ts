/**
 * Benchmark: hybrid (metadata + content) ranking vs metadata-only
 * ranking on the public Kindred repository.
 *
 * This script is a developer / review convenience. It runs the same
 * four conceptual questions the brief calls out and prints a side-
 * by-side report so the impact of the hybrid layer is auditable
 * without spinning up the full /api/ask pipeline.
 *
 *   1. Explain the architecture
 *   2. How does routing work?
 *   3. How does data fetching work?
 *   4. Show me the API routes
 *
 * For each question, the report shows:
 *   - The metadata-only top-5 (path + score + reason).
 *   - The hybrid top-5 (path + score + reason).
 *   - The files that crossed ranks (improved or surfaced).
 *   - Whether the content fallback executed.
 *
 * Run with:
 *   GITHUB_TOKEN=ghp_xxx npx tsx scripts/benchmark-hybrid.ts
 *
 * The script uses the public GitHub API directly so it can be run
 * with no extra infrastructure. The token raises the rate limit but
 * is not strictly required for one short benchmark run.
 */

import { fetchRepoTree, fetchRepoFile, fetchRepoMetadata } from "@/lib/github/api";
import { rankRelevantFiles, rankRelevantFilesHybrid } from "@/lib/ranking";
import type { IndexedFile, RepoMetadata } from "@/types/repository";

const REPO = "hasbunallah01/kindred";
const QUESTIONS: ReadonlyArray<string> = [
  "Explain the architecture",
  "How does routing work?",
  "How does data fetching work?",
  "Show me the API routes",
];

/* -------------------------------------------------------------------------- */
/*  Tree → IndexedFile                                                        */
/* -------------------------------------------------------------------------- */

function treeToIndexedFiles(
  tree: Array<{ path: string; type: string; size?: number }>,
): IndexedFile[] {
  const files: IndexedFile[] = [];
  for (const entry of tree) {
    if (entry.type !== "blob") continue;
    const path = entry.path;
    const name = path.split("/").pop() ?? path;
    const lastDot = name.lastIndexOf(".");
    const extension = lastDot >= 0 ? name.slice(lastDot) : "";
    const extKey = lastDot >= 0 ? name.slice(lastDot + 1).toLowerCase() : "";
    const folder = path.includes("/")
      ? path.slice(0, path.lastIndexOf("/"))
      : "";
    files.push({
      path,
      name,
      extension,
      extKey,
      folder,
      language: "Unknown",
      sizeBytes: entry.size ?? 0,
    });
  }
  return files;
}

/* -------------------------------------------------------------------------- */
/*  Reporting                                                                 */
/* -------------------------------------------------------------------------- */

function pad(s: string, n: number): string {
  if (s.length >= n) return s.slice(0, n);
  return s + " ".repeat(n - s.length);
}

function shortPath(path: string, max = 56): string {
  if (path.length <= max) return pad(path, max);
  return pad("…" + path.slice(path.length - (max - 1)), max);
}

function renderRow(
  rank: number,
  path: string,
  score: number,
  reason: string,
): string {
  return `  ${String(rank).padStart(2)}. ${shortPath(path)}  ${String(score).padStart(3)}  ${reason}`;
}

function renderQuestion(
  index: number,
  question: string,
  meta: ReturnType<typeof rankRelevantFiles>,
  hybrid: Awaited<ReturnType<typeof rankRelevantFilesHybrid>>,
): void {
  console.log("");
  console.log("================================================================");
  console.log(`Q${index + 1}. ${question}`);
  console.log("================================================================");

  console.log("");
  console.log("Metadata-only ranking (top 5):");
  if (meta.ranked.length === 0) {
    console.log("  (no matches)");
  } else {
    meta.ranked.slice(0, 5).forEach((m, i) => {
      console.log(renderRow(i + 1, m.file.path, m.score, m.reason));
    });
  }

  console.log("");
  console.log("Hybrid ranking (top 5):");
  if (hybrid.ranked.length === 0) {
    console.log("  (no matches)");
  } else {
    hybrid.ranked.slice(0, 5).forEach((m, i) => {
      console.log(renderRow(i + 1, m.file.path, m.score, m.reason));
    });
  }

  console.log("");
  console.log("Diagnostics:");
  console.log(`  contentFallbackExecuted: ${hybrid.hybrid.contentFallbackExecuted}`);
  console.log(`  contentScanned:          ${hybrid.hybrid.contentScanned}`);
  console.log(`  contentMatched:          ${hybrid.hybrid.contentMatched}`);
  console.log(`  conceptualBoosted:       [${hybrid.hybrid.conceptualBoosted.join(", ")}]`);
  console.log(`  metadataTopScore:        ${hybrid.hybrid.metadataTopScore}`);

  // Highlight the differences.
  const metaPaths = meta.ranked.map((r) => r.file.path);
  const hybridPaths = hybrid.ranked.map((r) => r.file.path);
  const surfaced = hybridPaths.filter((p) => !metaPaths.includes(p));
  const improved: Array<{ path: string; from: number; to: number }> = [];
  for (const entry of hybrid.ranked) {
    const metaIdx = metaPaths.indexOf(entry.file.path);
    if (metaIdx === -1) continue;
    const metaEntry = meta.ranked[metaIdx]!;
    if (entry.score > metaEntry.score) {
      improved.push({
        path: entry.file.path,
        from: metaEntry.score,
        to: entry.score,
      });
    }
  }

  if (surfaced.length > 0) {
    console.log("");
    console.log("  ↑ surfaced by hybrid (not in metadata ranking):");
    for (const p of surfaced) console.log(`    - ${p}`);
  }
  if (improved.length > 0) {
    console.log("");
    console.log("  ↑ score improved by hybrid:");
    for (const i of improved) {
      console.log(`    - ${i.path}: ${i.from} -> ${i.to}`);
    }
  }
}

/* -------------------------------------------------------------------------- */
/*  Main                                                                      */
/* -------------------------------------------------------------------------- */

async function main(): Promise<void> {
  console.log("================================================================");
  console.log("RepoLens — hybrid ranking benchmark");
  console.log(`Repository: ${REPO}`);
  console.log("================================================================");

  const [owner, repo] = REPO.split("/");
  if (!owner || !repo) {
    throw new Error(`Bad REPO: ${REPO}`);
  }

  const meta: RepoMetadata = await fetchRepoMetadata(owner, repo);
  console.log(`default branch: ${meta.defaultBranch}`);
  console.log(`description:    ${meta.description ?? "(none)"}`);

  const tree = await fetchRepoTree(owner, repo, meta.defaultBranch);
  const files = treeToIndexedFiles(tree.tree);
  console.log(`indexed files:  ${files.length}`);

  // Build a content fetcher that respects the same per-file error
  // handling as the production route. The GitHub client throws on
  // 404 / decode failures; we swallow and return null so a single
  // missing file doesn't poison the scan.
  const fetchContent = async (path: string): Promise<string | null> => {
    try {
      const content = await fetchRepoFile(owner, repo, path, meta.defaultBranch);
      return content;
    } catch {
      return null;
    }
  };

  for (let i = 0; i < QUESTIONS.length; i++) {
    const q = QUESTIONS[i]!;
    const metaResult = rankRelevantFiles(q, files);
    const hybridResult = await rankRelevantFilesHybrid(q, files, {
      fetchContent,
    });
    renderQuestion(i, q, metaResult, hybridResult);
  }

  console.log("");
  console.log("================================================================");
  console.log("Done.");
  console.log("================================================================");
}

main().catch((err: unknown) => {
  console.error("[benchmark-hybrid] unexpected error:", err);
  process.exit(1);
});
