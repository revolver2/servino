import { randomBytes, scryptSync } from "node:crypto";
import { testDb } from "./db";

/**
 * Mirrors src/lib/server/password.ts's scrypt scheme (already duplicated
 * once in scripts/admin-bootstrap.mjs for the same reason: test files
 * aren't guaranteed to resolve the app's `@/*` path alias the way Next's
 * own build does, so a small, obviously-correct duplication beats a
 * fragile cross-boundary import).
 */
function hashPassword(password: string): string {
  const salt = randomBytes(16);
  const derived = scryptSync(password, salt, 64, { N: 16384, r: 8, p: 1 });
  return `scrypt:16384:8:1:${salt.toString("hex")}:${derived.toString("hex")}`;
}

export const TEST_ADMIN_EMAIL = "e2e-admin@servino.local";
export const TEST_ADMIN_PASSWORD = "E2E-Test-Admin-Passphrase-2026";

/** Idempotent — safe to call at the top of every test that needs an authenticated admin. */
export async function ensureTestAdmin() {
  return testDb.adminUser.upsert({
    where: { email: TEST_ADMIN_EMAIL },
    update: { passwordHash: hashPassword(TEST_ADMIN_PASSWORD), active: true },
    create: { email: TEST_ADMIN_EMAIL, passwordHash: hashPassword(TEST_ADMIN_PASSWORD), role: "SUPER_ADMIN" },
  });
}

/**
 * Deterministic fake IP per seed, same reasoning as helpers/api.ts's
 * fakeIp() and helpers/pro.ts's fakeProIp(): the pre-authenticated
 * `page` fixture's admin requests otherwise all share one "unknown"
 * clientIp() bucket for the real, unmodified `admin-mutation` rate
 * limit (60/60s, spec section 47) — fine for any one test file's own
 * volume, but a large Session G suite calling admin routes across many
 * files in the same serial run can exceed it purely from combined test
 * volume, not from anything wrong with the app. Pass this as an
 * `X-Forwarded-For` header on individual `page.request` calls (not a
 * whole new browser context — the existing session cookie still works
 * unmodified) to give a test's admin calls their own bucket.
 */
export function fakeAdminIp(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  return `198.51.100.${(hash % 250) + 1}`;
}

/** Logs in via the real API using the given request context (page.request or a standalone `request` fixture). */
export async function adminLogin(
  apiRequest: { post(url: string, opts: { data: unknown }): Promise<{ ok(): boolean; status(): number }> },
  baseURL: string,
  email = TEST_ADMIN_EMAIL,
  password = TEST_ADMIN_PASSWORD
) {
  const res = await apiRequest.post(`${baseURL}/api/admin/auth/login`, { data: { email, password } });
  if (!res.ok()) throw new Error(`Admin login failed with status ${res.status()}`);
  return res;
}
