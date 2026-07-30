import { NextResponse } from "next/server";

/**
 * GET /api/health
 *
 * Phase 1 placeholder used to verify the API layer is wired up.
 * Returns a tiny liveness payload — no business logic, no secrets.
 */
export function GET() {
  return NextResponse.json({
    status: "ok",
    service: "RepoLens",
    phase: 1,
    timestamp: new Date().toISOString(),
  });
}
