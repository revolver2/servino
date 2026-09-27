# Architecture

_Updated end of Session F. Describes what has actually been built — see
`docs/FRONTEND_IMPLEMENTATION.md` for the quote-funnel frontend writeup,
`docs/DATA_MODEL.md` for the database, `docs/WORKFLOWS.md` for the lead
state machine and admin/professional operational workflows,
`docs/SECURITY_MODEL.md` for the trust boundaries (customer, admin, and
now professional), `docs/ADMIN_OPERATIONS.md` /
`docs/PROFESSIONAL_OPERATIONS.md` for the owner-facing runbooks, and
`docs/PRICING_MODEL.md` / `docs/UNIT_ECONOMICS.md` for the Session E
pricing/economics engine that Session F's offers now reference._

## Testing (added Phase C, extended every phase since)

`tests/e2e/*.spec.ts` — a committed Playwright suite (134 tests: 39
customer-funnel/storefront + 32 Session D admin + 31 Session E pricing/
economics + 32 Session F professional app) covering the revenue-critical
path: two full happy-path E2E flows with direct database verification,
route-guard/confirmation security tests, price/financial manipulation
attempts, measurement edge cases, injection/header spot checks,
(Session D) admin auth, IDOR/BOLA, mass assignment, stored XSS,
CSRF/origin, assignment/reassignment audit trail, job status-transition
enforcement, (Session E) deterministic pricing/economics computation,
the mock-vs-authoritative selection policy (D026), pricing-version
lifecycle including a genuine concurrent-activation race, the admin
simulator, server-side validation, the UNPROFITABLE-surfaces-to-the-
dashboard policy (D029), and (Session F) professional authentication/
activation, five dedicated IDOR/BOLA tests, the full offer→accept→
field→complete chain with per-transition audit verification, decline/
re-offer history preservation, problem-report XSS safety, and three
concurrency races (two of which found real bugs before passing — see
`docs/PROJECT_STATUS.md` "Bugs Found"). Runs against an isolated
`servino_test` database via `npm run test:e2e:server` (port 3100) +
`npm run test:e2e` — never `servino_dev` or production. Admin tests
authenticate once per run via `tests/e2e/global-setup.ts` +
`storageState`, not once per test (see `docs/SECURITY_MODEL.md`
"Testing note"); professional tests authenticate per-test via a
separate, fully independent session (D032). See `docs/DECISIONS.md`
D015 for the original scope decision, and `docs/PROJECT_STATUS.md` for
current results.

## Stack

- **Frontend/marketing:** Next.js 16 App Router, React 19, TypeScript,
  Tailwind CSS v4. Deployed on Vercel per spec section 73 (not yet deployed —
  local only).
- **Backend:** Next.js Route Handlers under `src/app/api/lead/*` (Node
  runtime) and, as of Session D, `src/app/api/admin/*`. Still a modular
  monolith in spirit (spec sections 71–72): a `Lead`-centric module and
  an admin module, not separate services.
- **Admin:** Next.js Server Components under `src/app/admin/*`, DB-backed
  session auth (no third-party auth provider) — see
  `docs/SECURITY_MODEL.md` Session D section and `docs/DECISIONS.md`
  D022/D024.
- **Professional:** Next.js Server Components under `src/app/pro/*`, its
  own fully independent DB-backed session auth (own cookie, own session
  table — never shares Admin's, D032) — see `docs/SECURITY_MODEL.md`
  Session F section and `docs/DECISIONS.md` D032/D033.
- **Database:** PostgreSQL via Prisma 6.19.3 (`prisma/schema.prisma`).
  Phase A's location/service taxonomy, Phase B2's durable lead-capture
  models (`Lead`, `LeadAttribution`, `ContactInfo`, `TimingSelection`,
  `ConsentEvidence`, `QuoteSnapshot`, `BookingIntent`), Session D's
  admin core (`AdminUser`, `AdminSession`, `Professional`,
  `ProfessionalService`, `Job`, `AuditEvent`, `AdminNote`), Session E's
  pricing/economics core (`PricingVersion`, `ServicePricingRule`,
  `EconomicsSnapshot`), and Session F's professional-app core
  (`ProfessionalSession`, `ProfessionalActivationToken`, `JobOffer`,
  `ProblemReport`) — see `docs/DATA_MODEL.md`. Local dev/test databases
  run via `embedded-postgres` (`scripts/dev-db.mjs`, see
  `docs/DECISIONS.md` D011); production targets a self-hosted PostgreSQL
  instance on the VPS, same engine either way.
- **Pricing/economics engine:** `src/lib/pricing-engine/*` — pure,
  server-only, deterministic functions (`computeCustomerPrice`,
  `computeEconomics`) shared by the real customer price route AND the
  admin simulator, so there is exactly one formula, never a parallel
  React approximation (spec section 39). See `docs/PRICING_MODEL.md`.
- **Infra:** not yet provisioned. Plan per spec section 73–74 is Vercel for
  the Next.js frontend and a VPS (Hetzner/OVH/DigitalOcean — TBD, see
  `docs/INFRASTRUCTURE_COST_MODEL.md` once written) for backend workloads,
  queues, and workers.

## Directory layout

```
servino/
  src/
    app/
      layout.tsx                 # Root shell: fonts, metadata, AttributionCapture
      (marketing)/                # Route group — no URL segment
        layout.tsx                 # Full Header + Footer
        page.tsx, privacy/, terms/, contact/
      quote/
        layout.tsx                 # QuoteProvider + FunnelHeader
        page.tsx                    # redirect → /quote/project
        project/, measurements/, photo/, style/, price/,
        contact/, timing/, confirmation/          # contact+ are real as of B2
      toronto/wall-makeover/       # Paid landing page
      admin/                       # Session D
        layout.tsx                  # noindex metadata, thin wrapper
        login/page.tsx               # public
        (protected)/                 # route group — auth gate + AdminShell
          layout.tsx, page.tsx        # requireAdminSession() or redirect; Overview
          leads/, jobs/, professionals/, services/
          pricing/                     # Session E — overview, [id] detail, new, simulator
      pro/                          # Session F
        login/page.tsx, activate/page.tsx   # public
        (protected)/                         # route group — auth gate + ProShell
          layout.tsx, page.tsx                # requireProfessionalSession() or redirect; home
          jobs/, jobs/[id]/, profile/
      api/lead/                    # B2 — the durable customer-facing backend
        progress/, price/, contact/, timing/, booking-intent/, confirmation/
      api/admin/                   # Session D (+ Session E, Session F)
        auth/login/, auth/logout/
        professionals/, professionals/[id]/, professionals/[id]/activation/   # activation — Session F
        jobs/[id]/status/, jobs/[id]/assign/, jobs/[id]/offer/, jobs/[id]/offer/withdraw/   # offer/withdraw — Session F
        pricing/versions/, pricing/versions/[id]/activate/, pricing/versions/[id]/retire/, pricing/simulate/
      api/pro/                     # Session F
        auth/login/, auth/logout/, auth/activate/
        jobs/[id]/accept/, jobs/[id]/decline/, jobs/[id]/en-route/,
        jobs/[id]/arrived/, jobs/[id]/start/, jobs/[id]/complete/, jobs/[id]/problem/
      sitemap.ts, robots.ts, icon.svg
    components/
      branding/Logo.tsx
      layout/Header.tsx, Footer.tsx           # Marketing chrome
      home/                                     # Homepage sections
      landing/TransformationHero.tsx            # Paid landing hero
      quote/                                     # Funnel chrome + steps
        FunnelHeader.tsx, ProgressIndicator.tsx, StepGuard.tsx
        steps/ProjectLocationStep.tsx, MeasurementsStep.tsx, PhotoStep.tsx,
              StyleMaterialStep.tsx, PriceStep.tsx, ContactStep.tsx,
              TimingStep.tsx, ConfirmationStep.tsx
      analytics/AttributionCapture.tsx, TrackPageView.tsx
      admin/                                     # Session D (+ Session E, Session F)
        AdminShell.tsx, ui.tsx (Card/StatusChip/EmptyState/PageHeader/DefinitionRow)
        LoginForm.tsx, ProfessionalForm.tsx, JobStatusControl.tsx, AssignProfessionalButton.tsx
        PricingVersionForm.tsx, PricingVersionActions.tsx, PricingSimulator.tsx   # Session E
        OfferJobForm.tsx, WithdrawOfferButton.tsx, GenerateActivationLinkButton.tsx   # Session F
      pro/                                        # Session F — mobile-first, deliberately not AdminShell-on-mobile
        ProShell.tsx, ProLoginForm.tsx, ProActivateForm.tsx, ProJobActions.tsx, ProJobCard.tsx
    lib/
      design-tokens.ts, feature-flags.ts, services-data.ts   # Phase A
      consent/consent-manager.ts                               # Phase B2
      server/                                                    # backend-only
        prisma.ts, api-response.ts, rate-limit.ts, lead-status.ts,
        spam-signals.ts, schemas.ts                                # B2 — customer funnel
        password.ts, admin-auth.ts, admin-api-response.ts,          # Session D — admin
        admin-schemas.ts, audit.ts, job-status.ts
        admin-pricing-schemas.ts                                     # Session E
        pro-auth.ts, pro-api-response.ts, pro-schemas.ts,             # Session F — professional
        pro-job-access.ts, pro-field-transition.ts
      pricing-engine/                                            # Session E — pure, server-only
        types.ts, rounding.ts, customer-price.ts, economics.ts,
        map-row.ts, active-version.ts, version-by-id.ts, resolve-pricing.ts
      quote/
        quote-provider.tsx        # React context owning QuoteState
        session.ts, attribution.ts, storage.ts, step-guard.ts
        locations.ts, units.ts
        pricing/    # PricingAdapter (unchanged interface), MockPricingAdapter, dev config
        lead/       # LeadAdapter, ApiLeadAdapter (primary), DevLocalLeadAdapter (local fallback)
        analytics/  # AnalyticsAdapter, ConsoleAnalyticsAdapter
        conversion/ # ConversionAdapter, NoopConversionAdapter
        media/      # client-side file validation + local preview
      admin/                                                      # Session D — admin query/view layer
        dashboard.ts, leads.ts, jobs.ts, professionals.ts, timeline.ts, status-display.ts
        pricing.ts                                                  # Session E
      pro/                                                        # Session F — professional-facing query layer
        jobs.ts (ProJobView — PII-minimized by stage), display.ts, profile.ts
    types/
      quote.ts    # QuoteState and everything it's built from — PricingSource extended Session E
      lead.ts      # ContactDetails, ConfirmationResult, LeadAdapterError
  prisma/
    schema.prisma          # Location/service taxonomy + B2 lead-capture + Session D admin core + Session E pricing/economics + Session F professional app
    migrations/             # Committed migration history
  scripts/
    dev-db.mjs               # Local embedded PostgreSQL for dev/test
    admin-bootstrap.mjs      # Session D — one-time admin account creation
  docs/                    # This documentation set
```

## Design principles carried forward from the spec

- **Service-driven, not hardcoded to wall panels.** `services-data.ts` is
  typed so the homepage and quote funnel never special-case a specific
  service; new services are just new entries.
- **Frontend never owns business truth — enforced by adapter boundaries,
  now backed by a real server.** `PricingAdapter`, `LeadAdapter`,
  `AnalyticsAdapter`, `ConversionAdapter` remain the only way components
  touch pricing, persistence, analytics, or conversion tracking.
  `LeadAdapter`'s production implementation (`ApiLeadAdapter`) is now a
  real backend-calling adapter — see `docs/FRONTEND_IMPLEMENTATION.md`.
  The `PricingAdapter` *interface* is unchanged by Session E — the price
  route now calls a new server-only `resolvePricing()` orchestrator
  instead, which is authoritative in production (real `PricingVersion`
  data, fails closed if none is active) and falls back to
  `MockPricingAdapter` only in non-production with no active version —
  see D026, `docs/PRICING_MODEL.md`.
- **One pricing formula, not two.** The admin Pricing Simulator calls the
  exact same `computeCustomerPrice`/`computeEconomics` functions as the
  real `/api/lead/price` route (both go through
  `src/lib/pricing-engine/*`) — never a separate approximation
  reimplemented in React (spec section 39).
- **Feature flags gate presentation, not security.** Unchanged from Phase A.
- **No fake production.** Extended in B2: `/quote/confirmation` only
  shows success from a real, server-verified `BookingIntent` — never a
  query param, never localStorage. Booking-intent failure never shows
  confirmation. Verified with a fresh-browser-context test, not just
  reasoned through.
- **Step guards, not trust — now with a real server-side boundary
  underneath.** `StepGuard` remains client-side UX only; every
  `/api/lead/*` route independently re-validates funnel state
  server-side, since `StepGuard` alone was never a security mechanism
  (see `docs/WORKFLOWS.md` "Step-guard vs. server trust").
- **The same page-hiding-is-not-security principle extends to admin
  (Session D) and now to professional (Session F).**
  `requireAdminSession()`/`requireProfessionalSession()` are each called
  independently by their own protected-layout Server Component *and* by
  every one of their own API route handlers — neither half of either
  boundary trusts the other to have already checked.
- **Manual assignment/offer only — no matching algorithm exists.**
  Session D's `/api/admin/jobs/[id]/assign` and Session F's
  `/api/admin/jobs/[id]/offer` both validate eligibility (active,
  service-capable) and record a deliberate admin choice; neither ranks,
  scores, or suggests professionals. That's explicitly out of scope,
  not just deferred (spec section 4 of Session F's own spec).
- **Two independent auth boundaries, never layered.** Admin and
  professional authentication share a generic password-hashing
  primitive (actor-agnostic) but nothing else — separate cookies,
  separate session tables, separate rate-limit buckets, separate
  response-code modules. An admin session grants zero professional
  access and vice versa, verified directly (D032).
- **Estimate and actual are two numbers, never one.** Session E's
  `EconomicsSnapshot.professionalPayoutEstimateMinor` (an internal
  planning figure) and Session F's `JobOffer.offerAmountMinor` (an
  actual, admin-entered offer) are stored, computed, and displayed
  independently — the offer form never auto-fills from the estimate,
  and accepting an offer never touches the (immutable) estimate. This
  is what makes the "estimated vs. actual" comparison on the job detail
  page meaningful rather than circular (D038).

## Session G — payment provider boundary

Same "one adapter interface, several implementations, a factory that
fails closed" shape `PricingAdapter` already established, now applied
to money movement: `PaymentProvider` (`src/lib/payments/payment-provider.ts`)
is the only way any route talks to PayPal — `createOrder` /
`captureOrder` / `getOrder` / `refundPayment` / `verifyWebhook`.
`getPaymentProvider()` selects `TestPaymentProvider` (any
non-production build — deterministic, network-free, used by the whole
Playwright suite), `PayPalPaymentProvider` (production, fully
configured), or `UnavailablePaymentProvider` (production, missing
config — fails closed, never silently substitutes the test double).
See `docs/PAYMENTS.md` for the full architecture and
`docs/DECISIONS.md` D039–D044 for the reasoning. Professional payout
(`docs/PAYOUTS.md`) deliberately has **no** equivalent provider
abstraction yet — Mode B is entirely manual/internal; a `PayoutProvider`
interface is sketched as a future extension point only, not built.

## Deferred until later phases (do not build yet)

Matching automation, automated professional payout (Mode A — PayPal
Payouts/Multiparty; Session G's Mode B *records* a manually-executed
payout, it doesn't move money itself — see `docs/PAYOUTS.md` "Migrating
to Mode A"), messaging, disputes-as-a-platform-feature (beyond the
minimal flag-for-admin-review Session F's `ProblemReport` and Session
G's `CustomerIssueReport`/webhook-dispute handling already provide), a
professional self-service portal beyond Session F/G's minimal job tool
(no earnings dashboard beyond the single truthful payout-status label,
no chat, no self-edit of identity/services), production object
storage, professional-acquisition automation, automatic offer
re-assignment after a decline, reviews/ratings, notification automation
(SMS/email/WhatsApp — links are still delivered manually). RingDesk is
explicitly out of scope for Servino entirely (not deferred — not
happening; see `docs/DECISIONS.md`). Admin authentication/CRUD/manual
assignment exists as of Session D; a real, versioned, server-
authoritative Toronto pricing and internal unit-economics engine exists
as of Session E; a real, secure professional job app (auth, activation,
offer/accept/decline, field workflow, problem reporting) exists as of
Session F; real customer PayPal payment, completion confirmation, and
manual professional payout tracking exist as of Session G — see
`docs/PROJECT_STATUS.md` for exactly what each does and doesn't cover.
