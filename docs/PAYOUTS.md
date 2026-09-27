# Payouts

_Session G. How Servino pays professionals for completed work — Mode B
(manual), why, eligibility rules, states, and procedures. For customer
payment collection (a separate, upstream concern), see
`docs/PAYMENTS.md`. For the reasoning behind specific choices, see
`docs/DECISIONS.md` D039/D042/D043._

## Selected mode: B (manual) — and why

Two modes were considered for professional payout:

- **Mode A — automated**: PayPal Payouts API sends money directly to
  each professional's own PayPal account.
- **Mode B — manual**: Admin pays the professional through whatever
  approved method they actually use (e-transfer, cheque, etc.) outside
  Servino, then records that fact in Servino.

**Mode B was selected.** PayPal Payouts requires a verified Business
account with an explicit approval PayPal grants on review — "If you're
not instantly approved, your application requires more review"
(PayPal's own documentation, quoted in full in
`docs/research/PAYPAL_MARKETPLACE_FEASIBILITY.md`) — plus every
recipient professional needing their own verified PayPal account. This
session had no way to verify Servino currently holds that approval.
Per the spec's own explicit instruction: if eligibility can't be
verified, choose Mode B rather than gambling on financial
architecture. This is an acceptable, arguably preferable, architecture
for the first 10 real jobs — it keeps the actual money-movement step
under direct human judgment while Servino is still building trust with
its first professionals.

**This is not called "automated payout," "instant payout," or
anything implying PayPal moves the money.** Servino's own systems
never initiate a payment to a professional. `featureFlags.automaticPayouts`
stays `false` until Mode A is genuinely implemented (a future,
separate migration — see "Migrating to Mode A" below).

## Payout amount authority

The payout amount is **the accepted `JobOffer.offerAmountMinor`** —
the actual figure Admin and the professional agreed to (Session F) —
never Session E's pricing-estimate (`EconomicsSnapshot.professionalPayoutEstimateMinor`,
a planning number) and never a live recalculation from current pricing
rules. A `Payout` row freezes this amount at the moment eligibility is
computed; if pricing changes tomorrow, a payout eligible today is
unaffected (D042).

The original agreed amount stays independently readable via
`Payout.jobOfferId → JobOffer.offerAmountMinor` even if the recorded
paid amount is later overridden (see "Recording a payout," below) —
overriding never rewrites `JobOffer`.

## Payout states

```
(no row)  →  ELIGIBLE  →  PAID
              ↓
            HELD  →  (admin may release back to ELIGIBLE by recording it, or leave held)
```

`NOT_ELIGIBLE` is **not** a stored value — it's represented by the
absence of a `Payout` row for the job (D043). This avoids a phantom
"not yet eligible" state that would need updating on every unrelated
job change.

| Status | Meaning |
|---|---|
| _(no row)_ | Not yet eligible. Shown to the professional as "Not yet eligible." |
| `ELIGIBLE` | All eligibility conditions met (below). Admin can record it as paid. |
| `HELD` | Was eligible, then something blocked it (a customer issue reported, or the payment was refunded/disputed) before it was paid. `heldReason` explains why. |
| `PAID` | Admin has recorded that the professional was actually paid, outside Servino. |
| `CANCELLED` | Reserved for a future explicit cancellation flow — not currently set by any Session G code path. |

## Eligibility — computed live, not admin-remembered

A `Payout` row is created (`maybeCreatePayoutEligibility()`,
`src/lib/server/payout-eligibility.ts`) the moment ALL of these become
true, computed fresh from the database every time, never cached or
admin-entered:

1. `Payment.status === "CAPTURED"` for the job.
2. An `ACCEPTED` `JobOffer` exists for the job (the amount authority).
3. No unresolved `CustomerIssueReport` exists for the job.
4. The job's completion has just been confirmed — either by the
   customer (`POST /api/customer/confirm-completion`) or by an admin
   override (`POST /api/admin/jobs/[id]/confirm-completion`).

This runs at exactly two trigger points — never a cron/background job,
consistent with this project's established avoidance of scheduled
work at this scale (Session E's pricing reconciliation and Session F's
offer expiration made the same choice).

## Completion confirmation — three distinct facts, never collapsed

Per spec, these are three separate, independently-tracked facts:

1. **Professional-reported completion** — `Job.status = COMPLETED`
   (Session F, unchanged).
2. **Customer/admin-confirmed completion** — `Job.status = CONFIRMED`
   (new in Session G, reachable only from `COMPLETED`).
3. **Payout eligible** — a `Payout` row exists with `status = ELIGIBLE`
   (may not happen even after confirmation, if an issue is open).

### Customer confirmation (the normal path)

Admin generates a one-time link from the job detail page ("Generate
confirmation link," `POST /api/admin/jobs/[id]/completion-token`,
requires `Job.status === COMPLETED`) and delivers it to the customer
manually (text, call, email — no automated delivery, matching the same
scope decision Session F made for professional activation links).
Valid 14 days, single-use (`CompletionConfirmationToken`, hashed at
rest, same pattern as `ProfessionalActivationToken`, D033).

The customer opens `/confirm?token=...` and chooses:

- **"Work completed"** → `POST /api/customer/confirm-completion` →
  `Job.status = CONFIRMED`, payout eligibility computed.
- **"Report an issue"** → `POST /api/customer/report-issue` (reason
  code + optional note) → `CustomerIssueReport` created, `Job.status`
  **stays `COMPLETED`** (not automatically anything else), **no
  automatic refund**. Flags Admin (`/admin/jobs/[id]` shows the report;
  Overview's Action Required lists it).

### Admin override

For when the customer doesn't respond: "Admin-confirm completion" on
the job detail page, requires an explicit reason, fully audited as
`ADMIN_COMPLETION_CONFIRMED` — always distinct from
`CUSTOMER_COMPLETION_CONFIRMED` in the timeline, never presented to
anyone as if the customer confirmed.

## Recording a payout (Mode B manual procedure)

1. Pay the professional yourself, through whatever method you actually
   use (e-transfer, cash, cheque, direct deposit).
2. On `/admin/payouts/[id]` (only shown once `status = ELIGIBLE`), fill
   in the amount actually paid, method category, an optional external
   reference (e-transfer confirmation number, etc.), and an optional
   note.
3. If the amount differs from the agreed offer, a reason is **required**
   — recorded as `amountOverrideReason`, audited, and the original
   agreed amount stays readable via the `JobOffer` relation (never
   silently rewritten).
4. Submitting transitions `ELIGIBLE → PAID` via a conditional DB update
   — idempotent: submitting the same recording twice returns the
   already-recorded state rather than double-processing; two
   concurrent submissions can only have one actually win.
5. A professional can never mark themselves paid — this route is
   admin-only, CSRF/origin-protected, and requires an active admin
   session.

**The hard invariant — payout never recorded while an issue is open**
is enforced **at this exact point**, re-checked fresh regardless of
what `Payout.status` already claims, because this is where real money
is actually being confirmed as sent. (Payout eligibility computation
also tries to avoid creating an `ELIGIBLE` row while an issue is open,
and an issue report tries to hold an already-`ELIGIBLE` row — see
"Concurrency" below — but the recording endpoint is the final,
unconditional gate.)

## Holding a payout

A `Payout` moves `ELIGIBLE → HELD` automatically when:

- A `CustomerIssueReport` is filed after the payout already became
  eligible (`holdPayoutIfEligible()`).
- The customer payment is refunded while the payout is still
  `ELIGIBLE` (`/api/admin/payments/[id]/refund`).

There is no dedicated "release" UI this session — Admin resolves the
underlying issue through their own judgment (matching Session F's
`ProblemReport` philosophy: the system flags, it doesn't automate
resolution) and can record the payout once appropriate; a currently
`HELD` payout simply doesn't show the recording form.

## Edge case: payment refunded after the professional was already paid

Money already left Servino — this does **not** silently reverse.
`POST /api/admin/payments/[id]/refund`'s response includes
`payoutAlreadyPaid: true` in this case, and the condition surfaces
live in Overview's Action Required ("Professional already paid, but
payment was later refunded/disputed") — a computed query
(`Payout.status = PAID AND Payment.status IN (REFUNDED, DISPUTED)`),
not a stored flag. Resolving this (recovering money from the
professional, or accepting the loss) is a manual business decision
outside this system's scope.

## Concurrency — the "issue-open AND payout-paid" invariant

Spec section 88 explicitly requires that an open customer issue and a
successfully-recorded payout must never both be true. Three layers,
from earliest-possible-prevention to final-unconditional-gate:

1. **Eligibility computation** re-checks for unresolved issues
   immediately after inserting a new `Payout` row (within the same
   transaction) and downgrades it to `HELD` if one appeared in the
   narrow window since the initial check. Closes all but a
   vanishingly small race window under Postgres's READ COMMITTED
   isolation.
2. **Issue reporting** (`holdPayoutIfEligible()`) checks for an
   already-`ELIGIBLE` payout and holds it, in the same transaction as
   creating the `CustomerIssueReport` — the reverse-order half of the
   same race.
3. **Payout recording** re-checks for unresolved issues, unconditionally,
   as the actual last line of defense — this is the layer that
   matters, because it's the only one where real money moves. See
   `tests/e2e/financial-concurrency.spec.ts` for the test that exercises
   this race directly.

Other financial concurrency guarantees: concurrent capture attempts
and concurrent refund attempts can only ever have one winner (DB
conditional updates / a partial unique index — see `docs/PAYMENTS.md`
"Idempotency"); concurrent payout-record attempts likewise.

## Admin surfaces

- `/admin/payouts` — list (professional, amount, payment status, open
  issue indicator, status, eligible-since, action).
- `/admin/payouts/[id]` — professional, agreed offer, eligibility
  facts (payment status, unresolved-issue banner if any, held reason
  if any), and either the recording form (`ELIGIBLE`) or the recorded
  payout's details (`PAID`).
- Overview metrics: Payouts Eligible, Payouts Held.
- Action Required: "Payouts eligible — ready to pay," "Professional
  already paid, but payment was later refunded/disputed."

## Professional-facing visibility

`/pro/jobs/[id]` shows the agreed compensation and a **truthful**
payout status label (`proPayoutStatusLabel()`,
`src/lib/admin/status-display.ts`): "Not yet eligible" / "Eligible" /
"Held" / "Paid" — never internal customer payment details, never
Servino's margin, never implying automated disbursement.

## Migrating to Mode A (future, not built)

If PayPal partner/business approval for Payouts is ever genuinely
confirmed, the migration path is additive, not a rewrite:

- `PayoutProvider` interface (not yet defined) alongside the existing
  `PaymentProvider`, following the same test-double-first pattern.
- Professional records would need a provider account identity field
  and onboarding-status tracking.
- `Payout` already has the shape needed (amount, status, professional,
  job) — automated recording would populate the same `PAID` state via
  a provider payout reference instead of an admin-entered
  `externalReference`.
- `featureFlags.automaticPayouts` flips to `true` only once this is
  real, tested, and the manual workflow remains available as a
  fallback.

Not attempted this session — explicitly out of scope per the spec's
"CRITICAL STOP CONDITION."
