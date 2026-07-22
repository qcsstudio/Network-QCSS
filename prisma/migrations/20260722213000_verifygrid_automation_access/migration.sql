ALTER TABLE "VerifyGridExecutionJob"
  ADD COLUMN "sensorId" TEXT,
  ADD COLUMN "attempt" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "maxAttempts" INTEGER NOT NULL DEFAULT 3,
  ADD COLUMN "queuedAt" TIMESTAMP(3),
  ADD COLUMN "claimedAt" TIMESTAMP(3),
  ADD COLUMN "leaseUntil" TIMESTAMP(3),
  ADD COLUMN "startedAt" TIMESTAMP(3),
  ADD COLUMN "completedAt" TIMESTAMP(3),
  ADD COLUMN "resultBatchId" TEXT,
  ADD COLUMN "resultSummary" JSONB,
  ADD COLUMN "lastError" TEXT;

CREATE TABLE "VerifyGridConnectorProfile" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "engagementId" TEXT,
  "provider" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'active',
  "baseUrl" TEXT NOT NULL,
  "credentialRef" TEXT NOT NULL,
  "syncMode" TEXT NOT NULL DEFAULT 'differential',
  "scheduleMinutes" INTEGER NOT NULL DEFAULT 1440,
  "settings" JSONB,
  "cursor" JSONB,
  "lastSyncAt" TIMESTAMP(3),
  "nextSyncAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastSuccessAt" TIMESTAMP(3),
  "consecutiveFailures" INTEGER NOT NULL DEFAULT 0,
  "lastError" TEXT,
  "createdBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "VerifyGridConnectorProfile_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "VerifyGridConnectorRun" (
  "id" TEXT NOT NULL,
  "connectorId" TEXT NOT NULL,
  "engagementId" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'queued',
  "trigger" TEXT NOT NULL DEFAULT 'scheduled',
  "attempt" INTEGER NOT NULL DEFAULT 0,
  "maxAttempts" INTEGER NOT NULL DEFAULT 5,
  "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "leaseTokenHash" TEXT,
  "leaseUntil" TIMESTAMP(3),
  "remoteJobId" TEXT,
  "cursorBefore" JSONB,
  "cursorAfter" JSONB,
  "summary" JSONB,
  "errorMessage" TEXT,
  "startedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "createdBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "VerifyGridConnectorRun_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "VerifyGridSensor" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'active',
  "tokenHash" TEXT NOT NULL,
  "tokenLastFour" TEXT NOT NULL,
  "capabilities" JSONB NOT NULL,
  "version" TEXT,
  "region" TEXT,
  "lastSeenAt" TIMESTAMP(3),
  "createdBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "revokedAt" TIMESTAMP(3),
  "revokedBy" TEXT,
  CONSTRAINT "VerifyGridSensor_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "VerifyGridMembership" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "displayName" TEXT,
  "role" TEXT NOT NULL DEFAULT 'client_viewer',
  "status" TEXT NOT NULL DEFAULT 'invited',
  "invitedBy" TEXT,
  "invitedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "acceptedAt" TIMESTAMP(3),
  "lastAccessAt" TIMESTAMP(3),
  "revokedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "VerifyGridMembership_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "VerifyGridAccessToken" (
  "id" TEXT NOT NULL,
  "membershipId" TEXT NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "purpose" TEXT NOT NULL DEFAULT 'portal_access',
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "usedAt" TIMESTAMP(3),
  "revokedAt" TIMESTAMP(3),
  "createdBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "VerifyGridAccessToken_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "VerifyGridConnectorProfile_workspaceId_label_key" ON "VerifyGridConnectorProfile"("workspaceId", "label");
CREATE INDEX "VerifyGridConnectorProfile_status_nextSyncAt_idx" ON "VerifyGridConnectorProfile"("status", "nextSyncAt");
CREATE INDEX "VerifyGridConnectorProfile_workspaceId_provider_idx" ON "VerifyGridConnectorProfile"("workspaceId", "provider");
CREATE INDEX "VerifyGridConnectorProfile_engagementId_idx" ON "VerifyGridConnectorProfile"("engagementId");
CREATE INDEX "VerifyGridConnectorRun_status_nextAttemptAt_idx" ON "VerifyGridConnectorRun"("status", "nextAttemptAt");
CREATE INDEX "VerifyGridConnectorRun_connectorId_createdAt_idx" ON "VerifyGridConnectorRun"("connectorId", "createdAt");
CREATE INDEX "VerifyGridConnectorRun_engagementId_createdAt_idx" ON "VerifyGridConnectorRun"("engagementId", "createdAt");
CREATE UNIQUE INDEX "VerifyGridSensor_tokenHash_key" ON "VerifyGridSensor"("tokenHash");
CREATE UNIQUE INDEX "VerifyGridSensor_workspaceId_name_key" ON "VerifyGridSensor"("workspaceId", "name");
CREATE INDEX "VerifyGridSensor_workspaceId_status_idx" ON "VerifyGridSensor"("workspaceId", "status");
CREATE INDEX "VerifyGridSensor_lastSeenAt_idx" ON "VerifyGridSensor"("lastSeenAt");
CREATE UNIQUE INDEX "VerifyGridMembership_workspaceId_email_key" ON "VerifyGridMembership"("workspaceId", "email");
CREATE INDEX "VerifyGridMembership_email_status_idx" ON "VerifyGridMembership"("email", "status");
CREATE INDEX "VerifyGridMembership_workspaceId_role_status_idx" ON "VerifyGridMembership"("workspaceId", "role", "status");
CREATE UNIQUE INDEX "VerifyGridAccessToken_tokenHash_key" ON "VerifyGridAccessToken"("tokenHash");
CREATE INDEX "VerifyGridAccessToken_membershipId_expiresAt_idx" ON "VerifyGridAccessToken"("membershipId", "expiresAt");
CREATE INDEX "VerifyGridAccessToken_expiresAt_usedAt_idx" ON "VerifyGridAccessToken"("expiresAt", "usedAt");
CREATE INDEX "VerifyGridExecutionJob_sensorId_status_requestedStartAt_idx" ON "VerifyGridExecutionJob"("sensorId", "status", "requestedStartAt");
CREATE INDEX "VerifyGridExecutionJob_dispatchStatus_leaseUntil_idx" ON "VerifyGridExecutionJob"("dispatchStatus", "leaseUntil");

ALTER TABLE "VerifyGridConnectorProfile" ADD CONSTRAINT "VerifyGridConnectorProfile_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "VerifyGridWorkspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "VerifyGridConnectorProfile" ADD CONSTRAINT "VerifyGridConnectorProfile_engagementId_fkey" FOREIGN KEY ("engagementId") REFERENCES "VerifyGridEngagement"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "VerifyGridConnectorRun" ADD CONSTRAINT "VerifyGridConnectorRun_connectorId_fkey" FOREIGN KEY ("connectorId") REFERENCES "VerifyGridConnectorProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "VerifyGridConnectorRun" ADD CONSTRAINT "VerifyGridConnectorRun_engagementId_fkey" FOREIGN KEY ("engagementId") REFERENCES "VerifyGridEngagement"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "VerifyGridSensor" ADD CONSTRAINT "VerifyGridSensor_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "VerifyGridWorkspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "VerifyGridMembership" ADD CONSTRAINT "VerifyGridMembership_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "VerifyGridWorkspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "VerifyGridAccessToken" ADD CONSTRAINT "VerifyGridAccessToken_membershipId_fkey" FOREIGN KEY ("membershipId") REFERENCES "VerifyGridMembership"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "VerifyGridExecutionJob" ADD CONSTRAINT "VerifyGridExecutionJob_sensorId_fkey" FOREIGN KEY ("sensorId") REFERENCES "VerifyGridSensor"("id") ON DELETE SET NULL ON UPDATE CASCADE;
