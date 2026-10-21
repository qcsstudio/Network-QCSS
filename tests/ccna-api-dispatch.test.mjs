import assert from "node:assert/strict";
import test, { mock } from "node:test";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

// Keep ordinary test commands working; the real entry-point probes run in an
// isolated process with module mocks and no possible real fetch.
if (!process.execArgv.includes("--experimental-test-module-mocks")) {
  test("isolated CCNA API dispatch regressions", () => {
    const env = { ...process.env, DATABASE_URL: "", OPENAI_API_KEY: "" };
    delete env.NODE_TEST_CONTEXT;
    const child = spawnSync(process.execPath, ["--experimental-test-module-mocks", "--import", "tsx", "--test", fileURLToPath(import.meta.url)],
      { encoding: "utf8", env, timeout: 120_000 });
    assert.equal(child.status, 0, child.stdout + child.stderr);
    assert.match(child.stdout, /tests 9\b/, "The child must actually execute every dispatch regression.");
  });
} else {
  process.env.NEXT_PUBLIC_SITE_URL = "https://www.qcsstudio.com";
  const actualLinkedIn = await import("../src/lib/linkedin.ts");
  const actualLearning = await import("../src/lib/ccna-learning.ts");
  const { applyCcnaLayeredContract } = await import("../src/lib/ccna-layered-contract.ts");
  const { createEditorialLineage } = await import("../src/lib/editorial-story-lineage.ts");
  const { linkedInCommentaryPolicyVersion } = await import("../src/lib/linkedin-commentary.ts");
  const { preserveCcnaApiJob, validateCcnaPreservationActivation, ccnaPreservationSourceFiles, ccnaApiDispatchKey } =
    await import("../src/lib/ccna-social-preservation.ts");
  let state;
  const remote = async kind => {
    assert.equal(state.inTransaction, false, "Remote work must not execute in a rollbackable transaction.");
    const held = state.jobs.find(job => job.metadata?.[ccnaApiDispatchKey]?.state === "in-flight");
    assert.equal(held?.status, "needs_review", "The dispatch fence must already be durable.");
    state.remote.push(kind);
    if (state.remoteTimeout) throw new Error("Synthetic timeout after remote success");
    return { externalId: `synthetic-${state.remote.length}`, receipt: { synthetic: true }, permalink: "https://www.linkedin.com/synthetic" };
  };
  mock.module("../src/lib/linkedin.ts", { exports: { ...actualLinkedIn,
    publishLinkedInPost: async () => remote("post"),
    updateLinkedInPostCommentary: async () => remote("commentary"),
    deleteLinkedInPost: async () => remote("delete")
  } });
  mock.module("../src/lib/ccna-learning.ts", { exports: { ...actualLearning,
    getCcnaLessonById: async id => ({ id, sequence: 4, status: "published", updatedAt: revision,
      title: "Synthetic protocol lesson", slug: "synthetic-protocol", content: applyCcnaLayeredContract() })
  } });
  const { processLinkedInQueue, refreshLinkedInPublication, rebuildLinkedInPublication, resetFailedLinkedInPublications } =
    await import("../src/lib/social-publications.ts");
  const revision = "2026-10-20T08:00:00.000Z";
  const now = new Date("2026-10-20T10:00:00.000Z");
  const hash = "a".repeat(64);
  const clone = value => structuredClone(value);
  const spine = {
    primarySubject: "Synthetic transaction verification only", trigger: "Synthetic transaction verification only",
    mechanism: "Synthetic transaction verification only", consequence: "Synthetic transaction verification only",
    operatorDecision: "Synthetic transaction verification only", verification: "Synthetic transaction verification only",
    secondaryContext: [], visualSequence: ["Synthetic scene one", "Synthetic scene two", "Synthetic scene three"]
  };
  function job(id = "ordinary") {
    return { id, channel: "linkedin", contentType: "ccna_lesson", contentId: `lesson-${id}`,
      contentRevision: revision, status: "queued", externalId: null, commentary: "Synthetic reviewed caption",
      sourceUrl: "https://www.qcsstudio.com/synthetic", imageUrl: "https://www.qcsstudio.com/synthetic.png",
      attempts: 0, lastAttemptAt: null, lastError: null, publishedAt: null,
      nextAttemptAt: new Date("2026-01-01"), createdAt: new Date("2026-01-01"), updatedAt: new Date(revision),
      metadata: { commentaryPolicyVersion: linkedInCommentaryPolicyVersion, commentaryQualityScore: 100,
        commentaryTrace: { provider: "synthetic-reviewed" },
        lineage: createEditorialLineage({ contentType: "ccna_lesson", contentId: `lesson-${id}`, contentRevision: revision, storySpine: spine }) } };
  }
  function preserved() {
    const original = { ...job("preserved"), status: "published", externalId: "synthetic-original", publishedAt: new Date(revision) };
    original.metadata.deliveryReceipt = { original: true };
    const sources = Object.fromEntries(ccnaPreservationSourceFiles.map(file => [file, hash]));
    const activation = validateCcnaPreservationActivation(JSON.stringify({
      version: 1, scope: "reviewed-website-supplements-days-2-3-6", sourceSha256: sources,
      codeReview: { reviewerId: "synthetic", independent: true, approved: true, reviewedAt: revision,
        evidence: "Synthetic test-only independent review, never an actual approval." },
      deployment: { revision: "synthetic", verifiedAt: revision, allWritersRunningReviewedCode: true, inFlightOperationsDrained: true,
        evidence: "Synthetic test-only activation, never evidence of a deployment." }
    }), sources, now);
    return preserveCcnaApiJob(original, { day: 2, lessonId: original.contentId, baseContentDigest: hash,
      supplementedContentDigest: hash, reviewSha256: hash, qaSha256: hash, activation,
      beforeSnapshot: { path: "synthetic-only", sha256: hash }, now });
  }
  function matches(row, where) {
    return Object.entries(where || {}).every(([key, expected]) => {
      if (key === "NOT") return !matches(row, expected);
      if (key === "OR") return expected.some(item => matches(row, item));
      const value = row[key];
      if (expected instanceof Date) return +value === +expected;
      if (expected && typeof expected === "object") {
        if ("in" in expected) return expected.in.includes(value);
        if ("notIn" in expected) return !expected.notIn.includes(value);
        if ("not" in expected) return value !== expected.not;
        if ("lte" in expected) return +value <= +expected.lte;
        if ("equals" in expected) return JSON.stringify(value) === JSON.stringify(expected.equals);
        assert.fail(`Unsupported synthetic filter ${key}`);
      }
      return value === expected;
    });
  }
  function setup(t, jobs, options = {}) {
    state = { jobs: clone(jobs), remote: [], inTransaction: false, ticks: 0, transactions: 0, ...options };
    const client = getJobs => ({
      $queryRaw: async () => [],
      ccnaLesson: { findUnique: async () => ({ sequence: 4 }) },
      socialPublication: {
        findMany: async ({ where, take }) => clone(getJobs().filter(row => matches(row, where))
          .sort((a, b) => +a.nextAttemptAt - +b.nextAttemptAt || +a.createdAt - +b.createdAt || a.id.localeCompare(b.id)).slice(0, take)),
        findUnique: async ({ where }) => clone(getJobs().find(row => row.id === where.id)),
        findUniqueOrThrow: async ({ where }) => { const row = getJobs().find(row => row.id === where.id); assert.ok(row); return clone(row); },
        updateMany: async ({ where, data }) => {
          if (data.status === "published" && state.receiptFailure) {
            throw Object.assign(new Error(state.receiptFailure), { code: "P2034" });
          }
          let count = 0;
          for (const row of getJobs().filter(row => matches(row, where))) {
            for (const [key, value] of Object.entries(data)) {
              row[key] = key === "attempts" && value?.increment ? row[key] + value.increment : clone(value);
            }
            row.updatedAt = new Date(now.getTime() + ++state.ticks);
            count++;
          }
          return { count };
        },
        update: async () => assert.fail("CCNA receipt writes must use guarded CAS, not an unguarded update.")
      }
    });
    const prisma = client(() => state.jobs);
    prisma.$transaction = async (action, options) => {
      assert.equal(options.isolationLevel, "Serializable");
      const draft = clone(state.jobs);
      state.inTransaction = true;
      state.transactions++;
      try {
        const result = await action(client(() => draft));
        if (state.reservationCommitFailure) throw Object.assign(new Error("Synthetic reservation commit rollback"), { code: "P2034" });
        state.jobs = draft;
        return result;
      } finally { state.inTransaction = false; }
    };
    const previous = globalThis.prisma, fetch = globalThis.fetch;
    globalThis.prisma = prisma;
    globalThis.fetch = async () => assert.fail("Real network forbidden in dispatch regression tests.");
    t.after(() => { globalThis.prisma = previous; globalThis.fetch = fetch; });
    return state;
  }

  for (const failure of ["Synthetic receipt commit rollback", "Synthetic receipt timeout after remote success"]) {
    test(`successful POST followed by ${failure} cannot redispatch on the next cron`, async t => {
      const s = setup(t, [job()], { receiptFailure: failure });
      assert.equal((await processLinkedInQueue(1))[0].status, "needs_review");
      assert.deepEqual(await processLinkedInQueue(1), []);
      assert.equal(s.remote.length, 1);
      assert.equal(s.jobs[0].status, "needs_review");
      assert.equal(s.jobs[0].metadata[ccnaApiDispatchKey].state, "in-flight");
      assert.equal(await resetFailedLinkedInPublications(), 0);
      await assert.rejects(rebuildLinkedInPublication(s.jobs[0].id), /uncertain outcome/);
    });
  }
  test("remote success with a lost response remains held without another POST", async t => {
    const s = setup(t, [job()], { remoteTimeout: true });
    assert.equal((await processLinkedInQueue(1))[0].status, "needs_review");
    assert.deepEqual(await processLinkedInQueue(1), []);
    assert.deepEqual(s.remote, ["post"]);
  });
  test("reservation commit failure cannot dispatch, even on repeated cron invocations", async t => {
    const s = setup(t, [job()], { reservationCommitFailure: true });
    for (let i = 0; i < 2; i++) await assert.rejects(processLinkedInQueue(1), /reservation commit rollback/);
    assert.deepEqual(s.remote, []);
    assert.equal(s.jobs[0].status, "queued");
  });
  test("successful receipt commit completes the durable intent without duplicate delivery", async t => {
    const s = setup(t, [job()]);
    assert.equal((await processLinkedInQueue(1))[0].status, "published");
    assert.deepEqual(await processLinkedInQueue(1), []);
    assert.equal(s.jobs[0].metadata[ccnaApiDispatchKey].state, "completed");
    assert.equal(s.jobs[0].externalId, "synthetic-1");
    assert.deepEqual(s.remote, ["post"]);
  });
  test("interrupted legacy publishing is held durably without retrying or inventing a successful receipt", async t => {
    const original = { ...job(), status: "publishing", attempts: 1, lastAttemptAt: new Date("2025-01-01") };
    const s = setup(t, [original]);
    assert.deepEqual(await processLinkedInQueue(1), []);
    assert.deepEqual(await processLinkedInQueue(1), []);
    assert.equal(s.jobs[0].status, "needs_review");
    assert.equal(s.jobs[0].metadata[ccnaApiDispatchKey].origin, "interrupted-recovery");
    assert.equal(s.jobs[0].attempts, original.attempts);
    assert.equal(s.jobs[0].metadata.deliveryReceipt, undefined);
    await assert.rejects(rebuildLinkedInPublication(original.id), /uncertain outcome/);
    assert.deepEqual(s.remote, []);
  });
  for (const replaceMedia of [false, true]) {
    test(`refresh replaceMedia=${replaceMedia} cannot retry after remote success and receipt rollback`, async t => {
      const original = { ...job(), status: "published", externalId: "synthetic-original", publishedAt: new Date(revision) };
      const s = setup(t, [original], { receiptFailure: "Synthetic refresh receipt rollback" });
      await assert.rejects(refreshLinkedInPublication(original.id, replaceMedia), /receipt rollback/);
      await assert.rejects(refreshLinkedInPublication(original.id, replaceMedia), /uncertain outcome/);
      await assert.rejects(rebuildLinkedInPublication(original.id), /uncertain outcome/);
      assert.deepEqual(s.remote, replaceMedia ? ["post", "delete"] : ["commentary"]);
      assert.equal(s.jobs[0].status, "needs_review");
      assert.equal(s.jobs[0].externalId, "synthetic-original");
    });
  }
  test("two cron runs pass immutable preserved siblings and deliver the next eligible jobs", async t => {
    const owner = preserved(), sibling = { ...job("stale"), contentId: owner.contentId, status: "retry" };
    sibling.nextAttemptAt = new Date("2025-01-01");
    const s = setup(t, [owner, sibling, job("later-1"), job("later-2")]);
    const first = await processLinkedInQueue(1), second = await processLinkedInQueue(1);
    assert.deepEqual(first.map(item => item.status), ["preserved", "published"]);
    assert.deepEqual(second.map(item => item.status), ["preserved", "published"]);
    assert.deepEqual(s.jobs.find(item => item.id === owner.id), owner);
    assert.deepEqual(s.jobs.find(item => item.id === sibling.id), sibling);
    assert.deepEqual(s.remote, ["post", "post"]);
    assert.ok(s.jobs.filter(item => item.id.startsWith("later")).every(item => item.status === "published"));
  });
}
