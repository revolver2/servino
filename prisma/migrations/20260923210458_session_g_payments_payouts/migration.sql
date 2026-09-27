-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'CREATED', 'APPROVED', 'CAPTURED', 'FAILED', 'CANCELLED', 'REFUNDED', 'PARTIALLY_REFUNDED', 'DISPUTED');

-- CreateEnum
CREATE TYPE "PaymentEventSource" AS ENUM ('API', 'WEBHOOK');

-- CreateEnum
CREATE TYPE "RefundStatus" AS ENUM ('PENDING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "PayoutStatus" AS ENUM ('ELIGIBLE', 'PAID', 'HELD', 'CANCELLED');

-- CreateEnum
CREATE TYPE "CustomerIssueReasonCode" AS ENUM ('INCOMPLETE', 'QUALITY', 'DAMAGE', 'SCOPE', 'OTHER');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AuditAction" ADD VALUE 'PAYMENT_ORDER_CREATED';
ALTER TYPE "AuditAction" ADD VALUE 'PAYMENT_CAPTURED';
ALTER TYPE "AuditAction" ADD VALUE 'PAYMENT_FAILED';
ALTER TYPE "AuditAction" ADD VALUE 'PAYMENT_RECONCILED';
ALTER TYPE "AuditAction" ADD VALUE 'REFUND_INITIATED';
ALTER TYPE "AuditAction" ADD VALUE 'REFUND_COMPLETED';
ALTER TYPE "AuditAction" ADD VALUE 'COMPLETION_TOKEN_CREATED';
ALTER TYPE "AuditAction" ADD VALUE 'CUSTOMER_COMPLETION_CONFIRMED';
ALTER TYPE "AuditAction" ADD VALUE 'CUSTOMER_ISSUE_REPORTED';
ALTER TYPE "AuditAction" ADD VALUE 'ADMIN_COMPLETION_CONFIRMED';
ALTER TYPE "AuditAction" ADD VALUE 'PAYOUT_ELIGIBLE';
ALTER TYPE "AuditAction" ADD VALUE 'PAYOUT_RECORDED';
ALTER TYPE "AuditAction" ADD VALUE 'PAYOUT_HELD';

-- AlterEnum
ALTER TYPE "JobStatus" ADD VALUE 'CONFIRMED';

-- AlterEnum
ALTER TYPE "LeadFunnelStep" ADD VALUE 'PAYMENT';

-- CreateTable
CREATE TABLE "Payment" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "quoteSnapshotId" TEXT NOT NULL,
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "currency" TEXT NOT NULL DEFAULT 'CAD',
    "amountMinor" INTEGER NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'PAYPAL',
    "paypalOrderId" TEXT,
    "paypalCaptureId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentEvent" (
    "id" TEXT NOT NULL,
    "paymentId" TEXT NOT NULL,
    "source" "PaymentEventSource" NOT NULL,
    "eventType" TEXT NOT NULL,
    "providerEventId" TEXT,
    "resultingStatus" "PaymentStatus" NOT NULL,
    "summary" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaymentEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Refund" (
    "id" TEXT NOT NULL,
    "paymentId" TEXT NOT NULL,
    "amountMinor" INTEGER NOT NULL,
    "status" "RefundStatus" NOT NULL DEFAULT 'PENDING',
    "reason" TEXT,
    "paypalRefundId" TEXT,
    "requestedByAdminId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "Refund_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payout" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "professionalId" TEXT NOT NULL,
    "jobOfferId" TEXT NOT NULL,
    "amountMinor" INTEGER NOT NULL,
    "status" "PayoutStatus" NOT NULL DEFAULT 'ELIGIBLE',
    "eligibleAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "methodCategory" TEXT,
    "externalReference" TEXT,
    "paidAt" TIMESTAMP(3),
    "note" TEXT,
    "amountOverrideReason" TEXT,
    "heldReason" TEXT,
    "recordedByAdminId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Payout_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomerIssueReport" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "reasonCode" "CustomerIssueReasonCode" NOT NULL,
    "note" TEXT,
    "reportedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolved" BOOLEAN NOT NULL DEFAULT false,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "CustomerIssueReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompletionConfirmationToken" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdByAdminId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CompletionConfirmationToken_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Payment_jobId_key" ON "Payment"("jobId");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_paypalOrderId_key" ON "Payment"("paypalOrderId");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_paypalCaptureId_key" ON "Payment"("paypalCaptureId");

-- CreateIndex
CREATE INDEX "Payment_status_idx" ON "Payment"("status");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentEvent_providerEventId_key" ON "PaymentEvent"("providerEventId");

-- CreateIndex
CREATE INDEX "PaymentEvent_paymentId_idx" ON "PaymentEvent"("paymentId");

-- CreateIndex
CREATE UNIQUE INDEX "Refund_paypalRefundId_key" ON "Refund"("paypalRefundId");

-- CreateIndex
CREATE INDEX "Refund_paymentId_idx" ON "Refund"("paymentId");

-- CreateIndex
CREATE UNIQUE INDEX "Payout_jobId_key" ON "Payout"("jobId");

-- CreateIndex
CREATE UNIQUE INDEX "Payout_jobOfferId_key" ON "Payout"("jobOfferId");

-- CreateIndex
CREATE INDEX "Payout_status_idx" ON "Payout"("status");

-- CreateIndex
CREATE INDEX "Payout_professionalId_idx" ON "Payout"("professionalId");

-- CreateIndex
CREATE INDEX "CustomerIssueReport_jobId_idx" ON "CustomerIssueReport"("jobId");

-- CreateIndex
CREATE UNIQUE INDEX "CompletionConfirmationToken_tokenHash_key" ON "CompletionConfirmationToken"("tokenHash");

-- CreateIndex
CREATE INDEX "CompletionConfirmationToken_jobId_idx" ON "CompletionConfirmationToken"("jobId");

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_quoteSnapshotId_fkey" FOREIGN KEY ("quoteSnapshotId") REFERENCES "QuoteSnapshot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentEvent" ADD CONSTRAINT "PaymentEvent_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Refund" ADD CONSTRAINT "Refund_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Refund" ADD CONSTRAINT "Refund_requestedByAdminId_fkey" FOREIGN KEY ("requestedByAdminId") REFERENCES "AdminUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payout" ADD CONSTRAINT "Payout_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payout" ADD CONSTRAINT "Payout_professionalId_fkey" FOREIGN KEY ("professionalId") REFERENCES "Professional"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payout" ADD CONSTRAINT "Payout_jobOfferId_fkey" FOREIGN KEY ("jobOfferId") REFERENCES "JobOffer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payout" ADD CONSTRAINT "Payout_recordedByAdminId_fkey" FOREIGN KEY ("recordedByAdminId") REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerIssueReport" ADD CONSTRAINT "CustomerIssueReport_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompletionConfirmationToken" ADD CONSTRAINT "CompletionConfirmationToken_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompletionConfirmationToken" ADD CONSTRAINT "CompletionConfirmationToken_createdByAdminId_fkey" FOREIGN KEY ("createdByAdminId") REFERENCES "AdminUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Database-level financial invariants (docs/DECISIONS.md D041) — not
-- expressible in the Prisma schema DSL, so added here by hand, same
-- pattern as D027/D035's hand-added raw SQL. Amounts are integer minor
-- units and must never be negative regardless of what application code
-- does; currency is CAD-only for the whole of Session G (no multi-
-- currency support exists anywhere else in the funnel).
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_amountMinor_nonnegative" CHECK ("amountMinor" >= 0);
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_currency_cad_only" CHECK ("currency" = 'CAD');
ALTER TABLE "Refund" ADD CONSTRAINT "Refund_amountMinor_nonnegative" CHECK ("amountMinor" >= 0);
ALTER TABLE "Payout" ADD CONSTRAINT "Payout_amountMinor_nonnegative" CHECK ("amountMinor" >= 0);
