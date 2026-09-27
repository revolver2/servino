# Data Model

_Phase B2 + Session D + Session E + Session F. Describes
`prisma/schema.prisma` as it actually exists — not the full future
marketplace schema (spec section 69), which arrives in later phases.
Session D's, Session E's, and Session F's additions are documented in
their own sections below; everything above those sections is unchanged
from B2._

## Overview

```
Country → Province → City ──┐
                             ├── ServiceCity (join)
ServiceCategory → Service ───┘

Lead ──┬── LeadAttribution   (1:1, write-once)
       ├── ContactInfo        (1:1, upsert)
       ├── TimingSelection    (1:1, upsert)
       ├── ConsentEvidence[]  (1:many, append-only)
       ├── QuoteSnapshot[]    (1:many, immutable rows)
       └── BookingIntent      (1:1, create-once — the idempotency boundary)
                 └── references exactly one QuoteSnapshot
```

## Phase A models (unchanged)

`Country`, `Province`, `City`, `ServiceCategory`, `Service`, `ServiceCity` —
the location/service taxonomy backing the homepage. See
`docs/ARCHITECTURE.md`. No B2 change; the quote funnel still validates
against `src/lib/services-data.ts` and `src/lib/quote/locations.ts`, not
these tables (see D004 in `docs/DECISIONS.md` for why).

## Lead

The durable record of a quote-funnel visitor, keyed by the anonymous
browser `sessionId` (unique). Created on the first meaningful save, then
updated as the customer progresses.

- `status` (`LeadStatus`) — monotonic, never regresses: `QUOTE_STARTED` →
  `QUOTE_PARTIAL` → `PRICE_VIEWED` → `CONTACT_CAPTURED` → `BOOKING_INTENT`.
  Enforced server-side by `furthestStatus()` (`src/lib/server/lead-status.ts`),
  not by trusting whatever the client last saw.
- `currentStep` (`LeadFunnelStep`) — same monotonic principle
  (`furthestStep()`), for the same reason: a stale/out-of-order client
  request must never regress it (see "Known races and how they're closed"
  below).
- `totalAreaM2` — `Decimal(6,2)`, never a float. Only the **aggregate**
  area is stored; per-wall measurements are NOT persisted server-side —
  see "What's deliberately NOT in the database" below.
- `serviceSlug`/`citySlug`/`postalCode`/`styleId`/`materialOwnership` —
  all server-validated on write (`/api/lead/progress`), never trusted
  as-is from the client.

## LeadAttribution

First-touch marketing attribution (UTM params, referrer, landing route),
one row per lead, **write-once**: `/api/lead/progress` only creates this
row if it doesn't already exist, so a later visit/session-resume can never
overwrite the original first-touch data (spec section 28).

## ContactInfo

First name, email, phone. One row per lead (`leadId` unique) — a repeat
submission for the same lead **updates** this row via `upsert`, which is
also what makes the contact endpoint idempotent (spec section 10): a
retried/duplicated request converges to the same row, never a duplicate.

## TimingSelection

One `TimingValue` enum row per lead, same upsert-by-`leadId` idempotency
pattern as `ContactInfo`.

## ConsentEvidence

Append-only (no unique constraint on `leadId` — a lead can accumulate
multiple consent records over time, e.g. if consent categories beyond
essential are added later). Currently only `ESSENTIAL` category rows are
written, one per contact submission. See
`docs/research/CANADA_COMMUNICATION_CONSENT.md` for what this evidence
does and doesn't currently cover.

## QuoteSnapshot

**Immutable** once written — never updated, never recalculated from
changed pricing rules later (spec section 5). A lead can have more than
one snapshot (e.g. if they somehow view price more than once), each
frozen at the moment it was computed. `pricingSource` is an enum —
`MOCK_DEV` (dev-only, still used by the test server and non-production
fallback) or, as of Session E, `AUTHORITATIVE_VERSIONED` (a real
`PricingVersion` actually priced this quote) — so it's structurally
impossible to mistake a snapshot's origin. As of Session E,
`QuoteSnapshot` also carries a nullable `pricingVersionId` (set only
when `pricingSource === AUTHORITATIVE_VERSIONED`) and an optional 1:1
`economicsSnapshot` — see "Session E" below.

Money fields (`subtotalMinor`, `taxMinor`, `totalMinor`) are integer
cents — see `docs/SECURITY_MODEL.md` for why floats are never used for
money anywhere in this system.

## BookingIntent

The final B2 record. `leadId` is **unique** — this is the actual
mechanism that makes booking-intent creation idempotent (spec sections
10/22): the database itself refuses a second row for the same lead
(`P2002` unique-constraint violation), and `/api/lead/booking-intent`
catches that specific error and returns the existing row instead of
failing. References exactly one `QuoteSnapshot` (`quoteSnapshotId`
unique) — the price that was actually shown when the customer submitted,
frozen forever regardless of later pricing changes.

## What's deliberately NOT in the database (yet)

- **Per-wall measurements.** Only the aggregate `totalAreaM2` is durable.
  Individual `WallMeasurement` rows (width/height per wall) exist only in
  the browser's local cache (`DevLocalLeadAdapter`, composed inside
  `ApiLeadAdapter` — see `docs/FRONTEND_IMPLEMENTATION.md`) for
  full-fidelity funnel resume. A page refresh preserves the total area
  used for pricing; it does not guarantee the exact wall-by-wall
  breakdown survives. This was a deliberate scope decision (spec section
  4: "implement only what B2 actually needs") — nothing in the pricing or
  booking-intent flow needs the per-wall breakdown server-side.
- **Photo bytes or references.** No photo/media table exists. An
  uploaded photo never leaves the browser (spec section 29) — see
  `docs/SECURITY_MODEL.md`.
- **The full future marketplace schema** — professionals, payments,
  matching, messaging, disputes, reviews, referrals. Phases F–I.

## Known races and how they're closed

`updateQuote()` on the client fires `LeadAdapter.saveQuoteProgress()`
without awaiting it (by design — it shouldn't block UI interaction). That
means an earlier progress-save call can reach the database and commit
*after* a later, more specific call (e.g. booking-intent creation) has
already run — a classic lost-update race that would otherwise silently
regress `status`/`currentStep` back down after they'd correctly advanced.

Closed with two layers in `/api/lead/progress`:

1. `SELECT ... FOR UPDATE` inside a transaction — row-locks the lead for
   the duration of the read-modify-write, so a concurrent request for the
   *same* lead (from `/api/lead/progress` or the plain `UPDATE` inside
   `/api/lead/booking-intent`'s own transaction) serializes against it
   instead of reading stale data.
2. `furthestStatus()`/`furthestStep()` — even with correct read timing,
   the write itself can never move either field backward.

This was found empirically during B2 E2E testing (not just reasoned
through) — see `docs/PROJECT_STATUS.md` Problems section for how it
surfaced and was confirmed fixed.

## Session D — Lean Admin Core

Seven new models, additive only (see `docs/DECISIONS.md` D022 for why
this specific set and not more). Full detail on the auth/session design
in D024, on Job creation timing in D023.

```
AdminUser ──┬── AdminSession[]   (1:many, DB-backed session tokens)
            ├── AuditEvent[]     (as actor — nullable, some events are system-initiated)
            └── AdminNote[]      (as author — schema exists, no UI/API wired yet)

Professional ──┬── ProfessionalService[]   (which services-data.ts slugs this pro can take)
               └── Job[]                    (as assignedProfessional)

Lead 1:1── Job 1:1── BookingIntent   (Job created automatically alongside BookingIntent — D023)

AuditEvent: polymorphic (entityType + entityId) — targets JOB, PROFESSIONAL, ADMIN_USER, or ADMIN_LOGIN
```

### AdminUser / AdminSession

`AdminUser.passwordHash` is a salted scrypt hash (`src/lib/server/password.ts`)
— never plaintext, never a reversible encoding. `AdminSession.tokenHash`
is a SHA-256 hash of the actual session token; the raw token only ever
exists in the HttpOnly cookie and in memory during the request that
created it. `AdminRole` lists all eight roles from spec section 11, but
Session D only ever creates/checks `SUPER_ADMIN` — no per-role
permission branching exists yet (see D022).

### Professional / ProfessionalService

Minimum fields for manual assignment (spec section 29): identity/
contact, `active` (eligible for assignment), `verificationStatus`
(enum, defaults `MISSING`), a free-text `serviceAreaNote` (no geo
model — Servino serves one city), and `notes` (admin-only). 
`ProfessionalService.serviceSlug` is a plain string matching
`src/lib/services-data.ts` slugs, not a `Service` FK — same pattern as
the quote funnel itself (see D004). Session F adds a nullable
`passwordHash` directly on this model (not a separate credential
table — the smallest addition that supports real login) — see
"Session F" below.

### Job

References `Lead` and `BookingIntent` directly rather than duplicating
quote data — the authoritative money values always come from
`BookingIntent.quoteSnapshot`, never copied onto `Job` (spec section
54). `Job.leadId` and `Job.bookingIntentId` are both unique: at most one
Job per lead, created exactly once, automatically, inside the same
transaction as `BookingIntent` (`/api/lead/booking-intent` — see D023).

`JobStatus` lifecycle — **superseded by Session F, see "Session F"
below for the current table.** The original Session D happy path
(`NEW → REVIEWING → READY_FOR_ASSIGNMENT → ASSIGNED → IN_PROGRESS →
COMPLETED`) is preserved conceptually but now includes real offer/
field-progress steps between `READY_FOR_ASSIGNMENT` and `IN_PROGRESS`
(D034). `src/lib/server/job-status.ts` remains the single source of
enforcement.

Deliberately excludes `SCHEDULED` from the spec's suggested lifecycle —
nothing captures an actual scheduled date, so a status implying one
would be dishonest UI (see D023).

`assignedProfessionalId`/`assignedAt` hold *current* assignment state
only; full history (including reassignment, and as of Session F, every
offer/decline) lives in `AuditEvent` and `JobOffer`, not overwritten in
place.

### AuditEvent

One generic, polymorphic table for every traceable admin/system action
(spec section 38): `ADMIN_LOGIN_SUCCESS`, `ADMIN_LOGIN_FAILED`,
`ADMIN_LOGOUT`, `PROFESSIONAL_CREATED`, `PROFESSIONAL_UPDATED`,
`JOB_CREATED` (system-initiated, `actorId` null), `JOB_STATUS_CHANGED`,
`JOB_ASSIGNED`, `JOB_REASSIGNED`. `metadata` is a JSON field holding
only safe, structured values (e.g. `{"from":"NEW","to":"REVIEWING"}`) —
never passwords, secrets, or full customer PII.

### AdminNote

Schema exists (admin-only, timestamped, actor-recorded, plain text) but
**no API route or UI creates one yet** — Session D judged the note
feature as not required for the first real jobs and left it as a
forward-compatible table rather than building unused UI (spec section
56 explicitly allows omitting this). Documented as a known limitation,
not a bug.

## Session E — Toronto Pricing + Unit Economics

Three new models, additive only. Full rationale in `docs/DECISIONS.md`
D026–D030 and `docs/PRICING_MODEL.md`/`docs/UNIT_ECONOMICS.md` for the
formulas themselves.

```
PricingVersion ──┬── ServicePricingRule[]     (1:many — one row per service slug)
                 ├── QuoteSnapshot[]            (1:many — every quote priced from this version)
                 └── EconomicsSnapshot[]        (1:many)

QuoteSnapshot 1:1── EconomicsSnapshot   (created together, in the same transaction, only when
                                          pricingSource === AUTHORITATIVE_VERSIONED)

AdminUser ── PricingVersion[]   (as createdByAdmin — nullable, a version can outlive review of who made it)
```

### PricingVersion

The versioned pricing "config" — `DRAFT → ACTIVE → RETIRED`, enforced by
`src/app/api/admin/pricing/versions/[id]/activate|retire/route.ts` (only
a `DRAFT` can become `ACTIVE`; `RETIRED` is terminal — reactivating a
retired version is rejected, not silently allowed, so nobody accidentally
resurrects stale assumptions). Scoped to one `citySlug` (`"toronto"`
today — the column exists so a second city is additive later, not a
schema change). Carries every economics assumption needed to price a
quote and compute its internal economics: tax rate/label, professional
payout %, material cost %, payment processing % + fixed fee, CAC
assumption, other variable cost, and the three quote-health margin
thresholds (healthy/acceptable/low). **At most one `ACTIVE` row per
`citySlug`** — enforced by a partial unique index at the database level,
not just application logic (D027), because two concurrent activation
requests is a real race, not a hypothetical one (verified by a committed
test that fires both simultaneously).

### ServicePricingRule

One row per `(pricingVersionId, serviceSlug)` — install-only rate,
material rate (both minor-units-per-m²), and a minimum subtotal (the
job floor), all customer-facing. A `PricingVersion` with zero rules
cannot be activated (`VALIDATION_ERROR` — an empty, un-priceable version
being made authoritative would be a silent footgun, not a legitimate
state).

### EconomicsSnapshot

**Immutable**, same principle as `QuoteSnapshot` — never recalculated
using today's assumptions once written (spec section 20). Created in
the same database transaction as its paired `QuoteSnapshot`, only when
the quote was priced by the authoritative engine (never for `MOCK_DEV`
quotes — there is nothing real to compute economics from). Holds
exactly what a customer must **never** see: professional payout
estimate, material cost estimate, payment-processing estimate, CAC
assumption, discount/referral/other variable costs (present as columns
for the formula's completeness; Session E has no discount/referral
feature, so these are always `0` today), the resulting contribution
profit (can be negative — a real signed integer, not clamped to zero),
contribution margin percent, and the classified `quoteHealth`
(`HEALTHY`/`ACCEPTABLE`/`LOW_MARGIN`/`UNPROFITABLE`). See
`docs/UNIT_ECONOMICS.md` for the exact formula and
`docs/admin` — no separate admin surface exists for this table; it's
only ever read alongside its `QuoteSnapshot` (job detail, pricing
simulator).

### Why `QuoteSnapshot.pricingVersionId` is nullable

A `MOCK_DEV` quote (still the default in non-production and always
forced by the committed test server, D026) has no real `PricingVersion`
to point at — the column stays `null` for those rows rather than
inventing a fake version reference. `pricingSource` is the actual
discriminator; code must never assume `pricingVersionId` is present
just because a `QuoteSnapshot` exists.

## Session F — Minimal Professional Job App

Five new models, additive only. Full rationale in `docs/DECISIONS.md`
D032–D038 and `docs/PROFESSIONAL_OPERATIONS.md` for the operational
runbook.

```
Professional ──┬── ProfessionalSession[]           (Session F — own auth, own table, D032)
               ├── ProfessionalActivationToken[]     (Session F — one-time account setup, D033)
               ├── JobOffer[]                        (Session F — as the offered professional)
               ├── ProblemReport[]                   (Session F — as the reporting professional)
               └── AuditEvent[]                      (Session F — as actorProfessional, a SECOND independent actor slot)

Job ──┬── JobOffer[]         (Session F — one row per offer INSTANCE, full history preserved)
      └── ProblemReport[]     (Session F — a flag, not a status transition, D036)

AdminUser ──┬── ProfessionalActivationToken[]   (as createdByAdmin)
            └── JobOffer[]                       (as offeredByAdmin)
```

### Professional.passwordHash

Nullable — a professional Admin creates has no password until they
complete activation (D033). `null` is the honest "not yet activated"
state, not a placeholder; `POST /api/pro/auth/login` treats a null
`passwordHash` the same as any other failed-login case (constant-time
comparison against a dummy hash either way, so response timing never
reveals whether an account has been activated).

### ProfessionalSession

Structurally identical to `AdminSession` (D024) but a fully separate
table with its own cookie name (`servino_pro_session`) — an admin
session must never be usable to authenticate as a professional, or vice
versa (D032). Same reasoning throughout: only a SHA-256 hash of the
token is ever persisted, revocation is immediate, no JWT-style
still-valid-until-expiry gap.

### ProfessionalActivationToken

One-time, admin-issued (D033). Only the SHA-256 hash of the raw token
is ever persisted; the raw token exists only in the single API response
that creates it, and is never written to `AuditEvent.metadata`. `usedAt`
(nullable) becomes non-null exactly once, enforced by a conditional
update (`WHERE usedAt IS NULL`, count-checked) rather than a
read-then-write — the same optimistic-concurrency pattern as Session
E's pricing-version activation (D027), applied here to close the
reused-token race.

### JobOffer

One row per offer **instance**, not per job (D035/D037) — a job offered
to A (declined), then B (accepted) has two `JobOffer` rows, preserving
full history rather than overwriting A out of existence (spec section
64). `offerAmountMinor` is an admin-entered actual compensation figure,
deliberately independent from `EconomicsSnapshot.
professionalPayoutEstimateMinor` (Session E's internal estimate) — the
two are never merged, so the job detail page's "estimated vs. actual"
comparison is meaningful (D038). At most one row per `jobId` may have
`status = OFFERED` at a time — enforced by a partial unique index
(`JobOffer_one_open_per_job`, same pattern as D027's
`PricingVersion_one_active_per_city`) added by hand in this session's
migration; this is what actually makes the accept-vs-admin-withdraw
race safe, not application logic alone. `respondedAt` is set whenever
an offer leaves `OFFERED` for any terminal reason (accepted, declined,
or withdrawn) — one timestamp field covering all three, not three
separate columns.

### ProblemReport

A flag for Admin attention, not a `JobStatus` transition (D036) — the
job's own `status` is untouched by creating one; Admin decides
separately whether to act (e.g. move the job to `MANUAL_REVIEW`).
`resolved`/`resolvedAt` exist for Admin to mark it handled, but nothing
currently reads `resolved` to hide anything automatically beyond the
Action Required count (`docs/lib/admin/dashboard.ts`'s
`unresolvedProblems` query).

### AuditEvent.actorProfessionalId

A second, independent, nullable foreign key alongside the existing
`actorId`/`AdminUser` relation (D032) — professional-initiated events
(`JOB_OFFER_ACCEPTED`, `JOB_EN_ROUTE`, `JOB_ARRIVED`, `JOB_STARTED`,
`JOB_COMPLETION_REPORTED`, `JOB_PROBLEM_REPORTED`, `JOB_OFFER_DECLINED`,
`PROFESSIONAL_LOGIN_SUCCESS`/`FAILED`/`LOGOUT`, `PROFESSIONAL_ACTIVATED`)
set this instead of `actorId`. Kept as two separate real foreign keys
rather than one polymorphic "actor" field so each stays independently
enforced by the database, not just by convention.

### JobStatus — the current, Session-F-extended lifecycle

Three new values (`OFFERED`, `EN_ROUTE`, `ARRIVED`); three existing
values reused with clarified — not changed — semantics: `ASSIGNED` now
means "professional has accepted the offer," `IN_PROGRESS` means
"professional started on-site work," `COMPLETED` means
**professional-reported completion only** — explicitly not paid, not
payout-sent, not customer-confirmed (D034; no payment phase exists
yet). `src/lib/server/job-status.ts`:

| From | Allowed next |
|---|---|
| `NEW` | `REVIEWING`, `MANUAL_REVIEW`, `CANCELLED` |
| `REVIEWING` | `READY_FOR_ASSIGNMENT`, `MANUAL_REVIEW`, `CANCELLED` |
| `READY_FOR_ASSIGNMENT` | `OFFERED`, `MANUAL_REVIEW`, `CANCELLED` |
| `OFFERED` | `ASSIGNED`, `READY_FOR_ASSIGNMENT`, `MANUAL_REVIEW`, `CANCELLED` |
| `ASSIGNED` | `EN_ROUTE`, `READY_FOR_ASSIGNMENT`, `MANUAL_REVIEW`, `CANCELLED` |
| `EN_ROUTE` | `ARRIVED`, `MANUAL_REVIEW`, `CANCELLED` |
| `ARRIVED` | `IN_PROGRESS`, `MANUAL_REVIEW`, `CANCELLED` |
| `IN_PROGRESS` | `COMPLETED`, `DISPUTED`, `MANUAL_REVIEW`, `CANCELLED` |
| `COMPLETED` | `CONFIRMED` (Session G — customer/admin confirmation), `DISPUTED` (a problem discovered after the fact) |
| `CONFIRMED` | `DISPUTED` (Session G — e.g. a provider chargeback arriving after confirmation) |
| `DISPUTED` | `REVIEWING`, `COMPLETED`, `CANCELLED` |
| `MANUAL_REVIEW` | `REVIEWING`, `READY_FOR_ASSIGNMENT`, `CANCELLED` |
| `CANCELLED` | *(none — terminal)* |

`DECLINED` is deliberately **not** a `JobStatus` value — a decline is a
property of an individual `JobOffer`, not the job itself; the job
returns to `READY_FOR_ASSIGNMENT` for re-offering rather than entering
a terminal "declined" job state. The pre-existing Session D
`/api/admin/jobs/[id]/assign` route never consulted this transition
table (it has its own inline guard) and is completely unaffected by
these changes — see `docs/DECISIONS.md` D035 for why it was kept,
unmodified, alongside the new offer-based path.

## Session G — Payments, Payouts, Completion Confirmation

Six new models (D041 explains why not more). Full field-level detail
in `prisma/schema.prisma`'s own comments; this is the map.

- **`Payment`** — one row per `Job` (`jobId` unique), mutable current
  state. `status` (`PaymentStatus`: `PENDING → CREATED → APPROVED →
  CAPTURED`, plus `FAILED`/`CANCELLED`/`REFUNDED`/`PARTIALLY_REFUNDED`/
  `DISPUTED`), `amountMinor`/`currency` (frozen from
  `QuoteSnapshot.totalMinor` at creation), `paypalOrderId`/
  `paypalCaptureId` (both unique where set).
- **`PaymentEvent`** — append-only, one row per provider interaction
  (API response or webhook). `providerEventId` is unique where present
  — this is the actual webhook-idempotency mechanism, not application
  logic. `source` (`API`/`WEBHOOK`), `resultingStatus`, minimized
  `summary` JSON.
- **`Refund`** — one row per refund attempt, references `Payment`. A
  **partial unique index** (`Refund_one_active_per_payment`, WHERE
  `status IN ('PENDING','COMPLETED')`) allows at most one active refund
  per payment — the real guard against a concurrent double-refund (see
  `docs/DECISIONS.md` and `docs/PROJECT_STATUS.md` "Bugs Found").
- **`Payout`** — one row per `Job` (`jobId` unique), materialized only
  once eligibility first becomes true (D043 — no row = not eligible,
  not a stored `NOT_ELIGIBLE` value). References the accepted
  `JobOffer` (D042, the amount authority) via `jobOfferId` (also
  unique). `status` (`ELIGIBLE`/`PAID`/`HELD`/`CANCELLED`), manual
  recording fields (`methodCategory`, `externalReference`, `paidAt`,
  `note`, `amountOverrideReason`, `recordedByAdminId`), `heldReason`.
- **`CustomerIssueReport`** — a flag, same philosophy as Session F's
  `ProblemReport` (D036): does not itself change `Job.status`, does not
  trigger any automatic refund or payout change. `reasonCode`
  (`INCOMPLETE`/`QUALITY`/`DAMAGE`/`SCOPE`/`OTHER`), optional `note`,
  `resolved` boolean.
- **`CompletionConfirmationToken`** — one-time, admin-issued,
  identical shape/reasoning to Session F's
  `ProfessionalActivationToken` (D033): `tokenHash` unique (only the
  SHA-256 hash persisted), `expiresAt` (14 days), `usedAt` (single-use,
  claimed via a conditional update).

New `AuditAction` values (13): `PAYMENT_ORDER_CREATED`,
`PAYMENT_CAPTURED`, `PAYMENT_FAILED`, `PAYMENT_RECONCILED`,
`REFUND_INITIATED`, `REFUND_COMPLETED`, `COMPLETION_TOKEN_CREATED`,
`CUSTOMER_COMPLETION_CONFIRMED`, `CUSTOMER_ISSUE_REPORTED`,
`ADMIN_COMPLETION_CONFIRMED`, `PAYOUT_ELIGIBLE`, `PAYOUT_RECORDED`,
`PAYOUT_HELD`. Customer-initiated events (payment, confirmation,
issue) leave both `actorId` and `actorProfessionalId` null — same
precedent as Session D's system-initiated `JOB_CREATED` (D032).

Database-level financial invariants (D041, matching the D027/D035
precedent of enforcing what the Prisma DSL can't express as hand-added
raw SQL): `amountMinor >= 0` CHECK constraints on `Payment`, `Refund`,
`Payout`; `currency = 'CAD'` CHECK on `Payment`.

See `docs/PAYMENTS.md` and `docs/PAYOUTS.md` for how these models are
actually used, and `docs/DECISIONS.md` D039–D044 for the reasoning
behind each shape.
