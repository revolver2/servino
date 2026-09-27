import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/server/prisma";
import { apiError, apiOk } from "@/lib/server/api-response";
import { checkRateLimit, clientIp } from "@/lib/server/rate-limit";
import { bookingIntentSchema } from "@/lib/server/schemas";
import { recordAuditEvent } from "@/lib/server/audit";
import { isEnabled } from "@/lib/feature-flags";

/**
 * The final B2 action. Idempotent by construction: `BookingIntent.leadId`
 * is unique, so a duplicate/retried submission for the same lead can
 * never create a second row (spec sections 10/22). Three layers protect
 * against a double-tap or network retry creating duplicates:
 *   1. An upfront existence check (fast path, avoids a transaction).
 *   2. The DB transaction that creates it alongside the lead status flip.
 *   3. A caught unique-constraint violation (P2002) for the race where two
 *      requests both pass step 1 before either commits — the loser just
 *      re-fetches and returns the winner's row instead of erroring.
 *
 * Session D addition (D023): the same transaction also creates the
 * operational `Job` shell (status NEW) — every submitted project request
 * becomes immediately visible/operable in `/admin/jobs`, with no separate
 * "convert" step. This is a pure side effect: the response shape below
 * (`{ bookingIntentId }`) and every other customer-visible behavior of
 * this endpoint are unchanged. Job creation rides the same P2002 race
 * handling as BookingIntent — if this transaction doesn't win the race,
 * it doesn't create a Job either, and the winning transaction already did.
 */
export async function POST(request: Request) {
  const ip = clientIp(request);
  const rl = checkRateLimit("lead-booking-intent", ip, { windowMs: 60_000, max: 10 });
  if (!rl.allowed) return apiError("RATE_LIMITED", "Too many requests. Please try again shortly.");

  const json = await request.json().catch(() => null);
  const parsed = bookingIntentSchema.safeParse(json);
  if (!parsed.success) return apiError("VALIDATION_ERROR", "Invalid request.", parsed.error.flatten());

  const lead = await prisma.lead.findUnique({
    where: { sessionId: parsed.data.sessionId },
    include: { bookingIntent: true, timing: true, quoteSnapshots: { orderBy: { createdAt: "desc" }, take: 1 } },
  });

  if (!lead) return apiError("INVALID_FUNNEL_STATE", "No project found for this session.");

  if (lead.bookingIntent) {
    return apiOk({ bookingIntentId: lead.bookingIntent.id });
  }

  // Operational kill switch (spec section 51) — stops NEW bookings
  // without touching anything already submitted, and without taking
  // the marketing site or the rest of the quote funnel offline.
  if (!isEnabled("newBookings")) {
    return apiError(
      "BOOKINGS_PAUSED",
      "Servino isn't accepting new projects right now. Please check back soon."
    );
  }

  if (lead.status !== "CONTACT_CAPTURED" || !lead.timing || lead.quoteSnapshots.length === 0) {
    return apiError("INVALID_FUNNEL_STATE", "Please complete contact and timing before continuing.");
  }

  const snapshot = lead.quoteSnapshots[0];

  try {
    const bookingIntent = await prisma.$transaction(async (tx) => {
      const created = await tx.bookingIntent.create({
        data: { leadId: lead.id, quoteSnapshotId: snapshot.id },
      });
      await tx.lead.update({
        where: { id: lead.id },
        // Session G (D040): PAYMENT is the next step, not CONFIRMATION —
        // the customer pays before landing on the confirmation page.
        data: { status: "BOOKING_INTENT", currentStep: "PAYMENT" },
      });

      const job = await tx.job.create({
        data: { leadId: lead.id, bookingIntentId: created.id },
      });
      await recordAuditEvent(
        {
          action: "JOB_CREATED",
          entityType: "JOB",
          entityId: job.id,
          actorId: null, // system-initiated — the customer, not an admin
          metadata: { leadId: lead.id, bookingIntentId: created.id },
        },
        tx
      );

      return created;
    });

    return apiOk({ bookingIntentId: bookingIntent.id }, 201);
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      // Lost the race to a concurrent request for the same lead — the
      // winner's row is the logical result of this idempotent operation.
      const winner = await prisma.bookingIntent.findUnique({ where: { leadId: lead.id } });
      if (winner) return apiOk({ bookingIntentId: winner.id });
    }
    console.error("[api/lead/booking-intent] failed", err);
    return apiError("BOOKING_INTENT_FAILED", "Could not submit your project. Please try again.");
  }
}
