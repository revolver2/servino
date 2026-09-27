# Unit Economics

_Session E. Answers, for every quote: how much money does Servino
actually expect to make? Distinguishes GMV, customer subtotal/tax/
total, professional compensation, material cost, contribution profit,
and contribution margin — deliberately never conflating any of these
with "revenue" or "profit" in casual language. For the customer price
formula these figures sit alongside, see `docs/PRICING_MODEL.md`. For
the specific launch numbers and why CAC was recalibrated from research,
see `docs/DECISIONS.md` D028._

## KPI definitions (exact, no ambiguous terminology — spec section 61)

| Term | Definition |
|---|---|
| **GMV** (gross merchandise value) | Sum of customer **totals** (incl. tax) across jobs. A vanity-adjacent metric — see "No revenue vanity" below. Not used internally as a success measure. |
| **Customer subtotal** | The pre-tax price a customer is quoted (`QuoteSnapshot.subtotalMinor`) — labor + material components, after the minimum-job floor if it applied. |
| **Tax** | `QuoteSnapshot.taxMinor` — HST at the version's configured rate, applied once to the subtotal. |
| **Customer total** | `subtotalMinor + taxMinor` — what the customer actually agrees to pay. |
| **Professional compensation (estimate)** | `EconomicsSnapshot.professionalPayoutEstimateMinor` — Servino's internal estimate of what it would pay the professional for this job. **Not a real payment or payout** — nothing transfers money (spec section 26; see "What this is not" below). |
| **Estimated material cost** | `EconomicsSnapshot.materialCostEstimateMinor` — Servino's internal estimate of what the materials would cost Servino to provide, for `MATERIAL_AND_INSTALL` jobs only (always `0` for `INSTALL_ONLY`, since the customer supplies their own material). |
| **Variable costs** | Payment processing estimate + CAC assumption + other variable cost (+ discount/referral cost, both always `0` today — no such feature exists yet, the columns exist for the formula's completeness). |
| **Contribution profit** | Customer subtotal (excl. tax) minus professional compensation minus estimated material cost minus variable costs. **Can be negative** — never clamped to zero, because pretending a loss is a breakeven would defeat the entire point of the guardrail. |
| **Contribution margin %** | `contributionProfitMinor / subtotalMinor × 100`, rounded. The denominator is the pre-tax customer subtotal, not GMV and not the total including tax — documented here precisely so it is never ambiguous which base a percentage is against. |
| **CAC** (customer acquisition cost) | An internal **assumption**, not a measured/attributed marketing figure — `PricingVersion.estimatedCacMinor`, an admin-configured input to the contribution-profit formula, never derived from real ad spend (none exists yet). |

## Why contribution profit, not "profit" or "net profit"

Contribution profit deliberately excludes fixed costs Servino incurs
regardless of any single job (software/hosting, insurance, the owner's
own time, future salaried staff). It answers "does taking this specific
job add money, after its own variable costs?" — the right question for
a marketplace deciding whether an individual quote is worth honoring,
**not** a claim about overall company profitability. Nothing in this
codebase computes or displays a company-level "net profit" figure —
that would require a real accounting system this phase does not build.

## The exact formula

```
contributionProfitMinor =
    subtotalMinor                          # customer subtotal, excl. tax
    − professionalPayoutEstimateMinor
    − materialCostEstimateMinor
    − processingEstimateMinor
    − cacAssumptionMinor
    − otherVariableCostMinor
    − discountMinor                        # always 0 today — no discount feature
    − referralCostMinor                    # always 0 today — no referral feature

contributionMarginPercent = round(contributionProfitMinor / subtotalMinor × 100)

quoteHealth =
    contributionMarginPercent >= healthyMarginPercent     ? HEALTHY     :
    contributionMarginPercent >= acceptableMarginPercent  ? ACCEPTABLE  :
    contributionMarginPercent >= lowMarginPercent          ? LOW_MARGIN  :
                                                              UNPROFITABLE
```

Thresholds are inclusive at each boundary (`>=`, not `>`) — verified by
a committed test constructing a scenario whose margin lands exactly on
a threshold.

## How each cost line is estimated

- **Professional payout estimate** = `professionalPayoutPercentOfLabor%`
  of the **labor component only** (never the material component — a
  professional is being paid for their installation work, not for
  materials they didn't buy). Launch value: **75% of labor** (D028) —
  Servino's estimated take is the remaining 25% of the labor line.
- **Estimated material cost** = `materialCostPercentOfCustomerRate%` of
  the **material component only**, and always **exactly `0`** for
  `INSTALL_ONLY` jobs regardless of the rate configured (the customer
  supplies their own material in that scenario — there is nothing for
  Servino to have paid for). Launch value: **70% of the customer
  material rate** (Servino's estimated material margin is the remaining
  30%).
- **Payment processing estimate** = `paymentProcessingPercent%` of the
  tax-inclusive **total** (what a card would actually be charged) plus
  `paymentProcessingFixedMinor`. Launch value: **2.9% + $0.30**
  (Stripe's published Canada rate) — **not yet an active integration**;
  this is a cost estimate only, no payment processor is wired up in
  Session E.
- **CAC assumption** — a flat per-job amount, **not derived from any
  real spend** (no ad spend exists yet). Launch value **$75** — see
  D028 for why this is deliberately lower than the $233 cross-trade
  research average, and why that recalibration was necessary for the
  numbers to make operational sense.
- **Other variable cost** — a flat per-job contingency buffer. Launch
  value **$10.00**, an unresearched placeholder, documented as such.

## Independent professional / worker-classification note

Servino's professionals are modeled as **independent contractors** —
"professional compensation" is Servino's own internal estimate of what
it would pay for the work, not an employee wage/payroll calculation, and
nothing in this phase implies an employment relationship. **Actual
worker classification depends on the real, factual relationship**
(control, tools, exclusivity, financial risk — the CRA's own four-factor
test, summarized in `docs/research/SERVICE_PRICING_RESEARCH.md`) and
**requires legal/tax confirmation** before Servino scales past a
handful of informally-arranged jobs. This document does not resolve
that question; it only documents that the estimate exists and what it
assumes.

## What this is not

- **Not a payment or payout.** No money is transferred, scheduled, or
  recorded as paid to anyone. There is no payment processor
  integration, no payout ledger, no escrow. `professionalPayoutEstimateMinor`
  is a planning number the owner can look at before deciding whether to
  proceed with a job — nothing more.
- **Not a company-level profit statement.** See "Why contribution
  profit, not profit" above.
- **Not shown to the customer, ever.** Enforced at the type level —
  `PriceResult` (what the customer-facing route returns) has no field
  for any economics figure.
- **Not recalculated retroactively.** `EconomicsSnapshot` is immutable,
  same principle as `QuoteSnapshot` — a historical job's economics are
  never recomputed using today's assumptions, even after a new
  `PricingVersion` is activated (spec section 20).

## Quote health is a guardrail, not a gate (D029)

An `UNPROFITABLE` classification does **not** block the customer's
automatic quote — the customer still receives a normal, honestly-
computed price (the number itself is not fake or inflated; it's simply
one where Servino's own margin assumptions suggest thin/negative
economics on this particular job). The flag surfaces internally: on the
job's own detail page, and in the Admin Overview's Action Required list
("Quote economics flagged unprofitable — review before starting work").
This is a deliberate policy choice, not the only valid one — see D029
for the reasoning and how to change it if real operating experience
argues otherwise. It explicitly does **not** apply to a genuinely
un-priceable request (no active pricing version, or no rule for the
requested service) — that always fails closed to `PRICING_UNAVAILABLE`,
unchanged.

## First business target: 10 completed paid jobs

Servino's own stated operational milestone for this launch phase is **10
completed, paid jobs** in Toronto — not a revenue target, not a GMV
target. This is documented here as business context for why CAC was
calibrated the way it was (D028) and why `UNPROFITABLE` is a soft
guardrail rather than a hard block (D029): both decisions were made in
service of actually getting through the first 10 real jobs, not
optimizing abstract unit economics before any real job has happened.
**This number is not hardcoded anywhere in the pricing or economics
logic** — no code branches on "job count so far." It is operational
guidance for the owner, tracked by simply counting `COMPLETED` jobs in
`/admin/jobs`, not a system behavior.

## No revenue vanity (spec section 62)

GMV and "pipeline value" (the Admin Overview metric, unchanged from
Session D) are customer-facing totals — they say nothing about whether
Servino is making money on what it sells. Every internal view built by
Session E (job detail's Economics section, the Pricing simulator) leads
with **contribution profit and contribution margin**, not with GMV, so
the owner is never nudged toward optimizing for a number that could
rise while actual unit economics worsen.

## Worked examples

Both computed against the actual launch "Toronto Launch v1"
`PricingVersion` (D028), Wall Panels, 10 m² — verified end-to-end
against a real database, not just hand-calculated (see the Session E
completion report's "Unit Economics" section for the live verification
this table matches).

| | Installation only | Material + installation |
|---|---|---|
| Labor component | $650.00 | $650.00 |
| Material component | $0.00 | $850.00 |
| **Customer subtotal** | **$650.00** | **$1,500.00** |
| HST (13%) | $84.50 | $195.00 |
| **Customer total** | **$734.50** | **$1,695.00** |
| Professional payout estimate (75% of labor) | $487.50 | $487.50 |
| Estimated material cost (70% of material) | $0.00 | $595.00 |
| Payment processing (2.9% + $0.30) | $21.60 | $49.46 |
| CAC assumption | $75.00 | $75.00 |
| Other variable cost | $10.00 | $10.00 |
| **Contribution profit** | **$55.90** | **$283.04** |
| **Contribution margin** | **8.6%** | **18.87%** |
| **Quote health** | **LOW_MARGIN** | **ACCEPTABLE** |

This pair is a real, useful illustration of why "installation-only vs.
material+installation are genuinely distinct formulas" matters beyond
just the customer price: at this rate configuration, install-only work
is thinner margin for Servino than material+installation, because the
professional-payout percentage (75% of labor) is high relative to a
smaller subtotal with no material markup to help absorb the flat CAC
and processing costs. This is exactly the kind of signal contribution
margin is meant to surface — not visible from the customer price alone.

## Session G — Estimated vs. actual processing fee

Every captured payment's admin detail page
(`/admin/payments/[id]`) now shows this snapshot's original
`processingEstimateMinor` (the Session E planning assumption) next to
an **approximate actual** figure calculated from PayPal's currently
published Canada domestic rate (2.90% + $0.30 CAD, sourced in
`docs/research/PAYPAL_MARKETPLACE_FEASIBILITY.md`). This is explicitly
labeled "approximate" — Session G's PayPal integration doesn't request
the capture's own `seller_receivable_breakdown`, so it isn't PayPal's
actual per-transaction reported fee, just the best calculable estimate
from the published rate. The Session E estimate itself is never
overwritten by this comparison; both numbers sit side by side, part of
the same first-10-jobs learning loop Session F started for
professional compensation (`docs/PROJECT_STATUS.md` Session F, D038).

## Session H — Actual economics (real, not estimated)

`JobActuals` (one row per job, all cost fields nullable) captures the
real material cost, real CAC, and real other-variable-cost for a
completed job, entered by Admin on the job detail page — see
`docs/ADMIN_OPERATIONS.md` "Recording actual costs." It is a wholly
separate table from `EconomicsSnapshot`; Session E's original estimate
is never overwritten, edited, or deleted by Session H's actuals.

**Actual contribution profit formula**
(`src/lib/admin/launch-economics.ts`):

```
actualContributionMinor = subtotalMinor
  - actualPayoutMinor              (from the recorded Payout, PAID only)
  - actualProcessingFeeApproxMinor (PayPal published-rate approximation, same
                                      method as the Session G payment-detail figure)
  - actualMaterialCostMinor        (from JobActuals)
  - actualCacMinor                 (from JobActuals)
  - actualOtherVariableCostMinor   (from JobActuals; defaults to $0 if entered as $0 —
                                      the one field permitted to default rather than
                                      block completeness)
  - refundMinor                    (0 if none)
```

**"Complete" is strict, on purpose.** This figure is only computed —
and only shown on `/admin/launch` — once all three are simultaneously
true for a job: its payout is `PAID`, `actualMaterialCostMinor` is
non-null, and `actualCacMinor` is non-null. Any job missing one of
these shows as **missing actuals**, never a partial number computed
from an assumed zero. This is the same "never silently default a real
cost to $0" rule Session E and Session G already followed, applied to
the newest number in the system.

**Estimate-vs-actual, per job.** `/admin/launch`'s job table shows
Session E's `EconomicsSnapshot.contributionProfitMinor` (the estimate
made at quote time) beside this actual figure once available, so the
first 10 real jobs can start telling Servino whether its Toronto
pricing assumptions (professional payout %, material cost %, CAC) were
right — see `docs/FIRST_10_PRICING_VALIDATION.md` for the review
process at jobs 3/5/10.
