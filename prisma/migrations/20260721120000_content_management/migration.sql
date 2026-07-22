ALTER TABLE "SecurityAdvisory"
ADD COLUMN "editorialOverride" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "createdBy" TEXT,
ADD COLUMN "updatedBy" TEXT,
ADD COLUMN "deletedAt" TIMESTAMP(3);

CREATE INDEX "SecurityAdvisory_editorialOverride_status_idx"
ON "SecurityAdvisory"("editorialOverride", "status");
