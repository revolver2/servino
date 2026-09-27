# Pricing Model

_Session E. How a customer's price is actually computed, versioned, and
frozen. For the internal economics that sit alongside every customer
price (professional payout, material cost, CAC, contribution profit),
see `docs/UNIT_ECONOMICS.md`. For the research behind the specific
numbers configured at launch, see
`docs/research/SERVICE_PRICING_RESEARCH.md` and `docs/DECISIONS.md`
D028. For the admin workflow that creates/activates a pricing version,
see `docs/WORKFLOWS.md` "Session E — Pricing version lifecycle" and
`docs/ADMIN_OPERATIONS.md` "Setting up Toronto pricing"._

## What determines a customer's price

Exactly four inputs — all of which already exist elsewhere in the
funnel; Session E invents none of them (spec section 32):

1. **Service** (`serviceSlug`) — one of the four enabled Toronto
   services (`src/lib/services-data.ts`).
2. **Location** (`citySlug`) — `"toronto"` today; the model is
   city-scoped so a second city is additive later (a new
   `PricingVersion.citySlug`), not a schema change.
3. **Total area** (`totalAreaM2`) — the same aggregate m² the funnel has
   always computed from the customer's wall measurements
   (`src/lib/quote/units.ts`), metric or imperial, normalized to m²
   before it ever reaches the pricing engine.
4. **Material ownership** (`materialOwnership`) — `INSTALL_ONLY` or
   `MATERIAL_AND_INSTALL`, the same field the funnel has always
   captured.

Deliberately **not** modeled: wall condition, ceiling height, demolition,
electrical obstacles, or any other complexity factor — none of these
exist as real funnel inputs today, and inventing pricing logic for
inputs nobody actually collects would be fake precision (spec section
33, "no complexity engine for the first 10 jobs").

## Pricing modes: what's implemented vs. architected for later

`ServicePricingRule` uses one model today — **per-area** (a rate per m²,
times the area, plus a flat minimum floor). The schema and engine are
structured so other future modes (`FIXED`, `HOURLY`) could be added as
a new discriminant on `ServicePricingRule` without touching
`PricingVersion`, `EconomicsSnapshot`, or the customer-facing price
route — but **only per-area is built**, because it's the only mode the
Toronto launch niche (wall panels, marble sheets, wallpaper, decorative
partitions — all measured-area installation work) actually needs. Do
not read the schema's extensibility as a signal that other modes are
"almost done" — they are not started.

`src/lib/services-data.ts`'s `publicPricingMode` (`EXACT_PRICE` /
`STARTING_FROM` / `RANGE` / `QUOTE_ONLY` / `NO_PUBLIC_PRICE`, a Phase A
concept, unchanged by Session E) governs what the **marketing/service
catalog pages** show before a customer starts a quote — all four
Toronto services are `QUOTE_ONLY` (no headline number on the catalog
page; a real number only appears once someone actually goes through the
funnel). This is a different concern from the funnel's own price step:
once a customer reaches `/quote/price`, the number shown is always a
single, exact, deterministic total (never a displayed range) — Session
E's engine has no "give me a range" mode. If a scenario cannot be safely
auto-priced (no active pricing version, or no rule for the requested
service), the funnel fails to quote (`PRICING_UNAVAILABLE`) rather than
inventing a number or falling back to a range.

## Versioning

**`PricingVersion`** — the atomic unit of "a pricing configuration."
`DRAFT → ACTIVE → RETIRED`, one-directional (`docs/DATA_MODEL.md`
"Session E"). At most one `ACTIVE` version per `citySlug`, enforced at
the database level (D027) — not just application logic, because a race
between two activations is real, not hypothetical (verified by a
committed concurrent-activation test).

**Every quote is traceable to the version that priced it.**
`QuoteSnapshot.pricingVersionId` is set at the moment a quote is
computed and never changes afterward — activating a new version
tomorrow does not alter any quote already given today (spec section 9).
A `RETIRED` version's historical quotes remain exactly as they were
computed; nothing is retroactively recalculated.

**`ServicePricingRule`** — one row per `(pricingVersion, serviceSlug)`:
`installOnlyRateMinorPerM2`, `materialRateMinorPerM2`,
`minimumSubtotalMinor`. A version with zero rules cannot be activated.

## The customer price formula

All money is integer minor units (cents) throughout — never a float
(`docs/SECURITY_MODEL.md` "Money handling"). Given a `PricingVersion`,
its `ServicePricingRule` for the requested service, and the four inputs
above:

```
laborComponentMinor    = round(installOnlyRateMinorPerM2 × totalAreaM2)
materialComponentMinor = materialOwnership === "INSTALL_ONLY"
                            ? 0
                            : round(materialRateMinorPerM2 × totalAreaM2)

rawSubtotalMinor = laborComponentMinor + materialComponentMinor

if rawSubtotalMinor < minimumSubtotalMinor:
    subtotalMinor = minimumSubtotalMinor       # the minimum-job floor
    # split proportionally by RATE ratio, not raw amount — see "Why the
    # minimum-job floor splits by rate ratio" below
    laborComponentMinor    = round(subtotalMinor × installOnlyRateMinorPerM2 / (installOnlyRateMinorPerM2 + materialRateActive))
    materialComponentMinor = subtotalMinor − laborComponentMinor
else:
    subtotalMinor = rawSubtotalMinor

taxMinor   = round(subtotalMinor × taxRatePercent / 100)     # applied ONCE, to the (possibly floored) subtotal
totalMinor = subtotalMinor + taxMinor
```

Where `materialRateActive` is `materialRateMinorPerM2` for
`MATERIAL_AND_INSTALL`, or `0` for `INSTALL_ONLY` (so an install-only
job's minimum floor is 100% labor, never phantom material cost).

**Installation-only vs. material+installation are genuinely distinct
formulas**, not one formula with an arbitrary percentage subtracted
(spec section 18): install-only literally never evaluates the material
rate at all; it is not "the material+install price minus X%."

### Why the minimum-job floor splits by rate ratio, not raw amount

An earlier version of this formula split the floor proportionally by
each component's **raw** (pre-floor) amount — which breaks at exactly
zero area (`0 / 0`). Splitting by the **rate ratio** instead
(`installOnlyRate / (installOnlyRate + materialRateActive)`) is always
well-defined regardless of area, and naturally gives 100% of the floor
to labor for `INSTALL_ONLY` (`materialRateActive = 0`). Verified by a
committed test for both scenarios.

### Rounding

Centralized in `src/lib/pricing-engine/rounding.ts`
(`roundMinor`/`applyPercent`/`roundPercent`) — every money computation
in the engine goes through these, so the same amount is never rounded
two different ways in two different places (e.g. once in the price
route, once in the simulator). Standard round-half-up on whole cents;
no fractional cents ever persist or display.

### Unit conversion

The funnel has always normalized metric/imperial input to one canonical
`totalAreaM2` before anything downstream sees it
(`src/lib/quote/units.ts`, `FT2_TO_M2 = 0.09290304`) — Session E's
engine only ever receives that already-normalized number. Verified by a
committed test that a metric area and its exact imperial-converted
equivalent produce byte-identical totals, not merely close ones.

## Tax

**Implemented:** a single tax rate + label per `PricingVersion`
(`taxRatePercent`, `taxLabel`) — launch value **13% "HST (13%)"**,
sourced directly from the Canada Revenue Agency (see
`docs/research/SERVICE_PRICING_RESEARCH.md`, the one figure in that
document backed by a primary government source rather than a
guide-site range). Applied once, to the subtotal (after the minimum-job
floor, if it applied) — never compounded, never applied twice.

**Requires business/tax confirmation, not resolved by this phase:**
whether Servino itself has an HST registration/remittance obligation as
a marketplace facilitator, and whether the flat 13% Ontario rate is
correct for every conceivable edge case (it is the correct general
Ontario HST rate for the services in scope; jurisdiction-specific
exceptions were not exhaustively researched). See the research
document's own tax section for the exact confidence rating.

## Customer-facing price UI: what changed, what didn't

`/quote/price` (Session S2's screen) is **unchanged in layout** — Session
E verified its existing subtotal/tax/total breakdown already
communicated pre-tax vs. tax vs. total-with-tax truthfully and made no
redesign (spec section 22: "do not redesign S2, only make necessary
changes for truthful tax/breakdown semantics" — none were needed). The
only difference a customer can observe is that the number itself now
comes from a real, versioned Toronto `PricingVersion` once one is
active, instead of always being the development mock rate.

The customer **never** sees: professional payout, material cost
assumption, CAC, contribution profit/margin, quote health, or which
`PricingVersion` priced their quote. `PriceResult` (the type the price
route returns to the browser) has no field for any of this — a
compile-time guarantee, not a runtime filter.

## Fail-closed, unchanged in principle, tightened in practice (D026)

If no `ACTIVE PricingVersion` exists for the requested city:
- **Production:** the quote fails with `PRICING_UNAVAILABLE`. The
  funnel shows an honest "couldn't generate a price" state with retry —
  never a fabricated number, never a fallback to mock rates.
- **Non-production** (dev/test only): falls back to `MockPricingAdapter`
  — preserves the pre-Session-E local dev experience without requiring
  every developer to seed a pricing version to run the app locally.

As of Session E, this fallback can **never** happen in a production
build even via the pre-existing `NEXT_PUBLIC_USE_MOCK_PRICING` flag —
that flag now only has effect outside production (D026). This closes
the one realistic way mock/placeholder numbers could previously have
reached a real customer.
