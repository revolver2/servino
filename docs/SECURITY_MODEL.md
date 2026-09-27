# Security Model

_Updated Session F. Documents what's actually implemented and verified —
not the full threat model of the eventual marketplace (spec section 66),
which grows with each phase that introduces new attack surface (payments,
matching, messaging, etc.)._

## Response headers (added Phase C)

`next.config.ts` sets `X-Content-Type-Options: nosniff`, `X-Frame-Options:
DENY`, `Referrer-Policy: strict-origin-when-cross-origin`, and a
`Permissions-Policy` denying camera/microphone/geolocation, globally.
Verified present via a committed test (`tests/e2e/injection.spec.ts`).

**Known gap:** no Content-Security-Policy. Deliberately not attempted in
Phase C — a CSP needs careful tuning against Next.js's own inline
scripts/styles (dev overlay, hydration data) and risks breaking the app
if rushed. Worth a dedicated pass before production launch, not a rushed
addition here (see `docs/DECISIONS.md` D017).

## Trust boundary: server never trusts the browser for anything financial

The single most important rule introduced in B2 (spec section 6):

- `/api/lead/price` takes **only** a `sessionId`. It ignores anything the
  client might send for price — it loads the lead's own already-persisted,
  already-validated inputs and recomputes independently via
  `PricingAdapter`. The resulting `QuoteSnapshot` is what's authoritative,
  never anything the browser displayed.
- `/api/lead/booking-intent` takes only a `sessionId`. It looks up the
  lead's latest `QuoteSnapshot` server-side — the client cannot specify
  which price to book against.
- Verified empirically, not just by code review: a production build with
  no mock-pricing flag set shows "pricing unavailable" rather than a
  fabricated number (carried over from B1, re-confirmed unaffected in B2).
- **Phase C financial manipulation testing** (`tests/e2e/price-security.spec.ts`,
  committed): attempted to inject a fake `totalMinor`/`subtotalMinor` into
  the price request (ignored — server recomputes regardless of extra
  fields); attempted to point a booking intent at a forged
  `quoteSnapshotId` (ignored — server looks up the lead's own real
  snapshot); attempted to mutate an already-frozen `QuoteSnapshot` by
  changing the lead's inputs afterward (the old snapshot's values stayed
  exactly as originally computed); verified price computation is
  deterministic (identical inputs → identical money, every time, across
  concurrent calls).

## Trust boundary: confirmation

`/quote/confirmation` (spec sections 23–24) never decides success from a
query parameter, `localStorage`, or client-held `QuoteState`. It calls
`GET /api/lead/confirmation`, which only returns `"confirmed"` if a real
`BookingIntent` row exists for that session. **Verified**: a fresh browser
context with no prior interaction, navigating directly to
`/quote/confirmation`, shows "No submitted project found" — never a
success screen. See `docs/PROJECT_STATUS.md` Tests for the exact test.

## Server-side re-validation (never trust client-submitted business data)

Every `/api/lead/*` route re-validates rather than trusting the client:

- `serviceSlug` checked against the enabled-services list.
- Postal code re-validated and serviceability re-derived server-side —
  the client never gets to directly assert a `citySlug`.
- `LeadStatus`/`currentStep` transitions are monotonic
  (`furthestStatus`/`furthestStep`) — a stale or out-of-order request can
  never regress a lead backward, closing a real race found during testing
  (see `docs/DATA_MODEL.md` "Known races").
- Every request body is validated with `zod` schemas
  (`src/lib/server/schemas.ts`) — malformed/missing/wrong-type fields are
  rejected with `VALIDATION_ERROR` before touching the database.

## Idempotency (spec sections 10/22/33)

See `docs/DATA_MODEL.md`/`docs/WORKFLOWS.md` for the full mechanism per
endpoint. Headline guarantee, verified under **real concurrency** (not
just sequential retries): three simultaneous `POST /api/lead/booking-intent`
requests for the same lead all resolve to the identical `bookingIntentId`
— proven with `Promise.all()` in the test suite, not assumed.

## Anti-abuse on the public contact endpoint (spec sections 30–32)

- **Honeypot** (`src/lib/server/spam-signals.ts`): a hidden form field a
  real user never fills. If populated, the request is silently
  suppressed — returns a success-shaped response but writes nothing to
  the database, so a bot doesn't learn it was detected. Verified: a
  honeypot-tripped submission produces zero `ContactInfo` rows.
- **Submission timing signal**: if the contact form is submitted less
  than 1 second after it rendered, it's logged as suspicious but **never
  blocks** the request alone (spec section 31 explicitly warns against
  penalizing fast/autofill users) — it's one signal, not proof.
- **Rate limiting** (`src/lib/server/rate-limit.ts`): in-memory, fixed-window,
  keyed by `${endpoint}:${ip}`. Verified to actually trigger (429) under
  load. Thresholds are deliberately asymmetric: `/api/lead/progress`
  (called on every step transition — frequent, non-sensitive, no PII, no
  financial/booking record) allows 300/60s; `/api/lead/contact`,
  `/api/lead/timing`, `/api/lead/booking-intent` (the actually
  abuse-sensitive endpoints) stay at 10–20/60s. The progress limit was
  raised from an initial 120/60s in Phase C after real testing showed it
  could false-positive under legitimate load — see `docs/DECISIONS.md`
  D016. **Documented limitation**: single-process only — a multi-instance
  production deployment needs a shared store (Redis `INCR`+`EXPIRE` is
  the natural fit, consistent with spec section 75's Redis mention for
  background work) for this to hold across instances. Not implemented to
  avoid pulling in Redis for a single-VPS MVP.
- **No CAPTCHA** — per spec section 34, deliberately not added by default;
  the above three layers are considered sufficient until real abuse data
  says otherwise.

## Data minimization (spec section 37)

- Contact details (name/email/phone) are requested only after a price has
  been viewed — never required to get a price.
- No DOB, government ID, payment info, or unrelated demographics
  collected anywhere in this funnel.
- Contact details are **never cached in the browser** — `ApiLeadAdapter`
  deliberately does not mirror `ContactInfo` into `localStorage`
  (unlike project/measurement data, which is cached client-side for
  resume UX). The only local trace is a boolean `contactCaptured` flag
  used for step-guard UX, never the actual name/email/phone.
- Analytics events are a closed TypeScript union
  (`src/lib/quote/analytics/analytics-adapter.ts`) built only from
  IDs/enums/numbers — there is no field on any event variant that could
  carry PII, so a leak would be a compile error, not a code-review miss.
  Verified by capturing the full event stream from a real E2E run and
  regex-checking for email/phone patterns: none found.

## Money handling

Every money value in this system is an integer in minor units (cents) —
`subtotalMinor`, `taxMinor`, `totalMinor` — both in the `PriceResult`
type and the `QuoteSnapshot`/`EconomicsSnapshot` database columns. No
floating-point arithmetic is used for money anywhere in the pricing path
(`src/lib/quote/pricing/mock-pricing-adapter.ts`,
`src/lib/pricing-engine/*`). Area (`totalAreaM2`) is stored as
`Decimal(6,2)` in Postgres, not a float column; percentage assumptions
in `PricingVersion` (tax rate, payout %, margin thresholds, etc.) are
`Decimal(5,2)`/`Decimal(6,2)`, same reasoning. All rounding is
centralized in `src/lib/pricing-engine/rounding.ts`
(`roundMinor`/`applyPercent`/`roundPercent`) — no component or route
rounds money independently, so the same amount is never rounded two
different ways in two different places.

## Photo handling (spec section 29)

No object storage exists yet. An uploaded photo is validated client-side
(type/size), converted to an in-memory `blob:` URL for local preview only,
and **never uploaded to any server**. No photo table exists in the
database, and `attachMediaReference()` in `ApiLeadAdapter` is a
browser-cache-only operation. This is a real, current limitation (not a
security feature) — production photo storage still needs: private object
storage, server-side type/size re-validation, server-generated storage
keys, signed time-limited access URLs, and malware/content scanning. None
of that exists yet because no bytes ever leave the browser.

## Database access

- No database credentials in the client bundle — `DATABASE_URL` is only
  read server-side (`src/lib/server/prisma.ts`, Node runtime route
  handlers).
- No direct browser-to-database access — every write goes through a
  validated, rate-limited API route.
- Prisma (parameterized queries throughout; the one raw SQL usage —
  `SELECT ... FOR UPDATE` in `/api/lead/progress` — uses Prisma's tagged-
  template `$queryRaw`, which parameterizes interpolated values, not
  string concatenation).
- Migrations are committed to the repo (`prisma/migrations/`), not
  applied via ad hoc schema sync — see `docs/DECISIONS.md` D011.

## Logging

Server logs (`console.error` on failure paths) include operation name,
lead ID where relevant, and error objects — never full email/phone
(contact fields are never logged) and never secrets. The honeypot log
includes only the requesting IP, not the submitted (bot) content.

## Known gaps / not yet addressed

- Rate limiting is single-process (see above) — needs a shared store
  before horizontal scaling.
- No CSRF-specific protection beyond same-origin `fetch()` calls from the
  app's own pages — acceptable for now since there's no cookie-based
  session/auth yet (spec section 63, Google OAuth, is explicitly out of
  scope through B2). Revisit when authentication is introduced.
- No WAF/DDoS-layer protection — that's infrastructure-level (spec
  section 74), not application code, and out of scope until real VPS
  deployment.
- `npm audit` still reports the pre-existing `prisma` CLI devDependency
  finding from Phase A (D006) — confined to the CLI, never imported into
  application code, not shipped to production. Unchanged through Phase C.
- No Content-Security-Policy header (see "Response headers" above) —
  real gap, deliberately deferred rather than rushed.
- No automated accessibility audit in CI — Phase C's `aria-progressbar-name`
  finding came from a manual Lighthouse run, not a committed check. The
  one specific regression (progress indicator's accessible name) has a
  committed test; broader automated a11y scanning (e.g. axe-core wired
  into the Playwright suite) is not yet in place.

## Session D — Admin authentication and authorization

**Password storage.** `AdminUser.passwordHash` uses Node's built-in
`scrypt` (`src/lib/server/password.ts`), salted, encoded as
`scrypt:N:r:p:saltHex:hashHex`. No plaintext password is ever stored,
logged, or included in `AuditEvent.metadata`. There is no default admin
account and no `admin/admin` fallback — `scripts/admin-bootstrap.mjs`
must be run explicitly, once, with real credentials the operator
supplies via environment variables; it fails loudly (non-zero exit) if
either `ADMIN_BOOTSTRAP_EMAIL` or `ADMIN_BOOTSTRAP_PASSWORD` is missing,
the email is malformed, or the password is under 12 characters.

**Sessions.** DB-backed, not JWT (`docs/DECISIONS.md` D024) — the
cookie holds a random 256-bit token; only its SHA-256 hash is ever
persisted (`AdminSession.tokenHash`). `requireAdminSession()`
(`src/lib/server/admin-auth.ts`) is the single authorization boundary,
called independently by both halves of every admin surface:

1. `src/app/admin/(protected)/layout.tsx` — redirects to `/admin/login`
   if no valid session.
2. Every `/api/admin/*` route handler — returns `401 UNAUTHORIZED` if no
   valid session, regardless of whether the request came through a
   hidden/rendered admin page (spec section 43: page-hiding was never
   the actual mechanism).

Cookie is `HttpOnly`, `Secure` in production (`NODE_ENV === "production"`),
`SameSite=Lax`, 12-hour expiry. Logout (`POST /api/admin/auth/logout`)
sets `AdminSession.revokedAt` immediately — no "still valid until it
expires" window like an unrevoked JWT would have.

**Login response timing.** `verifyPassword()` runs against a fixed,
never-valid dummy hash even when the submitted email matches no
`AdminUser` row, so response timing doesn't reveal whether an email
address has an account. The error message is identical
("Invalid email or password.") for "no such user," "inactive user," and
"wrong password" — verified by a committed test.

**Rate limiting.** `/api/admin/auth/login`: 8 attempts / 5 minutes per
IP — a separate, tighter bucket than any customer-funnel endpoint (spec
section 47), since login is the highest-value brute-force target in the
app. `/api/admin/*` mutation routes: 60/minute per IP (generous — sized
for a single owner's real workload, not for testing volume; see the
"Testing" note below). Both use the same in-memory limiter as the
customer funnel (`src/lib/server/rate-limit.ts`, untouched, still
single-process — same documented production-scaling gap as before).

**CSRF / origin protection.** Every admin mutation route calls
`isSameOrigin(request)` first: if an `Origin` header is present, it must
match the request's own `Host`, or the request is rejected with `403
FORBIDDEN` before touching the database. Combined with `SameSite=Lax` on
the session cookie, this closes the main CSRF vector (a cross-site form
POST) without needing a separate signed CSRF token — deliberately the
smallest mechanism that actually covers the threat (spec section 46).
This was previously an open gap noted above ("No CSRF-specific
protection... revisit when authentication is introduced") — Session D is
that revisit, and it applies only to the new `/api/admin/*` surface; the
customer funnel still has no cookie-based session and is unaffected.

**Mass assignment.** Every admin mutation has an explicit zod whitelist
(`src/lib/server/admin-schemas.ts`) — a client can never inject
internal IDs, `createdAt`/`updatedAt`, audit actor, or fields outside
that whitelist. Verified by committed tests: a forged `id` on
professional-create is ignored (server generates a real cuid); a
forged `createdAt` on professional-update is ignored; a smuggled
`assignedProfessionalId` on the job status-change endpoint (which has
no business assigning professionals) has no effect.

**IDOR / BOLA.** A real, authenticated customer-funnel session (not
just a blank browser) cannot read any `/admin/*` page or call any
`/api/admin/*` route — verified by a committed test that first
completes a real funnel submission, then attempts admin access from
that same browser context. Admin resource IDs (lead/job/professional)
carry no special trust — every lookup still goes through
`requireAdminSession()` first.

**Stored XSS.** A `<script>` payload in a professional's `displayName`
is stored and echoed back as literal text in the edit form — verified
that it never executes (`window.__xss_fired` stays `undefined`) and
that the raw payload string is preserved (not silently stripped, which
would be a data-loss bug of its own). React's default JSX escaping is
what provides this; no manual sanitization was added or needed.

**Accessibility.** `axe-core` (WCAG 2A/2AA) was run against all seven
primary admin screens. One real, critical finding on first pass — the
job status `<select>` had no accessible name — fixed with a
visually-hidden `<label>`; zero violations on re-scan, including no
color-contrast violations on any status chip (checked specifically
given a similar contrast defect was found in Phase S1). See
`docs/qa/session-d/README.md`.

**Testing note.** The Session D Playwright tests authenticate once for
the whole run via `globalSetup`/`storageState`
(`tests/e2e/global-setup.ts`), not once per test — both to avoid
tripping the real 8/5min login rate limit purely from test volume, and
because re-authenticating per test was never necessary. Tests that
specifically need to be unauthenticated (or a different real customer
session) override with `test.use({ storageState: { cookies: [],
origins: [] } })`.

**Known gaps, same category as the customer-funnel ones already listed
above — not solved by Session D:**
- Rate limiting is still single-process (same limiter, same gap).
- No CSP (still deferred, unchanged).
- No per-role permission enforcement — `AdminRole` values beyond
  `SUPER_ADMIN` exist in the schema but nothing branches on them yet
  (see D022). Acceptable for a single-owner MVP; must be built before a
  second admin user with restricted access is added.
- `AdminNote` has no API/UI — internal notes are not yet a real
  feature, just forward-compatible schema (see `docs/DATA_MODEL.md`).

## Session E — Pricing and unit-economics security

**Never trusts the browser for money, extended to versioned pricing.**
`/api/lead/price` still takes only a `sessionId` (unchanged from B2) —
Session E replaces what happens *inside* that route (`resolvePricing()`)
but not its trust boundary. The client cannot specify a pricing version,
a rate, or any economics assumption; every number comes from the
`ACTIVE PricingVersion` the server itself looks up.

**Fail-closed, with the mock escape hatch removed in production
(D026).** Before Session E, a production build could still be pointed at
`MockPricingAdapter` via `NEXT_PUBLIC_USE_MOCK_PRICING=true`. That bypass
is gone: `resolvePricing()` checks `NODE_ENV === "production"` first and,
if true, never falls back to mock regardless of any environment flag —
either a real `ACTIVE` version prices the quote, or the route returns
`PRICING_UNAVAILABLE`. Verified by a committed test that sets
`NODE_ENV=production` AND the mock flag simultaneously and confirms the
result is never `MOCK_DEV`.

**Pricing mutation endpoints require admin auth, verified directly.**
`POST /api/admin/pricing/versions`, `.../activate`, `.../retire`, and
`.../simulate` all call `requireAdminSession()` and `isSameOrigin()`
first, same pattern as every other admin mutation (Session D). Verified
by a committed test that all four reject an unauthenticated caller.

**Server-side validation with explicit safe bounds
(`src/lib/server/admin-pricing-schemas.ts`).** Every money field is a
finite, non-negative integer capped at a defined maximum (`10,000,000`
minor units); every percent field is finite and within `[0, 100]`.
Verified directly, not just by code review: committed tests attempt
negative rates, `NaN`/`Infinity`, absurdly large amounts, percentages
over 100, an unknown service slug, and out-of-order health thresholds
(`healthy < acceptable`) — all rejected with `VALIDATION_ERROR` before
touching the database.

**Mass assignment.** A client-supplied `id` or `status` on version
creation is ignored — the server always mints a fresh `cuid` and always
starts a new version at `DRAFT`, regardless of what the request body
claims. Verified by a committed test.

**Activation race, verified under real concurrency, not just reasoned
through.** Two simultaneous `POST .../activate` calls for two different
`DRAFT` versions of the same city are fired with `Promise.all()` in a
committed test — confirming exactly one `PricingVersion` row ends up
`ACTIVE` for that city afterward (backstopped by the database partial
unique index, D027; the losing request receives `409 CONFLICT` via the
route's caught `P2002`, not a silent double-activation).

**Clean separation: professional payout, material cost, CAC, and quote
health are never sent to the customer.** `PriceResult` (the type the
customer-facing price route returns) has no field for any of this —
it's a compile-time guarantee, not a runtime filter that could be
forgotten on one code path. `EconomicsSnapshot` is only ever queried
from admin-authenticated code (`src/lib/admin/jobs.ts`,
`/api/admin/pricing/simulate`), never from `/api/lead/*`.

**No money movement.** Session E calculates and stores an *estimate* of
what a professional would be paid — it never transfers money, records a
payout as sent, or integrates any payment/payout provider. `docs/DATA_MODEL.md`'s
`EconomicsSnapshot.professionalPayoutEstimateMinor` is explicitly an
estimate field name, not a ledger entry.

**Determinism, verified.** `computeCustomerPrice`/`computeEconomics`
are pure functions of their inputs — a committed test calls the same
version/rule/input five times and asserts byte-identical results, and a
second test confirms a metric area and its exact imperial-converted
equivalent (`10 m² == 107.6391042 ft² × 0.09290304`) produce the
identical total, not merely a close one.

**Accessibility re-verified for the new admin surfaces.** `axe-core` run
against `/admin/pricing`, `/admin/pricing/[id]`, `/admin/pricing/new`,
`/admin/pricing/simulator`, and a job detail page with an economics
section rendered. Three real findings on first pass — a `critical`
missing-label violation (12 unlabeled rate-table `<input>`s, fixed with
per-cell `aria-label`s and a `<th scope="row">`), a `moderate`
heading-order skip (simulator's scenario cards used `<h3>` directly
under the page's `<h1>` with no `<h2>` — fixed), and a `serious`
color-contrast violation on the new economics UI's negative-profit text
and quote-health chip (fixed — see D030). Zero violations on re-scan,
including the customer-facing price page.

## Session F — Professional authentication and authorization

**Fully independent trust boundary from Admin (D032).** Professional
auth (`src/lib/server/pro-auth.ts`) is structurally similar to admin
auth (DB-backed session, SHA-256 token hash, HttpOnly/`Secure`-in-
production/`SameSite=Lax` cookie) but shares nothing operationally —
own cookie name (`servino_pro_session`, never `servino_admin_session`),
own session table (`ProfessionalSession`), own authorization function
(`requireProfessionalSession()`). Verified directly: a valid admin
session grants zero access to any `/pro/*` page or `/api/pro/*` route,
and vice versa — there is no code path where one boundary's session
lookup could ever succeed against the other's cookie, since the cookie
names themselves differ and each lookup queries a different table.

**Password storage** reuses the existing generic scrypt primitive
(`src/lib/server/password.ts`, unchanged since Session D) — this is not
new admin-specific code being reused inappropriately; the function
takes a password and a stored hash, nothing actor-specific. No default
professional password exists anywhere; `Professional.passwordHash` is
`null` until a professional completes activation.

**Activation tokens (D033).** `ProfessionalActivationToken` — a
cryptographically random 256-bit token (`randomBytes(32)`, same
generation as every other session token in this codebase), only its
SHA-256 hash ever persisted, 24-hour expiry, single-use enforced by a
conditional update (`WHERE usedAt IS NULL`, count-checked — not a
read-then-write, closing the reused-token race). The raw token is
returned to Admin **exactly once**, in the API response that creates
it, and is never written to `AuditEvent.metadata`, never logged.
Verified by committed tests: a valid token activates and auto-signs in;
a second use of the same token is rejected (`400`) while the first
activation's password keeps working; an expired token is rejected; a
garbage/malformed token is rejected with `400`, never a `500`.

**Login response timing.** Same principle as admin login (spec section
48) — `verifyPassword()` runs against a fixed dummy hash even when no
matching `Professional`/`passwordHash` exists, so response timing never
reveals account existence or activation status.

**Rate limiting.** `professional-login` (8/5min/IP) and
`professional-mutation` (60/min/IP) — separate buckets from every admin
and customer-funnel limiter, verified never to share state. Verified
directly: repeated failed logins from an isolated test IP eventually
receive `429`.

**CSRF/origin.** Every `/api/pro/*` mutation calls the same
`isSameOrigin(request)` check as admin routes (same function signature,
separately imported from `pro-auth.ts`) — verified: a mismatched
`Origin` header is rejected with `403` before touching the database.

**IDOR / BOLA — P0, verified with five dedicated committed tests, not
just reasoned through.** Professional A, authenticated with their own
real session, cannot: see Professional B's profile via `/pro/profile`
(the page is server-scoped to `requireProfessionalSession()`'s own
result, never a route parameter); accept an offer made to B (`404`, not
a distinguishable "exists but isn't yours" — `getOpenOfferForProfessional`
returns null for both "no such offer" and "not your offer," on purpose);
decline an offer made to B (same); change status on B's already-
accepted job via any of en-route/arrived/start/complete/problem (all
four field-transition endpoints plus the problem-report endpoint route
through `getJobAssignedToProfessional`, which checks
`job.assignedProfessionalId === professional.id` before anything else);
or see B's compensation amount by requesting B's job detail directly
(the page returns `notFound()`, not a partial/redacted view). The
underlying pattern: every professional-facing query and mutation
derives "is this my job" from the authenticated session plus a real
database relationship (`assignedProfessionalId`, or an `OFFERED`
`JobOffer.professionalId`) — never from a client-supplied ID alone.

**Mass assignment / money tampering.** Admin offer creation
(`POST /api/admin/jobs/[id]/offer`) server-validates `offerAmountMinor`
as a finite, non-negative integer within a defined maximum — verified
directly: negative, `NaN`, `Infinity`, and absurdly large values are
all rejected with `400` before touching the database. Every
professional-facing mutation route (`accept`, `decline`, `en-route`,
`arrived`, `start`, `complete`, `problem`) takes **no** money or
actor-identity field from the request body at all — `offerAmountMinor`
and `professionalId` are structurally impossible to smuggle because no
code path reads them from anywhere except the already-stored `JobOffer`
row and the authenticated session respectively; verified by committed
tests that attempt exactly this and confirm the forged values have zero
effect on the resulting database state.

**Concurrency, verified under real concurrency, not just sequential
retries.** Three committed tests using `Promise.all()`: two simultaneous
accept attempts from the same professional (exactly one `ACCEPTED`
`JobOffer`, exactly one `JOB_OFFER_ACCEPTED` audit row — no duplicate);
Admin withdrawing an offer racing the professional accepting it
(exactly one side wins, backstopped by the `JobOffer_one_open_per_job`
partial unique index, D035); duplicate concurrent completion calls (one
`JOB_COMPLETION_REPORTED` audit row, not two). The first and third of
these found and fixed a real race-handling bug in this session's own
new code before passing — see `docs/PROJECT_STATUS.md` "Bugs Found."

**Clean separation: economics and unnecessary PII, compile-time
guaranteed.** `ProJobView` (the type every `/pro/*` page and the
professional-facing job queries actually return) has no field for
`EconomicsSnapshot` data, CAC, contribution margin, quote health, other
professionals' information, or customer email at any stage — the same
"can't leak what has no field to hold it" pattern as Session E's
customer-facing `PriceResult` (D037). Postal code and phone are
included only when `job.assignedProfessionalId === professionalId`
(i.e. after acceptance); before that, the projection function
statically omits them regardless of what's actually in the database.

**Accessibility re-verified for the new professional and admin
surfaces.** `axe-core` run against 10 pages spanning `/pro/login`,
`/pro`, `/pro/jobs`, two `/pro/jobs/[id]` states, `/pro/profile`, and
three admin job-detail states plus the professional detail page. Two
real findings on first pass, both repeats of mistakes already fixed in
earlier sessions: a nested `<main>` landmark on every `/pro` page
(`ProShell` made the identical mistake `AdminShell` made and fixed once
in Session D — corrected the same way, a plain `<div>`), and a `dlitem`
violation on the admin job detail page's new field-timestamp grid
(`<dt>`/`<dd>` used outside a `<dl>` — switched to plain paragraphs,
since it's a compact visual grid, not a real definition list). Zero
violations on re-scan, all 10 pages.

**No money movement, anywhere.** Session F calculates and stores an
agreed compensation figure (`JobOffer.offerAmountMinor`) — it never
transfers money, integrates a payment processor, or records anything as
"paid." `Job.status = COMPLETED` means professional-reported completion
only, worded that way everywhere it appears to both the professional
and Admin.

**Known gaps, same category as the customer-funnel and admin ones
already listed above — not solved by Session F:**
- Rate limiting is still single-process (same underlying limiter, same
  gap, now with two more buckets sharing it).
- No CSP (still deferred, unchanged).
- No email delivery for activation links — a real gap if a link is lost
  before Admin delivers it (a new one can always be generated).
- No offer-expiration enforcement — a stale open offer blocks
  re-offering until Admin manually withdraws it; no background job
  exists to expire it automatically (a deliberate simplicity choice for
  1–4 professionals, spec section 23).

## Session G — Payment and payout security

- **PCI scope**: Servino never collects raw card numbers — all card
  entry happens inside PayPal's own hosted/SDK surfaces. No card data
  ever reaches Servino's servers.
- **Server-authoritative money**: payment amount is always
  `QuoteSnapshot.totalMinor`, never read from a request body/query
  param/hidden field. "Captured" is only ever set by a server-side
  provider call or a verified webhook — never inferred from a client
  claim, redirect, or popup closing. See `docs/PAYMENTS.md` "Server-side
  authority."
- **Money-tampering defenses** (tested — `tests/e2e/payment.spec.ts`):
  a forged/foreign `providerOrderId` is rejected before any provider
  call; a provider-reported amount that doesn't match the expected
  amount never results in `CAPTURED`.
- **Webhook authenticity**: every delivery is verified (PayPal's own
  signature-verification endpoint, or the test double's HMAC check)
  before anything in the payload is trusted. An invalid signature,
  missing headers, or malformed body is rejected — HTTP 400, no
  `PaymentEvent` row, no state change. Tested:
  `tests/e2e/webhook.spec.ts`.
- **Webhook idempotency**: `PaymentEvent.providerEventId` is a unique
  DB constraint — the real dedup mechanism, not application logic. The
  same event delivered 1/10/100 times is applied exactly once (tested).
- **Payment/payout IDOR**: every `/api/lead/payment/*` route resolves
  the job through the caller's own `sessionId`; a payment/payout can
  never be created, captured, refunded, or recorded on behalf of
  another customer's or another job's data. Tested:
  `tests/e2e/payment.spec.ts` (customer IDOR).
- **Financial concurrency**: conditional DB updates (capture,
  admin-confirm, payout-record) and a partial unique index (refund —
  `Refund_one_active_per_payment`) close double-processing races.
  `tests/e2e/financial-concurrency.spec.ts` caught and this session
  fixed a real double-refund race — see `docs/PROJECT_STATUS.md`
  "Bugs Found."
- **The issue/payout invariant**: an unresolved `CustomerIssueReport`
  and a `PAID` payout must never both exist. Enforced unconditionally
  at the moment a payout is actually recorded (not just at eligibility
  computation), because that's the point real money is confirmed sent.
  See `docs/PAYOUTS.md` "Concurrency."
- **Production fail-closed**: a production build with missing/
  incomplete PayPal configuration never falls back to the deterministic
  test provider — `getPaymentProvider()` selects
  `UnavailablePaymentProvider`, which fails every call predictably.
  Verified by `scripts/verify-payment-provider-failclosed.mjs` (the
  Playwright test server always runs in a non-production mode, so this
  specific check needs a standalone script rather than an E2E test).
- **Secrets**: `PAYPAL_CLIENT_SECRET` and webhook verification are
  never logged; only safe provider reference IDs (order/capture/event
  IDs) appear in logs, audit metadata, or `PaymentEvent.summary`
  (itself a minimized, normalized subset of the provider payload, never
  the full raw webhook body).
- **Terms/Privacy**: reviewed this session for payment-collection and
  refund-handling language; the actual copy still needs a real legal
  review before the first paid customer — flagged, not resolved, in
  `docs/PROJECT_STATUS.md` "Remaining Legal/Business Confirmations."
- **Not called "escrow"**: Servino's payment/payout model is never
  described as escrow, a trust account, or similar in any
  customer/professional/admin-facing copy — see `docs/PAYOUTS.md`
  "Selected mode."

## Session H — Production hardening

**Content-Security-Policy, finally added.** `next.config.ts` now sends
a real `Content-Security-Policy` header (the previous "Known gap" above
is closed): `default-src 'self'`, PayPal's checkout/SDK domains
allow-listed for `script-src`/`frame-src`/`connect-src`, `'unsafe-inline'`
for `script-src`/`style-src` (never `'unsafe-eval'`), `object-src 'none'`,
`frame-ancestors 'none'`. **A nonce+`strict-dynamic` approach (Next's
own documented pattern) was tried first and reverted** — verified via
real Chrome testing, not just header inspection, that it broke this
app's statically-rendered pages, because a nonce can only be injected
into a dynamically-rendered response and most of Servino's routes are
static by design. Re-verified with zero CSP violations across 5 pages
plus an interactivity click test after switching to the
"without nonces" `next.config.ts` pattern. Conditional HSTS
(`Strict-Transport-Security`, production-only) was added alongside it.

**Production environment fails closed, verified directly.**
`checkProductionEnv()` (`src/lib/server/env.ts`) refuses to consider a
production boot safe unless `DATABASE_URL` is set and not
localhost/127.0.0.1, `NEXT_PUBLIC_SITE_URL` is set, not localhost, and
`https://`, and mock pricing is not explicitly enabled — feeding
`/api/health`'s `config` check and a standalone pre-deploy gate
(`scripts/validate-production-env.mjs`, run via `npm run validate:env`).
Verified against 10 explicit failure scenarios
(`scripts/verify-production-config-failclosed.mjs`, all passing) —
missing/localhost `DATABASE_URL`, missing/localhost/non-https
`NEXT_PUBLIC_SITE_URL`, mock pricing on in production, and the
inverse (a fully valid config passes; a non-production build is exempt
regardless of its own config, since only `NODE_ENV=production` boots
are the target of this check).

**Rate limiting stays single-process — now a confirmed-correct decision,
not just an unaddressed gap.** Session H settled the architecture
question the earlier "Known gaps" note above was waiting on: Servino
runs as a single Next.js instance on one VPS in production (D045), not
split across serverless instances — so the existing in-memory limiter
is already correct for the real deployment target and stays
unmodified. A shared-store (Redis) limiter is explicitly not built
(D046); if one ever is, it should fail closed (reject rather than
silently allow) on sensitive endpoints if the store becomes
unreachable — documented as a recommendation for that future work,
not implemented now since no such dependency exists.

**Secrets.** A full repo grep for private keys, API secrets, and
credential-shaped strings found nothing committed beyond the
already-known local-dev-only defaults (`.env.local`, gitignored). No
`.env*` file other than `.env.example` is tracked. `PAYPAL_CLIENT_SECRET`,
database credentials, and admin/professional session tokens are never
logged (unchanged from Session G/D, re-confirmed this session).
`NEXT_PUBLIC_*` variables are baked into the client bundle at `npm run
build` time, not read at request time — verified empirically by
rebuilding with different values and confirming a restart-only change
has no effect; documented in `docs/PRODUCTION_DEPLOYMENT.md` "Secrets"
with deploy-ordering guidance so this isn't rediscovered the hard way
in production.

**`/api/health`.** A new, unauthenticated readiness endpoint
(`app`/`database`/`config` checks). Deliberately never requires PayPal
configuration to report healthy — a payments-misconfigured deployment
is still a running, database-reachable app that should report `ok` for
uptime-monitoring purposes; payment-specific unavailability is its own,
separately-surfaced concern (`paymentsEnabled` in the customer-facing
payment-status response, not the infra health check).

**Production-config security regression, re-verified end to end.** All
173 pre-existing tests plus the new Session H checks
(`scripts/verify-production-config-failclosed.mjs`, `scripts/smoke-production.mjs`)
pass. One flaky failure during a full-suite rerun
(`professional-login` 429 in `pro-workflow.spec.ts`) was isolated and
reproduced as pure rate-limit contention from running the entire
~180-test suite serially against the same limiter buckets, not a
Session H regression — confirmed by rerunning that spec file alone
(all 7 tests passed).

**Known gaps, unchanged from before Session H (not solved here, not
this session's scope):**
- No per-role permission enforcement beyond `SUPER_ADMIN` (D022,
  unchanged).
- No CSRF token beyond same-origin checks (unchanged, still considered
  sufficient for the current cookie/session model).
- No WAF/DDoS-layer protection — infrastructure-level, addressed
  operationally (Cloudflare/host-level, see `docs/PRODUCTION_DEPLOYMENT.md`),
  not application code.
- `npm audit`'s pre-existing `prisma` CLI devDependency finding (D006)
  — confined to the CLI, not shipped to production, unchanged.
- No automated accessibility scanning in CI — axe-core checks
  (including Session H's own, covering all 8 new/changed surfaces,
  zero violations) are still run manually, not wired into a CI
  pipeline (no CI pipeline exists yet at all).
