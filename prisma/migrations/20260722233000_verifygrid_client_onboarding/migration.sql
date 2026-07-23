-- CreateTable
CREATE TABLE "VerifyGridOnboardingRequest" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "organizationName" TEXT NOT NULL,
    "legalName" TEXT,
    "phone" TEXT NOT NULL,
    "countryCode" TEXT,
    "timezone" TEXT NOT NULL DEFAULT 'UTC',
    "serviceType" TEXT NOT NULL,
    "scopeSummary" TEXT NOT NULL,
    "requestedStartAt" TIMESTAMP(3),
    "emergencyContactName" TEXT NOT NULL,
    "emergencyContactEmail" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending_email',
    "contactConsentAt" TIMESTAMP(3) NOT NULL,
    "emailVerifiedAt" TIMESTAMP(3),
    "workspaceId" TEXT,
    "engagementId" TEXT,
    "membershipId" TEXT,
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewNote" TEXT,
    "sourceCountry" TEXT,
    "sourceIpHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VerifyGridOnboardingRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VerifyGridOnboardingToken" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VerifyGridOnboardingToken_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "VerifyGridOnboardingRequest_status_createdAt_idx" ON "VerifyGridOnboardingRequest"("status", "createdAt");

-- CreateIndex
CREATE INDEX "VerifyGridOnboardingRequest_email_status_idx" ON "VerifyGridOnboardingRequest"("email", "status");

-- CreateIndex
CREATE INDEX "VerifyGridOnboardingRequest_organizationName_status_idx" ON "VerifyGridOnboardingRequest"("organizationName", "status");

-- CreateIndex
CREATE UNIQUE INDEX "VerifyGridOnboardingToken_tokenHash_key" ON "VerifyGridOnboardingToken"("tokenHash");

-- CreateIndex
CREATE INDEX "VerifyGridOnboardingToken_requestId_expiresAt_idx" ON "VerifyGridOnboardingToken"("requestId", "expiresAt");

-- CreateIndex
CREATE INDEX "VerifyGridOnboardingToken_expiresAt_usedAt_idx" ON "VerifyGridOnboardingToken"("expiresAt", "usedAt");

-- AddForeignKey
ALTER TABLE "VerifyGridOnboardingToken" ADD CONSTRAINT "VerifyGridOnboardingToken_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "VerifyGridOnboardingRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
