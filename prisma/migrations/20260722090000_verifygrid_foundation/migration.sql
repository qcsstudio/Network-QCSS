CREATE TABLE "VerifyGridWorkspace" (
  "id" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "legalName" TEXT,
  "primaryContactName" TEXT NOT NULL,
  "primaryContactEmail" TEXT NOT NULL,
  "countryCode" TEXT,
  "timezone" TEXT NOT NULL DEFAULT 'Asia/Kolkata',
  "status" TEXT NOT NULL DEFAULT 'active',
  "createdBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "VerifyGridWorkspace_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "VerifyGridEngagement" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "reference" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "serviceType" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'draft',
  "testMode" TEXT NOT NULL DEFAULT 'safe_checks',
  "riskTier" TEXT NOT NULL DEFAULT 'standard',
  "scopeSummary" TEXT NOT NULL,
  "rulesOfEngagement" JSONB,
  "plannedStartAt" TIMESTAMP(3),
  "plannedEndAt" TIMESTAMP(3),
  "emergencyContactName" TEXT NOT NULL,
  "emergencyContactEmail" TEXT NOT NULL,
  "emergencyContactPhone" TEXT,
  "createdBy" TEXT,
  "updatedBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "VerifyGridEngagement_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "VerifyGridScopeTarget" (
  "id" TEXT NOT NULL,
  "engagementId" TEXT NOT NULL,
  "targetType" TEXT NOT NULL,
  "value" TEXT NOT NULL,
  "environment" TEXT NOT NULL DEFAULT 'production',
  "criticality" TEXT NOT NULL DEFAULT 'medium',
  "permission" TEXT NOT NULL DEFAULT 'safe_checks',
  "inScope" BOOLEAN NOT NULL DEFAULT true,
  "ownershipConfirmed" BOOLEAN NOT NULL DEFAULT false,
  "notes" TEXT,
  "createdBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "VerifyGridScopeTarget_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "VerifyGridAuthorization" (
  "id" TEXT NOT NULL,
  "engagementId" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'active',
  "scopeHash" TEXT NOT NULL,
  "approvedByName" TEXT NOT NULL,
  "approvedByEmail" TEXT NOT NULL,
  "approvedByTitle" TEXT,
  "authorityConfirmed" BOOLEAN NOT NULL DEFAULT false,
  "approvalMethod" TEXT NOT NULL DEFAULT 'recorded_admin',
  "validFrom" TIMESTAMP(3) NOT NULL,
  "validUntil" TIMESTAMP(3) NOT NULL,
  "artifactUrl" TEXT,
  "artifactSha256" TEXT,
  "notes" TEXT,
  "authorizedBy" TEXT,
  "authorizedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "revokedAt" TIMESTAMP(3),
  "revokedBy" TEXT,
  "revocationReason" TEXT,
  CONSTRAINT "VerifyGridAuthorization_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "VerifyGridAsset" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "engagementId" TEXT,
  "identifier" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "kind" TEXT NOT NULL,
  "environment" TEXT NOT NULL DEFAULT 'production',
  "criticality" TEXT NOT NULL DEFAULT 'medium',
  "exposure" TEXT NOT NULL DEFAULT 'unknown',
  "vendor" TEXT,
  "product" TEXT,
  "version" TEXT,
  "ownerName" TEXT,
  "ownerEmail" TEXT,
  "tags" JSONB,
  "source" TEXT NOT NULL DEFAULT 'manual',
  "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "VerifyGridAsset_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "VerifyGridFinding" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "engagementId" TEXT NOT NULL,
  "assetId" TEXT,
  "fingerprint" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'open',
  "severity" TEXT NOT NULL,
  "confidence" TEXT NOT NULL DEFAULT 'unverified',
  "source" TEXT NOT NULL DEFAULT 'manual',
  "sourceReference" TEXT,
  "advisoryExternalId" TEXT,
  "cvssScore" DOUBLE PRECISION,
  "epssScore" DOUBLE PRECISION,
  "knownExploited" BOOLEAN NOT NULL DEFAULT false,
  "attackPath" TEXT,
  "businessImpact" TEXT NOT NULL,
  "evidenceSummary" TEXT,
  "remediation" TEXT NOT NULL,
  "ownerName" TEXT,
  "ownerEmail" TEXT,
  "dueAt" TIMESTAMP(3),
  "firstDetectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastObservedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "resolvedAt" TIMESTAMP(3),
  "createdBy" TEXT,
  "updatedBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "VerifyGridFinding_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "VerifyGridEvidence" (
  "id" TEXT NOT NULL,
  "findingId" TEXT NOT NULL,
  "evidenceType" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "summary" TEXT,
  "objectKey" TEXT,
  "sourceUrl" TEXT,
  "sha256" TEXT,
  "classification" TEXT NOT NULL DEFAULT 'confidential',
  "metadata" JSONB,
  "collectedBy" TEXT,
  "collectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "VerifyGridEvidence_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "VerifyGridRetest" (
  "id" TEXT NOT NULL,
  "findingId" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'requested',
  "requestedBy" TEXT,
  "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "startedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "result" TEXT,
  "evidenceSummary" TEXT,
  "performedBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "VerifyGridRetest_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "VerifyGridActivity" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "engagementId" TEXT,
  "findingId" TEXT,
  "action" TEXT NOT NULL,
  "actor" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "VerifyGridActivity_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "VerifyGridWorkspace_slug_key" ON "VerifyGridWorkspace"("slug");
CREATE INDEX "VerifyGridWorkspace_status_updatedAt_idx" ON "VerifyGridWorkspace"("status", "updatedAt");
CREATE INDEX "VerifyGridWorkspace_primaryContactEmail_idx" ON "VerifyGridWorkspace"("primaryContactEmail");
CREATE UNIQUE INDEX "VerifyGridEngagement_reference_key" ON "VerifyGridEngagement"("reference");
CREATE INDEX "VerifyGridEngagement_workspaceId_status_idx" ON "VerifyGridEngagement"("workspaceId", "status");
CREATE INDEX "VerifyGridEngagement_status_plannedStartAt_idx" ON "VerifyGridEngagement"("status", "plannedStartAt");
CREATE INDEX "VerifyGridEngagement_updatedAt_idx" ON "VerifyGridEngagement"("updatedAt");
CREATE UNIQUE INDEX "VerifyGridScopeTarget_engagementId_targetType_value_key" ON "VerifyGridScopeTarget"("engagementId", "targetType", "value");
CREATE INDEX "VerifyGridScopeTarget_engagementId_inScope_idx" ON "VerifyGridScopeTarget"("engagementId", "inScope");
CREATE INDEX "VerifyGridAuthorization_engagementId_status_validUntil_idx" ON "VerifyGridAuthorization"("engagementId", "status", "validUntil");
CREATE INDEX "VerifyGridAuthorization_scopeHash_idx" ON "VerifyGridAuthorization"("scopeHash");
CREATE UNIQUE INDEX "VerifyGridAsset_workspaceId_identifier_key" ON "VerifyGridAsset"("workspaceId", "identifier");
CREATE INDEX "VerifyGridAsset_workspaceId_criticality_idx" ON "VerifyGridAsset"("workspaceId", "criticality");
CREATE INDEX "VerifyGridAsset_engagementId_idx" ON "VerifyGridAsset"("engagementId");
CREATE INDEX "VerifyGridAsset_lastSeenAt_idx" ON "VerifyGridAsset"("lastSeenAt");
CREATE UNIQUE INDEX "VerifyGridFinding_workspaceId_fingerprint_key" ON "VerifyGridFinding"("workspaceId", "fingerprint");
CREATE INDEX "VerifyGridFinding_engagementId_status_severity_idx" ON "VerifyGridFinding"("engagementId", "status", "severity");
CREATE INDEX "VerifyGridFinding_workspaceId_knownExploited_idx" ON "VerifyGridFinding"("workspaceId", "knownExploited");
CREATE INDEX "VerifyGridFinding_assetId_idx" ON "VerifyGridFinding"("assetId");
CREATE INDEX "VerifyGridFinding_dueAt_idx" ON "VerifyGridFinding"("dueAt");
CREATE INDEX "VerifyGridEvidence_findingId_collectedAt_idx" ON "VerifyGridEvidence"("findingId", "collectedAt");
CREATE INDEX "VerifyGridEvidence_sha256_idx" ON "VerifyGridEvidence"("sha256");
CREATE INDEX "VerifyGridRetest_findingId_requestedAt_idx" ON "VerifyGridRetest"("findingId", "requestedAt");
CREATE INDEX "VerifyGridRetest_status_requestedAt_idx" ON "VerifyGridRetest"("status", "requestedAt");
CREATE INDEX "VerifyGridActivity_workspaceId_createdAt_idx" ON "VerifyGridActivity"("workspaceId", "createdAt");
CREATE INDEX "VerifyGridActivity_engagementId_createdAt_idx" ON "VerifyGridActivity"("engagementId", "createdAt");
CREATE INDEX "VerifyGridActivity_findingId_createdAt_idx" ON "VerifyGridActivity"("findingId", "createdAt");

ALTER TABLE "VerifyGridEngagement" ADD CONSTRAINT "VerifyGridEngagement_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "VerifyGridWorkspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "VerifyGridScopeTarget" ADD CONSTRAINT "VerifyGridScopeTarget_engagementId_fkey" FOREIGN KEY ("engagementId") REFERENCES "VerifyGridEngagement"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "VerifyGridAuthorization" ADD CONSTRAINT "VerifyGridAuthorization_engagementId_fkey" FOREIGN KEY ("engagementId") REFERENCES "VerifyGridEngagement"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "VerifyGridAsset" ADD CONSTRAINT "VerifyGridAsset_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "VerifyGridWorkspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "VerifyGridAsset" ADD CONSTRAINT "VerifyGridAsset_engagementId_fkey" FOREIGN KEY ("engagementId") REFERENCES "VerifyGridEngagement"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "VerifyGridFinding" ADD CONSTRAINT "VerifyGridFinding_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "VerifyGridWorkspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "VerifyGridFinding" ADD CONSTRAINT "VerifyGridFinding_engagementId_fkey" FOREIGN KEY ("engagementId") REFERENCES "VerifyGridEngagement"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "VerifyGridFinding" ADD CONSTRAINT "VerifyGridFinding_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "VerifyGridAsset"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "VerifyGridEvidence" ADD CONSTRAINT "VerifyGridEvidence_findingId_fkey" FOREIGN KEY ("findingId") REFERENCES "VerifyGridFinding"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "VerifyGridRetest" ADD CONSTRAINT "VerifyGridRetest_findingId_fkey" FOREIGN KEY ("findingId") REFERENCES "VerifyGridFinding"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "VerifyGridActivity" ADD CONSTRAINT "VerifyGridActivity_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "VerifyGridWorkspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "VerifyGridActivity" ADD CONSTRAINT "VerifyGridActivity_engagementId_fkey" FOREIGN KEY ("engagementId") REFERENCES "VerifyGridEngagement"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "VerifyGridActivity" ADD CONSTRAINT "VerifyGridActivity_findingId_fkey" FOREIGN KEY ("findingId") REFERENCES "VerifyGridFinding"("id") ON DELETE CASCADE ON UPDATE CASCADE;
