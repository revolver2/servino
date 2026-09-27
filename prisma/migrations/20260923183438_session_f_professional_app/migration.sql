-- CreateEnum
CREATE TYPE "JobOfferStatus" AS ENUM ('OFFERED', 'ACCEPTED', 'DECLINED', 'WITHDRAWN');

-- CreateEnum
CREATE TYPE "DeclineReasonCode" AS ENUM ('UNAVAILABLE', 'TIMING', 'OUTSIDE_AREA', 'NOT_SUITABLE', 'OTHER');

-- CreateEnum
CREATE TYPE "ProblemReasonCode" AS ENUM ('CUSTOMER_UNAVAILABLE', 'ACCESS_PROBLEM', 'MATERIAL_PROBLEM', 'SCOPE_DIFFERS', 'SAFETY_CONCERN', 'CANNOT_COMPLETE', 'OTHER');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AuditAction" ADD VALUE 'PROFESSIONAL_ACTIVATION_CREATED';
ALTER TYPE "AuditAction" ADD VALUE 'PROFESSIONAL_ACTIVATED';
ALTER TYPE "AuditAction" ADD VALUE 'PROFESSIONAL_LOGIN_SUCCESS';
ALTER TYPE "AuditAction" ADD VALUE 'PROFESSIONAL_LOGIN_FAILED';
ALTER TYPE "AuditAction" ADD VALUE 'PROFESSIONAL_LOGOUT';
ALTER TYPE "AuditAction" ADD VALUE 'JOB_OFFERED';
ALTER TYPE "AuditAction" ADD VALUE 'JOB_OFFER_WITHDRAWN';
ALTER TYPE "AuditAction" ADD VALUE 'JOB_OFFER_ACCEPTED';
ALTER TYPE "AuditAction" ADD VALUE 'JOB_OFFER_DECLINED';
ALTER TYPE "AuditAction" ADD VALUE 'JOB_EN_ROUTE';
ALTER TYPE "AuditAction" ADD VALUE 'JOB_ARRIVED';
ALTER TYPE "AuditAction" ADD VALUE 'JOB_STARTED';
ALTER TYPE "AuditAction" ADD VALUE 'JOB_COMPLETION_REPORTED';
ALTER TYPE "AuditAction" ADD VALUE 'JOB_PROBLEM_REPORTED';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "JobStatus" ADD VALUE 'OFFERED';
ALTER TYPE "JobStatus" ADD VALUE 'EN_ROUTE';
ALTER TYPE "JobStatus" ADD VALUE 'ARRIVED';

-- AlterTable
ALTER TABLE "AuditEvent" ADD COLUMN     "actorProfessionalId" TEXT;

-- AlterTable
ALTER TABLE "Professional" ADD COLUMN     "passwordHash" TEXT;

-- CreateTable
CREATE TABLE "ProfessionalSession" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "professionalId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ipAddress" TEXT,
    "userAgent" TEXT,

    CONSTRAINT "ProfessionalSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProfessionalActivationToken" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "professionalId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdByAdminId" TEXT,

    CONSTRAINT "ProfessionalActivationToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JobOffer" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "professionalId" TEXT NOT NULL,
    "offerAmountMinor" INTEGER NOT NULL,
    "status" "JobOfferStatus" NOT NULL DEFAULT 'OFFERED',
    "declineReason" "DeclineReasonCode",
    "declineNote" TEXT,
    "offeredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "respondedAt" TIMESTAMP(3),
    "offeredByAdminId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "JobOffer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProblemReport" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "professionalId" TEXT NOT NULL,
    "reasonCode" "ProblemReasonCode" NOT NULL,
    "note" TEXT,
    "reportedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolved" BOOLEAN NOT NULL DEFAULT false,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "ProblemReport_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ProfessionalSession_tokenHash_key" ON "ProfessionalSession"("tokenHash");

-- CreateIndex
CREATE INDEX "ProfessionalSession_professionalId_idx" ON "ProfessionalSession"("professionalId");

-- CreateIndex
CREATE INDEX "ProfessionalSession_expiresAt_idx" ON "ProfessionalSession"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "ProfessionalActivationToken_tokenHash_key" ON "ProfessionalActivationToken"("tokenHash");

-- CreateIndex
CREATE INDEX "ProfessionalActivationToken_professionalId_idx" ON "ProfessionalActivationToken"("professionalId");

-- CreateIndex
CREATE INDEX "JobOffer_jobId_idx" ON "JobOffer"("jobId");

-- CreateIndex
CREATE INDEX "JobOffer_professionalId_idx" ON "JobOffer"("professionalId");

-- CreateIndex
CREATE INDEX "ProblemReport_jobId_idx" ON "ProblemReport"("jobId");

-- AddForeignKey
ALTER TABLE "AuditEvent" ADD CONSTRAINT "AuditEvent_actorProfessionalId_fkey" FOREIGN KEY ("actorProfessionalId") REFERENCES "Professional"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProfessionalSession" ADD CONSTRAINT "ProfessionalSession_professionalId_fkey" FOREIGN KEY ("professionalId") REFERENCES "Professional"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProfessionalActivationToken" ADD CONSTRAINT "ProfessionalActivationToken_professionalId_fkey" FOREIGN KEY ("professionalId") REFERENCES "Professional"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProfessionalActivationToken" ADD CONSTRAINT "ProfessionalActivationToken_createdByAdminId_fkey" FOREIGN KEY ("createdByAdminId") REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobOffer" ADD CONSTRAINT "JobOffer_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobOffer" ADD CONSTRAINT "JobOffer_professionalId_fkey" FOREIGN KEY ("professionalId") REFERENCES "Professional"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobOffer" ADD CONSTRAINT "JobOffer_offeredByAdminId_fkey" FOREIGN KEY ("offeredByAdminId") REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProblemReport" ADD CONSTRAINT "ProblemReport_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProblemReport" ADD CONSTRAINT "ProblemReport_professionalId_fkey" FOREIGN KEY ("professionalId") REFERENCES "Professional"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Database-level guarantee (docs/DECISIONS.md D035, same pattern as D027's
-- PricingVersion_one_active_per_city) that at most one JobOffer can be in
-- status OFFERED for a given job at a time — this is what actually makes
-- the "professional accepts while admin withdraws/reassigns" race safe,
-- not just the application-level conditional update.
CREATE UNIQUE INDEX "JobOffer_one_open_per_job" ON "JobOffer"("jobId") WHERE "status" = 'OFFERED';
