import { defineConfig } from "vitest/config";
import path from "node:path";

/**
 * Vitest configuration.
 *
 * - Uses the same `@/*` path alias as the Next.js app so tests can
 *   import shared types exactly the way runtime code does.
 * - Picks up `*.test.ts` files in `lib/**`.
 */
export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
  test: {
    include: ["lib/**/*.test.ts"],
    environment: "node",
  },
});
