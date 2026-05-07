CREATE TABLE "AcquisitionLead" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "businessName" TEXT NOT NULL,
    "vertical" TEXT,
    "services" TEXT,
    "location" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "website" TEXT,
    "yearsInBusiness" TEXT,
    "painPointFound" TEXT,
    "outreachStatus" TEXT NOT NULL DEFAULT 'Not contacted',
    "stage" TEXT NOT NULL DEFAULT 'Researching',
    "demoStatus" TEXT NOT NULL DEFAULT 'Not booked',
    "offerStage" TEXT NOT NULL DEFAULT 'Not proposed',
    "lastContactedAt" TIMESTAMP(3),
    "nextFollowUpAt" TIMESTAMP(3),
    "notes" TEXT,
    "source" TEXT NOT NULL DEFAULT 'Imported lead file',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AcquisitionLead_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AcquisitionLead_tenantId_idx" ON "AcquisitionLead"("tenantId");
CREATE INDEX "AcquisitionLead_stage_idx" ON "AcquisitionLead"("stage");
CREATE INDEX "AcquisitionLead_nextFollowUpAt_idx" ON "AcquisitionLead"("nextFollowUpAt");
CREATE INDEX "AcquisitionLead_website_idx" ON "AcquisitionLead"("website");

ALTER TABLE "AcquisitionLead" ADD CONSTRAINT "AcquisitionLead_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
