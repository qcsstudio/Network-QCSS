import type { MetadataRoute } from "next";
import { siteConfig } from "@/lib/content";
import { websiteOnlyResources } from "@/lib/website-only-resources";
import { vmwareResource } from "@/lib/vmware-vmsa-2026-0011-resource";

export const dynamic = "error";

// Its /resources/ location covers every article URL; keep the main sitemap intact.
export default function sitemap(): MetadataRoute.Sitemap {
  return [...websiteOnlyResources, vmwareResource].map((post) => ({
    url: `${siteConfig.url}/resources/${post.slug}`,
    lastModified: post.updatedAt,
    images: [`${siteConfig.url}${post.image}`]
  }));
}
