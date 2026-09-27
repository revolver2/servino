import { prisma } from "@/lib/server/prisma";
import { adminApiError, adminApiOk } from "@/lib/server/admin-api-response";
import { isSameOrigin, requireAdminSession } from "@/lib/server/admin-auth";
import { checkRateLimit, clientIp } from "@/lib/server/rate-limit";
import { professionalCreateSchema } from "@/lib/server/admin-schemas";
import { getEnabledServices } from "@/lib/services-data";
import { recordAuditEvent } from "@/lib/server/audit";
import { isEnabled } from "@/lib/feature-flags";

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return adminApiError("FORBIDDEN", "Invalid request origin.");

  const admin = await requireAdminSession();
  if (!admin) return adminApiError("UNAUTHORIZED", "Sign in required.");

  const rl = checkRateLimit("admin-mutation", clientIp(request), { windowMs: 60_000, max: 60 });
  if (!rl.allowed) return adminApiError("RATE_LIMITED", "Too many requests. Please slow down.");

  // Operational kill switch (spec section 53) — capacity control for a
  // 1–4-professional launch. Existing professionals are unaffected.
  if (!isEnabled("acceptNewProfessionals")) {
    return adminApiError("CONFLICT", "Servino isn't onboarding new professionals right now (acceptNewProfessionals is off).");
  }

  const json = await request.json().catch(() => null);
  const parsed = professionalCreateSchema.safeParse(json);
  if (!parsed.success) return adminApiError("VALIDATION_ERROR", "Check the professional details and try again.");

  const data = parsed.data;
  const email = data.email.toLowerCase();

  const validSlugs = new Set(getEnabledServices().map((s) => s.slug));
  const serviceSlugs = (data.serviceSlugs ?? []).filter((s) => validSlugs.has(s));

  const existing = await prisma.professional.findFirst({ where: { email } });
  if (existing) return adminApiError("CONFLICT", "A professional with this email already exists.");

  const professional = await prisma.$transaction(async (tx) => {
    const created = await tx.professional.create({
      data: {
        displayName: data.displayName,
        businessName: data.businessName ?? null,
        email,
        phone: data.phone,
        serviceAreaNote: data.serviceAreaNote ?? null,
        notes: data.notes ?? null,
        verificationStatus: data.verificationStatus ?? "MISSING",
        services: { create: serviceSlugs.map((serviceSlug) => ({ serviceSlug })) },
      },
      include: { services: true },
    });
    await recordAuditEvent(
      {
        action: "PROFESSIONAL_CREATED",
        entityType: "PROFESSIONAL",
        entityId: created.id,
        actorId: admin.id,
        metadata: { displayName: created.displayName },
      },
      tx
    );
    return created;
  });

  return adminApiOk({ id: professional.id }, 201);
}
