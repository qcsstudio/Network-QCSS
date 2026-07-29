import crypto from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { Prisma, type SecurityAdvisory } from "@prisma/client";
import sharp from "sharp";
import { blogPosts, type BlogPost } from "@/lib/blog";
import {
  EditorialAgentError,
  editorialAgentConfiguration,
  runEditorialImageAgents,
  type EditorialAgentTrace,
  type RecentVisualConcept
} from "@/lib/editorial-image-agents";
import {
  buildAdvisoryImageContext,
  buildArticleImageContext,
  buildEditorialImagePrompt
} from "@/lib/editorial-image-prompt";
import { getPrismaClient } from "@/lib/prisma";

type EditorialImageInput = {
  altText: string;
  contentId: string;
  contentRevision: string;
  contentType: "content_post" | "security_advisory";
  context: string;
  title: string;
};

type PublicationIdentity = {
  contentId: string;
  contentRevision: string;
  contentType: string;
};

export type EditorialImageVariant = "hero" | "social";

const retryDelayMs = 6 * 60 * 60_000;
const generationLeaseMs = 12 * 60_000;

function normalize(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function clip(value: string, limit: number) {
  const normalized = normalize(value);
  if (normalized.length <= limit) return normalized;
  const partial = normalized.slice(0, limit - 1);
  return `${partial.slice(0, Math.max(partial.lastIndexOf(" "), Math.floor(limit * 0.75))).replace(/[,:;.!?\s]+$/, "")}...`;
}

function imageInputForArticle(
  contentId: string,
  contentRevision: string,
  content: BlogPost
): EditorialImageInput {
  return {
    altText: `QCS contextual editorial illustration for ${clip(content.title, 135)}`,
    contentId,
    contentRevision,
    contentType: "content_post",
    context: buildArticleImageContext(content),
    title: content.title
  };
}

function imageInputForAdvisory(advisory: SecurityAdvisory, contentRevision: string): EditorialImageInput {
  return {
    altText: `QCS contextual ${advisory.severity} ${advisory.vendor} advisory illustration for ${clip(advisory.title, 110)}`,
    contentId: advisory.id,
    contentRevision,
    contentType: "security_advisory",
    context: buildAdvisoryImageContext(advisory),
    title: advisory.title
  };
}

async function brandPanel(width: number) {
  const compact = width <= 1200;
  const panelWidth = compact ? 284 : 336;
  const panelHeight = compact ? 102 : 120;
  const logoWidth = compact ? 236 : 278;
  const panel = Buffer.from(
    `<svg width="${panelWidth}" height="${panelHeight}" xmlns="http://www.w3.org/2000/svg"><rect x="1" y="1" width="${panelWidth - 2}" height="${panelHeight - 2}" rx="10" fill="white" fill-opacity="0.94" stroke="#d7e0eb" stroke-width="2"/><rect x="0" y="${panelHeight - 6}" width="${panelWidth}" height="6" rx="3" fill="#ef3d78"/></svg>`
  );
  const logo = await readFile(path.join(process.cwd(), "public", "brand", "quantumcrafters-logo.png"));
  const resizedLogo = await sharp(logo).resize({ width: logoWidth, withoutEnlargement: true }).png().toBuffer();
  return sharp(panel)
    .composite([{ input: resizedLogo, gravity: "centre" }])
    .png()
    .toBuffer();
}

async function brandedVariant(source: Uint8Array, width: number, height: number) {
  const panel = await brandPanel(width);
  const margin = width <= 1200 ? 32 : 44;
  return sharp(source)
    .resize(width, height, { fit: "cover", position: "attention" })
    .composite([{ input: panel, left: margin, top: margin }])
    .flatten({ background: "#eef3f8" })
    .jpeg({ quality: 88, progressive: true, chromaSubsampling: "4:4:4" })
    .toBuffer();
}

async function createContextualImages(prompt: string, recentConcepts: RecentVisualConcept[]) {
  const generated = await runEditorialImageAgents(prompt, recentConcepts);
  const [heroImage, socialImage] = await Promise.all([
    brandedVariant(generated.source, 1440, 810),
    brandedVariant(generated.source, 1200, 628)
  ]);
  return { heroImage, socialImage, trace: generated.trace };
}

function record(value: Prisma.JsonValue | null | undefined) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : null;
}

function recentVisualConcepts(
  assets: Array<{ agentTrace: Prisma.JsonValue | null; contentId: string }>
): RecentVisualConcept[] {
  return assets.flatMap((asset) => {
    const trace = record(asset.agentTrace);
    const direction = record(trace?.direction as Prisma.JsonValue | undefined);
    if (typeof direction?.sceneConcept !== "string" || typeof direction.diversitySignature !== "string") return [];
    return [
      {
        contentId: asset.contentId,
        sceneConcept: direction.sceneConcept,
        diversitySignature: direction.diversitySignature
      }
    ];
  });
}

function aggregateQaScore(trace: EditorialAgentTrace) {
  const scores = [trace.qa.relevanceScore, trace.qa.specificityScore, trace.qa.diversityScore, trace.qa.compositionScore];
  return Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length);
}

export async function ensureEditorialImage(input: EditorialImageInput, force = false) {
  const prisma = getPrismaClient();
  const prompt = buildEditorialImagePrompt(input);
  const promptHash = crypto.createHash("sha256").update(prompt).digest("hex");
  const key = {
    contentType: input.contentType,
    contentId: input.contentId,
    contentRevision: input.contentRevision
  };
  let asset = await prisma.editorialImage.upsert({
    where: { contentType_contentId_contentRevision: key },
    update: { altText: input.altText, prompt, promptHash },
    create: { ...key, altText: input.altText, prompt, promptHash }
  });
  if (asset.status === "ready" && asset.promptHash === promptHash && asset.heroImage && asset.socialImage) return asset;
  const age = Date.now() - asset.updatedAt.getTime();
  if (!force && asset.status === "generating" && age < generationLeaseMs) return null;
  if (!force && asset.status === "failed" && age < retryDelayMs) return null;

  const claimed = await prisma.editorialImage.updateMany({
    where: {
      id: asset.id,
      ...(force ? {} : { updatedAt: asset.updatedAt })
    },
    data: { status: "generating", attempts: { increment: 1 }, lastError: null }
  });
  if (!claimed.count) return null;
  asset = await prisma.editorialImage.findUniqueOrThrow({ where: { id: asset.id } });

  try {
    const recentAssets = await prisma.editorialImage.findMany({
      where: { status: "ready", id: { not: asset.id }, agentTrace: { not: Prisma.JsonNull } },
      orderBy: { generatedAt: "desc" },
      take: 8,
      select: { agentTrace: true, contentId: true }
    });
    const generated = await createContextualImages(prompt, recentVisualConcepts(recentAssets));
    return await prisma.editorialImage.update({
      where: { id: asset.id },
      data: {
        agentTrace: generated.trace as unknown as Prisma.InputJsonValue,
        altText: generated.trace.direction.altText,
        generatedAt: new Date(),
        heroImage: generated.heroImage,
        lastError: null,
        mimeType: "image/jpeg",
        model: generated.trace.imageModel,
        provider: generated.trace.provider,
        qaScore: aggregateQaScore(generated.trace),
        socialImage: generated.socialImage,
        status: "ready"
      }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message.slice(0, 1800) : "Unknown editorial image generation error";
    const trace = error instanceof EditorialAgentError ? error.trace : undefined;
    await prisma.editorialImage.update({
      where: { id: asset.id },
      data: {
        agentTrace: trace ? (trace as unknown as Prisma.InputJsonValue) : undefined,
        lastError: message,
        provider: trace?.provider,
        qaScore: trace?.qa
          ? Math.round(
              (trace.qa.relevanceScore + trace.qa.specificityScore + trace.qa.diversityScore + trace.qa.compositionScore) / 4
            )
          : undefined,
        status: "failed"
      }
    });
    console.error(`Editorial image generation failed for ${input.contentType}:${input.contentId}.`, error);
    return null;
  }
}

async function inputForPublication(publication: PublicationIdentity) {
  const prisma = getPrismaClient();
  if (publication.contentType === "content_post") {
    const post = await prisma.contentPost.findUnique({ where: { id: publication.contentId } });
    if (!post) throw new Error("The source article no longer exists.");
    return imageInputForArticle(post.id, publication.contentRevision, post.content as unknown as BlogPost);
  }
  if (publication.contentType === "security_advisory") {
    const advisory = await prisma.securityAdvisory.findUnique({ where: { id: publication.contentId } });
    if (!advisory) throw new Error("The source advisory no longer exists.");
    return imageInputForAdvisory(advisory, publication.contentRevision);
  }
  throw new Error(`Unsupported editorial image content type: ${publication.contentType}`);
}

export async function ensureEditorialImageForPublication(publication: PublicationIdentity, force = false) {
  return ensureEditorialImage(await inputForPublication(publication), force);
}

export async function getContextualEditorialImage(
  contentType: "content_post" | "security_advisory",
  slug: string,
  variant: EditorialImageVariant
) {
  const prisma = getPrismaClient();
  let contentId = "";
  let contentRevision = "";
  if (contentType === "content_post") {
    const post = await prisma.contentPost.findUnique({
      where: { slug },
      include: { revisions: { orderBy: { version: "desc" }, take: 1 } }
    });
    if (post) {
      contentId = post.id;
      contentRevision = String(post.revisions[0]?.version || post.updatedAt.toISOString());
    } else {
      const staticPost = blogPosts.find((item) => item.slug === slug);
      if (!staticPost) return null;
      contentId = `static:${slug}`;
      contentRevision = staticPost.updatedAt;
    }
  } else {
    const advisory = await prisma.securityAdvisory.findUnique({
      where: { slug },
      include: { revisions: { orderBy: { version: "desc" }, take: 1 } }
    });
    if (!advisory) return null;
    contentId = advisory.id;
    contentRevision = String(advisory.revisions[0]?.version || advisory.updatedAt.toISOString());
  }
  const asset = await prisma.editorialImage.findUnique({
    where: { contentType_contentId_contentRevision: { contentType, contentId, contentRevision } }
  });
  if (!asset || asset.status !== "ready") return null;
  const image = variant === "hero" ? asset.heroImage : asset.socialImage;
  return image ? { altText: asset.altText, image, mimeType: asset.mimeType } : null;
}

export function editorialImageDataUrl(asset: { image: Uint8Array; mimeType: string }) {
  return `data:${asset.mimeType};base64,${Buffer.from(asset.image).toString("base64")}`;
}

export async function generateMissingEditorialImages(limit = 1, force = false) {
  const prisma = getPrismaClient();
  const [posts, advisories] = await Promise.all([
    prisma.contentPost.findMany({
      where: { status: "published" },
      orderBy: { updatedAt: "desc" },
      include: { revisions: { orderBy: { version: "desc" }, take: 1 } }
    }),
    prisma.securityAdvisory.findMany({
      where: { status: "published" },
      orderBy: { updatedAt: "desc" },
      include: { revisions: { orderBy: { version: "desc" }, take: 1 } }
    })
  ]);
  const databaseSlugs = new Set(posts.map((post) => post.slug));
  const inputs: EditorialImageInput[] = [
    ...posts.map((post) =>
      imageInputForArticle(
        post.id,
        String(post.revisions[0]?.version || post.updatedAt.toISOString()),
        post.content as unknown as BlogPost
      )
    ),
    ...blogPosts
      .filter((post) => !databaseSlugs.has(post.slug))
      .map((post) => imageInputForArticle(`static:${post.slug}`, post.updatedAt, post)),
    ...advisories.map((advisory) =>
      imageInputForAdvisory(advisory, String(advisory.revisions[0]?.version || advisory.updatedAt.toISOString()))
    )
  ];
  const outcomes: Array<{ contentId: string; status: string }> = [];
  for (const input of inputs) {
    if (outcomes.length >= Math.max(1, Math.min(limit, 5))) break;
    const existing = await prisma.editorialImage.findUnique({
      where: {
        contentType_contentId_contentRevision: {
          contentType: input.contentType,
          contentId: input.contentId,
          contentRevision: input.contentRevision
        }
      }
    });
    if (existing?.status === "ready" && !force) continue;
    const generated = await ensureEditorialImage(input, force);
    outcomes.push({ contentId: input.contentId, status: generated?.status || "deferred" });
  }
  return outcomes;
}

export async function getEditorialImageSummary() {
  const prisma = getPrismaClient();
  const [counts, latest] = await Promise.all([
    prisma.editorialImage.groupBy({ by: ["status"], _count: { _all: true } }),
    prisma.editorialImage.findMany({ orderBy: { updatedAt: "desc" }, take: 12, select: { id: true, contentType: true, contentId: true, contentRevision: true, status: true, attempts: true, provider: true, model: true, qaScore: true, altText: true, lastError: true, generatedAt: true, updatedAt: true } })
  ]);
  return {
    agent: editorialAgentConfiguration(),
    counts: Object.fromEntries(counts.map((entry) => [entry.status, entry._count._all])),
    latest: latest.map((entry) => ({ ...entry, generatedAt: entry.generatedAt?.toISOString() || "", updatedAt: entry.updatedAt.toISOString() }))
  };
}
