-- AlterTable
ALTER TABLE "AgentProfile"
ADD COLUMN "missedCallTextBackMessage" TEXT;

-- AlterTable
ALTER TABLE "Call"
ADD COLUMN "textBackSent" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "textBackSentAt" TIMESTAMP(3);
