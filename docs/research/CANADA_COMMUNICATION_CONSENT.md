# Canada Communication Consent — Research Notes

_Last updated: 2026-09-22, Phase B2. This is a working research document,
not legal advice, and has not been reviewed by a lawyer. It exists to
record open questions and the conservative, reversible defaults chosen
until those questions are formally resolved — per spec section 17
("where legal interpretation is unresolved, use conservative configurable
architecture")._

## What B2 actually does today

- Collects first name, email, phone **only** after a customer has viewed a
  price and chooses to continue — never earlier, never required to see a
  price.
- Records one `ConsentEvidence` row per contact submission: category
  `ESSENTIAL`, purpose "Follow up on the submitted project quote", channel
  `EMAIL`, jurisdiction `CA-ON`. This is a factual record of what the
  customer did (submitted a form, for a stated purpose), not an invented
  marketing opt-in.
- Does **not** collect, request, or pre-check any marketing/promotional
  consent. There is no marketing feature yet for such consent to attach
  to.
- Does **not** send any email or SMS yet — "follow up" today means a human
  (or, later, RingDesk per Phase J) contacting the customer by phone/email
  using the submitted contact details, not an automated marketing
  campaign.

## Open questions (unresolved — conservative defaults chosen)

### 1. Is explicit consent required for the initial operational follow-up?

CASL (Canada's Anti-Spam Legislation) primarily governs **Commercial
Electronic Messages** (CEMs) — promotional/commercial email and SMS. A
one-time reply to a request the customer themselves initiated (submitting
a project quote and asking to be contacted about it) is commonly treated
as implied consent / a service message rather than a CEM, but this
depends on the exact content of any follow-up message.

**Open:** Confirm with counsel whether Servino's planned follow-up
(phone call and/or a single confirmation email) needs explicit CASL
consent language, or qualifies under an implied-consent/existing-business-
relationship-adjacent exception given the customer-initiated request.

**Current default:** Treat it as operational/essential only. No
promotional content in any transactional message. No SMS sent at all in
B2 (spec section 17 lists SMS as an open question — not implemented).

### 2. Future RingDesk voice calls

Phase J will have RingDesk (spec sections 61–62) call customers/
professionals on Servino's behalf. Telemarketing/robocall rules in Canada
(CRTC unsolicited telecommunications rules) are distinct from CASL and
have their own consent and National DNCL (Do Not Call List) considerations.

**Open:** Whether Servino's calls qualify for the "existing business
relationship" exemption from DNCL rules given the customer-initiated
request, and what disclosure is required at call start.

**Current default:** No autonomous/automated outbound calling is
implemented anywhere in the product yet (spec section 60 — "unsolicited
autonomous calling should remain disabled until applicable telemarketing/
consent requirements are reviewed"). This remains true through B2.

### 3. Retention period

**Open:** How long a Lead/ContactInfo record should be retained if no
booking ever results (spec section 64 mentions retention as a future
consent-record field).

**Current default:** No automatic deletion/retention job exists yet.
Nothing is deleted automatically. This needs a policy decision before
launch, not just an engineering task.

### 4. Withdrawal mechanism

**Open:** What withdrawal actually needs to look like for essential/
operational contact (there's no ongoing marketing relationship to
"unsubscribe" from yet) versus a future marketing consent.

**Current default:** `ConsentEvidence.withdrawnAt` exists in the schema
(nullable) but nothing in the product UI lets a customer trigger it yet —
withdrawal today would be a manual request via the `/contact` page,
handled by a human.

## Architecture already in place for when these resolve

- `src/lib/consent/consent-manager.ts` — a small, configurable policy
  object (`mode`, `requiresExplicitOptIn`, `wordingVersion`) rather than a
  hardcoded assumption. Changing the mode or which categories require
  explicit opt-in is a config change, not a rewrite.
- `ConsentEvidence` (Prisma model) — category/purpose/channel/wording-
  version/timestamp/source-route/source-action/jurisdiction/withdrawal,
  so real evidence can be recorded once real consent UI exists for
  categories beyond essential.
- No blocking consent modal was added for Toronto (spec section 16
  explicitly says not to) — `mode: "NOTICE"` reflects that this is
  intentional, not an oversight.

## Explicit non-goals for B2

- No GDPR-style cookie/consent banner.
- No marketing consent collection or marketing emails/SMS.
- No automated outbound calling.
