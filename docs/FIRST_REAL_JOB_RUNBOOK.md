# First Real Job Runbook

_Session H. The exact, practical operating sequence for Servino's
first real, paid Toronto jobs — customer, Admin, and professional
sides. Companion to `docs/ADMIN_OPERATIONS.md`,
`docs/PROFESSIONAL_OPERATIONS.md`, `docs/PAYMENTS.md`, and
`docs/PAYOUTS.md`, which cover each piece in full technical detail;
this document is the condensed, in-order walkthrough for when a real
job is actually happening._

## Customer side

1. Customer lands on Servino (homepage or a paid landing page like
   `/toronto/wall-makeover`).
2. Selects their project (Wall Panels, Marble Sheets, Wallpaper, or
   Decorative Partitions).
3. Enters their Toronto location.
4. Enters measurements.
5. Uploads a photo (optional — can skip).
6. Chooses style and material ownership (installation only, or
   material + installation).
7. Sees the authoritative price (subtotal, HST, total) — this is a
   real, server-computed price from the active `PricingVersion`, not a
   placeholder.
8. Enters contact details.
9. Chooses timing.
10. Pays via PayPal Checkout (`/quote/payment`) — sees "Payment
    confirmed" once the server has actually verified the capture, not
    before.
11. Lands on the confirmation page, told a member of the Servino team
    will review and reach out.
12. **The Job now exists and is visible in `/admin/jobs`** — this
    happened automatically the moment they submitted their project
    (booking intent), before payment; payment is what makes it
    eligible to be offered to a professional (D044).

## Admin side

1. **Verify payment.** Open the job in `/admin/jobs`, confirm the
   Payment card shows "Payment confirmed" (`CAPTURED`). Do not offer
   this job to a professional until it does — the offer route itself
   enforces this server-side regardless.
2. **Review the project.** Service, location, style, material
   ownership, timing — all on the job detail page.
3. **Review the economics.** The Economics card shows the Session E
   estimate (professional payout, material cost, CAC, contribution) —
   a planning reference, not what you're about to actually offer.
4. **Check professional availability manually.** No automatic
   matching exists (and none is planned for this phase) — call or
   text your professional(s) directly if you need to confirm they can
   take it before formally offering it in Servino.
5. **Choose a professional** with the matching service, via "Offer
   this job" → `/admin/professionals` in offer mode.
6. **Confirm compensation with the professional directly**, then enter
   the real, agreed amount in the offer form — the Session E estimate
   pre-fills the field as a reference only.
7. **Click Offer.** The professional must open `/pro` themselves and
   respond — nothing else happens automatically.
8. **Monitor acceptance.** Check the job detail page (no push
   notification exists) — accepted, declined (with reason), or still
   awaiting response.
9. **Coordinate schedule manually if needed** — phone/text, exactly as
   before any of this software existed. Servino doesn't schedule
   appointments.

## Professional side

1. Receives the job offer notice from Admin **manually** (text, call —
   no automated notification exists).
2. Logs into `/pro` on their phone.
3. Reviews the JobOffer — service, location, customer first name/phone
   (revealed only after acceptance), timing, and the compensation
   amount.
4. Accepts or declines (with an optional reason if declining).
5. Travels to the job.
6. Marks **En Route** when they leave.
7. Marks **Arrived** when they get there.
8. Marks **Start** when they begin work.
9. Marks **Complete** when the work is done — this means "the
   professional says it's done," nothing more yet (see "Completion,"
   below).
10. **Reports an issue** at any point after accepting, if something
    goes wrong (access problem, material problem, scope mismatch,
    safety concern, can't complete, other) — this flags Admin, doesn't
    change the job's status automatically, and doesn't require
    abandoning or completing the job first.

## Completion

Once the professional marks a job Complete (`Job.status = COMPLETED` —
"completion reported," not yet "confirmed"):

**Customer:**
- Admin generates a one-time completion-confirmation link
  (`/admin/jobs/[id]` → "Generate confirmation link") and delivers it
  to the customer manually (text, call, email).
- Customer opens it and either:
  - **Confirms completion** — the job becomes genuinely confirmed
    (`Job.status = CONFIRMED`), and payout eligibility is computed.
  - **Reports an issue** — flags Admin, does **not** auto-transition
    the job, does **not** auto-refund. See "If something goes wrong"
    below.

**Admin (if the customer doesn't respond):**
- "Admin-confirm completion" on the job detail page — requires an
  explicit reason, is fully audited, and is always labeled distinctly
  from a real customer confirmation (never presented as if the
  customer confirmed).

## Payout

Once completion is confirmed (customer or admin) **and** there's no
unresolved customer issue, the job's payout becomes `ELIGIBLE` —
visible on `/admin/payouts`.

1. **Admin pays the professional externally** — whatever method you
   actually agreed on (e-transfer, cash, cheque).
2. **Admin records it** on `/admin/payouts/[id]`: the amount actually
   paid, the method, an optional reference number (e.g. an e-transfer
   confirmation), and an optional note. If the amount differs from the
   originally agreed offer, a reason is required.
3. **The professional sees "Paid"** on their own job detail page —
   truthful, real-time, never an estimate.

Servino's own systems never move money to the professional — this is
always a real, manual action Admin performs and then records (Mode B,
`docs/PAYOUTS.md`).

## Economics (after the job)

Once you know the real numbers, enter them on the job detail page's
"Actual costs" card:
- Actual material cost (leave blank if genuinely unknown — never enter
  $0 unless that's really true).
- Actual CAC for this specific job, if you can reasonably attribute
  one (leave blank otherwise).
- Other variable cost, if any (defaults to $0 — most jobs have none).

Once all of these plus the recorded payout are present, `/admin/launch`
computes this job's real actual contribution profit automatically —
never estimated, never silently defaulted.

## If something goes wrong (issues, refunds)

- **Customer reports an issue** (mid-job, via the professional's
  problem report, or post-completion, via the completion-confirmation
  link): flags Admin, visible on the job detail page and in Overview's
  Action Required. Resolve it through direct conversation with the
  customer and/or professional — there's no automated resolution
  workflow, by design.
- **A refund is warranted:** `/admin/payments/[id]` → "Issue full
  refund," requires a reason. If the professional hasn't been paid
  yet, their payout is automatically held. If they've already been
  paid, the refund does **not** automatically claw that back — you'll
  see a flag and need to handle it directly with the professional if
  appropriate.
- **No review/rating exists yet** — record what you learned about this
  job (what went well, what didn't) in your own notes or
  `docs/FIRST_10_PRICING_VALIDATION.md`'s tracking table, not in any
  customer-facing feature, since none exists.

## What doesn't exist (don't assume it)

No automated notifications (SMS/email/WhatsApp) at any step above —
every "tell the customer"/"tell the professional" step is manual, by
your own existing channel. No automatic matching. No live tracking. No
review/rating system. No chat. All exactly as documented in
`docs/PROJECT_STATUS.md`'s scope notes for Sessions F/G/H.
