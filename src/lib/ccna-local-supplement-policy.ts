import assert from "node:assert/strict";
import { z } from "zod";
import { ccnaCurriculum } from "./ccna-curriculum";
import { evaluateCcnaLessonForTopic } from "./ccna-content-agent";
import { ccnaContentDigest, ccnaReviewedRevisionIssues } from "./ccna-generation-pipeline";
import { ccnaReviewableLessonSchema } from "./ccna-lesson-schema";
import { ccnaLocalReleasePolicy, localReleaseSha, validateLocalReview } from "./ccna-local-release-policy";
import { hasNativeLinkedInOwnership } from "./linkedin-native-schedule";
import type { SocialPublication } from "@prisma/client";
import { assertCcnaApiDispatchSettled, assertCcnaPreservationMarkers, assertCcnaLegacyPreservationEligible, assertCcnaPreservedJob, ccnaSocialJobDigest,
  hasCcnaSocialPreservation, type CcnaPreservationActivation } from "./ccna-social-preservation";

const sha = z.string().regex(/^[a-f0-9]{64}$/);
const timestamp = z.iso.datetime({ offset: true });
const daySchema = z.number().int().min(1).max(60);
const identitySchema = z.strictObject({
  id: z.string().min(1), slug: z.string().min(1), title: z.string().min(1),
  sequence: daySchema, publishedAt: timestamp, scheduledFor: timestamp.nullable()
});

// This record describes a reviewed replacement of one published chapter, not a new release.
export const ccnaSupplementCoverageSchema = z.strictObject({
  day: daySchema,
  authorId: z.string().min(1),
  baseContentDigest: sha,
  baseUpdatedAt: timestamp,
  contentSha256: sha,
  identity: identitySchema,
  changes: z.array(z.strictObject({
    objective: z.string().min(20),
    contentPointers: z.array(z.string().startsWith("/")).min(1),
    assessmentPointers: z.array(z.string().regex(/^\/(?:quiz|practiceQuestions)\//)).min(1)
  })).min(1).max(30),
  limitations: z.array(z.string().min(10)).min(1)
});

export const ccnaSupplementQaSchema = z.strictObject({
  day: daySchema,
  baseContentDigest: sha,
  baseUpdatedAt: timestamp,
  contentSha256: sha,
  coverageSha256: sha,
  reviewSha256: sha,
  imageSha256: sha,
  desktopSha256: sha,
  mobileSha256: sha,
  checkedBy: z.literal("parent"),
  checkedAt: timestamp,
  visualChecked: z.literal(true),
  sourceLinksChecked: z.literal(true),
  desktopChecked: z.literal(true),
  mobileChecked: z.literal(true),
  notes: z.string().min(30),
  limitations: z.array(z.string().min(10)).min(1)
});

export type SupplementRow = {
  id: string; slug: string; title: string; sequence: number; status: string;
  publishedAt: Date | string | null; scheduledFor: Date | string | null;
  updatedAt: Date | string; content: unknown; generationTrace: unknown;
};
export type SupplementJob = {
  id: string; channel: string; contentType: string; contentId: string;
  status: string; metadata: unknown;
};
export type SupplementPixels = { image: Uint8Array; desktop: Uint8Array; mobile: Uint8Array };

export function ccnaSupplementTopic(day: number) {
  daySchema.parse(day);
  const topic = ccnaCurriculum.find(item => item.sequence === day);
  assert.ok(topic, "Supplement must belong to the existing 60-chapter curriculum.");
  return topic;
}

function currentTimestamp(value: string, now: Date, label: string) {
  const time = Date.parse(value);
  assert.ok(Number.isFinite(time) && time <= now.getTime() + 60_000
    && now.getTime() - time <= 30 * 86_400_000, `${label} must be dated and current within 30 days.`);
  return time;
}

function pointerValue(content: unknown, pointer: string): unknown {
  assert.ok(pointer.startsWith("/") && !/~(?![01])/.test(pointer), "Invalid coverage JSON Pointer.");
  let value = content;
  for (const part of pointer.slice(1).split("/")) {
    const key = part.replace(/~1/g, "/").replace(/~0/g, "~");
    assert.ok(value && typeof value === "object" && Object.hasOwn(value, key),
      `Coverage pointer does not resolve: ${pointer}`);
    value = (value as Record<string, unknown>)[key];
  }
  assert.ok(value !== null && value !== "" && value !== undefined, `Empty coverage pointer: ${pointer}`);
  return value;
}

function object(value: unknown): Record<string, unknown> {
  if (value === null || value === undefined) return {};
  assert.ok(typeof value === "object" && !Array.isArray(value), "Expected an object trace or metadata.");
  return value as Record<string, unknown>;
}

const iso = (value: Date | string) => new Date(value).toISOString();

export function prepareCcnaSupplement(day: number, raw: string, coverageRaw: string, now: Date) {
  const topic = ccnaSupplementTopic(day);
  const supplied: unknown = JSON.parse(raw);
  const content = ccnaReviewableLessonSchema.parse(supplied);
  assert.deepEqual(supplied, content, "Candidate contains unknown or normalized fields; review the exact persisted content.");
  const coverage = ccnaSupplementCoverageSchema.parse(JSON.parse(coverageRaw));
  assert.equal(coverage.day, day);
  assert.equal(coverage.identity.sequence, day, "Coverage changed chapter identity.");
  assert.equal(coverage.identity.slug, topic.slug, "Coverage changed chapter identity.");
  assert.notEqual(coverage.authorId, ccnaLocalReleasePolicy.reviewerId, "The author cannot independently review their own supplement.");
  assert.equal(coverage.contentSha256, localReleaseSha(raw), "Coverage does not cover the exact supplemented file.");
  assert.notEqual(coverage.baseContentDigest, ccnaContentDigest(content), "An unchanged chapter is not a supplement.");
  for (const change of coverage.changes) {
    for (const pointer of [...change.contentPointers, ...change.assessmentPointers]) pointerValue(content, pointer);
  }
  currentTimestamp(ccnaLocalReleasePolicy.sourceVerifiedAt, now, "Official source baseline");
  const quality = evaluateCcnaLessonForTopic(topic, content);
  assert.ok(quality.ready && !quality.issues.length, `Supplement held by quality gate: ${quality.issues.join(" ")}`);
  return { day, topic, raw, coverageRaw, coverage, content, quality, contentDigest: ccnaContentDigest(content) };
}

export type PreparedCcnaSupplement = ReturnType<typeof prepareCcnaSupplement>;

export function validateCcnaSupplementReview(candidate: PreparedCcnaSupplement, reviewRaw: string, now: Date) {
  const receipt = JSON.parse(reviewRaw);
  assert.ok(receipt && Array.isArray(receipt.lessons), "Require the independent supplement review receipt.");
  const review = validateLocalReview(candidate.raw, receipt, candidate.day, now);
  assert.equal(review.entry.baseContentDigest, candidate.coverage.baseContentDigest, "Review covers a different base.");
  assert.equal(review.entry.coverageSha256, localReleaseSha(candidate.coverageRaw), "Review covers a different coverage record.");
  assert.notEqual(receipt.reviewerId, candidate.coverage.authorId, "The independent reviewer must not be the author.");
  return { ...review, receipt, receiptSha256: localReleaseSha(reviewRaw) };
}

export function validateCcnaSupplementQa(candidate: PreparedCcnaSupplement, reviewRaw: string,
  qaRaw: string, pixels: SupplementPixels, now: Date) {
  const review = validateCcnaSupplementReview(candidate, reviewRaw, now);
  const qa = ccnaSupplementQaSchema.parse(JSON.parse(qaRaw));
  assert.equal(qa.day, candidate.day);
  assert.equal(qa.baseContentDigest, candidate.coverage.baseContentDigest, "QA covers a different base.");
  assert.equal(iso(qa.baseUpdatedAt), iso(candidate.coverage.baseUpdatedAt), "QA covers a different base revision.");
  assert.equal(qa.contentSha256, localReleaseSha(candidate.raw), "Content changed after QA.");
  assert.equal(qa.coverageSha256, localReleaseSha(candidate.coverageRaw), "Coverage changed after QA.");
  assert.equal(qa.reviewSha256, localReleaseSha(reviewRaw), "Independent review changed after QA.");
  for (const kind of ["image", "desktop", "mobile"] as const) {
    assert.ok(pixels[kind].byteLength > 0, `Missing ${kind} pixel evidence.`);
    assert.equal(qa[`${kind}Sha256`], localReleaseSha(pixels[kind]), `${kind} pixels changed after QA.`);
  }
  assert.ok(currentTimestamp(qa.checkedAt, now, "Parent pixel QA") >= Date.parse(review.receipt.reviewedAt),
    "Parent pixel QA must follow the exact independent review.");
  return { qa, review, qaSha256: localReleaseSha(qaRaw) };
}

export function assertCcnaSupplementBase(row: SupplementRow, candidate: PreparedCcnaSupplement) {
  const { coverage } = candidate;
  assert.equal(row.status, "published", "Only an already-published chapter can receive a supplement.");
  assert.ok(row.publishedAt, "The published chapter must retain its original publication timestamp.");
  assert.deepEqual({
    id: row.id, slug: row.slug, title: row.title, sequence: row.sequence,
    publishedAt: iso(row.publishedAt), scheduledFor: row.scheduledFor ? iso(row.scheduledFor) : null
  }, {
    ...coverage.identity, publishedAt: iso(coverage.identity.publishedAt),
    scheduledFor: coverage.identity.scheduledFor ? iso(coverage.identity.scheduledFor) : null
  }, "Published chapter identity changed.");
  assert.equal(ccnaContentDigest(row.content), coverage.baseContentDigest, "Stale base content digest; rebase and independently review.");
  assert.equal(iso(row.updatedAt), iso(coverage.baseUpdatedAt), "Stale base updatedAt; rebase and independently review.");
  assert.notEqual(object(object(row.generationTrace).publicationJob).delivery, "pending",
    "Active application delivery must be held or reconciled before a supplement.");
}

export function assertCcnaSupplementSocialJobs(jobs: SupplementJob[], lessonId: string,
  legacy?: { day: number; activation: CcnaPreservationActivation }) {
  assertCcnaPreservationMarkers(jobs as SocialPublication[]);
  assertCcnaApiDispatchSettled(jobs as SocialPublication[]);
  for (const job of jobs) {
    assert.equal(job.contentType, "ccna_lesson");
    assert.equal(job.contentId, lessonId);
    assert.ok(["held", "published", "failed", "replaced", "cancelled"].includes(job.status),
      "Active social delivery or unknown delivery state must be held or reconciled before a supplement.");
  }
  const linkedin = jobs.filter(job => job.channel === "linkedin");
  const owners = linkedin.filter(job => hasNativeLinkedInOwnership(job.metadata));
  // A later queue/refresh can rewrite non-native posts when updatedAt advances.
  if (linkedin.length && !owners.length) {
    assert.ok(legacy?.activation, "Non-native LinkedIn delivery requires independently reviewed and activated preservation guards.");
    assertCcnaLegacyPreservationEligible(jobs as SocialPublication[], lessonId, legacy.day);
  }
  for (const owner of owners) {
    assert.ok(Object.keys(object(object(owner.metadata).nativeScheduleReceipt)).length > 0,
      "Confirm and reconcile the pending native reservation before supplementing its publication revision.");
  }
}

export function ccnaSupplementSnapshotDigest(row: unknown, jobs: Array<{ id: string }>) {
  // Normalize Dates like the on-disk JSON backup, but retain every row/job field.
  return ccnaContentDigest(JSON.parse(JSON.stringify({ row, jobs: [...jobs].sort((a, b) => a.id.localeCompare(b.id)) })));
}

export function buildCcnaSupplementUpdate(row: SupplementRow, candidate: PreparedCcnaSupplement,
  approved: ReturnType<typeof validateCcnaSupplementQa>, backup: { path: string; sha256: string }, now: Date,
  socialPreservation?: { activationSha256: string; beforeJobsDigest: string; afterJobsDigest: string }) {
  assertCcnaSupplementBase(row, candidate);
  const trace = object(row.generationTrace);
  assert.ok(trace.localSupplements === undefined || Array.isArray(trace.localSupplements), "Invalid existing supplement audit history.");
  const { review, qa, qaSha256 } = approved;
  const audit = {
    at: now.toISOString(), day: candidate.day, previousBaseContentDigest: candidate.coverage.baseContentDigest,
    previousUpdatedAt: iso(row.updatedAt), contentDigest: candidate.contentDigest,
    contentSha256: localReleaseSha(candidate.raw), coverageSha256: localReleaseSha(candidate.coverageRaw),
    reviewSha256: review.receiptSha256, qaSha256, backup,
    changes: candidate.coverage.changes, authorId: candidate.coverage.authorId,
    qa, paidApiCalls: false, socialDelivery: socialPreservation ? "legacy-api-revision-preserved" : "preserved-without-writes",
    ...(socialPreservation ? { socialPreservation } : {})
  };
  const generationTrace = {
    ...trace, reviewWasRun: true, editorialReview: review.validated.review,
    reviewEvidence: review.validated.evidence, reviewedContentDigest: candidate.contentDigest,
    independentReviewReceipt: {
      provider: "codex-independent-reviewer", reviewerId: review.receipt.reviewerId,
      reviewedAt: review.receipt.reviewedAt, authorizedByUser: true,
      receiptSha256: review.receiptSha256, fileSha256: review.entry.sha256,
      verifiedSources: review.entry.verifiedSources, limitations: review.entry.limitations, paidApiCalls: false
    },
    localSupplements: [...(trace.localSupplements as unknown[] || []), audit]
  };
  assert.deepEqual(ccnaReviewedRevisionIssues(candidate.content, generationTrace), []);
  return { content: candidate.content, sources: candidate.content.sources,
    qualityScore: candidate.quality.score, generationTrace };
}

export function assertCcnaSupplementPreserved(before: Record<string, unknown>, after: Record<string, unknown>,
  jobsBefore: Array<{ id: string }>, jobsAfter: Array<{ id: string }>,
  data: ReturnType<typeof buildCcnaSupplementUpdate>) {
  const untouched = (row: Record<string, unknown>) => Object.fromEntries(Object.entries(row)
    .filter(([key]) => !["content", "sources", "qualityScore", "generationTrace", "updatedAt"].includes(key)));
  assert.deepEqual(untouched(after), untouched(before), "Supplement altered protected lesson fields.");
  for (const key of ["content", "sources", "qualityScore", "generationTrace"] as const) {
    assert.deepEqual(after[key], data[key], `Saved ${key} differs from the validated supplement.`);
  }
  const audit = data.generationTrace.localSupplements.at(-1) as {
    reviewSha256: string; qaSha256: string; contentDigest: string;
    socialPreservation?: { activationSha256: string; beforeJobsDigest: string; afterJobsDigest: string }
  };
  if (!audit.socialPreservation) {
    assert.equal(ccnaSupplementSnapshotDigest(null, jobsAfter), ccnaSupplementSnapshotDigest(null, jobsBefore),
      "Social jobs changed during supplement; transaction must roll back.");
    return;
  }
  assert.deepEqual(jobsAfter.map(job => job.id).sort(), jobsBefore.map(job => job.id).sort(), "Social job set changed.");
  assert.equal(ccnaSupplementSnapshotDigest(null, jobsBefore), audit.socialPreservation.beforeJobsDigest);
  assert.equal(ccnaSupplementSnapshotDigest(null, jobsAfter), audit.socialPreservation.afterJobsDigest);
  for (const original of jobsBefore as SocialPublication[]) {
    const saved = (jobsAfter as SocialPublication[]).find(job => job.id === original.id)!;
    if (ccnaSocialJobDigest(original) === ccnaSocialJobDigest(saved)) continue;
    assert.equal(hasCcnaSocialPreservation(original.metadata), false, "An existing preservation marker is immutable.");
    const marker = assertCcnaPreservedJob(saved);
    assert.equal(marker.originalJobDigest, ccnaSocialJobDigest(original), "Only the preservation marker/timestamp may be added.");
    assert.equal(marker.activationSha256, audit.socialPreservation.activationSha256);
    assert.equal(marker.reviewSha256, audit.reviewSha256);
    assert.equal(marker.qaSha256, audit.qaSha256);
    assert.equal(marker.supplementedContentDigest, audit.contentDigest);
  }
}
