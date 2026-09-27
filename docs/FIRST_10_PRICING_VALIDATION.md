# First-10-Jobs Pricing Validation

_Session H. A tracking framework for validating Session E's Toronto v1
pricing assumptions against real professional feedback and real job
outcomes — not an automated process. Pricing changes remain a
deliberate, manual Owner decision via `/admin/pricing`
(`docs/ADMIN_OPERATIONS.md` "Setting up Toronto pricing") — nothing
here changes pricing automatically, and nothing should, from a sample
size this small._

## Why this exists

Session E's pricing (per-m² rates, professional payout % of labor,
material cost %, CAC assumption of $75, contribution margin
thresholds) are launch **assumptions**, not validated facts —
documented as such since Session E. The first 10 real jobs are the
first real data. This framework exists so that data gets captured and
reviewed deliberately, at meaningful checkpoints, instead of either
(a) never being looked at, or (b) triggering a pricing change after
one noisy data point.

## What to track, per job

Use `/admin/launch`'s per-job table as the source of truth for the
numbers (revenue, estimated vs. actual professional compensation,
estimated vs. actual material cost, estimated vs. actual CAC,
estimated vs. actual contribution) — this document is for the
**qualitative** observations the dashboard can't capture:

| Job # | Service | Professional feedback | Customer behavior/friction | Operational surprise | Decision |
|---|---|---|---|---|---|
| 1 | | | | | |
| 2 | | | | | |
| ... | | | | | |

- **Professional feedback:** anything they said about the offered
  compensation (too low, fair, surprised it was that high, etc.) —
  from the offer conversation itself, not a formal survey.
- **Customer behavior/friction:** did the customer hesitate at the
  price? Ask for a discount? Complete checkout immediately? Abandon
  after seeing the price? (Some of this is visible in analytics —
  `price_viewed` without a following `contact_started` is a real
  signal — see `docs/PROJECT_STATUS.md` "Session H — Analytics.")
- **Operational surprise:** anything that didn't match the Session E
  model's assumptions — material cost wildly different, job took much
  longer/shorter than expected, etc.
- **Decision:** what, if anything, you decided to do about it. "None
  yet — too early" is a valid, expected answer for the first several
  jobs.

## Review checkpoints

Deliberately spaced, not continuous — checking after every single job
would react to noise, not signal.

### After Job 3

- Does the price feel too low or too high, based on professional
  reactions so far?
- Are professionals actually accepting offers at the Session E
  reference amount, or consistently negotiating up?
- Any customer friction specifically tied to price (not general quote-
  funnel UX)?
- Any payment problems (declines, confusion at checkout)?
- Any operational surprise worth writing down even if it's not yet
  actionable?

**Still too early to change pricing off 3 jobs** — this checkpoint is
for noticing patterns, not deciding.

### After Job 5

- What's the actual average order value so far
  (`/admin/launch` "Average order value")?
- What's the actual average professional payout, and how does it
  compare to the Session E estimate on average (not just per-job
  noise)?
- What's the actual CAC so far, if enough jobs have it entered
  (`/admin/launch` "Actual CAC")? How does it compare to the $75
  assumption?
- What's the actual contribution margin trend?
- Any cancellations? Any unresolved customer issues?
- Typical service duration — matching what professionals said in
  their onboarding interview?

**A real pattern across 5 jobs is worth a genuine "should we adjust
pricing" conversation** — but still requires deliberate judgment, not
an automatic trigger.

### After Job 10 — the real milestone

This is `/admin/launch`'s own "X / 10" milestone. At this point, with
a real, if still small, sample:

- Compare estimated vs. actual for every line item across all 10 jobs
  (the launch dashboard's totals do this arithmetic for you).
- Decide, deliberately, whether to:
  - Create a new `PricingVersion` with adjusted rates
    (`/admin/pricing`), or
  - Keep current pricing and gather more data, or
  - Adjust the compensation-offer approach without changing customer-
    facing pricing.
- Feed real professional-onboarding-interview data
  (`docs/FIRST_PROFESSIONAL_CHECKLIST.md`) from any professionals
  added since job 1 into the same comparison.

**Do not treat any of these checkpoints as automatic.** They are
prompts for the Owner to look at real data and decide — never a
trigger that changes pricing by itself. See
`docs/DECISIONS.md`/`docs/PRICING_MODEL.md` for why pricing changes
are always an explicit, versioned, human decision in this system.
