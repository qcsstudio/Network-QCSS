import { getPrismaClient } from "./prisma.ts";
import { ensureEditorialImageForPublication } from "./editorial-image-generation.ts";
import { advisoryRenderNeedsManualRetry } from "./advisory-image-policy.ts";
import { shouldDeferEditorialImageGeneration } from "./editorial-image-state.ts";

export async function discoverEditorialImageJobs() {
  const prisma = getPrismaClient();
  const posts = await prisma.contentPost.findMany({ where: { status: "published" }, select: { id: true, updatedAt: true, revisions: { orderBy: { version: "desc" }, take: 1, select: { version: true } } } });
  const advisories = await prisma.securityAdvisory.findMany({ where: { status: "published", deletedAt: null }, select: { id: true, priorityScore: true, vendorPublishedAt: true, updatedAt: true, revisions: { orderBy: { version: "desc" }, take: 1, select: { version: true } } } });
  const jobs = [
    ...posts.map((post) => ({ contentType: "content_post" as const, contentId: post.id, contentRevision: String(post.revisions[0]?.version || post.updatedAt.toISOString()), priority: 85, date: post.updatedAt.getTime() })),
    ...advisories.map((item) => ({ contentType: "security_advisory" as const, contentId: item.id, contentRevision: String(item.revisions[0]?.version || item.updatedAt.toISOString()), priority: item.priorityScore, date: item.vendorPublishedAt.getTime() }))
  ].sort((a, b) => b.priority - a.priority || b.date - a.date || a.contentId.localeCompare(b.contentId));
  if (jobs.length) await prisma.editorialImage.createMany({
    data: jobs.map(({ contentType, contentId, contentRevision }) => ({ contentType, contentId, contentRevision, prompt: "", promptHash: "", altText: "", status: "pending" })),
    skipDuplicates: true
  });
  return jobs;
}

export async function processEditorialImageQueue(onlyContentId = "") {
  const jobs = await discoverEditorialImageJobs();
  const assets = await getPrismaClient().editorialImage.findMany({
    where: { contentId: { in: jobs.map((job) => job.contentId) } },
    select: { contentId: true, contentType: true, contentRevision: true, status: true, lastError: true, updatedAt: true, agentTrace: true }
  });
  for (const job of jobs) {
    if (onlyContentId && job.contentId !== onlyContentId) continue;
    const asset = assets.find((item) => item.contentType === job.contentType && item.contentId === job.contentId && item.contentRevision === job.contentRevision);
    if (!asset || asset.status === "ready") continue;
    const trace = asset.agentTrace && typeof asset.agentTrace === "object" && !Array.isArray(asset.agentTrace) ? asset.agentTrace : {};
    if (advisoryRenderNeedsManualRetry({ contentType: job.contentType, status: asset.status, renderAttempts: trace.renderAttempts, force: false, promptChanged: false })) continue;
    if (shouldDeferEditorialImageGeneration({ status: asset.status, ageMs: Date.now() - asset.updatedAt.getTime(), lastError: asset.lastError, force: false, promptChanged: false })) continue;
    try {
      const generated = await ensureEditorialImageForPublication(job);
      return { contentId: job.contentId, status: generated?.status || "deferred", discovered: jobs.length };
    } catch {
      await getPrismaClient().editorialImage.updateMany({
        where: { contentType: job.contentType, contentId: job.contentId, contentRevision: job.contentRevision, status: "pending" },
        data: { status: "failed", lastError: "Unable to prepare this revision. Review its saved article and image job before retrying." }
      });
      return { contentId: job.contentId, status: "failed", discovered: jobs.length };
    }
  }
  return { status: "idle", discovered: jobs.length };
}
