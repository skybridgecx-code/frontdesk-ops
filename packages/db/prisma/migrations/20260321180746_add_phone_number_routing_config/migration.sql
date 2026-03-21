-- CreateEnum
CREATE TYPE "PhoneRoutingMode" AS ENUM ('AI_ALWAYS', 'AI_AFTER_HOURS', 'HUMAN_ONLY', 'AI_OVERFLOW');

-- AlterTable
ALTER TABLE "PhoneNumber" ADD COLUMN     "afterHoursAgentProfileId" TEXT,
ADD COLUMN     "enableMissedCallTextBack" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "primaryAgentProfileId" TEXT,
ADD COLUMN     "routingMode" "PhoneRoutingMode" NOT NULL DEFAULT 'AI_ALWAYS';

-- CreateIndex
CREATE INDEX "PhoneNumber_primaryAgentProfileId_idx" ON "PhoneNumber"("primaryAgentProfileId");

-- CreateIndex
CREATE INDEX "PhoneNumber_afterHoursAgentProfileId_idx" ON "PhoneNumber"("afterHoursAgentProfileId");

-- AddForeignKey
ALTER TABLE "PhoneNumber" ADD CONSTRAINT "PhoneNumber_primaryAgentProfileId_fkey" FOREIGN KEY ("primaryAgentProfileId") REFERENCES "AgentProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PhoneNumber" ADD CONSTRAINT "PhoneNumber_afterHoursAgentProfileId_fkey" FOREIGN KEY ("afterHoursAgentProfileId") REFERENCES "AgentProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;
