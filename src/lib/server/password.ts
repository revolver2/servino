import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

/**
 * Dependency-free password hashing (Session D, D022) — Node's built-in
 * `scrypt` instead of pulling in bcrypt/argon2, avoiding a native-binding
 * dependency for a single owner/admin account. Encoded as
 * `scrypt:N:r:p:saltHex:hashHex` so parameters can change later without
 * invalidating already-stored hashes.
 *
 * Mirrored (not imported) in `scripts/admin-bootstrap.mjs`, which runs
 * standalone via `node --env-file` and can't import project TypeScript —
 * keep both in sync if these parameters ever change.
 */
const KEY_LENGTH = 64;
const SALT_LENGTH = 16;
const SCRYPT_PARAMS = { N: 16384, r: 8, p: 1 };

export function hashPassword(password: string): string {
  const salt = randomBytes(SALT_LENGTH);
  const derived = scryptSync(password, salt, KEY_LENGTH, SCRYPT_PARAMS);
  return `scrypt:${SCRYPT_PARAMS.N}:${SCRYPT_PARAMS.r}:${SCRYPT_PARAMS.p}:${salt.toString("hex")}:${derived.toString("hex")}`;
}

/** Constant-time verification. Never throws on malformed input — returns false. */
export function verifyPassword(password: string, stored: string): boolean {
  const parts = stored.split(":");
  if (parts.length !== 6 || parts[0] !== "scrypt") return false;

  const [, nStr, rStr, pStr, saltHex, hashHex] = parts;
  const N = Number(nStr);
  const r = Number(rStr);
  const p = Number(pStr);
  if (!Number.isFinite(N) || !Number.isFinite(r) || !Number.isFinite(p)) return false;

  try {
    const salt = Buffer.from(saltHex, "hex");
    const expected = Buffer.from(hashHex, "hex");
    const derived = scryptSync(password, salt, expected.length, { N, r, p });
    return derived.length === expected.length && timingSafeEqual(derived, expected);
  } catch {
    return false;
  }
}

/**
 * A fixed, never-valid hash to run password verification against when no
 * matching admin user was found — keeps login response timing from
 * trivially revealing whether an email address has an account (spec
 * section 48).
 */
export const DUMMY_PASSWORD_HASH = hashPassword(randomBytes(32).toString("hex"));
