/**
 * Mock IndexedFile fixtures + a ready-to-go "auth repo" example.
 *
 * Used by:
 *   - The example/demo entry point `mockAuthRepo` (see below).
 *   - The unit tests in `./__tests__/`.
 *   - Any UI storybook / dev sandbox that wants a realistic-shaped index
 *     without hitting the GitHub API.
 *
 * The fixtures are intentionally small but representative — they cover
 * the most common file types a code question would touch (config, docs,
 * source, tests, build, styles).
 *
 * NOTE: These mirror the retrieval engine's mock fixture set on purpose
 * so the two engines can be cross-validated, but they are a separate
 * copy so the ranking engine stays independent.
 */

import type { IndexedFile } from "@/types/repository";
import { rankRelevantFiles } from "./rank";
import type { RankResult } from "@/types/ranking";

/* -------------------------------------------------------------------------- */
/*  Helpers                                                                   */
/* -------------------------------------------------------------------------- */

function mkFile(
  path: string,
  sizeBytes: number,
  language: string,
): IndexedFile {
  const name = path.split("/").pop() ?? path;
  const lastDot = name.lastIndexOf(".");
  const extension = lastDot >= 0 ? name.slice(lastDot) : "";
  const extKey = lastDot >= 0 ? name.slice(lastDot + 1).toLowerCase() : "";
  const folder = path.includes("/")
    ? path.slice(0, path.lastIndexOf("/"))
    : "";
  return { path, name, extension, extKey, language, folder, sizeBytes };
}

/* -------------------------------------------------------------------------- */
/*  Generic fixture list                                                      */
/* -------------------------------------------------------------------------- */

/**
 * A small but realistic-shaped mix of files used by the unit tests.
 * Kept dependency-free so tests don't have to mock the indexer.
 */
export const mockIndexedFiles: IndexedFile[] = [
  mkFile("README.md", 4096, "Markdown"),
  mkFile("package.json", 1024, "JSON"),
  mkFile("tsconfig.json", 512, "JSON"),
  mkFile(".github/workflows/ci.yml", 2048, "YAML"),
  mkFile("src/index.ts", 512, "TypeScript"),
  mkFile("src/lib/utils.ts", 1024, "TypeScript"),
  mkFile("src/auth/auth.service.ts", 3072, "TypeScript"),
  mkFile("src/auth/login.controller.ts", 2048, "TypeScript"),
  mkFile("src/auth/middleware.ts", 1536, "TypeScript"),
  mkFile("src/auth/login.tsx", 1024, "TypeScript"),
  mkFile("src/features/auth/auth.api.ts", 2560, "TypeScript"),
  mkFile("src/api/routes/user.ts", 1024, "TypeScript"),
  mkFile("src/api/routes/auth.ts", 1024, "TypeScript"),
  mkFile("src/components/LoginForm.tsx", 1024, "TypeScript"),
  mkFile("src/components/SignupForm.tsx", 1024, "TypeScript"),
  mkFile("src/components/Dashboard.tsx", 1024, "TypeScript"),
  mkFile("src/styles/global.css", 512, "CSS"),
  mkFile("docs/authentication.md", 2048, "Markdown"),
  mkFile("tests/auth.test.ts", 1536, "TypeScript"),
  mkFile("tests/api.test.ts", 1024, "TypeScript"),
];

/* -------------------------------------------------------------------------- */
/*  Demo / example                                                            */
/* -------------------------------------------------------------------------- */

/**
 * Run the ranking engine against a realistic mock auth repo and return
 * the structured result. This is the function you'd import from a story,
 * a test, or a `/api/demo` route to verify the engine is wired up
 * correctly end-to-end.
 *
 * Example:
 *   import { mockAuthRepo } from "@/lib/ranking/mock";
 *   const { result } = mockAuthRepo("How does authentication work?");
 *   console.log(result.ranked);
 */
export function mockAuthRepo(
  question: string,
  options?: { limit?: number; minScore?: number },
): { result: RankResult; files: IndexedFile[] } {
  return {
    result: rankRelevantFiles(question, mockIndexedFiles, options),
    files: mockIndexedFiles,
  };
}
