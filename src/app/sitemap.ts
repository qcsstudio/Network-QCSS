import type { MetadataRoute } from "next";
import { services, siteConfig, solutionPages, tools } from "@/lib/content";
import { networkUtilityTools } from "@/lib/network-tools";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const staticRoutes = [
    { path: "", priority: 1, changeFrequency: "weekly" as const },
    { path: "/solutions", priority: 0.92, changeFrequency: "weekly" as const },
    { path: "/diagnose", priority: 0.96, changeFrequency: "weekly" as const },
    { path: "/institute", priority: 0.88, changeFrequency: "weekly" as const },
    { path: "/resources", priority: 0.84, changeFrequency: "weekly" as const },
    { path: "/network-tools", priority: 0.94, changeFrequency: "weekly" as const },
    { path: "/privacy", priority: 0.3, changeFrequency: "yearly" as const }
  ].map((route) => ({
    url: `${siteConfig.url}${route.path}`,
    lastModified: now,
    changeFrequency: route.changeFrequency,
    priority: route.priority
  }));

  const serviceRoutes = services.map((service) => ({
    url: `${siteConfig.url}/services/${service.slug}`,
    lastModified: now,
    changeFrequency: "monthly" as const,
    priority: 0.86
  }));

  const toolRoutes = tools.map((tool) => ({
    url: `${siteConfig.url}/tools/${tool.slug}`,
    lastModified: now,
    changeFrequency: "monthly" as const,
    priority: 0.82
  }));

  const solutionRoutes = solutionPages.map((solution) => ({
    url: `${siteConfig.url}/solutions/${solution.slug}`,
    lastModified: now,
    changeFrequency: "monthly" as const,
    priority: 0.9
  }));

  const networkToolRoutes = networkUtilityTools.map((tool) => ({
    url: `${siteConfig.url}/network-tools/${tool.slug}`,
    lastModified: now,
    changeFrequency: "weekly" as const,
    priority: 0.88
  }));

  return [...staticRoutes, ...solutionRoutes, ...serviceRoutes, ...toolRoutes, ...networkToolRoutes];
}
