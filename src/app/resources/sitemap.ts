import type { MetadataRoute } from "next";
import { siteConfig } from "@/lib/content";
import { websiteOnlyResources } from "@/lib/website-only-resources";

export const dynamic = "error";

// Its /resources/ location covers every article URL; keep the main sitemap intact.
export default function sitemap(): MetadataRoute.Sitemap {
  return websiteOnlyResources.map((post) => ({
    url: `${siteConfig.url}/resources/${post.slug}`,
    lastModified: post.updatedAt,
    images: [`${siteConfig.url}${post.image}`]
  }));
}
