import { NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { checkProductionEnv } from "@/lib/server/env";

/**
 * Minimal production health/readiness endpoint (Session H, spec section
 * 27). Deliberately does NOT require PayPal to be reachable/configured
 * for a "healthy" verdict — a misconfigured or unreachable payment
 * provider is a real, separate problem (surfaced as a warning here,
 * and by `getPaymentProvider()`'s own fail-closed behavior on the
 * actual payment routes), not a reason to mark the whole app down.
 *
 * Never returns secret values — `checkProductionEnv()` only ever
 * returns descriptive messages about what's wrong, never the
 * configured value itself.
 */
export async function GET() {
  const startedAt = Date.now();

  let databaseOk = true;
  let databaseError: string | null = null;
  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch {
    databaseOk = false;
    databaseError = "Database unreachable.";
  }

  const env = checkProductionEnv();

  const healthy = databaseOk && env.ok;

  const body = {
    status: healthy ? ("ok" as const) : ("down" as const),
    checks: {
      app: "ok" as const,
      database: databaseOk ? ("ok" as const) : ("error" as const),
      config: env.ok ? ("ok" as const) : ("error" as const),
    },
    // Descriptive messages only — never secret values (see env.ts).
    errors: [...(databaseError ? [databaseError] : []), ...env.errors],
    warnings: env.warnings,
    responseTimeMs: Date.now() - startedAt,
    timestamp: new Date().toISOString(),
  };

  return NextResponse.json(body, { status: healthy ? 200 : 503 });
}
