ALTER TABLE "VerifyGridReport"
  ALTER COLUMN "status" SET DEFAULT 'draft',
  ADD COLUMN "qualityGate" JSONB,
  ADD COLUMN "previousChainHash" TEXT,
  ADD COLUMN "chainHash" TEXT,
  ADD COLUMN "reviewedBy" TEXT,
  ADD COLUMN "reviewedAt" TIMESTAMP(3),
  ADD COLUMN "reviewDecision" TEXT,
  ADD COLUMN "reviewNotes" TEXT,
  ADD COLUMN "releasedBy" TEXT,
  ADD COLUMN "releasedAt" TIMESTAMP(3),
  ADD COLUMN "signature" TEXT,
  ADD COLUMN "signatureAlgorithm" TEXT,
  ADD COLUMN "signingKeyId" TEXT,
  ADD COLUMN "signingPublicKey" TEXT;

CREATE TABLE "VerifyGridOperator" (
  "id" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "displayName" TEXT NOT NULL,
  "role" TEXT NOT NULL DEFAULT 'analyst',
  "status" TEXT NOT NULL DEFAULT 'active',
  "createdBy" TEXT,
  "lastAuthenticatedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "VerifyGridOperator_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "VerifyGridOperatorPasskey" (
  "id" TEXT NOT NULL,
  "operatorId" TEXT NOT NULL,
  "credentialId" TEXT NOT NULL,
  "publicKey" BYTEA NOT NULL,
  "counter" BIGINT NOT NULL DEFAULT 0,
  "deviceType" TEXT NOT NULL,
  "backedUp" BOOLEAN NOT NULL DEFAULT false,
  "transports" JSONB,
  "label" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastUsedAt" TIMESTAMP(3),
  CONSTRAINT "VerifyGridOperatorPasskey_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "VerifyGridOperatorSession" (
  "id" TEXT NOT NULL,
  "operatorId" TEXT NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "ipHash" TEXT,
  "userAgentHash" TEXT,
  "revokedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "VerifyGridOperatorSession_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "VerifyGridOperatorChallenge" (
  "id" TEXT NOT NULL,
  "operatorId" TEXT NOT NULL,
  "kind" TEXT NOT NULL,
  "challenge" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "usedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "VerifyGridOperatorChallenge_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "VerifyGridReportReview" (
  "id" TEXT NOT NULL,
  "reportId" TEXT NOT NULL,
  "operatorId" TEXT,
  "decision" TEXT NOT NULL,
  "notes" TEXT NOT NULL,
  "checklist" JSONB NOT NULL,
  "actor" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "VerifyGridReportReview_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "VerifyGridCustodyEvent" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "engagementId" TEXT NOT NULL,
  "evidenceId" TEXT,
  "sequence" INTEGER NOT NULL,
  "eventType" TEXT NOT NULL,
  "subjectType" TEXT NOT NULL,
  "subjectId" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "actor" TEXT NOT NULL,
  "sourceSha256" TEXT,
  "previousHash" TEXT,
  "eventHash" TEXT NOT NULL,
  "classification" TEXT NOT NULL DEFAULT 'confidential',
  "custodyLocation" TEXT,
  "retentionUntil" TIMESTAMP(3),
  "details" JSONB,
  "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "VerifyGridCustodyEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "VerifyGridOperator_email_key" ON "VerifyGridOperator"("email");
CREATE INDEX "VerifyGridOperator_status_role_idx" ON "VerifyGridOperator"("status", "role");
CREATE UNIQUE INDEX "VerifyGridOperatorPasskey_credentialId_key" ON "VerifyGridOperatorPasskey"("credentialId");
CREATE INDEX "VerifyGridOperatorPasskey_operatorId_createdAt_idx" ON "VerifyGridOperatorPasskey"("operatorId", "createdAt");
CREATE UNIQUE INDEX "VerifyGridOperatorSession_tokenHash_key" ON "VerifyGridOperatorSession"("tokenHash");
CREATE INDEX "VerifyGridOperatorSession_operatorId_expiresAt_idx" ON "VerifyGridOperatorSession"("operatorId", "expiresAt");
CREATE INDEX "VerifyGridOperatorSession_expiresAt_revokedAt_idx" ON "VerifyGridOperatorSession"("expiresAt", "revokedAt");
CREATE UNIQUE INDEX "VerifyGridOperatorChallenge_challenge_key" ON "VerifyGridOperatorChallenge"("challenge");
CREATE INDEX "VerifyGridOperatorChallenge_operatorId_kind_expiresAt_idx" ON "VerifyGridOperatorChallenge"("operatorId", "kind", "expiresAt");
CREATE INDEX "VerifyGridOperatorChallenge_expiresAt_usedAt_idx" ON "VerifyGridOperatorChallenge"("expiresAt", "usedAt");
CREATE INDEX "VerifyGridReportReview_reportId_createdAt_idx" ON "VerifyGridReportReview"("reportId", "createdAt");
CREATE INDEX "VerifyGridReportReview_operatorId_createdAt_idx" ON "VerifyGridReportReview"("operatorId", "createdAt");
CREATE UNIQUE INDEX "VerifyGridCustodyEvent_eventHash_key" ON "VerifyGridCustodyEvent"("eventHash");
CREATE UNIQUE INDEX "VerifyGridCustodyEvent_engagementId_sequence_key" ON "VerifyGridCustodyEvent"("engagementId", "sequence");
CREATE INDEX "VerifyGridCustodyEvent_workspaceId_occurredAt_idx" ON "VerifyGridCustodyEvent"("workspaceId", "occurredAt");
CREATE INDEX "VerifyGridCustodyEvent_engagementId_occurredAt_idx" ON "VerifyGridCustodyEvent"("engagementId", "occurredAt");
CREATE INDEX "VerifyGridCustodyEvent_evidenceId_idx" ON "VerifyGridCustodyEvent"("evidenceId");
CREATE INDEX "VerifyGridCustodyEvent_sourceSha256_idx" ON "VerifyGridCustodyEvent"("sourceSha256");
CREATE INDEX "VerifyGridReport_engagementId_status_generatedAt_idx" ON "VerifyGridReport"("engagementId", "status", "generatedAt");

ALTER TABLE "VerifyGridOperatorPasskey" ADD CONSTRAINT "VerifyGridOperatorPasskey_operatorId_fkey" FOREIGN KEY ("operatorId") REFERENCES "VerifyGridOperator"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "VerifyGridOperatorSession" ADD CONSTRAINT "VerifyGridOperatorSession_operatorId_fkey" FOREIGN KEY ("operatorId") REFERENCES "VerifyGridOperator"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "VerifyGridOperatorChallenge" ADD CONSTRAINT "VerifyGridOperatorChallenge_operatorId_fkey" FOREIGN KEY ("operatorId") REFERENCES "VerifyGridOperator"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "VerifyGridReportReview" ADD CONSTRAINT "VerifyGridReportReview_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "VerifyGridReport"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "VerifyGridReportReview" ADD CONSTRAINT "VerifyGridReportReview_operatorId_fkey" FOREIGN KEY ("operatorId") REFERENCES "VerifyGridOperator"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "VerifyGridCustodyEvent" ADD CONSTRAINT "VerifyGridCustodyEvent_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "VerifyGridWorkspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "VerifyGridCustodyEvent" ADD CONSTRAINT "VerifyGridCustodyEvent_engagementId_fkey" FOREIGN KEY ("engagementId") REFERENCES "VerifyGridEngagement"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "VerifyGridCustodyEvent" ADD CONSTRAINT "VerifyGridCustodyEvent_evidenceId_fkey" FOREIGN KEY ("evidenceId") REFERENCES "VerifyGridEvidence"("id") ON DELETE SET NULL ON UPDATE CASCADE;
