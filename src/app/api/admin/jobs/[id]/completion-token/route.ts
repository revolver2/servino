import { createHash, randomBytes } from "node:crypto";
import { prisma } from "@/lib/server/prisma";
import { adminApiError, adminApiOk } from "@/lib/server/admin-api-response";
import { isSameOrigin, requireAdminSession } from "@/lib/server/admin-auth";
import { checkRateLimit, clientIp } from "@/lib/server/rate-limit";
import { recordAuditEvent } from "@/lib/server/audit";

const CONFIRMATION_TTL_MS = 14 * 24 * 60 * 60 * 1000; // 14 days — customer may take a while to respond

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/**
 * Generates a one-time completion-confirmation link for a customer —
 * same shape and delivery model as
 * `/api/admin/professionals/[id]/activation` (D033): the raw token is
 * returned exactly once, never logged, never written to audit
 * metadata; Admin copies it and delivers it manually (spec section 35 —
 * no email/SMS infrastructure is being built for this).
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!isSameOrigin(request)) return adminApiError("FORBIDDEN", "Invalid request origin.");

  const admin = await requireAdminSession();
  if (!admin) return adminApiError("UNAUTHORIZED", "Sign in required.");

  const rl = checkRateLimit("admin-mutation", clientIp(request), { windowMs: 60_000, max: 60 });
  if (!rl.allowed) return adminApiError("RATE_LIMITED", "Too many requests. Please slow down.");

  const { id } = await params;
  const job = await prisma.job.findUnique({ where: { id } });
  if (!job) return adminApiError("NOT_FOUND", "Job not found.");
  if (job.status !== "COMPLETED") {
    return adminApiError("VALIDATION_ERROR", "This job isn't awaiting completion confirmation.");
  }

  const rawToken = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + CONFIRMATION_TTL_MS);

  await prisma.$transaction(async (tx) => {
    await tx.completionConfirmationToken.create({
      data: { tokenHash: hashToken(rawToken), jobId: id, expiresAt, createdByAdminId: admin.id },
    });
    await recordAuditEvent(
      {
        action: "COMPLETION_TOKEN_CREATED",
        entityType: "JOB",
        entityId: id,
        actorId: admin.id,
        metadata: { expiresAt: expiresAt.toISOString() },
      },
      tx
    );
  });

  return adminApiOk({ confirmPath: `/confirm?token=${rawToken}`, expiresAt: expiresAt.toISOString() });
}
