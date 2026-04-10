-- AlterTable
ALTER TABLE "Tenant"
ADD COLUMN "businessName" TEXT,
ADD COLUMN "greeting" TEXT,
ADD COLUMN "twilioPhoneNumber" TEXT;

-- AlterTable
ALTER TABLE "Call"
ADD COLUMN "callSid" TEXT,
ADD COLUMN "callStatus" TEXT NOT NULL DEFAULT 'pending',
ADD COLUMN "twimlFlowStep" TEXT,
ADD COLUMN "callerName" TEXT,
ADD COLUMN "callerPhone" TEXT,
ADD COLUMN "callReason" TEXT,
ADD COLUMN "voicemailUrl" TEXT,
ADD COLUMN "voicemailDuration" INTEGER,
ADD COLUMN "completedAt" TIMESTAMP(3);

-- CreateIndex
CREATE UNIQUE INDEX "Tenant_twilioPhoneNumber_key" ON "Tenant"("twilioPhoneNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Call_callSid_key" ON "Call"("callSid");
