-- CreateEnum
CREATE TYPE "CallReviewStatus" AS ENUM ('UNREVIEWED', 'REVIEWED', 'NEEDS_REVIEW');

-- AlterTable
ALTER TABLE "Call" ADD COLUMN     "operatorNotes" TEXT,
ADD COLUMN     "reviewStatus" "CallReviewStatus" NOT NULL DEFAULT 'UNREVIEWED',
ADD COLUMN     "reviewedAt" TIMESTAMP(3);
