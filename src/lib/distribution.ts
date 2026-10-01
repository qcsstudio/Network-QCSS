import { getAdvisoryOperationsSummary } from "@/lib/advisories";
import { editorialContentAgentConfiguration } from "@/lib/editorial-content-agents";
import { getEditorialImageSummary } from "@/lib/editorial-image-generation";
import { getLinkedInStatus } from "@/lib/linkedin";
import { getSocialPublicationSummary } from "@/lib/social-publications";
import { getMetaDistributionSummary } from "@/lib/meta-publications";

export async function getDistributionSnapshot() {
  const [linkedin, social, advisories, editorialImages, meta] = await Promise.all([
    getLinkedInStatus(),
    getSocialPublicationSummary(),
    getAdvisoryOperationsSummary(),
    getEditorialImageSummary(),
    getMetaDistributionSummary()
  ]);

  return { linkedin, social, advisories, editorialImages, meta, editorialContent: editorialContentAgentConfiguration() };
}

export type DistributionSnapshot = Awaited<ReturnType<typeof getDistributionSnapshot>>;
