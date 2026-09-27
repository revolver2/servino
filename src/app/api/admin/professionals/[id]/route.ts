import { prisma } from "@/lib/server/prisma";
import { adminApiError, adminApiOk } from "@/lib/server/admin-api-response";
import { isSameOrigin, requireAdminSession } from "@/lib/server/admin-auth";
import { checkRateLimit, clientIp } from "@/lib/server/rate-limit";
import { professionalUpdateSchema } from "@/lib/server/admin-schemas";
import { getEnabledServices } from "@/lib/services-data";
import { recordAuditEvent } from "@/lib/server/audit";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!isSameOrigin(request)) return adminApiError("FORBIDDEN", "Invalid request origin.");

  const admin = await requireAdminSession();
  if (!admin) return adminApiError("UNAUTHORIZED", "Sign in required.");

  const rl = checkRateLimit("admin-mutation", clientIp(request), { windowMs: 60_000, max: 60 });
  if (!rl.allowed) return adminApiError("RATE_LIMITED", "Too many requests. Please slow down.");

  const { id } = await params;
  const json = await request.json().catch(() => null);
  const parsed = professionalUpdateSchema.safeParse(json);
  if (!parsed.success) return adminApiError("VALIDATION_ERROR", "Check the professional details and try again.");

  const existing = await prisma.professional.findUnique({ where: { id } });
  if (!existing) return adminApiError("NOT_FOUND", "Professional not found.");

  const data = parsed.data;

  if (data.email) {
    const email = data.email.toLowerCase();
    const duplicate = await prisma.professional.findFirst({ where: { email, NOT: { id } } });
    if (duplicate) return adminApiError("CONFLICT", "Another professional already uses this email.");
  }

  const validSlugs = new Set(getEnabledServices().map((s) => s.slug));
  const nextServiceSlugs = data.serviceSlugs?.filter((s) => validSlugs.has(s));

  const updated = await prisma.$transaction(async (tx) => {
    const u = await tx.professional.update({
      where: { id },
      data: {
        displayName: data.displayName,
        businessName: data.businessName,
        email: data.email ? data.email.toLowerCase() : undefined,
        phone: data.phone,
        serviceAreaNote: data.serviceAreaNote,
        notes: data.notes,
        verificationStatus: data.verificationStatus,
        active: data.active,
      },
    });

    if (nextServiceSlugs) {
      await tx.professionalService.deleteMany({ where: { professionalId: id } });
      if (nextServiceSlugs.length > 0) {
        await tx.professionalService.createMany({
          data: nextServiceSlugs.map((serviceSlug) => ({ professionalId: id, serviceSlug })),
        });
      }
    }

    await recordAuditEvent(
      {
        action: "PROFESSIONAL_UPDATED",
        entityType: "PROFESSIONAL",
        entityId: id,
        actorId: admin.id,
        metadata: { fields: Object.keys(json as Record<string, unknown>) },
      },
      tx
    );

    return u;
  });

  return adminApiOk({ id: updated.id, active: updated.active });
}
