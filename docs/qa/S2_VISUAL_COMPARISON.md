# S2 Visual Comparison — Baseline vs. Post-Polish

Baseline: `docs/qa/baseline-s2/` (captured before any S2 styling change).
Post-S2: `docs/qa/post-s2/` (captured after Tasks #74–#81).

Expected behavioral impact for every row below: **None — presentation
only.** S2 did not touch `PricingAdapter`, `LeadAdapter`,
`AnalyticsAdapter`, `ConversionAdapter`, API routes, the Prisma schema,
or any validation/calculation logic. Where a row's behavior could
plausibly be affected (e.g. a reordered DOM element touching tab
order), it's called out explicitly.

## 01 — Project + Location

- **Baseline issue:** Service cards were plain bordered boxes with no
  visual distinction beyond a border-color change on selection; no
  iconography tying them to the homepage's Services section language.
- **Change made:** Added a colored icon block per card (purple/coral/
  teal accent rotation matching the homepage) and a purple checkmark
  badge overlay shown only when selected.
- **Result:** Cards now visually match the homepage's card language;
  selection state is unambiguous at a glance.
- **Behavioral impact:** None. Selection logic (`handleSelectService`,
  `aria-pressed`) unchanged.
- **Accessibility impact:** None negative — `aria-pressed` still
  present; checkmark SVG is `aria-hidden`, selection state is still
  conveyed to assistive tech via `aria-pressed`, not just the visual
  badge.

## 02 — Measurements (two walls)

- **Baseline issue:** Wall cards had no numbering affordance beyond
  the "Wall N" text; the total-area summary used a solid purple-light
  fill with large bold text that visually competed with the Price
  screen's Total hero, risking users mistaking it for the final price.
- **Change made:** Added a small numbered circle badge per wall card;
  restyled the total-area summary to a neutral bordered card with a
  small teal dot accent and renamed the label to "Total project area."
- **Result:** Wall cards read as a clear numbered list; the area
  summary now reads as informational, not a price.
- **Behavioral impact:** None. `totalAreaM2`/`wallAreaM2` calculations
  and validation untouched.
- **Accessibility impact:** None. No semantic elements changed.

## 03a / 03b — Photo (uploaded / empty state)

- **Baseline issue:** Empty state was two plain, visually-equal
  buttons ("Upload" and "Skip"), with no drag-and-drop-style affordance
  and no file-type/size hint before the user attempts a bad upload.
- **Change made:** Empty state is now a dashed-border dropzone with an
  upload icon, "Upload Photo" title, and a "JPG, PNG, or WEBP — up to
  8MB" helper line; "Skip for now" demoted to a secondary full-width
  button below it. Selected state gained a teal checkmark badge on the
  image and re-ordered CTAs (Continue primary/first).
- **Result:** Upload affordance reads as the primary, obvious action;
  skip is available but visually secondary; file constraints are
  visible before the user picks a file.
- **Behavioral impact:** None. `validateFile`/`mediaErrorMessage`
  logic, accepted MIME types, and the skip/continue routing are
  unchanged — only button order and container markup changed.
- **Accessibility impact:** None negative. The dropzone is still a
  real `<button>` with the same file-input trigger; tab order changed
  slightly (Skip now follows Upload in DOM order in the empty state,
  matching visual order) but both remain reachable and labeled.

## 04 — Style + Material

- **Baseline issue:** Style swatches had no explicit selected-state
  marker beyond a ring; material ownership cards were plain text
  blocks with only a border/background color change to indicate
  selection.
- **Change made:** Added a checkmark badge overlay to selected style
  swatches and bold label text; added a radio-style circle indicator
  (filled + checkmark when selected) to material ownership cards,
  matching the visual language later reused on Timing (07).
- **Result:** Both selection groups now have an explicit, redundant
  (not color-only) selected-state indicator.
- **Behavioral impact:** None. `handleSelectStyle`/
  `handleSelectMaterial` and the continue-gating logic unchanged.
- **Accessibility impact:** Positive — selection no longer relies on
  color/ring alone; a checkmark glyph provides a second visual signal
  for users with color-vision deficiencies. `aria-pressed` was already
  present and remains so.

## 05a / 05b — Price (material+install / install-only)

*The most important conversion screen in S2.*

- **Baseline issue:** The Subtotal/Tax/Total breakdown card appeared
  directly under the Total hero, ahead of the plain-text project
  summary — burying the "what am I actually buying" context below a
  second, smaller total. The Material label was ambiguous ("Material"
  when the value could be "Installation only"). Loading and failure
  states had no icon, only text.
- **Change made:** Reordered so the project-summary card (now labeled
  with a "What's priced" eyebrow, "Material" renamed to "Includes")
  appears immediately after the Total hero, with the Subtotal/Tax/
  Total breakdown second. Added a spinner to the loading state and a
  warning-triangle icon badge to the failure state. The Total hero
  card itself (ink background, large white total, "Continue to
  Booking" CTA) was left visually unchanged — it must stay the
  dominant, first-seen element.
- **Result:** Screen now reads Total → what's included → the math
  behind it, instead of Total → math → what's included. Loading/
  failure states feel less like a blank/broken screen.
- **Behavioral impact:** None. `markPriceViewed`, retry logic
  (`retryKey`/`firedForRetry` StrictMode dedupe guard), and the
  conversion-event firing on `status === "ok"` are byte-for-byte
  unchanged — only JSX order and added decorative markup.
- **Accessibility impact:** None negative. `formatCadMinor` output and
  reading order for screen readers still starts with the Total hero
  (`<h1>` "Your Servino price" precedes it in the DOM), then now
  reaches the summary card before the breakdown card — arguably an
  accessibility improvement, since context now precedes detail.

## 06 — Contact

- **Baseline issue:** Form fields floated directly on the page
  background with no card container, visually inconsistent with every
  other step's bordered-card language; the error banner had no icon.
- **Change made:** Wrapped the form in a bordered card
  (`rounded-2xl border border-border bg-white p-5`); added a
  warning-triangle icon to the submit-error banner, matching the icon
  language introduced on the Price failure state.
- **Result:** Contact now visually matches the rest of the funnel's
  card-based layout instead of reading as a bare, unstyled form.
- **Behavioral impact:** None. Field validation
  (`EMAIL_RE`/name/phone-digit-count checks), the honeypot field, and
  `saveContactDetails` submission are unchanged — the honeypot is
  still visually hidden via the same off-screen technique, untouched.
- **Accessibility impact:** None. Labels, `aria-invalid`, and
  `aria-describedby` wiring on each field are unchanged.

## 07 — Timing

- **Baseline issue:** Timing option cards had no explicit selected-
  state marker beyond a background/border color change — the same
  color-only-selection gap as the pre-polish Style/Material cards.
  There was also no supporting subtext under the heading.
- **Change made:** Added the same radio-style circle indicator used on
  Material ownership cards, `motion-safe:hover:-translate-y-0.5` on
  unselected cards, and a short neutral subtext line ("Choose the
  option that best fits your project.") that makes no promise about
  matching or scheduling. Also added the warning-icon treatment to the
  submit-error banner.
- **Result:** Consistent selection affordance with the rest of the
  funnel; no new claims introduced.
- **Behavioral impact:** None. `saveTiming`/`markBookingIntent`
  sequencing, the `bookingIntentId` capture, and conversion-event
  firing (`booking_intent`) are unchanged.
- **Accessibility impact:** Same positive as 04 — redundant
  (non-color-only) selection signal via `aria-pressed` + checkmark.

## 08 — Confirmation

- **Baseline issue:** The success screen had no visual celebratory
  moment — same plain `<h1>`/`<p>` treatment as an error state, despite
  being the funnel's payoff screen. Not-found/error states similarly
  had no icon, reading like a generic broken page.
- **Change made:** Added a teal checkmark circle above the success
  heading (reusing the checkmark visual language from Photo/Style/
  Timing selection states, now as a celebration rather than a
  selection marker); added the same warning-triangle icon to the
  not-found and error states as the Price/Contact failure states; the
  summary card gained a "What you submitted" eyebrow label matching
  the Price screen's "What's priced" pattern.
- **Result:** Success now visually reads as success; error states are
  visually consistent with every other failure state in the funnel.
- **Behavioral impact:** None. This component still determines
  success/failure **only** from `LeadAdapter.getConfirmation()`'s
  server response — the ref-based fetch dedupe, the "no client-side
  determination of success" invariant, and the disclaimer paragraph
  ("does not mean a professional has been assigned…") are
  byte-for-byte unchanged.
- **Accessibility impact:** None negative. The checkmark/warning icons
  are `aria-hidden`; heading text (the actual status signal for screen
  readers) is unchanged.

## 09 — Validation error (Measurements)

- **Baseline issue:** Error text presentation was already adequate
  (coral text under each invalid field) but sat inside a wall card
  that hadn't yet received the numbered-badge/shadow treatment applied
  elsewhere in Step 2.
- **Change made:** Inherits the Step 2 wall-card polish from item 02
  above (numbered badge, hover shadow) — no changes specific to the
  error-rendering logic itself.
- **Result:** Error state now sits inside the same visually-polished
  card as the valid state.
- **Behavioral impact:** None. `dimensionError` validation and the
  `touched`-gated error display are unchanged.
- **Accessibility impact:** None. `aria-invalid` on each input is
  unchanged.

## 10 — Pricing failure

- **Baseline issue:** No icon; a bare heading, message, and "Try
  again" button.
- **Change made:** Added a warning-triangle icon badge above the
  heading (purple-light circle, matching the icon language used
  throughout S2's error/failure states) and `transition-colors` on the
  retry button.
- **Result:** Visually consistent with the Contact/Timing/Confirmation
  failure treatments introduced in the same pass.
- **Behavioral impact:** None. The retry mechanism
  (`setLoadState("loading")` + `setRetryKey`) and the underlying
  "price unavailable" server response handling are unchanged. Captured
  via the same temporary, immediately-reverted
  `dev-pricing-config.ts` edit used for the baseline — confirmed
  restored via direct file read-back and a clean `tsc --noEmit`
  immediately after.
- **Accessibility impact:** None. Icon is `aria-hidden`; the actual
  failure reason text (`unavailableReason`) is unchanged and still
  rendered as visible text, not conveyed only by the icon.

## Funnel shell (header / progress indicator)

*Not a numbered screenshot, but touched across all steps.*

- **Baseline issue:** Progress bar segments changed color with no
  transition (abrupt jump); the back button had no visible hover/focus
  treatment, which is also an accessibility gap (no visible focus
  indicator for keyboard users).
- **Change made:** Added `transition-colors duration-300` to progress
  segments; added `hover:`/`focus-visible:` treatment to the back
  button.
- **Result:** Step transitions feel smoother; keyboard users now get a
  visible focus ring on the back button.
- **Behavioral impact:** None. Step routing and the `aria-label`
  already present on the progress bar (from the S1 accessibility fix)
  are unchanged.
- **Accessibility impact:** Positive — this closes a keyboard-focus-
  visibility gap that existed at the S2 baseline.

## Summary

12/12 baseline scenarios re-captured post-polish with matching test
data. Every change in this document is additive markup/class changes
to already-rendered state — no step was added, removed, reordered, or
had its validation/gating logic modified. Two changes are flagged
above as accessibility **improvements** (Style/Material/Timing
redundant selection signal; back-button focus visibility); none are
flagged as regressions. Full regression-suite and Lighthouse
verification against these changes is tracked separately (Tasks #83,
#84).
