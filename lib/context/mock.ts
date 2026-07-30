/**
 * Mock fixtures + demo entry point for the Context Builder (Phase 3D1).
 *
 * The Context Builder never reads from disk in tests — it gets the
 * file contents from an inline `Map`. This file provides a small but
 * realistic fixture set mirroring the ranking engine's mock auth repo
 * so the two can be cross-validated end-to-end.
 *
 * Everything in here is dependency-free: no GitHub, no filesystem, no
 * `IndexedFile` lookup. The fixtures are intentionally small so the
 * unit tests stay snappy.
 */

import type { IndexedFile } from "@/types/repository";
import { rankRelevantFiles } from "@/lib/ranking";
import type { RankedFile } from "@/types/ranking";
import type { BuildContextResult, ContextRepositoryInfo } from "./types";
import { buildContextPackage } from "./build-context";

/* -------------------------------------------------------------------------- */
/*  File content fixtures                                                     */
/* -------------------------------------------------------------------------- */

/**
 * Mock file contents keyed by repository-relative path. Bodies are
 * tiny but realistic-looking so a human reviewer can eyeball them in
 * test failures without squinting at single-letter names.
 */
export const mockFileContents: ReadonlyMap<string, string> = new Map<string, string>([
  [
    "src/auth/auth.service.ts",
    [
      "export interface AuthService {",
      "  signIn(email: string, password: string): Promise<Session>;",
      "  signOut(session: Session): Promise<void>;",
      "}",
      "",
      "export function createAuthService(deps: AuthDeps): AuthService {",
      "  return {",
      "    async signIn(email, password) {",
      "      const user = await deps.users.findByEmail(email);",
      "      if (!user) throw new Error('Unknown user');",
      "      return deps.sessions.create(user);",
      "    },",
      "    async signOut(session) {",
      "      await deps.sessions.revoke(session);",
      "    },",
      "  };",
      "}",
    ].join("\n"),
  ],
  [
    "src/auth/login.controller.ts",
    [
      "import { createAuthService } from './auth.service';",
      "",
      "export async function postLogin(req: Request) {",
      "  const { email, password } = await req.json();",
      "  const auth = createAuthService(req.deps);",
      "  return auth.signIn(email, password);",
      "}",
    ].join("\n"),
  ],
  [
    "src/auth/middleware.ts",
    [
      "import type { Request } from './types';",
      "",
      "export async function requireAuth(req: Request) {",
      "  if (!req.session) throw new Response('Unauthorized', { status: 401 });",
      "  return req;",
      "}",
    ].join("\n"),
  ],
  [
    "README.md",
    [
      "# Auth Service",
      "",
      "A minimal authentication service for the RepoLens demo.",
      "",
      "## Endpoints",
      "",
      "- `POST /login` — sign in with email and password.",
      "- `POST /logout` — revoke the current session.",
    ].join("\n"),
  ],
  [
    "package.json",
    [
      "{",
      "  \"name\": \"auth-service\",",
      "  \"version\": \"0.1.0\",",
      "  \"private\": true",
      "}",
    ].join("\n"),
  ],
  [
    "docs/authentication.md",
    [
      "# Authentication",
      "",
      "The auth flow uses session cookies. See `src/auth/auth.service.ts`",
      "for the canonical implementation.",
    ].join("\n"),
  ],
  [
    "tests/auth.test.ts",
    [
      "import { describe, it, expect } from 'vitest';",
      "import { createAuthService } from '../src/auth/auth.service';",
      "",
      "describe('auth.service', () => {",
      "  it('signs in with valid credentials', async () => {",
      "    /* ... */",
      "  });",
      "});",
    ].join("\n"),
  ],
]);

/* -------------------------------------------------------------------------- */
/*  Mock IndexedFile list                                                     */
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
  const folder = path.includes("/") ? path.slice(0, path.lastIndexOf("/")) : "";
  return { path, name, extension, extKey, language, folder, sizeBytes };
}

/**
 * The same paths as `mockFileContents`, in a fixed order, so tests
 * can reason about index positions. Sizes are toy values — the
 * Context Builder does not depend on them.
 */
export const mockIndexedFiles: IndexedFile[] = [
  mkFile("src/auth/auth.service.ts", 1024, "TypeScript"),
  mkFile("src/auth/login.controller.ts", 512, "TypeScript"),
  mkFile("src/auth/middleware.ts", 512, "TypeScript"),
  mkFile("README.md", 256, "Markdown"),
  mkFile("package.json", 96, "JSON"),
  mkFile("docs/authentication.md", 256, "Markdown"),
  mkFile("tests/auth.test.ts", 256, "TypeScript"),
];

/* -------------------------------------------------------------------------- */
/*  Mock repository                                                           */
/* -------------------------------------------------------------------------- */

/**
 * A fixture repository identity used by the demo entry point and
 * the unit tests.
 */
export const mockRepository: ContextRepositoryInfo = {
  fullName: "hasbunallah01/auth-service",
  defaultBranch: "main",
  primaryLanguage: "TypeScript",
  builtAt: "2026-07-30T00:00:00.000Z",
};

/* -------------------------------------------------------------------------- */
/*  Demo / example                                                            */
/* -------------------------------------------------------------------------- */

/**
 * Run the Context Builder end-to-end against the mock auth repo.
 *
 * Uses the inline content source so the demo is fully self-contained
 * and never touches the network. The example question deliberately
 * matches the ranking engine's example so the two demos can be
 * diffed against each other.
 *
 * Example:
 *   import { mockAuthContext } from "@/lib/context/mock";
 *   const { result, ranked } = mockAuthContext("How does authentication work?");
 *   console.log(result.package.files[0].path);
 */
export function mockAuthContext(
  question: string,
  options?: { limit?: number },
): { result: BuildContextResult; ranked: RankedFile[] } {
  const { result: rankResult } = {
    result: rankRelevantFiles(question, mockIndexedFiles, { limit: 20 }),
  };
  const result = buildContextPackage(
    question,
    rankResult.ranked,
    mockRepository,
    {
      contentSource: "inline",
      contents: mockFileContents,
      limit: options?.limit,
    },
  );
  return { result, ranked: rankResult.ranked };
}
