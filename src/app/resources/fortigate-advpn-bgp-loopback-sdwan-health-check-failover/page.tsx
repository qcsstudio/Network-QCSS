import { TechnicalCaseStudy, caseStudyMetadata } from "@/components/technical-case-study";
import diagnostics from "@/content/website-only/fortigate-advpn-diagnostics.json";
import { fortigateAdvpnCaseStudy as post } from "@/lib/website-only-resources";

export const dynamic = "error";
export const metadata = caseStudyMetadata(post);

export default function FortigateAdvpnCaseStudyPage() {
  return <TechnicalCaseStudy post={post} diagram={{
    section: "Recommended implementation: separate probe and peer roles carefully",
    path: "/images/editorial/fortigate-advpn-roles",
    alt: "Before, BGP and the health probe share destination P. After, BGP keeps P and the health probe uses a separate reachable destination H on one logical hub.",
    caption: "Teaching diagram of destination roles, not customer topology. The second hub and overlay paths are omitted. Probe routes may remain after failure; verify BGP egress and the application separately."
  }} diagnostics={{ ...diagnostics, section: "Observational commands: collect state without forcing a failover" }} />;
}
