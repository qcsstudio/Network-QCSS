import article from "../content/website-only/vmware-vmsa-2026-0011.json";
import type { BlogPost } from "./blog";

export type Guide = {
  schemaVersion: number;
  externalId: string;
  vendor: string;
  slug: string;
  title: string;
  summary: string;
  severity: string;
  cvssScore: number;
  cves: readonly string[];
  products: readonly string[];
  affectedVersions: readonly string[];
  fixedVersions: readonly string[];
  exploitationStatus: string;
  mechanism: string;
  affectedConditions: string;
  remediation: string;
  workaround: string;
  verification: string;
  recovery: string;
  limitations: readonly string[];
  definitions: readonly { term: string; definition: string }[];
  sections: readonly { heading: string; body: string; bullets?: readonly string[]; sourceUrls: readonly string[] }[];
  sources: readonly { url: string; bodySha256: string }[];
};

// Presentation data only. This is not an advisory-registry record or publication job.
export const vmwareGuide: Guide = article;
export const vmwareGuidePath = "/resources/vmware-vmsa-2026-0011-patching-guide";
export const vmwareGuideContentSha256 = "2560ff42166e526a47ecb41a50bc179d878d5b74b96908e50f9264e513e0ff70";
export const vmwareDiagram = {
  src: "/images/editorial/vmware-vmsa-2026-0011-diagram.png",
  width: 1080, height: 1440,
  alt: "Separate vCenter, ESX, desktop hypervisor, guest Tools and Avi patch lanes, with ESX 9.0's two pending CVEs kept open and separate build, activation and application checks."
};
export const vmwareCardImage = {
  src: "/images/editorial/vmware-vmsa-2026-0011-linkedin.png",
  width: 1200, height: 1200,
  alt: "VMware VMSA-2026-0011 guidance: one advisory, 23 CVEs and separate component patch lanes."
};
export const vmwareSourceLabels = [
  "Broadcom VMSA-2026-0011 and response matrices",
  "KB463535: interim ESXi 8.x I/O-filter workaround",
  "KB463501: Telco component patch guidance",
  "VMware VMSA-2026-0011 questions and answers",
  "CISA Known Exploited Vulnerabilities catalog"
];

// Calendar date only, not a claimed precise publication time. Re-review if release slips.
export const vmwareResource: BlogPost = {
    contentVersion: 3, contentType: "resource", slug: article.slug,
    title: article.title, metaTitle: article.title, description: article.summary,
    excerpt: "Map 23 CVEs to the correct VMware component and branch, preserve ESX 9.0 pending items, and verify activation and application health separately.",
    answer: article.summary, category: "Virtualization Security",
    audience: "Virtualization administrators, platform owners and security teams",
    primaryKeyword: "VMware VMSA-2026-0011 patching guide",
    keywords: ["VMSA-2026-0011", "VMware security advisory", "ESX patching", "vCenter", "VMware Tools", "Avi Load Balancer"],
    publishedAt: "2026-11-25", updatedAt: "2026-11-25", readTime: "12 min read",
    image: vmwareCardImage.src, imageAlt: vmwareCardImage.alt,
    relatedTools: [], relatedServices: [], takeaways: [article.summary], checklist: [], questions: [],
    sections: article.sections.map(section => ({ ...section })),
    sources: article.sources.map((source, i) => ({ label: vmwareSourceLabels[i], url: source.url }))
};

export function withVmwareResource(posts: BlogPost[]): BlogPost[] {
  const prior = posts.find(post => post.slug === vmwareResource.slug);
  if (prior && prior !== vmwareResource) {
    throw new Error("The VMware resource slug already has a different entry; existing content was not replaced.");
  }
  return prior ? [...posts] : [...posts, vmwareResource].sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
}
