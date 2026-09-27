# Launch Checklist

_Session H. The concrete, checkbox-driven pre-launch gate for
Servino's first real Toronto customer. See `docs/PROJECT_STATUS.md`
"CAN SERVINO ACCEPT THE FIRST REAL CUSTOMER TODAY?" for the current
honest answer as of the end of Session H._

## Infrastructure

- [ ] Production VPS provisioned (see `docs/PRODUCTION_DEPLOYMENT.md`
      for the architecture — single VPS running both Next.js and
      PostgreSQL, D045).
- [ ] Domain registered and DNS pointed at the VPS.
- [ ] Reverse proxy (Caddy or Nginx) configured, HTTPS issued and
      auto-renewing.
- [ ] Process manager (PM2 or systemd) configured to run the app and
      restart automatically on crash/reboot.

## Database

- [ ] Production PostgreSQL instance created.
- [ ] Three scoped roles created (`servino_app`, `servino_migrate`,
      `servino_backup`) — see `docs/PRODUCTION_DEPLOYMENT.md`
      "Database" for exact privileges. Not the local dev pattern of one
      superuser-equivalent role.
- [ ] `npm run db:migrate:deploy` run successfully against production
      using the `servino_migrate` role.
- [ ] Daily `pg_dump` backup cron configured, writing off-VPS (see
      `docs/BACKUP_RECOVERY.md`).
- [ ] A real `pg_dump`/`pg_restore` cycle verified against the actual
      production PostgreSQL install (the Session H drill verified the
      underlying extract/reload mechanism using Prisma directly,
      because `pg_dump`/`pg_restore` binaries aren't available in the
      local dev environment — see `docs/BACKUP_RECOVERY.md` "Restore
      drill result" for the full disclosure. This item verifies the
      actual production tool, which the local drill couldn't).

## Security

- [ ] `NODE_ENV=production npm run validate:env` passes with zero
      errors against the real production environment.
- [ ] CSP, security headers verified present in production responses
      (`curl -I https://<domain>/`) — see `docs/SECURITY_MODEL.md`
      "Session H."
- [ ] Full security regression suite passing (IDOR, money tampering,
      webhook verification, CSRF, mass assignment, races) — see
      `docs/PROJECT_STATUS.md` "Tests."
- [ ] Admin account bootstrapped with a real, unique password (never
      the value used during development/QA in this session).

## PayPal

- [ ] `PAYPAL LIVE` checklist in `docs/PAYMENTS.md` fully complete,
      **including** the checkout-approval-flow gap documented there
      (this blocks live payment regardless of credentials).
- [ ] PayPal Sandbox smoke test performed and passed.
- [ ] Live PayPal Business account verified, live credentials
      configured in production `.env`.
- [ ] Production webhook configured in the PayPal developer dashboard,
      pointed at `https://<domain>/api/webhooks/paypal`.

## Pricing

- [ ] A real, reviewed `PricingVersion` is `ACTIVE` for Toronto in
      production (`/admin/pricing`) — production never falls back to
      mock pricing (D026), so this is a hard requirement, not optional.
- [ ] Rates reviewed by the Owner as genuinely reasonable for a real
      Toronto launch (not left as an untouched placeholder).

## Tax/legal

- [ ] HST configuration confirmed correct for Ontario (13%, unchanged
      since Session E).
- [ ] Marketplace-facilitator tax treatment reviewed by an accountant
      — still flagged REQUIRES ACCOUNTANT/LEGAL CONFIRMATION as of
      Session H; get this resolved or explicitly accepted as a known
      risk before real revenue starts.
- [ ] Terms/Privacy pages reviewed by the Owner (ideally a lawyer) for
      accuracy on: payment collection, refunds, the manual-payout
      relationship with professionals, worker classification language.
- [ ] Worker classification approach reviewed — Servino's software
      doesn't determine this; a real determination is a legal/
      accounting question.

## Professionals

- [ ] At least 1 professional fully onboarded — see
      `docs/FIRST_PROFESSIONAL_CHECKLIST.md` completed for them.
- [ ] Their activation confirmed (real login tested).
- [ ] Payout method and details collected through a secure channel.

## Customer

- [ ] Full funnel walked through manually, end to end, against
      production (or a faithful pre-production check on the same
      infra) — see `docs/FIRST_REAL_JOB_RUNBOOK.md` "Customer side."
- [ ] Real PayPal Sandbox payment completed successfully (blocked
      until sandbox credentials exist — see `docs/PAYMENTS.md`).

## Admin

- [ ] Owner comfortable with the full admin workflow —
      `docs/ADMIN_OPERATIONS.md` and `docs/FIRST_REAL_JOB_RUNBOOK.md`
      "Admin side" read and understood.
- [ ] `/admin/launch` reviewed and understood — what it shows, what
      "Unknown" vs "$0" means, when actual contribution computes.

## Analytics

- [ ] Attribution verified surviving from landing page through to a
      real `Payment` record (verified structurally and by live query
      during Session H — see `docs/PROJECT_STATUS.md` "Session H —
      Analytics").
- [ ] Decide whether to configure real Meta/Google conversion pixel
      IDs before launch, or defer — placeholders exist in
      `.env.example`; nothing is wired in without them.

## Backups

- [ ] See "Database" above — daily backup cron running in production,
      verified with at least one real successful backup file before
      go-live.

## Monitoring

- [ ] `/api/health` reachable and returning `200` against production.
- [ ] An uptime monitor (or at minimum, a personal habit of checking
      `/api/health` and process-manager logs) in place.

## Operations

- [ ] `docs/FIRST_REAL_JOB_RUNBOOK.md` read start to finish by whoever
      will operate Admin day to day.
- [ ] Emergency stop and payment kill switch procedures (below)
      understood before they're ever needed under pressure.

## Smoke tests

- [ ] `node scripts/smoke-production.mjs https://<domain>` passes
      against production after the final pre-launch deploy.

---

## Go / No-Go gates

Any one of these is an automatic **NO-GO** — do not override:

- [ ] PayPal Sandbox not verified (or, once verified, the checkout-
      approval-flow gap in `docs/PAYMENTS.md` not yet closed).
- [ ] Production payment credentials invalid or `getPaymentProvider()`
      not confirmed resolving to `PayPalPaymentProvider` in the real
      deployed build.
- [ ] Database backups not configured or not tested against the real
      production PostgreSQL install.
- [ ] A production migration fails (`npm run db:migrate:deploy` exits
      non-zero) — fix and resolve per `docs/PRODUCTION_DEPLOYMENT.md`
      "Rollback strategy" before proceeding.
- [ ] No active `PricingVersion` for Toronto in production.
- [ ] No active, onboarded professional to actually offer a job to.
- [ ] Any webhook signature-verification test failing.
- [ ] Any critical/high-severity security test failing.
- [ ] `npm run build` failing.

If none of the above apply and every checkbox above this line is
checked: proceed to soft launch (below).

## Soft launch

Recommended, not optional-in-spirit: don't point high traffic or real
ad spend at Servino on day one.

- Start with 1–2 professionals, not all four at once.
- Start with small, controlled customer volume — organic/direct
  traffic, or a small, deliberately limited ad test (see "Ads" below).
- Keep operations fully manual and hands-on for the first several
  jobs — this is the point of the first-10-jobs framework
  (`docs/FIRST_10_PRICING_VALIDATION.md`, `docs/PROJECT_STATUS.md`
  "Next Business Milestone").

## Ads

Not launched from code, not integrated (no Meta Ads Manager API calls
exist anywhere in this codebase, and none should be added without a
separate, explicit decision). What Servino's architecture supports
today: UTM-parameter attribution surviving the full funnel (verified,
see `docs/PROJECT_STATUS.md`), and conversion-event placeholders
(`checkout_started`/`payment_created`/`payment_confirmed`) ready for a
real pixel once one is configured.

If/when the Owner runs paid ads:
- Use consistent, meaningful UTM parameters
  (`utm_source`/`utm_medium`/`utm_campaign`/`utm_content`/`utm_term`)
  per campaign — these are what `/admin/launch` and future attribution
  analysis depend on.
- Start with a small daily budget — this is a business decision for
  the Owner, never hard-coded into the application.
- Measure, per the funnel: CPC → landing page view → quote started →
  price viewed → checkout started → payment confirmed → actual CAC
  (`/admin/launch` "Actual CAC," once entered per job). This is
  exactly the loop `docs/FIRST_10_PRICING_VALIDATION.md` is built
  around.

## Emergency stop — new bookings

To stop new customers from booking new jobs, without taking the
marketing site offline:

1. Edit `src/lib/feature-flags.ts`, set `newBookings: false`.
2. Redeploy (`docs/PRODUCTION_DEPLOYMENT.md` "Deploy procedure," steps
   1–6 — realistically under a minute on the VPS).
3. Verify: attempting to submit a new project now returns "Servino
   isn't accepting new projects right now" instead of creating a Job.
   Existing in-progress customer sessions and the whole marketing site
   remain fully reachable.

To resume: flip it back to `true` and redeploy.

## Payment kill switch

To disable new payments immediately (e.g. a suspected payment bug),
without affecting existing payment history:

1. Edit `src/lib/feature-flags.ts`, set `paymentsEnabled: false`.
2. Redeploy.
3. Verify: `/quote/payment` now shows "Payment isn't available right
   now" instead of a working checkout form; `/api/lead/payment/
   create-order` returns `PAYMENTS_UNAVAILABLE` (503).
4. **Already-captured payments, refunds, and payout records remain
   fully readable** in `/admin/payments` and `/admin/payouts` — this
   flag only blocks *new* payment creation, never hides history.

Note: an already-approved-but-not-yet-captured PayPal order is
deliberately still allowed to complete its capture even with this flag
off (see `docs/PAYMENTS.md` "The customer flow") — this avoids
stranding a customer mid-payment; the flag stops *new* attempts, not
in-flight ones.

## Professional capacity

With only 1–4 professionals, demand can outstrip capacity fast. No
automatic capacity/queueing algorithm exists or is planned for this
phase (explicitly out of scope, spec section 53). If you're getting
more paid jobs than your current professionals can handle:

1. Use the "Emergency stop — new bookings" procedure above.
2. Onboard another professional (`docs/FIRST_PROFESSIONAL_CHECKLIST.md`).
3. Resume bookings.

This is a manual, Owner-judgment process by design.
