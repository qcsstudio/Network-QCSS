import assert from "node:assert/strict";
import test from "node:test";
import {
  assertCcnaLegacyPreservationEligible, assertCcnaPreservedJob, ccnaPreservationSourceFiles,
  ccnaSocialPreservationKey, hasCcnaSocialPreservation, preserveCcnaApiJob,
  validateCcnaPreservationActivation, withCcnaSocialGuard
} from "../src/lib/ccna-social-preservation.ts";
import { hasNativeLinkedInOwnership } from "../src/lib/linkedin-native-schedule.ts";
import {
  processLinkedInQueue, queueLinkedInForCcnaLesson, rebuildLinkedInPublication,
  rebuildLinkedInPublicationsSince, refreshLinkedInPublication,
  refreshRecentOutdatedLinkedInPublications, resetFailedLinkedInPublications
} from "../src/lib/social-publications.ts";

const now = new Date("2026-10-20T10:00:00.000Z");
const hash = "a".repeat(64);
const sources = Object.fromEntries(ccnaPreservationSourceFiles.map(file => [file, hash]));
// Synthetic in-memory attestations only. These are not deployment or review evidence.
function activationReceipt() {
  return {
    version: 1, scope: "reviewed-website-supplements-days-2-3-6",
    codeReview: { reviewerId: "synthetic-independent-reviewer", independent: true, approved: true,
      reviewedAt: "2026-10-20T08:00:00.000Z", evidence: "Synthetic test review, not a real approval." },
    sourceSha256: { ...sources },
    deployment: { revision: "synthetic-build", verifiedAt: "2026-10-20T09:00:00.000Z",
      evidence: "Synthetic test activation, not a real deployment.",
      allWritersRunningReviewedCode: true, inFlightOperationsDrained: true }
  };
}
function original() {
  return {
    id: "delivered-api-job", channel: "linkedin", contentType: "ccna_lesson", contentId: "lesson",
    contentRevision: "2026-09-02T08:00:00.000Z", status: "published", externalId: "urn:li:share:synthetic",
    commentary: "Original reviewed caption.\n\nOriginal paragraphs.", sourceUrl: "https://www.qcsstudio.com/lesson",
    imageUrl: "https://www.qcsstudio.com/image?original=1", attempts: 1, lastError: null,
    createdAt: new Date("2026-09-02T08:00:00.000Z"), updatedAt: new Date("2026-09-02T09:00:00.000Z"),
    publishedAt: new Date("2026-09-02T09:00:00.000Z"), lastAttemptAt: new Date("2026-09-02T08:59:00.000Z"),
    nextAttemptAt: new Date("2026-09-02T08:30:00.000Z"),
    metadata: { deliveryReceipt: { externalId: "urn:li:share:synthetic", headers: { retained: "exact" } },
      previousExternalIds: ["synthetic-older-post"], permalink: "https://www.linkedin.com/synthetic",
      lineage: { original: true }, commentaryPolicyVersion: 0 }
  };
}
function preserve(job = original(), day = 2) {
  return preserveCcnaApiJob(job, {
    day, lessonId: "lesson", baseContentDigest: hash, supplementedContentDigest: hash,
    reviewSha256: hash, qaSha256: hash,
    activation: validateCcnaPreservationActivation(JSON.stringify(activationReceipt()), sources, now),
    beforeSnapshot: { path: "synthetic-before-backup.json", sha256: hash }, now
  });
}

function mocked(t, jobs, options = {}) {
  const events = [];
  const socialPublication = {
    findMany: async ({ where }) => {
      events.push("read");
      if (where.status === "failed") return options.failed || [];
      if (where.status === "publishing") return options.interrupted || [];
      if (where.status?.in) return (options.due || []).filter(job =>
        (typeof where.id !== "string" || job.id === where.id) &&
        !where.id?.notIn?.includes(job.id) && !where.NOT?.contentId?.in?.includes(job.contentId));
      return jobs;
    },
    findUnique: async ({ where }) => jobs.find(job => job.id === where.id),
    findFirst: async () => jobs.find(job => job.status === "published"),
    update: async () => assert.fail("No social mutation or API delivery may be reached."),
    create: async () => assert.fail("No social enqueue may be reached."),
    updateMany: async args => {
      // Only the unrelated non-CCNA bulk recovery query is allowed.
      assert.deepEqual(args.where.contentType, { not: "ccna_lesson" });
      assert.equal(args.where.status, "publishing");
      events.push("non-ccna-recovery");
      return { count: 0 };
    }
  };
  const prisma = {
    socialPublication,
    ccnaLesson: { findUnique: async ({ select }) => {
      if (select?.sequence) return options.lesson || { sequence: 4 };
      return options.lesson || assert.fail("Preserved jobs need no lesson/material lookup.");
    } },
    $queryRaw: async (strings) => {
      const sql = strings.join("?");
      assert.match(sql, /FOR UPDATE/);
      events.push(sql.includes('"CcnaLesson"') ? "lock-lesson" : "lock-jobs");
      await options.onLock?.(sql);
      return [];
    },
    $transaction: async (action, settings) => {
      assert.equal(settings.isolationLevel, "Serializable");
      assert.equal(settings.timeout, 15000);
      events.push("begin");
      try { return await action(prisma); }
      finally { events.push("end"); }
    }
  };
  const previous = globalThis.prisma;
  globalThis.prisma = prisma;
  t.after(() => { if (previous) globalThis.prisma = previous; else delete globalThis.prisma; });
  return { prisma, events };
}

test("the explicit freeze retains the original API identity, receipt, revision and every other job field", () => {
  for (const day of [2, 3, 6]) {
    const before = original(), job = preserve(before, day);
    const marker = assertCcnaPreservedJob(job);
    assert.equal(marker.day, day);
    assert.equal(hasNativeLinkedInOwnership(job.metadata), false);
    assert.equal(hasCcnaSocialPreservation(job.metadata), true);
    const restored = structuredClone(job);
    delete restored.metadata[ccnaSocialPreservationKey];
    restored.updatedAt = before.updatedAt;
    assert.deepEqual(restored, before);
    assert.equal(preserve(job, day), job, "Later supplements must not rewrite the freeze.");
    assert.equal(hasCcnaSocialPreservation(before.metadata), false, "Input is not mutated.");
  }
});

test("only delivered legacy API jobs for Days 2/3/6 are eligible", () => {
  for (const day of [1, 4, 12, 29, 60]) assert.throws(() => preserve(original(), day));
  for (const patch of [
    { externalId: null }, { publishedAt: null }, { contentRevision: "" }, { contentId: "other" },
    { channel: "facebook" }, { contentType: "content_post" },
    { status: "queued" }, { status: "retry" }, { status: "publishing" }, { status: "failed" },
    { metadata: {} }, { metadata: { deliveryReceipt: {} } },
    { metadata: { deliveryReceipt: { original: true }, nativeScheduleReceipt: { existing: true } } }
  ]) assert.throws(() => preserve({ ...original(), ...patch }));
  assert.throws(() => assertCcnaLegacyPreservationEligible([], "lesson", 2));
});

test("malformed markers and any changed job field fail closed, including failure/retry status", () => {
  const saved = preserve();
  for (const mutate of [
    job => { job.externalId = "replacement"; }, job => { job.contentRevision = "new"; },
    job => { job.commentary += " Edited"; }, job => { job.imageUrl = "changed"; },
    job => { job.publishedAt = now; }, job => { job.updatedAt = new Date(now.getTime() + 1); },
    job => { job.status = "failed"; }, job => { job.attempts++; },
    job => { job.metadata.deliveryReceipt.headers.retained = "changed"; },
    job => { job.metadata.nativeScheduleReceipt = { forged: true }; },
    job => { job.metadata[ccnaSocialPreservationKey] = null; },
    job => { job.metadata[ccnaSocialPreservationKey].version = 2; }
  ]) {
    const job = structuredClone(saved); mutate(job);
    assert.equal(hasCcnaSocialPreservation(job.metadata), true);
    assert.throws(() => assertCcnaPreservedJob(job));
  }
});

test("activation is bound to every reviewed source/test and a recent drained deployment", () => {
  for (const mutate of [
    r => { r.codeReview.approved = false; }, r => { r.codeReview.independent = false; },
    r => { r.codeReview.reviewedAt = "2026-10-20T09:30:00.000Z"; },
    r => { r.deployment.verifiedAt = "2026-10-19T08:00:00.000Z"; },
    r => { r.deployment.verifiedAt = "2099-10-20T09:00:00.000Z"; },
    r => { r.deployment.allWritersRunningReviewedCode = false; },
    r => { r.deployment.inFlightOperationsDrained = false; },
    r => { delete r.sourceSha256[ccnaPreservationSourceFiles[0]]; },
    r => { r.sourceSha256[ccnaPreservationSourceFiles[0]] = "b".repeat(64); }
  ]) {
    const receipt = activationReceipt(); mutate(receipt);
    assert.throws(() => validateCcnaPreservationActivation(JSON.stringify(receipt), sources, now));
  }
});

test("queue returns the original delivered job for either website revision without social writes", async t => {
  const job = preserve(), before = structuredClone(job), { events } = mocked(t, [job]);
  for (const updatedAt of [job.contentRevision, "supplemented-website-revision"]) {
    assert.equal(await queueLinkedInForCcnaLesson({ id: "lesson", content: {}, status: "published", updatedAt }), job);
  }
  assert.deepEqual(job, before);
  assert.equal(events.filter(event => event === "lock-lesson").length, 2);
  assert.ok(events.indexOf("lock-lesson") < events.indexOf("lock-jobs"));
});

test("refresh, force-media rebuild and bulk paths cannot replace or edit preserved external posts", async t => {
  const job = preserve(), before = structuredClone(job);
  mocked(t, [job]);
  for (const replaceMedia of [false, true]) {
    await assert.rejects(refreshLinkedInPublication(job.id, replaceMedia, "Attempted override", true), /preserves this delivered/);
  }
  await assert.rejects(rebuildLinkedInPublication(job.id), /preserves this delivered/);
  await assert.rejects(rebuildLinkedInPublicationsSince(new Date("2026-01-01"), true), /preserves this delivered/);
  const preview = await rebuildLinkedInPublicationsSince(new Date("2026-01-01"), false);
  assert.equal(preview[0].externalId, job.externalId);
  const refresh = await refreshRecentOutdatedLinkedInPublications();
  assert.equal(refresh[0].status, "failed");
  assert.match(refresh[0].error, /preserves this delivered/);
  assert.deepEqual(job, before);
});

test("failed sibling reset, queued retry and interrupted recovery cannot bypass a delivered owner", async t => {
  const job = preserve(), before = structuredClone(job);
  const sibling = { ...original(), id: "stale-job", status: "retry", externalId: null };
  const { events } = mocked(t, [job, sibling], {
    failed: [{ ...sibling, status: "failed" }],
    interrupted: [{ ...sibling, status: "publishing" }], due: [sibling]
  });
  assert.equal(await resetFailedLinkedInPublications(), 0);
  assert.deepEqual(await processLinkedInQueue(1), [{ id: sibling.id, status: "preserved" }]);
  assert.deepEqual(job, before);
  assert.equal(events.filter(event => event === "non-ccna-recovery").length, 1);
});

test("corrupted delivered status is an error, never permission to reset or recover the preserved job", async t => {
  const job = { ...preserve(), status: "publishing" }, before = structuredClone(job);
  mocked(t, [job], { interrupted: [job], failed: [{ ...job, status: "failed" }] });
  await assert.rejects(processLinkedInQueue(1), /changed status/);
  await assert.rejects(resetFailedLinkedInPublications(), /changed status/);
  assert.deepEqual(job, before);
});

test("the guard re-reads ownership after acquiring locks, so a concurrent supplement wins before API work", async t => {
  const jobs = [original()];
  let releaseLock, reachedLock;
  const waiting = new Promise(resolve => { reachedLock = resolve; });
  const unlocked = new Promise(resolve => { releaseLock = resolve; });
  const { prisma, events } = mocked(t, jobs, { onLock: async sql => {
    if (sql.includes('"CcnaLesson"')) { reachedLock(); await unlocked; }
  } });
  const operation = withCcnaSocialGuard(prisma, jobs[0], async () => assert.fail("No remote work after concurrent preservation."));
  const rejection = assert.rejects(operation, /preserves this delivered/);
  await waiting;
  jobs[0] = preserve(jobs[0]);
  releaseLock();
  await rejection;
  assert.deepEqual(events, ["begin", "lock-lesson", "lock-jobs", "read", "end"]);
});

test("a serializable lock failure aborts without API work and without automatic retry", async t => {
  const { prisma, events } = mocked(t, [original()], { onLock: async () => {
    throw Object.assign(new Error("Synthetic serialization conflict"), { code: "P2034" });
  } });
  await assert.rejects(withCcnaSocialGuard(prisma, original(), async () => assert.fail("Must not run")), /serialization conflict/);
  assert.equal(events.filter(event => event === "begin").length, 1);
});

test("DB-only CCNA work remains inside the guard transaction; other content is unchanged", async t => {
  const job = original(), { prisma, events } = mocked(t, [job]);
  let finish, started;
  const begun = new Promise(resolve => { started = resolve; });
  const done = new Promise(resolve => { finish = resolve; });
  const running = withCcnaSocialGuard(prisma, job, async client => {
    assert.equal(client, prisma);
    started(); await done; return "completed";
  });
  await begun;
  assert.ok(!events.includes("end"));
  finish();
  assert.equal(await running, "completed");
  assert.equal(events.at(-1), "end");
  events.length = 0;
  assert.equal(await withCcnaSocialGuard(prisma, { contentType: "content_post", contentId: "other" }, async () => "unchanged"), "unchanged");
  assert.deepEqual(events, []);
});

test("ordinary unmarked CCNA queue still returns an identical delivered revision under the lock", async t => {
  const job = original();
  mocked(t, [job], { lesson: { status: "published", updatedAt: new Date(job.contentRevision) } });
  assert.equal(await queueLinkedInForCcnaLesson({
    id: "lesson", status: "published", content: {}, updatedAt: job.contentRevision
  }), job);
});

test("ordinary failed CCNA jobs still reset under CAS when no preservation or native owner exists", async t => {
  const job = { ...original(), status: "failed", externalId: null };
  const { prisma, events } = mocked(t, [job], { failed: [job] });
  let writes = 0;
  prisma.socialPublication.updateMany = async ({ where, data }) => {
    assert.equal(events.at(-1), "read");
    assert.deepEqual(where, { id: job.id, updatedAt: job.updatedAt, status: "failed" });
    assert.equal(data.status, "queued");
    writes++;
    return { count: 1 };
  };
  assert.equal(await resetFailedLinkedInPublications(), 1);
  assert.equal(writes, 1);
});

test("a queued job changed after discovery cannot be claimed using stale data", async t => {
  const job = { ...original(), status: "retry", externalId: null };
  const { prisma } = mocked(t, [job], { due: [job] });
  let claims = 0;
  prisma.socialPublication.updateMany = async ({ where }) => {
    if (where.contentType) {
      assert.deepEqual(where.contentType, { not: "ccna_lesson" });
      return { count: 0 };
    }
    assert.deepEqual(where, { id: job.id, updatedAt: job.updatedAt, status: "retry", externalId: null });
    claims++;
    return { count: 0 };
  };
  assert.deepEqual(await processLinkedInQueue(1), []);
  assert.equal(claims, 1);
});

test("native ownership arriving while a CCNA worker waits still blocks its API claim", async t => {
  const job = { ...original(), status: "queued", externalId: null };
  const { prisma } = mocked(t, [job], { due: [job], onLock: async sql => {
    if (sql.includes('"CcnaLesson"')) job.metadata = { plannedDelivery: { provider: "linkedin-native-scheduler" } };
  } });
  prisma.socialPublication.updateMany = async ({ where, data }) => {
    if (where.contentType) return { count: 0 };
    assert.equal(data.status, "held");
    assert.deepEqual(job.metadata, { plannedDelivery: { provider: "linkedin-native-scheduler" } });
    return { count: 1 };
  };
  assert.deepEqual(await processLinkedInQueue(1), [{ id: job.id, status: "held" }]);
  assert.equal(job.status, "queued");
});

test("delivered Days 2/3/6 are held even before a preservation marker is installed", async t => {
  const job = original(), before = structuredClone(job), lesson = { sequence: 2 };
  mocked(t, [job], { lesson, failed: [{ ...job, status: "failed" }],
    interrupted: [{ ...job, status: "publishing" }], due: [{ ...job, status: "retry" }] });
  for (const sequence of [2, 3, 6]) {
    lesson.sequence = sequence;
    await assert.rejects(queueLinkedInForCcnaLesson({ id: "lesson", status: "published", content: {}, updatedAt: "changed" }), /awaits reviewed supplement preservation/);
    await assert.rejects(refreshLinkedInPublication(job.id, false), /awaits reviewed supplement preservation/);
    await assert.rejects(refreshLinkedInPublication(job.id, true), /awaits reviewed supplement preservation/);
    await assert.rejects(rebuildLinkedInPublication(job.id), /awaits reviewed supplement preservation/);
    await assert.rejects(resetFailedLinkedInPublications(), /awaits reviewed supplement preservation/);
    await assert.rejects(processLinkedInQueue(), /awaits reviewed supplement preservation/);
  }
  assert.deepEqual(job, before);
  assert.equal(hasCcnaSocialPreservation(job.metadata), false, "Guards do not manufacture markers.");
});

test("malformed preservation plus native ownership is rejected under lock by every public entry point", async t => {
  const job = original();
  job.metadata = { [ccnaSocialPreservationKey]: null, nativeScheduleReceipt: { confirmation: "synthetic" } };
  const before = structuredClone(job);
  const { events } = mocked(t, [job], { failed: [{ ...job, status: "failed" }], due: [{ ...job, status: "retry" }] });
  await assert.rejects(queueLinkedInForCcnaLesson({ id: job.contentId, status: "published", content: {}, updatedAt: "new" }));
  await assert.rejects(refreshLinkedInPublication(job.id, false));
  await assert.rejects(refreshLinkedInPublication(job.id, true));
  await assert.rejects(rebuildLinkedInPublication(job.id));
  await assert.rejects(resetFailedLinkedInPublications());
  await assert.rejects(processLinkedInQueue(1));
  assert.equal(events.filter(event => event === "lock-jobs").length, 6);
  assert.deepEqual(job, before);
});

test("a valid API preservation owner conflicts with a separate native-owned sibling", async t => {
  const job = preserve(), native = { ...original(), id: "native-sibling", status: "held",
    metadata: { nativeScheduleReceipt: { confirmation: "synthetic" } } };
  mocked(t, [job, native]);
  await assert.rejects(queueLinkedInForCcnaLesson({ id: job.contentId, status: "published", content: {}, updatedAt: "new" }), /conflicts with native/);
});
