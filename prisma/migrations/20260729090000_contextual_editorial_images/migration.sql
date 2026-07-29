CREATE TABLE "EditorialImage" (
    "id" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "contentId" TEXT NOT NULL,
    "contentRevision" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "prompt" TEXT NOT NULL,
    "promptHash" TEXT NOT NULL,
    "model" TEXT,
    "altText" TEXT NOT NULL,
    "heroImage" BYTEA,
    "socialImage" BYTEA,
    "mimeType" TEXT NOT NULL DEFAULT 'image/jpeg',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "generatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EditorialImage_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "EditorialImage_contentType_contentId_contentRevision_key"
ON "EditorialImage"("contentType", "contentId", "contentRevision");

CREATE INDEX "EditorialImage_status_updatedAt_idx" ON "EditorialImage"("status", "updatedAt");
CREATE INDEX "EditorialImage_contentType_contentId_idx" ON "EditorialImage"("contentType", "contentId");
