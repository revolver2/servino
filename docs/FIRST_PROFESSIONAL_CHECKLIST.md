# First Professional Checklist

_Session H. A practical, print-or-copy-paste checklist for onboarding
each of Servino's first 1–4 Toronto professionals. Companion to the
interview questions in "Professional validation interview" below and
the technical steps already documented in
`docs/PROFESSIONAL_OPERATIONS.md`. Nothing here claims a legal
requirement (licensing, insurance) that hasn't actually been verified
— flagged for the Owner's own judgment where relevant._

## Before you create their account

- [ ] **Identity/business info collected** — legal name, business name
      if any, phone, email.
- [ ] **Service qualification** — confirm which of Wall Panels, Marble
      Sheets, Wallpaper, Decorative Partitions they can actually do
      well. Don't check a box just to fill capacity.
- [ ] **Toronto service area confirmed** — Servino serves Toronto only
      right now (spec section 54); confirm they actually work in the
      city, not just "the GTA generally."
- [ ] **Experience reviewed** — years doing this work, roughly how
      many similar jobs completed.
- [ ] **Portfolio/manual review** — photos of past work, even informal
      ones (phone photos are fine). No formal portfolio platform
      exists or is needed for the first few professionals.
- [ ] **Insurance** — ask if they carry liability insurance. Record
      what they tell you in their profile notes. **Servino does not
      verify or require proof of insurance as a technical gate** —
      this is a manual, informational field only (see
      `docs/PROFESSIONAL_OPERATIONS.md`). Decide your own bar for who
      you're comfortable sending real customers to.
- [ ] **Licensing/certification** — ask if their trade requires any
      (most decorative wall/interior finishing work in Ontario does
      not require a specific license, but confirm for the specific
      professional and material — this is not legal advice; verify
      independently if unsure).
- [ ] **Worker classification review** — nothing about Servino's offer/
      accept/field-workflow model determines, by itself, whether this
      person is legally an independent contractor. That depends on the
      real working relationship. If you're ever unsure, that's a
      question for an accountant/lawyer, not a technical setting (see
      `docs/DECISIONS.md`, carried forward from Session F).
- [ ] **Compensation agreement discussed** — see the interview
      questions below. You don't need a signed contract to onboard
      them in Servino, but you should have a clear, mutual
      understanding of how compensation works before the first job
      offer.
- [ ] **Material responsibility discussed** — for Material + Install
      jobs, who sources material? (Servino's job app shows a note to
      the professional for these jobs, but doesn't automate sourcing —
      `docs/PROFESSIONAL_OPERATIONS.md`.)

## Creating and activating their account

- [ ] Professional created in `/admin/professionals` with the right
      service(s) checked.
- [ ] Verification status set to reflect your actual review (Missing /
      Submitted / Under review / Verified) — this is a tracking field
      for you, not an access gate.
- [ ] Activation link generated and delivered **securely and
      personally** (text, call, or otherwise directly to them) — never
      posted anywhere public. It expires in 24 hours and is single-use.
- [ ] Confirmed they successfully set a password and can see `/pro`.

## First test run (recommended, not required)

- [ ] **Test login** — watch them (or ask them to confirm) they can
      sign in on their own phone.
- [ ] **Test JobOffer** — if practical, offer them a real or
      near-real job so you can watch the whole flow at least once
      before it matters:
  - [ ] Offer sent, compensation amount confirmed with them directly
        (not just assumed from the Session E estimate shown as a
        reference).
  - [ ] Accept/Decline works from their phone.
  - [ ] Field workflow (En route → Arrived → Start → Complete) — walk
        through it with them once, even for a practice/first real job,
        so they know what each button means.
- [ ] **Payout method confirmed** — ask how they want to be paid
      (e-transfer, cheque, etc.) and get whatever details you need
      (e-transfer email, etc.) **through a secure channel** — text/
      phone are acceptable for a first-10-jobs operation; never write
      full banking details into a `notes` field in `/admin` (that
      field is plain text, not encrypted storage — keep sensitive
      payout details in whatever secure channel you already use, and
      only put the minimal reference you need in Servino when you
      actually record a payout, per `docs/PAYOUTS.md`).

## Professional validation interview

Use these to sanity-check Session E's launch pricing assumptions
against what a real professional actually says (spec section 48) —
not a formal script, just make sure you actually ask:

- What's the smallest job you're willing to take? (Confirms/challenges
  Session E's minimum-job floor assumption.)
- What compensation do you expect for a typical Wall Panels job at
  roughly 10–15 m²? Is that per-project or do you think in per-hour
  terms?
- How far will you travel within Toronto?
- For Material + Install jobs: do you source material yourself, or do
  you expect Servino/the customer to?
- How available are you generally — days/week, notice needed?
- Specific experience with: Wall Panels / Marble Sheets / Wallpaper /
  Decorative Partitions (only ask about the ones they said they do).
- What tools do you already own vs. need to rent/buy for this kind of
  work?
- Do you carry liability insurance?
- Roughly how long does a typical job like this take you, start to
  finish?

Write down what they say — even briefly — in their professional
`notes` field or your own records. This is exactly the input Session
E's pricing assumptions need real data to validate against (see
`docs/FIRST_10_PRICING_VALIDATION.md`).
