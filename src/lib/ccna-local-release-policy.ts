import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { ccnaCurriculum } from "./ccna-curriculum";
import { ccnaReviewableLessonSchema } from "./ccna-lesson-schema";
import { validateCcnaIndependentReview } from "./ccna-independent-review";
import { assertLinkedInProtocol } from "./linkedin-commentary";

export const ccnaLocalReleasePolicy = {
  version: 1,
  firstDay: 11,
  lastDay: 60,
  firstLinkedInTime: "2026-10-19T05:30:00.000Z",
  timeZone: "Asia/Kolkata",
  cadence: "daily-including-weekends",
  reviewerId: "01a13e77-9990-71d0-b15b-6295f9c59903",
  sourceVerifiedAt: "2026-10-15T09:08:05Z",
  currentExam: "200-301 v1.1",
  nextExam: "200-301 v2.0",
  transitionDate: "2027-02-03"
} as const;

export const localReleaseSha = (value: string | Uint8Array) => createHash("sha256").update(value).digest("hex");

export function ccnaLocalReleaseEntry(day: number) {
  assert.ok(Number.isInteger(day) && day >= 11 && day <= 60, "Only remaining Days 11-60 belong to this release plan.");
  const topic = ccnaCurriculum.find(item => item.sequence === day);
  assert.ok(topic, "Missing curriculum topic.");
  const due = new Date(Date.parse(ccnaLocalReleasePolicy.firstLinkedInTime) + (day - 11) * 86_400_000).toISOString();
  return { day, slug: topic.slug, title: topic.title, objective: topic.objective, v11: topic.v11, v20: topic.v20,
    websiteUrl: `https://www.qcsstudio.com/courses/ccna/lessons/${topic.slug}`, requestedLinkedInTime: due,
    state: "planned-not-generated", linkedinState: "not-scheduled" };
}

export function assertLocalCaption(caption: string, day: number) {
  const entry = ccnaLocalReleaseEntry(day);
  assertLinkedInProtocol(caption);
  assert.ok(caption.includes(entry.websiteUrl), "Caption must link to this exact QCS lesson.");
  assert.ok(new Set(caption.match(/#[A-Za-z][A-Za-z0-9_]*/g) || []).size >= 5, "Use at least five relevant distinct hashtags.");
  assert.ok(!/\.\.\.|\u2026/.test(caption), "Caption must not contain clipped sentences or ellipses.");
  assert.ok(caption.includes(`Day ${day}`), "Caption must name the correct course day.");
  assert.ok(caption.length <= 2700, "Keep full caption within the editorial limit.");
  return caption;
}

export function validateLocalReview(raw: string, receipt: any, day: number, now = new Date()) {
  const content = ccnaReviewableLessonSchema.parse(JSON.parse(raw));
  assert.equal(receipt.reviewerId, ccnaLocalReleasePolicy.reviewerId, "Use the authorized independent reviewer.");
  const reviewedAt = Date.parse(receipt.reviewedAt);
  assert.ok(Number.isFinite(reviewedAt) && reviewedAt <= now.getTime() + 60_000 && now.getTime() - reviewedAt <= 30 * 86_400_000, "Review must be dated and current within 30 days.");
  const matches = receipt.lessons.filter((item: any) => item.day === day);
  assert.equal(matches.length, 1, "Require exactly one independent receipt for this chapter.");
  const entry = matches[0];
  assert.equal(entry.sha256, localReleaseSha(raw), "Candidate changed after independent review.");
  const verified = new Set((entry.verifiedSources || []).filter((source: any) => typeof source.verification === "string" && source.verification.trim().length >= 20).map((source: any) => source.url));
  assert.ok(content.sources.every(source => verified.has(source.url)), "Every bibliography source needs recorded independent verification.");
  assert.ok(Array.isArray(entry.limitations) && entry.limitations.length, "Record runtime and other review limitations honestly.");
  const validated = validateCcnaIndependentReview(entry.evidence, content, content.sources.map(source => source.url));
  assert.equal(validated.review.passed, true, `Independent review failed: ${validated.review.issues.join(" ")}`);
  return { content, entry, validated };
}

export function assertLocalReleaseQa(qa: any, day: number, raw: string, caption: string, image: Uint8Array) {
  assert.equal(qa.day, day);
  assert.equal(qa.contentSha256, localReleaseSha(raw), "Visual QA must cover this exact content.");
  assert.equal(qa.captionSha256, localReleaseSha(caption), "Caption changed after QA.");
  assert.equal(qa.imageSha256, localReleaseSha(image), "Image changed after QA.");
  assert.equal(qa.visualChecked, true, "Inspect the actual rendered image before release.");
  assert.equal(qa.sourceLinksChecked, true, "Check the source destinations before release.");
  assert.ok(typeof qa.notes === "string" && qa.notes.length >= 30, "Record what was actually checked.");
  assert.ok(Number.isFinite(Date.parse(qa.checkedAt)), "QA needs a dated observation.");
}
