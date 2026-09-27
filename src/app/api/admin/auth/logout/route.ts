import { adminApiError, adminApiOk } from "@/lib/server/admin-api-response";
import { clearSessionCookie, isSameOrigin, requireAdminSession, revokeCurrentSession } from "@/lib/server/admin-auth";
import { recordAuditEvent } from "@/lib/server/audit";

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return adminApiError("FORBIDDEN", "Invalid request origin.");

  const admin = await requireAdminSession();
  await revokeCurrentSession();
  await clearSessionCookie();

  if (admin) {
    await recordAuditEvent({
      action: "ADMIN_LOGOUT",
      entityType: "ADMIN_USER",
      entityId: admin.id,
      actorId: admin.id,
    });
  }

  return adminApiOk({});
}
