import { proApiError, proApiOk } from "@/lib/server/pro-api-response";
import { isSameOrigin, requireProfessionalSession } from "@/lib/server/pro-auth";
import { checkRateLimit, clientIp } from "@/lib/server/rate-limit";
import { performProfessionalFieldTransition } from "@/lib/server/pro-field-transition";

/**
 * COMPLETED here means professional-REPORTED completion only — not paid,
 * not payout-sent, not customer-confirmed (spec section 33/34, D034). No
 * payment phase exists yet; this is truthfully just "the professional says
 * the work is done."
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!isSameOrigin(request)) return proApiError("FORBIDDEN", "Invalid request origin.");

  const professional = await requireProfessionalSession();
  if (!professional) return proApiError("UNAUTHORIZED", "Sign in required.");

  const rl = checkRateLimit("professional-mutation", clientIp(request), { windowMs: 60_000, max: 60 });
  if (!rl.allowed) return proApiError("RATE_LIMITED", "Too many requests. Please slow down.");

  const { id } = await params;
  const result = await performProfessionalFieldTransition({
    jobId: id,
    professionalId: professional.id,
    to: "COMPLETED",
    auditAction: "JOB_COMPLETION_REPORTED",
  });

  if (!result.ok) {
    return result.code === "NOT_FOUND"
      ? proApiError("NOT_FOUND", "Job not found.")
      : proApiError("CONFLICT", "This job isn't ready for that action right now.");
  }
  return proApiOk({ id, status: "COMPLETED" });
}
