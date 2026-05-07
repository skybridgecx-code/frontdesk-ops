DROP INDEX IF EXISTS "TenantUser_clerkUserId_key";
CREATE UNIQUE INDEX IF NOT EXISTS "TenantUser_clerkUserId_tenantId_key" ON "TenantUser"("clerkUserId", "tenantId");
