import { getAdvisoryOperationsSummary } from "@/lib/advisories";
import { getLinkedInStatus } from "@/lib/linkedin";
import { getSocialPublicationSummary } from "@/lib/social-publications";

export async function getDistributionSnapshot() {
  const [linkedin, social, advisories] = await Promise.all([
    getLinkedInStatus(),
    getSocialPublicationSummary(),
    getAdvisoryOperationsSummary()
  ]);

  return { linkedin, social, advisories };
}

export type DistributionSnapshot = Awaited<ReturnType<typeof getDistributionSnapshot>>;
