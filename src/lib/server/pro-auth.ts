import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { prisma } from "./prisma";

/**
 * DB-backed professional sessions — structurally the same shape as admin
 * sessions (D024) but a fully independent cookie/table (D032): an admin
 * session must never be usable to authenticate as a professional, and
 * vice versa. See src/lib/server/admin-auth.ts for the sibling module.
 */
const COOKIE_NAME = "servino_pro_session";
const SESSION_TTL_MS = 12 * 60 * 60 * 1000; // 12h — same reasoning as admin: a work-session, not "remember me forever"

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function createProfessionalSession(
  professionalId: string,
  meta: { ipAddress: string; userAgent: string | null }
): Promise<{ token: string; expiresAt: Date }> {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  await prisma.professionalSession.create({
    data: {
      tokenHash: hashToken(token),
      professionalId,
      expiresAt,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    },
  });
  return { token, expiresAt };
}

/** Route Handlers only — `cookies()` is read-only inside Server Components. */
export async function setProSessionCookie(token: string, expiresAt: Date) {
  const store = await cookies();
  store.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

export async function clearProSessionCookie() {
  const store = await cookies();
  store.delete(COOKIE_NAME);
}

async function getSessionToken(): Promise<string | null> {
  const store = await cookies();
  return store.get(COOKIE_NAME)?.value ?? null;
}

export type AuthedProfessional = {
  id: string;
  displayName: string;
  email: string;
  active: boolean;
  verificationStatus: string;
};

/**
 * The single authorization boundary every /pro page and /api/pro route
 * must call independently (same principle as requireAdminSession — page-
 * hiding is never the actual mechanism, spec section 43's principle
 * extended to the professional surface). Rejects a session belonging to
 * a professional who has since been deactivated, even if the session
 * token itself is still technically unexpired.
 */
export async function requireProfessionalSession(): Promise<AuthedProfessional | null> {
  const token = await getSessionToken();
  if (!token) return null;

  const session = await prisma.professionalSession.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { professional: true },
  });

  if (!session || session.revokedAt || session.expiresAt < new Date() || !session.professional.active) {
    return null;
  }

  prisma.professionalSession
    .update({ where: { id: session.id }, data: { lastSeenAt: new Date() } })
    .catch(() => {});

  return {
    id: session.professional.id,
    displayName: session.professional.displayName,
    email: session.professional.email,
    active: session.professional.active,
    verificationStatus: session.professional.verificationStatus,
  };
}

export async function revokeCurrentProSession() {
  const token = await getSessionToken();
  if (!token) return;
  await prisma.professionalSession.updateMany({
    where: { tokenHash: hashToken(token), revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

/** Same same-origin check as admin-auth.ts — see that file for rationale. */
export function isSameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  try {
    return new URL(origin).host === new URL(request.url).host;
  } catch {
    return false;
  }
}
