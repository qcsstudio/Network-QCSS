ALTER TABLE "VerifyGridExecutionJob"
ADD COLUMN "approvedBy" TEXT,
ADD COLUMN "approvedAt" TIMESTAMP(3),
ADD COLUMN "approvalNote" TEXT;

ALTER TABLE "VerifyGridSensor"
ADD COLUMN "runtimeCapabilities" JSONB,
ADD COLUMN "healthStatus" TEXT NOT NULL DEFAULT 'enrolled',
ADD COLUMN "lastError" TEXT;

CREATE TABLE "VerifyGridTestCase" (
  "id" TEXT NOT NULL,
  "engagementId" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "standardRef" TEXT NOT NULL,
  "category" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "objective" TEXT NOT NULL,
  "executionMode" TEXT NOT NULL,
  "capability" TEXT,
  "status" TEXT NOT NULL DEFAULT 'planned',
  "resultSummary" TEXT,
  "assignedTo" TEXT,
  "startedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "updatedBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "VerifyGridTestCase_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "VerifyGridTestCase_engagementId_code_key" ON "VerifyGridTestCase"("engagementId", "code");
CREATE INDEX "VerifyGridTestCase_engagementId_status_category_idx" ON "VerifyGridTestCase"("engagementId", "status", "category");
CREATE INDEX "VerifyGridTestCase_capability_idx" ON "VerifyGridTestCase"("capability");
ALTER TABLE "VerifyGridTestCase" ADD CONSTRAINT "VerifyGridTestCase_engagementId_fkey" FOREIGN KEY ("engagementId") REFERENCES "VerifyGridEngagement"("id") ON DELETE CASCADE ON UPDATE CASCADE;
