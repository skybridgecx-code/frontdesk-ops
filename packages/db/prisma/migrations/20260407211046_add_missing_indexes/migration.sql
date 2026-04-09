-- CreateIndex
CREATE INDEX "Call_triageStatus_idx" ON "Call"("triageStatus");

-- CreateIndex
CREATE INDEX "Call_reviewStatus_idx" ON "Call"("reviewStatus");

-- CreateIndex
CREATE INDEX "Call_fromE164_idx" ON "Call"("fromE164");

-- CreateIndex
CREATE INDEX "Prospect_companyName_idx" ON "Prospect"("companyName");
