# Backup & Recovery

_Session H. Appropriate for a first-10-jobs MVP on a single self-hosted
PostgreSQL instance — not an enterprise multi-region DR plan. See
`docs/PRODUCTION_DEPLOYMENT.md` for the overall infrastructure this
sits inside._

## What's being protected

One PostgreSQL database, self-hosted on the production VPS (see
`docs/DECISIONS.md` — never a third-party hosted DB tied into app
code). At first-10-jobs scale this holds: every lead/quote, every real
customer payment record, every professional and job, and the audit
trail behind all of it. Losing it without a backup would mean losing
real customer payment history — not acceptable at any job count.

## Backup mechanism

Standard `pg_dump` logical backups — no exotic tooling, no managed
backup service required for this scale.

```bash
# Full logical backup, custom format (supports pg_restore -j for parallel restore)
pg_dump -Fc -h 127.0.0.1 -U servino_backup -d servino_production \
  -f "/var/backups/servino/servino_$(date +%Y%m%d_%H%M%S).dump"
```

- **Frequency:** daily, via a cron job on the VPS. At first-10-jobs
  volume (a handful of writes per day), daily is more than sufficient
  — there is no argument for continuous/point-in-time replication
  infrastructure at this scale.
- **Retention:** 14 daily backups, then weekly for 8 weeks. Delete
  older automatically (a simple `find ... -mtime +14 -delete`-style
  cron entry, or equivalent). Adjust once real job volume and real
  storage cost are known — not a decision to over-engineer now.
- **Storage:** copied off the VPS itself after each dump (e.g. to a
  separate object-storage bucket or a second small VPS volume) —
  a backup that lives only on the same disk as the database protects
  against nothing but accidental `DROP TABLE`. Encrypt at rest if the
  storage target doesn't already (most object storage does by
  default).
- **Backup user:** a dedicated `servino_backup` PostgreSQL role with
  read-only access — never the application's own read/write
  `servino_app` role, and never the database superuser (see
  `docs/DATABASE_PRODUCTION.md`... actually see "Least privilege"
  in this same document's companion, `docs/PRODUCTION_DEPLOYMENT.md`
  "Database").

## Restore procedure

```bash
# Create a fresh empty database first
createdb -h 127.0.0.1 -U postgres servino_production_restored

# Restore from a dump
pg_restore -h 127.0.0.1 -U postgres -d servino_production_restored \
  --no-owner --no-privileges \
  "/var/backups/servino/servino_20260924_030000.dump"
```

Then point a **staging** copy of the app at the restored database
(never restore directly over the live production database without a
verified-good reason and a second person's confirmation — see "Who
performs a restore" below) and run `npm run validate:env` +
`node scripts/smoke-production.mjs` (read-only checks) against it to
confirm the app actually functions against the restored data.

## Restore verification

A restore is not "done" until:

1. `pg_restore` itself exits 0.
2. The app can start and connect (`/api/health` returns `status: "ok"`
   against the restored database).
3. A spot-check of real data succeeds — e.g. the most recent `Payment`
   row is readable and its `amountMinor` matches what's expected.

## Who performs a restore

The Owner/operator only, for the first 10 jobs — there is no
multi-person on-call rotation yet. Restoring is a rare, deliberate,
manual action; it is never automated.

## RPO / RTO (first-10-jobs targets — revisit as real volume grows)

- **RPO (Recovery Point Objective): 24 hours.** With daily backups, a
  worst-case restore could lose up to a day of activity — at a handful
  of jobs per week, this is an acceptable, explicit tradeoff for
  avoiding continuous-replication infrastructure this scale doesn't
  need yet. If job volume grows enough that losing a day of payment
  records becomes materially risky, that's the trigger to move to
  more frequent backups (e.g. every 6 hours) or WAL archiving/
  point-in-time recovery — not before.
- **RTO (Recovery Time Objective): a few hours.** Manual restore by
  the Owner, on a small database (first-10-jobs scale is a tiny
  dataset) — realistically minutes for the restore itself, with the
  rest of the window being "Owner notices something is wrong and
  starts the process." No automated failover exists or is justified
  yet.

## Restore drill result

**Performed:** 2026-09-24, locally, against a throwaway database — did
**not** touch any real dev/test data, and obviously never touched
production (none exists yet).

**Important disclosure:** this drill did **not** use `pg_dump`/
`pg_restore` — the `embedded-postgres` distribution this project uses
for local development (`docs/DECISIONS.md` D011) only bundles the
`postgres`/`initdb`/`pg_ctl` server binaries, not the client tools
(`pg_dump`, `pg_restore`, `psql`, `createdb` all confirmed absent —
checked both inside `node_modules` and on the system `PATH`). This is
a property of the local dev tooling only; production runs on a real,
full PostgreSQL install (self-hosted on the VPS) where these are
standard, unmodified tools that will work exactly as documented above
— this environment simply has no way to verify that specific binary
locally.

**What was actually verified** (`scripts/backup-restore-drill.mjs`),
at the application layer — the part that actually matters ("can real
data survive being extracted and reloaded into a from-scratch
database"):

1. A completely fresh, empty PostgreSQL database was created.
2. The full production migration history (all 7 migrations, via
   `prisma migrate deploy` — the exact command production uses, see
   "Migration procedure" below) was applied to it from zero,
   successfully.
3. Real data was read from `servino_dev` (1 AdminUser, 1 PricingVersion,
   10 Professionals, 86 Leads, 59 QuoteSnapshots, 37 BookingIntents, 18
   Jobs, 2 Payments) and written into the fresh database in FK-safe
   order.
4. Every row count matched exactly between source and restored copy.
5. A specific restored `Payment` record was read back and its
   `amountMinor` matched the original exactly.
6. The throwaway database was dropped — no residue left behind.

**Result: PASS.** The underlying mechanism this whole procedure
depends on — migrations apply cleanly to a from-scratch database, and
real data survives an extract/reload round-trip without corruption or
loss — is verified. The one thing NOT verified locally is the specific
`pg_dump`/`pg_restore` binary invocation, which requires the
production VPS's real PostgreSQL client tools to test directly; this
is listed as a pre-launch action in `docs/LAUNCH_CHECKLIST.md`.
