import assert from "node:assert/strict";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { loadEnvConfig } from "@next/env";
import { ccnaCurriculum, ccnaTopicBySlug } from "../src/lib/ccna-curriculum";
import { ccnaReviewableLessonSchema } from "../src/lib/ccna-lesson-schema";
import { evaluateCcnaLessonForTopic } from "../src/lib/ccna-content-agent";
import { ccnaContentDigest, ccnaReviewedRevisionIssues } from "../src/lib/ccna-generation-pipeline";
import { ccnaLocalReleaseEntry, ccnaLocalReleasePolicy, localReleaseSha, assertLocalCaption, assertLocalReleaseQa, validateLocalReview } from "../src/lib/ccna-local-release-policy";

const root = "test-results";
const file = (day: number, suffix: string) => `${root}/ccna-day${day}-${suffix}`;
const json = async (path: string) => JSON.parse(await readFile(path, "utf8"));
const save = (path: string, value: unknown) => writeFile(path, JSON.stringify(value, null, 2) + "\n");

async function main() {
  const [mode = "plan", dayText] = process.argv.slice(2);
  assert.ok(["plan", "check", "preview", "stage", "review", "publish", "receipt"].includes(mode), "Use plan, check, preview, stage, review, publish or receipt followed by a day.");
  await mkdir(root, { recursive: true });
  if (mode === "plan") {
    const manifest = { ...ccnaLocalReleasePolicy, note: "Dates are targets, not active LinkedIn schedules. No unwritten lesson is approved by this manifest.",
      lessons: ccnaCurriculum.filter(topic => topic.sequence >= 11).map(topic => ccnaLocalReleaseEntry(topic.sequence)) };
    await save(`${root}/ccna-full-course-release-plan.json`, manifest);
    console.log(JSON.stringify({ count: manifest.lessons.length, first: manifest.lessons[0], last: manifest.lessons.at(-1) }, null, 2));
    return;
  }
  const day = Number(dayText);
  const plan = ccnaLocalReleaseEntry(day);
  const raw = await readFile(file(day, "corrected-content.json"), "utf8");
  const content = ccnaReviewableLessonSchema.parse(JSON.parse(raw));
  const topic = ccnaTopicBySlug(plan.slug)!;
  const quality = evaluateCcnaLessonForTopic(topic, content);
  assert.equal(quality.ready, true, JSON.stringify(quality.issues));
  if (mode === "check") { console.log(JSON.stringify({ day, quality, digest: ccnaContentDigest(content), sha256: localReleaseSha(raw) }, null, 2)); return; }
  if (mode === "preview") {
    const caption = assertLocalCaption(await readFile(file(day, "linkedin-caption.txt"), "utf8"), day);
    const { ccnaSocialVisual } = await import("../src/lib/ccna-social-visual");
    const snapshot = await json(`${root}/ccna-full-course-snapshot.json`);
    const row = snapshot.lessons.find((item: any) => item.sequence === day);
    assert.ok(row);
    const image = await ccnaSocialVisual({ ...row, content }, 1920, 1080);
    await writeFile(file(day, "linkedin.png"), Buffer.from(await image.arrayBuffer()));
    console.log(JSON.stringify({ day, image: file(day, "linkedin.png"), captionLength: caption.length, readyForVisualInspection: true }));
    return;
  }
  let review: ReturnType<typeof validateLocalReview> | null = null;
  let receipt: any = null;
  let receiptRaw = "";
  if (["review", "publish"].includes(mode)) {
    receiptRaw = await readFile(file(day, "independent-review.json"), "utf8");
    receipt = JSON.parse(receiptRaw);
    review = validateLocalReview(raw, receipt, day);
  }
  const caption = mode === "publish" || mode === "receipt" ? assertLocalCaption(await readFile(file(day, "linkedin-caption.txt"), "utf8"), day) : "";
  if (mode === "publish") {
    assertLocalReleaseQa(await json(file(day, "release-qa.json")), day, raw, caption, await readFile(file(day, "linkedin.png")));
    assert.ok(Date.now() - Date.parse(ccnaLocalReleasePolicy.sourceVerifiedAt) <= 30 * 86_400_000, "Recheck official exam notices and update the source snapshot before continuing this release series.");
  }
  loadEnvConfig(process.cwd(), true);
  process.env.NEXT_PUBLIC_SITE_URL = "https://www.qcsstudio.com";
  const { getPrismaClient } = await import("../src/lib/prisma");
  const prisma = getPrismaClient();
  try {
    const row = await prisma.ccnaLesson.findUniqueOrThrow({ where: { slug: plan.slug } });
    assert.equal(row.sequence, day);
    const jobs = await prisma.socialPublication.findMany({ where: { contentType: "ccna_lesson", contentId: row.id, channel: "linkedin" } });
    const trace: any = row.generationTrace || {};
    assert.ok(!["generating", "retry", "skipped"].includes(row.status), "An active or excluded lesson cannot be replaced by this workflow.");
    if (mode !== "receipt") assert.ok(!jobs.some(job => ["queued", "retry", "publishing", "published"].includes(job.status) || job.externalId), "Existing social delivery needs reconciliation before making changes.");
    await save(file(day, `backup-${mode}-${Date.now()}.json`), { row, jobs });
    if (mode === "stage") {
      assert.equal(row.publishedAt, null, "Never overwrite published content during local staging.");
      assert.ok(!jobs.length, "A staged chapter must not already have a social release.");
      if (ccnaContentDigest(row.content) === ccnaContentDigest(content)) { console.log("Identical candidate already saved; no review invalidated."); return; }
      const { reviewedContentDigest, editorialReview, reviewEvidence, validationPasses, checkpoint, independentReviewReceipt, ...retained } = trace;
      const saved = await prisma.ccnaLesson.updateMany({ where: { id: row.id, updatedAt: row.updatedAt, status: row.status }, data: {
        content: content as any, status: "needs_review", generationStartedAt: null, qualityScore: quality.score,
        lastError: "Local candidate awaits an independent review of its exact revision.",
        generationTrace: { ...retained, publishWhenReady: false, reviewWasRun: false,
          publicationJob: { ...(trace.publicationJob || {}), actor: "admin@qcsstudio.com", delivery: "held" },
          localPreparation: { at: new Date().toISOString(), paidApiCalls: false, contentDigest: ccnaContentDigest(content) } } as any
      } });
      assert.equal(saved.count, 1, "Concurrent edit detected.");
    } else if (mode === "review") {
      assert.equal(row.publishedAt, null);
      assert.equal(ccnaContentDigest(row.content), ccnaContentDigest(content), "Saved draft differs from reviewed file.");
      const nextTrace = { ...trace, publishWhenReady: false, reviewWasRun: true,
        editorialReview: review!.validated.review, reviewEvidence: review!.validated.evidence, reviewedContentDigest: ccnaContentDigest(content),
        independentReviewReceipt: { provider: "codex-independent-reviewer", reviewerId: receipt.reviewerId, reviewedAt: receipt.reviewedAt,
          authorizedByUser: true, receiptSha256: localReleaseSha(receiptRaw), fileSha256: review!.entry.sha256,
          verifiedSources: review!.entry.verifiedSources, limitations: review!.entry.limitations, paidApiCalls: false },
        publicationJob: { ...(trace.publicationJob || {}), actor: "admin@qcsstudio.com", delivery: "held" } };
      assert.deepEqual(ccnaReviewedRevisionIssues(content, nextTrace), []);
      const saved = await prisma.ccnaLesson.updateMany({ where: { id: row.id, updatedAt: row.updatedAt, status: row.status }, data: {
        status: "draft", lastError: null, generationStartedAt: null, qualityScore: quality.score, generationTrace: nextTrace as any
      } });
      assert.equal(saved.count, 1, "Concurrent edit detected.");
    } else if (mode === "publish") {
      assert.equal(ccnaContentDigest(row.content), ccnaContentDigest(content));
      assert.deepEqual(ccnaReviewedRevisionIssues(content, trace), []);
      assert.equal(trace.independentReviewReceipt?.receiptSha256, localReleaseSha(receiptRaw), "Saved review differs from the release receipt.");
      assert.equal(await prisma.ccnaLesson.count({ where: { sequence: { lt: day }, status: "published" } }), day - 1, "Publish earlier chapters first.");
      const { publishCcnaLessonForNativeLinkedIn } = await import("../src/lib/ccna-learning");
      const { lesson: published, job } = await publishCcnaLessonForNativeLinkedIn(row.id, "admin@qcsstudio.com", {
        expectedContentDigest: ccnaContentDigest(content), commentary: caption, notBefore: plan.requestedLinkedInTime
      });
      assert.equal(job.status, "held");
      assert.equal(job.commentary, caption, "Existing held delivery differs; reconcile rather than overwriting.");
      const output = { ...plan, state: "website-published", websitePublished: true, socialJobId: job.id, publicationRevision: published.updatedAt,
        commentary: caption, imageUrl: job.imageUrl, contentDigest: ccnaContentDigest(content),
        linkedinState: (job.metadata as any)?.nativeScheduleReceipt ? "scheduled-in-linkedin" : "awaiting-browser-confirmation" };
      await save(file(day, "release-result.json"), output);
      console.log(JSON.stringify(output, null, 2));
      return;
    } else if (mode === "receipt") {
      const release = await json(file(day, "release-result.json"));
      const browser = await json(file(day, "linkedin-browser-receipt.json"));
      assert.equal(browser.day, day);
      assert.equal(browser.status, "scheduled");
      assert.equal(browser.account, "Ravi K Sankhyan");
      assert.equal(browser.imageAttached, true);
      assert.equal(browser.scheduledUtc, plan.requestedLinkedInTime);
      assert.ok(Date.parse(browser.scheduledUtc) > Date.now(), "Reconcile a past slot as published, not newly scheduled.");
      assert.ok(browser.confirmation?.includes("11:00"));
      assert.ok(Number.isFinite(Date.parse(browser.confirmedAt)));
      assert.equal(browser.commentary.replace(/\s+/g, " ").trim(), caption.replace(/\s+/g, " ").trim());
      const job = jobs.find(item => item.id === release.socialJobId);
      assert.ok(job && job.status === "held" && !job.externalId);
      assert.equal(job.contentRevision, release.publicationRevision);
      assert.equal(job.commentary, caption);
      assert.equal(release.contentDigest, ccnaContentDigest(content), "Local content differs from the published release.");
      const { recordCcnaNativeScheduleReceipt } = await import("../src/lib/linkedin-native-schedule");
      await recordCcnaNativeScheduleReceipt({ lessonId: row.id, jobId: job.id, publicationRevision: release.publicationRevision,
        contentDigest: release.contentDigest, commentary: caption, scheduledUtc: browser.scheduledUtc, confirmedAt: browser.confirmedAt,
        receipt: { ...browser, commentarySha256: localReleaseSha(caption), verificationMode: "authenticated-browser", applicationDeliveryHeldToPreventDuplicate: true }
      });
      await save(file(day, "delivery-result.json"), { day, jobId: job.id, status: "scheduled", scheduledUtc: browser.scheduledUtc });
    }
    console.log(JSON.stringify({ day, operation: mode, completed: true }));
  } finally { await prisma.$disconnect(); }
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
