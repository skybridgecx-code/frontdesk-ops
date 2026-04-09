-- CreateIndex
CREATE INDEX "Call_createdAt_idx" ON "Call"("createdAt");

-- CreateIndex
CREATE INDEX "Call_createdAt_status_idx" ON "Call"("createdAt", "status");
