/**
 * Phase 4B1 — temporary development test.
 *
 * Proves the full pipeline runs end-to-end:
 *
 *   Context Package (from the Context Builder)
 *     ─▶  Paritok compression service
 *     ─▶  Compressed Context (logged to the console)
 *
 * This script is a *temporary* developer convenience — it lives
 * next to `scripts/demo-retrieval.ts` and is intentionally not
 * wired into `package.json`. Run it directly with:
 *
 *   npx tsx scripts/dev-pipeline-4b1.ts
 *
 * The script logs the full result to the console. A non-zero
 * exit code means the pipeline failed (missing API key, network
 * error, malformed Paritok response, …). A zero exit code means
 * the Context Package was successfully built *and* Paritok
 * returned a compressed payload.
 *
 * Requirements:
 *   - `PARITOK_API_KEY` must be set in the environment.
 *   - The Paritok endpoint must be reachable (override with
 *     `PARITOK_ENDPOINT` for stub servers).
 *
 * Both requirements are reported clearly on the way out so the
 * developer can fix their env and re-run.
 */

import { compressContext } from "@/lib/pipeline";
import {
  mockFileContents,
  mockIndexedFiles,
  mockRepository,
} from "@/lib/context/mock";
import { rankRelevantFiles } from "@/lib/ranking";

/* -------------------------------------------------------------------------- */
/*  Config                                                                    */
/* -------------------------------------------------------------------------- */

const QUESTION = "How does authentication work?";
const LIMIT = 5;

const apiKey = process.env.PARITOK_API_KEY?.trim();
const endpoint = process.env.PARITOK_ENDPOINT?.trim();

if (!apiKey) {
  console.error(
    "[dev-pipeline-4b1] PARITOK_API_KEY is not set. " +
      "Add it to your environment and re-run.",
  );
  process.exit(1);
}

/* -------------------------------------------------------------------------- */
/*  Run                                                                       */
/* -------------------------------------------------------------------------- */

async function main(): Promise<void> {
  console.log("========================================");
  console.log("Phase 4B1 dev test");
  console.log("Context Package → Paritok → Compressed Context");
  console.log("========================================");
  console.log("Question:", QUESTION);
  console.log("Limit:   ", LIMIT);
  if (endpoint) {
    console.log("Endpoint:", endpoint);
  }
  console.log("");

  // 1. Rank the mock repo.
  const { ranked } = rankRelevantFiles(QUESTION, mockIndexedFiles, {
    limit: 20,
  });
  console.log("[1] Ranking engine produced", ranked.length, "ranked files");

  // 2. Run the pipeline. We pass `contentSource: "inline"` + the
  //    mock file contents so the Context Builder can resolve every
  //    ranked file in this self-contained dev script (no fs, no
  //    network, no indexer registry involved).
  const result = await compressContext(QUESTION, ranked, mockRepository, {
    contentSource: "inline",
    contents: mockFileContents,
    limit: LIMIT,
    apiKey,
    endpoint: endpoint || undefined,
  });

  // 3. Log the Context Package half.
  console.log("");
  console.log("[2] Context Package:");
  console.log("    version:        ", result.package.version);
  console.log("    question:       ", result.package.question);
  console.log("    repository:     ", result.package.repository.fullName);
  console.log("    totalCandidates:", result.package.totalCandidates);
  console.log("    selectedCount:  ", result.package.selectedCount);
  console.log("    limit:          ", result.package.limit);
  console.log("    file paths:     ", result.package.files.map((f) => f.path));
  if (result.contextErrors.length > 0) {
    console.log("    context errors: ", result.contextErrors);
  }

  // 4. Log the Paritok half.
  console.log("");
  console.log("[3] Paritok response:");
  if (!result.compressed.ok) {
    console.error("    ok:    false");
    console.error("    code:  ", result.compressed.error.code);
    console.error("    msg:   ", result.compressed.error.message);
    if (result.compressed.error.status !== undefined) {
      console.error("    status:", result.compressed.error.status);
    }
    process.exit(2);
  }

  const data = result.compressed.data;
  console.log("    ok:                true");
  console.log("    gpu_available:     ", data.gpu_available);
  console.log("    schemaVersion:     ", data.schemaVersion ?? "(unset)");
  console.log("    clientId:          ", data.clientId ?? "(unset)");
  console.log("    compressed length: ", data.compressed.length, "chars");
  console.log("");
  console.log("[4] Compressed output (first 400 chars):");
  console.log(
    "    " + data.compressed.slice(0, 400).replace(/\n/g, "\n    "),
  );
  console.log("");
  console.log("========================================");
  console.log("✓ Context Package → Paritok → Compressed Context OK");
  console.log("========================================");
}

main().catch((err: unknown) => {
  console.error("[dev-pipeline-4b1] unexpected error:", err);
  process.exit(99);
});
