import type { MetadataRoute } from "next";
import { services, siteConfig, tools } from "@/lib/content";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const staticRoutes = ["", "/institute", "/resources", "/privacy"].map((path) => ({
    url: `${siteConfig.url}${path}`,
    lastModified: now
  }));

  const serviceRoutes = services.map((service) => ({
    url: `${siteConfig.url}/services/${service.slug}`,
    lastModified: now
  }));

  const toolRoutes = tools.map((tool) => ({
    url: `${siteConfig.url}/tools/${tool.slug}`,
    lastModified: now
  }));

  return [...staticRoutes, ...serviceRoutes, ...toolRoutes];
}
