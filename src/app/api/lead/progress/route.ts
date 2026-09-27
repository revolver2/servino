import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/server/prisma";
import { apiError, apiOk } from "@/lib/server/api-response";
import { checkRateLimit, clientIp } from "@/lib/server/rate-limit";
import { furthestStatus, furthestStep } from "@/lib/server/lead-status";
import { progressSchema } from "@/lib/server/schemas";
import { getEnabledServices } from "@/lib/services-data";
import { resolveServiceability } from "@/lib/quote/locations";
import { isStyleValidForService } from "@/lib/quote/style-taxonomy";

/** Thrown inside the transaction to abort it and signal a 400, not a 500. */
class InvalidStyleForServiceError extends Error {}

type LeadRow = Awaited<ReturnType<typeof prisma.lead.findUniqueOrThrow>>;

/**
 * Saves meaningful funnel progress server-side (spec sections 7/9).
 * Called on every step the customer completes — not per-keystroke, since
 * that cadence is already how the frontend's `updateQuote()` is invoked
 * (see FunnelStep components).
 *
 * Server-side re-validation, not trust: `serviceSlug` is checked against
 * the enabled-services list, and `citySlug`/serviceability is always
 * recomputed from the submitted postal code — the client's own
 * serviceability claim is never accepted directly.
 *
 * Row-locked read-modify-write: `updateQuote()` on the client fires this
 * endpoint without awaiting it, so an earlier call can otherwise reach the
 * database and commit AFTER a later, more specific call (e.g.
 * booking-intent) — a classic lost-update race that would silently
 * regress `status`/`currentStep` back down. `SELECT ... FOR UPDATE`
 * inside a transaction serializes concurrent progress saves for the same
 * lead so each one reads the other's committed result rather than stale
 * data, and `furthestStatus`/`furthestStep` still guard the actual values.
 */
export async function POST(request: Request) {
  const ip = clientIp(request);
  // Higher ceiling than the other lead endpoints deliberately: this is
  // called on every step transition (legitimate, frequent, non-sensitive
  // traffic — no PII, no financial/booking record created), and the
  // rate-limit key is per-IP, not per-session. A tighter limit here false-
  // positives on shared-IP scenarios the spec explicitly warns against
  // (section 32: "do not make normal testing or household networks
  // unusable") — several people quoting from the same home network, or a
  // realistic multi-step test run, could otherwise share one small budget.
  // Contact/timing/booking-intent stay tight since those are the actual
  // abuse-sensitive endpoints (spam, spend, fake submissions).
  const rl = checkRateLimit("lead-progress", ip, { windowMs: 60_000, max: 300 });
  if (!rl.allowed) return apiError("RATE_LIMITED", "Too many requests. Please slow down.");

  const json = await request.json().catch(() => null);
  const parsed = progressSchema.safeParse(json);
  if (!parsed.success) {
    return apiError("VALIDATION_ERROR", "Invalid request.", parsed.error.flatten());
  }
  const body = parsed.data;

  if (body.serviceSlug && !getEnabledServices().some((s) => s.slug === body.serviceSlug)) {
    return apiError("VALIDATION_ERROR", "Unknown service.");
  }

  let citySlug: string | undefined;
  if (body.postalCode) {
    const serviceability = resolveServiceability(body.postalCode);
    if (!serviceability.valid || !serviceability.serviceable) {
      return apiError("VALIDATION_ERROR", "Location is not serviceable.");
    }
    citySlug = serviceability.citySlug;
  }

  try {
    const lead = await prisma.$transaction(async (tx) => {
      const locked = await tx.$queryRaw<LeadRow[]>`
        SELECT * FROM "Lead" WHERE "sessionId" = ${body.sessionId} FOR UPDATE
      `;
      const existing = locked[0];

      const data = {
        serviceSlug: body.serviceSlug ?? existing?.serviceSlug ?? null,
        postalCode: body.postalCode ?? existing?.postalCode ?? null,
        citySlug: citySlug ?? existing?.citySlug ?? null,
        measurementUnit: body.measurementUnit ?? existing?.measurementUnit ?? null,
        totalAreaM2: body.totalAreaM2 ?? existing?.totalAreaM2 ?? null,
        styleId: body.styleId ?? existing?.styleId ?? null,
        materialOwnership: body.materialOwnership ?? existing?.materialOwnership ?? null,
        currentStep: furthestStep(existing?.currentStep ?? "PROJECT", body.currentStep),
        status: furthestStatus(existing?.status ?? "QUOTE_STARTED", "QUOTE_PARTIAL"),
      };

      // Server-side rejection of an impossible service+style combination
      // (spec: "do not rely only on UI filtering") — checked against the
      // *effective* combination (this request's value, or whatever was
      // already persisted), since serviceSlug and styleId are frequently
      // submitted in separate calls, not always together.
      if (!isStyleValidForService(data.styleId, data.serviceSlug)) {
        throw new InvalidStyleForServiceError();
      }

      if (existing) {
        return tx.lead.update({ where: { id: existing.id }, data });
      }
      return tx.lead.create({ data: { sessionId: body.sessionId, ...data, status: "QUOTE_STARTED" } });
    });

    // First-touch attribution — created once, never overwritten (spec section 28).
    if (body.attribution) {
      const hasAttribution = await prisma.leadAttribution.findUnique({ where: { leadId: lead.id } });
      if (!hasAttribution) {
        await prisma.leadAttribution.create({
          data: {
            leadId: lead.id,
            utmSource: body.attribution.utmSource,
            utmMedium: body.attribution.utmMedium,
            utmCampaign: body.attribution.utmCampaign,
            utmContent: body.attribution.utmContent,
            utmTerm: body.attribution.utmTerm,
            landingRoute: body.attribution.landingRoute,
            referrer: body.attribution.referrer,
            firstTouchAt: new Date(body.attribution.firstTouchAt),
          },
        });
      }
    }

    return apiOk({ leadId: lead.id, status: lead.status });
  } catch (err) {
    if (err instanceof InvalidStyleForServiceError) {
      return apiError("VALIDATION_ERROR", "That style is not available for the selected service.");
    }
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      // Lost a create race to a concurrent request for the same sessionId —
      // the winner's row is the correct result; just report it.
      const winner = await prisma.lead.findUnique({ where: { sessionId: body.sessionId } });
      if (winner) return apiOk({ leadId: winner.id, status: winner.status });
    }
    console.error("[api/lead/progress] failed", err);
    return apiError("LEAD_SAVE_FAILED", "Could not save your progress. Please try again.");
  }
}
