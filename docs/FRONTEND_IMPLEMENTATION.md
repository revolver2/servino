# Frontend Implementation — Quote Funnel + Storefront (B1 + B2 + S1 + S2)

_Last updated: 2026-09-22 — end of Phase S2. This document originally
covered only the quote funnel; S1 added public storefront polish; S2
restyled the funnel steps themselves. See "Phase S2 additions" for
what's new. Session D (admin) is intentionally NOT documented here — it
has its own frontend under `src/app/admin/**`/`src/components/admin/**`,
covered in `docs/PROJECT_STATUS.md`, `docs/ARCHITECTURE.md`, and
`docs/ADMIN_OPERATIONS.md`. The one Session D change that touches
customer-facing backend code (`/api/lead/booking-intent` now also
creates a `Job` row) is additive and invisible to the customer — see
`docs/DECISIONS.md` D023 — so nothing below needed updating._

This document describes the customer-facing quote funnel: `Traffic →
Project + Location → Measurements → Optional Photo → Style + Material
Ownership → Price → Contact → Timing → Booking Intent → Confirmation`. It
assumes familiarity with `docs/ARCHITECTURE.md`, `docs/DATA_MODEL.md`, and
`docs/WORKFLOWS.md`.

## Phase S2 additions (funnel visual polish — read this first)

S2 touched only `src/components/quote/**` (all 8 step components plus
`ProgressIndicator.tsx`) — zero changes to adapters, API routes,
database schema, step-guard logic, or any calculation/validation code.
Every change is additive markup/Tailwind classes on already-rendered
state: icon badges and checkmark overlays for selection affordance
(`ProjectLocationStep`, `StyleMaterialStep`, `TimingStep`), a numbered
badge and neutral (non-price-colored) total-area card on
`MeasurementsStep`, a proper dropzone empty state on `PhotoStep`, a
reordered summary-before-breakdown layout plus loading/failure icons on
`PriceStep` (the highest-priority screen — see
`docs/qa/S2_VISUAL_COMPARISON.md` for why each reorder was made), a card
wrapper on `ContactStep` (previously bare inputs, inconsistent with
every other step), and a celebratory checkmark icon on
`ConfirmationStep`'s success state. Full before/after detail, screen by
screen, in `docs/qa/S2_VISUAL_COMPARISON.md`; baseline/post screenshots
in `docs/qa/baseline-s2/` and `docs/qa/post-s2/`.

Two new one-off QA scripts were added this phase since no baseline
screenshot driver had been committed previously:
`scripts/qa-screenshots.mjs` (drives the 10 non-failure scenarios) and
`scripts/qa-screenshot-pricing-failure.mjs` (drives the pricing-
unavailable scenario, which requires a temporary
`dev-pricing-config.ts` edit — see the script's header comment for the
revert obligation). Both assume the target server is already running
and take an output directory as their only argument.

If you're adding a new funnel step or restyling an existing one again,
follow the same discipline: capture a baseline before touching markup,
re-run the full Playwright suite after (several tests assert on
specific selectors like `#postal-code`, `input[id^="width-"]`, and
button text — a markup change can break the assertion even when the
step's actual behavior is unchanged), and re-check Lighthouse
accessibility before shipping, not after it catches a regression.

## Phase S1 additions (storefront polish)

S1 touched only presentation components (`src/components/home/*`,
`src/components/layout/*`) — zero changes to adapters, API routes,
database schema, or quote/funnel step components. See
`docs/DECISIONS.md` D018–D019 and `docs/PROJECT_STATUS.md` for the full
list of what changed and why. Two real accessibility regressions were
introduced and then caught/fixed within this same phase (color-contrast
on `HowItWorks` step numbers, malformed `<dl>` in `Hero`'s trust-signal
list) — both now have committed regression tests in
`tests/e2e/storefront.spec.ts`. If you're adding a new homepage section,
that file is the place to add its regression coverage too.

## Phase B2 additions (read this first)

- **Routing:** `/quote/contact` and `/quote/timing` are now real,
  server-persisted steps (B1's `/quote/contact` placeholder is gone).
  `/quote/confirmation` is a new, real route — deliberately **not**
  wrapped in `StepGuard` (see `docs/WORKFLOWS.md`).
- **`LeadAdapter` interface grew:** `markPriceViewed()` now returns the
  server-computed `PriceResult` (not `void`); `markBookingIntent()`
  returns `{ bookingIntentId }`; added `saveTiming()` and
  `getConfirmation()`. Every method throws `LeadAdapterError` on failure
  instead of failing silently.
- **`getLeadAdapter()` now returns `ApiLeadAdapter`** (backend-calling) by
  default — `DevLocalLeadAdapter` remains as a fully-functional local/
  offline reference implementation but is no longer selected automatically
  (spec section 7). See `docs/DECISIONS.md` D012 for why `ApiLeadAdapter`
  still composes a local cache internally rather than replacing it outright.
- **`PriceStep` no longer computes price client-side.** It calls
  `getLeadAdapter().markPriceViewed(sessionId)` directly — the server
  recomputes from the lead's own persisted inputs and that result is what
  gets displayed. See `docs/SECURITY_MODEL.md` for why.
- **New components:** `ContactStep`, `TimingStep`, `ConfirmationStep`
  (`src/components/quote/steps/`). `FUNNEL_STEPS`/`isStepComplete` in
  `step-guard.ts` extended to cover `contact`/`timing`.
- **New `QuoteState` fields:** `contactCaptured: boolean`, `timing:
  TimingValue | null`, `bookingIntentId: string | null` — all safe to
  cache client-side (not PII); actual contact details (name/email/phone)
  are deliberately never cached in the browser (data minimization).
- **New library code:** `src/lib/consent/consent-manager.ts` (consent
  policy config), `src/lib/server/*` (Prisma singleton, API response
  helpers, rate limiting, monotonic status/step helpers, spam signals,
  zod schemas) — all backend-only, never imported by client components.
- **Two real bugs found via E2E testing with actual database
  verification** (not just UI checks) — both are documented in
  `docs/DECISIONS.md` D013/D014 and `docs/PROJECT_STATUS.md`: a lost-update
  race in progress saves, and a hydration failure that could trap the
  funnel in a permanent loading state. Worth reading if touching
  `quote-provider.tsx` or `/api/lead/progress` later.
- **React StrictMode gotcha, encountered twice:** a `useRef`-based
  dedupe-guard for a side effect (to stop StrictMode's dev-only
  double-invoke from firing a network call twice) is incompatible with a
  `cancelled`-on-cleanup flag for the *same* effect — StrictMode's
  synthetic cleanup fires on the very instance whose in-flight request you
  want to keep, so the cancelled-check silently discards the one real
  result. Fixed in both `PriceStep` and `ConfirmationStep` by dropping the
  cancelled-flag pattern once a ref-based dedupe is in place. If a future
  step needs this same "fire an idempotency-sensitive request exactly
  once per mount" pattern, copy the fixed version, not the original B1
  one.

## Routing

```
src/app/
  (marketing)/          # route group — no URL segment
    layout.tsx           # full Header + Footer (Phase A)
    page.tsx              # homepage
    privacy/, terms/, contact/
  quote/
    layout.tsx            # QuoteProvider + FunnelHeader (lighter nav, no marketing links)
    page.tsx               # redirect → /quote/project
    project/page.tsx       # Step 1
    measurements/page.tsx  # Step 2
    photo/page.tsx          # Step 3
    style/page.tsx           # Step 4 (style + material ownership)
    price/page.tsx            # Step 5
    contact/page.tsx           # Step 6 (real, server-persisted contact step since B2 — see "Phase B2 additions" above)
  toronto/
    wall-makeover/page.tsx  # paid landing page — FunnelHeader + Footer, same /quote funnel
```

The `(marketing)` route group exists so the funnel and the paid landing page
can use lighter chrome (`FunnelHeader`: logo only) without duplicating the
homepage's full nav — moving Phase A's `<Header>`/`<Footer>` out of the root
layout and into `(marketing)/layout.tsx` was the only structural change made
to Phase A's own pages; their content is untouched.

## Quote state

`src/types/quote.ts` defines `QuoteState` — the single typed shape carried
through the funnel: session id, current step, service, location, measurements,
photo, style, material ownership, price result, attribution, `updatedAt`.
It is deliberately not a loose `any`-shaped object; every field the funnel
reads or writes is typed.

`QuoteProvider` (`src/lib/quote/quote-provider.tsx`, client component,
mounted in `quote/layout.tsx`) owns this state via React context:

- On mount, resolves the anonymous session id, captures first-touch
  attribution, and asks `LeadAdapter.getLeadBySession()` for existing
  progress. If none exists (or it's older than 24h — see "Staleness"
  below), a fresh `QuoteState` is created and `quote_started` fires.
- `updateQuote(patch)` merges a partial patch, bumps `updatedAt`, and
  persists via `LeadAdapter.saveQuoteProgress()` — every step calls this
  when the user completes it.
- Exposes `hydrated: boolean` so pages can avoid rendering before
  localStorage has been read (client-only — there is nothing to hydrate
  during SSR).

### Staleness / refresh behavior

- The anonymous session id and first-touch attribution live in
  `localStorage` with no TTL — they survive indefinitely until the browser
  storage is cleared.
- In-progress quote data (`servino_dev_lead_<sessionId>`, via
  `DevLocalLeadAdapter`) is treated as abandoned after 24 hours and a fresh
  quote starts instead of silently resuming a stale one.
- A refresh preserves data from every step the user has already clicked
  "Continue" past (each step's own local component state is only written
  to `QuoteState` at that point). Unsaved keystrokes on the step currently
  being filled in are lost on a hard refresh — this matches how most
  multi-step web forms behave and was a deliberate simplicity trade-off
  for B1 rather than autosaving every keystroke.

### Step guards

`src/lib/quote/step-guard.ts` + `src/components/quote/StepGuard.tsx`
prevent deep-linking or back/forward navigation into a step whose
prerequisites aren't met — e.g. visiting `/quote/price` in a fresh browser
with no prior state redirects to `/quote/project`. This is the same
principle as the Phase A rule that `/quote/confirmation` must never show
state that wasn't actually reached (spec section 93), extended to every
step.

## Adapters

All four boundaries from the spec exist as TypeScript interfaces with a
single development implementation each. Components only ever depend on the
interface — swapping the implementation (e.g. a real backend-backed
`LeadAdapter`) requires no component changes.

| Adapter | Interface | Dev implementation | Location |
|---|---|---|---|
| Pricing | `PricingAdapter` | `MockPricingAdapter` / `UnavailablePricingAdapter` | `src/lib/quote/pricing/` |
| Lead | `LeadAdapter` | `DevLocalLeadAdapter` | `src/lib/quote/lead/` |
| Analytics | `AnalyticsAdapter` | `ConsoleAnalyticsAdapter` | `src/lib/quote/analytics/` |
| Conversion | `ConversionAdapter` | `NoopConversionAdapter` | `src/lib/quote/conversion/` |

### Pricing boundary

The `PricingAdapter` interface itself (`src/lib/quote/pricing/pricing-adapter.ts`)
is unchanged since Phase B1 — components still only ever depend on it,
never an implementation. What changed in Session E is which code
actually selects an implementation for a **real** quote:

- `getPricingAdapter()` (`src/lib/quote/pricing/get-pricing-adapter.ts`)
  is a synchronous, DB-free function — it still exists, but is now used
  **only** by `DevLocalLeadAdapter`, the one client-side (browser)
  consumer of pricing (Prisma cannot run in the browser, so this path
  can never be DB-aware). It always returns `MockPricingAdapter` outside
  production, and `UnavailablePricingAdapter` in production regardless
  of any flag — this function was never the real production path to
  begin with; it backs offline/local-fallback behavior only.
- The **real** server-side price route (`/api/lead/price`) instead calls
  `resolvePricing()` (`src/lib/pricing-engine/resolve-pricing.ts`,
  server-only, DB-aware) — production always uses the authoritative,
  versioned Toronto pricing engine if an `ACTIVE PricingVersion` exists,
  failing closed to `PRICING_UNAVAILABLE` otherwise; the
  `NEXT_PUBLIC_USE_MOCK_PRICING` flag has no effect in production at
  all as of Session E (D026). See `docs/PRICING_MODEL.md` for the full
  selection policy and formula.

`MockPricingAdapter` reads rates from `dev-pricing-config.ts`, which is
loudly labeled as non-authoritative, dev-only numbers — not researched
Toronto pricing (that's Session E's
`docs/research/SERVICE_PRICING_RESEARCH.md` and
`docs/PRICING_MODEL.md`). Money is always integer cents (`*Minor`
fields); no floating-point dollar math anywhere in the pricing path.

### Lead boundary

`DevLocalLeadAdapter` persists `QuoteState` to the visitor's own
`localStorage`, keyed by session id. This is explicitly **not** a database,
not visible to Servino staff, and not durable across devices — it exists
so the funnel survives a refresh and so B2 has a stable interface to
replace with a real API-backed adapter.

### Analytics boundary

`AnalyticsEvent` (`src/lib/quote/analytics/analytics-adapter.ts`) is a
closed union — every variant's fields are IDs/enums/numbers, so there is no
field that could carry name/email/phone/address by construction. Events
fired in B1: `homepage_view`, `landing_page_view`, `service_selected`,
`quote_started`, `location_completed`, `measurements_completed`,
`photo_uploaded`, `photo_skipped`, `style_selected`,
`material_ownership_selected`, `price_generated`, `price_viewed`.

`TrackPageView` and `AttributionCapture` (`src/components/analytics/`) are
the two places analytics/attribution are triggered from outside the funnel
itself (mounted on the homepage and the paid landing page, and in the root
layout, respectively). Both guard against React StrictMode's dev-only
double-effect-invocation with a `useRef` so a real event only fires once
per page view even in development.

### Conversion boundary

Minimal by design (spec section 15) — `NoopConversionAdapter` just logs in
dev. No Meta/Google CAPI integration, no hashed identifiers transmitted.
Exists so that work is a future implementation swap, not a rewrite.

## Attribution

`src/lib/quote/attribution.ts` captures `utm_source/medium/campaign/
content/term`, `landingRoute` (pathname), `referrer`, and a timestamp —
**first-touch only**: `captureAttributionOnce()` checks localStorage first
and never overwrites an existing record. Mounted app-wide via
`AttributionCapture` in the root layout, so it fires on whichever page a
visitor actually lands on (homepage, paid landing page, or a direct link
into `/quote`), not just the homepage. No PII is captured.

## Media (photo step)

There is no object storage backend yet. `src/lib/quote/media/media-adapter.ts`
validates file type (`image/jpeg`, `image/png`, `image/webp`) and size
(≤8MB) client-side, then creates a `blob:` object URL via
`URL.createObjectURL()` for an in-memory local preview. Only metadata
(filename, size, MIME type) is persisted to `QuoteState` / localStorage —
never the file bytes. The object URL does not survive a page reload (it's
memory-only), so a refreshed photo step loses its thumbnail preview even
though the metadata remains — a known, documented limitation until real
object storage exists.

Production checklist for whoever builds the real media adapter (not done
in B1): upload to private storage, server-side type/size re-validation,
server-generated storage keys (never trust a client filename), signed
time-limited access URLs, and malware/content scanning.

## Locations / serviceability

`src/lib/quote/locations.ts` validates Canadian postal code format and
checks the first letter against `serviceableCities` (currently just
Toronto, `M` prefix). This is a deliberate B1 approximation — not real
FSA/polygon-level serviceability data — documented so it's not mistaken for
production-grade coverage logic. Components never hardcode "Toronto"
directly; they all call `resolveServiceability()`.

## Known limitations as of Phase B1 (a frozen snapshot — see `docs/CURRENT_STATE.md` for what's actually still true today)

The two items below were real B1 limitations and were resolved by the
phases named — kept here only as historical record, not current state:
a real backend now exists (Phase B2 on), and pricing became real and
versioned in Session E (`docs/PRICING_MODEL.md`). The remainder are
still accurate:

- Photo upload has no real storage backend; previews don't survive refresh.
- Serviceability check is first-letter-of-postal-code only.

Resolved since B1 (kept for history, not current):
- ~~No real backend~~ — resolved, Phase B2.
- ~~Pricing is non-authoritative mock data~~ — resolved, Session E.
- ~~"Continue to Booking" leads to a static placeholder~~ — resolved,
  Phase B2 built the real Contact → Timing → Booking Intent →
  Confirmation flow; the CTA copy itself changed again in Session H0.1
  (see `docs/PROJECT_STATUS.md`).
- ~~No automated test suite~~ — resolved, Phase C (173+ tests as of
  Session H).
