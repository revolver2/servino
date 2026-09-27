import { prisma } from "@/lib/server/prisma";
import { proApiError, proApiOk } from "@/lib/server/pro-api-response";
import { checkRateLimit, clientIp } from "@/lib/server/rate-limit";
import { proLoginSchema } from "@/lib/server/pro-schemas";
import { DUMMY_PASSWORD_HASH, verifyPassword } from "@/lib/server/password";
import { createProfessionalSession, isSameOrigin, setProSessionCookie } from "@/lib/server/pro-auth";
import { recordAuditEvent } from "@/lib/server/audit";

/**
 * Own rate-limit bucket ("professional-login"), separate from
 * "admin-login" (D032/spec section 58) — login is still the highest-
 * value brute-force target on this surface, and must not share (or
 * weaken) the admin bucket.
 */
export async function POST(request: Request) {
  if (!isSameOrigin(request)) return proApiError("FORBIDDEN", "Invalid request origin.");

  const ip = clientIp(request);
  const rl = checkRateLimit("professional-login", ip, { windowMs: 5 * 60_000, max: 8 });
  if (!rl.allowed) return proApiError("RATE_LIMITED", "Too many login attempts. Please try again later.");

  const json = await request.json().catch(() => null);
  const parsed = proLoginSchema.safeParse(json);
  if (!parsed.success) return proApiError("VALIDATION_ERROR", "Enter a valid email and password.");

  const email = parsed.data.email.toLowerCase();
  const professional = await prisma.professional.findFirst({ where: { email } });

  // Always run verifyPassword, even on a missing user or one who never
  // activated (passwordHash null), against a fixed dummy hash — keeps
  // response timing from revealing account existence (same principle as
  // admin login).
  const passwordValid = verifyPassword(parsed.data.password, professional?.passwordHash ?? DUMMY_PASSWORD_HASH);

  if (!professional || !professional.active || !professional.passwordHash || !passwordValid) {
    await recordAuditEvent({
      action: "PROFESSIONAL_LOGIN_FAILED",
      entityType: "PROFESSIONAL_LOGIN",
      entityId: email,
      metadata: {
        reason: !professional
          ? "no_such_user"
          : !professional.active
            ? "inactive"
            : !professional.passwordHash
              ? "not_activated"
              : "bad_password",
      },
    });
    return proApiError("UNAUTHORIZED", "Invalid email or password.");
  }

  const { token, expiresAt } = await createProfessionalSession(professional.id, {
    ipAddress: ip,
    userAgent: request.headers.get("user-agent"),
  });
  await setProSessionCookie(token, expiresAt);

  await recordAuditEvent({
    action: "PROFESSIONAL_LOGIN_SUCCESS",
    entityType: "PROFESSIONAL",
    entityId: professional.id,
    actorProfessionalId: professional.id,
  });

  return proApiOk({ id: professional.id, displayName: professional.displayName });
}
