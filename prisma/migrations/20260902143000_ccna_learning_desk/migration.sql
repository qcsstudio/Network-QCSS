CREATE TABLE "CcnaLesson" (
    "id" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "moduleId" TEXT NOT NULL,
    "moduleTitle" TEXT NOT NULL,
    "examDomain" TEXT NOT NULL,
    "v11Blueprint" TEXT NOT NULL,
    "v20Blueprint" TEXT,
    "status" TEXT NOT NULL DEFAULT 'scheduled',
    "scheduledFor" TIMESTAMP(3),
    "publishedAt" TIMESTAMP(3),
    "content" JSONB NOT NULL DEFAULT '{}',
    "sources" JSONB NOT NULL DEFAULT '[]',
    "generationTrace" JSONB,
    "qualityScore" INTEGER,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "generationStartedAt" TIMESTAMP(3),
    "lastError" TEXT,
    "createdBy" TEXT,
    "approvedBy" TEXT,
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CcnaLesson_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CcnaLesson_sequence_key" ON "CcnaLesson"("sequence");
CREATE UNIQUE INDEX "CcnaLesson_slug_key" ON "CcnaLesson"("slug");
CREATE INDEX "CcnaLesson_status_sequence_idx" ON "CcnaLesson"("status", "sequence");
CREATE INDEX "CcnaLesson_scheduledFor_idx" ON "CcnaLesson"("scheduledFor");
CREATE INDEX "CcnaLesson_publishedAt_idx" ON "CcnaLesson"("publishedAt");
CREATE INDEX "CcnaLesson_moduleId_sequence_idx" ON "CcnaLesson"("moduleId", "sequence");
