import { getPrismaClient } from "./prisma.ts";

export async function publishedRevision(contentType: string, contentId: string) {
  const prisma = getPrismaClient();
  if (contentType === "content_post") {
    const source = await prisma.contentPost.findUnique({ where: { id: contentId }, include: { revisions: { orderBy: { version: "desc" }, take: 1 } } });
    if (!source || source.status !== "published") return null;
    return { slug: source.slug, revision: String(source.revisions[0]?.version || source.updatedAt.toISOString()), path: `/resources/${source.slug}` };
  }
  if (contentType === "security_advisory") {
    const source = await prisma.securityAdvisory.findUnique({ where: { id: contentId }, include: { revisions: { orderBy: { version: "desc" }, take: 1 } } });
    if (!source || source.status !== "published" || source.deletedAt) return null;
    return { slug: source.slug, revision: String(source.revisions[0]?.version || source.updatedAt.toISOString()), path: `/security-advisories/${source.slug}` };
  }
  return null;
}

export function editorialDeliveryImageUrl(origin: string, asset: { id: string; generatedAt: Date | null }, variant: "hero" | "social") {
  if (!asset.generatedAt) throw new Error("The reviewed image is not ready.");
  const url = new URL(`/api/editorial-media/${encodeURIComponent(asset.id)}`, origin);
  url.searchParams.set("variant", variant);
  url.searchParams.set("v", asset.generatedAt.toISOString());
  return url.toString();
}
