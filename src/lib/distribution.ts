import { getAdvisoryOperationsSummary } from "@/lib/advisories";
import { getEditorialImageSummary } from "@/lib/editorial-image-generation";
import { getLinkedInStatus } from "@/lib/linkedin";
import { getSocialPublicationSummary } from "@/lib/social-publications";

export async function getDistributionSnapshot() {
  const [linkedin, social, advisories, editorialImages] = await Promise.all([
    getLinkedInStatus(),
    getSocialPublicationSummary(),
    getAdvisoryOperationsSummary(),
    getEditorialImageSummary()
  ]);

  return { linkedin, social, advisories, editorialImages };
}

export type DistributionSnapshot = Awaited<ReturnType<typeof getDistributionSnapshot>>;
