// Session H0.2 — one-off, local-only cleanup of a specific manual-QA
// test lead ("Servino QA Test" / servino-qa@example.com / 4165550100)
// found in servino_dev during this session's audit. NOT a general
// "delete customer" feature — a single hardcoded lookup, run once,
// with an explicit guard refusing to run against anything that isn't
// the local dev database.
import { PrismaClient } from "@prisma/client";

const DATABASE_URL = process.env.DATABASE_URL ?? "postgresql://servino:servino_dev_local_only@127.0.0.1:55432/servino_dev?schema=public";

if (!/servino_dev/.test(DATABASE_URL) || !/127\.0\.0\.1|localhost/.test(DATABASE_URL)) {
  console.error("REFUSING: DATABASE_URL does not look like the local servino_dev database.");
  console.error(`  DATABASE_URL=${DATABASE_URL}`);
  process.exit(1);
}

const prisma = new PrismaClient({ datasources: { db: { url: DATABASE_URL } } });

async function main() {
  const contact = await prisma.contactInfo.findFirst({
    where: { email: "servino-qa@example.com" },
    include: { lead: true },
  });

  if (!contact) {
    console.log("No matching QA test contact/lead found — nothing to clean up.");
    return;
  }

  const leadId = contact.leadId;
  console.log(`Found QA test lead ${leadId} (session ${contact.lead.sessionId}), contact ${contact.id}.`);

  const [bookingIntent, job] = await Promise.all([
    prisma.bookingIntent.findFirst({ where: { leadId } }),
    prisma.job.findFirst({ where: { leadId } }),
  ]);
  if (bookingIntent || job) {
    console.error("REFUSING: this lead has a BookingIntent or Job attached — not a clean isolated test record. Not deleting.");
    process.exit(1);
  }

  const snapshots = await prisma.quoteSnapshot.findMany({ where: { leadId } });
  const snapshotIds = snapshots.map((s) => s.id);
  const economicsSnapshots = snapshotIds.length
    ? await prisma.economicsSnapshot.findMany({ where: { quoteSnapshotId: { in: snapshotIds } } })
    : [];
  const attribution = await prisma.leadAttribution.findFirst({ where: { leadId } });
  const timing = await prisma.timingSelection.findFirst({ where: { leadId } });
  const consent = await prisma.consentEvidence.findMany({ where: { leadId } });

  console.log(
    `Deleting: 1 ContactInfo, ${economicsSnapshots.length} EconomicsSnapshot(s), ${snapshots.length} QuoteSnapshot(s), ${attribution ? 1 : 0} LeadAttribution, ${timing ? 1 : 0} TimingSelection, ${consent.length} ConsentEvidence, 1 Lead.`
  );

  await prisma.$transaction([
    prisma.contactInfo.delete({ where: { id: contact.id } }),
    ...(economicsSnapshots.length
      ? [prisma.economicsSnapshot.deleteMany({ where: { quoteSnapshotId: { in: snapshotIds } } })]
      : []),
    ...(snapshots.length ? [prisma.quoteSnapshot.deleteMany({ where: { leadId } })] : []),
    ...(attribution ? [prisma.leadAttribution.delete({ where: { leadId } })] : []),
    ...(timing ? [prisma.timingSelection.delete({ where: { leadId } })] : []),
    ...(consent.length ? [prisma.consentEvidence.deleteMany({ where: { leadId } })] : []),
    prisma.lead.delete({ where: { id: leadId } }),
  ]);

  console.log("PASS — QA test lead and its dependent rows removed from servino_dev.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
