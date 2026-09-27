import { randomBytes, scryptSync, createHash } from "node:crypto";
import { testDb } from "./db";

/**
 * Mirrors src/lib/server/password.ts's scrypt scheme, same reasoning as
 * helpers/admin.ts's own duplication (test files aren't guaranteed to
 * resolve the app's `@/*` alias the way Next's own build does).
 */
function hashPassword(password: string): string {
  const salt = randomBytes(16);
  const derived = scryptSync(password, salt, 64, { N: 16384, r: 8, p: 1 });
  return `scrypt:16384:8:1:${salt.toString("hex")}:${derived.toString("hex")}`;
}

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export const TEST_PRO_PASSWORD = "E2E-Test-Pro-Passphrase-2026";

/** Creates (or resets) an already-activated test professional — has a real passwordHash, ready to log in immediately. */
export async function ensureActivatedProfessional(opts: {
  email: string;
  displayName?: string;
  serviceSlugs?: string[];
  active?: boolean;
}) {
  // Professional.email is not a unique DB constraint (app-level uniqueness
  // only, same as src/app/api/admin/professionals/route.ts) — findFirst,
  // not upsert.
  const existing = await testDb.professional.findFirst({ where: { email: opts.email } });
  if (existing) {
    return testDb.professional.update({
      where: { id: existing.id },
      data: { passwordHash: hashPassword(TEST_PRO_PASSWORD), active: opts.active ?? true },
    });
  }
  return testDb.professional.create({
    data: {
      displayName: opts.displayName ?? "Test Professional",
      email: opts.email,
      phone: "4165550000",
      active: opts.active ?? true,
      passwordHash: hashPassword(TEST_PRO_PASSWORD),
      verificationStatus: "VERIFIED",
      services: { create: (opts.serviceSlugs ?? ["wall-panels"]).map((serviceSlug) => ({ serviceSlug })) },
    },
  });
}

/**
 * Deterministic fake IP per email, same reasoning as helpers/api.ts's
 * fakeIp() — without this, every test's login shares the "unknown"
 * bucket (Playwright's request context sets no X-Forwarded-For by
 * default) and the real, unmodified 8/5min login rate limit trips from
 * test volume alone, not from anything wrong with the app.
 */
export function fakeProIp(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  return `198.51.100.${(hash % 250) + 1}`;
}

/** Logs in via the real API. */
export async function proLogin(
  apiRequest: {
    post(
      url: string,
      opts: { data: unknown; headers?: Record<string, string> }
    ): Promise<{ ok(): boolean; status(): number }>;
  },
  baseURL: string,
  email: string,
  password = TEST_PRO_PASSWORD
) {
  const res = await apiRequest.post(`${baseURL}/api/pro/auth/login`, {
    data: { email, password },
    headers: { "X-Forwarded-For": fakeProIp(email) },
  });
  if (!res.ok()) throw new Error(`Professional login failed with status ${res.status()}`);
  return res;
}

/** Creates a professional with NO password (not yet activated) plus a real, usable activation token — the raw token is returned only here, exactly like the real admin flow. */
export async function createUnactivatedProfessionalWithToken(opts: {
  email: string;
  displayName?: string;
  serviceSlugs?: string[];
  expiresInMs?: number;
}) {
  const professional = await testDb.professional.create({
    data: {
      displayName: opts.displayName ?? "Unactivated Professional",
      email: opts.email,
      phone: "4165550001",
      active: true,
      verificationStatus: "VERIFIED",
      services: { create: (opts.serviceSlugs ?? ["wall-panels"]).map((serviceSlug) => ({ serviceSlug })) },
    },
  });
  const rawToken = randomBytes(32).toString("base64url");
  await testDb.professionalActivationToken.create({
    data: {
      tokenHash: hashToken(rawToken),
      professionalId: professional.id,
      expiresAt: new Date(Date.now() + (opts.expiresInMs ?? 24 * 60 * 60 * 1000)),
    },
  });
  return { professional, rawToken };
}
