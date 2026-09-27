-- CreateEnum
CREATE TYPE "PricingVersionStatus" AS ENUM ('DRAFT', 'ACTIVE', 'RETIRED');

-- CreateEnum
CREATE TYPE "QuoteHealth" AS ENUM ('HEALTHY', 'ACCEPTABLE', 'LOW_MARGIN', 'UNPROFITABLE');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AuditAction" ADD VALUE 'PRICING_VERSION_CREATED';
ALTER TYPE "AuditAction" ADD VALUE 'PRICING_VERSION_ACTIVATED';
ALTER TYPE "AuditAction" ADD VALUE 'PRICING_VERSION_RETIRED';

-- AlterEnum
ALTER TYPE "PricingSourceType" ADD VALUE 'AUTHORITATIVE_VERSIONED';

-- AlterTable
ALTER TABLE "QuoteSnapshot" ADD COLUMN     "pricingVersionId" TEXT;

-- CreateTable
CREATE TABLE "PricingVersion" (
    "id" TEXT NOT NULL,
    "citySlug" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "status" "PricingVersionStatus" NOT NULL DEFAULT 'DRAFT',
    "currency" TEXT NOT NULL DEFAULT 'CAD',
    "taxRatePercent" DECIMAL(5,2) NOT NULL,
    "taxLabel" TEXT NOT NULL,
    "professionalPayoutPercentOfLabor" DECIMAL(5,2) NOT NULL,
    "materialCostPercentOfCustomerRate" DECIMAL(5,2) NOT NULL,
    "paymentProcessingPercent" DECIMAL(5,2) NOT NULL,
    "paymentProcessingFixedMinor" INTEGER NOT NULL,
    "estimatedCacMinor" INTEGER NOT NULL,
    "otherVariableCostMinor" INTEGER NOT NULL,
    "healthyMarginPercent" DECIMAL(5,2) NOT NULL,
    "acceptableMarginPercent" DECIMAL(5,2) NOT NULL,
    "lowMarginPercent" DECIMAL(5,2) NOT NULL,
    "createdByAdminId" TEXT,
    "effectiveAt" TIMESTAMP(3),
    "activatedAt" TIMESTAMP(3),
    "retiredAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PricingVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServicePricingRule" (
    "id" TEXT NOT NULL,
    "pricingVersionId" TEXT NOT NULL,
    "serviceSlug" TEXT NOT NULL,
    "installOnlyRateMinorPerM2" INTEGER NOT NULL,
    "materialRateMinorPerM2" INTEGER NOT NULL,
    "minimumSubtotalMinor" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ServicePricingRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EconomicsSnapshot" (
    "id" TEXT NOT NULL,
    "quoteSnapshotId" TEXT NOT NULL,
    "pricingVersionId" TEXT NOT NULL,
    "professionalPayoutEstimateMinor" INTEGER NOT NULL,
    "materialCostEstimateMinor" INTEGER NOT NULL,
    "processingEstimateMinor" INTEGER NOT NULL,
    "cacAssumptionMinor" INTEGER NOT NULL,
    "discountMinor" INTEGER NOT NULL DEFAULT 0,
    "referralCostMinor" INTEGER NOT NULL DEFAULT 0,
    "otherVariableCostMinor" INTEGER NOT NULL,
    "contributionProfitMinor" INTEGER NOT NULL,
    "contributionMarginPercent" DECIMAL(6,2) NOT NULL,
    "quoteHealth" "QuoteHealth" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EconomicsSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PricingVersion_citySlug_status_idx" ON "PricingVersion"("citySlug", "status");

-- CreateIndex
-- Database-level guarantee (spec section 12) that at most one PricingVersion
-- can be ACTIVE per city at a time — not just application-logic discipline.
-- A partial unique index isn't expressible in the Prisma schema DSL, so it's
-- added here by hand; see docs/DECISIONS.md D027.
CREATE UNIQUE INDEX "PricingVersion_one_active_per_city" ON "PricingVersion"("citySlug") WHERE "status" = 'ACTIVE';

-- CreateIndex
CREATE UNIQUE INDEX "ServicePricingRule_pricingVersionId_serviceSlug_key" ON "ServicePricingRule"("pricingVersionId", "serviceSlug");

-- CreateIndex
CREATE UNIQUE INDEX "EconomicsSnapshot_quoteSnapshotId_key" ON "EconomicsSnapshot"("quoteSnapshotId");

-- CreateIndex
CREATE INDEX "EconomicsSnapshot_pricingVersionId_idx" ON "EconomicsSnapshot"("pricingVersionId");

-- CreateIndex
CREATE INDEX "QuoteSnapshot_pricingVersionId_idx" ON "QuoteSnapshot"("pricingVersionId");

-- AddForeignKey
ALTER TABLE "QuoteSnapshot" ADD CONSTRAINT "QuoteSnapshot_pricingVersionId_fkey" FOREIGN KEY ("pricingVersionId") REFERENCES "PricingVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PricingVersion" ADD CONSTRAINT "PricingVersion_createdByAdminId_fkey" FOREIGN KEY ("createdByAdminId") REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServicePricingRule" ADD CONSTRAINT "ServicePricingRule_pricingVersionId_fkey" FOREIGN KEY ("pricingVersionId") REFERENCES "PricingVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EconomicsSnapshot" ADD CONSTRAINT "EconomicsSnapshot_quoteSnapshotId_fkey" FOREIGN KEY ("quoteSnapshotId") REFERENCES "QuoteSnapshot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EconomicsSnapshot" ADD CONSTRAINT "EconomicsSnapshot_pricingVersionId_fkey" FOREIGN KEY ("pricingVersionId") REFERENCES "PricingVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
