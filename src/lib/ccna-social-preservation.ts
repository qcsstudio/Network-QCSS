import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { Prisma, type PrismaClient, type SocialPublication } from "@prisma/client";
import { z } from "zod";
import { ccnaContentDigest } from "./ccna-generation-pipeline";
import { hasNativeLinkedInOwnership } from "./linkedin-native-schedule";

export const ccnaSocialPreservationKey = "ccnaReviewedSupplementPreservation";
export const ccnaApiDispatchKey = "ccnaApiDispatch";
export const ccnaPreservationSourceFiles = [
  "src/lib/ccna-social-preservation.ts",
  "src/lib/social-publications.ts",
  "src/lib/ccna-local-supplement-policy.ts",
  "scripts/ccna-local-supplement.ts",
  "tests/ccna-social-preservation.test.mjs",
  "tests/ccna-api-dispatch.test.mjs",
  "tests/ccna-local-supplement.test.mjs",
  "tests/linkedin-native-schedule.test.mjs"
] as const;
const digest = z.string().regex(/^[a-f0-9]{64}$/);
const date = z.iso.datetime({ offset: true });
const legacyDay = z.union([z.literal(2), z.literal(3), z.literal(6)]);
const markerSchema = z.strictObject({
  version: z.literal(1),
  kind: z.literal("reviewed-website-supplement-preserve-delivered-api-post"),
  day: legacyDay, lessonId: z.string().min(1), jobId: z.string().min(1),
  externalId: z.string().min(1), contentRevision: z.string().min(1),
  originalUpdatedAt: date, protectedUpdatedAt: date, originalJobDigest: digest,
  baseContentDigest: digest, supplementedContentDigest: digest,
  reviewSha256: digest, qaSha256: digest, activationSha256: digest,
  beforeSnapshot: z.strictObject({ path: z.string().min(1), sha256: digest })
});

const activationSchema = z.strictObject({
  version: z.literal(1),
  scope: z.literal("reviewed-website-supplements-days-2-3-6"),
  codeReview: z.strictObject({
    reviewerId: z.string().min(1), independent: z.literal(true), approved: z.literal(true),
    reviewedAt: date, evidence: z.string().min(30)
  }),
  sourceSha256: z.record(z.string(), digest),
  deployment: z.strictObject({
    revision: z.string().min(1), verifiedAt: date, evidence: z.string().min(30),
    allWritersRunningReviewedCode: z.literal(true), inFlightOperationsDrained: z.literal(true)
  })
});
export type CcnaPreservationActivation = ReturnType<typeof validateCcnaPreservationActivation>;

export function validateCcnaPreservationActivation(raw: string, sources: Record<string, string>, now: Date) {
  const receipt = activationSchema.parse(JSON.parse(raw));
  assert.deepEqual(Object.keys(receipt.sourceSha256).sort(), [...ccnaPreservationSourceFiles].sort(),
    "Preservation code review must cover every safeguard and test file.");
  assert.deepEqual(receipt.sourceSha256, sources, "Preservation code changed after independent code review.");
  const reviewed = Date.parse(receipt.codeReview.reviewedAt);
  const active = Date.parse(receipt.deployment.verifiedAt);
  assert.ok(reviewed <= active && active <= now.getTime() + 60_000 && now.getTime() - active <= 86_400_000,
    "Require activation evidence from the last 24 hours, after independent code review.");
  return { receipt, sha256: ccnaContentDigest(receipt) };
}

function metadata(value: unknown): Record<string, unknown> {
  assert.ok(value && typeof value === "object" && !Array.isArray(value), "Invalid social metadata; preservation is held.");
  return value as Record<string, unknown>;
}

export function hasCcnaSocialPreservation(value: unknown) {
  return !!value && typeof value === "object" && Object.hasOwn(value, ccnaSocialPreservationKey);
}

export const ccnaSocialJobDigest = (value: unknown) => ccnaContentDigest(JSON.parse(JSON.stringify(value)));

export function assertCcnaPreservedJob(job: SocialPublication) {
  const marker = markerSchema.parse(metadata(job.metadata)[ccnaSocialPreservationKey]);
  assert.equal(job.channel, "linkedin");
  assert.equal(job.contentType, "ccna_lesson");
  assert.equal(marker.lessonId, job.contentId);
  assert.equal(marker.jobId, job.id);
  assert.equal(marker.externalId, job.externalId, "Preserved external post ID changed.");
  assert.equal(marker.contentRevision, job.contentRevision, "Preserved social revision changed.");
  assert.equal(new Date(job.updatedAt).toISOString(), marker.protectedUpdatedAt, "Preserved job timestamp changed.");
  assert.equal(job.status, "published", "Preserved delivered API post changed status; do not retry.");
  assert.equal(hasNativeLinkedInOwnership(job.metadata), false, "API preservation must not become native ownership.");
  const originalMetadata = { ...metadata(job.metadata) };
  delete originalMetadata[ccnaSocialPreservationKey];
  assert.equal(ccnaSocialJobDigest({ ...job, metadata: originalMetadata, updatedAt: marker.originalUpdatedAt }),
    marker.originalJobDigest, "Preserved social job changed; reconcile without modifying the post.");
  return marker;
}

export function assertCcnaPreservationMarkers(jobs: SocialPublication[]) {
  const owners = jobs.filter(job => hasCcnaSocialPreservation(job.metadata));
  for (const job of owners) assertCcnaPreservedJob(job);
  assert.ok(!owners.length || !jobs.some(job => hasNativeLinkedInOwnership(job.metadata)),
    "API preservation conflicts with native ownership; reconcile without modifying either job.");
  return owners;
}

const dispatchSchema = z.strictObject({
  id: z.uuid(), operation: z.enum(["publish", "commentary", "replace-media"]),
  origin: z.enum(["reservation", "interrupted-recovery"]),
  state: z.enum(["in-flight", "completed"]), startedAt: date,
  previousStatus: z.string(), previousExternalId: z.string().nullable(),
  contentRevision: z.string()
});
export type CcnaApiReservation = { job: SocialPublication; dispatch: z.infer<typeof dispatchSchema> };

export function assertCcnaApiDispatchSettled(jobs: SocialPublication[]) {
  for (const job of jobs) {
    const meta = job.metadata;
    if (!meta || typeof meta !== "object" || !Object.hasOwn(meta, ccnaApiDispatchKey)) continue;
    const dispatch = dispatchSchema.parse(metadata(meta)[ccnaApiDispatchKey]);
    assert.equal(dispatch.state, "completed", "CCNA API dispatch has an uncertain outcome; reconcile externally before any retry or supplement.");
  }
}

// Called only inside the ownership transaction. Commit this fence BEFORE any
// remote work; a timeout/rollback of a later receipt write cannot undo it.
export async function reserveCcnaApiDispatch(client: Prisma.TransactionClient | PrismaClient,
  job: SocialPublication, operation: CcnaApiReservation["dispatch"]["operation"], recovered = false) {
  const dispatch = dispatchSchema.parse({
    id: randomUUID(), operation, state: "in-flight", origin: recovered ? "interrupted-recovery" : "reservation",
    startedAt: (recovered && job.lastAttemptAt ? job.lastAttemptAt : new Date()).toISOString(),
    previousStatus: job.status, previousExternalId: job.externalId, contentRevision: job.contentRevision
  });
  const saved = await client.socialPublication.updateMany({
    where: { id: job.id, status: job.status, updatedAt: job.updatedAt, externalId: job.externalId },
    data: { status: "needs_review",
      ...(recovered ? {} : { lastAttemptAt: new Date(), attempts: { increment: 1 } }),
      lastError: recovered ? "Interrupted CCNA API attempt has an uncertain external outcome; reconcile before any retry."
        : "CCNA API operation reserved. Outcome requires reconciliation until the receipt is committed.",
      metadata: { ...metadata(job.metadata ?? {}), [ccnaApiDispatchKey]: dispatch } as Prisma.InputJsonObject }
  });
  if (!saved.count) return null;
  return { job: await client.socialPublication.findUniqueOrThrow({ where: { id: job.id } }), dispatch };
}

export async function completeCcnaApiDispatch(prisma: PrismaClient, reservation: CcnaApiReservation,
  data: Prisma.SocialPublicationUpdateManyMutationInput) {
  const saved = await prisma.socialPublication.updateMany({
    where: { id: reservation.job.id, status: "needs_review", updatedAt: reservation.job.updatedAt,
      metadata: { equals: reservation.job.metadata as Prisma.InputJsonValue } },
    data: { ...data, status: "published", lastError: null,
      metadata: { ...metadata(data.metadata), [ccnaApiDispatchKey]: { ...reservation.dispatch, state: "completed" } } as Prisma.InputJsonObject }
  });
  assert.equal(saved.count, 1, "CCNA API receipt CAS failed; dispatch remains held for external reconciliation, never automatic retry.");
  return prisma.socialPublication.findUniqueOrThrow({ where: { id: reservation.job.id } });
}

export function assertCcnaLegacyPreservationEligible(jobs: SocialPublication[], lessonId: string, day: number) {
  legacyDay.parse(day);
  const linkedin = jobs.filter(job => job.channel === "linkedin");
  assert.ok(linkedin.length > 0, "No delivered legacy LinkedIn job to preserve.");
  for (const job of linkedin) {
    assert.equal(job.contentType, "ccna_lesson");
    assert.equal(job.contentId, lessonId);
    assert.equal(job.status, "published", "Only already-delivered API jobs are eligible for preservation.");
    assert.ok(job.externalId && job.publishedAt && job.contentRevision && job.updatedAt,
      "A delivered API job needs its external ID, revision and publication timestamps.");
    assert.equal(hasNativeLinkedInOwnership(job.metadata), false, "Native delivery must use the existing native guards.");
    const receipt = metadata(metadata(job.metadata).deliveryReceipt);
    assert.ok(Object.keys(receipt).length, "Require the original API delivery receipt, not a fabricated native receipt.");
    if (hasCcnaSocialPreservation(job.metadata)) {
      assert.equal(assertCcnaPreservedJob(job).day, day, "Preservation belongs to a different chapter.");
    }
  }
  return linkedin;
}

export function preserveCcnaApiJob(job: SocialPublication, input: {
  day: number; lessonId: string; baseContentDigest: string; supplementedContentDigest: string;
  reviewSha256: string; qaSha256: string; activation: CcnaPreservationActivation;
  beforeSnapshot: { path: string; sha256: string }; now: Date;
}) {
  assertCcnaLegacyPreservationEligible([job], input.lessonId, input.day);
  // Repeated website supplements never rewrite the original social freeze.
  if (hasCcnaSocialPreservation(job.metadata)) return job;
  const marker = markerSchema.parse({
    version: 1, kind: "reviewed-website-supplement-preserve-delivered-api-post",
    day: input.day, lessonId: job.contentId, jobId: job.id, externalId: job.externalId,
    contentRevision: job.contentRevision, originalUpdatedAt: new Date(job.updatedAt).toISOString(),
    protectedUpdatedAt: input.now.toISOString(), originalJobDigest: ccnaSocialJobDigest(job),
    baseContentDigest: input.baseContentDigest, supplementedContentDigest: input.supplementedContentDigest,
    reviewSha256: input.reviewSha256, qaSha256: input.qaSha256,
    activationSha256: input.activation.sha256, beforeSnapshot: input.beforeSnapshot
  });
  return { ...job, updatedAt: input.now, metadata: {
    ...metadata(job.metadata), [ccnaSocialPreservationKey]: marker
  } as Prisma.JsonObject };
}

export async function ccnaPreservedLinkedInOwner(client: Pick<Prisma.TransactionClient, "socialPublication" | "ccnaLesson">,
  contentType: string, contentId: string) {
  if (contentType !== "ccna_lesson") return null;
  const jobs = await client.socialPublication.findMany({ where: { channel: "linkedin", contentType, contentId } });
  const owners = assertCcnaPreservationMarkers(jobs);
  assertCcnaApiDispatchSettled(jobs);
  if (!owners.length && !jobs.some(job => hasNativeLinkedInOwnership(job.metadata)) && jobs.some(job => job.externalId)) {
    const lesson = await client.ccnaLesson.findUnique({ where: { id: contentId }, select: { sequence: true } });
    // Protect the deployment-to-apply gap too. No remote mutation may start on
    // these delivered posts while their independently reviewed freeze is pending.
    if (!lesson || legacyDay.safeParse(lesson.sequence).success) {
      throw new Error("Delivered legacy CCNA API post awaits reviewed supplement preservation. Do not queue, refresh, rebuild or retry it.");
    }
  }
  return owners[0] || null;
}

export async function lockCcnaSocialRevision(tx: Prisma.TransactionClient, lessonId: string) {
  await tx.$queryRaw`SELECT "id" FROM "CcnaLesson" WHERE "id" = ${lessonId} FOR UPDATE`;
  await tx.$queryRaw`SELECT "id" FROM "SocialPublication"
    WHERE "contentType" = 'ccna_lesson' AND "contentId" = ${lessonId} ORDER BY "id" FOR UPDATE`;
}

// DB-only critical section. Remote work must start only AFTER this commits a
// durable dispatch fence; it must never run inside this transaction.
export async function withCcnaSocialGuard<T, P = never>(prisma: PrismaClient,
  target: { contentType: string; contentId: string },
  action: (client: Prisma.TransactionClient | PrismaClient) => Promise<T>,
  onPreserved?: (owner: SocialPublication) => P) {
  if (target.contentType !== "ccna_lesson") return action(prisma);
  return prisma.$transaction(async tx => {
    await lockCcnaSocialRevision(tx, target.contentId);
    const owner = await ccnaPreservedLinkedInOwner(tx, target.contentType, target.contentId);
    if (owner) {
      if (onPreserved) return onPreserved(owner);
      throw new Error("Reviewed website-only supplement preserves this delivered LinkedIn API post. Queue, refresh, rebuild and retry must not modify or replace it.");
    }
    return action(tx);
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, maxWait: 5_000, timeout: 15_000 });
}
