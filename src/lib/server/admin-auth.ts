import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { prisma } from "./prisma";

/**
 * DB-backed admin sessions (D024) — the cookie holds a random opaque
 * token; only its SHA-256 hash is ever stored, so a database read alone
 * can never yield a usable session, and revocation (logout) is immediate.
 */
const COOKIE_NAME = "servino_admin_session";
const SESSION_TTL_MS = 12 * 60 * 60 * 1000; // 12h — owner-operator session, not "remember me forever"

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function createAdminSession(
  adminUserId: string,
  meta: { ipAddress: string; userAgent: string | null }
): Promise<{ token: string; expiresAt: Date }> {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  await prisma.adminSession.create({
    data: {
      tokenHash: hashToken(token),
      adminUserId,
      expiresAt,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    },
  });
  return { token, expiresAt };
}

/** Route Handlers only — `cookies()` is read-only inside Server Components. */
export async function setSessionCookie(token: string, expiresAt: Date) {
  const store = await cookies();
  store.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

export async function clearSessionCookie() {
  const store = await cookies();
  store.delete(COOKIE_NAME);
}

async function getSessionToken(): Promise<string | null> {
  const store = await cookies();
  return store.get(COOKIE_NAME)?.value ?? null;
}

export type AuthedAdmin = { id: string; email: string; role: string };

/**
 * The single authorization boundary every admin page and API route must
 * call (spec section 43). Never trust route hiding or client state —
 * this is always a real database lookup against the session table.
 */
export async function requireAdminSession(): Promise<AuthedAdmin | null> {
  const token = await getSessionToken();
  if (!token) return null;

  const session = await prisma.adminSession.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { adminUser: true },
  });

  if (!session || session.revokedAt || session.expiresAt < new Date() || !session.adminUser.active) {
    return null;
  }

  // Best-effort activity touch — not on the critical auth path.
  prisma.adminSession
    .update({ where: { id: session.id }, data: { lastSeenAt: new Date() } })
    .catch(() => {});

  return { id: session.adminUser.id, email: session.adminUser.email, role: session.adminUser.role };
}

export async function revokeCurrentSession() {
  const token = await getSessionToken();
  if (!token) return;
  await prisma.adminSession.updateMany({
    where: { tokenHash: hashToken(token), revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

/**
 * Same-origin check for admin mutation routes (spec section 46). With a
 * `SameSite=Lax` cookie, the main remaining CSRF vector is a top-level
 * cross-site form navigation; comparing the request's own `Origin` header
 * against its own `Host` closes that without needing a signed CSRF token.
 */
export function isSameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return true; // same-origin fetches from the app's own pages
  try {
    return new URL(origin).host === new URL(request.url).host;
  } catch {
    return false;
  }
}
