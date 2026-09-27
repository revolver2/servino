# Admin Operations

_Session D + Session E + Session F. The owner-facing runbook for
operating Servino's first real Toronto jobs through `/admin`. For the
professional-facing side (what a professional actually sees and does),
see `docs/PROFESSIONAL_OPERATIONS.md`. For the technical design, see
`docs/ARCHITECTURE.md`, `docs/DATA_MODEL.md`, `docs/WORKFLOWS.md`
("Session D — Admin operational workflow", "Session E — Pricing version
lifecycle", "Session F — Offer and field workflow"),
`docs/SECURITY_MODEL.md` ("Session D — Admin authentication and
authorization", "Session E — Pricing and unit-economics security",
"Session F — Professional authentication and authorization"), and
`docs/PRICING_MODEL.md`/`docs/UNIT_ECONOMICS.md` for the formulas
themselves._

## Setup

### 1. Create the admin account

There is **no default admin account** and no `admin/admin` fallback.
Before `/admin` is usable at all, run the bootstrap script once against
your target database:

```
ADMIN_BOOTSTRAP_EMAIL="you@yourdomain.com" ADMIN_BOOTSTRAP_PASSWORD="a-real-passphrase-12-chars-plus" node --env-file=.env.local scripts/admin-bootstrap.mjs
```

or `npm run admin:bootstrap` after setting those two variables in your
shell (temporarily — remove `ADMIN_BOOTSTRAP_PASSWORD` from your
environment once the script has run; it is never read again).

Requirements enforced by the script itself (it aborts otherwise):
- Both `ADMIN_BOOTSTRAP_EMAIL` and `ADMIN_BOOTSTRAP_PASSWORD` must be set.
- The email must look like a real email address.
- The password must be at least 12 characters.
- `DATABASE_URL` must point at the database you actually intend to
  bootstrap (dev, test, or production — the script has no default and
  will use whatever `DATABASE_URL` resolves to).

Running the script again with the same email updates that account's
password and reactivates it if it had been deactivated — safe to re-run
if you need to rotate your password.

### 2. Sign in

Visit `/admin` — you'll be redirected to `/admin/login` if you don't
already have a valid session. Sign in with the email/password from
step 1. Sessions last 12 hours; sign out via the sidebar when you're
done on a shared machine.

## Setting up Toronto pricing (do this before real customers quote)

Until you activate a pricing version, `/api/lead/price` fails closed in
production — customers see "pricing unavailable," not a fabricated
number (D026). No pricing is auto-seeded; this is a deliberate step.

1. Go to **Pricing** in the sidebar. If no version exists yet, click
   **New draft version**.
2. The form is pre-filled with Session E's researched Toronto v1
   defaults (`docs/DECISIONS.md` D028) — service rates (install-only,
   material, material+install, minimum job per service), tax, and the
   internal economics assumptions (professional payout %, material cost
   %, payment processing, CAC, other variable cost, quote-health
   thresholds). Adjust anything you have real information to improve;
   leave the rest as-is for launch.
3. Save. The new version starts as **Draft** — nothing customer-facing
   changes yet.
4. Open the draft and use **Simulator** (or the "Simulator" link from
   the Pricing overview) to sanity-check a few realistic scenarios
   before committing — enter a service, an area, and see both the
   customer-facing price AND your internal contribution profit/margin
   for both Installation Only and Material + Installation side by side.
5. When you're satisfied, open the draft and click **Activate**. This
   immediately retires whatever version was previously active for
   Toronto (if any) and makes this one authoritative — every quote from
   this point forward uses these exact numbers, frozen at the moment
   each customer gets their price (changing a rate tomorrow never alters
   a quote already given today).
6. To change pricing later, don't edit an active version in place —
   create a new draft, review it, and activate it when ready. The old
   version's history (every quote it priced) stays intact and readable
   forever, exactly as it was when it priced those quotes.

**What "Unprofitable"/"Low margin" flags mean.** Every job's detail page
has an internal "Economics" section (never shown to the customer)
showing your estimated payout to the professional, estimated material
cost, payment processing, CAC, and the resulting contribution profit/
margin, plus a health label. A customer still gets a normal price even
on a flagged job (D029) — the flag is for you to notice and think about
before doing the work, not an automatic rejection. Jobs flagged
`Unprofitable` also appear in the Overview's **Action Required** list.

## A new customer submitted a project. What do I do?

1. **Sign in** at `/admin`.
2. Either open the **Action Required** card on the Overview (a "New
   customer requests need review" row links straight to the filtered
   list), or go to **Jobs** and filter by status `New`.
3. Open the job. The single detail screen shows everything: customer
   contact info, project details (service, area, style, material
   ownership), the authoritative quote (subtotal/tax/total from the
   frozen `QuoteSnapshot` — never recalculated), the customer's timing
   preference, and a full timeline.
4. **Review it.** Move status to `Reviewing` using the status control at
   the bottom of the page (only the transitions that are actually valid
   from the current status appear in the dropdown).
5. Once you're satisfied the project is real and workable, move it to
   `Ready for assignment`.
6. Click **Offer this job** (also available from the job's Professional
   card). You'll land on `/admin/professionals` in offer mode — a
   banner confirms which job you're offering. Only professionals who
   are **active** and have the job's **service** listed on their
   profile are eligible; ineligible ones are shown with a reason so you
   know why, but the choice is always yours.
7. Enter a **compensation amount** next to the professional you want
   (pre-filled with Session E's internal estimate as a reference — you
   can and often should enter a different, real number) and click
   **Offer**. The job's status advances to `Offered` — the professional
   has not yet agreed to anything. See `docs/PROFESSIONAL_OPERATIONS.md`
   for what happens on their end.
8. Wait for them to **Accept** or **Decline** in their own app (or check
   back on the job detail page — the Offer & field workflow card shows
   the current state). If they decline, the job automatically returns to
   `Ready for assignment` and you can offer it to someone else — repeat
   step 6. Their decline (and reason, if given) stays permanently in the
   job's offer history even after someone else later accepts it.
9. Once accepted, the job status becomes `Assigned` and the professional
   drives the rest themselves from their phone: `En route` → `Arrived` →
   `In progress` → `Completion reported`. You don't need to do anything
   during this — the job detail page updates live with each step,
   timestamped and audited. Servino still has no messaging/notification
   system (spec section 57), so you'll want to check `/admin` yourself
   rather than expect a ping.
10. Once you see **Completion reported**, that means the professional
    says the work is done — **not** that anyone has been paid (Session F
    doesn't process payments). Coordinate actual payment with the
    customer and the professional yourself, outside Servino, for now.

**If a professional reports a problem mid-job**, it shows up as a red
card on the job detail page and in the Overview's Action Required list
— the job's status is **not** automatically changed; decide yourself
whether it needs `Manual review` or just a phone call to sort out.

**Emergency/manual override:** if you need to bypass the offer flow
entirely (e.g. a professional already verbally agreed and you just want
to record it), `POST /api/admin/jobs/[id]/assign` still exists exactly
as it did in Session D — instant assignment, no acceptance step. It's
no longer linked from the UI, but nothing was removed; ask your
developer if you genuinely need this path.

## Withdrawing an offer

If you offered a job and want to pull it back before the professional
responds (wrong person picked, plans changed), open the job and click
**Withdraw offer** on the Professional card. The job returns to `Ready
for assignment`. If the professional accepts at almost the same moment
you click withdraw, whichever happened first on the server wins — you
may occasionally see "the professional already responded" if you were a
moment too late; the job detail page will show you which actually
happened.

## Job status reference

| Status | Meaning | You can move to |
|---|---|---|
| `New` | Just submitted by a customer (or newly reopened from Manual review) | Reviewing, Manual review, Cancelled |
| `Reviewing` | You're looking at it | Ready for assignment, Manual review, Cancelled |
| `Ready for assignment` | Vetted, needs an offer | (via the Offer flow), Manual review, Cancelled |
| `Offered` | Waiting on the professional to accept/decline | (via their response), Manual review, Cancelled |
| `Accepted` (`ASSIGNED`) | Professional agreed, hasn't left yet | (via their En route), back to Ready for assignment, Manual review, Cancelled |
| `En route` | Professional is on the way | (via their Arrived), Manual review, Cancelled |
| `Arrived` | Professional is on site | (via their Start), Manual review, Cancelled |
| `In progress` | Work underway | (via their Complete), Disputed, Manual review, Cancelled |
| `Completion reported` (`COMPLETED`) | Professional says it's done — not paid | Disputed (if a problem surfaces later) |
| `Disputed` | Something went wrong | Reviewing, Completed, Cancelled |
| `Manual review` | You've flagged it for a closer look | Reviewing, Ready for assignment, Cancelled |
| `Cancelled` | Terminal — no further changes | — |

Every transition is enforced server-side
(`src/lib/server/job-status.ts`) — the offer/field-progress steps in
parentheses happen via the professional's own app or the offer
endpoints, not the generic status dropdown (which deliberately won't
even offer them, to avoid a job claiming a state with no real offer/
acceptance behind it). The dropdown still covers every administrative
transition (Manual review, Cancelled, Disputed, etc.) exactly as before.

## Adding a professional

Go to **Professionals → Add professional**. Fill in name, email, phone,
which services they can do, and an optional service-area note (Servino
serves Toronto only right now, so this is informational, not a filter).
New professionals default to **Active** and verification status
**Missing** — set verification status once you've actually vetted them
(there's no automated verification flow yet; this is a manual field for
your own tracking).

To take someone out of rotation without deleting their record (their
job history stays intact), open their profile and uncheck **Active —
eligible for assignment**. Inactive professionals can't be offered new
jobs but keep their existing assignments and history, and immediately
lose access to `/pro` even mid-session (D032).

**Activating their account** is a separate step — see
`docs/PROFESSIONAL_OPERATIONS.md` "Adding the first Servino
professional" for the full activation runbook.

## Leads vs. Jobs — what's the difference?

A **Lead** is the full record of a customer's funnel session, including
ones that never finished (started a quote, never submitted). A **Job**
only exists once a customer actually submits a project request — it's
created automatically the moment their booking intent is recorded, with
no manual "convert this lead" step required. Every Job links back to its
Lead (the "View lead" button on any job's page); not every Lead has a
Job.

## What the Overview page tells you

- **New leads (7d) / Submitted (7d)** — funnel activity over the last
  week, not a lifetime total (a lifetime counter would just grow forever
  and tell you less about what's happening *now*).
- **Unassigned jobs** — active (not completed/cancelled) jobs with no
  professional yet.
- **Active jobs** — currently `Accepted`/`En route`/`Arrived`/`In progress`.
- **Completed jobs** — all-time count.
- **Pipeline value** — sum of the frozen quote totals for every
  non-cancelled job. This is customer-facing GMV (subtotal + tax as
  quoted), not your actual take — it does not subtract professional
  payout, material cost, processing, or CAC. For real profitability, use
  a job's own internal Economics section, or the Pricing simulator.
  Once real Toronto pricing is active (Session E), this reflects real
  quoted amounts; before that, or for any quote priced by the
  non-production mock fallback, treat it as illustrative only.
- **Action Required** and **Recent Activity** are both computed live
  from the database on every page load — nothing here is cached,
  hardcoded, or a static demo.

## Known limitations (don't assume these are solved)

- **No email/SMS notifications.** You have to actively check `/admin`;
  nothing pings you when a job is offered, accepted, or a problem is
  reported — only when you happen to look.
- **Professionals can now log in and see/act on their own jobs (Session
  F)** — this replaces the old "No professional login" limitation. What's
  still true: no chat/messaging with them beyond the job's own data, and
  no push notification to them either — they have to check `/pro`.
- **No payments.** Nothing here processes or transfers money — not to
  you from the customer, not to a professional from you. "Quote value"
  is what the customer was quoted; "professional payout estimate"
  (Session E) is an internal planning number; "offer amount" (Session F)
  is what you agreed to pay, recorded but not transferred. "Completion
  reported" means the professional says it's done, not that they were
  paid.
- **No automatic matching or re-offering.** Every offer is a deliberate
  choice you make; the system will never pick a professional for you,
  and a decline never automatically goes to someone else.
- **Internal notes aren't wired up yet.** The database has a place for
  them (`AdminNote`), but there's no button to add one yet.
- **Single admin role.** Everyone with a login has full access — there's
  no "read-only" or "support-only" account yet, even though the
  underlying role field exists for later.
- **Pricing assumptions are launch estimates, not researched-and-
  validated numbers.** Professional payout %, material cost %, and CAC
  are flagged in `docs/DECISIONS.md` D028 as needing real validation —
  Session F's estimated-vs-actual compensation comparison on each job
  detail page is the tool for starting that validation once real jobs
  complete, but no real job has completed yet.
- **One city.** Pricing is scoped to `citySlug: "toronto"` — the schema
  allows a second city later, but nothing in the UI lets you add one
  today.
- **No activation-link email delivery.** You copy the link yourself and
  send it however you already reach your professionals (text, call,
  WhatsApp) — see `docs/PROFESSIONAL_OPERATIONS.md`.
- **No offer expiration.** An open offer sits there until the
  professional responds or you withdraw it — nothing times it out
  automatically.

## Session G — Payments and payouts

**A job cannot be offered until the customer has paid.** This is
enforced server-side, not just a disabled button — if you try to offer
a job before `/admin/payments` shows it as `CAPTURED`, the offer route
itself rejects the request.

**Reviewing a payment.** `/admin/payments` lists every payment;
`/admin/payments/[id]` shows the amount, provider order/capture IDs,
the full event history, and any refunds. If something looks off
compared to what you'd expect from the PayPal dashboard itself, click
**Reconcile with provider** — it fetches the order directly from
PayPal and self-heals Servino's own record if it was behind (e.g. a
missed webhook).

**Issuing a refund.** From a payment's detail page, **Issue full
refund** requires a reason and refunds the entire captured amount back
to the customer's original payment method — there's no partial-refund
option yet. If the professional was already paid for that job, the
response tells you so (`payoutAlreadyPaid`) — the refund does **not**
automatically claw back their payout; that's a manual conversation
with the professional if needed.

**Confirming completion.** Once a professional reports a job complete,
you have two options on the job detail page: **Generate confirmation
link** (a one-time link you deliver to the customer yourself — same
delivery model as professional activation links, valid 14 days), or
**Admin-confirm completion** (for when the customer won't respond —
requires a reason, and is always clearly labeled as an admin decision,
never presented as if the customer confirmed).

**If a customer reports an issue instead of confirming**, you'll see it
directly on the job detail page and in Overview's Action Required.
Nothing happens automatically — decide what to do the same way you'd
handle a professional's problem report.

**Recording a payout.** Once a job's completion is confirmed (and
there's no open issue), `/admin/payouts` shows it as `ELIGIBLE`. Pay
the professional yourself, however you actually do that (e-transfer,
cash, cheque), then record it on `/admin/payouts/[id]` — amount,
method, an optional reference number. If you pay a different amount
than what was originally offered, you'll need to give a reason; the
original offer stays visible for comparison either way.

**Payments/payouts dashboard.** Overview now shows Payments Pending/
Confirmed, jobs Awaiting Customer Confirmation, Payouts Eligible/Held,
and Issues Requiring Attention — all real counts from the database, no
estimates.

## Session H — Launch dashboard and actual costs

**`/admin/launch`** is the "first 10 real Toronto jobs" operating
dashboard — see `docs/UNIT_ECONOMICS.md` "Session H — actual economics"
for the exact contribution-margin formula it displays. It shows a
milestone hero (`X/10 completed paid jobs`), twelve real-data metric
cards (revenue, payouts paid, refunds, estimate-vs-actual variance,
etc.), a callout listing any confirmed/paid job still missing actual
costs, and a per-job table comparing Session E's estimate against
Session H's recorded actual for every job with a payment. Nothing on
this page is a projection or placeholder — a metric that can't yet be
computed (e.g. actual contribution margin before all three actual-cost
inputs exist) shows as **missing**, never a guessed or zeroed number.

**Recording actual costs.** On a job's detail page, once it has a
payment, an **Actual costs** card lets you enter the real material
cost and real customer-acquisition cost for that specific job (both
start blank — leaving a field blank is recorded as unknown, not $0).
"Other variable cost" is the one field that starts pre-filled at
$0.00, since it's genuinely usually zero and forcing an entry for it
on every job would be pure friction. A job's actual contribution
margin only appears on `/admin/launch` once its payout is `PAID` **and**
both material cost and CAC have been entered — this is intentionally
strict so the dashboard never shows a false "complete" number built
from partially-missing data.

**Feature-flag kill switches.** `acceptNewProfessionals`, `newBookings`,
and `paymentsEnabled` (`src/lib/feature-flags.ts`) are now real,
server-enforced switches, not dead config — flipping one to `false`
and redeploying immediately blocks new professional creation, new
booking-intent creation, or payment-order creation respectively, each
with a truthful user-facing message (never a generic error). There is
no live admin UI toggle; changing a flag means editing the file and
redeploying — acceptable at 1–4 professionals and a handful of jobs a
week, see `docs/DECISIONS.md` D047. Use these as the emergency-stop
mechanism described in `docs/LAUNCH_CHECKLIST.md` "Emergency stop."
