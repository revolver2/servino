import { createHash } from "node:crypto";
import { prisma } from "@/lib/server/prisma";
import { proApiError, proApiOk } from "@/lib/server/pro-api-response";
import { checkRateLimit, clientIp } from "@/lib/server/rate-limit";
import { proActivateSchema } from "@/lib/server/pro-schemas";
import { hashPassword } from "@/lib/server/password";
import { createProfessionalSession, isSameOrigin, setProSessionCookie } from "@/lib/server/pro-auth";
import { recordAuditEvent } from "@/lib/server/audit";

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/**
 * Consumes a one-time admin-issued activation token (D033). The token is
 * never logged or stored anywhere except as its SHA-256 hash; a second
 * attempt with the same raw token fails because `usedAt` is checked via a
 * conditional update (count-checked), not a separate read-then-write —
 * closing the reused-token race the same way Session E's pricing-version
 * activation race is closed (D027).
 */
export async function POST(request: Request) {
  if (!isSameOrigin(request)) return proApiError("FORBIDDEN", "Invalid request origin.");

  const ip = clientIp(request);
  const rl = checkRateLimit("professional-activation", ip, { windowMs: 5 * 60_000, max: 10 });
  if (!rl.allowed) return proApiError("RATE_LIMITED", "Too many attempts. Please try again later.");

  const json = await request.json().catch(() => null);
  const parsed = proActivateSchema.safeParse(json);
  if (!parsed.success) return proApiError("VALIDATION_ERROR", "Enter a valid activation link and a password of at least 12 characters.");

  const tokenHash = hashToken(parsed.data.token);
  const record = await prisma.professionalActivationToken.findUnique({
    where: { tokenHash },
    include: { professional: true },
  });

  if (!record || record.usedAt || record.expiresAt < new Date() || !record.professional.active) {
    return proApiError("VALIDATION_ERROR", "This activation link is invalid or has expired. Ask your admin for a new one.");
  }

  const passwordHash = hashPassword(parsed.data.password);

  const claimed = await prisma.professionalActivationToken.updateMany({
    where: { id: record.id, usedAt: null },
    data: { usedAt: new Date() },
  });
  if (claimed.count === 0) {
    // Lost a race against a concurrent use of the same link.
    return proApiError("CONFLICT", "This activation link was just used. Please sign in instead.");
  }

  await prisma.professional.update({
    where: { id: record.professionalId },
    data: { passwordHash },
  });

  await recordAuditEvent({
    action: "PROFESSIONAL_ACTIVATED",
    entityType: "PROFESSIONAL",
    entityId: record.professionalId,
    actorProfessionalId: record.professionalId,
  });

  const { token: sessionToken, expiresAt } = await createProfessionalSession(record.professionalId, {
    ipAddress: ip,
    userAgent: request.headers.get("user-agent"),
  });
  await setProSessionCookie(sessionToken, expiresAt);

  return proApiOk({ id: record.professionalId });
}
