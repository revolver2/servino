import { proApiError, proApiOk } from "@/lib/server/pro-api-response";
import {
  clearProSessionCookie,
  isSameOrigin,
  requireProfessionalSession,
  revokeCurrentProSession,
} from "@/lib/server/pro-auth";
import { recordAuditEvent } from "@/lib/server/audit";

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return proApiError("FORBIDDEN", "Invalid request origin.");

  const professional = await requireProfessionalSession();
  await revokeCurrentProSession();
  await clearProSessionCookie();

  if (professional) {
    await recordAuditEvent({
      action: "PROFESSIONAL_LOGOUT",
      entityType: "PROFESSIONAL",
      entityId: professional.id,
      actorProfessionalId: professional.id,
    });
  }

  return proApiOk({});
}
