import { Prisma } from "@prisma/client";
import { getPrismaClient } from "./prisma.ts";
import { advisoryEditorialSnapshot } from "./editorial-revision-snapshots.ts";
import { codexImageProvider } from "./editorial-image-mode.ts";
import type { BlogPost } from "./blog.ts";
import { createEditorialLineage, storySpineForArticle, storySpineForAdvisory } from "./editorial-story-lineage.ts";
import {
  codexImportDecision, codexSourceSchema, digest, objectDigest,
  type CodexImagePack, type ValidatedCodexCandidate
} from "./codex-image-workflow.ts";

type Database = Pick<Prisma.TransactionClient, "contentPost" | "securityAdvisory" | "editorialImage">;
function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

export async function readCodexSource(db: Database, contentType: string, contentId: string) {
  if (contentType === "content_post") {
    const post = await db.contentPost.findUnique({ where: { id: contentId }, include: { revisions: { orderBy: { version: "desc" }, take: 1 } } });
    if (!post) throw new Error("Article no longer exists.");
    return codexSourceSchema.parse({ contentType, contentId, contentRevision: String(post.revisions[0]?.version || post.updatedAt.toISOString()),
      title: post.title, status: post.status, updatedAt: post.updatedAt.toISOString(), liveContentHash: objectDigest(post.content),
      content: post.revisions[0]?.content || post.content });
  }
  if (contentType !== "security_advisory") throw new Error("Unsupported content type.");
  const advisory = await db.securityAdvisory.findUnique({ where: { id: contentId }, include: { revisions: { orderBy: { version: "desc" }, take: 1 } } });
  if (!advisory || advisory.deletedAt) throw new Error("Advisory no longer exists or was deleted.");
  const payload = record(advisory.revisions[0]?.payload);
  const snapshot = record(payload.editorialSnapshot || payload.content);
  const live = advisoryEditorialSnapshot(advisory);
  return codexSourceSchema.parse({ contentType, contentId, contentRevision: String(advisory.revisions[0]?.version || advisory.updatedAt.toISOString()),
    title: advisory.title, status: advisory.status, updatedAt: advisory.updatedAt.toISOString(), liveContentHash: objectDigest(live),
    content: Object.keys(snapshot).length ? { ...live, ...snapshot } : live });
}

async function recentConcepts(db: Database): Promise<CodexImagePack["recent"]> {
  const images = await db.editorialImage.findMany({ where: { status: "ready" }, orderBy: { generatedAt: "desc" }, take: 20,
    select: { contentId: true, agentTrace: true } });
  return images.map((image) => {
    const trace = record(image.agentTrace);
    const direction = record(trace.direction);
    return { contentId: image.contentId, sceneConcept: String(direction.sceneConcept || ""), diversitySignature: String(direction.diversitySignature || ""),
      ...(typeof trace.perceptualHash === "string" ? { perceptualHash: trace.perceptualHash } : {}) };
  });
}

export async function exportCodexSource(contentType: string, contentId: string) {
  const db = getPrismaClient();
  return { source: await readCodexSource(db, contentType, contentId), recent: await recentConcepts(db) };
}

export async function listCodexImageHandoffs() {
  return getPrismaClient().editorialImage.findMany({ where: { status: "awaiting_codex" }, orderBy: { createdAt: "asc" }, take: 100,
    select: { contentType: true, contentId: true, contentRevision: true, status: true, updatedAt: true } });
}

export async function importCodexCandidate(candidate: ValidatedCodexCandidate, apply = false, db: Pick<ReturnType<typeof getPrismaClient>, "$transaction"> = getPrismaClient()) {
  const { contentType, contentId, contentRevision } = candidate.pack.source;
  const key = { contentType, contentId, contentRevision };
  // A serializable transaction keeps the source check and image write together. No
  // approval, article, or social-publication records are mutated by this importer.
  return db.$transaction(async (tx) => {
    const current = await readCodexSource(tx, contentType, contentId);
    const existing = await tx.editorialImage.findUnique({ where: { contentType_contentId_contentRevision: key } });
    const trace = record(existing?.agentTrace);
    const decision = codexImportDecision(candidate, current, existing ? {
      status: existing.status, provider: existing.provider,
      manifestHash: typeof trace.manifestHash === "string" ? trace.manifestHash : undefined
    } : null);
    const recent = await recentConcepts(tx);
    const { validateCodexConcept } = await import("./codex-image-workflow.ts");
    const { visuallyRepeated } = await import("./editorial-image-diversity.ts");
    validateCodexConcept({ ...candidate.pack, recent }, candidate.concept);
    if (visuallyRepeated(candidate.manifest.perceptualHash, recent.filter((item) => item.contentId !== contentId)
      .flatMap((item) => item.perceptualHash ? [item.perceptualHash] : []))) throw new Error("New artwork since preparation is too similar; choose a different concept.");
    if (!apply || decision === "unchanged") return { action: decision, applied: false, dryRun: !apply, ...key };
    const storySpine = contentType === "content_post"
      ? storySpineForArticle(current.content as unknown as BlogPost)
      : storySpineForAdvisory(current.content as unknown as Parameters<typeof storySpineForAdvisory>[0]);
    const lineage = createEditorialLineage({ ...key, storySpine });
    const data = {
      status: "ready", provider: codexImageProvider, model: "built-in-imagegen", mimeType: "image/jpeg",
      prompt: candidate.concept.prompt, promptHash: digest(candidate.concept.prompt), altText: candidate.concept.altText,
      heroImage: Buffer.from(candidate.hero), socialImage: Buffer.from(candidate.social), generatedAt: new Date(),
      qaScore: null, lastError: null,
      agentTrace: {
        provider: codexImageProvider, direction: candidate.concept, manifest: candidate.manifest,
        lineage,
        manifestHash: objectDigest(candidate.manifest), sourceHash: candidate.pack.sourceHash,
        perceptualHash: candidate.manifest.perceptualHash, review: candidate.review,
        independentAutomatedReview: false, separatePaidApiCalls: 0
      } as unknown as Prisma.InputJsonValue
    };
    await tx.editorialImage.upsert({ where: { contentType_contentId_contentRevision: key }, create: { ...key, ...data }, update: data });
    await tx.auditLog.create({ data: { action: "editorial_image.codex_import", actor: candidate.review.reviewer,
      target: `${contentType}:${contentId}:${contentRevision}`, metadata: { sourceHash: candidate.pack.sourceHash, manifestHash: objectDigest(candidate.manifest) } } });
    return { action: "imported", applied: true, dryRun: false, ...key };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 15_000 });
}
