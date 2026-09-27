import { prisma } from "@/lib/server/prisma";
import { apiError, apiOk } from "@/lib/server/api-response";
import { checkRateLimit, clientIp } from "@/lib/server/rate-limit";
import { sessionIdSchema } from "@/lib/server/schemas";

/**
 * CRITICAL trust boundary (spec sections 23–24): `/quote/confirmation`
 * calls this to decide whether to show success. It never trusts a query
 * parameter, localStorage, or client-held state — only a real,
 * server-persisted `BookingIntent` row counts. A fresh browser with no
 * such row gets `{ status: "not_found" }`, never a fabricated summary.
 */
export async function GET(request: Request) {
  const ip = clientIp(request);
  const rl = checkRateLimit("lead-confirmation", ip, { windowMs: 60_000, max: 60 });
  if (!rl.allowed) return apiError("RATE_LIMITED", "Too many requests. Please slow down.");

  const url = new URL(request.url);
  const sessionId = url.searchParams.get("sessionId") ?? "";
  const parsed = sessionIdSchema.safeParse(sessionId);
  if (!parsed.success) return apiError("VALIDATION_ERROR", "Invalid session.");

  const lead = await prisma.lead.findUnique({
    where: { sessionId: parsed.data },
    include: {
      bookingIntent: { include: { quoteSnapshot: true } },
      timing: true,
      job: { include: { payment: true } },
    },
  });

  if (!lead || !lead.bookingIntent) {
    return apiOk({ status: "not_found" as const });
  }

  const snapshot = lead.bookingIntent.quoteSnapshot;

  return apiOk({
    status: "confirmed" as const,
    summary: {
      serviceName: snapshot.serviceName,
      totalAreaM2: Number(snapshot.totalAreaM2),
      materialOwnership: snapshot.materialOwnership,
      styleId: lead.styleId,
      timing: lead.timing?.value ?? null,
      currency: snapshot.currency,
      totalMinor: snapshot.totalMinor,
    },
    paymentStatus: lead.job?.payment?.status ?? null,
  });
}
