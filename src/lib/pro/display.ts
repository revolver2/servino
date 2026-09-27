import { services } from "@/lib/services-data";

export function serviceNameForSlug(slug: string | null): string {
  if (!slug) return "Project";
  return services.find((s) => s.slug === slug)?.name ?? slug;
}

const PRO_STATUS_LABEL: Record<string, string> = {
  OFFERED: "Offered — awaiting your response",
  ASSIGNED: "Accepted — not yet en route",
  EN_ROUTE: "En route",
  ARRIVED: "Arrived",
  IN_PROGRESS: "In progress",
  COMPLETED: "Completed — awaiting confirmation",
  CONFIRMED: "Completed — confirmed",
  DISPUTED: "Disputed",
};

export function proJobStatusLabel(status: string): string {
  return PRO_STATUS_LABEL[status] ?? status;
}

const REASON_LABEL: Record<string, string> = {
  UNAVAILABLE: "I'm unavailable",
  TIMING: "Timing doesn't work",
  OUTSIDE_AREA: "Outside my area",
  NOT_SUITABLE: "Project isn't suitable for me",
  OTHER: "Other",
  CUSTOMER_UNAVAILABLE: "Customer unavailable",
  ACCESS_PROBLEM: "Access problem",
  MATERIAL_PROBLEM: "Material problem",
  SCOPE_DIFFERS: "Scope differs from what was described",
  SAFETY_CONCERN: "Safety concern",
  CANNOT_COMPLETE: "Cannot complete the job",
};

export function reasonLabel(code: string): string {
  return REASON_LABEL[code] ?? code;
}
