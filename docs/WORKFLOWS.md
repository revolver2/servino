# Workflows

_Phase B2 + Session D + Session E + Session F. The actual state machine
as implemented — not the full future marketplace workflow (spec section
7), which arrives in later phases._

## Quote → Lead → Booking Intent

```
Visitor lands (homepage or /toronto/wall-makeover)
  │  AttributionCapture records first-touch (once, browser-only)
  ▼
/quote/project        Lead created server-side: status=QUOTE_STARTED
  │  select service + enter postal code (server re-validates both)
  ▼
/quote/measurements    status → QUOTE_PARTIAL
  │  one or more walls, metric/imperial
  ▼
/quote/photo            (optional — status unaffected; no server persistence)
  │
  ▼
/quote/style             style + material ownership
  │
  ▼
/quote/price              POST /api/lead/price
  │  server recomputes price from the lead's OWN persisted inputs
  │  (never trusts a client-submitted total) → resolvePricing() (Session E,
  │  D026): production always uses the ACTIVE PricingVersion for the
  │  lead's city, fails closed if none exists; non-production falls back
  │  to MockPricingAdapter only if no active version is configured
  │  → QuoteSnapshot created (+ EconomicsSnapshot, internal-only, when
  │  priced by the authoritative engine) → status → PRICE_VIEWED
  ▼
/quote/contact             POST /api/lead/contact
  │  honeypot + timing-signal checked; validated; upserted
  │  ConsentEvidence (ESSENTIAL) recorded
  │  status → CONTACT_CAPTURED
  ▼
/quote/timing                POST /api/lead/timing
  │  upserted (requires CONTACT_CAPTURED)
  │
  ▼ (same "Submit My Project" action)
POST /api/lead/booking-intent
  │  requires CONTACT_CAPTURED + timing + ≥1 QuoteSnapshot
  │  transaction: create BookingIntent, status → BOOKING_INTENT,
  │  currentStep → CONFIRMATION
  │  idempotent: retry/double-click always resolves to the same row
  ▼
/quote/confirmation            GET /api/lead/confirmation?sessionId=...
     only shows success if a real BookingIntent exists for this session —
     never from a query param, localStorage, or client state.
```

## Step-guard vs. server trust — two different mechanisms, deliberately

- **`StepGuard`** (client-side, `src/components/quote/StepGuard.tsx`) —
  UX only. Reads the browser's local `QuoteState` cache to decide whether
  to render a step or redirect to an earlier one. Fast, works offline,
  but not a security boundary — a user could clear/edit localStorage.
- **Server validation** (every `/api/lead/*` route) — the actual boundary.
  Each endpoint independently checks `lead.status`/relations before acting
  (e.g. `/api/lead/timing` requires `status === "CONTACT_CAPTURED"`
  regardless of what the client claims).
- **`/quote/confirmation`** intentionally skips `StepGuard` entirely (see
  `src/app/quote/confirmation/page.tsx`) — it would be exactly the wrong
  tool there, since the whole point is to not trust client state. It only
  trusts `GET /api/lead/confirmation`.

## Idempotency at each step

| Step | Mechanism |
|---|---|
| Progress save | `upsert` by `sessionId`; row-locked read-modify-write (see `docs/DATA_MODEL.md`) |
| First-touch attribution | Created only if absent — never updated |
| Price / QuoteSnapshot | Each call creates a new snapshot (not idempotent by design — repeated views are legitimate), but `status` only ever advances |
| Contact | `upsert` by `leadId` |
| Timing | `upsert` by `leadId` |
| Booking intent | `leadId` unique constraint — retries/concurrent duplicates resolve to the same row (existence check + transaction + caught `P2002`) |

## Failure behavior at each step (spec section 41)

- **Contact save fails** → stays on `/quote/contact`, entered values
  preserved (React state untouched), error message shown, retry available.
- **Timing save fails** → stays on `/quote/timing`, same pattern.
- **Booking-intent fails** → stays on `/quote/timing` (the step that
  triggers it) — never navigates to confirmation.
- **Pricing unavailable** (dev misconfiguration, or production without
  the mock-pricing flag) → `/quote/price` shows an explicit "couldn't
  generate a price" state with retry, never a fabricated number, and no
  `QuoteSnapshot` is created.
- **Rate limited** → any endpoint returns `RATE_LIMITED`; the funnel
  surfaces the message and lets the user retry after the window.
- **Confirmation lookup fails** (network error, not "not found") →
  distinct `error` state ("we couldn't verify — refresh"), separate from
  the honest `not_found` state, so a user isn't told their real
  submission vanished due to a transient glitch.

## Session D — Admin operational workflow

Everything below is new; the customer workflow above is completely
unchanged by Session D.

```
Customer submits (as above) ─────────────► POST /api/lead/booking-intent
                                                  │  same transaction as always, PLUS:
                                                  │  Job created (status NEW), JOB_CREATED audit row
                                                  ▼
/admin/jobs (status=NEW)          ◄── operator sees it immediately, no manual "convert" step
  │  admin reviews project/quote/timing/attribution (via job detail, which links to lead detail)
  ▼
POST /api/admin/jobs/[id]/status  { status: "REVIEWING" }
  │  validated against the explicit transition table (src/lib/server/job-status.ts) — never free-form
  ▼
POST /api/admin/jobs/[id]/status  { status: "READY_FOR_ASSIGNMENT" }
  ▼
As of Session F, admin OFFERS the job rather than directly assigning it —
see "Session F — Offer and field workflow" below for the current path.
The route this diagram originally showed here
(POST /api/admin/jobs/[id]/assign, instant assignment with no
acceptance step) still exists, completely unmodified, and still passes
its own committed tests — but is no longer linked from the Admin UI
(docs/DECISIONS.md D035). What follows is the pre-Session-F shape, kept
for historical accuracy:
  ▼ (superseded — see Session F below)
POST /api/admin/jobs/[id]/status  { status: "IN_PROGRESS" } → { status: "COMPLETED" }
  │  (coordination with the customer/professional happens outside
  │  Servino for now — spec section 57, no communication system yet)
  ▼
/admin/jobs/[id] timeline shows the full history — real funnel
timestamps (Lead/QuoteSnapshot/ContactInfo/TimingSelection/
BookingIntent) merged with real AuditEvent rows, in order
```

### Admin authentication flow

```
POST /api/admin/auth/login { email, password }
  │  rate-limited (8/5min/IP, separate bucket from customer endpoints)
  │  same-origin check (Origin header vs Host)
  │  verifyPassword() runs even for a non-existent email, against a
  │  fixed dummy hash — response timing doesn't reveal account existence
  │  on success: AdminSession row created, HttpOnly/SameSite=Lax cookie set
  ▼
Every /admin/* page (via the (protected) layout) and every /api/admin/*
route independently calls requireAdminSession() — a real DB lookup
(session hash → row → check revoked/expired/user-active) every time.
Neither half trusts the other; hiding the page was never the actual
security boundary (spec section 43).
  ▼
POST /api/admin/auth/logout → AdminSession.revokedAt set immediately,
cookie cleared. No JWT-style "still valid until expiry" window (D024).
```

See `docs/ADMIN_OPERATIONS.md` for the same flow written as an
owner-facing runbook, and `docs/SECURITY_MODEL.md` for the full admin
threat-boundary writeup.

## Session E — Pricing version lifecycle

```
POST /api/admin/pricing/versions   { citySlug, label, tax/economics assumptions, rules[] }
  │  requires admin session + same-origin; zod-validated with explicit safe
  │  bounds (no negative/NaN/Infinity/absurd values, thresholds must be
  │  ordered healthy ≥ acceptable ≥ low, no duplicate service slugs)
  │  → new PricingVersion row, status DRAFT. PRICING_VERSION_CREATED audit event.
  ▼
/admin/pricing/[id]   ◄── owner reviews rates/assumptions before committing to them
  │
  ▼ (only from DRAFT — a version with zero rules cannot activate)
POST /api/admin/pricing/versions/[id]/activate
  │  same transaction: any version currently ACTIVE for the same citySlug
  │  is retired (PRICING_VERSION_RETIRED, reason "superseded"), then this
  │  one becomes ACTIVE (PRICING_VERSION_ACTIVATED). The database's own
  │  partial unique index is what actually prevents two ACTIVE rows for
  │  the same city if two activations race (D027) — the retire-then-
  │  activate transaction is a courtesy, not the real guarantee.
  ▼
Every subsequent /api/lead/price call for this citySlug now resolves to
this version (resolvePricing() → AUTHORITATIVE_VERSIONED) until it is
superseded or retired.

POST /api/admin/pricing/versions/[id]/retire   (from DRAFT or ACTIVE)
  │  terminal — a RETIRED version can never be reactivated (rejected with
  │  INVALID_TRANSITION), so nobody accidentally resurrects stale numbers
  ▼
RETIRED — still readable (version detail, simulator, and any historical
QuoteSnapshot/EconomicsSnapshot that referenced it while active remain
exactly as they were computed — never recalculated retroactively)
```

### Pricing simulator (owner-facing, not a customer surface)

```
/admin/pricing/simulator
  │  owner picks a pricing version (any status — draft, active, or
  │  retired), a service, and an area
  ▼
POST /api/admin/pricing/simulate   (fired twice in parallel by the UI —
  │                                  INSTALL_ONLY and MATERIAL_AND_INSTALL,
  │                                  so both scenarios are always shown
  │                                  side by side, spec section 38)
  │  calls the exact same computeCustomerPrice/computeEconomics functions
  │  as the real price route — no separate approximation (spec section 39)
  ▼
Two cards: customer-facing breakdown (subtotal/tax/total/minimum-applied)
and internal economics (payout/material/processing/CAC/other/
contribution profit/margin/quote health) — clearly labeled "never shown
to the customer," side by side for comparison.
```

### What Session E did NOT change in the customer-facing funnel

Every quote-funnel step above this section is unchanged in shape and
behavior. The only difference a customer could ever notice is that the
number itself now comes from real, versioned Toronto assumptions instead
of a development placeholder — and only once an owner has actually
activated a version (`docs/ADMIN_OPERATIONS.md` "Setting up Toronto
pricing"). No new customer-facing step, field, or screen was added.

## Session F — Offer and field workflow

The real primary path for getting a professional onto a job, replacing
the direct-assign step in the Session D diagram above (D035):

```
/admin/jobs/[id]  (status READY_FOR_ASSIGNMENT)
  │
  ▼
/admin/professionals?offerTo=[jobId]   ◄── admin picks an eligible professional, enters an amount
  │
  ▼
POST /api/admin/jobs/[id]/offer  { professionalId, offerAmountMinor }
  │  server-enforced eligibility (same checks as the old assign route:
  │  professional.active, matching ProfessionalService) PLUS a valid
  │  offerAmountMinor (integer cents, server-validated bounds)
  │  → JobOffer row created (status OFFERED), Job.status → OFFERED
  │  → JOB_OFFERED audit event
  ▼
Professional logs into /pro (fully separate session — D032) and sees
this job under "Offered to you"
  │
  ├─── POST /api/pro/jobs/[id]/decline { reason?, note? }
  │      → JobOffer.status → DECLINED (reason/note recorded)
  │      → Job.status → READY_FOR_ASSIGNMENT (back in the pool)
  │      → JOB_OFFER_DECLINED audit event, actorProfessionalId set
  │      → Admin must manually re-offer — never automatic (spec section 26)
  │
  └─── POST /api/pro/jobs/[id]/accept
         → JobOffer.status → ACCEPTED
         → Job.status → OFFERED → ASSIGNED, assignedProfessionalId set
         → JOB_OFFER_ACCEPTED audit event
         → Professional now sees full job detail (PII no longer minimized — D037)
                ▼
         POST /api/pro/jobs/[id]/en-route    → Job.status → EN_ROUTE   → JOB_EN_ROUTE
                ▼
         POST /api/pro/jobs/[id]/arrived     → Job.status → ARRIVED    → JOB_ARRIVED
                ▼
         POST /api/pro/jobs/[id]/start       → Job.status → IN_PROGRESS → JOB_STARTED
                ▼
         POST /api/pro/jobs/[id]/problem  { reasonCode, note? }   (optional, any time from
                → ProblemReport created, Job.status UNCHANGED        ASSIGNED through IN_PROGRESS)
                → JOB_PROBLEM_REPORTED audit event — flags Admin, does not auto-resolve (D036)
                ▼
         POST /api/pro/jobs/[id]/complete   → Job.status → COMPLETED  → JOB_COMPLETION_REPORTED
                (professional-reported completion only — not paid, not payout-sent,
                 not customer-confirmed; no payment phase exists yet)
  ▼
/admin/jobs/[id] now shows: full offer history (including any declines),
every field-progress timestamp, any problem reports, and — once an offer
was accepted — the estimated (Session E) vs. actual (this JobOffer)
compensation comparison (D038)
```

Every transition above is validated against the same single
`src/lib/server/job-status.ts` table as the Session D diagram's
`/api/admin/jobs/[id]/status` route — professional-driven endpoints are
just additional, more specific entry points into that one table, not a
second, competing set of rules (D034).

### Concurrency, made explicit (spec section 53)

Two races are closed, not just handled optimistically:

- **Professional double-taps Accept** (or any field action) — the
  second request is recognized as the same professional reaching the
  same already-achieved end state and returns success, not an error
  (found and fixed during this session's own testing — see
  `docs/PROJECT_STATUS.md` "Bugs Found").
- **Admin withdraws an offer while the professional is accepting it** —
  a database partial unique index (`JobOffer_one_open_per_job`, D035)
  backstops the application-level conditional update; exactly one side
  wins, never both, never a corrupted intermediate state.

### What Session F did NOT change in the customer-facing funnel or Session E pricing

The customer quote funnel and the Session E pricing/economics engine
are both completely unchanged. `EconomicsSnapshot.
professionalPayoutEstimateMinor` (Session E) and `JobOffer.
offerAmountMinor` (Session F) are computed and stored entirely
independently — accepting an offer never touches the immutable
economics snapshot, and creating an offer never reads or writes it
beyond displaying it as a reference figure in the Admin offer form.

## Session G — Payment, completion confirmation, and payout workflow

```
Booking intent (Job created, NEW)
  → Payment (/quote/payment → create-order → capture-order → CAPTURED)
  → Admin review (REVIEWING → READY_FOR_ASSIGNMENT)
  → Offer (D044: rejected server-side unless Payment.status === CAPTURED)
  → Professional accept → field workflow (unchanged from Session F)
  → Professional reports completion (Job.status = COMPLETED)
  → Customer confirms (via one-time link) OR Admin overrides (Job.status = CONFIRMED)
       OR Customer reports an issue (Job.status stays COMPLETED, CustomerIssueReport created)
  → Payout eligibility computed (Payout row materializes ELIGIBLE, only if no open issue)
  → Admin pays the professional outside Servino, records it (Payout.status = PAID)
```

The payment step sits between Timing and Confirmation in the funnel
(D040) — `Lead.currentStep` goes `TIMING → PAYMENT → CONFIRMATION`
instead of straight to `CONFIRMATION`. Full detail on each stage in
`docs/PAYMENTS.md` and `docs/PAYOUTS.md`; the reasoning behind the
D044 payment gate, the funnel placement, and the payout-eligibility
trigger points is in `docs/DECISIONS.md` D039–D044.

The customer issue path and the admin-override path both feed the same
payout-eligibility computation (`maybeCreatePayoutEligibility()`) —
there is no separate "issue workflow" state machine, just a live check
(no unresolved `CustomerIssueReport`) each time eligibility is
computed, plus a symmetric check the other direction
(`holdPayoutIfEligible()`) if an issue arrives after eligibility was
already computed. See `docs/PAYOUTS.md` "Concurrency" for the full
three-layer race-closing story.
