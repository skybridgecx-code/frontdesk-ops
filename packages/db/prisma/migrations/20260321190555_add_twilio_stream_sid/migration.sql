/*
  Warnings:

  - A unique constraint covering the columns `[twilioStreamSid]` on the table `Call` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "Call" ADD COLUMN     "twilioStreamSid" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Call_twilioStreamSid_key" ON "Call"("twilioStreamSid");

-- CreateIndex
CREATE INDEX "Call_twilioStreamSid_idx" ON "Call"("twilioStreamSid");
