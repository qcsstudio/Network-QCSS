import type { MetadataRoute } from "next";
import { siteConfig } from "@/lib/content";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      // These are published article images, not private API responses.
      allow: ["/", "/api/editorial-media/"],
      disallow: ["/admin", "/api"]
    },
    sitemap: `${siteConfig.url}/sitemap.xml`
  };
}
