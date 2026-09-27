/**
 * One-time admin account bootstrap. Never run automatically, never ships
 * default credentials (spec section 79) — creates or updates the single
 * owner/admin account from environment variables you provide yourself.
 *
 * Usage:
 *   node --env-file=.env.local scripts/admin-bootstrap.mjs
 * Requires ADMIN_BOOTSTRAP_EMAIL and ADMIN_BOOTSTRAP_PASSWORD to be set
 * (in your shell or a temporary .env.local entry — remove the password
 * line afterward, it's only needed for this one run).
 *
 * The scrypt parameters below mirror src/lib/server/password.ts — this
 * script can't import project TypeScript directly, so keep both in sync
 * if the hashing scheme ever changes.
 */
import { PrismaClient } from "@prisma/client";
import { randomBytes, scryptSync } from "node:crypto";

const KEY_LENGTH = 64;
const SALT_LENGTH = 16;
const SCRYPT_PARAMS = { N: 16384, r: 8, p: 1 };

function hashPassword(password) {
  const salt = randomBytes(SALT_LENGTH);
  const derived = scryptSync(password, salt, KEY_LENGTH, SCRYPT_PARAMS);
  return `scrypt:${SCRYPT_PARAMS.N}:${SCRYPT_PARAMS.r}:${SCRYPT_PARAMS.p}:${salt.toString("hex")}:${derived.toString("hex")}`;
}

async function main() {
  const email = process.env.ADMIN_BOOTSTRAP_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_BOOTSTRAP_PASSWORD;

  if (!email || !password) {
    console.error(
      "ADMIN_BOOTSTRAP_EMAIL and ADMIN_BOOTSTRAP_PASSWORD must both be set. Aborting — no default credentials will be created."
    );
    process.exit(1);
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    console.error("ADMIN_BOOTSTRAP_EMAIL is not a valid email address. Aborting.");
    process.exit(1);
  }
  if (password.length < 12) {
    console.error("ADMIN_BOOTSTRAP_PASSWORD must be at least 12 characters. Aborting.");
    process.exit(1);
  }
  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL is not set. Aborting.");
    process.exit(1);
  }

  const prisma = new PrismaClient();
  try {
    const passwordHash = hashPassword(password);
    const admin = await prisma.adminUser.upsert({
      where: { email },
      update: { passwordHash, active: true },
      create: { email, passwordHash, role: "SUPER_ADMIN" },
    });
    console.log(`Admin user ready: ${admin.email} (${admin.role}, id ${admin.id}).`);
    console.log(
      "Remove ADMIN_BOOTSTRAP_PASSWORD from your environment now — it is not read again after this script runs."
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
