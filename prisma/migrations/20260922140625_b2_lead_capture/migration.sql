-- CreateEnum
CREATE TYPE "PublicPricingMode" AS ENUM ('EXACT_PRICE', 'STARTING_FROM', 'RANGE', 'QUOTE_ONLY', 'NO_PUBLIC_PRICE');

-- CreateEnum
CREATE TYPE "LeadStatus" AS ENUM ('QUOTE_STARTED', 'QUOTE_PARTIAL', 'PRICE_VIEWED', 'CONTACT_CAPTURED', 'BOOKING_INTENT');

-- CreateEnum
CREATE TYPE "LeadFunnelStep" AS ENUM ('PROJECT', 'MEASUREMENTS', 'PHOTO', 'STYLE', 'PRICE', 'CONTACT', 'TIMING', 'CONFIRMATION');

-- CreateEnum
CREATE TYPE "MeasurementUnit" AS ENUM ('METRIC', 'IMPERIAL');

-- CreateEnum
CREATE TYPE "MaterialOwnership" AS ENUM ('INSTALL_ONLY', 'MATERIAL_AND_INSTALL');

-- CreateEnum
CREATE TYPE "TimingValue" AS ENUM ('ASAP', 'WITHIN_2_WEEKS', 'WITHIN_MONTH', 'JUST_PLANNING');

-- CreateEnum
CREATE TYPE "PricingSourceType" AS ENUM ('MOCK_DEV');

-- CreateEnum
CREATE TYPE "ConsentCategory" AS ENUM ('ESSENTIAL', 'ANALYTICS', 'MARKETING');

-- CreateEnum
CREATE TYPE "ConsentChannel" AS ENUM ('SYSTEM', 'EMAIL', 'SMS', 'PHONE');

-- CreateTable
CREATE TABLE "Country" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Country_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Province" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "countryId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Province_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "City" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "provinceId" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "City_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServiceCategory" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ServiceCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Service" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "shortDescription" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "publicPricingMode" "PublicPricingMode" NOT NULL DEFAULT 'QUOTE_ONLY',
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Service_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServiceCity" (
    "id" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "cityId" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ServiceCity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Lead" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "status" "LeadStatus" NOT NULL DEFAULT 'QUOTE_STARTED',
    "serviceSlug" TEXT,
    "postalCode" TEXT,
    "citySlug" TEXT,
    "measurementUnit" "MeasurementUnit",
    "totalAreaM2" DECIMAL(6,2),
    "styleId" TEXT,
    "materialOwnership" "MaterialOwnership",
    "currentStep" "LeadFunnelStep" NOT NULL DEFAULT 'PROJECT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Lead_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeadAttribution" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "utmSource" TEXT,
    "utmMedium" TEXT,
    "utmCampaign" TEXT,
    "utmContent" TEXT,
    "utmTerm" TEXT,
    "landingRoute" TEXT NOT NULL,
    "referrer" TEXT,
    "firstTouchAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LeadAttribution_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContactInfo" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContactInfo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TimingSelection" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "value" "TimingValue" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TimingSelection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConsentEvidence" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "category" "ConsentCategory" NOT NULL,
    "purpose" TEXT NOT NULL,
    "channel" "ConsentChannel" NOT NULL,
    "wordingVersion" TEXT NOT NULL,
    "sourceRoute" TEXT NOT NULL,
    "sourceAction" TEXT NOT NULL,
    "jurisdiction" TEXT NOT NULL DEFAULT 'CA-ON',
    "grantedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "withdrawnAt" TIMESTAMP(3),

    CONSTRAINT "ConsentEvidence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuoteSnapshot" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "serviceSlug" TEXT NOT NULL,
    "serviceName" TEXT NOT NULL,
    "totalAreaM2" DECIMAL(6,2) NOT NULL,
    "materialOwnership" "MaterialOwnership" NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'CAD',
    "subtotalMinor" INTEGER NOT NULL,
    "taxMinor" INTEGER NOT NULL,
    "taxLabel" TEXT NOT NULL,
    "totalMinor" INTEGER NOT NULL,
    "pricingSource" "PricingSourceType" NOT NULL,
    "priceGeneratedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QuoteSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BookingIntent" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "quoteSnapshotId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'CREATED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BookingIntent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Country_code_key" ON "Country"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Province_countryId_code_key" ON "Province"("countryId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "City_slug_key" ON "City"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "ServiceCategory_slug_key" ON "ServiceCategory"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Service_slug_key" ON "Service"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "ServiceCity_serviceId_cityId_key" ON "ServiceCity"("serviceId", "cityId");

-- CreateIndex
CREATE UNIQUE INDEX "Lead_sessionId_key" ON "Lead"("sessionId");

-- CreateIndex
CREATE INDEX "Lead_status_idx" ON "Lead"("status");

-- CreateIndex
CREATE INDEX "Lead_createdAt_idx" ON "Lead"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "LeadAttribution_leadId_key" ON "LeadAttribution"("leadId");

-- CreateIndex
CREATE UNIQUE INDEX "ContactInfo_leadId_key" ON "ContactInfo"("leadId");

-- CreateIndex
CREATE UNIQUE INDEX "TimingSelection_leadId_key" ON "TimingSelection"("leadId");

-- CreateIndex
CREATE INDEX "ConsentEvidence_leadId_idx" ON "ConsentEvidence"("leadId");

-- CreateIndex
CREATE INDEX "QuoteSnapshot_leadId_idx" ON "QuoteSnapshot"("leadId");

-- CreateIndex
CREATE UNIQUE INDEX "BookingIntent_leadId_key" ON "BookingIntent"("leadId");

-- CreateIndex
CREATE UNIQUE INDEX "BookingIntent_quoteSnapshotId_key" ON "BookingIntent"("quoteSnapshotId");

-- AddForeignKey
ALTER TABLE "Province" ADD CONSTRAINT "Province_countryId_fkey" FOREIGN KEY ("countryId") REFERENCES "Country"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "City" ADD CONSTRAINT "City_provinceId_fkey" FOREIGN KEY ("provinceId") REFERENCES "Province"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Service" ADD CONSTRAINT "Service_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "ServiceCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceCity" ADD CONSTRAINT "ServiceCity_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceCity" ADD CONSTRAINT "ServiceCity_cityId_fkey" FOREIGN KEY ("cityId") REFERENCES "City"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeadAttribution" ADD CONSTRAINT "LeadAttribution_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContactInfo" ADD CONSTRAINT "ContactInfo_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimingSelection" ADD CONSTRAINT "TimingSelection_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsentEvidence" ADD CONSTRAINT "ConsentEvidence_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuoteSnapshot" ADD CONSTRAINT "QuoteSnapshot_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookingIntent" ADD CONSTRAINT "BookingIntent_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookingIntent" ADD CONSTRAINT "BookingIntent_quoteSnapshotId_fkey" FOREIGN KEY ("quoteSnapshotId") REFERENCES "QuoteSnapshot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
