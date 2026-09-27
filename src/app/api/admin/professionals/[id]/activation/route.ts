import { createHash, randomBytes } from "node:crypto";
import { prisma } from "@/lib/server/prisma";
import { adminApiError, adminApiOk } from "@/lib/server/admin-api-response";
import { isSameOrigin, requireAdminSession } from "@/lib/server/admin-auth";
import { checkRateLimit, clientIp } from "@/lib/server/rate-limit";
import { recordAuditEvent } from "@/lib/server/audit";

const ACTIVATION_TTL_MS = 24 * 60 * 60 * 1000;

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/**
 * Generates a one-time activation link for a professional (D033). The raw
 * token is returned exactly once, in this response only — never written
 * to AuditEvent.metadata, never logged (spec section 59). Admin is
 * expected to copy the returned `activationPath` and deliver it to the
 * professional manually (no email infrastructure exists to send it
 * automatically, and none is being built for this — spec section 13).
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!isSameOrigin(request)) return adminApiError("FORBIDDEN", "Invalid request origin.");

  const admin = await requireAdminSession();
  if (!admin) return adminApiError("UNAUTHORIZED", "Sign in required.");

  const rl = checkRateLimit("admin-mutation", clientIp(request), { windowMs: 60_000, max: 60 });
  if (!rl.allowed) return adminApiError("RATE_LIMITED", "Too many requests. Please slow down.");

  const { id } = await params;
  const professional = await prisma.professional.findUnique({ where: { id } });
  if (!professional) return adminApiError("NOT_FOUND", "Professional not found.");
  if (!professional.active) return adminApiError("VALIDATION_ERROR", "Cannot activate an inactive professional.");

  const rawToken = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + ACTIVATION_TTL_MS);

  await prisma.$transaction(async (tx) => {
    await tx.professionalActivationToken.create({
      data: {
        tokenHash: hashToken(rawToken),
        professionalId: id,
        expiresAt,
        createdByAdminId: admin.id,
      },
    });
    // Metadata intentionally contains no token material — only the fact
    // that an activation link was generated, and when it expires.
    await recordAuditEvent(
      {
        action: "PROFESSIONAL_ACTIVATION_CREATED",
        entityType: "PROFESSIONAL",
        entityId: id,
        actorId: admin.id,
        metadata: { expiresAt: expiresAt.toISOString() },
      },
      tx
    );
  });

  return adminApiOk({
    activationPath: `/pro/activate?token=${rawToken}`,
    expiresAt: expiresAt.toISOString(),
  });
}
