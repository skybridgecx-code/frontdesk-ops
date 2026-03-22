-- CreateEnum
CREATE TYPE "CallTriageStatus" AS ENUM ('OPEN', 'CONTACTED', 'ARCHIVED');

-- AlterTable
ALTER TABLE "Call" ADD COLUMN     "archivedAt" TIMESTAMP(3),
ADD COLUMN     "contactedAt" TIMESTAMP(3),
ADD COLUMN     "triageStatus" "CallTriageStatus" NOT NULL DEFAULT 'OPEN';
