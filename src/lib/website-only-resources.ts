import type { BlogPost } from "./blog.ts";
import fortinet from "../content/website-only/fortinet-october-2026-hardening.json";

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

export const websiteOnlyResources: BlogPost[] = [fortinetHardeningGuide];

export function withWebsiteOnlyResources(posts: BlogPost[]): BlogPost[] {
  const entries = new Map(posts.map((post) => [post.slug, post]));
  for (const post of websiteOnlyResources) entries.set(post.slug, post);
  return [...entries.values()].sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
}

export function resourceCardImage(post: BlogPost): string {
  return websiteOnlyResources.find((item) => item.slug === post.slug)?.image || `/resources/${post.slug}/visual`;
}
