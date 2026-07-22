CREATE TABLE "VerifyGridImportBatch" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "engagementId" TEXT NOT NULL,
  "connector" TEXT NOT NULL,
  "format" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'processing',
  "fileName" TEXT,
  "contentSha256" TEXT NOT NULL,
  "scopeHash" TEXT NOT NULL,
  "authorizationId" TEXT,
  "observationCount" INTEGER NOT NULL DEFAULT 0,
  "inScopeCount" INTEGER NOT NULL DEFAULT 0,
  "outOfScopeCount" INTEGER NOT NULL DEFAULT 0,
  "unmatchedCount" INTEGER NOT NULL DEFAULT 0,
  "promotedCount" INTEGER NOT NULL DEFAULT 0,
  "duplicateCount" INTEGER NOT NULL DEFAULT 0,
  "rejectedCount" INTEGER NOT NULL DEFAULT 0,
  "enrichmentStatus" TEXT NOT NULL DEFAULT 'not_requested',
  "sourceStartedAt" TIMESTAMP(3),
  "sourceCompletedAt" TIMESTAMP(3),
  "summary" JSONB,
  "errorMessage" TEXT,
  "importedBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt" TIMESTAMP(3),
  CONSTRAINT "VerifyGridImportBatch_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "VerifyGridObservation" (
  "id" TEXT NOT NULL,
  "batchId" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "engagementId" TEXT NOT NULL,
  "promotedFindingId" TEXT,
  "fingerprint" TEXT NOT NULL,
  "assetIdentifier" TEXT NOT NULL,
  "assetName" TEXT NOT NULL,
  "assetKind" TEXT NOT NULL DEFAULT 'host',
  "environment" TEXT NOT NULL DEFAULT 'production',
  "assetCriticality" TEXT NOT NULL DEFAULT 'medium',
  "title" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "severity" TEXT NOT NULL,
  "confidence" TEXT NOT NULL DEFAULT 'unverified',
  "sourceReference" TEXT,
  "advisoryExternalId" TEXT,
  "cvssScore" DOUBLE PRECISION,
  "epssScore" DOUBLE PRECISION,
  "epssPercentile" DOUBLE PRECISION,
  "knownExploited" BOOLEAN NOT NULL DEFAULT false,
  "port" INTEGER,
  "protocol" TEXT,
  "service" TEXT,
  "evidenceSummary" TEXT,
  "remediation" TEXT NOT NULL,
  "scopeDisposition" TEXT NOT NULL DEFAULT 'unmatched',
  "scopeTargetId" TEXT,
  "dispositionReason" TEXT,
  "promotionStatus" TEXT NOT NULL DEFAULT 'pending',
  "rawMetadata" JSONB,
  "firstObservedAt" TIMESTAMP(3),
  "lastObservedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "VerifyGridObservation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "VerifyGridExecutionJob" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "engagementId" TEXT NOT NULL,
  "authorizationId" TEXT NOT NULL,
  "capability" TEXT NOT NULL,
  "capabilityLevel" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'validated',
  "scopeHash" TEXT NOT NULL,
  "targetIds" JSONB NOT NULL,
  "targetSnapshot" JSONB NOT NULL,
  "rationale" TEXT NOT NULL,
  "requestedStartAt" TIMESTAMP(3) NOT NULL,
  "validUntil" TIMESTAMP(3) NOT NULL,
  "maxRequestsPerSecond" INTEGER NOT NULL,
  "manifest" JSONB NOT NULL,
  "manifestSha256" TEXT NOT NULL,
  "dispatchStatus" TEXT NOT NULL DEFAULT 'worker_not_connected',
  "requestedBy" TEXT,
  "cancelledBy" TEXT,
  "cancelledAt" TIMESTAMP(3),
  "cancellationReason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "VerifyGridExecutionJob_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "VerifyGridReport" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "engagementId" TEXT NOT NULL,
  "version" INTEGER NOT NULL,
  "reportType" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'final',
  "title" TEXT NOT NULL,
  "scopeHash" TEXT NOT NULL,
  "snapshot" JSONB NOT NULL,
  "snapshotSha256" TEXT NOT NULL,
  "generatedBy" TEXT,
  "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "VerifyGridReport_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "VerifyGridImportBatch_engagementId_connector_contentSha256_key" ON "VerifyGridImportBatch"("engagementId", "connector", "contentSha256");
CREATE INDEX "VerifyGridImportBatch_workspaceId_createdAt_idx" ON "VerifyGridImportBatch"("workspaceId", "createdAt");
CREATE INDEX "VerifyGridImportBatch_engagementId_status_createdAt_idx" ON "VerifyGridImportBatch"("engagementId", "status", "createdAt");
CREATE UNIQUE INDEX "VerifyGridObservation_batchId_fingerprint_key" ON "VerifyGridObservation"("batchId", "fingerprint");
CREATE INDEX "VerifyGridObservation_engagementId_scopeDisposition_promotionStatus_idx" ON "VerifyGridObservation"("engagementId", "scopeDisposition", "promotionStatus");
CREATE INDEX "VerifyGridObservation_workspaceId_advisoryExternalId_idx" ON "VerifyGridObservation"("workspaceId", "advisoryExternalId");
CREATE INDEX "VerifyGridObservation_promotedFindingId_idx" ON "VerifyGridObservation"("promotedFindingId");
CREATE INDEX "VerifyGridExecutionJob_engagementId_status_requestedStartAt_idx" ON "VerifyGridExecutionJob"("engagementId", "status", "requestedStartAt");
CREATE INDEX "VerifyGridExecutionJob_authorizationId_idx" ON "VerifyGridExecutionJob"("authorizationId");
CREATE INDEX "VerifyGridExecutionJob_manifestSha256_idx" ON "VerifyGridExecutionJob"("manifestSha256");
CREATE UNIQUE INDEX "VerifyGridReport_engagementId_reportType_version_key" ON "VerifyGridReport"("engagementId", "reportType", "version");
CREATE INDEX "VerifyGridReport_workspaceId_generatedAt_idx" ON "VerifyGridReport"("workspaceId", "generatedAt");
CREATE INDEX "VerifyGridReport_engagementId_generatedAt_idx" ON "VerifyGridReport"("engagementId", "generatedAt");
CREATE INDEX "VerifyGridReport_snapshotSha256_idx" ON "VerifyGridReport"("snapshotSha256");

ALTER TABLE "VerifyGridImportBatch" ADD CONSTRAINT "VerifyGridImportBatch_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "VerifyGridWorkspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "VerifyGridImportBatch" ADD CONSTRAINT "VerifyGridImportBatch_engagementId_fkey" FOREIGN KEY ("engagementId") REFERENCES "VerifyGridEngagement"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "VerifyGridObservation" ADD CONSTRAINT "VerifyGridObservation_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "VerifyGridImportBatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "VerifyGridObservation" ADD CONSTRAINT "VerifyGridObservation_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "VerifyGridWorkspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "VerifyGridObservation" ADD CONSTRAINT "VerifyGridObservation_engagementId_fkey" FOREIGN KEY ("engagementId") REFERENCES "VerifyGridEngagement"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "VerifyGridObservation" ADD CONSTRAINT "VerifyGridObservation_promotedFindingId_fkey" FOREIGN KEY ("promotedFindingId") REFERENCES "VerifyGridFinding"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "VerifyGridExecutionJob" ADD CONSTRAINT "VerifyGridExecutionJob_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "VerifyGridWorkspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "VerifyGridExecutionJob" ADD CONSTRAINT "VerifyGridExecutionJob_engagementId_fkey" FOREIGN KEY ("engagementId") REFERENCES "VerifyGridEngagement"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "VerifyGridExecutionJob" ADD CONSTRAINT "VerifyGridExecutionJob_authorizationId_fkey" FOREIGN KEY ("authorizationId") REFERENCES "VerifyGridAuthorization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "VerifyGridReport" ADD CONSTRAINT "VerifyGridReport_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "VerifyGridWorkspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "VerifyGridReport" ADD CONSTRAINT "VerifyGridReport_engagementId_fkey" FOREIGN KEY ("engagementId") REFERENCES "VerifyGridEngagement"("id") ON DELETE CASCADE ON UPDATE CASCADE;
