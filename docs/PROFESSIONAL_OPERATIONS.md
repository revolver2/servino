# Professional Operations

_Session F. The owner-facing runbook for getting Servino's first
professionals set up and running real jobs through the mobile job app
at `/pro`. For the admin-facing side of the same workflow, see
`docs/ADMIN_OPERATIONS.md`. For the technical design, see
`docs/WORKFLOWS.md` ("Session F — Offer and field workflow"),
`docs/SECURITY_MODEL.md` ("Session F — Professional authentication and
authorization"), and `docs/DATA_MODEL.md` ("Session F — Minimal
Professional Job App")._

## Adding the first Servino professional

1. **Create the professional.** In `/admin`, go to **Professionals → Add
   professional**. Fill in their name, email, phone, which services they
   can do, and an optional service-area note. They're created **Active**
   with verification status **Missing** — this alone does not give them
   login access.
2. **Configure their service(s).** Make sure the checkboxes match what
   they can actually do — this is what determines which jobs you'll be
   allowed to offer them (an offer to a professional without the job's
   service is rejected server-side, not just hidden in the UI).
3. **Configure their area.** The free-text service-area note is
   informational only — Servino serves Toronto exclusively right now,
   so there's no filtering behavior tied to it.
4. **Set verification status** once you've actually vetted them
   (checked ID, licensing, references — whatever your own process is).
   There's no automated verification flow; this is a manual field for
   your own tracking, and it does not currently gate login or job
   offers either — `active` is what gates those.
5. **Create an activation link.** Open their professional detail page
   (`/admin/professionals/[id]`) and click **Generate activation link**
   in the Account section. The link appears **once**, right there on the
   page — copy it immediately. It's valid for 24 hours and can only be
   used once; if it expires or gets lost before they use it, just
   generate a new one (the old one, if unused, simply stops working once
   a new one is created and used — no cleanup needed on your part).
6. **Deliver the activation link securely.** Send it to the professional
   yourself — text message, a phone call reading it out, WhatsApp,
   email, whatever channel you already use to reach them. **There is no
   automatic email send** — this is a deliberate Session F scope
   decision (building real email infrastructure for 1–4 professionals
   wasn't worth it yet). Don't post the link anywhere public; anyone
   with the link and no other credential can set that professional's
   password within the 24-hour window.
7. **They set their credentials.** The professional opens the link in
   their phone's browser, lands on a "Set up your account" screen,
   chooses a password (at least 12 characters), and is automatically
   signed in to `/pro` — no separate login step needed the first time.
8. **Test their login yourself**, if you want extra confidence: sign out
   of their session (or just ask them to confirm they can see `/pro`),
   and separately verify they show up correctly on their own profile
   page.

Their account status (Activated / Not yet activated) is always visible
on their professional detail page in `/admin`, so you can tell at a
glance who still needs step 5–7 done.

## Offering the first job

1. **Open the job** in `/admin/jobs` once it's `Ready for assignment`
   (see `docs/ADMIN_OPERATIONS.md` for how a job gets there).
2. **Review the customer/project details** on the job detail page —
   service, area, style, material ownership, timing.
3. **Review the economics.** The Economics card shows your estimated
   professional payout, material cost, processing, CAC, and the
   resulting contribution profit/margin — this is Session E's internal
   estimate, a planning number, not what you're about to offer.
4. **Select an eligible professional.** Click **Offer this job**, which
   takes you to `/admin/professionals` in offer mode. Only active
   professionals with the matching service show as eligible.
5. **Confirm the offer compensation.** The amount field is pre-filled
   with the estimated payout from step 3 as a reference — you're free
   to enter a different number based on what you actually know about
   this professional's rates, the job's difficulty, or anything else.
   This is a real decision, not a formality; whatever you enter is what
   gets offered and (if accepted) permanently recorded for comparison
   against the estimate later.
6. **Click Offer.** The job moves to `Offered`. Nothing further happens
   automatically — the professional must open `/pro` themselves and
   respond.
7. **Wait for Accept or Decline.** Check back on the job detail page
   (there's no notification yet) — the Offer & field workflow card shows
   whether it's still awaiting a response, was accepted, or was
   declined (with the professional's stated reason, if they gave one).
8. **If declined:** the job automatically returns to `Ready for
   assignment`. Go back to step 4 and pick someone else. The decline you
   just saw stays in the job's permanent offer history — it will still
   be visible after someone else accepts.
9. **If accepted:** the job becomes `Accepted`, and from here the
   professional drives the rest themselves — see "Field workflow" below.

## Field workflow

Once accepted, this entire sequence happens on the professional's own
phone, in their own time, with no further action needed from you unless
something goes wrong:

```
Accept → En Route → Arrived → Start → Complete
```

Each step is a single button on their `/pro/jobs/[id]` screen, showing
only the one action that's actually valid next (you can't accidentally
see or tap "Complete" before "Start," for example — the app only ever
offers the real next step). Every step is timestamped and shows up on
your admin job detail page's Offer & field workflow card as it happens.

**"Completion reported" is not "paid."** When a professional marks a
job complete, that only means they're telling you the work is done.
Servino does not process payments yet — you still need to handle actual
payment collection from the customer and payment to the professional
yourself, outside the app, exactly as you did before Session F.

## Problem workflow

If a professional hits a problem — access issue, material problem,
scope turned out to be different than described, safety concern,
anything else — they can report it from their phone at any point after
accepting the job, without needing to abandon or complete it first.

```
Report Problem → Admin Action Required → manual resolution
```

You'll see it in two places: a red card directly on the job's detail
page (with their stated reason and any note they added), and a count in
the Overview's **Action Required** list ("Problem reported by a
professional") until you address it. **Reporting a problem does not
change the job's status automatically** — it's purely a flag for you.
Decide yourself what to do: call the professional, call the customer,
move the job to `Manual review` if it needs a closer look, or just note
it and let them continue if it's already resolved. There's no
resolution workflow beyond your own judgment — the report exists so you
know, not so the system acts for you.

**If the reported reason is a safety concern**, treat it as exactly
that — a professional reporting "Safety concern" has, in effect, told
you they may stop work. This app gives you the flag; it does not give
either of you legal or safety guidance beyond that.

## Estimated vs. actual compensation — why it matters

Every accepted job's detail page shows three numbers together:
**Estimated** (Session E's internal planning assumption — 75% of the
labor component, at launch), **Actual offered** (what you actually
agreed to pay, from step 5 of "Offering the first job" above), and the
**Difference**. This is deliberate: your first real professional
conversations are the actual data that should eventually replace
Session E's launch guesses. If you consistently find yourself offering
noticeably more (or less) than the estimate, that's a real signal worth
taking to a new Pricing version (`/admin/pricing`) rather than
adjusting individual offers forever — see `docs/ADMIN_OPERATIONS.md`
"Setting up Toronto pricing."

## Deactivating a professional

Uncheck **Active — eligible for assignment** on their professional
detail page. This takes effect immediately, even mid-session — they
lose access to `/pro` on their very next request, not just their next
login. Any job already assigned to them keeps its history; you just
can't offer them anything new. Their account and all past job history
remain intact — nothing is deleted.

## Known limitations (don't assume these are solved)

- **No email delivery for activation links** — you deliver them
  yourself, every time.
- **No professional-initiated password reset.** If a professional
  forgets their password, there's no self-service "forgot password"
  flow — generate them a fresh activation link the same way you did the
  first time; using it sets a brand-new password.
- **No offer expiration.** An open offer just sits there until the
  professional responds or you withdraw it.
- **No chat.** Coordination beyond what's on the job screen (customer
  contact info, address, timing, your own notes) happens by phone/text,
  outside Servino.
- **No GPS/map.** "En route" and "Arrived" are the professional's own
  honest declarations, not verified locations.
- **No earnings dashboard** beyond the single compensation figure and
  truthful payout status shown per job — no running total across jobs,
  no payment history list.
- **Professional profile is read-only** on their end. Name, services,
  and verification status are things you change on their behalf in
  `/admin`, not something they can edit themselves.
- **Worker classification is not determined by any of this.** Nothing
  about the accept/decline capability or the field workflow
  establishes, by itself, whether a given professional is legally an
  independent contractor or something else — that depends on the real
  relationship and needs your own legal/tax confirmation if you're ever
  unsure (spec section 3).

## Session G — Payout status

Once a professional reports a job complete, their job detail page
(`/pro/jobs/[id]`) shows a payout status alongside their agreed
compensation: **Not yet eligible** (the default — customer hasn't
confirmed yet, or you haven't overridden), **Eligible** (confirmed,
you can pay them now), **Held** (something blocked it — a reported
issue, most likely; talk to them directly, the app doesn't explain
why), or **Paid** (you've recorded that you paid them). This is always
the truthful current state — never an estimate, never implying
PayPal or any automated system sent them money directly. Payment
itself still happens entirely outside Servino, exactly as before
Session G — Servino only tracks whether it happened.
