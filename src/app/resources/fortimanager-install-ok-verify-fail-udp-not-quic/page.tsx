import { TechnicalCaseStudy, caseStudyMetadata } from "@/components/technical-case-study";
import { fortimanagerInstallCaseStudy as post } from "@/lib/website-only-resources";

export const dynamic = "error";
export const metadata = caseStudyMetadata(post);

export default function FortimanagerInstallCaseStudyPage() {
  return <TechnicalCaseStudy post={post} diagram={{
    section: "Technical mechanism: different configuration layers need different evidence",
    path: "/images/editorial/fortimanager-install-flow",
    alt: "Compare manager intent, generated per-device configuration and actual device acceptance and readback before validating service behavior.",
    caption: "Conceptual evidence sequence, not a live execution trace. An installation preview does not prove model-specific command acceptance."
  }} />;
}
