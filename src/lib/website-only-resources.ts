import type { BlogPost } from "./blog.ts";
import fortinet from "../content/website-only/fortinet-october-2026-hardening.json";
import ztna from "../content/website-only/fortigate-ztna-case-study.json";
import loop from "../content/website-only/fortigate-layer2-loop-case-study.json";
import overlap from "../content/website-only/fortigate-subnet-overlap-case-study.json";
import reboot from "../content/website-only/fortigate-automation-reboot-case-study.json";
import manager from "../content/website-only/fortimanager-install-verification-case-study.json";
import advpn from "../content/website-only/fortigate-advpn-failover-case-study.json";

// Presentation-only inventory. Never seed these records into editorial/social jobs:
// their social publication is already owned by separately recorded native posts.
export const fortinetHardeningGuide: BlogPost = {
  ...fortinet,
  contentVersion: 3,
  contentType: "resource",
  storySpine: {
    ...fortinet.storySpine,
    visualSequence: [
      fortinet.storySpine.visualSequence[0],
      fortinet.storySpine.visualSequence[1],
      fortinet.storySpine.visualSequence[2]
    ]
  }
};

export const fortigateZtnaCaseStudy: BlogPost = {
  ...ztna,
  contentVersion: 3,
  contentType: "blog",
  storySpine: {
    ...ztna.storySpine,
    visualSequence: [ztna.storySpine.visualSequence[0], ztna.storySpine.visualSequence[1], ztna.storySpine.visualSequence[2]]
  }
};

export const fortigateLayer2LoopCaseStudy: BlogPost = {
  ...loop,
  contentVersion: 3,
  contentType: "blog",
  storySpine: {
    ...loop.storySpine,
    visualSequence: [loop.storySpine.visualSequence[0], loop.storySpine.visualSequence[1], loop.storySpine.visualSequence[2]]
  }
};

export const fortigateSubnetOverlapCaseStudy: BlogPost = {
  ...overlap,
  contentVersion: 3,
  contentType: "blog",
  storySpine: {
    ...overlap.storySpine,
    visualSequence: [overlap.storySpine.visualSequence[0], overlap.storySpine.visualSequence[1], overlap.storySpine.visualSequence[2]]
  }
};

export const fortigateAutomationRebootCaseStudy: BlogPost = {
  ...reboot,
  contentVersion: 3,
  contentType: "blog",
  storySpine: {
    ...reboot.storySpine,
    visualSequence: [reboot.storySpine.visualSequence[0], reboot.storySpine.visualSequence[1], reboot.storySpine.visualSequence[2]]
  }
};

export const fortimanagerInstallCaseStudy: BlogPost = {
  ...manager, contentVersion: 3, contentType: "blog",
  storySpine: { ...manager.storySpine, visualSequence: [manager.storySpine.visualSequence[0], manager.storySpine.visualSequence[1], manager.storySpine.visualSequence[2]] }
};

export const fortigateAdvpnCaseStudy: BlogPost = {
  ...advpn, contentVersion: 3, contentType: "blog",
  storySpine: { ...advpn.storySpine, visualSequence: [advpn.storySpine.visualSequence[0], advpn.storySpine.visualSequence[1], advpn.storySpine.visualSequence[2]] }
};

export const websiteOnlyResources: BlogPost[] = [fortinetHardeningGuide, fortigateZtnaCaseStudy, fortigateLayer2LoopCaseStudy, fortigateSubnetOverlapCaseStudy, fortigateAutomationRebootCaseStudy, fortimanagerInstallCaseStudy, fortigateAdvpnCaseStudy];

export function withWebsiteOnlyResources(posts: BlogPost[]): BlogPost[] {
  const entries = new Map(posts.map((post) => [post.slug, post]));
  for (const post of websiteOnlyResources) entries.set(post.slug, post);
  return [...entries.values()].sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
}

export function resourceCardImage(post: BlogPost): string {
  return websiteOnlyResources.find((item) => item.slug === post.slug)?.image || `/resources/${post.slug}/visual`;
}
