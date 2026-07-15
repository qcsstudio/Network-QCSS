import type { MetadataRoute } from "next";
import { services, siteConfig, tools } from "@/lib/content";
import { networkUtilityTools } from "@/lib/network-tools";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const staticRoutes = ["", "/institute", "/resources", "/network-tools", "/privacy"].map((path) => ({
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

  const networkToolRoutes = networkUtilityTools.map((tool) => ({
    url: `${siteConfig.url}/network-tools/${tool.slug}`,
    lastModified: now
  }));

  return [...staticRoutes, ...serviceRoutes, ...toolRoutes, ...networkToolRoutes];
}
