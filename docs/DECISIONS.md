# Decision Log

## D001 — New repository at Desktop/servino

**Problem:** No existing Servino repository was found anywhere on the
machine when Phase A began.

**Alternatives:** (a) create a new repo in a new Desktop folder, (b) scaffold
inside the current working directory (`C:\Users\Moro`), (c) ask for a
different existing path.

**Decision:** New folder, `Desktop/servino`, confirmed with the owner before
scaffolding.

**Reason:** `C:\Users\Moro` is not a git repo and holds unrelated personal
files; a dedicated project folder keeps the repo clean and matches the
pattern of other projects on Desktop (brainrot-saas, family-calendar-ai).

**Reversibility:** Fully reversible — it's a plain folder that can be moved,
renamed, or deleted.

## D002 — Next.js App Router + Tailwind v4 + Prisma/PostgreSQL

**Problem:** No existing framework to inspect (see D001), so stack had to be
chosen fresh.

**Alternatives considered:** Remix, plain Vite SPA + separate API server,
Next.js Pages Router.

**Decision:** Next.js App Router (TypeScript, Tailwind v4), matching spec
section 73's explicit preference for Next.js on Vercel, with Prisma/
PostgreSQL for the database (spec section 69 default).

**Reason:** Directly matches the master spec's stated infrastructure
preference and gives SSR/SEO out of the box (spec section 79), which matters
for the public marketing surface.

**Reversibility:** High cost to change later (framework migration), but this
is exactly what the spec calls for, so low risk of needing to.

## D003 — Placeholder geometric logo instead of commissioning brand design

**Problem:** Spec section 11 asks for a full logo system (horizontal,
symbol, monochrome, white, favicon, app icon) but Phase A has no design
resource or approved final mark.

**Decision:** Built a simple, original geometric mark in code (rounded
square + S-curve connecting two colored nodes, representing Servino
connecting a homeowner and a professional) as inline SVG, with static
exports for the required variants.

**Reason:** Unblocks header/favicon/OG image needs now without fabricating
a "final" brand asset or blocking Phase A on design work. It avoids the
generic/cliché marks the spec explicitly rules out (wrench, hammer, hardhat,
robot, generic roof).

**Reversibility:** Fully reversible — swapping `Logo.tsx` and the
`public/logo-*.svg` files is a self-contained change with no other code
depending on the specific mark.

## D004 — Static `services-data.ts` instead of wiring the DB into the homepage

**Problem:** Spec section 6 says "keep services database-driven," but no
database is provisioned in Phase A and building the Services admin module
now would violate the "launch narrow" principle (section 0) and Phase A's
own scope.

**Decision:** Homepage reads from a typed static file shaped identically to
the eventual `Service`/`ServiceCategory` Prisma models.

**Reason:** Preserves the architectural intent (no component will need to
change when this becomes a real DB fetch) without building admin CRUD or a
DB connection before there's a reason to.

**Reversibility:** Fully reversible — replacing the import in `Services.tsx`
with a DB query is the only change needed once Phase D/E exists.

## D005 — Inspiration section ships with color/pattern swatches, not photos

**Problem:** Spec section 16 allows an Inspiration section, but section 96
forbids implying any image is real Servino work, and no verified project
photography exists yet.

**Decision:** Render styles as flat color/gradient swatches rather than
placeholder or stock photography.

**Reason:** Lets the section exist and be functional (feeds a future style
selection into the quote flow) without any risk of a swatch being mistaken
for a real completed project — unlike the Before/After section, which spec
section 15 requires to stay fully disabled until real photos exist.

**Reversibility:** Fully reversible — swap in real photography per style
whenever it exists.

## D006 — Pin Prisma to 7.10.0 instead of the default 8.0.0-rc.15

**Problem:** `npm install prisma` (no version pinned) resolves to
`8.0.0-rc.15`, which npm's `latest` dist-tag points to. Prisma 8 replaces the
classic local `generate`/`migrate dev` CLI with a platform-first CLI centered
on Prisma's own hosted product (`auth`, `project`, `postgres`, `deploy`,
`branch` — a PaaS-style workflow). There is no `prisma generate` command in
that CLI at all; the closest equivalent (`prisma contract emit`) is part of
a "contract" model tied to their platform concepts.

**Decision:** Pin both `prisma` and `@prisma/client` to `6.19.3` — the last
version before the platform-first CLI, and also the version `npm audit`
itself recommends (see below) — via exact devDependency versions.

**Reason:** Spec section 74 explicitly prefers a self-hosted VPS
(Hetzner/OVH/DigitalOcean) running your own Postgres instance, and section
43 warns against tight coupling to one provider. Adopting Prisma 8's
platform CLI as the default tool would default the project toward Prisma's
own hosted Postgres/deploy product rather than plain self-hosted Postgres.
A classic-CLI Prisma version is still just an ORM/query-builder against any
Postgres instance, which matches the spec's intent. `7.10.0` was tried
first, but `npm audit` flagged 4 high-severity findings in its
`@prisma/config` → `deepmerge-ts` transitive dependency (a stack-exhaustion
issue) and a `mysql2` transitive dependency (irrelevant to us — we don't
use MySQL — but still a supply-chain risk sitting in `node_modules`).
`6.19.3` is npm's own suggested fix version and was confirmed to still have
the classic `generate`/`migrate dev` CLI.

**Reversibility:** Fully reversible and worth revisiting deliberately later
— Prisma 8's platform product may be a reasonable option for Phase D/E, but
that should be a considered choice (with real research, matching the
pattern of `docs/research/PAYPAL_MARKETPLACE_FEASIBILITY.md`), not an
accidental default from an unpinned `npm install`.

## D007 — Route groups to separate marketing chrome from funnel chrome

**Problem:** Phase A's root layout rendered the full marketing `<Header>`/
`<Footer>` around every page. B1 needs the quote funnel and paid landing
page to use lighter chrome (logo only, no marketing nav — spec section 3)
without duplicating Phase A's homepage/privacy/terms/contact pages.

**Decision:** Moved Phase A's pages into a `(marketing)` route group with
its own `layout.tsx` rendering `<Header>`/`<Footer>`; the root layout now
only provides the HTML shell, fonts, metadata, and `AttributionCapture`.
`/quote/*` gets its own layout with `FunnelHeader` (logo only) +
`QuoteProvider`; `/toronto/wall-makeover` renders the same `FunnelHeader`
directly.

**Reason:** Route groups don't add a URL segment, so every Phase A URL
(`/`, `/privacy`, `/terms`, `/contact`) is unchanged — this is a pure
internal reorganization, confirmed via full regression testing (see
`PROJECT_STATUS.md`).

**Reversibility:** Fully reversible — moving files between route groups
doesn't change any URL or component logic.

## D008 — Quote state persists to localStorage via the LeadAdapter, not a separate mechanism

**Problem:** The funnel needs to survive a refresh (spec section 8), and
spec section 13 separately asks for a `LeadAdapter` boundary with a
`saveQuoteProgress()` method. Building two separate persistence mechanisms
(one for refresh-survival, one satisfying the `LeadAdapter` interface)
would be redundant.

**Decision:** `DevLocalLeadAdapter.saveQuoteProgress()` IS the funnel's
refresh-persistence mechanism — `QuoteProvider` calls it on every
`updateQuote()`, and calls `getLeadBySession()` on mount to rehydrate.

**Reason:** These are the same problem from two different angles (spec
sections 8 and 13) — unifying them means B2's real backend-backed
`LeadAdapter` becomes the only thing that has to change to move from
browser-only persistence to a real database, with no changes to any step
component.

**Reversibility:** Fully reversible — swapping `DevLocalLeadAdapter` for an
API-backed implementation behind `getLeadAdapter()` is the only change
needed.

## D009 — Pricing fails safe in production instead of always mocking

**Problem:** Spec section 10 requires that "if production environment
cannot obtain authoritative pricing, fail safely rather than silently
serving mock prices" — but B1 has no real pricing backend at all yet, so
something has to decide when mock pricing is acceptable to show.

**Decision:** `getPricingAdapter()` always returns `MockPricingAdapter` in
non-production builds, but in a **production** build only does so if
`NEXT_PUBLIC_USE_MOCK_PRICING=true` is explicitly set — otherwise it
returns `UnavailablePricingAdapter`, which renders the funnel's existing
"pricing unavailable" UI rather than a fabricated number.

**Reason:** Directly implements the spec requirement without waiting for
Phase E's real pricing engine — a production deploy of B1 as it stands
today would show "we couldn't generate a price" to every customer rather
than quietly presenting made-up numbers as real quotes.

**Reversibility:** Fully reversible — this is a single conditional in one
file; Phase E's real backend-calling adapter replaces
`MockPricingAdapter`/`UnavailablePricingAdapter` entirely.

## D010 — Style/Inspiration photography stays disabled in the quote funnel too

**Problem:** The Style step (spec section 22) needed visual style options.
Phase A's Inspiration section (`DECISIONS.md` D005) already established
that style swatches use flat colors/gradients rather than photography,
because no verified Servino project photos exist.

**Decision:** Reused the same swatch approach (not new photography) for
the quote funnel's style picker, using the same six style IDs the spec
lists for B1 (Light Oak, Natural Wood, Dark Walnut, Black, White, Marble —
a subset of Phase A's nine homepage Inspiration styles).

**Reason:** Consistency with D005's reasoning — avoids any risk of a
placeholder image being mistaken for real completed work (spec section
96), and keeps style identifiers stable regardless of when real photography
arrives.

**Reversibility:** Fully reversible — swap swatch styling for real photos
per style whenever available; the `StyleId` type and pricing logic don't
change.

## D011 — B2 database decision checkpoint: keep Prisma 6.19.3; use `embedded-postgres` for local dev/test

**Problem:** B2 is the first phase needing a real, durable PostgreSQL
database. Two things needed deciding: (1) whether the Phase A/D006 decision
to pin `prisma`/`@prisma/client` to `6.19.3` still holds now that it's
actually load-bearing, and (2) how to get a real local PostgreSQL instance
in this environment, since neither Docker nor a native PostgreSQL install
is available (`docker`, `psql`, `postgres` all absent; only `winget` exists,
and an interactive installer isn't viable in a non-interactive shell).

**Decision (1) — Prisma stays at 6.19.3.** Confirmed still appropriate:
it's a plain ORM/query-builder against any PostgreSQL instance (no
platform lock-in), supports the classic `migrate dev`/`migrate deploy`
workflow needed for real migrations, has no known vulnerabilities in
`@prisma/client` (the runtime dependency), and the one accepted
`npm audit` finding remains confined to the CLI devDependency. No concrete
technical reason to change it for B2.

**Decision (2) — `embedded-postgres` for local dev/test.** This npm
package runs an actual PostgreSQL binary (18.4) as a plain child process —
no Docker, no Windows service install, no admin rights. Added as a
devDependency; `scripts/dev-db.mjs` initializes a persistent data directory
under `.data/pgdata` (gitignored) and creates two databases on the same
instance: `servino_dev` for normal development and `servino_test` for
automated tests, both on `127.0.0.1:55432`.

**Reason:** This is genuinely the same PostgreSQL that will run on the
production VPS (spec section 74) — `embedded-postgres` is purely a
convenience for *launching* a real Postgres locally without Docker/admin,
not a different database engine or a hosted third-party product. It avoids
introducing a hosted dev-database dependency (Neon/Supabase/etc.) that
would need an external account and doesn't match "self-hosted Postgres."

**Reversibility:** Fully reversible in both directions — `embedded-postgres`
is a devDependency only, never imported by application code, and has no
effect on production (which reads `DATABASE_URL` for a real deployed
instance, same as any other Postgres). If Docker or a native install
becomes available later, swapping is just a `DATABASE_URL` change.

## D012 — `ApiLeadAdapter` composes the local cache rather than replacing it

**Problem:** B2's `Lead` model only stores what pricing/booking actually
need (aggregate `totalAreaM2`, not per-wall data; no photo metadata at
all — spec section 4/29). But the funnel still needs full-fidelity
refresh/resume — the exact per-wall measurements a customer already
entered, a photo preview — which the durable schema was intentionally
never asked to store.

**Decision:** `ApiLeadAdapter` internally composes a `DevLocalLeadAdapter`
instance purely as a client-side cache for `getLeadBySession`/
`saveQuoteProgress`/`attachMediaReference`, while separately POSTing the
durable subset to `/api/lead/progress`. Contact details are the one
exception — deliberately never cached locally (data minimization, spec
section 37).

**Reason:** Avoids two bad alternatives: (a) expanding the DB schema to
store presentation-layer detail (per-wall rows, photo metadata) that
nothing server-side needs, or (b) degrading refresh UX by only ever
reading back the aggregate. Client-side caching for UX + server-side
durability for business truth are complementary, not competing concerns.

**Reversibility:** Fully reversible — the local cache is an
implementation detail of `ApiLeadAdapter`; swapping it for something else
(e.g. IndexedDB) doesn't change the `LeadAdapter` interface or any step
component.

## D013 — Row-locked read-modify-write for lead progress saves

**Problem:** Found empirically during B2 E2E testing (not anticipated in
advance): `updateQuote()` fires `saveQuoteProgress()` without awaiting it,
so an earlier progress-save call could reach the database and commit
*after* a later, more specific call (booking-intent creation) — silently
regressing `status`/`currentStep` back down moments after they'd
correctly advanced. First database-verified E2E run caught this (DB
showed `currentStep: TIMING` immediately after a successful booking
intent that should have set it to `CONFIRMATION`).

**Decision:** `/api/lead/progress` wraps its read-modify-write in a
transaction using `SELECT ... FOR UPDATE` to lock the lead row, combined
with the already-existing `furthestStatus`/`furthestStep` monotonic
guards.

**Reason:** `furthestStatus`/`furthestStep` alone aren't sufficient if the
*read* that feeds them is stale — locking closes the actual race, not
just the symptom. Re-verified via the same E2E test after the fix: status
and currentStep landed correctly (`BOOKING_INTENT`/`CONFIRMATION`) every
time.

**Reversibility:** Fully reversible — confined to one function; doesn't
change the API contract or any caller.

## D014 — Hydration failures never trap the funnel in a permanent loading state

**Problem:** Also found empirically: `QuoteProvider`'s initial hydration
awaited `createLead()`/`saveQuoteProgress()` unguarded. If that first
network call failed for any reason (rate limit, transient network issue),
the whole `hydrate()` promise rejected before `setHydrated(true)` ever
ran — every page under `/quote/*` stayed on "Loading your project…"
forever, with no error shown and no way to proceed, since nothing
downstream ever got a chance to render.

**Decision:** Wrapped the initial sync calls in try/catch — a failure is
logged but hydration still completes using the locally-created empty
state, so the funnel remains usable. Explicit, user-initiated actions
further down the funnel (price, contact, timing, booking intent) still
surface their own errors properly via `LeadAdapterError` — this fix only
concerns the *silent, unrecoverable* case at the very start.

**Reason:** A transient failure to sync with the server on first load
shouldn't be worse than not having a server at all — B1's DevLocalLeadAdapter-only
version never had this failure mode, and B2 shouldn't regress it. Matches
spec section 41's general principle that every failure needs a UX, not a
hang.

**Reversibility:** Fully reversible — a small try/catch in one function.

## D015 — Committed Playwright suite against an isolated `servino_test` database

**Problem:** B1/B2 QA used ad hoc scripts outside the repo (documented but
not committed). Phase C's own instructions ask whether the suite should
become permanent, favoring "yes" for the critical revenue path, and spec
section 49 requires tests never run against production or (implicitly)
pollute a developer's own working data.

**Decision:** Added `@playwright/test` as a committed devDependency, a
`playwright.config.ts` using the system-installed Chrome (`channel:
"chrome"` — this environment has no reliable access to Playwright's own
browser-binary CDN, same root cause as D011), and `tests/e2e/*.spec.ts`
covering the flows spec section 4 prioritizes: money (price
computation/manipulation), leads (durable state), funnel state (route
guards), and conversion (the two full happy paths). `scripts/test-server.mjs`
starts the app on a separate port against `servino_test`, never
`servino_dev` or production.

**Reason:** "Committed and repeatable" was the actual ask, and money/lead/
confirmation correctness are exactly where a silent regression would be
most expensive — not, e.g., exhaustive visual/CSS coverage. Kept to 34
focused tests rather than "hundreds of low-value tests" per the phase's
own instruction.

**Reversibility:** Fully reversible — standard Playwright project
structure; swapping the browser channel or database target doesn't
change any test's assertions.

## D016 — Two real defects found via this phase's testing, fixed at the source

**Problem:** Running the full 34-test suite twice in immediate succession
(and, separately, a Lighthouse accessibility audit) surfaced two issues
that would otherwise have shipped:

1. `/api/lead/progress`'s rate limit (120 requests/60s, keyed by IP) was
   tight enough to trip under realistic legitimate load — a full test
   suite run, or (the production-relevant case) several people quoting
   from the same household network simultaneously, since progress-saves
   happen on every step transition. Spec section 32 explicitly warns
   against exactly this ("do not make normal testing or household
   networks unusable").
2. Lighthouse flagged `aria-progressbar-name` on `ProgressIndicator` — the
   `role="progressbar"` element had no accessible name.

**Decision:** Raised the progress endpoint's limit to 300/60s (keeping
contact/timing/booking-intent — the actually abuse-sensitive endpoints —
at their tighter existing limits), and added `aria-label`/`aria-valuetext`
to the progress indicator. Both fixes get regression tests in the
committed suite (`z-rate-limiting.spec.ts`, and an accessible-name
assertion in `route-guards.spec.ts`) so they can't silently reappear.

**Reason:** Both are exactly the class of defect Phase C exists to find —
neither was visible from code review alone; the rate limit issue only
showed up under real repeated load, and the accessibility issue only
showed up under an actual Lighthouse audit, not manual UI review.

**Reversibility:** Fully reversible — a threshold number and two ARIA
attributes.

## D017 — Baseline security response headers added

**Problem:** No security-related HTTP headers were configured
(`next.config.ts` had none). Found during this phase's header spot-check.

**Decision:** Added `X-Content-Type-Options: nosniff`, `X-Frame-Options:
DENY`, `Referrer-Policy: strict-origin-when-cross-origin`, and a
conservative `Permissions-Policy` (camera/microphone/geolocation all
denied) globally via `next.config.ts` `headers()`.

**Reason:** Low-risk, well-understood defaults with no functional impact
on this app (no iframing needed, no camera/mic/geolocation used anywhere
in the funnel). A full Content-Security-Policy was deliberately NOT
attempted in this pass — it needs careful tuning against Next.js's own
inline scripts/styles and would risk breaking the app if rushed; noted as
a real gap in `docs/SECURITY_MODEL.md` rather than attempted unsafely.

**Reversibility:** Fully reversible — header config only, verified via a
committed test that doesn't over-assert (checks for presence, not an
exhaustive header policy).

## D018 — Hero visual: abstract slat-pattern illustration, not a placeholder

**Problem:** The Phase A hero used a color-block grid captioned "Real
project photography coming soon" — functionally honest, but it read as an
unfinished placeholder rather than an intentional design choice, working
against S1's brand goals (premium, trustworthy — spec section 3).
Servino still has no verified real project photography (spec section 14).

**Decision:** Replaced it with a geometric illustration of vertical
slats/panels in varying heights and brand-color tints — directly evoking
Servino's flagship service (fluted/slat decorative wall panels) rather
than being a generic abstract pattern.

**Reason:** Purely geometric shapes can't be mistaken for a real photo or
a specific project, so the "not real photography" honesty requirement is
structurally guaranteed rather than relying on a caption someone could
later forget to update. It also reads as a deliberate brand mark rather
than a gap — closer to how confident consumer brands use illustration
before they have a full photo library, than to a "coming soon" apology.

**Reversibility:** Fully reversible — swapping in a real hero photograph
later is a single component change (see `docs/IMAGE_ASSET_REQUIREMENTS.md`);
nothing else depends on the illustration's specific form.

## D019 — Header nav omits links with no real destination

**Problem:** Spec section 10 (this phase) suggested a fuller nav
including "For Professionals," "About," "Sign In," and "Help" — none of
which have a real destination in the current product (no professional
portal, no about page, no auth, no help center).

**Decision:** Kept the nav to links that resolve to real, existing
homepage anchors: Services, How It Works, Inspiration, FAQ. Omitted the
rest entirely rather than linking them to an unrelated anchor or a
placeholder page.

**Reason:** Spec section 10 itself provides the escape valve ("if a
destination does not exist, either connect it to a meaningful homepage
anchor, OR omit it until implemented... never ship decorative links that
404") — omission was the more honest choice here since none of those four
items have any homepage content that would make a same-page anchor
meaningful either.

**Reversibility:** Fully reversible — add each link back as its real
destination is built (professional portal → Phase F, about/help → future
content phase).

## D020 — Price screen: summary card moved ahead of the cost breakdown

**Problem:** Pre-S2, the Price screen's layout below the Total hero was
Subtotal/Tax/Total breakdown card first, then the plain project-summary
card (project/area/style/material) last. That buries "what am I
actually buying" under a second, smaller total that risks competing
with the hero's own total for attention.

**Decision:** Reordered so the project-summary card (relabeled with a
"What's priced" eyebrow, and "Material" renamed "Includes" for clarity)
appears immediately after the Total hero, with the Subtotal/Tax/Total
breakdown card second.

**Reason:** Price is explicitly the highest-priority conversion screen
in the S2 spec. The natural reading order for a customer should be
"here's your total → here's what that total includes → here's the math
behind it," not "total → math → what it includes." This is a pure JSX
reorder — no calculation, data, or copy value changed, only which
already-computed card renders first.

**Reversibility:** Fully reversible — a two-block swap in
`PriceStep.tsx` with no data dependency between the blocks.

## D021 — Timing step subtext avoids any matching/scheduling implication

**Problem:** S2 added a supporting subtext line under the Timing
heading for visual consistency with other steps (which all have a
one-line description under their `<h1>`). An easy default like "this
helps us match you with available professionals" would imply automated
professional matching — a capability that does not exist yet (no
matching phase has been built).

**Decision:** Used a neutral line instead: "Choose the option that best
fits your project." Makes no claim about matching, scheduling, or
response time.

**Reason:** Same honesty principle as D019 — don't imply a capability
the product doesn't have yet, even in throwaway supporting copy that
seems low-stakes. The Confirmation screen's existing disclaimer ("does
not mean a professional has been assigned or an appointment has been
scheduled yet") would directly contradict a matching-implying line here.

**Reversibility:** Fully reversible — a single string, easy to replace
once real matching behavior exists and needs describing accurately.

## D022 — Session D data model: 7 new tables, DB-backed sessions, generic audit log

**Problem:** Session D needs admin auth, professionals, and an
operational "Job" concept, without inventing a parallel lead system or
overbuilding for a marketplace that doesn't exist yet (spec sections 8,
28, 53).

**Decision:** Seven new Prisma models: `AdminUser`, `AdminSession`,
`Professional`, `ProfessionalService`, `Job`, `AuditEvent`, `AdminNote`.
Notable simplifications relative to the spec's own suggested list:

- **No separate `Assignment` table.** Current assignment state lives
  directly on `Job` (`assignedProfessionalId`, `assignedAt`); full
  assignment *history* is recovered by querying `AuditEvent` for
  `JOB_ASSIGNED`/`JOB_REASSIGNED` rows against that job. Spec section 36
  only requires history to be reconstructable, not a dedicated table.
- **One generic `AuditEvent` table**, not per-entity audit tables —
  every action Session D needs to trace (login, professional edits, job
  status changes, assignment) fits the same
  `action`/`entityType`/`entityId`/`actor`/`metadata` shape.
- **`AdminRole` enum lists all eight future roles from spec section 11**
  (`SUPER_ADMIN` through `READ_ONLY`) even though Session D only ever
  creates/authorizes `SUPER_ADMIN` — naming them now means a future RBAC
  pass never needs a renaming migration, while zero authorization logic
  actually branches on role yet (single boundary: "is this an active
  admin session," full stop).
- **Sessions are DB-backed, not JWT** — see D024.
- **`ProfessionalService.serviceSlug` is a string, not a `Service` FK** —
  matches the existing D004 pattern where the quote funnel itself
  validates against `src/lib/services-data.ts`, not the DB `Service`
  table. Keeping one source of truth for "what services exist" avoids a
  second, potentially-drifting one.
- **No `serviceArea` geo model** — a single free-text
  `Professional.serviceAreaNote` field. Servino serves exactly one city
  today; a structured coverage-area system would have no real data to
  operate on and is explicitly deferred by spec section 29.

**Reason:** Spec section 53's own instruction ("prefer the smallest
model that supports the real MVP") plus the project's established
pattern (see D004, D009) of not building structure ahead of the data
that would justify it.

**Reversibility:** Schema is additive only — no existing table was
altered. A future phase can add a dedicated `Assignment` table, per-role
permission checks, or a `ServiceArea` model without migrating away from
anything Session D introduces.

## D023 — Job is created automatically alongside BookingIntent, not by a manual admin "convert" step

**Problem:** Spec section 24 asks whether a `Job` should be created by
an explicit admin action ("convert this lead") or automatically the
moment a customer submits a project request (`BookingIntent`).

**Decision:** `/api/lead/booking-intent` creates the `Job` row (status
`NEW`) inside the same database transaction that creates the
`BookingIntent` and flips the lead's status — see
`src/app/api/lead/booking-intent/route.ts`. No separate admin "create
job" action exists.

**Reason:** Every real customer project request should be operable from
`/admin/jobs` the instant it lands, with no extra step an operator could
forget. The alternative (manual convert) adds a state where a submitted,
paying-intent customer exists in the system but isn't visible in the
owner's actual work queue — a real risk for the "first 10 real jobs"
goal (spec section 5). This does **not** change `BookingIntent`'s own
response contract, status codes, or idempotency semantics — the
customer-visible behavior of `/api/lead/booking-intent` is byte-for-byte
identical (still returns `{ bookingIntentId }`); `Job` creation is a
side effect the customer never sees or depends on.

Idempotency carries over for free: `Job.leadId` and `Job.bookingIntentId`
are both unique, and `Job` is only ever created inside the *same*
transaction as `BookingIntent` — so the existing P2002-race handling
(the loser re-fetches and returns the winner's row) never needs its own
Job-specific case; if the transaction didn't win, it didn't create a
`Job` either, and the winner's transaction already did.

**Reversibility:** Moderately reversible — removing the auto-create
would require either backfilling Jobs for existing BookingIntents or
accepting a gap; documented here specifically so a future phase doesn't
"fix" this by accident without noticing the intentional tradeoff.

## D024 — Admin sessions are DB-backed random tokens, not JWTs

**Problem:** Session D needs a session mechanism for admin
authentication (spec section 10).

**Alternatives:** (a) signed JWT in a cookie, (b) DB-backed opaque
session token.

**Decision:** (b). The cookie holds a random 256-bit token; only its
SHA-256 hash is stored in `AdminSession.tokenHash`. Login creates a row;
logout sets `revokedAt`; every request re-checks `revokedAt`/`expiresAt`
against the database.

**Reason:** No `SESSION_SECRET`/signing-key environment variable to
configure, rotate, or accidentally leave unset in production (spec
section 79's "fail safely if required config is missing" is
structurally satisfied — there's no signing secret to be missing).
Logout is immediate and real, not "the token is still technically valid
until it expires" as with unrevoked JWTs. The cost — one DB read per
authenticated request — is irrelevant at Session D's actual scale (one
owner, a handful of admin page loads per real job).

**Reversibility:** Fully reversible — `AdminSession` could be swapped
for JWT verification later without changing the `AdminUser` model or any
page/route's call site, since both hide behind the same
`requireAdminSession()` boundary.

## D026 — Production pricing never falls back to mock, even via the explicit flag

**Problem:** Since Phase B1, `getPricingAdapter()` allowed a production
build to opt into `MockPricingAdapter` via
`NEXT_PUBLIC_USE_MOCK_PRICING=true`, intended for "a staging/demo deploy
that intentionally wants to show the mock funnel end-to-end." Now that
Session E ships a real authoritative pricing engine, that escape hatch
is a lingering risk: a misconfigured environment variable could expose
obviously-fake development numbers to a real paying customer in
production.

**Decision:** In `resolvePricing()` (Session E's replacement selection
logic), a production build (`NODE_ENV === "production"`) **always**
resolves to the authoritative versioned engine, which itself fails
closed to `PRICING_UNAVAILABLE` if no `ACTIVE` `PricingVersion` exists
for the requested city — regardless of `NEXT_PUBLIC_USE_MOCK_PRICING`.
That flag now only has effect in non-production builds.

**Reason:** Spec section 5 of this phase: "Do NOT temporarily expose
mock/dev rates in production... do NOT remove fail-closed safeguards."
The safest way to honor both halves of that instruction simultaneously
is to remove the one env-var-controlled bypass that could ever put mock
numbers in front of a real customer, while keeping (and now backing
with a real engine) the actual fail-closed behavior.

**Reversibility:** Fully reversible — restoring the flag's production
effect is a one-line change, but should not be done without a specific,
reviewed reason (e.g. a genuine staging environment that is also a
"production" Next.js build).

## D027 — At most one ACTIVE PricingVersion per city, enforced at the database level

**Problem:** Spec section 12 requires "at most one valid active pricing
configuration for the same applicable service/market combination."
Enforcing this only in application code (e.g. "the activate endpoint
retires any other active version first") is vulnerable to a race
between two concurrent activation requests.

**Decision:** A partial unique index —
`CREATE UNIQUE INDEX ... ON "PricingVersion"("citySlug") WHERE "status" = 'ACTIVE'`
— added by hand to the Session E migration (not expressible in Prisma's
schema DSL). The database itself now refuses a second `ACTIVE` row for
the same `citySlug`, no matter what application code does or how it
races.

**Reason:** Matches the project's existing pattern of using real
database constraints for correctness-critical invariants rather than
trusting application code alone (see `BookingIntent.leadId` unique in
Phase B2, and D011's precedent of committed, reviewed raw SQL in
migrations).

**Reversibility:** Fully reversible — dropping the index is a one-line
migration; would only be justified by a genuine future need for
multiple simultaneously-active configurations (e.g. A/B pricing tests),
which is explicitly not a Session E goal.

## D028 — Toronto v1 launch pricing: methodology and the numbers actually configured

**Problem:** `docs/research/SERVICE_PRICING_RESEARCH.md` documents
*ranges*, not a formula — spec section 4 explicitly warns against
copying competitor/guide-site numbers blindly. Session E needs one
concrete, defensible set of rates to actually seed as the launch
`PricingVersion`.

**Decision — customer-facing rates** (all per m², converted from the
research document's per-sq-ft ranges at 1 m² = 10.7639 sq ft, then
rounded to a clean number near the computed midpoint, generally biased
toward the upper-middle of each range to reflect the Toronto/GTA premium
noted in research section 1):

| Service | Install-only | Material | Material+Install |
|---|---|---|---|
| Wall Panels | $65.00/m² | $85.00/m² | $150.00/m² |
| Wallpaper | $55.00/m² | $22.00/m² | $77.00/m² |
| Marble Sheets (faux-marble/PVC sheet, per Servino's actual product description — **not** real stone slab, whose Toronto installed price ($25–60/sq ft) would be wildly higher) | $75.00/m² | $110.00/m² | $185.00/m² |
| Decorative Partitions | $55.00/m² | $50.00/m² | $105.00/m² |

Minimum subtotal: **$350.00**, uniform across all four services — inside
the researched Toronto handyman minimum-fee range ($150–$400), toward
the higher end since these are real material+installation projects, not
simple handyman tasks.

Tax: **13% HST** ("HST (13%)") — the one figure in this document backed
by a primary government source, not a guide-site range.

**Decision — internal economics assumptions:**
- Professional payout: **75% of the labor (install-only) component** of
  the customer rate — Servino retains 25% of labor as its take, a
  commission rate within the commonly-cited 15–30% range for service
  marketplaces (not directly sourced for this vertical — flagged
  `REQUIRES OWNER VALIDATION` once real professional conversations
  happen, per section 56 of this phase's spec).
- Material cost estimate: **70% of the customer material rate**
  (Servino keeps a 30% material margin) — same confidence caveat.
- Payment processing: **2.9% + $0.30** per transaction, applied to the
  tax-inclusive total (what a card would actually be charged) — Stripe's
  published Canada rate, not yet an active integration (D-numbered
  payments phase is later).
- CAC: **$75** per acquired customer — **deliberately lower** than the
  $233 cross-trade paid-search average found in research, because the
  first 10 jobs (this phase's own stated business milestone) are
  realistically going to come from organic/referral/direct-outreach
  channels, not paid search, during a phase where no ad spend exists
  yet. Explicitly the lowest-confidence number in the whole model —
  see "Testing realistic scenarios" below for why this number, not the
  generic $233, was chosen.
- Other variable cost: **$10.00** flat per job (small contingency
  buffer — a placeholder, not sourced).
- Quote health thresholds: contribution margin **≥30% = HEALTHY, ≥15% =
  ACCEPTABLE, ≥5% = LOW_MARGIN, <5% = UNPROFITABLE**.

**Testing realistic scenarios (spec section 53) — why CAC is $75, not
$233:** Computing the model by hand against this project's own
established test scenario sizes (7.5 m², 10 m², 11.5 m² — the exact
areas already used throughout the Phase B2/C/S2 Playwright suite)
surfaced a real problem before any code shipped: at $233 CAC, almost
every `INSTALL_ONLY` quote below ~15 m² computed as `UNPROFITABLE`,
which would have meant the pricing engine auto-rejecting (or flagging)
most realistic small jobs — directly working against this phase's own
"prove the first 10 jobs" objective. Lowering CAC to $75 (still
documented as a rough placeholder, not researched data — see the
research document's own "LOW confidence" flag on this number) brings
realistic mid-size scenarios into `LOW_MARGIN`/`ACCEPTABLE` rather than
`UNPROFITABLE`, while still correctly flagging genuinely-tiny jobs.
This is a recalibration made *because* the numbers were actually tested
against realistic inputs and found to produce an operationally
counterproductive result — exactly the discipline section 53 asks for,
not a shortcut around it.

**Reversibility:** Fully reversible and expected to change — this is
`PricingVersion` "Toronto Launch v1," a `DRAFT`/`ACTIVE` row like any
other; a v2 with different numbers (informed by real professional
conversations per the research document's validation-questions section)
is the normal, designed path, not a special migration.

## D029 — An UNPROFITABLE quote health does not block the customer's automatic quote

**Problem:** Spec section 29 allows either interpretation — "manual
review / fail automatic quote" — for a quote whose computed contribution
margin falls below the `UNPROFITABLE` threshold.

**Decision:** The customer still receives a normal, honestly-computed
price. `EconomicsSnapshot.quoteHealth` records `UNPROFITABLE`
internally; nothing customer-visible changes. The Admin Overview's
Action Required section (Session D's existing pattern) surfaces jobs
whose snapshot health is `UNPROFITABLE`/`LOW_MARGIN`, prompting the
owner to look before doing the work, rather than an automatic
rejection blocking the customer from getting a price at all.

**Reason:** The computed price is not fake or manipulated — it is the
same deterministic formula as any other quote, just one where Servino's
own margin assumptions suggest thin/negative economics. Refusing to
quote a genuine small job outright would work directly against this
phase's own north-star metric (10 completed paid jobs) and against
Session D's whole premise that the owner is hands-on for every real job
anyway — a proactive internal flag achieves the spec's "manual review"
intent without the UX cost of "fail automatic quote." Explicitly does
**not** apply to a missing pricing rule/version (a true "can't price
this" case) — that still fails closed to `PRICING_UNAVAILABLE`, unchanged.

**Reversibility:** Fully reversible — changing this to an outright block
is a small, localized change in the price route if real operating
experience shows the current policy invites too many genuinely-losing
jobs.

## D030 — `--color-coral-text`: a darker coral specifically for text, found via axe-core on Session E's new economics UI

**Problem:** Session E's QA pass (`node scripts/qa-axe-check-session-e.mjs`)
found a real, `serious`-impact `color-contrast` violation on the new job
economics section and pricing simulator: the shared `text-coral`
(`#ff6b57`) utility, used for the negative-contribution-profit figure and
the `StatusChip` `coral` tone ("Unprofitable"/"Low margin"), measures
~2.3–2.8:1 against both white and `--color-coral-light` — well under
WCAG AA's 4.5:1 minimum for normal-size text. `--color-coral` itself
predates Session E (Phase A brand tokens) and is also used for
backgrounds/borders/solid fills and pre-existing form-validation error
text across the customer funnel, where changing the hue would be a much
wider-blast-radius, out-of-scope redesign.

**Decision:** Added a second token, `--color-coral-text: #a8301f`
(same hue family, darker), used **only** where coral is a text
foreground color that must pass contrast: `CHIP_TONES.coral` in
`src/components/admin/ui.tsx` (so this also retroactively fixes the
same latent defect on Session D's pre-existing "Cancelled"/"Disputed"/
"Rejected" status chips, which used the same tone and had the same
underlying contrast problem, never previously caught because no axe
pass had been run against those specific chip/text combinations), the
job detail page's negative contribution-profit figure, and the pricing
simulator's negative contribution-profit figure. `--color-coral` itself
is untouched — still used for backgrounds/borders/fills, and still used
as-is by the pre-existing customer-funnel form-validation error text
(`ContactStep`, `MeasurementsStep`, etc.), which is out of this
session's file scope and left as a documented pre-existing gap rather
than silently redesigned (see "Remaining Unknowns" in the Session E
completion report).

**Reason:** A one-line color-value fix, scoped to exactly the elements
this session's QA pass actually touched and flagged, is safer than
either (a) leaving a newly-discovered `serious` accessibility defect in
newly-shipped UI, or (b) redefining `--color-coral` itself and risking
an unreviewed visual/contrast change across every existing coral usage
in the app, including the customer funnel.

**Reversibility:** Fully reversible — a single new CSS custom property
and three call sites; removing it would just restore the original (too
low contrast) coral text color.

## D031 — Session F pre-check: fixed the customer funnel's pre-existing `text-coral` contrast gap

**Problem:** D030 (Session E) fixed `text-coral`'s ~2.8:1 contrast on
white for the new admin economics UI and the shared `StatusChip` coral
tone, but explicitly left the customer-facing quote funnel's own form-
validation error text untouched (`ContactStep`, `MeasurementsStep`,
`PhotoStep`, `ProjectLocationStep`, `StyleMaterialStep`, `TimingStep` —
14 usages across 6 files) as out of scope for that session. Session F's
own spec (section 9) explicitly asked for this to be inspected first.

**Decision:** Confirmed the fix is presentation-only, narrowly scoped,
and requires zero funnel-behavior change — a straight `text-coral` →
`text-coral-text` class swap on error/required-field text (and one
hover-state link color and two decorative `<svg>` icons using the same
token, changed for visual consistency with the now-darker adjacent
text). No component logic, validation logic, or markup structure
changed. Added a regression test
(`tests/e2e/measurements.spec.ts`) asserting the rendered error text
carries `text-coral-text`, not the old `text-coral`.

**Reason:** Spec section 9's own three conditions for fixing now rather
than deferring — presentation-only, narrowly scoped, fixable without
changing funnel behavior — are all satisfied; deferring a one-line-per-
file color-token swap that's already proven safe elsewhere in the same
codebase would be unnecessary caution, not carefulness.

**Reversibility:** Fully reversible — revert the class name in the six
files; no schema, API, or behavior dependency on this change.

## D032 — Professional authentication: a fully separate module, not a generalization of admin auth

**Problem:** Session F needs real professional login. Admin auth
(`src/lib/server/admin-auth.ts`) already implements the exact security
shape needed (DB-backed session, HttpOnly/Secure/SameSite cookie,
scrypt password hashing, timing-safe verification) — but spec section
12 explicitly requires the two authorization boundaries to be separate,
not layered on top of each other.

**Decision:** A new, parallel module, `src/lib/server/pro-auth.ts`,
structurally mirrors `admin-auth.ts` (same crypto — SHA-256 token
hashing, same session-lookup shape) but is entirely independent: its
own cookie (`servino_pro_session`, distinct from
`servino_admin_session`), its own `ProfessionalSession` table (distinct
from `AdminSession`), its own `requireProfessionalSession()` boundary.
Password hashing itself (`hashPassword`/`verifyPassword`/
`DUMMY_PASSWORD_HASH` in `src/lib/server/password.ts`) is reused as-is
— it's a generic, actor-agnostic primitive, not admin-specific, so
reusing it is not the kind of cross-boundary coupling spec section 12
warns against. Likewise `src/lib/server/rate-limit.ts` and
`checkRateLimit`/`clientIp` are reused with new, separate bucket names
(`professional-login`, `professional-mutation`) — the function is a
generic keyed limiter, not admin-specific. A new
`src/lib/server/pro-api-response.ts` (own `ProApiErrorCode` union) is
added rather than generalizing `admin-api-response.ts`, matching this
codebase's existing pattern of one response module per trust boundary
(customer `api-response.ts`, admin `admin-api-response.ts` — adding a
third following the same shape is the smallest coherent evolution, not
a new pattern).

**Reason:** An admin session cookie must never be usable to authenticate
as a professional, and vice versa — a real security boundary, not just
an organizational one, since a professional using a shared/public
device must not accidentally retain admin-adjacent access, and an admin
device must never be silently treated as "a professional is logged in
here" by a stray cookie. Two independent cookie names/session tables
make this a structural guarantee rather than a code-review convention.

**Reversibility:** Fully reversible — this is new, additive code; no
existing admin auth code is modified.

## D033 — Professional account activation: admin-generated one-time token, manually delivered

**Problem:** The first 1–4 professionals need a secure way to set their
own password without Servino having email infrastructure to rely on
(spec section 13 explicitly permits deferring automatic email delivery).

**Decision:** `ProfessionalActivationToken` — a new model: a
cryptographically random token (same `randomBytes(32).toString("base64url")`
shape as admin/professional session tokens), only its SHA-256 hash
persisted, tied to one `Professional`, with `expiresAt` (24 hours) and
`usedAt` (null until consumed). `Professional.passwordHash` is nullable
— a professional created by admin has no password and cannot log in
until activation completes. Admin generates a token via
`POST /api/admin/professionals/[id]/activation`, which returns the raw,
one-time link **once**, in the API response only — never written to
`AuditEvent.metadata` (which only records that an activation was
generated, with no token material) and never logged. Admin is expected
to copy/deliver this link manually (spec section 13: "Admin may securely
deliver the activation link manually"). `/pro/activate?token=...`
consumes it: validates hash+expiry+`usedAt IS NULL`, lets the
professional set a password, then atomically sets `usedAt` in the same
transaction that sets `Professional.passwordHash` — a second attempt
with the same token (reuse, or a race between two tabs) fails because
`usedAt` is no longer null, checked via a conditional update
(`updateMany` with `usedAt: null` in the `WHERE`, count-checked), the
same optimistic-concurrency pattern already used elsewhere in this
codebase (Session E's pricing-version activation race, D027).

**Reason:** The smallest secure mechanism that doesn't require building
email sending infrastructure just for 1–4 professionals, while still
being real (cryptographically random, hashed at rest, time-limited,
single-use, auditable without ever storing/logging the secret itself).

**Reversibility:** Fully reversible — if real email delivery is added
later, this token mechanism doesn't change, only how the link reaches
the professional (an email send call replacing "admin copies the link
and sends it manually").

## D034 — Job lifecycle: OFFERED/EN_ROUTE/ARRIVED added; ASSIGNED/IN_PROGRESS/COMPLETED semantics extended, not replaced

**Problem:** Session D's `JobStatus` enum (`docs/DATA_MODEL.md`) has no
concept of "offered but not yet accepted" or field-progress states
(en route, arrived). Spec section 22 explicitly warns against blindly
implementing its own suggested enum and asks for "the smallest coherent
evolution" of the existing one, reusing current semantics.

**Decision:** Three new `JobStatus` values, added additively:
`OFFERED`, `EN_ROUTE`, `ARRIVED`. Three existing values are **reused
with clarified, not changed, semantics**: `ASSIGNED` now means
"professional has accepted the offer" (previously it also meant this —
Session D's direct-assign route already set it as the terminal state of
manual assignment; Session F just adds a real acceptance step before
most jobs reach it); `IN_PROGRESS` means "professional has started
on-site work" (set by the new "Start Job" action, previously reachable
directly from `ASSIGNED` with no field-progress steps between); `COMPLETED`
means **professional-reported completion**, explicitly **not** "paid,"
"payout sent," or "customer-confirmed" (spec section 33/34 — documented
prominently everywhere this status is displayed, since Session D's
original `COMPLETED` label predates any payment concept and could
otherwise be misread). Updated transition table
(`src/lib/server/job-status.ts`):

```
NEW → REVIEWING, MANUAL_REVIEW, CANCELLED                         (unchanged)
REVIEWING → READY_FOR_ASSIGNMENT, MANUAL_REVIEW, CANCELLED          (unchanged)
READY_FOR_ASSIGNMENT → OFFERED, MANUAL_REVIEW, CANCELLED            (ASSIGNED removed from this table — see D035)
OFFERED → ASSIGNED, READY_FOR_ASSIGNMENT, MANUAL_REVIEW, CANCELLED  (new)
ASSIGNED → EN_ROUTE, READY_FOR_ASSIGNMENT, MANUAL_REVIEW, CANCELLED (new)
EN_ROUTE → ARRIVED, MANUAL_REVIEW, CANCELLED                        (new)
ARRIVED → IN_PROGRESS, MANUAL_REVIEW, CANCELLED                     (new)
IN_PROGRESS → COMPLETED, DISPUTED, MANUAL_REVIEW, CANCELLED          (unchanged)
COMPLETED → DISPUTED                                                 (unchanged)
CANCELLED → (none — terminal)                                        (unchanged)
DISPUTED → REVIEWING, COMPLETED, CANCELLED                           (unchanged)
MANUAL_REVIEW → REVIEWING, READY_FOR_ASSIGNMENT, CANCELLED           (unchanged)
```

`PROBLEM_REPORTED` is deliberately **not** a `JobStatus` value — see
D036. `DECLINED` is deliberately **not** a `JobStatus` value either —
a decline is a property of an individual `JobOffer` (see D035/D037),
not the job itself, since the job returns to `READY_FOR_ASSIGNMENT` for
re-offering, it doesn't enter a terminal "declined" state.

**Reason:** Every existing test that exercises `JobStatus` transitions
was checked before this change (`tests/e2e/admin-jobs.spec.ts`,
`admin-security.spec.ts`) — none exercise any transition this table
still doesn't allow, and the one behavioral removal
(`READY_FOR_ASSIGNMENT → ASSIGNED` from the *generic* transition table)
doesn't affect them because the existing `/api/admin/jobs/[id]/assign`
route never consulted `isAllowedJobTransition` in the first place — it
has its own inline guard (see D035). This keeps exactly one
authoritative transition table for the whole system, with multiple
legitimate entry points into it (professional-driven endpoints and the
admin's existing generic status-change endpoint), rather than two
competing status systems.

**Reversibility:** Additive enum values are safe to keep even if the
transition table is later adjusted; removing them would require
migrating any historical `Job` rows already in these statuses.

## D035 — The original direct-assign endpoint is kept, unmodified, but retired from the primary Admin UI

**Problem:** Spec section 21 asks to "refine semantics so Admin action
becomes OFFER JOB TO PROFESSIONAL rather than silently treating the
professional as having accepted" — but `/api/admin/jobs/[id]/assign`
already exists, is exercised by three committed Session D tests
(instant assignment, rejection of ineligible professionals, reassignment
history), and per spec section 76 every existing test must keep passing
unmodified.

**Decision:** `/api/admin/jobs/[id]/assign` and
`AssignProfessionalButton.tsx` are **not touched** — same file
contents, same behavior, same tests passing exactly as before. A new,
separate `POST /api/admin/jobs/[id]/offer` (with a required
`offerAmountMinor`) is the new primary path: it creates a `JobOffer`
row and moves the job to `OFFERED`, requiring the professional to
accept before `ASSIGNED` is reached. The Admin UI's
`/admin/professionals?assignTo=...` flow (which posts to `/assign`) is
replaced with a new `?offerTo=...` flow (which posts to `/offer`) as
the only assignment entry point a real admin user sees — verified that
no existing test exercises the UI page or query param at all (only the
API route directly), so this UI change breaks nothing. The old route
remains reachable directly via API (e.g. for a rare future need to
record a professional as already-agreed without a formal in-app offer)
but is intentionally not linked from anywhere in the UI.

**Reason:** Satisfies both constraints simultaneously — zero risk to
existing, already-verified assignment behavior, and a real, single,
non-conflicting path for how a professional actually gets work in
Session F's new workflow. Leaving unreachable-from-UI-but-still-tested
code in place is preferable to deleting working, tested functionality
or forking its logic into two subtly different implementations.

**Reversibility:** Fully reversible either direction — the old route
could be re-linked from the UI, or deleted later if truly never needed;
neither affects the new offer-based path's own data model.

## D036 — `ProblemReport` is a flag, not a `JobStatus` value

**Problem:** Spec section 35 lists `PROBLEM_REPORTED` alongside
`DECLINED`/`CANCELLED`/`DISPUTED`/`MANUAL_REVIEW` as a candidate
lifecycle "exception," but also says "this should move/flag the job for
Admin attention. Do not automatically resolve the problem" — and a
professional who hits an access problem mid-job is very often still
going to complete that same job once resolved, not enter a separate
lifecycle branch.

**Decision:** A new `ProblemReport` model (job, professional,
`reasonCode` enum, optional free-text `note`, `reportedAt`, `resolved`
boolean, `resolvedAt`) records the report **without** forcing any
`JobStatus` transition — the job stays in whatever status it was in
(`ASSIGNED`/`EN_ROUTE`/`ARRIVED`/`IN_PROGRESS`) when the problem was
reported. Admin sees it via a new Action Required condition and the job
detail page, and can independently decide to move the job to
`MANUAL_REVIEW` (or anywhere else the transition table allows) if
warranted — a deliberate admin judgment call, not an automatic one.

**Reason:** Matches the spec's own instruction not to auto-resolve, and
avoids conflating "something went wrong, admin should look" (a flag,
possibly transient) with "this job's lifecycle is now different" (a
status, which the existing model already represents via
`MANUAL_REVIEW`/`DISPUTED` for genuinely different lifecycle branches).

**Reversibility:** Fully reversible — additive model, no `JobStatus`
schema impact either way.

## D037 — Customer PII minimization: a query-time projection difference, not a schema change

**Problem:** Spec sections 18/27 require an offered-but-not-yet-accepted
job to show enough to decide (service, area, material ownership, timing,
offer amount) without unnecessary customer PII, while an accepted job
needs first name, phone, and address to actually do the work.

**Decision:** No new schema for "restricted" vs "full" project views —
the existing `Lead`/`ContactInfo` fields are simply projected
differently depending on the requesting professional's actual
relationship to the job, computed at query time in
`src/lib/pro/jobs.ts`: before acceptance (status `OFFERED`), the
professional-facing job payload omits `ContactInfo.email`/`.phone`,
`ContactInfo.firstName` is still shown (needed to meaningfully "decide"
per spec section 18's own list), and `Lead.postalCode` is omitted;
after acceptance (`ASSIGNED` or later), `firstName`, `phone`, and
`postalCode` are included, `email` remains withheld (spec section 27:
"do not expose... customer email unless necessary" — a professional
coordinating a home-improvement visit needs a phone number, not an
inbox). Attribution data, admin notes, `EconomicsSnapshot` fields, and
`QuoteSnapshot` customer pricing are never included in any
professional-facing payload, at any stage — enforced by the shape of a
dedicated `ProJobView` type that has no field for any of them (the same
compile-time-guarantee pattern as Session E's customer-facing
`PriceResult`, D-numbered decisions).

**Reason:** Real data minimization without inventing a second data
model to maintain — the underlying facts don't change across
acceptance, only what's operationally necessary to show changes, so a
query-time projection is the honest representation of that.

**Reversibility:** Fully reversible — adjusting which fields appear at
which stage is a projection-function change, not a migration.

## D038 — Estimated vs. actual professional compensation: two independent numbers, compared, never merged

**Problem:** Session E's `EconomicsSnapshot.professionalPayoutEstimateMinor`
is an internal planning estimate computed from the pricing version's
assumptions (75% of labor, at launch). Spec sections 19/66/67 require a
real, explicit "offer amount" for an actual job offer, and want the
two numbers preserved side by side so the first real jobs can validate
Session E's assumptions.

**Decision:** `JobOffer.offerAmountMinor` is a **separate, independently
entered** value — an admin-controlled amount at offer time (spec
section 19: "for Session F, an Admin-controlled offer amount may be
appropriate"), never auto-filled from or silently overwriting the
`EconomicsSnapshot` estimate. The admin offer form displays the
estimate as a reference figure ("Estimated professional cost:
$X — from Session E's pricing assumptions") next to the amount input,
but submitting a different number is always allowed and does not alter
`EconomicsSnapshot` in any way (it remains immutable, as it has been
since Session E). The job detail page shows both figures plus their
difference once an offer exists, framed explicitly as "estimated vs.
actual," never implying one supersedes the other.

**Reason:** This is exactly the comparison spec section 67 calls "the
learning loop" — conflating the two into one field would destroy the
ability to ever see whether Session E's 75%-of-labor assumption matches
what professionals actually accept in practice.

**Reversibility:** Fully reversible — `JobOffer` is a new, independent
model; no change to how `EconomicsSnapshot` is computed or stored.

## D039 — Mode B selected: customer PayPal checkout + manual professional payout (not automated marketplace)

**Problem:** Session G's business objective is a full customer-payment-
to-professional-payout lifecycle. Spec section 4 forbids assuming PayPal
marketplace/payout eligibility and requires research-first verification;
section 5 mandates Mode B (manual payout) if eligibility cannot be
demonstrated; section 105 explicitly forbids spending hours trying to
work around an approval gate.

**Decision:** **Mode B.** Customers pay Servino directly via a standard,
non-marketplace PayPal Checkout integration (Orders API, `intent:
CAPTURE`, single payee — Servino's own account). Professional
compensation is tracked entirely internally (`Payout` model, eligibility
computed server-side) and paid by the owner through whatever real-world
method they already use (e-transfer, cheque, cash), then **recorded**
in Servino — never sent through an automated PayPal-to-professional
transfer.

**Reason — evidence, not caution alone:** `docs/research/
PAYPAL_MARKETPLACE_FEASIBILITY.md` found, from two independent official
PayPal sources, that both Multiparty/marketplace functionality
("platform_fees," `disbursement_mode: DELAYED`, seller onboarding via
Partner Referrals) and the Payouts API each require **explicit PayPal
partner/business approval** — verbatim, "apply for live credentials
and go live after your platform or marketplace has been approved"
(Multiparty) and "if you're not instantly approved, your application
requires more review" (Payouts). This session has no access to
Servino's actual PayPal account, no partner-portal credentials, and no
way to check or influence that account's approval status — and the
codebase had zero prior PayPal integration to inspect for a clue either
way. Spec section 4 explicitly says not to infer eligibility because
documentation exists; section 5's own instruction applies exactly:
"if you cannot prove Servino currently has required marketplace/partner
capabilities, do not implement fake multiparty payouts."

**What Mode B does NOT give up:** standard PayPal Checkout is fully
available in Canada with no approval gate — real customer money moves
through a real, correctly-implemented PayPal integration (Orders API,
server-side capture verification, verified webhooks, idempotency,
refunds). Only the *professional-facing* leg of the money is manual.
This satisfies "correctness beats automation" (spec's own closing
words) — a real, safe customer payment now beats a fabricated or
unverifiable automated payout later.

**Architecture preserves the migration path.** `PayoutProvider` is
defined as a type/interface (mirroring `PaymentProvider`) but has no
implementation in Session G beyond the manual/internal one — if Servino
later obtains verified Multiparty/Payouts approval, a real provider
class can be added without changing the `Payout` model's shape,
`payoutAmountMinor` authority (D042), or the eligibility computation.

**Reversibility:** Fully reversible in the sense that matters —
nothing about Mode B's data model needs to change to add Mode A later;
it's additive (a new provider implementation + a config flag), not a
rewrite.

## D040 — Payment step placement: after booking intent, before confirmation; checkout has no job ID in its URL

**Problem:** Spec section 16 asks for the smallest coherent placement of
a payment step in the existing funnel; section 17 suggests `/checkout/
[jobId]` "or equivalent secure flow"; section 18 requires checkout
access to be securely tied to the customer, explicitly warning against
exposing arbitrary Job IDs.

**Decision:** Payment is inserted as a new step **after** booking-intent
creation (so `Job` already exists, unchanged from Session D/F) and
**before** `/quote/confirmation`. A new `LeadFunnelStep` value, `PAYMENT`,
is added between `TIMING` and `CONFIRMATION`. The route is
`/quote/payment` — **no Job ID in the URL** — mirroring every existing
funnel step's own pattern: the browser holds the anonymous
`sessionId` (already explicitly documented in `src/lib/quote/session.ts`
as "NOT an authentication token... must never be... used to authorize
anything" beyond correlation), and every payment API call
(`/api/lead/payment/*`) takes `{ sessionId }` in a POST body, exactly
like `/api/lead/price` and `/api/lead/contact` already do — the server
resolves "which job" from the stored session, never from a client-
asserted ID.

**Reason:** This is the smallest possible change to the existing funnel
(no earlier step is touched, no route restructuring) and it is at least
as secure as every other step in the funnel that already relies on the
same sessionId-as-correlation-key pattern — genuinely more secure than
a `/checkout/[jobId]` route would have been, since a route param puts
the ID in server logs, browser history, and the Referer header, while a
POST body does not. This was a deliberate rejection of the spec's own
"potential" suggestion in favor of its own stronger stated requirement
(section 18) once the two were in tension.

**Reversibility:** Fully reversible — a future authenticated-customer-
account phase could swap the sessionId correlation for a real session
cookie without changing the payment step's position in the funnel.

## D041 — Financial data model: Payment + PaymentEvent + Refund + Payout, no PaymentAttempt/FinancialLedgerEntry as separate tables

**Problem:** Spec section 10 lists many potential concepts (`Payment`,
`PaymentAttempt`, `Refund`, `PaymentEvent`, `Payout`, `PayoutEvent`,
`FinancialLedgerEntry`) and explicitly warns against blindly creating
all of them.

**Decision:** Four new models: `Payment` (one row per `Job`, mutable
current state — status, amounts, PayPal order/capture IDs), `PaymentEvent`
(append-only, one row per provider interaction — API response or
webhook — with a unique constraint on `providerEventId` where present,
which is the actual webhook-idempotency mechanism), `Refund` (one row
per refund attempt, references `Payment`), and `Payout` (one row per
`Job`, mirroring `Payment`'s per-job pattern — status, amount, manual
payment-method category, external reference).

**What was deliberately NOT built:** a separate `PaymentAttempt` table
(a `Payment` row's own mutable `paypalOrderId` already represents "the
current attempt" — a genuinely new *distinct* order, e.g. after a
failed capture, is handled by allowing the same `Payment` row to be
re-pointed at a new order, exactly like `Job.status` mutates in place
rather than spawning a new `Job` row per state — the immutable history
lives in `PaymentEvent`, not in a second table of attempts). A separate
`PayoutEvent` table (state transitions are recorded as `AuditEvent`
rows, `PAYOUT_ELIGIBLE`/`PAYOUT_RECORDED`/`PAYOUT_HELD`/etc. — the same
precedent `JobOffer` already established in Session F: no dedicated
"offer event" table exists either, `AuditEvent` covers it). A separate
`FinancialLedgerEntry` table (spec section 33's "strongly consider" —
considered and rejected for Session G's actual scale: `PaymentEvent` +
`Payout` + `AuditEvent` together already give a complete, queryable,
append-only-where-it-matters financial history for one job at a time;
inventing a fifth cross-cutting table to summarize what the other four
already record precisely would be exactly the kind of premature
abstraction this project's own conventions avoid — see the "no
half-finished implementations" and "don't design for hypothetical
future requirements" principles this codebase has followed since
Phase A). If a future phase needs a true cross-job general ledger (e.g.
for real accounting/bookkeeping export), it can be built as a
**read-only view/query** over the existing tables first, before ever
becoming a new written-to table.

**Reason:** Matches this project's established pattern (Session D's
single `AuditEvent` instead of a dedicated assignment-history table,
Session F's reuse of that same pattern for offers) — the smallest model
that still gives immutable history (`PaymentEvent`), provider references
(`paypalOrderId`/`paypalCaptureId`/`providerEventId`, each with a
uniqueness constraint), idempotency (the same fields, checked before
creating a duplicate), reconciliation (Admin can compare `Payment`'s
current state against a fresh provider lookup), auditability
(`AuditEvent` + `PaymentEvent` together), exact money (integer minor
units throughout, no exceptions), and safe retries (idempotency keys on
every financial mutation).

**Reversibility:** Fully reversible — splitting `Payment` into `Payment`
+ `PaymentAttempt` later, if a real multi-attempt business need
emerges, is an additive migration; nothing about the current shape
blocks it.

## D042 — Payout amount authority: the accepted JobOffer, frozen, never recalculated from later pricing or later offer edits

**Problem:** Spec sections 42/43 require the payout amount to come from
the accepted `JobOffer.offerAmountMinor`, not the current Session E
pricing estimate, and require that a pricing change tomorrow must not
alter a payout amount already determined today.

**Decision:** `Payout.amountMinor` is set **once**, at the moment the
`Payout` row is first created (when eligibility is first computed true —
see D043), copied from the job's accepted `JobOffer.offerAmountMinor` at
that exact moment. It is never recomputed from a live query against
`JobOffer` or `EconomicsSnapshot` afterward. An explicit admin override
(a different `Payout.amountMinor` with a required `amountOverrideReason`)
is possible but always audited and never silently applied — the
original accepted offer amount remains readable via the `JobOffer`
relation regardless of any override, so "what was actually agreed" and
"what was actually paid" can always be told apart even when they
differ.

**Reason:** Direct continuation of D038's own principle (estimated vs.
actual are two numbers, never merged) extended one step further: now
there are three numbers — Session E's estimate, Session F's accepted
offer, and Session G's actual payout — and none of them silently
overwrites another. This is the exact shape spec section 87's
first-job financial learning loop needs.

**Reversibility:** Fully reversible — the override mechanism already
provides the only "change" path that should ever exist; no further
flexibility is needed without a new, explicitly-designed change-order
workflow (deliberately not built in Session G, per spec section 47's
own "do not build complicated dispute automation" boundary applied to
payout amounts too).

## D043 — Payout eligibility: computed live, `Payout` row materialized (not pre-created) the moment eligibility first becomes true

**Problem:** Spec section 41 wants payout eligibility "server-computed,"
not left to admin memory; section 12 wants a stored lifecycle
(`NOT_ELIGIBLE`/`ELIGIBLE`/etc.); but a background job/cron to keep a
stored state in sync with the underlying conditions (payment captured,
completion confirmed, no open issue) is explicitly discouraged
elsewhere in this project's own conventions (Session E/F both avoided
background jobs for a 1–4-professional, first-10-jobs scale).

**Decision:** Eligibility is a **pure function** of existing data
(`computePayoutEligibility(jobId)`: payment captured and not refunded,
job status `CONFIRMED`, no unresolved `CustomerIssueReport`, an
`ACCEPTED` `JobOffer` exists) — never a value read from a stale stored
column. A `Payout` **row** is only created (materialized) at the exact
moment that function is evaluated as part of a real state-changing
request that could make it newly true — specifically, inside the same
transaction as the customer-completion-confirmation and admin-
completion-override endpoints (the two actions that are, by this
policy, always the *last* gating condition to become true, since
payment is required before a job can even be offered — D-numbered
policy below). No polling, no cron: the row appears exactly when the
triggering action happens, with a `PAYOUT_ELIGIBLE` audit event
recorded in the same transaction.

**Reason:** Gives a real, timestamped, auditable "became eligible at
X" record (satisfying spec section 74's audit requirement) without any
background infrastructure this project has consistently avoided at this
scale. If a customer issue is reported *after* a `Payout` row already
exists at `ELIGIBLE`, the issue-report endpoint transitions that row to
`HELD` in the same transaction — eligibility can move backward exactly
once conditions genuinely regress, never silently.

**Reversibility:** Fully reversible — swapping this for a scheduled
reconciliation job later (if job volume ever makes the "last gating
action" trigger unreliable) is additive, not a redesign.

## D044 — Payment gates professional offer: enforced server-side, before `OFFERED`

**Problem:** Spec section 26 states the preferred launch policy —
"Job must have confirmed customer payment before it can be offered to
a professional" — and requires server-side enforcement, not just
disabling an admin button.

**Decision:** `POST /api/admin/jobs/[id]/offer` now requires
`Payment.status === CAPTURED` (not refunded) for the job before
proceeding, checked directly against the database, not the client's
belief about payment state. No admin UI affordance for offering an
unpaid job exists, but the real boundary is this server check.

**Reason:** Matches every other financial/authorization boundary this
project enforces server-side regardless of what the UI shows (the same
principle behind D-numbered decisions in Sessions D/E/F: page-hiding
and UI-disabling are never the actual mechanism). Also directly
prevents the operationally worse outcome of a professional performing
real work for a job that turns out to be unpaid.

**Reversibility:** Fully reversible — a future phase could relax this
(e.g. allow offering before payment for trusted repeat customers) as an
explicit, documented policy change, not a silent removal.

## D045 — Production deployment: single VPS (Next.js + PostgreSQL together), not split Vercel + VPS

**Problem:** Session H's spec section 8 suggested a default
architecture (Next.js on Vercel, PostgreSQL/Redis on a VPS) but also
explicitly said "do not force architecture changes unnecessarily" and
asked for an audit, not a mandate.

**Decision:** For the first-10-jobs launch, the entire app — Next.js
and PostgreSQL — runs on one VPS. See `docs/PRODUCTION_DEPLOYMENT.md`
for the full reasoning and diagram.

**Reason:** `src/lib/server/rate-limit.ts` is an in-memory,
single-process counter protecting admin login, professional login,
payment creation/capture, refunds, and payout recording. Vercel's
serverless execution model does not guarantee shared memory across
invocations — deploying there today would silently and unpredictably
weaken every one of those rate limits, a real security regression, not
a style question. Rather than either (a) accepting that regression to
match the suggested default, or (b) building a Redis-backed limiter
that "ceremony" (spec section 21's own word) would add for a
single-instance deployment that doesn't need it, the simpler and
currently-correct choice is: don't split the deployment yet.

**Reversibility:** Fully reversible, and the trigger condition is
explicit: if real traffic ever outgrows one VPS, implement a
Redis-backed rate limiter first (see D046), then move the Next.js half
to Vercel. Not a decision that gets harder to undo later — no
Vercel-specific code exists anywhere to unwind.

## D046 — Rate limiting stays in-memory/single-process; no Redis introduced this session

**Problem:** Spec section 21 asked for a production-safe distributed
rate-limiting design "if production architecture requires it," Redis-
backed "preferred," but explicitly warned against introducing Redis
"merely as ceremony" for a deployment that doesn't need it.

**Decision:** No Redis was introduced. The existing in-memory limiter
(`src/lib/server/rate-limit.ts`) is correct and sufficient for D045's
single-VPS deployment — one Node process really does mean one shared
memory space, so the existing fixed-window counters behave exactly as
designed, with no gap.

**Fail behavior (spec section 22):** Since there is no external
dependency (no Redis) in this design, there is no "Redis unavailable"
failure mode to define — the limiter is as available as the Node
process itself. This is itself a documented answer to spec section
22's fail-open-vs-fail-closed question: by not adding an external
rate-limit dependency, sensitive operations (admin login, professional
login, activation, payment creation/capture, refunds, payout
recording, completion confirmation) can never silently lose their rate
limiting due to a *separate* system being down.

**Reason:** Matches D045 and the project's consistent preference
(Sessions D/E/F/G) for the smallest mechanism that's actually correct
for the current, real deployment target over a more "enterprise"
mechanism sized for a scale Servino isn't at yet.

**Reversibility:** Fully reversible — see D045's migration trigger.
When a Redis-backed limiter is eventually built, its fail-open-vs-
fail-closed behavior needs an explicit decision at that time; the
recommendation to record then: financial/security-sensitive operations
(payment, refund, payout, admin/pro auth) should fail CLOSED (reject
the request) if Redis is unreachable, rather than silently allowing
unlimited attempts — the small availability cost is worth it for those
specific endpoints. Lower-stakes endpoints (e.g. public lead-capture
rate limits) could reasonably fail open. Not implemented now because
there is no Redis dependency to fail at all.

## D047 — Feature-flag kill switches stay static-file-based, no DB-backed admin toggle UI

**Problem:** Spec sections 50–53 wanted real operational kill switches
(stop new bookings, stop new professionals, stop payments) with "a
documented way" to flip them "without taking the entire site offline."

**Decision:** `acceptNewCustomers`/`acceptNewProfessionals`/
`newBookings`/`paymentsEnabled` in `src/lib/feature-flags.ts` are now
actually enforced server-side (previously two of the four defaulted to
`false` and none were wired into any route — a real, latent Session-
G-era gap this session found and fixed). Flipping one requires editing
the file and redeploying — no database-backed, live-editable admin
toggle UI was built.

**Reason:** A VPS deploy (D045) is a `git pull` + migrate + restart —
realistically under a minute for a solo operator who already has SSH
access, not "taking the site offline." Building a DB-backed toggle
system with its own admin UI, audit trail, and cache-invalidation
story is real, non-trivial scope for a problem the static-file
approach already solves at first-10-jobs scale. Matches this project's
consistent preference (`docs/DECISIONS.md`, throughout) for the
smallest mechanism that's actually correct over a more general one
sized for a scale not yet reached.

**Reversibility:** Fully reversible — if flag-flipping without a
deploy ever becomes a real operational need (e.g. once deploys aren't
instant/trivial, or once there's staff beyond the Owner), a DB-backed
flag table with the exact same `FeatureFlagKey` shape already exists
to migrate toward.

## D048 — CSP includes `'unsafe-eval'` in development only, correcting D-era Session H reasoning

**Problem:** Session H's CSP (`next.config.ts`) omitted `'unsafe-eval'`
in every environment, reasoning that React's dev-mode `eval()` usage
"just logs a harmless console warning." Session H0.1's manual QA found
a real console **error** on every page in dev mode: `"eval() is not
supported in this environment... React requires eval() in development
mode for various debugging features like reconstructing callstacks
from a different environment."`

**Decision:** `script-src` now includes `'unsafe-eval'` only when
`NODE_ENV !== "production"`. Production's CSP is unchanged — no
`'unsafe-eval'` in production, ever.

**Reason:** Next.js's own bundled CSP documentation
(`node_modules/next/dist/docs/01-app/02-guides/content-security-policy.md`,
"Development Environment") explicitly recommends exactly this pattern
(`${isDev ? " 'unsafe-eval'" : ''}`) and states plainly that
`'unsafe-eval' is not required for production; neither React nor
Next.js use eval in production by default` — meaning this changes
nothing about the actual production security posture, while fixing a
real developer-experience defect (broken server-side error stack
reconstruction in dev) that Session H's own reasoning had gotten
backwards.

**Reversibility:** Fully reversible — deleting the conditional and
hardcoding `'unsafe-eval'` out entirely would restore Session H's
original (incorrect) behavior; this was verified as strictly worse,
not a tradeoff.
