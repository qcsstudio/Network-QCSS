import assert from "node:assert/strict";
import test from "node:test";
import { hasNativeLinkedInOwnership, recordCcnaNativeScheduleReceipt } from "../src/lib/linkedin-native-schedule.ts";
import { ccnaContentDigest } from "../src/lib/ccna-generation-pipeline.ts";
import { queueLinkedInForCcnaLesson, rebuildLinkedInPublication, refreshLinkedInPublication, resetFailedLinkedInPublications, processLinkedInQueue } from "../src/lib/social-publications.ts";
import { publishCcnaLessonForNativeLinkedIn } from "../src/lib/ccna-learning.ts";

const nativeJob = () => ({ id: "native-job", channel: "linkedin", contentType: "ccna_lesson", contentId: "lesson", contentRevision: "reviewed-revision", status: "held", externalId: null, commentary: "Reviewed caption", updatedAt: new Date("2026-10-15T08:00:00Z"), metadata: { plannedDelivery: { provider: "linkedin-native-scheduler", notBefore: "2099-10-19T05:30:00.000Z" }, nativeScheduleReceipt: { confirmation: "Scheduled for 11:00 AM" } } });

function mockPrisma(t, value) {
  const previous = globalThis.prisma;
  value.$transaction ||= async action => action({ ...value, $queryRaw: async () => [] });
  globalThis.prisma = value;
  t.after(() => { if (previous) globalThis.prisma = previous; else delete globalThis.prisma; });
}

test("both pending native reservations and confirmed legacy schedules remain protected", () => {
  assert.equal(hasNativeLinkedInOwnership({ plannedDelivery: { provider: "linkedin-native-scheduler" } }), true);
  assert.equal(hasNativeLinkedInOwnership({ nativeScheduleReceipt: { scheduledUtc: "future" } }), true);
  assert.equal(hasNativeLinkedInOwnership({ deliveryReceipt: { externalId: "api-post" } }), false);
  assert.equal(hasNativeLinkedInOwnership(null), false);
});

test("queue preserves the exact native caption and receipt across lesson revisions", async t => {
  const job = nativeJob();
  mockPrisma(t, { socialPublication: { findMany: async () => [job] } });
  for (const updatedAt of [job.contentRevision, "newer-revision"]) {
    assert.equal(await queueLinkedInForCcnaLesson({ id: "lesson", status: "published", content: {}, updatedAt }), job);
  }
  assert.equal(job.commentary, "Reviewed caption");
  assert.equal(job.metadata.nativeScheduleReceipt.confirmation, "Scheduled for 11:00 AM");
});

test("held native Days 39-60 retain every job byte without any dispatch reservation", async t => {
  let job;
  mockPrisma(t, { socialPublication: { findMany: async () => [job] } });
  for (let day = 39; day <= 60; day++) {
    job = { ...nativeJob(), contentId: `lesson-${day}`, id: `native-${day}` };
    const before = structuredClone(job);
    assert.equal(await queueLinkedInForCcnaLesson({ id: job.contentId, sequence: day,
      status: "published", content: {}, updatedAt: "new-website-only-revision" }), job);
    assert.deepEqual(job, before);
  }
});

test("native rebuild and refresh fail before composition, media generation or delivery", async t => {
  const job = nativeJob();
  mockPrisma(t, { socialPublication: { findUnique: async () => job, findMany: async () => [job] } });
  await assert.rejects(rebuildLinkedInPublication(job.id), /native scheduler/);
  await assert.rejects(refreshLinkedInPublication(job.id, true), /native scheduler/);
});

test("reset cannot reactivate a failed native schedule or its stale revision", async t => {
  const job = nativeJob();
  mockPrisma(t, { socialPublication: { findMany: async ({ where }) => where.status === "failed" ? [{ ...job, status: "failed" }] : [job] } });
  assert.equal(await resetFailedLinkedInPublications(), 0);
});

test("queue processor holds an accidentally queued native job without any API delivery", async t => {
  const job = { ...nativeJob(), status: "queued" };
  const writes = [];
  mockPrisma(t, { socialPublication: {
    findMany: async ({ where }) => where.status === "publishing" ? [] : [job],
    updateMany: async args => { writes.push(args); return { count: 1 }; }
  } });
  assert.deepEqual(await processLinkedInQueue(1, job.id), [{ id: job.id, status: "held" }]);
  assert.equal(writes.at(-1).data.status, "held");
  assert.ok(!writes.some(write => write.data.status === "publishing"));
  assert.ok(writes.every(write => write.data.metadata === undefined && write.data.commentary === undefined));
});

test("receipt rejects an unpublished, edited or unreviewed current lesson before writing", async t => {
  let lesson;
  let writes = 0;
  const tx = { ccnaLesson: { findUniqueOrThrow: async () => lesson }, socialPublication: { updateMany: async () => { writes++; } } };
  mockPrisma(t, { $transaction: async (action, options) => { assert.equal(options.isolationLevel, "Serializable"); return action(tx); } });
  const input = { lessonId: "lesson", jobId: "job", publicationRevision: "2026-10-15T08:00:00.000Z", contentDigest: ccnaContentDigest({}), commentary: "Reviewed caption", scheduledUtc: "2099-10-19T05:30:00Z", confirmedAt: "2026-10-15T09:00:00Z", receipt: {} };
  for (const state of [
    { status: "draft", updatedAt: new Date(input.publicationRevision), content: {} },
    { status: "published", updatedAt: new Date("2026-10-15T08:01:00Z"), content: {} },
    { status: "published", updatedAt: new Date(input.publicationRevision), content: { changed: true } },
    { status: "published", updatedAt: new Date(input.publicationRevision), content: {}, generationTrace: {} }
  ]) {
    lesson = state;
    await assert.rejects(recordCcnaNativeScheduleReceipt(input), /unpublished, changed or no longer independently reviewed/);
  }
  assert.equal(writes, 0);
});

test("native publication refuses an existing application delivery before changing the website", async t => {
  const tx = { socialPublication: { findMany: async () => [{ ...nativeJob(), status: "queued", metadata: {} }] } };
  mockPrisma(t, { $transaction: async (action, options) => { assert.equal(options.isolationLevel, "Serializable"); return action(tx); } });
  await assert.rejects(publishCcnaLessonForNativeLinkedIn("lesson", "test", { expectedContentDigest: "digest", commentary: "caption", notBefore: "2099-10-19T05:30:00Z" }), /existing LinkedIn delivery/);
});

test("native publication runs quality checks within the reservation transaction", async t => {
  let committed = false, socialWrites = 0;
  const tx = {
    socialPublication: { findMany: async () => [], create: async () => { socialWrites++; } },
    ccnaLesson: { findUnique: async () => ({ id: "lesson", status: "draft", content: { changed: true } }) }
  };
  mockPrisma(t, { $transaction: async (action, options) => {
    assert.equal(options.isolationLevel, "Serializable");
    const result = await action(tx); committed = true; return result;
  } });
  await assert.rejects(publishCcnaLessonForNativeLinkedIn("lesson", "test", { expectedContentDigest: "different", commentary: "caption", notBefore: "2099-10-19T05:30:00Z" }), /independently reviewed release candidate/);
  assert.equal(committed, false);
  assert.equal(socialWrites, 0);
});
