# Payments

_Session G. How Servino collects customer payment via PayPal — the
provider architecture, setup, security model, and operational
procedures. For professional payout (a separate, downstream concern),
see `docs/PAYOUTS.md`. For the PayPal capability research this session
was built on, see `docs/research/PAYPAL_MARKETPLACE_FEASIBILITY.md`.
For the reasoning behind specific choices, see `docs/DECISIONS.md`
D039–D044._

## What this is (and isn't)

Servino collects customer payment through **standard PayPal Checkout**
(Orders v2 API) — the same integration any merchant uses to accept
PayPal/card payment on their own website. This is verified available
in Canada with no special approval.

Servino does **not** use PayPal Multiparty/Marketplace or PayPal
Payouts. Both require an explicit PayPal partner/business approval
this project has no way to verify Servino currently holds (see the
feasibility research doc). Professional payout is tracked entirely
inside Servino and paid manually by Admin outside PayPal — see
`docs/PAYOUTS.md` for that half of the story.

Servino's money model is never called "escrow," "trust account," or
similar — Servino simply collects a customer payment into its own
PayPal business account, the same as any merchant. Professional
compensation is a separate, internal obligation Servino chooses to pay
manually, not funds legally held in trust for the professional.

## Provider architecture

All payment-processor calls go through one interface:
`src/lib/payments/payment-provider.ts` (`PaymentProvider`) —
`createOrder` / `captureOrder` / `getOrder` / `refundPayment` /
`verifyWebhook`. No route or component calls a PayPal SDK or REST
endpoint directly; they all call `getPaymentProvider()`
(`src/lib/payments/get-payment-provider.ts`), which selects the
concrete implementation:

| Environment | Implementation | Behavior |
|---|---|---|
| Any non-production build (`next dev`, the Playwright test server) | `TestPaymentProvider` | Deterministic, in-memory, network-free. Never capable of moving real money. |
| Production, fully configured | `PayPalPaymentProvider` | Real PayPal Orders v2 REST calls. |
| Production, missing/incomplete config | `UnavailablePaymentProvider` | Every method fails predictably. **Never** falls back to the test provider. |

This mirrors the existing `PricingAdapter` boundary pattern
(`src/lib/quote/pricing/`) already used for the quote engine.

## Environment variables

Set in production only (see `.env.example`):

```
PAYPAL_ENV="sandbox" | "live"
PAYPAL_CLIENT_ID=""
PAYPAL_CLIENT_SECRET=""
PAYPAL_WEBHOOK_ID=""
```

All four must be present for `getPaymentProvider()` to select the real
provider. Local dev and the Playwright suite always use
`TestPaymentProvider` regardless of these values — they are never read
outside a production build.

## The customer flow

1. Customer completes the quote funnel through **Booking Intent**
   (creates the `Job`, status `NEW`) — unchanged from Session D/F.
2. `Lead.currentStep` becomes `PAYMENT` (was `CONFIRMATION` before
   Session G — D040). The customer is routed to `/quote/payment`.
3. `/quote/payment` shows subtotal/tax/total from the server (never
   client state) and a "Pay with PayPal" button.
4. Clicking it calls `POST /api/lead/payment/create-order` — creates
   (or idempotently reuses) a `Payment` row and a provider order, using
   the job's frozen `QuoteSnapshot.totalMinor` as the amount. The
   amount is **never** read from the request body.
5. The customer approves payment (PayPal's own hosted flow in
   production; in the test provider, this step is instantaneous).
6. The client calls `POST /api/lead/payment/capture-order` with the
   `providerOrderId`. The server captures it, verifies the amount the
   provider actually reports matches what was expected, and only then
   marks `Payment.status = CAPTURED`.
7. `Lead.currentStep` becomes `CONFIRMATION`. `/quote/confirmation`
   shows a distinct **"Payment confirmed"** badge — separate from
   "project submitted," which it always showed even before Session G.

Route: `/quote/payment` deliberately has **no job ID in its URL**
(D040) — it uses the same `sessionId`-in-POST-body pattern every other
`/api/lead/*` route already uses. This is stricter than the originally
suggested `/checkout/[jobId]` shape.

## Server-side authority (what's never trusted from the client)

- **Amount**: always `QuoteSnapshot.totalMinor`, frozen at quote time.
  Never a query param, hidden field, or request body field.
- **"Payment succeeded"**: never inferred from a PayPal popup closing
  or a redirect landing on a particular page. Only a server-side
  `captureOrder` call (or an independently-verified webhook) can set
  `Payment.status = CAPTURED`.
- **Which order to capture**: `capture-order` rejects any
  `providerOrderId` that doesn't match the order this server itself
  created for that session's `Payment` row — closes forged/foreign
  order-id money tampering.
- **Amount returned by the provider**: compared against
  `Payment.amountMinor` before ever marking `CAPTURED`. A mismatch is
  recorded (`PaymentEvent` + `PAYMENT_RECONCILED` audit) but never
  trusted.

## Idempotency

- **Create order**: `Payment.jobId` is unique — a double-tap/retry
  reuses the existing `CREATED`/`APPROVED` order rather than creating a
  second one. The provider call itself also passes a stable
  `PayPal-Request-Id` (`create:<paymentId>`), which PayPal deduplicates
  server-side for 45 days.
- **Capture**: a conditional DB update
  (`CREATED`/`APPROVED` → `CAPTURED`, count-checked) means only one of
  two concurrent capture attempts (a double-tap, or an API call racing
  a webhook) actually performs the transition; the loser re-reads and
  returns the same success. The provider call passes
  `capture:<paymentId>` as its idempotency key.
- **Webhooks**: `PaymentEvent.providerEventId` is a unique DB
  constraint — the actual dedup mechanism. The same event delivered 1,
  10, or 100 times can only ever insert one row; every delivery after
  the first hits a caught `P2002` and returns `{ duplicate: true }`
  without reprocessing.
- **Refunds**: a **partial unique index**
  (`Refund_one_active_per_payment`, migration
  `20260924120104_session_g_refund_race_guard`) allows at most one
  `PENDING`/`COMPLETED` `Refund` row per payment — this is what
  actually prevents two concurrent refund requests from both
  succeeding (an application-level status check alone was found, by a
  concurrency test, to race — see `docs/DECISIONS.md` if a "why a
  raw-SQL index and not just a status check" note is added there).

## Webhooks

`POST /api/webhooks/paypal` (`src/app/api/webhooks/paypal/route.ts`):

1. Reads the **raw body text** (never `request.json()` first — a
   re-serialization could differ from what was actually signed).
2. Calls `PaymentProvider.verifyWebhook()` — PayPal's own
   `/v1/notifications/verify-webhook-signature` endpoint in production
   (never a locally-reimplemented signature check), or the test
   provider's HMAC-SHA256 check (`x-test-signature` header, shared
   secret in `test-payment-provider.ts`, used only by the Playwright
   suite).
3. An invalid/missing signature or malformed body is rejected (HTTP
   400) **before** anything in the payload is trusted — no PaymentEvent
   row, no state change.
4. A verified event is matched to a `Payment` by `paypalOrderId` or
   `paypalCaptureId`. No match → acknowledged, no-op (unknown-event-safe:
   an event for an order this environment never created).
5. `resolveWebhookEffect()` maps a small, deliberately incomplete set
   of real PayPal event types (`CHECKOUT.ORDER.APPROVED`,
   `PAYMENT.CAPTURE.COMPLETED`, `PAYMENT.CAPTURE.DENIED`,
   `PAYMENT.CAPTURE.REFUNDED`, `PAYMENT.CAPTURE.REVERSED`,
   `CUSTOMER.DISPUTE.CREATED`) to a `Payment` status transition. Any
   other event type is still recorded (audit trail) but never mutates
   status — out-of-order and unknown-event-safe by construction.
6. A `PAYMENT.CAPTURE.REVERSED`/`CUSTOMER.DISPUTE.CREATED` event moves
   `Payment.status` to `DISPUTED` and, if a `Payout` for that job is
   still `ELIGIBLE`, holds it. If the payout was already `PAID`, it is
   **not** retroactively changed — see `docs/PAYOUTS.md` for that edge
   case.

## Reconciliation

`POST /api/admin/payments/[id]/reconcile` — explicit, admin-triggered
only (no automatic cron, consistent with this project's established
avoidance of background jobs at this scale). Fetches the order
directly from the provider (`getOrder`) and compares it to Servino's
own `Payment` record. If the provider reports a completed capture that
Servino's own record never reflected (e.g. a missed webhook), it
self-heals using the same amount-check + conditional-update safety as
the capture route itself. Always records a `PaymentEvent`
(`eventType: "reconcile"`) and a `PAYMENT_RECONCILED` audit entry,
whether or not anything changed. Reachable from `/admin/payments/[id]`.

## Refunds

`POST /api/admin/payments/[id]/refund` — full refund only (no partial
refund UI this session), admin-only, requires a reason. See
`docs/PAYOUTS.md` for the two edge cases this handles explicitly
(payout still eligible vs. already paid).

## Failure handling

- **Create-order fails** (provider outage, etc.): `Payment.status =
  FAILED`. The customer sees a generic retry message; a fresh "Pay"
  click starts a clean attempt.
- **Capture declined**: `Payment.status = FAILED`, customer sees "try a
  different payment method."
- **Capture returns PENDING** (rare, e.g. eCheck): `Payment.status`
  stays `APPROVED`; the eventual webhook resolves it to `CAPTURED` or
  `FAILED`. Never shown to the customer as confirmed in the meantime.

## Security

- PCI scope: Servino never collects raw card numbers — all card entry
  happens inside PayPal's own hosted/SDK surfaces.
- Secrets (`PAYPAL_CLIENT_SECRET`, webhook verification) are never
  logged; only safe provider reference IDs (order/capture/event IDs)
  appear in logs or `PaymentEvent.summary`.
- `PaymentEvent.summary` stores a minimized, normalized subset of a
  provider payload — never the full raw webhook body.
- IDOR: every `/api/lead/payment/*` route resolves the job through the
  caller's own `sessionId`, never a client-supplied job/payment ID —
  see `tests/e2e/payment.spec.ts`'s IDOR test.
- Money tampering: covered by `tests/e2e/payment.spec.ts` (forged
  order ID) and the server-authoritative-amount design above.

## Testing

Automated tests never charge real money — `getPaymentProvider()`
always selects `TestPaymentProvider` outside production (see
`scripts/verify-payment-provider-failclosed.mjs` for a standalone
verification of that selection logic). `TestPaymentProvider` supports
an optional `testScenario` (`SUCCESS`/`DECLINE`/`OUTAGE`) on
create-order, only ever honored by the route handler when
`NODE_ENV !== "production"` — see
`src/lib/payments/test-payment-provider.ts`.

Test coverage: `tests/e2e/payment.spec.ts` (checkout, idempotency,
decline/outage, money tampering, IDOR, the D044 offer gate),
`tests/e2e/webhook.spec.ts` (signature verification, duplicate
delivery, malformed/unknown events, self-heal, reconciliation),
`tests/e2e/financial-concurrency.spec.ts` (concurrent capture/refund
races).

## Sandbox verification

**NOT VERIFIED** — no PayPal sandbox credentials were available in
this environment. The provider abstraction and `PayPalPaymentProvider`
implementation are complete and typechecked against PayPal's
documented request/response shapes, but have never made a real
network call to `api-m.sandbox.paypal.com`. Before the first real
customer payment:

1. Create a PayPal Sandbox business account and app credentials
   (developer.paypal.com).
2. Set `PAYPAL_ENV=sandbox`, `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`
   in a **staging** environment (never local dev — `getPaymentProvider()`
   only reads these in a production build).
3. Configure a webhook subscription in the PayPal developer dashboard
   pointing at `<staging-url>/api/webhooks/paypal`, subscribed to at
   least: `CHECKOUT.ORDER.APPROVED`, `PAYMENT.CAPTURE.COMPLETED`,
   `PAYMENT.CAPTURE.DENIED`, `PAYMENT.CAPTURE.REFUNDED`,
   `PAYMENT.CAPTURE.REVERSED`, `CUSTOMER.DISPUTE.CREATED`. Copy the
   resulting Webhook ID into `PAYPAL_WEBHOOK_ID`.
4. Run one real sandbox checkout end-to-end (sandbox buyer account),
   confirm the capture and at least one real webhook delivery both
   land correctly in `/admin/payments/[id]`.
5. Only then switch `PAYPAL_ENV=live` with live credentials for
   production.

## Session H finding: the checkout UI itself needs one more piece before PAYPAL LIVE can be READY

Audited during Session H, not fixed — flagged honestly rather than
either silently building speculative UX or silently ignoring it.

The current `/quote/payment` checkout (`PaymentStep.tsx`) calls
Servino's own `create-order`/`capture-order` API routes directly and
never loads a PayPal-hosted button, iframe, or redirect. This works
completely correctly against `TestPaymentProvider` (capture is
instantaneous, there's no real approval step to model) and against
`PayPalPaymentProvider`'s `createOrder`/`captureOrder` calls
themselves (verified by code review against PayPal's documented
request/response shapes). **What's missing:** a real PayPal order
needs the *customer* to actually approve it on PayPal's side before it
can be captured — either via PayPal's JS SDK (Smart Payment Buttons,
rendered client-side) or a redirect to the "approve" URL PayPal
returns from `createOrder` and back again. Neither exists yet in this
codebase; `PayPalPaymentProvider.createOrder()` doesn't even surface
that approval URL in its return value today.

This was not built this session because: (1) there is no PayPal
sandbox access in this environment to build the approval flow against
and verify it actually works — building untested payment-approval UX
would be exactly the "do not fake it" spec explicitly warned against,
and (2) it's a scoped, well-understood, additive change (add the
approval URL to `CreateOrderResult`, add either a PayPal SDK button or
a redirect+return-page to `PaymentStep.tsx`), not a sign of a deeper
architectural problem — the server-side capture/webhook/reconciliation
logic underneath it is complete and tested.

**This is why `PAYPAL LIVE` cannot be marked READY yet even once
credentials exist** — see the checklist below, which now includes this
as an explicit blocking item.

## Production activation checklist

- [ ] **Build the real approval step** (PayPal SDK button or redirect
      flow — see the finding immediately above) and verify it end-to-end
      against PayPal Sandbox. This blocks everything below it.
- [ ] `PAYPAL_ENV`, `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`,
      `PAYPAL_WEBHOOK_ID` all set in the production environment.
- [ ] Sandbox smoke test completed (above) before flipping to `live`.
- [ ] `featureFlags.paymentsEnabled` is `true` (default) — set `false`
      only to intentionally hide the payment route (never fakes success
      either way; see `docs/LAUNCH_CHECKLIST.md` "Payment kill switch").
- [ ] Confirm `getPaymentProvider()` actually resolves to
      `PayPalPaymentProvider` in the deployed production build (it
      fails closed to `UnavailablePaymentProvider` otherwise — verify
      by attempting a real checkout and confirming a real PayPal order
      is created, not a `TEST-ORDER-*` id).
- [ ] Terms/Privacy pages reviewed for payment-collection/refund
      language (see `docs/SECURITY_MODEL.md` "Session G" section).
