# Project Status

_Session H0.1 — Pre-Launch UX, Truthfulness & Funnel Correctness Fixes.
Last updated: 2026-09-25. See "Session H0.1" below for the newest
report; "Session H Completed" onward is the prior, still-accurate
production-readiness report._

## Session H0.1 — Pre-Launch UX, Truthfulness & Funnel Correctness Fixes

A small corrective session, not a continuation of Session H's
production-launch scope: fixed ten customer-facing defects found during
manual QA before launch work continues. No PayPal work, no new
marketplace features, no redesign — see `docs/DECISIONS.md` D048.

**1. Homepage/funnel copy overclaimed functionality.** "Choose your
professional" (implies customer-facing selection, which doesn't exist),
"Track everything in one place" and "Messaging, scheduling, and updates
happen in one place" (no messaging/scheduling/tracking system exists)
were all corrected to describe what Servino actually does today —
Servino connects the customer with a professional and coordinates the
project on their behalf, nothing more. `src/components/home/HowItWorks.tsx`,
`Trust.tsx`, `Hero.tsx`.

**2. Contact page had no real support contact.** Was a permanent
placeholder ("details will be published here"). Now reads
`SUPPORT_EMAIL` (server-only env var, never baked into the client
bundle) and shows a real `mailto:` link once configured, or the same
honest placeholder if not — never a fabricated address.
`src/lib/server/support-contact.ts`, `src/app/(marketing)/contact/page.tsx`.
**Real finding:** this page would otherwise be statically prerendered,
baking `SUPPORT_EMAIL` in at build time — fixed by forcing it dynamic
(`export const dynamic = "force-dynamic"`) so an owner can set the env
var and restart, without a full rebuild. **OWNER ACTION REQUIRED:** no
real Servino support email exists in this environment — `SUPPORT_EMAIL`
is unset; the Contact page currently shows the honest placeholder.

**3. Measurement unit switching destroyed entered dimensions.** A real
bug: switching Imperial↔Metric cleared width/height to null instead of
converting them. Fixed with a real length converter
(`convertLength`/`convertWallDimension`, `src/lib/quote/units.ts`) — 10ft
→ ~3.05m, round-trips back to ~10.01ft (negligible display-rounding
drift, not corruption). 5 new regression tests in
`tests/e2e/measurements.spec.ts` (round trip, empty fields, decimals,
repeated switching, no NaN/Infinity).

**4. Footer/Header homepage-section links broke from other routes.**
`href="#services"` resolved relative to the current page (`/privacy` →
`/privacy#services`, a dead link). Fixed by prefixing with `/`
(`/#services`) in both `Footer.tsx` and `Header.tsx`.

**5. Service card clicks didn't preselect the right service.** A
homepage card click carried no information about which service was
clicked at all (`href="/quote"`, no param) — the funnel silently fell
back to whatever service a returning session already had stored. Fixed:
cards now link to `/quote/project?service=<slug>`, and
`ProjectLocationStep` gives an explicit, just-clicked service priority
over stale session state. 7 new tests in `tests/e2e/service-selection.spec.ts`
covering all four services plus explicit-override scenarios.

**6/7. "Continue to Booking" overstated the next step.** Changed to
"Continue with this estimate" plus explanatory subtext making clear
payment and confirmation are still required. Terminology audited across
the funnel (booking/booked/confirmed/appointment) — the rest was
already accurate; only this one CTA and one Trust-section line
("before you book" → "before you request it") needed correction.

**8. A real console error, not dev-tooling noise.** Session H's CSP
omitted `'unsafe-eval'` in every environment, reasoning it would "just
log a harmless console warning." Real QA showed a genuine error
("eval() is not supported... React requires eval() in development
mode"), and Next's own CSP docs explicitly recommend enabling
`'unsafe-eval'` in dev for exactly this reason. Fixed: included only
when `NODE_ENV !== "production"` — verified zero console errors in both
dev and production mode afterward, and verified the production CSP
still excludes `unsafe-eval` (unchanged security posture). `next.config.ts`.

**9. Terms/Privacy contradicted the actual product.** Terms still said
"does not include... in-app payment" — false since Session G added real
PayPal payment collection. Privacy said "we do not ask for or collect
payment information... through this quote tool" — misleading given
payment now happens through the quote tool (even though Servino itself
never receives raw card data). Both rewritten to accurately describe
the current payment flow, without performing speculative legal
rewriting or removing the "pending formal legal review" disclaimers.

**10. Image strategy — no code change, doc only.** No fabricated
photography was introduced anywhere. `docs/IMAGE_ASSET_REQUIREMENTS.md`
extended with a concrete launch shot list and explicit REAL SERVINO
PROJECT / LICENSED STOCK / ILLUSTRATIVE-GENERATED provenance labels.

**Bug found during this session's own QA, fixed:** a pre-existing
horizontal-overflow bug on `/privacy` at 360px — an unbreakable long
filename inside a `<code>` tag, combined with `<main>`'s flex layout,
forced the page content wider than the viewport. Fixed with `min-w-0`
on the three marketing pages' shared content container
(`privacy`/`terms`/`contact`), the standard fix for flexbox's automatic
minimum-size behavior — not previously caught because responsive QA
had not specifically checked `/privacy` at 360px before.

**Tests:** baseline 173/173 (Session H) → 184/184 (+11: `measurements.spec.ts`
net +4 after replacing one now-incorrect test — "switching units clears
values" — with 5 new tests asserting the correct conversion behavior;
`service-selection.spec.ts` is new, +7 tests). One previously-known-flaky
test, `admin-professionals.spec.ts`, passed cleanly on this run's full
suite. Typecheck clean, lint clean (0 errors, same 7 pre-existing
warnings), production build clean, zero axe-core violations, zero
responsive overflow at any required breakpoint (360/390/430/768/1440)
on every modified surface, verified in both dev and production server
modes.

## Session H Completed

Session H did not add marketplace features — it made Servino safe and
practical to actually launch with a real Toronto customer, and gave
the owner a real operating system for getting through the first 10
paid jobs. Production architecture is decided and documented (D045),
environment configuration fails closed instead of silently booting
unsafe (`src/lib/server/env.ts`), security headers now include a real
CSP (`docs/SECURITY_MODEL.md` "Session H"), backups have a real
(if application-layer, honestly disclosed) restore drill, a real
`/api/health` endpoint exists, dead feature flags are now real
enforced kill switches, actual per-job economics can be recorded and
compared against Session E's estimates, and `/admin/launch` gives the
owner a single "X/10" milestone dashboard. No automatic matching, no
AI, no SMS/email automation, no RingDesk, no automated payouts, no
PayPal Multiparty — all explicitly and deliberately untouched, per the
spec's own out-of-scope list (`docs/DECISIONS.md` D045–D047).

## Production architecture (D045)

**Single VPS running Next.js + PostgreSQL together**, not a
Vercel(frontend)+VPS(database) split. Reason: this app's rate limiter
(`src/lib/server/rate-limit.ts`) is in-memory and single-process —
correct and sufficient for one long-running Node process, silently
wrong under Vercel's serverless model where each invocation can be a
fresh process with no shared memory, which would make every rate
limit a no-op in practice without anyone noticing until real abuse
hit. Rather than introduce a Redis dependency and split infrastructure
just to preserve the "Vercel" default, Session H kept everything on
one VPS where the existing, tested limiter is genuinely correct. Full
reasoning, cost estimates, and DNS/deploy runbook in
`docs/PRODUCTION_DEPLOYMENT.md`; sourced VPS pricing in
`docs/INFRASTRUCTURE_COST_MODEL.md` (Hetzner ~€7.72/mo, DigitalOcean
~$7–24 USD/mo, both real quotes with retrieval dates cited).

## Environment / secrets

`checkProductionEnv()` (`src/lib/server/env.ts`) plus a plain-JS mirror
(`scripts/validate-production-env.mjs`, `npm run validate:env`) refuse
to consider a production boot safe unless `DATABASE_URL` is real and
non-local, `NEXT_PUBLIC_SITE_URL` is real, non-local, and `https://`,
and mock pricing is off. Verified against 10 explicit failure
scenarios (`scripts/verify-production-config-failclosed.mjs`, all
passing). A full repo secret scan found nothing committed beyond
known local-dev-only defaults. **Real finding, documented, not
silently worked around:** `NEXT_PUBLIC_*` variables are baked into the
client bundle at `npm run build` time, not read at request time —
verified empirically by rebuilding with different values; a
restart-only env change has zero effect. `docs/PRODUCTION_DEPLOYMENT.md`
"Secrets" now documents the correct deploy ordering.

## Security headers / CSP

Full `Content-Security-Policy` added (PayPal domains allow-listed,
`'unsafe-inline'` for script/style, never `unsafe-eval`), plus
conditional HSTS, alongside the four headers already in place since
Phase C. **A nonce+`strict-dynamic` approach was tried first and
reverted** after real-browser (not just curl) testing showed it broke
this app's statically-rendered pages — nonces only work with dynamic
rendering, and most Servino routes are deliberately static. Re-verified
zero violations across 5 pages plus an interactivity test after
switching to Next's documented "without nonces" pattern. Full detail
in `docs/SECURITY_MODEL.md` "Session H."

## Rate limiting

**No change to the mechanism — confirmed correct, not left unaddressed
(D046).** Given D045 (single VPS, single process), the existing
in-memory limiter is already the right architecture; no Redis
dependency was introduced. A fail-closed recommendation for a future
shared-store limiter (reject rather than silently allow if the store
is unreachable, for sensitive endpoints) is documented but not built,
since no such dependency exists yet to need it.

## Database / backups

Production database procedure (pooling, SSL, role separation,
migration rollback strategy referencing the real P3018 incident from
an earlier session) documented in `docs/PRODUCTION_DEPLOYMENT.md`.
**Backup/recovery honestly disclosed gap:** `pg_dump`/`pg_restore`/`psql`
are not present anywhere in this development environment (only the
`embedded-postgres`-bundled `postgres`/`initdb`/`pg_ctl`). Rather than
fake a `pg_dump` test or silently skip the requirement,
`scripts/backup-restore-drill.mjs` performs a real, meaningful
application-layer drill instead — creates a fresh database, runs
`prisma migrate deploy` from zero, copies every table in FK-dependency
order, verifies row counts and a sample record, cleans up. **Ran
successfully, PASS**, exact counts documented in
`docs/BACKUP_RECOVERY.md` alongside full disclosure of exactly what
this does and doesn't verify compared to a real `pg_dump`/`pg_restore`
production drill.

## Health / observability

New `GET /api/health` — `app`/`database`/`config` checks, response
time, errors/warnings, JSON. Deliberately never requires PayPal
configuration to report healthy (that's a payments-specific concern,
surfaced separately). Existing error-handling/correlation-ID patterns
audited, found already consistent; no changes needed.

## Analytics / conversion tracking

New browser-side events (`checkout_started`, `payment_created`,
`payment_confirmed`) added to the existing PII-free `AnalyticsAdapter`
union — a leak is a compile error, not a code-review miss, same
guarantee as every prior session's analytics work. **Deliberately kept
separate from the existing `AuditEvent` system**: operational/internal
events (job offered/accepted/completed/confirmed) stay in
`AuditEvent`, never duplicated into the ad-facing adapter, so no
internal business data (compensation, margins, professional identity)
ever reaches a third-party ad pixel through this path.

## First-10-jobs economics (real, not estimated)

New `JobActuals` model (nullable-by-default, one row per job) plus an
admin form for entering real material cost, CAC, and other variable
cost per job — see `docs/UNIT_ECONOMICS.md` "Session H." Session E's
original `EconomicsSnapshot` estimate is never overwritten. Actual
contribution profit is only computed and shown once payout is `PAID`
**and** both material cost and CAC are entered — strict on purpose, so
`/admin/launch` never shows a number built from an assumed zero.

## `/admin/launch` dashboard

New page: "X/10" milestone hero with progress bar, 12 real-data metric
cards, a missing-actuals callout, and a per-job estimate-vs-actual
table. Verified against a genuinely fresh database
(`scripts/fresh-db-lifecycle-drill.mjs`) driving the entire real
lifecycle — admin login → pricing setup → professional activation →
customer funnel → payment → offer → accept → field workflow →
completion → confirmation → payout recorded → actuals entered — and
confirming the dashboard correctly showed **1/10**. Screenshot:
`docs/qa/session-h/fresh-db-launch-1-of-10.png`.

## Feature flags — now real kill switches

`acceptNewProfessionals`, `newBookings`, and `paymentsEnabled`
(`src/lib/feature-flags.ts`) were dead config before Session H — now
each is checked server-side at its relevant mutation route
(`/api/admin/professionals`, `/api/lead/booking-intent`,
`/api/lead/payment/create-order`) and flipping one to `false` and
redeploying actually blocks the action, with a truthful user-facing
message rather than a generic error (D047). No live-toggle admin UI —
changing a flag means editing the file and redeploying, an accepted
tradeoff at this scale. This is the mechanism `docs/LAUNCH_CHECKLIST.md`
"Emergency stop" and "Payment kill switch" procedures rely on.

## Operational docs (new)

`docs/FIRST_PROFESSIONAL_CHECKLIST.md`, `docs/FIRST_10_PRICING_VALIDATION.md`,
`docs/FIRST_REAL_JOB_RUNBOOK.md`, `docs/LAUNCH_CHECKLIST.md`,
`docs/INFRASTRUCTURE_COST_MODEL.md`, `docs/PRODUCTION_DEPLOYMENT.md`,
`docs/BACKUP_RECOVERY.md` — all new this session, all written from the
actual current system, not aspirational.

## Testing

Baseline before Session H: 173/173 passing. Session H added no new
Playwright spec files (it is a hardening/operational session, not a
new-feature session) but added standalone verification scripts run
directly, all passing: `scripts/validate-production-env.mjs`,
`scripts/verify-production-config-failclosed.mjs` (10/10 scenarios),
`scripts/backup-restore-drill.mjs`, `scripts/fresh-db-lifecycle-drill.mjs`,
`scripts/smoke-production.mjs`, `scripts/qa-axe-check-session-h.mjs`
(0 violations, 8 pages), `scripts/qa-responsive-overflow-session-h.mjs`
(0 overflow, all required breakpoints). Full 173-test Playwright suite
re-run clean; one isolated flaky failure
(`pro-workflow.spec.ts` "Problem reports... XSS inert", a `429` from
full-suite-serial rate-limit contention) reproduced and confirmed
**not** a Session H regression by rerunning that spec file alone (all
7 passed).

## Lighthouse spot-check

Production build, `/`, `/toronto/wall-makeover`, `/quote/project`: all
three score **Performance 97, Accessibility 100, Best Practices 100,
SEO 100**. LCP ~2.5–2.6s, CLS 0, TBT 70–80ms. No meaningful regression
to investigate — per the spec's own instruction not to obsess over a
perfect 100.

## Accessibility

`axe-core`, zero violations across all 8 Session H-relevant surfaces:
homepage, Toronto landing, quote entry, checkout, completion
confirmation, `/admin/launch`, `/admin/payments`, professional job
detail.

## Responsive

No horizontal overflow at any required breakpoint: customer 360/390/
430/768/1440, professional 360/390/430/768, admin 768/1024/1440
(including `/admin/launch` specifically).

## Build

`npx tsc --noEmit` clean. `npx eslint src` clean (same pre-existing
warning pattern as prior sessions, not new). Production build
(`npm run build`) succeeds and was used directly for the CSP
real-browser verification and the Lighthouse spot-check.

## Bugs found this session (and fixed, not hidden)

The CSP nonce approach itself was a self-introduced near-miss, caught
before shipping: implementing Next's own documented nonce pattern
broke static-page script execution across every route tested in a
real browser. Root-caused, reverted to the correct documented
alternative, re-verified. No other new correctness bugs found this
session (Session H is primarily audit/hardening/documentation work
against an already-tested codebase).

## Remaining gaps before the first real customer

**PayPal Sandbox: NOT VERIFIED.** No sandbox credentials were
available in this environment — unchanged since Session G. Steps and
exact requirements in `docs/PAYMENTS.md` "Sandbox verification."

**PayPal Live: NOT READY.** Requires the sandbox step above plus real
Business account credentials in production, **and** one newly
discovered gap: the checkout UI's "Pay with PayPal" flow needs the
actual PayPal JS SDK's redirect/approval flow wired in — the current
implementation exercises the server-side create/capture-order contract
correctly (verified via the deterministic test provider) but has not
been connected to PayPal's real hosted approval UI. Documented as the
first, blocking item in `docs/PAYMENTS.md` "Production activation
checklist."

**PayPal Multiparty / Payouts API: NOT USED, NOT VERIFIED.** Unchanged
since Session G (D039) — Mode B (manual payout) remains the only
supported mode. `automaticPayouts` stays `false`.

**Legal/accountant confirmations**, unchanged since Session E/G:
marketplace-facilitator HST/tax treatment for a manually-paid
professional, worker classification, and a real legal review of
Terms/Privacy payment language.

## First Real Paid Job Readiness

**Still blocked on, before taking the first real customer payment:**

1. PayPal sandbox credentials and a completed sandbox smoke test.
2. The PayPal SDK approval-flow gap in the checkout UI (see above) —
   new finding this session, not previously known.
3. Live PayPal business account credentials configured in production.
4. Production VPS actually provisioned and deployed per
   `docs/PRODUCTION_DEPLOYMENT.md` (not done this session — this
   session produced the architecture decision and runbook, not an
   actual deployment, since no real hosting account/domain was
   available to deploy to).
5. A real legal/accountant review of the HST/tax and Terms/Privacy
   questions.

Everything else audited this session — environment validation, CSP,
rate-limiting architecture, backups, health checks, feature-flag kill
switches, actual-economics tracking, the launch dashboard, and all
supporting documentation — is implemented, tested, and verified.

## Next Phase (smallest only)

Not started, not scoped here, per the spec's own explicit out-of-scope
list: automatic professional matching, AI matching, contractor
acquisition automation, RingDesk (permanently excluded), SMS/WhatsApp/
email marketing automation, chat, reviews, referrals, new cities/
countries/trades, automated payouts, PayPal Multiparty, bidding
marketplace, sophisticated scheduling, GPS/live tracking, native apps,
loyalty program, subscriptions, complex CRM, AI wall visualization, or
a large redesign.
