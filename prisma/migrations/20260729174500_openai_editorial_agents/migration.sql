ALTER TABLE "EditorialImage"
ADD COLUMN "provider" TEXT,
ADD COLUMN "agentTrace" JSONB,
ADD COLUMN "qaScore" INTEGER;
