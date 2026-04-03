-- CreateEnum
CREATE TYPE "ProspectStatus" AS ENUM ('NEW', 'READY', 'IN_PROGRESS', 'ATTEMPTED', 'RESPONDED', 'QUALIFIED', 'DISQUALIFIED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "ProspectPriority" AS ENUM ('HIGH', 'MEDIUM', 'LOW');

-- CreateEnum
CREATE TYPE "ProspectSourceProvider" AS ENUM ('MANUAL', 'PUBLIC_INTAKE', 'GOOGLE_PLACES', 'APOLLO_PEOPLE_SEARCH');

-- CreateEnum
CREATE TYPE "ProspectAttemptChannel" AS ENUM ('CALL', 'EMAIL', 'SMS');

-- CreateEnum
CREATE TYPE "ProspectAttemptOutcome" AS ENUM ('NO_ANSWER', 'LEFT_VOICEMAIL', 'SENT_EMAIL', 'REPLIED', 'BAD_FIT', 'DO_NOT_CONTACT');

-- CreateTable
CREATE TABLE "Prospect" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "prospectSid" TEXT NOT NULL,
    "companyName" TEXT NOT NULL,
    "contactName" TEXT,
    "contactPhone" TEXT,
    "contactEmail" TEXT,
    "normalizedPhone" TEXT,
    "normalizedEmail" TEXT,
    "city" TEXT,
    "state" TEXT,
    "sourceLabel" TEXT,
    "sourceProvider" "ProspectSourceProvider" NOT NULL DEFAULT 'MANUAL',
    "sourceProviderRecordId" TEXT,
    "sourceFingerprint" TEXT,
    "sourceWebsiteUrl" TEXT,
    "sourceMapsUrl" TEXT,
    "sourceLinkedinUrl" TEXT,
    "sourceCategory" TEXT,
    "sourceRoleTitle" TEXT,
    "sourceMetadataJson" JSONB,
    "lastImportBatchId" TEXT,
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "serviceInterest" TEXT,
    "notes" TEXT,
    "status" "ProspectStatus" NOT NULL DEFAULT 'NEW',
    "priority" "ProspectPriority",
    "nextActionAt" TIMESTAMP(3),
    "lastAttemptAt" TIMESTAMP(3),
    "respondedAt" TIMESTAMP(3),
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Prospect_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProspectAttempt" (
    "id" TEXT NOT NULL,
    "prospectId" TEXT NOT NULL,
    "channel" "ProspectAttemptChannel" NOT NULL,
    "outcome" "ProspectAttemptOutcome" NOT NULL,
    "note" TEXT,
    "attemptedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProspectAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProspectImportBatch" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "sourceProvider" "ProspectSourceProvider" NOT NULL,
    "sourceLabel" TEXT,
    "createdCount" INTEGER NOT NULL DEFAULT 0,
    "updatedCount" INTEGER NOT NULL DEFAULT 0,
    "skippedCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProspectImportBatch_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Prospect_prospectSid_key" ON "Prospect"("prospectSid");

-- CreateIndex
CREATE INDEX "Prospect_tenantId_idx" ON "Prospect"("tenantId");

-- CreateIndex
CREATE INDEX "Prospect_businessId_idx" ON "Prospect"("businessId");

-- CreateIndex
CREATE INDEX "Prospect_sourceProvider_idx" ON "Prospect"("sourceProvider");

-- CreateIndex
CREATE INDEX "Prospect_lastImportBatchId_idx" ON "Prospect"("lastImportBatchId");

-- CreateIndex
CREATE INDEX "Prospect_status_idx" ON "Prospect"("status");

-- CreateIndex
CREATE INDEX "Prospect_priority_idx" ON "Prospect"("priority");

-- CreateIndex
CREATE INDEX "Prospect_nextActionAt_idx" ON "Prospect"("nextActionAt");

-- CreateIndex
CREATE INDEX "Prospect_lastAttemptAt_idx" ON "Prospect"("lastAttemptAt");

-- CreateIndex
CREATE UNIQUE INDEX "Prospect_tenantId_businessId_normalizedEmail_key" ON "Prospect"("tenantId", "businessId", "normalizedEmail");

-- CreateIndex
CREATE UNIQUE INDEX "Prospect_tenantId_businessId_normalizedPhone_key" ON "Prospect"("tenantId", "businessId", "normalizedPhone");

-- CreateIndex
CREATE UNIQUE INDEX "Prospect_tenantId_businessId_sourceProvider_sourceProviderR_key" ON "Prospect"("tenantId", "businessId", "sourceProvider", "sourceProviderRecordId");

-- CreateIndex
CREATE UNIQUE INDEX "Prospect_tenantId_businessId_sourceProvider_sourceFingerpri_key" ON "Prospect"("tenantId", "businessId", "sourceProvider", "sourceFingerprint");

-- CreateIndex
CREATE INDEX "ProspectAttempt_prospectId_idx" ON "ProspectAttempt"("prospectId");

-- CreateIndex
CREATE INDEX "ProspectAttempt_channel_idx" ON "ProspectAttempt"("channel");

-- CreateIndex
CREATE INDEX "ProspectAttempt_outcome_idx" ON "ProspectAttempt"("outcome");

-- CreateIndex
CREATE INDEX "ProspectAttempt_attemptedAt_idx" ON "ProspectAttempt"("attemptedAt");

-- CreateIndex
CREATE INDEX "ProspectImportBatch_tenantId_idx" ON "ProspectImportBatch"("tenantId");

-- CreateIndex
CREATE INDEX "ProspectImportBatch_businessId_idx" ON "ProspectImportBatch"("businessId");

-- CreateIndex
CREATE INDEX "ProspectImportBatch_sourceProvider_idx" ON "ProspectImportBatch"("sourceProvider");

-- CreateIndex
CREATE INDEX "ProspectImportBatch_createdAt_idx" ON "ProspectImportBatch"("createdAt");

-- AddForeignKey
ALTER TABLE "Prospect" ADD CONSTRAINT "Prospect_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Prospect" ADD CONSTRAINT "Prospect_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Prospect" ADD CONSTRAINT "Prospect_lastImportBatchId_fkey" FOREIGN KEY ("lastImportBatchId") REFERENCES "ProspectImportBatch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProspectAttempt" ADD CONSTRAINT "ProspectAttempt_prospectId_fkey" FOREIGN KEY ("prospectId") REFERENCES "Prospect"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProspectImportBatch" ADD CONSTRAINT "ProspectImportBatch_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProspectImportBatch" ADD CONSTRAINT "ProspectImportBatch_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;
