ALTER TABLE "VerifyGridOperator" ADD COLUMN "identityTenantId" TEXT, ADD COLUMN "identityObjectId" TEXT;
CREATE UNIQUE INDEX "VerifyGridOperator_identityTenantId_identityObjectId_key" ON "VerifyGridOperator"("identityTenantId", "identityObjectId");
CREATE TABLE "VerifyGridIdentityLogin" (
  "id" TEXT NOT NULL PRIMARY KEY, "tokenHash" TEXT NOT NULL, "stateHash" TEXT NOT NULL,
  "sealed" TEXT NOT NULL, "userAgentHash" TEXT NOT NULL, "expiresAt" TIMESTAMP(3) NOT NULL,
  "usedAt" TIMESTAMP(3), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "VerifyGridIdentityLogin_tokenHash_key" ON "VerifyGridIdentityLogin"("tokenHash");
CREATE UNIQUE INDEX "VerifyGridIdentityLogin_stateHash_key" ON "VerifyGridIdentityLogin"("stateHash");
CREATE INDEX "VerifyGridIdentityLogin_expiresAt_idx" ON "VerifyGridIdentityLogin"("expiresAt");
CREATE TABLE "VerifyGridIdentitySession" (
  "id" TEXT NOT NULL PRIMARY KEY, "operatorId" TEXT NOT NULL, "tokenHash" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL, "objectId" TEXT NOT NULL, "role" TEXT NOT NULL,
  "userAgentHash" TEXT NOT NULL, "expiresAt" TIMESTAMP(3) NOT NULL, "revokedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "VerifyGridIdentitySession_operatorId_fkey" FOREIGN KEY ("operatorId") REFERENCES "VerifyGridOperator"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "VerifyGridIdentitySession_tokenHash_key" ON "VerifyGridIdentitySession"("tokenHash");
CREATE INDEX "VerifyGridIdentitySession_operatorId_expiresAt_idx" ON "VerifyGridIdentitySession"("operatorId", "expiresAt");
