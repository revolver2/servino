-- AlterEnum
ALTER TYPE "AuditAction" ADD VALUE 'JOB_ACTUALS_RECORDED';

-- CreateTable
CREATE TABLE "JobActuals" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "actualMaterialCostMinor" INTEGER,
    "actualCacMinor" INTEGER,
    "actualOtherVariableCostMinor" INTEGER,
    "note" TEXT,
    "recordedByAdminId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "JobActuals_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "JobActuals_jobId_key" ON "JobActuals"("jobId");

-- CreateIndex
CREATE INDEX "JobActuals_jobId_idx" ON "JobActuals"("jobId");

-- AddForeignKey
ALTER TABLE "JobActuals" ADD CONSTRAINT "JobActuals_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobActuals" ADD CONSTRAINT "JobActuals_recordedByAdminId_fkey" FOREIGN KEY ("recordedByAdminId") REFERENCES "AdminUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Database-level financial invariant (same pattern as D041/session_g's
-- nonnegative-amount CHECK constraints) — hand-added, not expressible in
-- the Prisma schema DSL. NULL (unknown) is explicitly allowed and
-- distinct from 0 (spec section 46); only a negative entered value is
-- rejected.
ALTER TABLE "JobActuals" ADD CONSTRAINT "JobActuals_materialCost_nonnegative" CHECK ("actualMaterialCostMinor" IS NULL OR "actualMaterialCostMinor" >= 0);
ALTER TABLE "JobActuals" ADD CONSTRAINT "JobActuals_cac_nonnegative" CHECK ("actualCacMinor" IS NULL OR "actualCacMinor" >= 0);
ALTER TABLE "JobActuals" ADD CONSTRAINT "JobActuals_otherCost_nonnegative" CHECK ("actualOtherVariableCostMinor" IS NULL OR "actualOtherVariableCostMinor" >= 0);
