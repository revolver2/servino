/** Display labels/tones for admin status chips — presentation only, no business logic. */

const LEAD_STATUS_LABEL: Record<string, string> = {
  QUOTE_STARTED: "Quote started",
  QUOTE_PARTIAL: "Quote partial",
  PRICE_VIEWED: "Price viewed",
  CONTACT_CAPTURED: "Contact captured",
  BOOKING_INTENT: "Submitted",
};

export function leadStatusLabel(status: string): string {
  return LEAD_STATUS_LABEL[status] ?? status;
}

export function leadStatusTone(status: string): "neutral" | "purple" | "teal" {
  if (status === "BOOKING_INTENT") return "teal";
  if (status === "CONTACT_CAPTURED" || status === "PRICE_VIEWED") return "purple";
  return "neutral";
}

const JOB_STATUS_LABEL: Record<string, string> = {
  NEW: "New",
  REVIEWING: "Reviewing",
  READY_FOR_ASSIGNMENT: "Ready for assignment",
  OFFERED: "Offered",
  ASSIGNED: "Accepted",
  EN_ROUTE: "En route",
  ARRIVED: "Arrived",
  IN_PROGRESS: "In progress",
  COMPLETED: "Completion reported",
  CONFIRMED: "Completion confirmed",
  CANCELLED: "Cancelled",
  DISPUTED: "Disputed",
  MANUAL_REVIEW: "Manual review",
};

export function jobStatusLabel(status: string): string {
  return JOB_STATUS_LABEL[status] ?? status;
}

export function jobStatusTone(status: string): "neutral" | "purple" | "coral" | "teal" {
  if (status === "COMPLETED" || status === "CONFIRMED") return "teal";
  if (status === "DISPUTED" || status === "MANUAL_REVIEW" || status === "CANCELLED") return "coral";
  if (
    status === "OFFERED" ||
    status === "ASSIGNED" ||
    status === "EN_ROUTE" ||
    status === "ARRIVED" ||
    status === "IN_PROGRESS" ||
    status === "READY_FOR_ASSIGNMENT"
  )
    return "purple";
  return "neutral";
}

const VERIFICATION_LABEL: Record<string, string> = {
  MISSING: "Missing",
  SUBMITTED: "Submitted",
  UNDER_REVIEW: "Under review",
  VERIFIED: "Verified",
  REJECTED: "Rejected",
  EXPIRED: "Expired",
  SUSPENDED: "Suspended",
};

export function verificationLabel(status: string): string {
  return VERIFICATION_LABEL[status] ?? status;
}

export function verificationTone(status: string): "neutral" | "purple" | "coral" | "teal" {
  if (status === "VERIFIED") return "teal";
  if (status === "REJECTED" || status === "SUSPENDED" || status === "EXPIRED") return "coral";
  if (status === "SUBMITTED" || status === "UNDER_REVIEW") return "purple";
  return "neutral";
}

const TIMING_LABEL: Record<string, string> = {
  ASAP: "As soon as possible",
  WITHIN_2_WEEKS: "Within 1–2 weeks",
  WITHIN_MONTH: "Within a month",
  JUST_PLANNING: "Just planning",
};

export function timingLabel(value: string | null): string {
  if (!value) return "—";
  return TIMING_LABEL[value] ?? value;
}

const MATERIAL_LABEL: Record<string, string> = {
  INSTALL_ONLY: "Installation only",
  MATERIAL_AND_INSTALL: "Material + installation",
};

export function materialOwnershipLabel(value: string | null): string {
  if (!value) return "—";
  return MATERIAL_LABEL[value] ?? value;
}

const QUOTE_HEALTH_LABEL: Record<string, string> = {
  HEALTHY: "Healthy",
  ACCEPTABLE: "Acceptable",
  LOW_MARGIN: "Low margin",
  UNPROFITABLE: "Unprofitable",
};

export function quoteHealthLabel(value: string): string {
  return QUOTE_HEALTH_LABEL[value] ?? value;
}

export function quoteHealthTone(value: string): "neutral" | "purple" | "coral" | "teal" {
  if (value === "HEALTHY") return "teal";
  if (value === "ACCEPTABLE") return "purple";
  if (value === "LOW_MARGIN" || value === "UNPROFITABLE") return "coral";
  return "neutral";
}

const PRICING_SOURCE_LABEL: Record<string, string> = {
  AUTHORITATIVE_VERSIONED: "Authoritative (versioned)",
  MOCK_DEV: "Development mock",
};

export function pricingSourceLabel(value: string): string {
  return PRICING_SOURCE_LABEL[value] ?? value;
}

const REASON_CODE_LABEL: Record<string, string> = {
  UNAVAILABLE: "Unavailable",
  TIMING: "Timing doesn't work",
  OUTSIDE_AREA: "Outside their area",
  NOT_SUITABLE: "Project not suitable",
  OTHER: "Other",
  CUSTOMER_UNAVAILABLE: "Customer unavailable",
  ACCESS_PROBLEM: "Access problem",
  MATERIAL_PROBLEM: "Material problem",
  SCOPE_DIFFERS: "Scope differs from what was described",
  SAFETY_CONCERN: "Safety concern",
  CANNOT_COMPLETE: "Cannot complete the job",
};

export function reasonCodeLabel(code: string): string {
  return REASON_CODE_LABEL[code] ?? code;
}

const OFFER_STATUS_LABEL: Record<string, string> = {
  OFFERED: "Awaiting response",
  ACCEPTED: "Accepted",
  DECLINED: "Declined",
  WITHDRAWN: "Withdrawn",
};

export function offerStatusLabel(status: string): string {
  return OFFER_STATUS_LABEL[status] ?? status;
}

export function offerStatusTone(status: string): "neutral" | "purple" | "coral" | "teal" {
  if (status === "ACCEPTED") return "teal";
  if (status === "DECLINED") return "coral";
  if (status === "OFFERED") return "purple";
  return "neutral";
}

// ---------------------------------------------------------------------------
// Session G — payments, payouts, refunds
// ---------------------------------------------------------------------------

const PAYMENT_STATUS_LABEL: Record<string, string> = {
  PENDING: "Not started",
  CREATED: "Order created",
  APPROVED: "Approved — processing",
  CAPTURED: "Payment confirmed",
  FAILED: "Payment failed",
  CANCELLED: "Cancelled",
  REFUNDED: "Refunded",
  PARTIALLY_REFUNDED: "Partially refunded",
  DISPUTED: "Disputed",
};

export function paymentStatusLabel(status: string): string {
  return PAYMENT_STATUS_LABEL[status] ?? status;
}

export function paymentStatusTone(status: string): "neutral" | "purple" | "coral" | "teal" {
  if (status === "CAPTURED") return "teal";
  if (status === "FAILED" || status === "DISPUTED" || status === "REFUNDED" || status === "PARTIALLY_REFUNDED") return "coral";
  if (status === "CREATED" || status === "APPROVED") return "purple";
  return "neutral";
}

const PAYOUT_STATUS_LABEL: Record<string, string> = {
  ELIGIBLE: "Eligible",
  PAID: "Paid",
  HELD: "Held",
  CANCELLED: "Cancelled",
};

export function payoutStatusLabel(status: string): string {
  return PAYOUT_STATUS_LABEL[status] ?? status;
}

export function payoutStatusTone(status: string): "neutral" | "purple" | "coral" | "teal" {
  if (status === "PAID") return "teal";
  if (status === "HELD" || status === "CANCELLED") return "coral";
  if (status === "ELIGIBLE") return "purple";
  return "neutral";
}

/** Truthful, professional-facing label — never implies eligibility that hasn't actually been computed. */
export function proPayoutStatusLabel(payoutStatus: string | null): string {
  if (!payoutStatus) return "Not yet eligible";
  return PAYOUT_STATUS_LABEL[payoutStatus] ?? payoutStatus;
}

const CUSTOMER_ISSUE_REASON_LABEL: Record<string, string> = {
  INCOMPLETE: "Work wasn't finished",
  QUALITY: "Quality concern",
  DAMAGE: "Something was damaged",
  SCOPE: "Different from what was agreed",
  OTHER: "Other",
};

export function customerIssueReasonLabel(code: string): string {
  return CUSTOMER_ISSUE_REASON_LABEL[code] ?? code;
}

export function formatDateTime(value: Date | string): string {
  const d = typeof value === "string" ? new Date(value) : value;
  return new Intl.DateTimeFormat("en-CA", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(d);
}
