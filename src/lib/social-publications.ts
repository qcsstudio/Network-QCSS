import crypto from "node:crypto";
import type { Prisma, SecurityAdvisory } from "@prisma/client";
import type { ContentPostRecord } from "@/lib/content-posts";
import { siteConfig } from "@/lib/content";
import { ensureEditorialImageForPublication } from "@/lib/editorial-image-generation";
import { createAdvisoryLinkedInPost, createEditorialLinkedInPost } from "@/lib/linkedin-content-agents";
import {
  advisoryLinkedInQualityIssues,
  editorialLinkedInQualityIssues,
  type LinkedInAdvisoryPost
} from "@/lib/linkedin-commentary";
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
  return createEditorialLinkedInPost(post, url);
}

function jsonStrings(value: Prisma.JsonValue) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function advisoryPost(advisory: SecurityAdvisory): LinkedInAdvisoryPost {
  return {
    affectedVersions: jsonStrings(advisory.affectedVersions),
    businessImpact: advisory.businessImpact,
    cves: jsonStrings(advisory.cves),
    cvssScore: advisory.cvssScore,
    evidenceChecklist: jsonStrings(advisory.evidenceChecklist),
    exploitationStatus: advisory.exploitationStatus,
    fixedVersions: jsonStrings(advisory.fixedVersions),
    products: jsonStrings(advisory.products),
    remediation: advisory.remediation,
    severity: advisory.severity,
    sourceUrl: advisory.sourceUrl,
    summary: advisory.summary,
    technicalExplanation: advisory.technicalExplanation,
    title: advisory.title,
    vendor: advisory.vendor,
    workaround: advisory.workaround || ""
  };
}

export function buildAdvisoryLinkedInCommentary(advisory: SecurityAdvisory) {
  const url = trackedUrl(`/security-advisories/${advisory.slug}`, "security-advisory-desk", advisory.slug);
  return createAdvisoryLinkedInPost(advisoryPost(advisory), url);
}

async function enqueue(input: {
  contentType: "content_post" | "security_advisory";
  contentId: string;
  contentRevision: string;
  sourceUrl: string;
  commentary: string;
  commentaryQualityScore: number;
  commentaryTrace: Prisma.InputJsonValue;
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
        metadata: {
          commentaryPolicyVersion: 3,
          commentaryQualityScore: input.commentaryQualityScore,
          commentaryTrace: input.commentaryTrace,
          imageAlt: input.imageAlt
        },
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
      metadata: {
        commentaryPolicyVersion: 3,
        commentaryQualityScore: input.commentaryQualityScore,
        commentaryTrace: input.commentaryTrace,
        imageAlt: input.imageAlt
      }
    }
  });
}

export async function queueLinkedInForContentPost(post: ContentPostRecord) {
  const revision = String(post.revisions[0]?.version || post.updatedAt);
  const generated = await buildEditorialLinkedInCommentary(post);
  return enqueue({
    contentType: "content_post",
    contentId: post.id,
    contentRevision: revision,
    sourceUrl: `${siteConfig.url}/resources/${post.slug}`,
    commentary: generated.commentary,
    commentaryQualityScore: generated.qualityScore,
    commentaryTrace: generated.trace as Prisma.InputJsonValue,
    imageUrl: `${siteConfig.url}/resources/${post.slug}/opengraph-image?v=${encodeURIComponent(revision)}`,
    imageAlt: post.content.imageAlt
  });
}

export async function queueLinkedInForAdvisory(advisory: SecurityAdvisory, revision: number | string) {
  const revisionKey = String(revision);
  const generated = await buildAdvisoryLinkedInCommentary(advisory);
  const commentary = generated.commentary;
  const canonicalUrl = `${siteConfig.url}/security-advisories/${advisory.slug}`;
  const qualityIssues = advisoryLinkedInQualityIssues(
    commentary,
    trackedUrl(`/security-advisories/${advisory.slug}`, "security-advisory-desk", advisory.slug),
    advisoryPost(advisory)
  );
  if (qualityIssues.length) throw new Error(`LinkedIn advisory held by publication gate: ${qualityIssues.join(" ")}`);
  return enqueue({
    contentType: "security_advisory",
    contentId: advisory.id,
    contentRevision: revisionKey,
    sourceUrl: canonicalUrl,
    commentary,
    commentaryQualityScore: generated.qualityScore,
    commentaryTrace: generated.trace as Prisma.InputJsonValue,
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
    orderBy: { createdAt: "desc" }
  });
  const publicationsByContent = new Map<string, (typeof existing)[number][]>();
  for (const publication of existing) {
    const publications = publicationsByContent.get(publication.contentId) || [];
    publications.push(publication);
    publicationsByContent.set(publication.contentId, publications);
  }
  let reconciled = 0;
  for (const advisory of advisories) {
    const revision = String(advisory.revisions[0]?.version || 1);
    const publications = publicationsByContent.get(advisory.id) || [];
    if (publications.some((publication) => publication.status === "published")) {
      const duplicateCandidates = publications.filter((publication) => publication.status !== "published");
      if (duplicateCandidates.length) {
        await prisma.socialPublication.deleteMany({
          where: { id: { in: duplicateCandidates.map((publication) => publication.id) } }
        });
      }
      continue;
    }
    const staleUnpublished = publications.filter(
      (publication) => publication.contentRevision !== revision && publication.status !== "published"
    );
    if (staleUnpublished.length) {
      await prisma.socialPublication.deleteMany({ where: { id: { in: staleUnpublished.map((publication) => publication.id) } } });
    }
    const currentPublications = publications.filter(
      (publication) => publication.contentRevision === revision || publication.status === "published"
    );
    if (currentPublications.some((publication) => publication.contentRevision === revision)) continue;
    const pendingPublication = currentPublications.find((publication) => publication.status !== "published");
    if (pendingPublication) {
      const generated = await buildAdvisoryLinkedInCommentary(advisory);
      const material = {
        commentary: generated.commentary,
        commentaryQualityScore: generated.qualityScore,
        commentaryTrace: generated.trace as Prisma.InputJsonValue,
        imageAlt: `${advisory.severity} ${advisory.vendor} network security advisory: ${advisory.title}`,
        imageUrl: `${siteConfig.url}/security-advisories/${advisory.slug}/opengraph-image?v=${encodeURIComponent(revision)}`,
        sourceUrl: `${siteConfig.url}/security-advisories/${advisory.slug}`
      };
      await prisma.socialPublication.update({
        where: { id: pendingPublication.id },
        data: {
          attempts: 0,
          commentary: material.commentary,
          contentRevision: revision,
          imageUrl: material.imageUrl,
          lastError: null,
          metadata: {
            commentaryPolicyVersion: 3,
            commentaryQualityScore: material.commentaryQualityScore,
            commentaryTrace: material.commentaryTrace,
            imageAlt: material.imageAlt
          },
          nextAttemptAt: new Date(),
          sourceUrl: material.sourceUrl,
          status: "queued"
        }
      });
      reconciled += 1;
      continue;
    }
    await queueLinkedInForAdvisory(advisory, revision);
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

export async function processLinkedInQueue(limit = 5, publicationId = "") {
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
    where: {
      channel: "linkedin",
      ...(publicationId ? { id: publicationId } : {}),
      status: { in: ["queued", "retry"] },
      nextAttemptAt: { lte: new Date() }
    },
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
      let commentary = job.commentary;
      let publicationMetadata = metadataObject(job.metadata);
      const policyVersion = Number(publicationMetadata.commentaryPolicyVersion || 0);
      const commentaryQualityScore = Number(publicationMetadata.commentaryQualityScore || 0);
      if (policyVersion < 3 || commentaryQualityScore < 88) {
        const material = await currentPublicationMaterial(job);
        commentary = material.commentary;
        publicationMetadata = {
          ...publicationMetadata,
          commentaryPolicyVersion: 3,
          commentaryQualityScore: material.commentaryQualityScore,
          commentaryTrace: material.commentaryTrace as unknown as Prisma.JsonValue,
          imageAlt: material.imageAlt
        };
        await prisma.socialPublication.update({
          where: { id: job.id },
          data: {
            commentary,
            imageUrl: material.imageUrl,
            metadata: publicationMetadata as Prisma.InputJsonValue,
            sourceUrl: material.sourceUrl
          }
        });
      }
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
      const result = await publishLinkedInPost({
        commentary,
        imageUrl: imageUrl || undefined,
        imageAlt: typeof publicationMetadata.imageAlt === "string" ? publicationMetadata.imageAlt : undefined
      });
      await prisma.socialPublication.update({
        where: { id: job.id },
        data: {
          status: "published",
          externalId: result.externalId,
          imageUrl,
          publishedAt: new Date(),
          lastError: null,
          metadata: { ...publicationMetadata, deliveryReceipt: result.receipt, permalink: result.permalink } as Prisma.InputJsonValue
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
}, commentaryOverride?: string) {
  const prisma = getPrismaClient();
  if (job.contentType === "content_post") {
    const source = await prisma.contentPost.findUnique({ where: { id: job.contentId } });
    if (!source) throw new Error("The source article no longer exists.");
    const content = source.content as unknown as ContentPostRecord["content"];
    const post = { content, slug: source.slug, title: source.title };
    const trackedArticleUrl = trackedUrl(`/resources/${source.slug}`, "weekly-intelligence", source.slug);
    const generated = commentaryOverride
      ? {
          commentary: commentaryOverride.trim(),
          qualityScore: 100,
          trace: { provider: "admin-reviewed", policyVersion: 3, generatedAt: new Date().toISOString() }
        }
      : await buildEditorialLinkedInCommentary(post);
    if (commentaryOverride) {
      const issues = editorialLinkedInQualityIssues(generated.commentary, trackedArticleUrl, post);
      if (issues.length) throw new Error(`LinkedIn editorial override held by publication gate: ${issues.join(" ")}`);
    }
    return {
      commentary: generated.commentary,
      commentaryQualityScore: generated.qualityScore,
      commentaryTrace: generated.trace as Prisma.InputJsonValue,
      imageAlt: content.imageAlt,
      imageUrl: `${siteConfig.url}/resources/${source.slug}/opengraph-image?v=${encodeURIComponent(job.contentRevision)}`,
      sourceUrl: `${siteConfig.url}/resources/${source.slug}`
    };
  }
  if (job.contentType === "security_advisory") {
    const advisory = await prisma.securityAdvisory.findUnique({ where: { id: job.contentId } });
    if (!advisory) throw new Error("The source security advisory no longer exists.");
    const trackedAdvisoryUrl = trackedUrl(`/security-advisories/${advisory.slug}`, "security-advisory-desk", advisory.slug);
    const generated = commentaryOverride
      ? {
          commentary: commentaryOverride.trim(),
          qualityScore: 100,
          trace: { provider: "admin-reviewed", policyVersion: 3, generatedAt: new Date().toISOString() }
        }
      : await buildAdvisoryLinkedInCommentary(advisory);
    if (commentaryOverride) {
      const issues = advisoryLinkedInQualityIssues(generated.commentary, trackedAdvisoryUrl, advisoryPost(advisory));
      if (issues.length) throw new Error(`LinkedIn advisory override held by publication gate: ${issues.join(" ")}`);
    }
    return {
      commentary: generated.commentary,
      commentaryQualityScore: generated.qualityScore,
      commentaryTrace: generated.trace as Prisma.InputJsonValue,
      imageAlt: `${advisory.severity} ${advisory.vendor} network security advisory: ${advisory.title}`,
      imageUrl: `${siteConfig.url}/security-advisories/${advisory.slug}/opengraph-image?v=${encodeURIComponent(job.contentRevision)}`,
      sourceUrl: `${siteConfig.url}/security-advisories/${advisory.slug}`
    };
  }
  throw new Error(`Unsupported LinkedIn content type: ${job.contentType}`);
}

export async function refreshLinkedInPublication(
  publicationId: string,
  replaceMedia: boolean,
  commentaryOverride?: string,
  forceProceduralImage = false
) {
  const prisma = getPrismaClient();
  const publication = await prisma.socialPublication.findUnique({ where: { id: publicationId } });
  if (!publication || publication.channel !== "linkedin") throw new Error("LinkedIn publication not found.");
  if (publication.status !== "published" || !publication.externalId) {
    throw new Error("Only a published LinkedIn post can be refreshed.");
  }

  const material = await currentPublicationMaterial(publication, commentaryOverride);
  const metadata = metadataObject(publication.metadata);
  if (!replaceMedia) {
    const commentary = material.commentary.slice(0, 2900);
    await updateLinkedInPostCommentary(publication.externalId, commentary);
    const previousReceipt = metadataObject((metadata.deliveryReceipt as Prisma.JsonValue | undefined) || null);
    return prisma.socialPublication.update({
      where: { id: publication.id },
      data: {
        commentary,
        lastError: null,
        metadata: {
          ...metadata,
          commentaryPolicyVersion: 3,
          commentaryQualityScore: material.commentaryQualityScore,
          commentaryTrace: material.commentaryTrace,
          commentaryRefreshedAt: new Date().toISOString(),
          deliveryReceipt: {
            ...previousReceipt,
            apiVersion: process.env.LINKEDIN_API_VERSION?.trim() || "202607",
            commentaryHash: crypto.createHash("sha256").update(commentary).digest("hex"),
            commentaryLength: commentary.length
          }
        } as Prisma.InputJsonValue,
        sourceUrl: material.sourceUrl
      }
    });
  }

  const generatedImage = await ensureEditorialImageForPublication(publication, true, {
    premiumAllowed: forceProceduralImage ? false : undefined
  });
  if (!generatedImage?.generatedAt) {
    throw new Error("The current contextual image is not ready, so the existing LinkedIn post was left unchanged.");
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
        commentaryPolicyVersion: 3,
        commentaryQualityScore: material.commentaryQualityScore,
        commentaryTrace: material.commentaryTrace,
        imageAlt: material.imageAlt,
        mediaReplacedAt: new Date().toISOString(),
        permalink: replacement.permalink,
        deliveryReceipt: replacement.receipt,
        previousExternalIds: [...previousExternalIds, publication.externalId]
      } as Prisma.InputJsonValue
    }
  });
}

export async function rebuildLinkedInPublication(publicationId: string) {
  const prisma = getPrismaClient();
  const publication = await prisma.socialPublication.findUnique({ where: { id: publicationId } });
  if (!publication || publication.channel !== "linkedin") throw new Error("LinkedIn publication not found.");

  if (publication.contentType === "security_advisory") {
    await ensureEditorialImageForPublication(publication, true);
  } else {
    await ensureEditorialImageForPublication(publication, false);
  }

  if (publication.status === "published" && publication.externalId) {
    const replaced = await refreshLinkedInPublication(publication.id, true);
    return {
      id: publication.id,
      status: "replaced",
      contentType: publication.contentType,
      commentaryLength: replaced.commentary.length,
      externalId: replaced.externalId || undefined
    };
  }

  const material = await currentPublicationMaterial(publication);
  const metadata = metadataObject(publication.metadata);
  await prisma.socialPublication.update({
    where: { id: publication.id },
    data: {
      attempts: 0,
      commentary: material.commentary,
      imageUrl: material.imageUrl,
      lastError: null,
      metadata: {
        ...metadata,
        commentaryPolicyVersion: 3,
        commentaryQualityScore: material.commentaryQualityScore,
        commentaryTrace: material.commentaryTrace,
        imageAlt: material.imageAlt,
        rebuiltAt: new Date().toISOString()
      } as Prisma.InputJsonValue,
      nextAttemptAt: new Date(),
      sourceUrl: material.sourceUrl,
      status: "queued"
    }
  });
  const [published] = await processLinkedInQueue(1, publication.id);
  return {
    id: publication.id,
    status: published?.status || "queued",
    contentType: publication.contentType,
    commentaryLength: material.commentary.length,
    externalId: published?.externalId,
    error: published?.error
  };
}

export async function rebuildLinkedInPublicationsSince(since: Date, apply = false) {
  if (Number.isNaN(since.getTime())) throw new Error("A valid LinkedIn rebuild start date is required.");
  const prisma = getPrismaClient();
  const publications = await prisma.socialPublication.findMany({
    where: {
      channel: "linkedin",
      OR: [{ publishedAt: { gte: since } }, { createdAt: { gte: since } }]
    },
    orderBy: { createdAt: "asc" },
    take: 20
  });
  const outcomes: Array<{
    id: string;
    status: string;
    contentType: string;
    commentaryLength: number;
    commentary?: string;
    externalId?: string;
  }> = [];

  for (const publication of publications) {
    if (!apply) {
      outcomes.push({
        id: publication.id,
        status: "preview",
        contentType: publication.contentType,
        commentaryLength: publication.commentary.length,
        commentary: publication.commentary,
        externalId: publication.externalId || undefined
      });
      continue;
    }

    outcomes.push(await rebuildLinkedInPublication(publication.id));
  }
  return outcomes;
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
    latest: latest.map((entry) => {
      const metadata = metadataObject(entry.metadata);
      return {
        id: entry.id,
        contentType: entry.contentType,
        title: titles.get(entry.contentId) || entry.contentType.replaceAll("_", " "),
        status: entry.status,
        sourceUrl: entry.sourceUrl,
        externalId: entry.externalId || "",
        permalink: typeof metadata.permalink === "string" ? metadata.permalink : "",
        commentaryPolicyVersion: Number(metadata.commentaryPolicyVersion || 0),
        commentaryQualityScore: Number(metadata.commentaryQualityScore || 0),
        attempts: entry.attempts,
        lastError: entry.lastError || "",
        publishedAt: entry.publishedAt?.toISOString() || "",
        updatedAt: entry.updatedAt.toISOString()
      };
    })
  };
}
