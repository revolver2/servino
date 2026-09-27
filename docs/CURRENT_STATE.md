# Current State

_Last updated: 2026-09-25 — end of Session H0.1 (small corrective
session — pre-launch UX/truthfulness/funnel-correctness fixes; see
`docs/PROJECT_STATUS.md` "Session H0.1" for the full report). Prior to
that, end of Session H. See `docs/PROJECT_STATUS.md`
for the full Session H production-launch-readiness report,
`docs/PRODUCTION_DEPLOYMENT.md` for the deployment architecture/runbook,
`docs/LAUNCH_CHECKLIST.md` for the go/no-go checklist, and
`docs/SECURITY_MODEL.md`/`docs/UNIT_ECONOMICS.md`/`docs/ADMIN_OPERATIONS.md`
for the updated backend/dashboard detail. Test suite: 173/173 passing
(unchanged count — Session H is a hardening/operational session, not a
new-feature session; verification added via standalone scripts instead,
see `docs/PROJECT_STATUS.md` "Testing"). Image assets remain
placeholders/abstract by design — see `docs/IMAGE_ASSET_REQUIREMENTS.md`._

## Repository

Servino is a brand-new repository, scaffolded from scratch during Phase A.
There was no prior codebase to inspect or migrate from.

- **Location:** `Desktop/servino`
- **Framework:** Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS v4
- **Package manager:** npm
- **Git:** initialized locally (`main` branch). No remote configured yet — nothing
  has been pushed anywhere.

## What exists after Phase A

- Marketing homepage (`/`) with Hero, Services, Inspiration, How It Works,
  Trust, FAQ, and Final CTA sections.
- Responsive header/footer, sticky nav with mobile menu.
- Brand design tokens (colors) centralized in `src/app/globals.css` and
  `src/lib/design-tokens.ts`.
- Placeholder logo/symbol assets in `public/logo-*.svg` and `src/app/icon.svg`
  (geometric mark — see `docs/DECISIONS.md` for rationale; a professionally
  refined version is a pre-launch asset task, not a Phase A blocker).
- Static, typed service catalog (`src/lib/services-data.ts`) shaped to match
  the future `Service`/`ServiceCategory` Prisma models — one Toronto category
  (Decorative Walls) with four services (Wall Panels, Marble Sheets,
  Wallpaper, Decorative Partitions).
- Feature flag stub (`src/lib/feature-flags.ts`) — static defaults, no admin
  UI yet.
- Prisma schema (`prisma/schema.prisma`) with the location hierarchy
  (Country → Province → City) and service taxonomy
  (ServiceCategory → Service → ServiceCity). **No database is provisioned** —
  `DATABASE_URL` is unset; `prisma migrate` has not been run against any
  instance.
- Basic SEO: metadata, Open Graph tags, `sitemap.ts`, `robots.ts`.
- Placeholder pages so no link 404s: `/privacy`, `/terms`, `/contact`.

## What exists after Phase B1

- Paid landing page `/toronto/wall-makeover`.
- A real, working quote funnel: `/quote/project → measurements → photo →
  style → price`, each step gated so it can't be reached before its
  prerequisites are met.
- Anonymous session + first-touch attribution capture (no PII).
- Four adapter boundaries (`PricingAdapter`, `LeadAdapter`,
  `AnalyticsAdapter`, `ConversionAdapter`), each with a single
  clearly-labeled development implementation (mock pricing, localStorage
  lead storage, console analytics, no-op conversions) — no real backend
  yet, but every component talks to the interface, not the implementation.
Full detail in `docs/FRONTEND_IMPLEMENTATION.md` and `docs/PROJECT_STATUS.md`.

## What exists after Phase B2

- Real PostgreSQL database (local dev/test via `embedded-postgres`,
  production targets self-hosted Postgres on the VPS) with a committed
  migration.
- Durable lead capture: `/quote/contact` and `/quote/timing` are real,
  server-persisted steps; `/quote/confirmation` is a real,
  server-validated final screen.
- Six `/api/lead/*` routes — progress, price, contact, timing,
  booking-intent, confirmation — all server-validated, rate-limited, and
  never trusting client-submitted business data.
- `ApiLeadAdapter` is now the default `LeadAdapter` implementation
  (`DevLocalLeadAdapter` remains as an offline/local reference
  implementation).
- Server-authoritative pricing — the price that gets booked is computed
  and frozen server-side, not trusted from the browser.
- Idempotent, transactional booking-intent creation — verified under real
  concurrency, not just sequential retries.
- `ConsentManager` config boundary + essential-category consent evidence
  recording.
- Honest Privacy/Terms pages describing the actual current product.

Full detail in `docs/DATA_MODEL.md`, `docs/WORKFLOWS.md`,
`docs/SECURITY_MODEL.md`, and `docs/PROJECT_STATUS.md`.

## What exists after Session D

A secure, owner-operated admin core (`/admin`) — see
`docs/PROJECT_STATUS.md` for the full report and
`docs/ADMIN_OPERATIONS.md` for the runbook. Headline: DB-backed admin
auth (scrypt password hashing, no third-party provider), real leads/
jobs/professionals views backed entirely by the existing database (no
parallel data system), manual professional assignment with full audit
history, and explicit server-enforced job status transitions. The
customer-facing funnel/storefront documented above is unchanged except
for one additive line: `/api/lead/booking-intent` now also creates a
`Job` row in the same transaction (invisible to the customer — see
`docs/DECISIONS.md` D023).

## What exists after Session E

A real, versioned, server-authoritative Toronto pricing engine plus an
internal unit-economics model — see `docs/PROJECT_STATUS.md` for the
full report and `docs/PRICING_MODEL.md`/`docs/UNIT_ECONOMICS.md` for the
formulas. Headline: `PricingVersion`/`ServicePricingRule` with a
DRAFT→ACTIVE→RETIRED lifecycle (at most one ACTIVE per city, enforced
at the database level), every quote traceable to the exact version that
priced it and immutable thereafter, an `EconomicsSnapshot` computing
professional payout estimate/material cost estimate/contribution
profit/contribution margin/quote health alongside every authoritative
quote (never shown to the customer), and an Admin Pricing Lab
(`/admin/pricing`) for creating/activating versions and simulating both
Installation Only and Material + Installation scenarios using the exact
same engine as production. The customer-facing funnel documented above
is unchanged in layout — the only difference is the number itself now
comes from real Toronto assumptions once an owner activates a version,
instead of always being the development mock rate. Production can no
longer reach mock pricing under any configuration (D026).

## What exists after Session F

A real, secure mobile job app for Servino's first professionals — see
`docs/PROJECT_STATUS.md` for the full report and
`docs/PROFESSIONAL_OPERATIONS.md` for the runbook. Headline: fully
separate professional authentication (own cookie/session table, own
rate-limit buckets — D032), a secure admin-issued activation flow
(D033), an explicit `JobOffer` workflow with a real compensation amount
that Admin controls (replacing silent auto-assignment — D035), the full
field-progress workflow (accept → en route → arrived → start →
complete, each server-authoritative and audited), lightweight problem
reporting that flags Admin without forcing a status change (D036), and
an estimated-vs-actual compensation comparison so the first real jobs
can start validating Session E's pricing assumptions (D038). The
customer-facing funnel and Session E pricing engine are both unchanged.
`/pro` is mobile-first (360–1440px verified), and PII shown to a
professional is minimized before acceptance and expanded only after
(D037). No money is transferred anywhere in Session F — compensation
figures are recorded, never paid out.

## What exists after Session H

Production-readiness, not new marketplace features — see
`docs/PROJECT_STATUS.md` for the full report. Headline: a decided,
documented production architecture (single VPS running Next.js +
PostgreSQL together, D045), fail-closed production environment
validation (`src/lib/server/env.ts`), a real Content-Security-Policy
(after a self-caught, reverted nonce-based false start), a genuine
(application-layer, honestly disclosed) backup/restore drill, a real
`GET /api/health` endpoint, three feature flags that went from dead
config to real server-enforced kill switches (D047), a new
`JobActuals` model and admin form for recording real per-job material
cost/CAC/other-cost against Session E's original estimates (never
overwriting them), and a new `/admin/launch` dashboard showing the
owner a live "X/10 completed paid jobs" milestone plus per-job
estimate-vs-actual economics. Verified end to end against a genuinely
fresh database driving the entire real lifecycle
(`scripts/fresh-db-lifecycle-drill.mjs`). Zero accessibility
violations and zero horizontal overflow across every required
customer/professional/admin breakpoint. No automatic matching, AI
matching, contractor-acquisition automation, SMS/email/chat/reviews/
referrals, new cities, automated payouts, or PayPal Multiparty — all
explicitly out of scope and untouched (D045–D047, `docs/DECISIONS.md`).
**Not done this session:** an actual production VPS was not
provisioned or deployed to (no real hosting account/domain was
available) — Session H produced the architecture decision, tooling,
and runbook, not a live deployment. The PayPal checkout UI's real
hosted approval-flow wiring is also still missing (a newly discovered
gap, not previously known) — see `docs/PAYMENTS.md` "Session H
finding."

## What exists after Session H0.1

No new features — ten customer-facing defects fixed, found during
pre-launch manual QA. See `docs/PROJECT_STATUS.md` "Session H0.1" for
the full list. Headline: measurement unit switching now actually
converts dimensions instead of destroying them; homepage service cards
correctly preselect the clicked service (previously fell back to a
stale session's service); footer/header homepage-section links work
from any route, not just the homepage; homepage/Terms/Privacy copy no
longer claims unbuilt features (customer-facing professional selection,
in-app messaging/scheduling, a tracking dashboard) or contradicts the
real payment flow; the price step's CTA no longer says "Continue to
Booking"; Contact has a real (if not-yet-configured) support-email
mechanism; a Session H CSP gap causing a real dev-mode console error is
fixed. Tests: 173 → 184.

## What does NOT exist yet

Real payments/payouts (Session F only *records* an agreed compensation
figure — no money moves, to a customer or a professional), a
professional self-service portal beyond this minimal job tool
(no earnings dashboard, no chat, no self-edit of identity/services),
matching/dispatch automation, automatic offer re-assignment after a
decline, messaging, disputes, professional-acquisition automation, a
second city (the pricing model is scoped to `citySlug: "toronto"`
only), and most `docs/research/` documents (only
`CANADA_COMMUNICATION_CONSENT.md` and `SERVICE_PRICING_RESEARCH.md`
exist so far). **RingDesk is explicitly out of scope for Servino** —
not a future phase, not integrated, not planned.

## Environment

- `.env.example` documents `DATABASE_URL`, `NEXT_PUBLIC_SITE_URL`, and
  `NEXT_PUBLIC_USE_MOCK_PRICING`.
- `.env.local` exists locally (gitignored) pointing at the local
  `embedded-postgres` instance — nothing connected to a real production
  database, analytics provider, or payment provider yet.

## Known gaps / follow-ups for later phases

- Logo is a programmatic placeholder mark, not a designed brand asset.
- A committed Playwright suite exists since Phase C (173 tests as of
  Session H) — but it still only runs manually/locally; no CI configured
  yet to run it automatically on push.
- Toronto v1 pricing assumptions (professional payout %, material cost
  %, CAC) are launch estimates, not yet validated against a real
  completed job — Session H's `JobActuals`/`/admin/launch` now exist to
  close that gap once real jobs run, but no real (non-test) job has
  completed yet. See `docs/FIRST_10_PRICING_VALIDATION.md`.
- No activation-link email delivery — Admin must copy/send it manually.
- Real payments exist in mechanism (Session G) but are not yet
  launch-ready — see `docs/PROJECT_STATUS.md` "First Real Paid Job
  Readiness" for the exact current blocker list (PayPal sandbox
  verification, the checkout UI's approval-flow wiring, live
  credentials, an actual production deployment, and legal/accountant
  sign-off).
- `prisma` devDependency pinned to `6.19.3` instead of the npm-default
  `8.0.0-rc.15` (platform-first CLI) — see `docs/DECISIONS.md` D006.
- `npm audit` reports high-severity findings confined to the `prisma` CLI
  devDependency's transitive tree (not `@prisma/client`, not shipped to
  production) — unchanged since Phase A, see `docs/SECURITY_MODEL.md`.
- Rate limiting is single-process — confirmed correct for the decided
  production architecture (single VPS, D045), not a gap to fix; see
  `docs/SECURITY_MODEL.md` "Session H."
- No production PostgreSQL instance provisioned yet — local/test only.
  Architecture, deploy runbook, and cost model are ready
  (`docs/PRODUCTION_DEPLOYMENT.md`, `docs/INFRASTRUCTURE_COST_MODEL.md`);
  actual provisioning/deployment was not performed this session (no
  real hosting account/domain was available in this environment).
