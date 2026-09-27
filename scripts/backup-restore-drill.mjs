// Session H backup/restore drill (spec section 26) — run once, results
// documented in docs/BACKUP_RECOVERY.md "Restore drill result," not
// meant to be part of any regular pipeline.
//
// IMPORTANT DISCLOSURE: this does NOT exercise `pg_dump`/`pg_restore`.
// The embedded Postgres distribution this project uses for local dev
// (`embedded-postgres`, see docs/DECISIONS.md D011) only bundles
// `postgres`/`initdb`/`pg_ctl` — no `pg_dump`, `pg_restore`, `psql`, or
// `createdb` binary exists anywhere in this environment (verified: not
// in node_modules, not on PATH). Production runs on a real, full
// self-hosted PostgreSQL install where those tools are standard — see
// docs/BACKUP_RECOVERY.md for the exact production commands, which this
// script cannot itself verify.
//
// What this DOES verify, for real, at the application layer: that data
// can be extracted from the live database, a completely fresh database
// can be created and migrated from zero, the data reloaded into it, and
// the application (via Prisma) can read it back correctly. That is the
// actual thing a restore drill needs to prove — "can we get our data
// back into a working system" — independent of which specific dump
// tool eventually performs the byte-level copy in production.
//
// Usage: node scripts/backup-restore-drill.mjs
import { PrismaClient } from "@prisma/client";

const ADMIN_CONN = "postgresql://servino:servino_dev_local_only@127.0.0.1:55432/postgres?schema=public";
const SOURCE_DB = "servino_dev";
const DRILL_DB = "servino_restore_drill";
const SOURCE_URL = `postgresql://servino:servino_dev_local_only@127.0.0.1:55432/${SOURCE_DB}?schema=public`;
const DRILL_URL = `postgresql://servino:servino_dev_local_only@127.0.0.1:55432/${DRILL_DB}?schema=public`;

async function main() {
  const admin = new PrismaClient({ datasources: { db: { url: ADMIN_CONN } } });
  console.log(`[1/6] Dropping any previous drill database...`);
  await admin.$executeRawUnsafe(`DROP DATABASE IF EXISTS "${DRILL_DB}"`);
  console.log(`[2/6] Creating fresh empty drill database "${DRILL_DB}"...`);
  await admin.$executeRawUnsafe(`CREATE DATABASE "${DRILL_DB}"`);
  await admin.$disconnect();

  console.log(`[3/6] Running full migration history against the fresh database (this is the real production migration path — prisma migrate deploy)...`);
  const { execSync } = await import("node:child_process");
  execSync("npx prisma migrate deploy", {
    env: { ...process.env, DATABASE_URL: DRILL_URL },
    stdio: "inherit",
  });

  console.log(`[4/6] Reading representative tables from ${SOURCE_DB} (in FK dependency order)...`);
  const source = new PrismaClient({ datasources: { db: { url: SOURCE_URL } } });
  const drill = new PrismaClient({ datasources: { db: { url: DRILL_URL } } });

  const admins = await source.adminUser.findMany();
  const pricingVersions = await source.pricingVersion.findMany();
  const professionals = await source.professional.findMany();
  const leads = await source.lead.findMany();
  const quoteSnapshots = await source.quoteSnapshot.findMany();
  const bookingIntents = await source.bookingIntent.findMany();
  const jobs = await source.job.findMany();
  const payments = await source.payment.findMany();

  console.log(
    `      Source counts — AdminUser: ${admins.length}, PricingVersion: ${pricingVersions.length}, Professional: ${professionals.length}, Lead: ${leads.length}, QuoteSnapshot: ${quoteSnapshots.length}, BookingIntent: ${bookingIntents.length}, Job: ${jobs.length}, Payment: ${payments.length}`
  );

  console.log(`[5/6] Restoring into the fresh drill database (same FK order)...`);
  if (admins.length) await drill.adminUser.createMany({ data: admins });
  if (pricingVersions.length) await drill.pricingVersion.createMany({ data: pricingVersions });
  if (professionals.length) await drill.professional.createMany({ data: professionals });
  if (leads.length) await drill.lead.createMany({ data: leads });
  if (quoteSnapshots.length) await drill.quoteSnapshot.createMany({ data: quoteSnapshots });
  if (bookingIntents.length) await drill.bookingIntent.createMany({ data: bookingIntents });
  if (jobs.length) await drill.job.createMany({ data: jobs });
  if (payments.length) await drill.payment.createMany({ data: payments });

  console.log(`[6/6] Verifying restored data is readable and correct...`);
  const restoredCounts = {
    adminUser: await drill.adminUser.count(),
    pricingVersion: await drill.pricingVersion.count(),
    professional: await drill.professional.count(),
    lead: await drill.lead.count(),
    quoteSnapshot: await drill.quoteSnapshot.count(),
    bookingIntent: await drill.bookingIntent.count(),
    job: await drill.job.count(),
    payment: await drill.payment.count(),
  };
  console.log("      Restored counts:", restoredCounts);

  const countsMatch =
    restoredCounts.adminUser === admins.length &&
    restoredCounts.pricingVersion === pricingVersions.length &&
    restoredCounts.professional === professionals.length &&
    restoredCounts.lead === leads.length &&
    restoredCounts.quoteSnapshot === quoteSnapshots.length &&
    restoredCounts.bookingIntent === bookingIntents.length &&
    restoredCounts.job === jobs.length &&
    restoredCounts.payment === payments.length;

  let sampleOk = true;
  if (payments.length > 0) {
    const samplePaymentId = payments[0].id;
    const restoredPayment = await drill.payment.findUnique({ where: { id: samplePaymentId } });
    sampleOk = !!restoredPayment && restoredPayment.amountMinor === payments[0].amountMinor;
    console.log(`      Sample Payment record readable after restore: ${sampleOk}`);
  }

  await source.$disconnect();
  await drill.$disconnect();

  const cleanup = new PrismaClient({ datasources: { db: { url: ADMIN_CONN } } });
  await cleanup.$executeRawUnsafe(`DROP DATABASE IF EXISTS "${DRILL_DB}"`);
  await cleanup.$disconnect();
  console.log(`\nDrill database dropped (cleanup complete).`);

  if (!countsMatch || !sampleOk) {
    console.error("\nFAIL — restored data did not match source.");
    process.exit(1);
  }
  console.log("\nPASS — fresh database created from migrations, data restored, and verified readable.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
