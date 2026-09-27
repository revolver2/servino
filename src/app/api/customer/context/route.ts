import { createHash } from "node:crypto";
import { prisma } from "@/lib/server/prisma";
import { apiError, apiOk } from "@/lib/server/api-response";
import { checkRateLimit, clientIp } from "@/lib/server/rate-limit";
import { confirmationTokenSchema } from "@/lib/server/customer-schemas";

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/**
 * `/confirm` calls this to render the job summary before the customer
 * decides. The raw token is never logged; only its hash is looked up
 * (same pattern as `/api/pro/auth/activate`). An expired/unknown token
 * gets the same generic "invalid" response as a used one — no
 * information about WHY a token doesn't work is leaked.
 */
export async function GET(request: Request) {
  const ip = clientIp(request);
  const rl = checkRateLimit("customer-confirmation-context", ip, { windowMs: 60_000, max: 30 });
  if (!rl.allowed) return apiError("RATE_LIMITED", "Too many requests. Please slow down.");

  const url = new URL(request.url);
  const parsed = confirmationTokenSchema.safeParse({ token: url.searchParams.get("token") ?? "" });
  if (!parsed.success) return apiError("VALIDATION_ERROR", "Invalid link.");

  const record = await prisma.completionConfirmationToken.findUnique({
    where: { tokenHash: hashToken(parsed.data.token) },
    include: {
      job: {
        include: {
          lead: true,
          customerIssueReports: { orderBy: { reportedAt: "desc" }, take: 1 },
        },
      },
    },
  });

  if (!record || record.expiresAt < new Date()) {
    return apiError("TOKEN_INVALID", "This link is invalid or has expired.");
  }

  const alreadyResponded = record.usedAt !== null;

  return apiOk({
    serviceName: record.job.lead.serviceSlug ?? "your project",
    jobStatus: record.job.status,
    alreadyResponded,
    lastIssue: record.job.customerIssueReports[0]
      ? { reasonCode: record.job.customerIssueReports[0].reasonCode }
      : null,
  });
}
