import { prisma } from "@/lib/server/prisma";
import { apiError, apiOk } from "@/lib/server/api-response";
import { checkRateLimit, clientIp } from "@/lib/server/rate-limit";
import { timingSchema } from "@/lib/server/schemas";

export async function POST(request: Request) {
  const ip = clientIp(request);
  const rl = checkRateLimit("lead-timing", ip, { windowMs: 60_000, max: 20 });
  if (!rl.allowed) return apiError("RATE_LIMITED", "Too many requests. Please try again shortly.");

  const json = await request.json().catch(() => null);
  const parsed = timingSchema.safeParse(json);
  if (!parsed.success) return apiError("VALIDATION_ERROR", "Invalid timing selection.", parsed.error.flatten());
  const body = parsed.data;

  const lead = await prisma.lead.findUnique({ where: { sessionId: body.sessionId } });
  if (!lead || lead.status !== "CONTACT_CAPTURED") {
    return apiError("INVALID_FUNNEL_STATE", "Please share your contact details before continuing.");
  }

  try {
    await prisma.timingSelection.upsert({
      where: { leadId: lead.id },
      create: { leadId: lead.id, value: body.value },
      update: { value: body.value },
    });

    await prisma.lead.update({ where: { id: lead.id }, data: { currentStep: "TIMING" } });

    return apiOk({ leadId: lead.id });
  } catch (err) {
    console.error("[api/lead/timing] failed", err);
    return apiError("LEAD_SAVE_FAILED", "Could not save your timing. Please try again.");
  }
}
