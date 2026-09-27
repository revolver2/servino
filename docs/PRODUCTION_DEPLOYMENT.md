# Production Deployment

_Session H. How Servino actually gets deployed for the first-10-jobs
Toronto launch — architecture, environments, and the exact procedure.
Not a hypothetical enterprise plan; sized for one operator and a
handful of real jobs._

## Architecture decision: single VPS, not split Vercel + VPS

The default assumption going into Session H was a split architecture
(Next.js on Vercel, PostgreSQL + Redis on a VPS). **That was audited
and deliberately not adopted for launch.** Reasoning:

Servino's rate limiting (`src/lib/server/rate-limit.ts`) is an
in-memory, single-process fixed-window counter — it protects admin
login, professional login, payment creation/capture, refunds, payout
recording, and completion confirmation. On Vercel's serverless model,
function invocations are not guaranteed to share memory or even land
on the same instance; the in-memory counter would silently stop
protecting these endpoints some (unpredictable) fraction of the time.
That is a real, concrete regression — not a style preference — and
"do not force architecture changes unnecessarily" (spec section 8)
cuts against introducing it for launch.

**Decision: the whole app — Next.js and PostgreSQL — runs on one VPS**
for the first-10-jobs launch. This keeps the existing rate limiter
correct (one process, one shared memory space) with zero new
infrastructure, keeps operations simple for a solo operator (one
server, one deploy target), and is still a completely standard,
real production deployment — not a hack.

```
                    ┌─────────────────────────────────────┐
Internet ── HTTPS ──┤  VPS                                  │
                    │  ┌─────────────┐   ┌───────────────┐  │
                    │  │ Caddy/Nginx │──▶│ Next.js        │  │
                    │  │ (TLS term.) │   │ (next start,   │  │
                    │  └─────────────┘   │  PM2/systemd)  │  │
                    │                    └───────┬───────┘  │
                    │                            │          │
                    │                    ┌───────▼───────┐  │
                    │                    │  PostgreSQL    │  │
                    │                    │  (local)       │  │
                    │                    └───────────────┘  │
                    └─────────────────────────────────────┘
```

**When to revisit this:** if real traffic ever genuinely outgrows one
VPS (not a launch-phase concern), the migration path is: implement a
Redis-backed rate limiter (see `docs/DECISIONS.md` "Rate limiting"),
provision Redis, then Vercel becomes a real option for the Next.js
half while PostgreSQL (and Redis) stay on a VPS. Not needed now, not
built now.

## What runs where

| Component | Where | Why |
|---|---|---|
| Next.js app (customer/admin/pro/APIs) | VPS, `next start` under PM2 or systemd | Needs the in-memory rate limiter's single-process guarantee (see above) |
| PostgreSQL | Same VPS, local | Zero network latency to the app; no third-party hosted DB tied into app code (existing project decision) |
| TLS termination / reverse proxy | Same VPS, Caddy or Nginx | Caddy is the simpler choice (automatic Let's Encrypt renewal, minimal config) |
| Static assets | Served by Next.js itself | No separate CDN required at this traffic volume |

## Environments

- **LOCAL** — a developer's own machine. `embedded-postgres` (no admin
  rights needed), `next dev`, always `TestPaymentProvider` regardless
  of any PayPal env vars (see `docs/PAYMENTS.md`).
- **TEST** — the isolated `servino_test` database + `next dev` on port
  3100, used only by the committed Playwright suite
  (`npm run test:e2e`). Never touched by a human directly.
- **PRODUCTION** — the VPS described above, real PostgreSQL, real (or
  intentionally-unconfigured-and-fail-closed) PayPal credentials.

**No separate staging environment.** Deliberately not built — spec
section 10's own instruction not to add staging infrastructure solely
for architecture purity. If a pre-production check is ever needed
(e.g. testing a real PayPal sandbox flow before flipping to live), use
a second subdomain on the *same* VPS pointed at a separate database,
not a whole parallel environment. Revisit if the operation ever
outgrows this.

## DNS & domain

No production domain is hard-coded anywhere in this codebase — it's
entirely driven by `NEXT_PUBLIC_SITE_URL` (validated by
`src/lib/server/env.ts`/`scripts/validate-production-env.mjs`, which
refuse to consider a production build "safe" if this points at
localhost or isn't `https://`). Whatever real domain the Owner
registers:

1. Point an `A` (or `AAAA`) record at the VPS's IP.
2. Set `NEXT_PUBLIC_SITE_URL=https://<real-domain>` in production.
3. Configure the reverse proxy (Caddy/Nginx) for that domain — Caddy
   handles Let's Encrypt TLS issuance automatically once the domain
   resolves to it; Nginx + certbot needs one extra manual step.

## HTTPS

Caddy (recommended) or Nginx + certbot — either issues and
auto-renews a Let's Encrypt certificate once DNS points at the VPS.
`Strict-Transport-Security` is already sent by the app itself in
production (`next.config.ts`) — the reverse proxy doesn't need to add
it separately (avoid setting it in two places, spec section 20).

## Database

**PostgreSQL version:** any current stable release (16 or 17) —
nothing in this codebase depends on a specific minor version.

**Connection pooling:** Prisma's own client-side connection pool
(`src/lib/server/prisma.ts`'s singleton `PrismaClient`) is sufficient
at first-10-jobs traffic — a single Next.js process on the VPS (D045)
means there's exactly one pool to reason about, not N serverless
instances each opening their own. No PgBouncer or external pooler is
needed at this scale; revisit only if real connection-count pressure
is ever observed (`SELECT count(*) FROM pg_stat_activity`).

**SSL:** since the app and database run on the *same* VPS (D045),
the connection between them never leaves the machine — `DATABASE_URL`
can reasonably omit `sslmode=require` for this specific same-host
case. If the database is ever moved to a separate host, add
`?sslmode=require` (or stronger) to `DATABASE_URL` at that time —
don't send unencrypted DB traffic across a network boundary.

**Least privilege — production database roles:**

| Role | Used by | Privileges |
|---|---|---|
| `servino_app` | The running application (`DATABASE_URL`) | `SELECT`/`INSERT`/`UPDATE`/`DELETE` on all app tables. No `DROP`/`CREATE`/`ALTER` — migrations run under a separate role. |
| `servino_migrate` | `prisma migrate deploy` only, run manually/via deploy script, never by the running app | Full DDL rights on the app schema. Not the credential in the app's own `.env`. |
| `servino_backup` | The backup cron job (`docs/BACKUP_RECOVERY.md`) | Read-only (`SELECT` on all tables). Never write access. |
| PostgreSQL superuser (`postgres`) | Initial setup and the backup/restore drill's `CREATE DATABASE` step only | Never used by the running app or by routine backups. |

This is a real, not yet provisioned, production requirement — local
dev (`embedded-postgres`) uses a single `servino` superuser-equivalent
role for simplicity (no real data at risk locally); production should
not reuse that pattern. Creating these three scoped roles is a
pre-launch action (see `docs/LAUNCH_CHECKLIST.md`).

**Test/dev isolation:** already true by construction — `servino_dev`
and `servino_test` are separate databases even locally (`scripts/
dev-db.mjs`, `tests/e2e/global-setup.ts` hard-codes `servino_test`
regardless of any inherited `DATABASE_URL`). Production is a third,
entirely separate PostgreSQL instance on the VPS — no environment ever
shares a database with another.

## Migrations

**Never** `prisma migrate dev` against production — that command can
prompt for destructive resets and is meant for local development only.
Production always uses:

```bash
DATABASE_URL="postgresql://servino_migrate:...@127.0.0.1:5432/servino_production" \
  npx prisma migrate deploy   # also available as: npm run db:migrate:deploy
```

This applies any pending migrations in order and does nothing if the
database is already up to date — safe to run on every deploy, using
the scoped `servino_migrate` role (above), not the app's own runtime
credential.

**Rollback strategy:** Prisma migrations are forward-only by design —
there is no `prisma migrate down`. If a migration needs to be undone:

1. **Preferred:** write a new, forward migration that reverses the
   change (e.g. drops a column a previous migration added). This keeps
   the migration history truthful and linear — never edit or delete an
   already-applied migration file.
2. **If a migration partially failed mid-apply** (the P3018 error
   state — this project hit this once already this session, see
   `docs/PROJECT_STATUS.md` "Bugs Found," resolved locally): fix the
   underlying data/schema issue, then `prisma migrate resolve
   --rolled-back <migration-name>`, then re-run `migrate deploy`. This
   is exactly what happened locally when the refund-race-guard index
   collided with pre-existing duplicate test data — the same procedure
   applies in production if it ever recurs.
3. **Last resort, data-loss risk:** restore from the most recent
   backup (`docs/BACKUP_RECOVERY.md`) and re-apply migrations up to
   (but not past) the problematic one. Only after the above two
   options are ruled out.

## Secrets

Live only in a `.env` file on the VPS (or your process manager's own
env-injection mechanism), never committed — `.env*` is gitignored
project-wide (verified during the Session H secret scan, see
`docs/PROJECT_STATUS.md`). Required production variables are
documented in `.env.example`; `npm run validate:env` (with
`NODE_ENV=production`) is a hard pre-deploy gate — see
`scripts/validate-production-env.mjs`.

**Important, verified empirically during Session H:** `NEXT_PUBLIC_*`
variables (`NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_USE_MOCK_PRICING`) are
baked into the compiled bundle **at `npm run build` time** — changing
one and only restarting the running process (without rebuilding) has
no effect, even on server-side code that reads it via
`process.env.NEXT_PUBLIC_SITE_URL`. This is standard Next.js behavior,
not a Servino-specific quirk, but it's a real, easy mistake to make.
Practical implication: keep the production `.env` file in place
*before* running `npm run build` (the "Deploy procedure" below already
orders `validate:env` and `build` this way) — if you ever change
`NEXT_PUBLIC_SITE_URL` (e.g. a domain change) on an already-deployed
instance, a plain restart is **not enough**; you must rebuild.

## PayPal

See `docs/PAYMENTS.md` in full. Summary: `PAYPAL_ENV`,
`PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`, `PAYPAL_WEBHOOK_ID` all set
in the production `.env`, or the app fails closed (never fabricates
payment success — `UnavailablePaymentProvider`).

## Webhooks

PayPal webhook callback URL in production:
`https://<real-domain>/api/webhooks/paypal`. Configure this in the
PayPal developer dashboard against the exact same webhook whose ID
becomes `PAYPAL_WEBHOOK_ID` — see `docs/PAYMENTS.md` "Sandbox
verification" for the exact event-subscription list.

## Backups

See `docs/BACKUP_RECOVERY.md` in full — daily `pg_dump`, 14-day
retention, restored copy verified against the running app before ever
restoring over a live database.

## Monitoring / health checks

`GET /api/health` — returns `200` with `{"status":"ok",...}` when the
app is up, the database is reachable, and production config is valid;
`503` otherwise. Point your process manager's health check (PM2 has
one built in) or an external uptime monitor (UptimeRobot, Better
Uptime, etc. — free tiers exist; no specific one is integrated or
required) at this endpoint.

## Observability (spec sections 28–30)

Deliberately minimal — no monitoring platform was integrated or is
recommended at first-10-jobs scale. Audited what already exists and
what's actually missing:

**Already true, verified during this session's audit:**
- No API route ever returns a raw exception message, stack trace, SQL
  error, or provider secret to the client (grepped for `err.message`/
  `err.stack` across every route — zero matches outside internal
  `console.error` calls). Every client-facing error goes through the
  closed `apiError`/`adminApiError`/`proApiError` code sets (spec
  section 40, unchanged since Phase A).
- Every financial state change is already independently visible
  through two real, queryable records: `AuditEvent` (actor + action +
  entity) and, for payments specifically, `PaymentEvent` (append-only,
  provider-sourced). Both are keyed by real entity IDs (`Payment.id`,
  `Job.id`, `Payout.id`, `Refund.id`) — these IDs are what correlate a
  server log line to a specific financial record, and every
  `console.error` call in the payment/webhook/payout/refund routes
  already includes the relevant entity ID in its logged context. A
  separate synthetic "request ID" system was considered and not
  added — it would duplicate correlation the entity IDs already
  provide, for no added visibility.
- Failed payments (`PAYMENT_FAILED` audit events), failed/rejected
  webhooks (`console.error`/`console.warn` in
  `src/app/api/webhooks/paypal/route.ts`, with the rejection reason —
  never persisted to the database, deliberately: an invalid-signature
  webhook is unverified by definition and shouldn't create a durable
  record tied to real data), and reconciliation failures (surfaced
  synchronously to the admin who clicked "Reconcile," not silently
  swallowed) are all already visible through existing mechanisms.

**What's genuinely missing, and the documented integration point for
it:** structured application logs currently go to stdout/stderr only
(whatever your process manager captures — `pm2 logs`, journald, etc.).
There is no external error-tracking/alerting service (Sentry or
similar) wired in. Adding one is a real, scoped future task, not
attempted this session because it requires an actual account/DSN this
environment doesn't have — the integration point is a single line in
a future `instrumentation.ts` (Next.js's own hook for this) plus a
`SENTRY_DSN`-shaped env var (placeholder in `.env.example`). Until
then: **the Owner's actual monitoring is `/api/health` + reading
`pm2 logs`/`journalctl` directly when something looks wrong** — a
real, honest limitation for a first-10-jobs solo operation, not a gap
disguised as a feature.

## Smoke testing

`node scripts/smoke-production.mjs <base-url>` — read-only by default,
never charges real money. Run it after every deploy before considering
it successful. Full detail in `docs/LAUNCH_CHECKLIST.md`.

## Deploy procedure (first launch and every subsequent deploy)

1. `git pull` on the VPS (or your chosen deploy mechanism).
2. `npm ci` (clean install from the lockfile).
3. `NODE_ENV=production npm run validate:env` — must PASS before
   continuing.
4. `npm run db:migrate:deploy`.
5. `npm run build`.
6. Restart the process manager (`pm2 restart servino` or
   `systemctl restart servino`).
7. `node scripts/smoke-production.mjs https://<real-domain>` — must
   PASS.
8. Confirm `GET /api/health` returns `200`.

This same procedure — steps 1–6 — is also the "emergency stop"
mechanism for flipping a feature flag (`docs/LAUNCH_CHECKLIST.md`
"Emergency stop"): edit `src/lib/feature-flags.ts`, then redeploy.
