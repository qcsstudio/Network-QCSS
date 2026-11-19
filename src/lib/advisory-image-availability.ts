import { getPrismaClient } from "./prisma.ts";
import { staticEditorialEntry, staticMediaImageIds } from "./editorial-static-media.ts";
import {getAutomatedReleases,automatedCandidateHash,automatedAssetUrl} from './automated-advisory-domain.ts';

type AdvisoryIdentity = { id: string; status?: string; updatedAt: Date; revisions: { version: number }[] };

export async function readyAdvisoryImages(advisories: AdvisoryIdentity[]) {
  const result = new Map<string, { url: string; altText: string }>();
  if (!advisories.length) return result;
  const releases=getAutomatedReleases();
  if(releases.length){
    const owned=await getPrismaClient().securityAdvisory.findMany({where:{id:{in:advisories.map(a=>a.id)},status:'published',deletedAt:null,slug:{in:releases.map(r=>r.slug)},contentHash:{in:releases.map(automatedCandidateHash)}},select:{id:true,slug:true,contentHash:true,editorialTrace:true}});
    for(const row of owned){
      const trace=row.editorialTrace&&typeof row.editorialTrace==='object'&&!Array.isArray(row.editorialTrace)?row.editorialTrace:{},value=trace.automatedAdvisory;
      const marker=value&&typeof value==='object'&&!Array.isArray(value)?value:{};
      const release=releases.find(r=>r.slug===row.slug&&automatedCandidateHash(r)===row.contentHash&&marker.releaseId===r.releaseId&&marker.candidateSha256===row.contentHash),asset=release?.assets.find(a=>a.key==='diagram');
      if(asset)result.set(row.id,{url:automatedAssetUrl(asset),altText:asset.alt});
    }
  }
  const assets = await getPrismaClient().editorialImage.findMany({
    where: { contentType: "security_advisory", contentId: { in: advisories.map((item) => item.id) }, status: "ready",
      OR: [{ heroImage: { not: null } }, { id: { in: staticMediaImageIds } }], generatedAt: { not: null } },
    select: { id: true, contentType: true, contentId: true, contentRevision: true, altText: true, generatedAt: true }
  });
  for (const item of advisories) {
    if(result.has(item.id))continue;
    if (item.status && item.status !== "published") continue;
    const revision = String(item.revisions[0]?.version || item.updatedAt.toISOString());
    const asset = assets.find((image) => image.contentId === item.id && image.contentRevision === revision);
    // A migrated ID alone is insufficient after a revision or generation change.
    if (asset && staticMediaImageIds.includes(asset.id) && !staticEditorialEntry(asset, "hero")) continue;
    if (asset?.generatedAt) result.set(item.id, {
      url: `/api/editorial-media/${asset.id}?variant=hero&v=${encodeURIComponent(asset.generatedAt.toISOString())}`,
      altText: asset.altText
    });
  }
  return result;
}
