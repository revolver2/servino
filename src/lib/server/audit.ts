import type { Prisma } from "@prisma/client";
import { prisma } from "./prisma";

type AuditAction =
  | "ADMIN_LOGIN_SUCCESS"
  | "ADMIN_LOGIN_FAILED"
  | "ADMIN_LOGOUT"
  | "PROFESSIONAL_CREATED"
  | "PROFESSIONAL_UPDATED"
  | "JOB_CREATED"
  | "JOB_STATUS_CHANGED"
  | "JOB_ASSIGNED"
  | "JOB_REASSIGNED"
  | "PRICING_VERSION_CREATED"
  | "PRICING_VERSION_ACTIVATED"
  | "PRICING_VERSION_RETIRED"
  | "PROFESSIONAL_ACTIVATION_CREATED"
  | "PROFESSIONAL_ACTIVATED"
  | "PROFESSIONAL_LOGIN_SUCCESS"
  | "PROFESSIONAL_LOGIN_FAILED"
  | "PROFESSIONAL_LOGOUT"
  | "JOB_OFFERED"
  | "JOB_OFFER_WITHDRAWN"
  | "JOB_OFFER_ACCEPTED"
  | "JOB_OFFER_DECLINED"
  | "JOB_EN_ROUTE"
  | "JOB_ARRIVED"
  | "JOB_STARTED"
  | "JOB_COMPLETION_REPORTED"
  | "JOB_PROBLEM_REPORTED"
  | "PAYMENT_ORDER_CREATED"
  | "PAYMENT_CAPTURED"
  | "PAYMENT_FAILED"
  | "PAYMENT_RECONCILED"
  | "REFUND_INITIATED"
  | "REFUND_COMPLETED"
  | "COMPLETION_TOKEN_CREATED"
  | "CUSTOMER_COMPLETION_CONFIRMED"
  | "CUSTOMER_ISSUE_REPORTED"
  | "ADMIN_COMPLETION_CONFIRMED"
  | "PAYOUT_ELIGIBLE"
  | "PAYOUT_RECORDED"
  | "PAYOUT_HELD"
  | "JOB_ACTUALS_RECORDED";

/**
 * Every important admin/professional action writes one row here (spec
 * section 38, extended by Session F section 50). `metadata` must only
 * ever contain safe, structured fields — never passwords, secrets,
 * tokens, or full customer PII. `actorId` (AdminUser) and
 * `actorProfessionalId` (Professional) are two independent, nullable
 * slots — Session F events set exactly one of them, admin events set at
 * most `actorId`, system-initiated events set neither (D032).
 */
export function recordAuditEvent(
  args: {
    action: AuditAction;
    entityType: string;
    entityId: string;
    actorId?: string | null;
    actorProfessionalId?: string | null;
    metadata?: Prisma.InputJsonValue;
  },
  tx: Pick<typeof prisma, "auditEvent"> = prisma
) {
  return tx.auditEvent.create({
    data: {
      action: args.action,
      entityType: args.entityType,
      entityId: args.entityId,
      actorId: args.actorId ?? null,
      actorProfessionalId: args.actorProfessionalId ?? null,
      metadata: args.metadata,
    },
  });
}
