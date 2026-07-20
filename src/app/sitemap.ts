import type { MetadataRoute } from "next";
import { services, siteConfig, solutionPages, tools } from "@/lib/content";
import { getAllPublishedBlogPosts } from "@/lib/content-posts";
import { networkUtilityTools } from "@/lib/network-tools";
import { listSecurityAdvisories } from "@/lib/advisories";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const [blogPosts, advisories] = await Promise.all([getAllPublishedBlogPosts(), listSecurityAdvisories(250)]);
  const staticRoutes = [
    { path: "", priority: 1, changeFrequency: "weekly" as const },
    { path: "/solutions", priority: 0.92, changeFrequency: "weekly" as const },
    { path: "/diagnose", priority: 0.96, changeFrequency: "weekly" as const },
    { path: "/institute", priority: 0.88, changeFrequency: "weekly" as const },
    { path: "/resources", priority: 0.84, changeFrequency: "weekly" as const },
    { path: "/intelligence", priority: 0.94, changeFrequency: "daily" as const },
    { path: "/security-advisories", priority: 0.96, changeFrequency: "hourly" as const },
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

  const blogRoutes = blogPosts.map((post) => ({
    url: `${siteConfig.url}/resources/${post.slug}`,
    lastModified: new Date(post.updatedAt),
    changeFrequency: "monthly" as const,
    priority: 0.82
  }));

  const advisoryRoutes = advisories.map((advisory) => ({
    url: `${siteConfig.url}/security-advisories/${advisory.slug}`,
    lastModified: advisory.vendorUpdatedAt,
    changeFrequency: "daily" as const,
    priority: advisory.priorityScore >= 85 ? 0.94 : 0.86
  }));

  return [...staticRoutes, ...advisoryRoutes, ...blogRoutes, ...solutionRoutes, ...serviceRoutes, ...toolRoutes, ...networkToolRoutes];
}
