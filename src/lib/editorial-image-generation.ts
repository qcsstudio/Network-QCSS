import crypto from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { Prisma, type SecurityAdvisory } from "@prisma/client";
import sharp from "sharp";
import { blogPosts, type BlogPost } from "@/lib/blog";
import {
  EditorialAgentError,
  editorialAgentConfiguration,
  restoreEditorialAgentTrace,
  runBflEditorialImageAgents,
  runEditorialImageAgents,
  type EditorialAgentTrace,
  type RecentVisualConcept
} from "@/lib/editorial-image-agents";
import { bflImageConfiguration } from "@/lib/editorial-image-bfl";
import {
  buildAdvisoryImageContext,
  buildArticleImageContext,
  buildEditorialImagePrompt
} from "@/lib/editorial-image-prompt";
import { shouldDeferEditorialImageGeneration } from "@/lib/editorial-image-state";
import { getPrismaClient } from "@/lib/prisma";
import { createProceduralEditorialVisual } from "@/lib/procedural-editorial-visual";

export type EditorialImageInput = {
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
    .resize(width, height, { fit: "cover", position: "centre" })
    .composite([{ input: panel, left: margin, top: margin }])
    .flatten({ background: "#eef3f8" })
    .jpeg({ quality: 88, progressive: true, chromaSubsampling: "4:4:4" })
    .toBuffer();
}

async function createContextualImages(
  input: EditorialImageInput,
  prompt: string,
  recentConcepts: RecentVisualConcept[],
  previousTrace: EditorialAgentTrace | null,
  premiumAllowed: boolean
) {
  let generated: Awaited<ReturnType<typeof runEditorialImageAgents>>;
  if (input.contentType === "security_advisory") {
    generated = await createProceduralEditorialVisual(input);
  } else if (premiumAllowed && bflImageConfiguration().configured) {
    try {
      generated = await runBflEditorialImageAgents(prompt, recentConcepts, previousTrace);
    } catch (error) {
      const reason = error instanceof Error ? error.message : "FLUX generation was unavailable";
      console.error(`Premium editorial image generation fell back to the QCS renderer for ${input.contentId}.`, error);
      generated = await createProceduralEditorialVisual(input, reason);
    }
  } else if (premiumAllowed && process.env.EDITORIAL_IMAGE_OPENAI_FALLBACK?.trim() === "1") {
    try {
      generated = await runEditorialImageAgents(prompt, recentConcepts, previousTrace);
    } catch (error) {
      const reason = error instanceof Error ? error.message : "OpenAI image generation was unavailable";
      console.error(`OpenAI editorial image generation fell back to the QCS renderer for ${input.contentId}.`, error);
      generated = await createProceduralEditorialVisual(input, reason);
    }
  } else {
    generated = await createProceduralEditorialVisual(
      input,
      premiumAllowed ? "No premium image provider is configured" : "The paid-image budget is exhausted"
    );
  }
  const [heroImage, socialImage] = await Promise.all([
    brandedVariant(generated.source, 1440, 810),
    brandedVariant(generated.source, 1200, 627)
  ]);
  return { heroImage, socialImage, trace: generated.trace };
}

function positiveLimit(name: string, fallback: number) {
  const configured = Number(process.env[name]);
  return Number.isFinite(configured) && configured >= 0 ? Math.floor(configured) : fallback;
}

async function premiumImageBudgetAvailable() {
  const config = bflImageConfiguration();
  if (!config.configured && process.env.EDITORIAL_IMAGE_OPENAI_FALLBACK?.trim() !== "1") return false;
  const now = new Date();
  const startOfDay = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const startOfMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const providers = config.configured ? ["black-forest-labs"] : ["openai-direct"];
  const prisma = getPrismaClient();
  const [daily, monthly] = await Promise.all([
    prisma.editorialImage.count({ where: { provider: { in: providers }, updatedAt: { gte: startOfDay } } }),
    prisma.editorialImage.count({ where: { provider: { in: providers }, updatedAt: { gte: startOfMonth } } })
  ]);
  return (
    daily < positiveLimit("EDITORIAL_PAID_IMAGES_DAILY_LIMIT", 2) &&
    monthly < positiveLimit("EDITORIAL_PAID_IMAGES_MONTHLY_LIMIT", 12)
  );
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
  const scores = [
    trace.qa.factualAccuracyScore,
    trace.qa.inferenceDisciplineScore,
    trace.qa.relevanceScore,
    trace.qa.specificityScore,
    trace.qa.diversityScore,
    trace.qa.compositionScore
  ];
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
    update: {},
    create: { ...key, altText: input.altText, prompt, promptHash }
  });
  const leaseUpdatedAt = asset.updatedAt;
  const promptChanged = asset.promptHash !== promptHash;
  if (promptChanged || asset.altText !== input.altText || asset.prompt !== prompt) {
    asset = await prisma.editorialImage.update({
      where: { id: asset.id },
      data: {
        altText: input.altText,
        prompt,
        promptHash,
        ...(promptChanged
          ? {
              agentTrace: Prisma.DbNull,
              generatedAt: null,
              heroImage: null,
              lastError: null,
              model: null,
              provider: null,
              qaScore: null,
              socialImage: null,
              status: "pending"
            }
          : {})
      }
    });
  }
  if (!force && asset.status === "ready" && asset.promptHash === promptHash && asset.heroImage && asset.socialImage) return asset;
  const age = Date.now() - leaseUpdatedAt.getTime();
  if (
    shouldDeferEditorialImageGeneration({ ageMs: age, force, lastError: asset.lastError, promptChanged, status: asset.status })
  )
    return null;

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
    const generated = await createContextualImages(
      input,
      prompt,
      recentVisualConcepts(recentAssets),
      restoreEditorialAgentTrace(asset.agentTrace),
      await premiumImageBudgetAvailable()
    );
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
              (trace.qa.factualAccuracyScore +
                trace.qa.inferenceDisciplineScore +
                trace.qa.relevanceScore +
                trace.qa.specificityScore +
                trace.qa.diversityScore +
                trace.qa.compositionScore) /
                6
            )
          : undefined,
        status: "failed"
      }
    });
    console.error(`Editorial image generation failed for ${input.contentType}:${input.contentId}.`, error);
    return null;
  }
}

export async function editorialImageInputForPublication(publication: PublicationIdentity) {
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
  return ensureEditorialImage(await editorialImageInputForPublication(publication), force);
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

export async function generateMissingEditorialImages(
  limit = 1,
  force = false,
  excludedContentIds: string[] = [],
  onlyContentId = ""
) {
  const prisma = getPrismaClient();
  const excluded = new Set(excludedContentIds);
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
    if (onlyContentId && input.contentId !== onlyContentId) continue;
    if (excluded.has(input.contentId)) continue;
    const existing = await prisma.editorialImage.findUnique({
      where: {
        contentType_contentId_contentRevision: {
          contentType: input.contentType,
          contentId: input.contentId,
          contentRevision: input.contentRevision
        }
      }
    });
    const currentPromptHash = crypto.createHash("sha256").update(buildEditorialImagePrompt(input)).digest("hex");
    const promptChanged = Boolean(existing && existing.promptHash !== currentPromptHash);
    const acceptedProviders = new Set(["openai-direct", "black-forest-labs", "qcs-procedural"]);
    const legacyAsset = existing?.status === "ready" && !acceptedProviders.has(existing.provider || "");
    if (!force && existing?.status === "ready" && !legacyAsset && !promptChanged) continue;
    if (
      existing &&
      shouldDeferEditorialImageGeneration({
        ageMs: Date.now() - existing.updatedAt.getTime(),
        force,
        lastError: existing.lastError,
        promptChanged,
        status: existing.status
      })
    ) {
      continue;
    }
    const generated = await ensureEditorialImage(input, force || legacyAsset || promptChanged);
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
