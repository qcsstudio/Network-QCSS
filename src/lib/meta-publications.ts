import { Prisma } from "@prisma/client";
import sharp from "sharp";
import { getPrismaClient } from "./prisma.ts";
import { siteConfig } from "./content.ts";
import { publishedRevision, editorialDeliveryImageUrl } from "./editorial-delivery.ts";
import { editorialImageInputForPublication } from "./editorial-image-generation.ts";
import { advisoryEditorialSnapshot, resolveContentPostRevision, resolveSecurityAdvisoryRevision } from "./editorial-revision-snapshots.ts";
import { lineageFromMetadata } from "./editorial-story-lineage.ts";
import { createMetaCaption } from "./meta-content-agents.ts";
import { metaCaptionPolicyVersion } from "./meta-caption-policy.ts";
import { createMetaClient, metaConfiguration, MetaPublishingError, type MetaChannel } from "./meta-publishing.ts";

function metadata(value: Prisma.JsonValue | null): Record<string, Prisma.JsonValue> {
  return value && typeof value === "object" && !Array.isArray(value) ? Object.fromEntries(Object.entries(value).filter((entry): entry is [string, Prisma.JsonValue] => entry[1] !== undefined)) : {};
}

export async function getMetaDistributionSummary() {
  const prisma = getPrismaClient();
  const latest = await prisma.socialPublication.findMany({ where: { channel: { in: ["facebook", "instagram"] } }, orderBy: { updatedAt: "desc" }, take: 20 });
  return {
    configuration: metaConfiguration(),
    latest: latest.map((job) => ({ id: job.id, channel: job.channel, status: job.status, sourceUrl: job.sourceUrl, caption: job.commentary, imageUrl: job.imageUrl, lastError: job.lastError, externalId: job.externalId, permalink: typeof metadata(job.metadata).permalink === "string" ? String(metadata(job.metadata).permalink) : "", updatedAt: job.updatedAt.toISOString() }))
  };
}

// One new article per channel per run. The explicit activation date prevents a historical posting flood.
export async function discoverMetaPublications() {
  const config = metaConfiguration();
  if (!config.configured) return [];
  const prisma = getPrismaClient();
  const created: string[] = [];
  for (const channel of ["facebook", "instagram"] as const) {
    const existing = await prisma.socialPublication.findMany({ where: { channel }, select: { contentId: true } });
    const excluded = existing.map((job) => job.contentId);
    const [post, advisory] = await Promise.all([
      prisma.contentPost.findFirst({ where: { status: "published", publishedAt: { gte: new Date(config.startAt) }, id: { notIn: excluded } }, orderBy: { publishedAt: "asc" } }),
      prisma.securityAdvisory.findFirst({ where: { status: "published", deletedAt: null, firstSeenAt: { gte: new Date(config.startAt) }, id: { notIn: excluded } }, orderBy: { firstSeenAt: "asc" } })
    ]);
    const candidates = [
      ...(post ? [{ contentType: "content_post", contentId: post.id, date: post.publishedAt! }] : []),
      ...(advisory ? [{ contentType: "security_advisory", contentId: advisory.id, date: advisory.firstSeenAt }] : [])
    ].sort((a, b) => a.date.getTime() - b.date.getTime());
    const candidate = candidates[0];
    if (!candidate) continue;
    const source = await publishedRevision(candidate.contentType, candidate.contentId);
    if (!source) continue;
    const key = { channel, contentType: candidate.contentType, contentId: candidate.contentId, contentRevision: source.revision };
    const job = await prisma.socialPublication.upsert({ where: { channel_contentType_contentId_contentRevision: key }, update: {}, create: { ...key, status: "queued", sourceUrl: `${siteConfig.url}${source.path}`, commentary: "" } });
    created.push(job.id);
  }
  return created;
}

export async function processMetaQueue(publish = false, publicationId = "") {
  const config = metaConfiguration();
  if (!config.configured) return [{ status: "not_configured", error: config.issues.join(" ") }];
  if (publish && !config.enabled) return [{ status: "disabled", error: "Meta automatic publishing is disabled. Previews can still be prepared." }];
  const prisma = getPrismaClient();
  const stale = await prisma.socialPublication.findMany({ where: { channel: { in: ["facebook", "instagram"] }, status: "publishing", lastAttemptAt: { lt: new Date(Date.now() - 15 * 60_000) } } });
  for (const job of stale) {
    const uncertain = Boolean(metadata(job.metadata).dispatchStartedAt);
    await prisma.socialPublication.updateMany({ where: { id: job.id, status: "publishing", updatedAt: job.updatedAt }, data: { status: uncertain ? "needs_review" : "retry", nextAttemptAt: new Date(), lastError: uncertain ? "Interrupted after dispatch. Verify the live account before retrying." : "Interrupted before dispatch; preparation can resume." } });
  }
  const job = await prisma.socialPublication.findFirst({
    where: { channel: { in: ["facebook", "instagram"] }, ...(publicationId ? { id: publicationId } : {}), status: { in: publish ? ["queued", "retry", "ready"] : ["queued", "retry"] }, nextAttemptAt: { lte: new Date() } },
    orderBy: [{ nextAttemptAt: "asc" }, { createdAt: "asc" }]
  });
  if (!job) return [];
  const claimed = await prisma.socialPublication.updateMany({ where: { id: job.id, status: job.status, updatedAt: job.updatedAt }, data: { status: "publishing", attempts: { increment: 1 }, lastAttemptAt: new Date() } });
  if (!claimed.count) return [];
  let meta = metadata(job.metadata);
  let dispatchStarted = false;
  let deliveryRecorded = false;
  try {
    const source = await publishedRevision(job.contentType, job.contentId);
    if (!source || source.revision !== job.contentRevision) throw new MetaPublishingError("Source is no longer published at this revision. Review it before preparing another social post.", "blocked");
    const image = await prisma.editorialImage.findUnique({ where: { contentType_contentId_contentRevision: { contentType: job.contentType, contentId: job.contentId, contentRevision: job.contentRevision } } });
    if (!image || image.status !== "ready" || !image.generatedAt || !image.heroImage || !image.socialImage || image.provider === "qcs-procedural") throw new MetaPublishingError("Awaiting a reviewed, original contextual image. No template will be posted.", "retry", 3600);
    const input = await editorialImageInputForPublication(job);
    if (lineageFromMetadata(image.agentTrace)?.hash !== input.lineage.hash) throw new MetaPublishingError("The image and article do not share the reviewed content revision.", "blocked");
    const channel = job.channel as MetaChannel;
    const bytes = channel === "instagram" ? image.heroImage : image.socialImage;
    const dimensions = await sharp(bytes).metadata();
    const ratio = (dimensions.width || 0) / (dimensions.height || 1);
    if (dimensions.format !== "jpeg" || bytes.byteLength > 8_000_000 || (channel === "instagram" && (ratio < 0.8 || ratio > 1.91 || (dimensions.width || 0) > 1440 || (dimensions.width || 0) < 320))) throw new MetaPublishingError("Image does not satisfy the channel's JPEG dimensions or file-size requirements.", "blocked");
    const sourceUrl = `${siteConfig.url}${source.path}`;
    const imageUrl = editorialDeliveryImageUrl(siteConfig.url, image, channel === "instagram" ? "hero" : "social");
    let caption = job.commentary;
    if (!caption || meta.policyVersion !== metaCaptionPolicyVersion || meta.lineageHash !== input.lineage.hash) {
      const evidence = job.contentType === "content_post"
        ? (await resolveContentPostRevision(job.contentId, job.contentRevision)).content
        : advisoryEditorialSnapshot((await resolveSecurityAdvisoryRevision(job.contentId, job.contentRevision)).advisory);
      // The visual brief is deliberately selective; captions must also see FAQs, caveats and every fixed release.
      const { editorialTrace: _trace, ...publicEvidence } = evidence as unknown as Record<string, unknown>;
      void _trace;
      const generated = await createMetaCaption(channel, JSON.stringify(publicEvidence), sourceUrl);
      caption = generated.caption;
      meta = { ...meta, policyVersion: metaCaptionPolicyVersion, trace: generated.trace, lineageHash: input.lineage.hash } as Record<string, Prisma.JsonValue>;
    }
    // A pending Instagram container belongs to one exact asset and caption.
    if (meta.imageUrl && meta.imageUrl !== imageUrl && meta.containerId) throw new MetaPublishingError("Image changed after Instagram upload. Reconcile this container before regenerating it.", "blocked");
    meta = { ...meta, imageUrl, imageAlt: image.altText };
    await prisma.socialPublication.update({ where: { id: job.id }, data: { commentary: caption, imageUrl, sourceUrl, metadata: meta as Prisma.InputJsonValue } });
    if (!publish) {
      await prisma.socialPublication.update({ where: { id: job.id }, data: { status: "ready", lastError: null } });
      return [{ id: job.id, status: "ready" }];
    }
    const client = createMetaClient();
    const accounts = await client.verifyAccounts();
    meta = { ...meta, accounts, verifiedAt: new Date().toISOString() };
    if (channel === "instagram") {
      await client.checkInstagramQuota();
      if (!meta.containerId) {
        const containerId = await client.createInstagramContainer(imageUrl, caption, image.altText);
        meta = { ...meta, containerId, containerPolls: 0 };
        await prisma.socialPublication.update({ where: { id: job.id }, data: { metadata: meta as Prisma.InputJsonValue, status: "retry", nextAttemptAt: new Date(Date.now() + 60_000), lastError: "Instagram is processing the uploaded media." } });
        return [{ id: job.id, status: "retry" }];
      }
      const result = await client.containerStatus(String(meta.containerId));
      if (result.status_code === "PUBLISHED") throw new MetaPublishingError("Instagram reports this container was published. Reconcile its live post ID; do not repost.", "needs_review");
      if (result.status_code === "IN_PROGRESS") {
        meta = { ...meta, containerPolls: Number(meta.containerPolls || 0) + 1 };
        if (Number(meta.containerPolls) >= 5) throw new MetaPublishingError("Instagram processing did not finish after five checks. Review the container.", "blocked");
        throw new MetaPublishingError("Instagram is still processing the uploaded media.", "retry", 60);
      }
      if (result.status_code !== "FINISHED") throw new MetaPublishingError(`Instagram container state: ${result.status_code}. Review before retrying.`, "blocked");
    }
    const current = await publishedRevision(job.contentType, job.contentId);
    if (!current || current.revision !== job.contentRevision) throw new MetaPublishingError("The source changed during preparation. Publication was stopped.", "blocked");
    meta = { ...meta, dispatchStartedAt: new Date().toISOString() };
    await prisma.socialPublication.update({ where: { id: job.id }, data: { metadata: meta as Prisma.InputJsonValue } });
    dispatchStarted = true;
    const receipt = channel === "facebook"
      ? await client.publishFacebook(imageUrl, caption, image.altText)
      : { externalId: await client.publishInstagram(String(meta.containerId)), permalink: "" };
    meta = { ...meta, deliveryReceipt: { externalId: receipt.externalId, acceptedAt: new Date().toISOString(), apiVersion: config.version }, permalink: receipt.permalink };
    await prisma.socialPublication.update({ where: { id: job.id }, data: { status: "published", externalId: receipt.externalId, publishedAt: new Date(), lastError: null, metadata: meta as Prisma.InputJsonValue } });
    deliveryRecorded = true;
    if (channel === "instagram") {
      const readback = await client.instagramPermalink(receipt.externalId).catch(() => null);
      if (readback?.permalink?.startsWith("https://www.instagram.com/")) await prisma.socialPublication.update({ where: { id: job.id }, data: { metadata: { ...meta, permalink: readback.permalink } as Prisma.InputJsonValue } });
    }
    return [{ id: job.id, status: "published", externalId: receipt.externalId }];
  } catch (error) {
    if (deliveryRecorded) return [{ id: job.id, status: "published", error: "Delivery receipt saved; permalink refresh is pending." }];
    const state = error instanceof MetaPublishingError ? error.state : dispatchStarted ? "needs_review" : "blocked";
    const message = error instanceof MetaPublishingError ? error.message : dispatchStarted ? "Delivery is uncertain. Inspect Business Suite before retrying." : "Caption or image preparation failed. Review provider capacity and the editorial checks before retrying.";
    const retrySeconds = error instanceof MetaPublishingError ? error.retrySeconds : 900;
    const status = state === "retry" && job.attempts >= 7 ? "blocked" : state;
    await prisma.socialPublication.update({ where: { id: job.id }, data: { status, metadata: meta as Prisma.InputJsonValue, lastError: message, nextAttemptAt: new Date(Date.now() + retrySeconds * 1000) } });
    return [{ id: job.id, status, error: message }];
  }
}
