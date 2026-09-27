import { prisma } from "@/lib/server/prisma";
import { adminApiError, adminApiOk } from "@/lib/server/admin-api-response";
import { checkRateLimit, clientIp } from "@/lib/server/rate-limit";
import { adminLoginSchema } from "@/lib/server/admin-schemas";
import { DUMMY_PASSWORD_HASH, verifyPassword } from "@/lib/server/password";
import { createAdminSession, isSameOrigin, setSessionCookie } from "@/lib/server/admin-auth";
import { recordAuditEvent } from "@/lib/server/audit";

/**
 * Tight rate limit deliberately not shared with the customer funnel's
 * limits (spec section 47) — login is the highest-value brute-force
 * target in the whole app. 8 attempts / 5 minutes per IP is enough for a
 * legitimate owner who mistypes a password a few times, tight enough to
 * make credential-stuffing impractical.
 */
export async function POST(request: Request) {
  if (!isSameOrigin(request)) return adminApiError("FORBIDDEN", "Invalid request origin.");

  const ip = clientIp(request);
  const rl = checkRateLimit("admin-login", ip, { windowMs: 5 * 60_000, max: 8 });
  if (!rl.allowed) return adminApiError("RATE_LIMITED", "Too many login attempts. Please try again later.");

  const json = await request.json().catch(() => null);
  const parsed = adminLoginSchema.safeParse(json);
  if (!parsed.success) return adminApiError("VALIDATION_ERROR", "Enter a valid email and password.");

  const email = parsed.data.email.toLowerCase();
  const admin = await prisma.adminUser.findUnique({ where: { email } });

  // Always run verifyPassword, even on a missing user, against a fixed
  // dummy hash — keeps response timing from revealing account existence.
  const passwordValid = verifyPassword(parsed.data.password, admin?.passwordHash ?? DUMMY_PASSWORD_HASH);

  if (!admin || !admin.active || !passwordValid) {
    await recordAuditEvent({
      action: "ADMIN_LOGIN_FAILED",
      entityType: "ADMIN_LOGIN",
      entityId: email,
      metadata: { reason: !admin ? "no_such_user" : !admin.active ? "inactive" : "bad_password" },
    });
    return adminApiError("UNAUTHORIZED", "Invalid email or password.");
  }

  const { token, expiresAt } = await createAdminSession(admin.id, {
    ipAddress: ip,
    userAgent: request.headers.get("user-agent"),
  });
  await setSessionCookie(token, expiresAt);

  await prisma.adminUser.update({ where: { id: admin.id }, data: { lastLoginAt: new Date() } });
  await recordAuditEvent({
    action: "ADMIN_LOGIN_SUCCESS",
    entityType: "ADMIN_USER",
    entityId: admin.id,
    actorId: admin.id,
  });

  return adminApiOk({ email: admin.email, role: admin.role });
}
