import type { Prisma, SecurityAdvisory } from "@prisma/client";
import type { ContentPostRecord } from "@/lib/content-posts";
import { siteConfig } from "@/lib/content";
import { ensureEditorialImageForPublication } from "@/lib/editorial-image-generation";
import { composeAdvisoryLinkedInPost, composeEditorialLinkedInPost } from "@/lib/linkedin-commentary";
import { deleteLinkedInPost, publishLinkedInPost, updateLinkedInPostCommentary } from "@/lib/linkedin";
import { getPrismaClient } from "@/lib/prisma";
import { editorialImageWaitMessage, socialPublicationFailurePolicy } from "@/lib/social-publication-state";

function trackedUrl(path: string, campaign: string, content: string) {
  const url = new URL(path, siteConfig.url);
  url.searchParams.set("utm_source", "linkedin");
  url.searchParams.set("utm_medium", "organic-social");
  url.searchParams.set("utm_campaign", campaign);
  url.searchParams.set("utm_content", content);
  return url.toString();
}

type EditorialPostRecord = Pick<ContentPostRecord, "content" | "slug" | "title">;

export function buildEditorialLinkedInCommentary(post: EditorialPostRecord) {
  const url = trackedUrl(`/resources/${post.slug}`, "weekly-intelligence", post.slug);
  return composeEditorialLinkedInPost(post, url);
}

function jsonStrings(value: Prisma.JsonValue) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

export function buildAdvisoryLinkedInCommentary(advisory: SecurityAdvisory) {
  const url = trackedUrl(`/security-advisories/${advisory.slug}`, "security-advisory-desk", advisory.slug);
  return composeAdvisoryLinkedInPost(
    {
      cves: jsonStrings(advisory.cves),
      products: jsonStrings(advisory.products),
      remediation: advisory.remediation,
      severity: advisory.severity,
      summary: advisory.summary,
      title: advisory.title,
      vendor: advisory.vendor
    },
    url
  );
}

async function enqueue(input: {
  contentType: "content_post" | "security_advisory";
  contentId: string;
  contentRevision: string;
  sourceUrl: string;
  commentary: string;
  imageUrl: string;
  imageAlt: string;
}) {
  const prisma = getPrismaClient();
  const key = {
    channel: "linkedin",
    contentType: input.contentType,
    contentId: input.contentId,
    contentRevision: input.contentRevision
  };
  const existing = await prisma.socialPublication.findUnique({
    where: { channel_contentType_contentId_contentRevision: key }
  });
  if (existing?.status === "published" || existing?.status === "publishing") return existing;
  if (existing) {
    return prisma.socialPublication.update({
      where: { id: existing.id },
      data: {
        commentary: input.commentary,
        imageUrl: input.imageUrl,
        metadata: { imageAlt: input.imageAlt },
        sourceUrl: input.sourceUrl
      }
    });
  }
  return prisma.socialPublication.create({
    data: {
      channel: "linkedin",
      contentType: input.contentType,
      contentId: input.contentId,
      contentRevision: input.contentRevision,
      sourceUrl: input.sourceUrl,
      commentary: input.commentary,
      imageUrl: input.imageUrl,
      metadata: { imageAlt: input.imageAlt }
    }
  });
}

export async function queueLinkedInForContentPost(post: ContentPostRecord) {
  const revision = String(post.revisions[0]?.version || post.updatedAt);
  return enqueue({
    contentType: "content_post",
    contentId: post.id,
    contentRevision: revision,
    sourceUrl: `${siteConfig.url}/resources/${post.slug}`,
    commentary: buildEditorialLinkedInCommentary(post),
    imageUrl: `${siteConfig.url}/resources/${post.slug}/opengraph-image?v=${encodeURIComponent(revision)}`,
    imageAlt: post.content.imageAlt
  });
}

export async function queueLinkedInForAdvisory(advisory: SecurityAdvisory, revision: number | string) {
  const revisionKey = String(revision);
  return enqueue({
    contentType: "security_advisory",
    contentId: advisory.id,
    contentRevision: revisionKey,
    sourceUrl: `${siteConfig.url}/security-advisories/${advisory.slug}`,
    commentary: buildAdvisoryLinkedInCommentary(advisory),
    imageUrl: `${siteConfig.url}/security-advisories/${advisory.slug}/opengraph-image?v=${encodeURIComponent(revisionKey)}`,
    imageAlt: `${advisory.severity} ${advisory.vendor} network security advisory: ${advisory.title}`
  });
}

export async function reconcileAdvisoryLinkedInQueue(limit = 50) {
  const prisma = getPrismaClient();
  const advisories = await prisma.securityAdvisory.findMany({
    where: { status: "published" },
    orderBy: { updatedAt: "desc" },
    take: Math.max(1, Math.min(limit, 100)),
    include: { revisions: { orderBy: { version: "desc" }, take: 1 } }
  });
  const existing = await prisma.socialPublication.findMany({
    where: { channel: "linkedin", contentType: "security_advisory", contentId: { in: advisories.map((advisory) => advisory.id) } },
    select: { contentId: true }
  });
  const alreadyQueued = new Set(existing.map((publication) => publication.contentId));
  let reconciled = 0;
  for (const advisory of advisories) {
    if (alreadyQueued.has(advisory.id)) continue;
    await queueLinkedInForAdvisory(advisory, advisory.revisions[0]?.version || 1);
    reconciled += 1;
  }
  return reconciled;
}

export async function resetFailedLinkedInPublications() {
  const result = await getPrismaClient().socialPublication.updateMany({
    where: { channel: "linkedin", status: "failed" },
    data: { status: "queued", attempts: 0, nextAttemptAt: new Date(), lastError: null }
  });
  return result.count;
}

export async function processLinkedInQueue(limit = 5) {
  const prisma = getPrismaClient();
  await prisma.socialPublication.updateMany({
    where: {
      channel: "linkedin",
      status: "publishing",
      lastAttemptAt: { lte: new Date(Date.now() - 15 * 60_000) }
    },
    data: {
      status: "retry",
      nextAttemptAt: new Date(),
      lastError: "Recovered after an interrupted LinkedIn publication attempt."
    }
  });
  const due = await prisma.socialPublication.findMany({
    where: { channel: "linkedin", status: { in: ["queued", "retry"] }, nextAttemptAt: { lte: new Date() } },
    orderBy: [{ nextAttemptAt: "asc" }, { createdAt: "asc" }],
    take: Math.max(1, Math.min(limit, 10))
  });
  const outcomes: Array<{ id: string; status: string; externalId?: string; error?: string }> = [];

  for (const job of due) {
    const claimed = await prisma.socialPublication.updateMany({
      where: { id: job.id, status: { in: ["queued", "retry"] } },
      data: { status: "publishing", lastAttemptAt: new Date(), attempts: { increment: 1 } }
    });
    if (!claimed.count) continue;

    try {
      const generatedImage = await ensureEditorialImageForPublication(job);
      if (!generatedImage?.generatedAt) {
        throw new Error(editorialImageWaitMessage);
      }
      if (!job.imageUrl) throw new Error("LinkedIn delivery is missing its canonical article image URL.");
      const imageUrl = (() => {
        const url = new URL(job.imageUrl);
        url.searchParams.set("asset", generatedImage.generatedAt.toISOString());
        return url.toString();
      })();
      const metadata = job.metadata && typeof job.metadata === "object" && !Array.isArray(job.metadata) ? job.metadata : {};
      const result = await publishLinkedInPost({
        commentary: job.commentary,
        imageUrl: imageUrl || undefined,
        imageAlt: typeof metadata.imageAlt === "string" ? metadata.imageAlt : undefined
      });
      await prisma.socialPublication.update({
        where: { id: job.id },
        data: {
          status: "published",
          externalId: result.externalId,
          imageUrl,
          publishedAt: new Date(),
          lastError: null,
          metadata: { ...metadata, permalink: result.permalink } as Prisma.InputJsonValue
        }
      });
      outcomes.push({ id: job.id, status: "published", externalId: result.externalId });
    } catch (error) {
      const attempts = job.attempts + 1;
      const message = error instanceof Error ? error.message.slice(0, 1800) : "Unknown LinkedIn publication error";
      const { delayMinutes, terminal } = socialPublicationFailurePolicy(attempts, message);
      await prisma.socialPublication.update({
        where: { id: job.id },
        data: {
          status: terminal ? "failed" : "retry",
          nextAttemptAt: new Date(Date.now() + delayMinutes * 60_000),
          lastError: message
        }
      });
      outcomes.push({ id: job.id, status: terminal ? "failed" : "retry", error: message });
    }
  }

  return outcomes;
}

function metadataObject(value: Prisma.JsonValue | null) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

async function currentPublicationMaterial(job: {
  contentId: string;
  contentRevision: string;
  contentType: string;
}) {
  const prisma = getPrismaClient();
  if (job.contentType === "content_post") {
    const source = await prisma.contentPost.findUnique({ where: { id: job.contentId } });
    if (!source) throw new Error("The source article no longer exists.");
    const content = source.content as unknown as ContentPostRecord["content"];
    const post = { content, slug: source.slug, title: source.title };
    return {
      commentary: buildEditorialLinkedInCommentary(post),
      imageAlt: content.imageAlt,
      imageUrl: `${siteConfig.url}/resources/${source.slug}/opengraph-image?v=${encodeURIComponent(job.contentRevision)}`,
      sourceUrl: `${siteConfig.url}/resources/${source.slug}`
    };
  }
  if (job.contentType === "security_advisory") {
    const advisory = await prisma.securityAdvisory.findUnique({ where: { id: job.contentId } });
    if (!advisory) throw new Error("The source security advisory no longer exists.");
    return {
      commentary: buildAdvisoryLinkedInCommentary(advisory),
      imageAlt: `${advisory.severity} ${advisory.vendor} network security advisory: ${advisory.title}`,
      imageUrl: `${siteConfig.url}/security-advisories/${advisory.slug}/opengraph-image?v=${encodeURIComponent(job.contentRevision)}`,
      sourceUrl: `${siteConfig.url}/security-advisories/${advisory.slug}`
    };
  }
  throw new Error(`Unsupported LinkedIn content type: ${job.contentType}`);
}

export async function refreshLinkedInPublication(publicationId: string, replaceMedia: boolean) {
  const prisma = getPrismaClient();
  const publication = await prisma.socialPublication.findUnique({ where: { id: publicationId } });
  if (!publication || publication.channel !== "linkedin") throw new Error("LinkedIn publication not found.");
  if (publication.status !== "published" || !publication.externalId) {
    throw new Error("Only a published LinkedIn post can be refreshed.");
  }

  const material = await currentPublicationMaterial(publication);
  const metadata = metadataObject(publication.metadata);
  if (!replaceMedia) {
    await updateLinkedInPostCommentary(publication.externalId, material.commentary);
    return prisma.socialPublication.update({
      where: { id: publication.id },
      data: {
        commentary: material.commentary,
        lastError: null,
        metadata: { ...metadata, commentaryRefreshedAt: new Date().toISOString() } as Prisma.InputJsonValue,
        sourceUrl: material.sourceUrl
      }
    });
  }

  const generatedImage = await ensureEditorialImageForPublication(publication, true);
  if (!generatedImage?.generatedAt) {
    throw new Error("A new contextual image could not be generated, so the existing LinkedIn post was left unchanged.");
  }
  const generatedImageUrl = new URL(material.imageUrl);
  generatedImageUrl.searchParams.set("asset", generatedImage.generatedAt.toISOString());
  material.imageUrl = generatedImageUrl.toString();

  const replacement = await publishLinkedInPost({
    commentary: material.commentary,
    imageAlt: material.imageAlt,
    imageUrl: material.imageUrl
  });
  try {
    await deleteLinkedInPost(publication.externalId);
  } catch (error) {
    await deleteLinkedInPost(replacement.externalId).catch(() => undefined);
    throw error;
  }

  const previousExternalIds = Array.isArray(metadata.previousExternalIds)
    ? metadata.previousExternalIds.filter((value): value is string => typeof value === "string")
    : [];
  return prisma.socialPublication.update({
    where: { id: publication.id },
    data: {
      commentary: material.commentary,
      externalId: replacement.externalId,
      imageUrl: material.imageUrl,
      lastError: null,
      publishedAt: new Date(),
      sourceUrl: material.sourceUrl,
      metadata: {
        ...metadata,
        imageAlt: material.imageAlt,
        mediaReplacedAt: new Date().toISOString(),
        permalink: replacement.permalink,
        previousExternalIds: [...previousExternalIds, publication.externalId]
      } as Prisma.InputJsonValue
    }
  });
}

export async function getSocialPublicationSummary() {
  const prisma = getPrismaClient();
  const [counts, latest] = await Promise.all([
    prisma.socialPublication.groupBy({ by: ["status"], _count: { _all: true }, where: { channel: "linkedin" } }),
    prisma.socialPublication.findMany({ where: { channel: "linkedin" }, orderBy: { updatedAt: "desc" }, take: 12 })
  ]);
  const contentIds = latest.filter((entry) => entry.contentType === "content_post").map((entry) => entry.contentId);
  const advisoryIds = latest.filter((entry) => entry.contentType === "security_advisory").map((entry) => entry.contentId);
  const [contentTitles, advisoryTitles] = await Promise.all([
    prisma.contentPost.findMany({ where: { id: { in: contentIds } }, select: { id: true, title: true } }),
    prisma.securityAdvisory.findMany({ where: { id: { in: advisoryIds } }, select: { id: true, title: true } })
  ]);
  const titles = new Map([...contentTitles, ...advisoryTitles].map((entry) => [entry.id, entry.title]));
  return {
    counts: Object.fromEntries(counts.map((entry) => [entry.status, entry._count._all])),
    latest: latest.map((entry) => ({
      id: entry.id,
      contentType: entry.contentType,
      title: titles.get(entry.contentId) || entry.contentType.replaceAll("_", " "),
      status: entry.status,
      sourceUrl: entry.sourceUrl,
      externalId: entry.externalId || "",
      permalink:
        entry.metadata && typeof entry.metadata === "object" && !Array.isArray(entry.metadata) && typeof entry.metadata.permalink === "string"
          ? entry.metadata.permalink
          : "",
      attempts: entry.attempts,
      lastError: entry.lastError || "",
      publishedAt: entry.publishedAt?.toISOString() || "",
      updatedAt: entry.updatedAt.toISOString()
    }))
  };
}
