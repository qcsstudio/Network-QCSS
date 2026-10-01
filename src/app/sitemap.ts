import type { MetadataRoute } from "next";
import { unstable_cache } from "next/cache";
import { services, siteConfig, solutionPages, tools } from "@/lib/content";
import { getAllPublishedBlogPosts } from "@/lib/content-posts";
import { networkUtilityTools } from "@/lib/network-tools";
import { getPublicAdvisoryIndex } from "@/lib/public-advisory-index";
import { readyAdvisoryImages } from "@/lib/advisory-image-availability";
import { getPrismaClient } from "@/lib/prisma";
import { escapeSitemapUrl } from "@/lib/sitemap-policy";

export const dynamic = "force-dynamic";

const publishedEntries = unstable_cache(async () => {
  const [blogPosts, advisories, ccnaLessons] = await Promise.all([
    getAllPublishedBlogPosts({ strict: true }),
    getPublicAdvisoryIndex(),
    process.env.DATABASE_URL ? getPrismaClient().ccnaLesson.findMany({
      where: { status: "published" }, select: { slug: true, updatedAt: true }, orderBy: { sequence: "asc" }
    }) : Promise.resolve([])
  ]);
  const images = await readyAdvisoryImages(advisories);
  // A failed refresh must not replace the complete inventory with an empty subset.
  return {
    blogs: blogPosts.map((post) => ({ slug: post.slug, updatedAt: post.updatedAt })),
    advisories: advisories.map((item) => ({
      slug: item.slug, priorityScore: item.priorityScore,
      modifiedAt: (item.revisions[0]?.createdAt || item.createdAt).toISOString(),
      image: images.get(item.id)?.url
    })),
    lessons: ccnaLessons.map((item) => ({ slug: item.slug, updatedAt: item.updatedAt.toISOString() }))
  };
}, ["public-sitemap-inventory-v2"], { revalidate: 300 });

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const { blogs: blogPosts, advisories, lessons: ccnaLessons } = await publishedEntries();
  const staticRoutes = [
    { path: "", priority: 1, changeFrequency: "weekly" as const },
    { path: "/solutions", priority: 0.92, changeFrequency: "weekly" as const },
    { path: "/diagnose", priority: 0.96, changeFrequency: "weekly" as const },
    { path: "/institute", priority: 0.88, changeFrequency: "weekly" as const },
    { path: "/courses/ccna", priority: 0.95, changeFrequency: "daily" as const },
    { path: "/courses/ccna/start-here", priority: 0.86, changeFrequency: "monthly" as const },
    { path: "/resources", priority: 0.84, changeFrequency: "weekly" as const },
    { path: "/intelligence", priority: 0.94, changeFrequency: "daily" as const },
    { path: "/security-advisories", priority: 0.96, changeFrequency: "hourly" as const },
    { path: "/network-tools", priority: 0.94, changeFrequency: "weekly" as const },
    { path: "/privacy", priority: 0.3, changeFrequency: "yearly" as const }
  ].map((route) => ({
    url: `${siteConfig.url}${route.path}`,
    changeFrequency: route.changeFrequency,
    priority: route.priority
  }));

  const serviceRoutes = services.map((service) => ({
    url: `${siteConfig.url}/services/${service.slug}`,
    changeFrequency: "monthly" as const,
    priority: 0.86
  }));

  const toolRoutes = tools.map((tool) => ({
    url: `${siteConfig.url}/tools/${tool.slug}`,
    changeFrequency: "monthly" as const,
    priority: 0.82
  }));

  const solutionRoutes = solutionPages.map((solution) => ({
    url: `${siteConfig.url}/solutions/${solution.slug}`,
    changeFrequency: "monthly" as const,
    priority: 0.9
  }));

  const networkToolRoutes = networkUtilityTools.map((tool) => ({
    url: `${siteConfig.url}/network-tools/${tool.slug}`,
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
    lastModified: new Date(advisory.modifiedAt),
    images: advisory.image ? [escapeSitemapUrl(`${siteConfig.url}${advisory.image}`)] : undefined,
    changeFrequency: "daily" as const,
    priority: advisory.priorityScore >= 85 ? 0.94 : 0.86
  }));

  const ccnaLessonRoutes = ccnaLessons.map((lesson) => ({
    url: `${siteConfig.url}/courses/ccna/lessons/${lesson.slug}`,
    lastModified: new Date(lesson.updatedAt),
    changeFrequency: "monthly" as const,
    priority: 0.84
  }));

  return [...staticRoutes, ...ccnaLessonRoutes, ...advisoryRoutes, ...blogRoutes, ...solutionRoutes, ...serviceRoutes, ...toolRoutes, ...networkToolRoutes];
}
