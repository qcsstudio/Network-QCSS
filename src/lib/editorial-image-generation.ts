import crypto from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { Prisma, type SecurityAdvisory } from "@prisma/client";
import sharp from "sharp";
import { advisoryImagePolicyVersion, advisoryRenderNeedsManualRetry, generateAdvisoryConceptImage } from "@/lib/advisory-image-policy";
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
import { codexImageProvider, editorialImageAction, editorialImageMode } from "./editorial-image-mode.ts";
import { editorialPerceptualHash, visuallyRepeated } from "@/lib/editorial-image-diversity";
import { reserveEditorialImageBudget } from "./editorial-image-budget.ts";
import { assertRetinaVariantDimensions, editorialVisualQualityPolicy } from "@/lib/editorial-quality-policy";
import { getPrismaClient } from "@/lib/prisma";
import { resolveContentPostRevision, resolveSecurityAdvisoryRevision } from "@/lib/editorial-revision-snapshots";
import {
  createEditorialLineage,
  storySpineForAdvisory,
  storySpineForArticle,
  type EditorialLineage,
  type EditorialStorySpine
} from "@/lib/editorial-story-lineage";

export type EditorialImageInput = {
  altText: string;
  contentId: string;
  contentRevision: string;
  contentType: "content_post" | "security_advisory";
  context: string;
  lineage: EditorialLineage;
  storySpine: EditorialStorySpine;
  title: string;
};

type PublicationIdentity = {
  contentId: string;
  contentRevision: string;
  contentType: string;
};

export type EditorialImageVariant = "hero" | "social";

type EditorialImageGenerationOptions = {
  premiumAllowed?: boolean;
};

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
  const storySpine = storySpineForArticle(content);
  return {
    altText: `QCS contextual editorial illustration for ${clip(content.title, 135)}`,
    contentId,
    contentRevision,
    contentType: "content_post",
    context: buildArticleImageContext({ ...content, storySpine }),
    lineage: createEditorialLineage({ contentType: "content_post", contentId, contentRevision, storySpine }),
    storySpine,
    title: content.title
  };
}

function imageInputForAdvisory(advisory: SecurityAdvisory, contentRevision: string): EditorialImageInput {
  const storySpine = storySpineForAdvisory(advisory);
  return {
    altText: `QCS contextual ${advisory.severity} ${advisory.vendor} advisory illustration for ${clip(advisory.title, 110)}`,
    contentId: advisory.id,
    contentRevision,
    contentType: "security_advisory",
    context: buildAdvisoryImageContext({ ...advisory, storySpine }),
    lineage: createEditorialLineage({
      contentType: "security_advisory",
      contentId: advisory.id,
      contentRevision,
      storySpine
    }),
    storySpine,
    title: advisory.title
  };
}

async function brandPanel(width: number) {
  const compact = width <= 1200;
  const panelWidth = compact ? 230 : 280;
  const panelHeight = compact ? 82 : 100;
  const logoWidth = compact ? 190 : 230;
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
  const margin = width <= 1200 ? 30 : 40;
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
  const generated = await generateAdvisoryConceptImage({
      premiumAllowed,
      openAIConfigured: editorialAgentConfiguration().openAIConfigured,
      bflConfigured: bflImageConfiguration().configured,
      openAIFallbackEnabled: process.env.EDITORIAL_IMAGE_OPENAI_FALLBACK?.trim() === "1"
    }, {
      bfl: () => runBflEditorialImageAgents(prompt, recentConcepts, previousTrace),
      openAI: () => runEditorialImageAgents(prompt, recentConcepts, previousTrace)
    });
  try {
    const perceptualHash = await editorialPerceptualHash(generated.source);
    if (visuallyRepeated(perceptualHash, recentConcepts.flatMap((concept) => concept.perceptualHash ? [concept.perceptualHash] : []))) {
      throw new Error("The rendered image closely repeats recent artwork. Review the composition before another paid render.");
    }
    const [heroImage, socialImage] = await Promise.all([
      brandedVariant(generated.source, editorialVisualQualityPolicy.hero.width, editorialVisualQualityPolicy.hero.height),
      brandedVariant(generated.source, editorialVisualQualityPolicy.social.width, editorialVisualQualityPolicy.social.height)
    ]);
    const [heroMetadata, socialMetadata] = await Promise.all([sharp(heroImage).metadata(), sharp(socialImage).metadata()]);
    assertRetinaVariantDimensions("hero", heroMetadata.width || 0, heroMetadata.height || 0);
    assertRetinaVariantDimensions("social", socialMetadata.width || 0, socialMetadata.height || 0);
    return { heroImage, socialImage, trace: { ...generated.trace, perceptualHash } };
  } catch (error) {
    throw new EditorialAgentError(
      `Image derivative preparation failed; review before regenerating: ${error instanceof Error ? error.message : "Unknown image error"}`,
      generated.trace
    );
  }
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
        diversitySignature: direction.diversitySignature,
        perceptualHash: typeof trace?.perceptualHash === "string" ? trace.perceptualHash : undefined
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

export async function ensureEditorialImage(
  input: EditorialImageInput,
  force = false,
  options: EditorialImageGenerationOptions = {}
) {
  const mode = editorialImageMode();
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
  if (asset.status === "generating" && Date.now() - asset.updatedAt.getTime() < 12 * 60_000) return null;
  const action = editorialImageAction({ mode, status: asset.status, complete: Boolean(asset.heroImage && asset.socialImage), provider: asset.provider, force });
  if (action === "preserve") return asset;
  if (action === "handoff") {
    if (asset.status !== "awaiting_codex" || asset.promptHash !== promptHash) await prisma.editorialImage.updateMany({
      where: { id: asset.id, updatedAt: asset.updatedAt, status: asset.status },
      data: { status: "awaiting_codex", prompt, promptHash, lastError: "Waiting for a Codex image session and reviewed import. No paid image API was called." }
    });
    return null;
  }
  const leaseUpdatedAt = asset.updatedAt;
  const promptChanged = asset.promptHash !== promptHash;
  if (advisoryRenderNeedsManualRetry({
    contentType: input.contentType, status: asset.status, force, promptChanged: false,
    renderAttempts: record(asset.agentTrace)?.renderAttempts
  })) return null;
  const age = Date.now() - leaseUpdatedAt.getTime();
  if (
    shouldDeferEditorialImageGeneration({ ageMs: age, force, lastError: asset.lastError, promptChanged, status: asset.status })
  )
    return null;

  const claimed = await prisma.editorialImage.updateMany({
    where: {
      id: asset.id,
      updatedAt: asset.updatedAt,
      status: asset.status
    },
    data: {
      status: "generating", attempts: { increment: 1 }, lastError: null,
      altText: input.altText, prompt, promptHash,
      ...(promptChanged ? { agentTrace: Prisma.DbNull } : {})
    }
  });
  if (!claimed.count) return null;
  asset = await prisma.editorialImage.findUniqueOrThrow({ where: { id: asset.id } });

  try {
    const providerConfigured = bflImageConfiguration().configured || process.env.EDITORIAL_IMAGE_OPENAI_FALLBACK?.trim() === "1";
    if (!editorialAgentConfiguration().openAIConfigured || !providerConfigured) throw new Error("Image provider or planning credentials are unavailable. Configure them before retrying.");
    if (options.premiumAllowed === false || !await reserveEditorialImageBudget(asset.id)) {
      await prisma.editorialImage.update({ where: { id: asset.id }, data: { status: "budget_wait", lastError: "Image budget is reserved or exhausted. Waiting for the next available daily/monthly allowance; no provider call was made." } });
      return null;
    }
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
      true
    );
    const trace = { ...generated.trace, lineage: input.lineage,
      ...(input.contentType === "security_advisory" ? { advisoryImagePolicyVersion } : {})
    };
    return await prisma.editorialImage.update({
      where: { id: asset.id },
      data: {
        agentTrace: trace as unknown as Prisma.InputJsonValue,
        altText: trace.direction.altText,
        generatedAt: new Date(),
        heroImage: generated.heroImage,
        lastError: null,
        mimeType: "image/jpeg",
        model: trace.imageModel,
        provider: trace.provider,
        qaScore: aggregateQaScore(trace),
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
  if (publication.contentType === "content_post") {
    const post = await resolveContentPostRevision(publication.contentId, publication.contentRevision);
    return imageInputForArticle(post.source.id, publication.contentRevision, post.content);
  }
  if (publication.contentType === "security_advisory") {
    const advisory = await resolveSecurityAdvisoryRevision(publication.contentId, publication.contentRevision);
    return imageInputForAdvisory(advisory.advisory, publication.contentRevision);
  }
  throw new Error(`Unsupported editorial image content type: ${publication.contentType}`);
}

export async function ensureEditorialImageForPublication(
  publication: PublicationIdentity,
  force = false,
  options: EditorialImageGenerationOptions = {}
) {
  return ensureEditorialImage(await editorialImageInputForPublication(publication), force, options);
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
    if (existing && advisoryRenderNeedsManualRetry({
      contentType: input.contentType, status: existing.status, force, promptChanged,
      renderAttempts: record(existing.agentTrace)?.renderAttempts
    })) continue;
    if (existing?.status === "ready" && existing.provider === codexImageProvider && existing.heroImage && existing.socialImage) continue;
    const acceptedProviders = new Set(["openai-direct", "black-forest-labs", "qcs-procedural", codexImageProvider]);
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
