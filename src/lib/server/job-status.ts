/**
 * Explicit allowed Job status transitions (spec section 37) — no
 * arbitrary free-form status mutation. Validated server-side on every
 * transition request; a crafted API request outside this map is rejected
 * regardless of what the client sends.
 *
 * Session F (D034) adds OFFERED/EN_ROUTE/ARRIVED and clarifies existing
 * semantics — see docs/DECISIONS.md D034 for the full table and
 * reasoning, and D035 for why READY_FOR_ASSIGNMENT -> ASSIGNED was
 * removed from this general table (the original direct-assign route
 * never consulted this table in the first place, so removing it here
 * doesn't affect that route's own, unchanged behavior).
 *
 * Session G (D043) adds CONFIRMED — reachable only from COMPLETED, set
 * by customer completion confirmation or an audited admin override.
 * Distinct from "professional reported completion" (COMPLETED itself)
 * and from payout eligibility (a separate, non-JobStatus fact computed
 * off a CONFIRMED job — see docs/WORKFLOWS.md "Session G").
 */
export type JobStatus =
  | "NEW"
  | "REVIEWING"
  | "READY_FOR_ASSIGNMENT"
  | "OFFERED"
  | "ASSIGNED"
  | "EN_ROUTE"
  | "ARRIVED"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "CONFIRMED"
  | "CANCELLED"
  | "DISPUTED"
  | "MANUAL_REVIEW";

const ALLOWED_TRANSITIONS: Record<JobStatus, JobStatus[]> = {
  NEW: ["REVIEWING", "MANUAL_REVIEW", "CANCELLED"],
  REVIEWING: ["READY_FOR_ASSIGNMENT", "MANUAL_REVIEW", "CANCELLED"],
  READY_FOR_ASSIGNMENT: ["OFFERED", "MANUAL_REVIEW", "CANCELLED"],
  OFFERED: ["ASSIGNED", "READY_FOR_ASSIGNMENT", "MANUAL_REVIEW", "CANCELLED"],
  ASSIGNED: ["EN_ROUTE", "READY_FOR_ASSIGNMENT", "MANUAL_REVIEW", "CANCELLED"],
  EN_ROUTE: ["ARRIVED", "MANUAL_REVIEW", "CANCELLED"],
  ARRIVED: ["IN_PROGRESS", "MANUAL_REVIEW", "CANCELLED"],
  IN_PROGRESS: ["COMPLETED", "DISPUTED", "MANUAL_REVIEW", "CANCELLED"],
  COMPLETED: ["CONFIRMED", "DISPUTED"],
  CONFIRMED: ["DISPUTED"],
  CANCELLED: [],
  DISPUTED: ["REVIEWING", "COMPLETED", "CANCELLED"],
  MANUAL_REVIEW: ["REVIEWING", "READY_FOR_ASSIGNMENT", "CANCELLED"],
};

export function isAllowedJobTransition(from: JobStatus, to: JobStatus): boolean {
  if (from === to) return false;
  return ALLOWED_TRANSITIONS[from]?.includes(to) ?? false;
}

export function allowedNextStatuses(from: JobStatus): JobStatus[] {
  return ALLOWED_TRANSITIONS[from] ?? [];
}

// Session F — statuses that require a dedicated endpoint (see the
// generic status route's own REQUIRES_DEDICATED_ENDPOINT guard). Used to
// keep the admin's generic manual status dropdown from ever offering an
// option that would just be rejected if clicked.
const DEDICATED_ENDPOINT_STATUSES = new Set<JobStatus>(["OFFERED", "ASSIGNED", "EN_ROUTE", "ARRIVED"]);

export function allowedNextStatusesForManualControl(from: JobStatus): JobStatus[] {
  return allowedNextStatuses(from).filter((s) => !DEDICATED_ENDPOINT_STATUSES.has(s));
}
