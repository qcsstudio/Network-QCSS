import { getAdvisoryOperationsSummary } from "@/lib/advisories";
import { getEditorialApprovalSummary } from "@/lib/editorial-approvals";
import { getLinkedInStatus } from "@/lib/linkedin";
import { getSocialPublicationSummary } from "@/lib/social-publications";

export async function getDistributionSnapshot() {
  const [linkedin, social, advisories, approvals] = await Promise.all([
    getLinkedInStatus(),
    getSocialPublicationSummary(),
    getAdvisoryOperationsSummary(),
    getEditorialApprovalSummary()
  ]);

  return { linkedin, social, advisories, approvals };
}

export type DistributionSnapshot = Awaited<ReturnType<typeof getDistributionSnapshot>>;
