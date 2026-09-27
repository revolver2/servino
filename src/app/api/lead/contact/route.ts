import { prisma } from "@/lib/server/prisma";
import { apiError, apiOk } from "@/lib/server/api-response";
import { checkRateLimit, clientIp } from "@/lib/server/rate-limit";
import { furthestStatus } from "@/lib/server/lead-status";
import { contactSchema } from "@/lib/server/schemas";
import { honeypotTripped, isSuspiciouslyFast } from "@/lib/server/spam-signals";
import { CURRENT_JURISDICTION_CONFIG } from "@/lib/consent/consent-manager";

export async function POST(request: Request) {
  const ip = clientIp(request);
  const rl = checkRateLimit("lead-contact", ip, { windowMs: 60_000, max: 10 });
  if (!rl.allowed) return apiError("RATE_LIMITED", "Too many requests. Please try again shortly.");

  const json = await request.json().catch(() => null);
  const parsed = contactSchema.safeParse(json);
  if (!parsed.success) return apiError("VALIDATION_ERROR", "Please check your contact details.", parsed.error.flatten());
  const body = parsed.data;

  // Honeypot: a real user never fills this hidden field. Suppress
  // silently rather than revealing detection to the caller (spec
  // section 30) — respond as if it succeeded, but persist nothing.
  if (honeypotTripped(body.honeypot)) {
    console.warn("[api/lead/contact] honeypot tripped", { ip });
    return apiOk({ suppressed: true });
  }

  // Timing is one signal among several, never sole grounds for blocking
  // (spec section 31) — log only.
  if (isSuspiciouslyFast(body.formRenderedAt)) {
    console.warn("[api/lead/contact] suspiciously fast submission", { ip });
  }

  const lead = await prisma.lead.findUnique({ where: { sessionId: body.sessionId } });
  if (!lead || lead.status === "QUOTE_STARTED" || lead.status === "QUOTE_PARTIAL") {
    return apiError("INVALID_FUNNEL_STATE", "Please view your price before continuing.");
  }

  try {
    await prisma.contactInfo.upsert({
      where: { leadId: lead.id },
      create: { leadId: lead.id, firstName: body.firstName, email: body.email, phone: body.phone },
      update: { firstName: body.firstName, email: body.email, phone: body.phone },
    });

    await prisma.consentEvidence.create({
      data: {
        leadId: lead.id,
        category: "ESSENTIAL",
        purpose: "Follow up on the submitted project quote",
        channel: "EMAIL",
        wordingVersion: CURRENT_JURISDICTION_CONFIG.wordingVersion,
        sourceRoute: "/quote/contact",
        sourceAction: "contact_form_submit",
        jurisdiction: CURRENT_JURISDICTION_CONFIG.jurisdiction,
      },
    });

    await prisma.lead.update({
      where: { id: lead.id },
      data: { status: furthestStatus(lead.status, "CONTACT_CAPTURED"), currentStep: "CONTACT" },
    });

    return apiOk({ leadId: lead.id });
  } catch (err) {
    console.error("[api/lead/contact] failed", err);
    return apiError("LEAD_SAVE_FAILED", "Could not save your details. Please try again.");
  }
}
