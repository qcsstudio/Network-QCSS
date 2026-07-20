-- Content approval records are bound to an exact article revision.
CREATE TABLE "ContentApproval" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "revisionVersion" INTEGER NOT NULL,
    "revisionHash" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "publishToLinkedIn" BOOLEAN NOT NULL DEFAULT true,
    "actionTokenHash" TEXT NOT NULL,
    "whatsappMessageId" TEXT,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "decidedAt" TIMESTAMP(3),
    "decidedBy" TEXT,
    "feedback" TEXT,
    CONSTRAINT "ContentApproval_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "IntegrationConnection" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "accountName" TEXT NOT NULL,
    "encryptedAccessToken" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'connected',
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "IntegrationConnection_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SocialPublication" (
    "id" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "contentId" TEXT NOT NULL,
    "contentRevision" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "sourceUrl" TEXT NOT NULL,
    "commentary" TEXT NOT NULL,
    "imageUrl" TEXT,
    "externalId" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastAttemptAt" TIMESTAMP(3),
    "lastError" TEXT,
    "publishedAt" TIMESTAMP(3),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "SocialPublication_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AdvisorySource" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "vendor" TEXT NOT NULL,
    "format" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "officialHost" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "priority" INTEGER NOT NULL DEFAULT 50,
    "etag" TEXT,
    "lastModified" TEXT,
    "lastSuccessAt" TIMESTAMP(3),
    "lastCheckedAt" TIMESTAMP(3),
    "lastError" TEXT,
    "consecutiveFailures" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "AdvisorySource_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SecurityAdvisory" (
    "id" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "vendor" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "cvssScore" DOUBLE PRECISION,
    "priorityScore" INTEGER NOT NULL,
    "cves" JSONB NOT NULL,
    "products" JSONB NOT NULL,
    "affectedVersions" JSONB NOT NULL,
    "fixedVersions" JSONB NOT NULL,
    "remediation" TEXT NOT NULL,
    "workaround" TEXT,
    "exploitationStatus" TEXT NOT NULL,
    "sourceUrl" TEXT NOT NULL,
    "contentHash" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'published',
    "vendorPublishedAt" TIMESTAMP(3) NOT NULL,
    "vendorUpdatedAt" TIMESTAMP(3) NOT NULL,
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastVerifiedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "SecurityAdvisory_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SecurityAdvisoryRevision" (
    "id" TEXT NOT NULL,
    "advisoryId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "contentHash" TEXT NOT NULL,
    "changes" JSONB,
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SecurityAdvisoryRevision_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ContentApproval_actionTokenHash_key" ON "ContentApproval"("actionTokenHash");
CREATE INDEX "ContentApproval_postId_status_idx" ON "ContentApproval"("postId", "status");
CREATE INDEX "ContentApproval_status_expiresAt_idx" ON "ContentApproval"("status", "expiresAt");
CREATE UNIQUE INDEX "IntegrationConnection_provider_key" ON "IntegrationConnection"("provider");
CREATE INDEX "IntegrationConnection_provider_status_idx" ON "IntegrationConnection"("provider", "status");
CREATE INDEX "IntegrationConnection_expiresAt_idx" ON "IntegrationConnection"("expiresAt");
CREATE UNIQUE INDEX "SocialPublication_channel_contentType_contentId_contentRevision_key" ON "SocialPublication"("channel", "contentType", "contentId", "contentRevision");
CREATE INDEX "SocialPublication_channel_status_nextAttemptAt_idx" ON "SocialPublication"("channel", "status", "nextAttemptAt");
CREATE INDEX "SocialPublication_contentType_contentId_idx" ON "SocialPublication"("contentType", "contentId");
CREATE UNIQUE INDEX "AdvisorySource_slug_key" ON "AdvisorySource"("slug");
CREATE INDEX "AdvisorySource_enabled_priority_idx" ON "AdvisorySource"("enabled", "priority");
CREATE INDEX "AdvisorySource_lastSuccessAt_idx" ON "AdvisorySource"("lastSuccessAt");
CREATE UNIQUE INDEX "SecurityAdvisory_slug_key" ON "SecurityAdvisory"("slug");
CREATE UNIQUE INDEX "SecurityAdvisory_sourceId_externalId_key" ON "SecurityAdvisory"("sourceId", "externalId");
CREATE INDEX "SecurityAdvisory_status_vendorPublishedAt_idx" ON "SecurityAdvisory"("status", "vendorPublishedAt");
CREATE INDEX "SecurityAdvisory_severity_priorityScore_idx" ON "SecurityAdvisory"("severity", "priorityScore");
CREATE INDEX "SecurityAdvisory_vendor_idx" ON "SecurityAdvisory"("vendor");
CREATE UNIQUE INDEX "SecurityAdvisoryRevision_advisoryId_version_key" ON "SecurityAdvisoryRevision"("advisoryId", "version");
CREATE INDEX "SecurityAdvisoryRevision_advisoryId_createdAt_idx" ON "SecurityAdvisoryRevision"("advisoryId", "createdAt");

ALTER TABLE "ContentApproval" ADD CONSTRAINT "ContentApproval_postId_fkey" FOREIGN KEY ("postId") REFERENCES "ContentPost"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SecurityAdvisory" ADD CONSTRAINT "SecurityAdvisory_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "AdvisorySource"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SecurityAdvisoryRevision" ADD CONSTRAINT "SecurityAdvisoryRevision_advisoryId_fkey" FOREIGN KEY ("advisoryId") REFERENCES "SecurityAdvisory"("id") ON DELETE CASCADE ON UPDATE CASCADE;
