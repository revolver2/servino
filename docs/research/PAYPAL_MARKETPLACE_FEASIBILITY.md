# PayPal Marketplace Feasibility Research

_Session G. Researched 2026-09-24, against current official PayPal
documentation (developer.paypal.com, paypal.com/ca, paypal.com/us).
Written before any payment code — this document is the evidence Session
G's Mode A/Mode B decision (`docs/DECISIONS.md`) is based on, not a
formula to copy blindly. Every entry below is classified by confidence
and dated at retrieval; PayPal's own documentation states fees/features
change over time (see D028's precedent for the same caveat applied to
Stripe pricing in Session E)._

## Methodology

Prioritized official sources only: `developer.paypal.com` (technical/API
reference) and `paypal.com/ca` (Canada-specific commercial terms).
Secondary sources (third-party guides, community posts) were used only
to locate the right official page, never as the cited authority for a
capability claim. No PayPal account, sandbox credentials, or partner
portal access was available during this research — every "Canada
availability" and "Servino eligibility" finding below is therefore
based on published documentation only, not a verified live check
against an actual Servino PayPal account (which does not yet exist in
this codebase — confirmed: zero PayPal dependencies, config, or
integration code exists anywhere in the repository prior to this
session).

## 1. PayPal Checkout (standard merchant, non-marketplace)

**Capability:** A regular PayPal Business account creates PayPal Smart
Buttons / Orders API integration on its own website; customers pay via
PayPal balance/bank, or as a guest with a card, directly to that one
merchant account. No partner/platform approval of any kind is required
— this is PayPal's baseline commercial product.

- **Source:** [PayPal payments Orders API integration](https://developer.paypal.com/whats-an-order) — developer.paypal.com
- **Retrieved:** 2026-09-24
- **Canada availability:** Yes — standard PayPal Business accounts are
  available and fully supported in Canada; this is the same product
  used by the vast majority of Canadian small-business PayPal
  integrations.
- **Account/partner requirement:** A verified PayPal Business account.
  No partner approval.
- **API involved:** Orders v2 API (`/v2/checkout/orders`).
- **Confidence:** HIGH — this is PayPal's most heavily documented,
  most widely used product; no ambiguity found in research.

### Order lifecycle and capture

**Capability:** Orders are created with `intent: CAPTURE` (capture
immediately once approved) or `intent: AUTHORIZE` (place a hold, capture
later — hold valid **29 days**). An order stays in `CREATED` status for
**3 hours** by default (extendable up to 72 hours); after approval it
moves through `APPROVED` before capture.

- **Source:** [Authorize Payment & Capture Funds Later](https://developer.paypal.com/docs/multiparty/checkout/standard/customize/auth-capture/), [Orders v2 API reference](https://developer.paypal.com/api/orders/v2)
- **Retrieved:** 2026-09-24
- **Decision for Servino:** Use `intent: CAPTURE` (immediate capture on
  approval) — Servino's launch policy requires payment to be confirmed
  before a job can be offered to a professional (spec section 26), so
  there is no business reason to hold funds via `AUTHORIZE` for the
  first 10 jobs. `AUTHORIZE` remains available architecturally if a
  future phase needs a delayed-capture policy.
- **Confidence:** HIGH.

### Idempotency

**Capability:** The `PayPal-Request-Id` header enforces idempotency on
REST API POST calls that create/modify data. A unique, client-generated
ID is stored by PayPal for **up to 45 days**; a retried call with the
same ID returns the original result rather than creating a duplicate.
Must be unique per request AND per API-call-type (e.g. an order-create
ID and a capture ID for the same logical operation cannot reuse the
same value).

- **Source:** [Idempotency](https://developer.paypal.com/api/rest/reference/idempotency/) — developer.paypal.com
- **Retrieved:** 2026-09-24
- **Decision for Servino:** Every order-creation and capture call sends
  a `PayPal-Request-Id` derived deterministically from Servino's own
  `Payment.id` (+ an operation suffix), so a duplicate button-tap or a
  network-retry from our own server can never create two PayPal orders
  or two captures for the same `Payment` row.
- **Confidence:** HIGH.

### Refunds

**Capability:** `POST /v2/payments/captures/{CAPTURE-ID}/refund`. Empty
body = full refund. Body with an `amount` object = partial refund.
Multiple partial refunds are allowed up to the total captured amount;
omitting `amount` on a subsequent call refunds "whatever remains."

- **Source:** [Issue a Refund for Captured Payments](https://developer.paypal.com/docs/multiparty/issue-refund/), [Refund Captured Payment](https://developer.paypal.com/serversdk/typescript/api-endpoints/payments/refund-captured-payment/)
- **Retrieved:** 2026-09-24
- **Decision for Servino:** Support full refund only for Session G (spec
  section 50: "partial refund only if cleanly supported and justified"
  — no current business case for partial refunds in the first 10 jobs).
  The data model still stores an `amountMinor` on `Refund` rather than
  a boolean "full/partial" flag, so partial refunds are a future
  capability addition, not a schema change.
- **Confidence:** HIGH.

## 2. Webhooks

**Capability:** PayPal POSTs event notifications to a registered
listener URL. Up to 10 listener URLs per app; subscribe to specific
event types or `*` for all. Non-2xx responses trigger automatic retry
(up to 25 times over 3 days).

- **Source:** [Webhooks overview](https://developer.paypal.com/api/rest/webhooks/)
- **Retrieved:** 2026-09-24
- **Confidence:** HIGH.

### Webhook signature verification

**Capability:** `POST https://api-m.sandbox.paypal.com/v1/notifications/verify-webhook-signature`
(production: `api-m.paypal.com`). Requires `auth_algo`, `cert_url`,
`transmission_id`, `transmission_sig`, `transmission_time` (all read
from the `PAYPAL-AUTH-ALGO`/`PAYPAL-CERT-URL`/`PAYPAL-TRANSMISSION-ID`/
`PAYPAL-TRANSMISSION-SIG`/`PAYPAL-TRANSMISSION-TIME` request headers),
plus the stored `webhook_id` (configured once, per app, in the
Developer Dashboard) and the raw `webhook_event` body. This remains
PayPal's current recommended verification method — a June 2023 update
"simplified" the endpoint but did not replace the API-call approach
with a local/offline verification method.

- **Source:** [Verify webhook signature](https://docs.paypal.ai/reference/api/rest/verify-webhook-signature/verify-webhook-signature), [PayPal Has Updated Its Webhook Verification Endpoint](https://developer.paypal.com/community/blog/paypal-has-updated-its-webhook-verification-endpoint/)
- **Retrieved:** 2026-09-24 (blog post itself dated 2023-06-01, still
  current per cross-referenced 2026 API docs)
- **Decision for Servino:** Every inbound webhook is verified via this
  API call before any database mutation — an unverified/failed-
  verification webhook is logged and discarded, never trusted (spec
  section 21/70).
- **Confidence:** HIGH.

### Relevant event names

- `CHECKOUT.ORDER.APPROVED`, `CHECKOUT.ORDER.COMPLETED`
- `PAYMENT.CAPTURE.COMPLETED`, `PAYMENT.CAPTURE.DENIED`,
  `PAYMENT.CAPTURE.DECLINED`, `PAYMENT.CAPTURE.PENDING`,
  `PAYMENT.CAPTURE.REFUNDED`, `PAYMENT.CAPTURE.REVERSED`
- `CUSTOMER.DISPUTE.CREATED`, `CUSTOMER.DISPUTE.UPDATED`,
  `CUSTOMER.DISPUTE.RESOLVED`

- **Source:** [Webhook event names](https://developer.paypal.com/api/rest/webhooks/event-names/)
- **Retrieved:** 2026-09-24
- **Confidence:** HIGH for the names; MEDIUM for this being an
  exhaustive list (PayPal's full event catalogue is large — only the
  subset relevant to Session G's scope was extracted).

## 3. PayPal Multiparty / Marketplace / Platform capability

**Capability:** PayPal's marketplace/platform product — the ability for
Servino to receive a customer's payment and, within the same PayPal
transaction, route/split funds so a professional's PayPal account is
the actual payee (with Servino taking a `platform_fees` cut),
optionally with `disbursement_mode: DELAYED` to hold professional funds
until Servino releases them. This is what spec section 4's "Category B"
refers to.

- **Source:** [Multiparty Payment Solutions](https://developer.paypal.com/docs/multiparty/) — developer.paypal.com
- **Retrieved:** 2026-09-24
- **Canada availability:** Not restricted in the documentation reviewed
  (the platform's own signup form lists Canada as a country option),
  but availability is moot given the approval gate below.
- **Account/partner requirement — THE HARD GATE:** Explicit, verbatim
  from the official page: **"Apply for live credentials and go live
  after your platform or marketplace has been approved."** A PayPal
  representative evaluates the business and contacts the applicant —
  this is not a self-service activation. A standard PayPal Business
  account **cannot** simply turn this on.
- **API involved:** Partner Referrals API (seller onboarding), Orders
  API with `purchase_units.payee`, `purchase_units.payment_instruction.
  platform_fees`, and `purchase_units.payment_instruction.
  disbursement_mode` fields.
- **Seller onboarding:** Confirmed via the Partner Referrals API docs:
  **"The Partner Referrals API endpoint is available to approved
  partners only... Before implementing, you must be an approved
  partner."** Sellers (professionals, in Servino's case) would need to
  be onboarded through this API, which itself requires Servino to
  already hold partner approval.
- **Delayed disbursement / platform fees:** Confirmed via official
  docs — `platform_fees` requires the seller to be "onboarded with the
  PARTNER_FEE feature," which is itself part of the same
  approved-partner program.
- **Limitations:** No amount of correct API implementation makes this
  usable without PayPal's own business-side approval, which is a
  relationship/compliance process, not a technical integration step.
- **Confidence:** HIGH that approval is required (confirmed by two
  independent official pages using nearly identical language). **ZERO
  confidence — genuinely unverifiable from this research session —
  on whether Servino's actual PayPal account currently holds, or could
  quickly obtain, that approval**, because no account access,
  application status, or partner-portal credentials were available to
  check. This is the crux of the Session G decision (see
  `docs/DECISIONS.md`).

## 4. PayPal Payouts (mass/batch payout to third parties)

**Capability:** Send payments from a Servino PayPal Business account to
one or more PayPal-account-holding recipients (e.g. professionals) via
a batch API call, independent of any customer order.

- **Source:** [What is the Payouts API (formerly known as Mass Pay) and how to apply for it?](https://www.paypal.com/us/cshelp/article/what-is-the-payouts-api-formerly-known-as-mass-pay-and-how-to-apply-for-it-help250) — official paypal.com help center
- **Retrieved:** 2026-09-24
- **Account/partner requirement:** A verified PayPal Business account
  that has **passed PayPal's verification process** and has "an
  acceptable business justification for using the product." Applied
  for either in-account ("Pay & Get Paid → Payouts") or via the
  Developer Dashboard.
- **Approval requirement — confirmed, official source, verbatim:**
  **"If you're not instantly approved, your application requires more
  review, and we will get back to you as soon as possible."** This is
  explicitly NOT guaranteed-instant for every applicant.
- **Recipient requirement:** Each payout recipient (i.e. each
  professional, in Servino's case) must themselves hold a PayPal
  account in good standing (confirmed email, verified mobile number
  where applicable) — Servino cannot pay out to a professional who has
  no PayPal account at all.
- **Country-specific limits:** The official Payouts Terms and
  Conditions are referenced as governing country-specific limits;
  exact Canada-specific payout limits were not located in this research
  pass (flagged for follow-up if Mode A is ever pursued later).
- **Confidence:** HIGH that approval + recipient-account requirements
  exist. **UNVERIFIED** whether Servino's account would be
  instantly-approved or requires manual review — no way to test this
  without actually applying through a real account.

## 5. Card acceptance (Advanced Credit and Debit Card Payments)

**Capability:** Hosted-fields card entry directly on Servino's own
checkout page (customer never sees a PayPal redirect), available for
business accounts in a defined list of ~37 countries.

- **Source:** [Set up advanced credit and debit card payments](https://developer.paypal.com/platforms/checkout/advanced), [Advanced credit and debit country and currency availability](https://developer.paypal.com/docs/checkout/advanced/currency-availability-advanced-cards/)
- **Retrieved:** 2026-09-24
- **Canada availability:** Not definitively confirmed in this research
  pass — the country list exists on a dedicated PayPal page not fully
  retrieved. **Not needed for Session G's decision either way**:
  standard PayPal Checkout already lets a customer pay by card as a
  guest, without a PayPal account, via PayPal's own hosted flow — this
  is a genuinely separate, simpler capability that requires no special
  approval and is what Session G actually implements. "Advanced" (fully
  embedded, no-redirect) card entry is a future UX enhancement, not a
  launch requirement.
- **Confidence:** MEDIUM — deliberately not pursued further since it
  doesn't affect the Mode A/B decision or the MVP checkout design.

## 6. Current PayPal Canada merchant fees

**Capability/rate:** Domestic (Canada-to-Canada) commercial transaction
fee: **2.90% + $0.30 CAD** per transaction. International transactions
add **0.80%** (US) or **1.00%** (all other countries) on top of the
domestic rate.

- **Source:** [Fees | Merchant and Business | PayPal CA](https://www.paypal.com/ca/business/paypal-business-fees) — official paypal.com/ca
- **Retrieved:** 2026-09-24
- **Page's own "last updated" date:** 2026-07-15 — genuinely current,
  not a stale cached figure.
- **Confidence:** HIGH — official, current, primary source. This
  **replaces** Session E's D028 assumption (which cited the generic
  Stripe Canada rate as a stand-in, since no payment provider had been
  selected yet) with the actual selected provider's own published rate.
  The numeric value is coincidentally nearly identical (2.9% + $0.30
  either way), so this update does not materially change any existing
  economics calculation — but it is now sourced correctly (PayPal
  Canada directly, not an unrelated provider used as a placeholder).

## 7. Chargebacks / disputes

**Capability:** A customer can file a dispute/chargeback with PayPal
independent of Servino's own systems. Servino is notified via
`CUSTOMER.DISPUTE.CREATED` (and later `.UPDATED`/`.RESOLVED`) webhooks.
A dispute can result in PayPal reversing a captured payment
(`PAYMENT.CAPTURE.REVERSED`).

- **Source:** [Subscribe to Disputes Webhooks](https://developer.paypal.com/docs/disputes/webhooks/)
- **Retrieved:** 2026-09-24
- **Decision for Servino:** Session G's data model represents a
  provider-side reversal/dispute as a real, distinct `PaymentStatus`
  value (not silently treated as a refund) and flags Admin via Action
  Required — no automated response/contest logic is built (spec
  section 53 explicitly limits scope to "data model must be able to
  represent... webhook should flag Admin," not a full dispute platform).
- **Confidence:** HIGH for the mechanism; the actual dispute-resolution
  business process (contesting a chargeback, providing evidence) is out
  of scope for Session G and not researched further here.

## Confidence summary

| Capability | Canada availability | Servino account eligibility | Confidence |
|---|---|---|---|
| Standard PayPal Checkout (Orders API, capture, refund) | Yes | Yes — no approval needed, just a verified Business account | HIGH |
| Webhooks + signature verification | Yes (not country-gated) | Yes | HIGH |
| Multiparty/marketplace (split payments, platform fees, delayed disbursement) | Not restricted, but moot | **UNVERIFIED — requires PayPal partner approval Servino does not currently have evidence of holding** | HIGH (on the approval requirement) / ZERO (on Servino's actual status) |
| Payouts API (batch payout to professionals) | Not fully confirmed, likely with country-specific limits | **UNVERIFIED — requires approval, "not instantly approved" for many applicants per official source** | HIGH (on the approval requirement) / ZERO (on Servino's actual status) |
| Advanced card processing (hosted fields) | Not confirmed | Not needed for MVP | MEDIUM (not pursued further — irrelevant to the decision) |
| Current Canada fees (2.9% + $0.30) | N/A | N/A | HIGH — official, dated 2026-07-15 |

## Questions to validate before ever attempting Mode A

If a future phase wants to revisit automated marketplace payouts, these
need real answers from an actual PayPal account/representative, not
more documentation research:

1. Does Servino's actual PayPal Business account currently have, or
   qualify to apply for, Partner/Platform approval for Multiparty?
2. Separately, does it qualify for Payouts API approval? (These are
   evaluated independently per the research above — approval for one
   does not imply approval for the other.)
3. What Canada-specific payout limits or restrictions apply, if
   approved?
4. What does each approval process actually require in terms of
   business documentation, expected transaction volume, and timeline?
5. Would every professional need their own PayPal account in good
   standing before Mode A could pay them at all (per the Payouts
   recipient requirement above)? If so, that's an operational
   onboarding requirement on top of the technical one.

None of these can be answered by reading more documentation — they
require actually applying through a real Servino PayPal account, which
is explicitly out of scope for an AI coding session to attempt or
fabricate the outcome of.
