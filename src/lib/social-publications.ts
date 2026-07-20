import type { Prisma, SecurityAdvisory } from "@prisma/client";
import type { ContentPostRecord } from "@/lib/content-posts";
import { siteConfig } from "@/lib/content";
import { publishLinkedInPost } from "@/lib/linkedin";
import { getPrismaClient } from "@/lib/prisma";

function trackedUrl(path: string, campaign: string, content: string) {
  const url = new URL(path, siteConfig.url);
  url.searchParams.set("utm_source", "linkedin");
  url.searchParams.set("utm_medium", "organic-social");
  url.searchParams.set("utm_campaign", campaign);
  url.searchParams.set("utm_content", content);
  return url.toString();
}

export function buildEditorialLinkedInCommentary(post: ContentPostRecord) {
  const url = trackedUrl(`/resources/${post.slug}`, "weekly-intelligence", post.slug);
  const takeaways = post.content.takeaways.slice(0, 3).map((item) => `- ${item}`).join("\n");
  return [
    post.title,
    "",
    post.content.answer,
    "",
    "Practical takeaways:",
    takeaways,
    "",
    `Read the complete QCS guide: ${url}`,
    "",
    "#NetworkSecurity #NetworkEngineering #CloudNetworking #CyberSecurity"
  ].join("\n");
}

function jsonStrings(value: Prisma.JsonValue) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function advisoryCommentary(advisory: SecurityAdvisory) {
  const url = trackedUrl(`/security-advisories/${advisory.slug}`, "security-advisory-desk", advisory.slug);
  const products = jsonStrings(advisory.products).slice(0, 4).join(", ") || "See official advisory";
  const cves = jsonStrings(advisory.cves).slice(0, 4).join(", ");
  return [
    `${advisory.severity.toUpperCase()} NETWORK SECURITY ADVISORY`,
    "",
    advisory.title,
    "",
    `Vendor: ${advisory.vendor}`,
    `Affected products: ${products}`,
    ...(cves ? [`CVE: ${cves}`] : []),
    `Immediate action: ${advisory.remediation}`,
    "",
    `Source-verified QCS advisory: ${url}`,
    "",
    "#SecurityAdvisory #VulnerabilityManagement #NetworkSecurity #PatchManagement"
  ].join("\n");
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
  return getPrismaClient().socialPublication.upsert({
    where: {
      channel_contentType_contentId_contentRevision: {
        channel: "linkedin",
        contentType: input.contentType,
        contentId: input.contentId,
        contentRevision: input.contentRevision
      }
    },
    update: {},
    create: {
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
    imageUrl: `${siteConfig.url}/resources/${post.slug}/opengraph-image`,
    imageAlt: post.content.imageAlt
  });
}

export async function queueLinkedInForAdvisory(advisory: SecurityAdvisory, revision: number) {
  return enqueue({
    contentType: "security_advisory",
    contentId: advisory.id,
    contentRevision: String(revision),
    sourceUrl: `${siteConfig.url}/security-advisories/${advisory.slug}`,
    commentary: advisoryCommentary(advisory),
    imageUrl: `${siteConfig.url}/security-advisories/${advisory.slug}/opengraph-image`,
    imageAlt: `${advisory.severity} ${advisory.vendor} network security advisory: ${advisory.title}`
  });
}

export async function reconcileAdvisoryLinkedInQueue(limit = 50) {
  const advisories = await getPrismaClient().securityAdvisory.findMany({
    where: { status: "published" },
    orderBy: { updatedAt: "desc" },
    take: Math.max(1, Math.min(limit, 100)),
    include: { revisions: { orderBy: { version: "desc" }, take: 1 } }
  });
  let reconciled = 0;
  for (const advisory of advisories) {
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
      const metadata = job.metadata && typeof job.metadata === "object" && !Array.isArray(job.metadata) ? job.metadata : {};
      const result = await publishLinkedInPost({
        commentary: job.commentary,
        imageUrl: job.imageUrl || undefined,
        imageAlt: typeof metadata.imageAlt === "string" ? metadata.imageAlt : undefined
      });
      await prisma.socialPublication.update({
        where: { id: job.id },
        data: {
          status: "published",
          externalId: result.externalId,
          publishedAt: new Date(),
          lastError: null,
          metadata: { ...metadata, permalink: result.permalink } as Prisma.InputJsonValue
        }
      });
      outcomes.push({ id: job.id, status: "published", externalId: result.externalId });
    } catch (error) {
      const attempts = job.attempts + 1;
      const terminal = attempts >= 6;
      const delayMinutes = Math.min(360, 2 ** attempts * 5);
      const message = error instanceof Error ? error.message.slice(0, 1800) : "Unknown LinkedIn publication error";
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

export async function getSocialPublicationSummary() {
  const prisma = getPrismaClient();
  const [counts, latest] = await Promise.all([
    prisma.socialPublication.groupBy({ by: ["status"], _count: { _all: true }, where: { channel: "linkedin" } }),
    prisma.socialPublication.findMany({ where: { channel: "linkedin" }, orderBy: { updatedAt: "desc" }, take: 12 })
  ]);
  return {
    counts: Object.fromEntries(counts.map((entry) => [entry.status, entry._count._all])),
    latest: latest.map((entry) => ({
      id: entry.id,
      contentType: entry.contentType,
      status: entry.status,
      sourceUrl: entry.sourceUrl,
      externalId: entry.externalId || "",
      attempts: entry.attempts,
      lastError: entry.lastError || "",
      updatedAt: entry.updatedAt.toISOString()
    }))
  };
}
