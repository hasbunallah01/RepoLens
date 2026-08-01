/**
 * GET /api/health
 *
 * Liveness probe used by uptime checks and by the dashboard to
 * confirm the API layer is wired up. Returns a tiny payload — no
 * business logic, no secrets, no upstream calls.
 *
 * Response envelope (see `lib/api` for the full contract):
 *   { ok: true, data: { status, service, timestamp } }
 *
 * Always returns 200. If the process can serve this file at all,
 * the service is considered healthy.
 */

import { okResponse, withApiHandler } from "@/lib/api";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

interface HealthPayload {
  status: "ok";
  service: "RepoLens";
  timestamp: string;
}

export const GET = withApiHandler(async () => {
  const payload: HealthPayload = {
    status: "ok",
    service: "RepoLens",
    timestamp: new Date().toISOString(),
  };
  return okResponse(payload);
});
