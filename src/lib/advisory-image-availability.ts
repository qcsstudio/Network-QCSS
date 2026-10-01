import { getPrismaClient } from "./prisma.ts";

type AdvisoryIdentity = { id: string; status?: string; updatedAt: Date; revisions: { version: number }[] };

export async function readyAdvisoryImages(advisories: AdvisoryIdentity[]) {
  const result = new Map<string, { url: string; altText: string }>();
  if (!advisories.length) return result;
  const assets = await getPrismaClient().editorialImage.findMany({
    where: { contentType: "security_advisory", contentId: { in: advisories.map((item) => item.id) }, status: "ready", heroImage: { not: null }, generatedAt: { not: null } },
    select: { id: true, contentId: true, contentRevision: true, altText: true, generatedAt: true }
  });
  for (const item of advisories) {
    if (item.status && item.status !== "published") continue;
    const revision = String(item.revisions[0]?.version || item.updatedAt.toISOString());
    const asset = assets.find((image) => image.contentId === item.id && image.contentRevision === revision);
    if (asset?.generatedAt) result.set(item.id, {
      url: `/api/editorial-media/${asset.id}?variant=hero&v=${encodeURIComponent(asset.generatedAt.toISOString())}`,
      altText: asset.altText
    });
  }
  return result;
}
