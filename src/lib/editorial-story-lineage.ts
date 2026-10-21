import crypto from "node:crypto";
import { normalizeStorySpine, type EditorialStorySpine } from "./editorial-story-spine.ts";

// Node-only receipts; browser readiness imports the pure story module directly.
export {
  alignEditorialVisualStory,
  buildStorySpineContext,
  isEditorialStorySpine,
  normalizeStorySpine,
  storySpineForAdvisory,
  storySpineForArticle,
  storySpineQualityIssues
} from "./editorial-story-spine.ts";
export type { EditorialStorySpine, EditorialVisualBrief } from "./editorial-story-spine.ts";

export type EditorialLineage = {
  policyVersion: 1;
  hash: string;
  contentType: "ccna_lesson" | "content_post" | "security_advisory";
  contentId: string;
  contentRevision: string;
  storySpine: EditorialStorySpine;
  stages: [
    "source_evidence",
    "approved_revision",
    "visual_storyboard",
    "article_image",
    "linkedin_derivative"
  ];
};

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

export function createEditorialLineage(input: {
  contentType: EditorialLineage["contentType"];
  contentId: string;
  contentRevision: string;
  storySpine: EditorialStorySpine;
}): EditorialLineage {
  const storySpine = normalizeStorySpine(input.storySpine);
  const hash = crypto
    .createHash("sha256")
    .update(JSON.stringify({ ...input, storySpine, policyVersion: 1 }))
    .digest("hex");
  return {
    policyVersion: 1,
    hash,
    contentType: input.contentType,
    contentId: input.contentId,
    contentRevision: input.contentRevision,
    storySpine,
    stages: ["source_evidence", "approved_revision", "visual_storyboard", "article_image", "linkedin_derivative"]
  };
}

export function lineageFromMetadata(value: unknown) {
  const metadata = record(value);
  const lineage = record(metadata?.lineage);
  return lineage && typeof lineage.hash === "string" && lineage.policyVersion === 1 ? lineage : null;
}
