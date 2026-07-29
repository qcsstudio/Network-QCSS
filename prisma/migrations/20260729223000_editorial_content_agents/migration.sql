ALTER TABLE "ContentPost"
ADD COLUMN "researchTrace" JSONB,
ADD COLUMN "qualityScore" INTEGER;

ALTER TABLE "SecurityAdvisory"
ADD COLUMN "technicalExplanation" TEXT NOT NULL DEFAULT '',
ADD COLUMN "businessImpact" TEXT NOT NULL DEFAULT '',
ADD COLUMN "evidenceChecklist" JSONB NOT NULL DEFAULT '[]'::jsonb,
ADD COLUMN "editorialTrace" JSONB,
ADD COLUMN "qualityScore" INTEGER;
