import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { applyCcnaLayeredContract } from "../src/lib/ccna-layered-contract.ts";
import { ccnaContentDigest, ccnaReviewedRevisionIssues } from "../src/lib/ccna-generation-pipeline.ts";
import { ccnaReviewCategories } from "../src/lib/ccna-independent-review.ts";
import { ccnaLocalReleasePolicy, localReleaseSha } from "../src/lib/ccna-local-release-policy.ts";
import {
  assertCcnaSupplementBase, assertCcnaSupplementPreserved, assertCcnaSupplementSocialJobs,
  buildCcnaSupplementUpdate, ccnaSupplementSnapshotDigest, ccnaSupplementTopic,
  prepareCcnaSupplement, validateCcnaSupplementQa, validateCcnaSupplementReview
} from "../src/lib/ccna-local-supplement-policy.ts";
import { applyCcnaSupplement, runCcnaSupplementCli } from "../scripts/ccna-local-supplement.ts";
import { ccnaPreservationSourceFiles, ccnaSocialPreservationKey, assertCcnaPreservedJob } from "../src/lib/ccna-social-preservation.ts";

const now = new Date("2026-10-20T10:00:00.000Z");
const stringify = value => JSON.stringify(value, null, 2) + "\n";

// All approvals and pixels below are synthetic, in-memory test data, never release receipts.
function fixture(day = 4) {
  const topic = ccnaSupplementTopic(day);
  const base = applyCcnaLayeredContract();
  const content = structuredClone(base);
  base.plainAnswer += " This synthetic older revision is replaced by the maintained teaching contract.";
  base.quiz[0].explanation += " This is synthetic older assessment wording.";
  const row = {
    id: "synthetic-lesson", sequence: day, slug: topic.slug, title: topic.title,
    status: "published", publishedAt: new Date("2026-09-05T05:30:00.000Z"),
    scheduledFor: new Date("2026-09-05T00:00:00.000Z"), updatedAt: new Date("2026-10-15T09:30:00.000Z"),
    createdAt: new Date("2026-09-01T00:00:00.000Z"), content: base, sources: base.sources,
    moduleId: topic.moduleId, moduleTitle: topic.moduleTitle, examDomain: topic.domain,
    v11Blueprint: topic.v11, v20Blueprint: topic.v20, approvedBy: "original-approver",
    approvedAt: new Date("2026-09-05T05:30:00.000Z"), qualityScore: 100,
    attempts: 2, nextAttemptAt: new Date("2026-09-05T06:00:00.000Z"),
    generationStartedAt: null, lastError: null, createdBy: "synthetic-author",
    generationTrace: { publicationJob: { delivery: "held", actor: "original-actor" },
      reviewedContentDigest: ccnaContentDigest(base), editorialReview: { passed: true, issues: [] },
      retainedEvidence: { value: "Keep every unrelated trace field." } }
  };
  const jobs = [{
    id: "native", channel: "linkedin", contentType: "ccna_lesson", contentId: row.id,
    contentRevision: row.updatedAt.toISOString(), status: "held", externalId: null,
    commentary: "Original caption.\n\nKeep all spaces and paragraphs.",
    sourceUrl: `https://www.qcsstudio.com/courses/ccna/lessons/${row.slug}`,
    imageUrl: "https://www.qcsstudio.com/original-image?v=original",
    updatedAt: new Date("2026-10-15T09:40:00.000Z"),
    createdAt: new Date("2026-10-15T09:30:00.000Z"),
    nextAttemptAt: new Date("2026-10-21T05:30:00.000Z"), lastAttemptAt: null,
    publishedAt: null, lastError: null, attempts: 0,
    metadata: { plannedDelivery: { provider: "linkedin-native-scheduler", notBefore: "2026-10-21T05:30:00.000Z" },
      nativeScheduleReceipt: { status: "scheduled", confirmation: "Synthetic unit-test confirmation, not a real schedule.",
        scheduledUtc: "2026-10-21T05:30:00.000Z", confirmedAt: "2026-10-15T09:40:00.000Z" } }
  }, {
    id: "archived-api", channel: "linkedin", contentType: "ccna_lesson", contentId: row.id,
    contentRevision: "older-revision", status: "published", externalId: "synthetic-post",
    commentary: "Keep even older delivered jobs byte-for-byte.", metadata: { unknown: ["retained"] }
  }, {
    id: "another-channel", channel: "facebook", contentType: "ccna_lesson", contentId: row.id,
    contentRevision: "older-revision", status: "published", externalId: "synthetic-other-post", metadata: null
  }];
  const raw = stringify(content);
  const coverage = {
    day, authorId: "synthetic-independent-author",
    baseContentDigest: ccnaContentDigest(base), baseUpdatedAt: row.updatedAt.toISOString(),
    contentSha256: localReleaseSha(raw),
    identity: { id: row.id, slug: row.slug, title: row.title, sequence: row.sequence,
      publishedAt: row.publishedAt.toISOString(), scheduledFor: row.scheduledFor.toISOString() },
    changes: [{ objective: "Retain original observations when comparing the new verification evidence.",
      contentPointers: ["/plainAnswer"], assessmentPointers: ["/quiz/0/explanation"] }],
    limitations: ["Synthetic test fixture; no live sources or lab execution."]
  };
  const coverageRaw = stringify(coverage);
  const receipt = { reviewerId: ccnaLocalReleasePolicy.reviewerId, reviewedAt: "2026-10-20T08:00:00.000Z",
    lessons: [{ day, sha256: localReleaseSha(raw), baseContentDigest: coverage.baseContentDigest,
      coverageSha256: localReleaseSha(coverageRaw),
      evidence: { checks: ccnaReviewCategories.map(category => ({ category, passed: true })), findings: [] },
      verifiedSources: content.sources.map(({ url }) => ({ url, verification: "Synthetic test-only verification; not a live source check." })),
      limitations: ["Synthetic test fixture; no runtime execution or approval."] }] };
  const reviewRaw = stringify(receipt);
  const pixels = { image: Buffer.from("synthetic-image"), desktop: Buffer.from("synthetic-desktop"), mobile: Buffer.from("synthetic-mobile") };
  const qa = { day, baseContentDigest: coverage.baseContentDigest, baseUpdatedAt: coverage.baseUpdatedAt,
    contentSha256: localReleaseSha(raw), coverageSha256: localReleaseSha(coverageRaw), reviewSha256: localReleaseSha(reviewRaw),
    imageSha256: localReleaseSha(pixels.image), desktopSha256: localReleaseSha(pixels.desktop), mobileSha256: localReleaseSha(pixels.mobile),
    checkedBy: "parent", checkedAt: "2026-10-20T09:00:00.000Z",
    visualChecked: true, sourceLinksChecked: true, desktopChecked: true, mobileChecked: true,
    notes: "Synthetic QA for test execution only; no real pixel inspection was performed.",
    limitations: ["Not an actual release approval or a runtime validation."] };
  return { row, jobs, content, coverage, receipt, qa,
    files: { day, raw, coverageRaw, reviewRaw, qaRaw: stringify(qa), pixels } };
}

const prepare = f => prepareCcnaSupplement(f.files.day, f.files.raw, f.files.coverageRaw, now);
const approve = (f, candidate = prepare(f)) => validateCcnaSupplementQa(candidate, f.files.reviewRaw, f.files.qaRaw, f.files.pixels, now);

async function directory(t) {
  const dir = await mkdtemp(path.join(tmpdir(), "ccna-supplement-test-"));
  t.after(async () => {
    const target = path.resolve(dir);
    assert.equal(path.dirname(target), path.resolve(tmpdir()));
    assert.ok(path.basename(target).startsWith("ccna-supplement-test-"));
    await rm(target, { recursive: true, force: true });
  });
  return dir;
}

function database(f, hooks = {}) {
  const state = { row: structuredClone(f.row), jobs: structuredClone(f.jobs), commits: 0, updates: [], socialUpdates: [], locks: [] };
  const prisma = {
    ccnaLesson: { findUniqueOrThrow: async () => structuredClone(state.row) },
    socialPublication: { findMany: async ({ where }) => {
      assert.deepEqual(where, { contentType: "ccna_lesson", contentId: f.row.id }, "Back up every channel, not only LinkedIn.");
      return structuredClone(state.jobs);
    } },
    $transaction: async (action, options) => {
      assert.deepEqual(options, { isolationLevel: "Serializable", maxWait: 5000, timeout: 15000 });
      await hooks.beforeTransaction?.(state);
      const draft = { row: structuredClone(state.row), jobs: structuredClone(state.jobs) };
      const tx = {
        $queryRaw: async (strings, ...values) => { state.locks.push({ sql: strings.join("?"), values }); return [{ id: f.row.id }]; },
        ccnaLesson: {
          findUniqueOrThrow: async () => structuredClone(draft.row),
          updateMany: async args => {
            state.updates.push(args);
            assert.equal(state.locks.length, 2);
            assert.equal(args.where.id, draft.row.id);
            assert.equal(args.where.status, "published");
            assert.deepEqual(args.where.updatedAt, draft.row.updatedAt);
            assert.deepEqual(args.where.content.equals, draft.row.content);
            assert.deepEqual(Object.keys(args.data).sort(), ["content", "generationTrace", "qualityScore", "sources"]);
            if (hooks.casMiss) return { count: 0 };
            Object.assign(draft.row, structuredClone(args.data), { updatedAt: new Date(now) });
            hooks.afterUpdate?.(draft);
            return { count: 1 };
          }
        },
        socialPublication: {
          findMany: async () => structuredClone(draft.jobs),
          updateMany: async args => {
            assert.equal(hooks.allowSocialMarkers, true, "Only explicit legacy preservation may write job metadata.");
            assert.deepEqual(Object.keys(args.data).sort(), ["metadata", "updatedAt"]);
            const job = draft.jobs.find(job => job.id === args.where.id);
            assert.equal(args.where.externalId, job.externalId);
            assert.equal(args.where.contentRevision, job.contentRevision);
            assert.deepEqual(args.where.updatedAt, job.updatedAt);
            assert.deepEqual(args.where.metadata.equals, job.metadata);
            state.socialUpdates.push(args);
            if (hooks.socialCasMiss) return { count: 0 };
            Object.assign(job, structuredClone(args.data));
            return { count: 1 };
          }
        }
      };
      const result = await action(tx);
      if (hooks.serializationFailure) throw Object.assign(new Error("Serialization failure"), { code: "P2034" });
      state.row = draft.row; state.jobs = draft.jobs; state.commits++;
      return result;
    }
  };
  return { prisma, state };
}

test("supplements are bounded to the existing 60 chapters, including published Days 1-10", () => {
  for (const day of [1, 10, 60]) assert.equal(ccnaSupplementTopic(day).sequence, day);
  for (const day of [0, 61, NaN, 4.5]) assert.throws(() => ccnaSupplementTopic(day));
});

test("base digest, updatedAt, publication state and every identity field must match", () => {
  const f = fixture(), candidate = prepare(f);
  assert.doesNotThrow(() => assertCcnaSupplementBase(f.row, candidate));
  for (const patch of [
    { content: { edited: true } }, { updatedAt: now }, { status: "draft" }, { publishedAt: null },
    { slug: "different" }, { title: "Changed title" }, { sequence: 5 }, { id: "another" },
    { publishedAt: now }, { scheduledFor: null },
    { generationTrace: { publicationJob: { delivery: "pending" } } }
  ]) assert.throws(() => assertCcnaSupplementBase({ ...f.row, ...patch }, candidate));
});

test("coverage requires exact file/base identity, resolvable assessment pointers and a separate author", () => {
  const f = fixture();
  for (const mutate of [
    c => { delete c.baseContentDigest; },
    c => { delete c.baseUpdatedAt; },
    c => { c.contentSha256 = "0".repeat(64); },
    c => { c.identity.slug = "other"; },
    c => { c.identity.sequence = 5; },
    c => { c.authorId = ccnaLocalReleasePolicy.reviewerId; },
    c => { c.changes[0].contentPointers = ["/missing"]; },
    c => { c.changes[0].contentPointers = ["/__proto__/constructor"]; },
    c => { c.changes[0].assessmentPointers = ["/plainAnswer"]; },
    c => { c.changes = []; }
  ]) {
    const coverage = structuredClone(f.coverage); mutate(coverage);
    assert.throws(() => prepareCcnaSupplement(4, f.files.raw, stringify(coverage), now));
  }
  const altered = stringify({ ...f.content, title: "Attempt to change row identity" });
  assert.throws(() => prepareCcnaSupplement(4, altered, f.files.coverageRaw, now), /unknown or normalized/);
});

test("existing topic quality/source gates and stale source baseline are not weakened", () => {
  const f = fixture();
  const content = structuredClone(f.content);
  content.sources[0].url = "https://untrusted.invalid/evidence";
  const raw = stringify(content);
  assert.throws(() => prepareCcnaSupplement(4, raw, stringify({ ...f.coverage, contentSha256: localReleaseSha(raw) }), now), /quality gate/);
  assert.throws(() => prepareCcnaSupplement(4, f.files.raw, f.files.coverageRaw, new Date("2027-01-01T00:00:00Z")), /source baseline/);
});

test("Harvey's exact nine-gate review binds candidate, base, coverage and every source", () => {
  const f = fixture(), candidate = prepare(f);
  assert.equal(validateCcnaSupplementReview(candidate, f.files.reviewRaw, now).validated.evidence.checks.length, 9);
  for (const mutate of [
    r => { r.reviewerId = "author"; },
    r => { r.reviewedAt = "2025-01-01T00:00:00Z"; },
    r => { r.lessons[0].sha256 = "0".repeat(64); },
    r => { r.lessons[0].baseContentDigest = "0".repeat(64); },
    r => { r.lessons[0].coverageSha256 = "0".repeat(64); },
    r => { r.lessons[0].evidence.checks.pop(); },
    r => { r.lessons[0].evidence.checks[0] = r.lessons[0].evidence.checks[1]; },
    r => { r.lessons[0].verifiedSources.pop(); },
    r => { r.lessons[0].limitations = []; },
    r => { r.lessons.push(r.lessons[0]); }
  ]) {
    const receipt = structuredClone(f.receipt); mutate(receipt);
    assert.throws(() => validateCcnaSupplementReview(candidate, stringify(receipt), now));
  }
  const failed = structuredClone(f.receipt);
  failed.lessons[0].evidence.checks.find(c => c.category === "beginner_clarity").passed = false;
  failed.lessons[0].evidence.findings.push({
    category: "beginner_clarity", path: "/plainAnswer", quote: "A layered model",
    impact: "Synthetic blocking finding prevents approval in this test.",
    repair: "Correct the synthetic finding before attempting a release.", sourceUrls: []
  });
  assert.throws(() => validateCcnaSupplementReview(candidate, stringify(failed), now), /Independent review failed/);
});

test("parent QA must be complete, current, after review and bound to all exact pixel artifacts", () => {
  const f = fixture(), candidate = prepare(f);
  assert.doesNotThrow(() => approve(f, candidate));
  for (const key of ["visualChecked", "sourceLinksChecked", "desktopChecked", "mobileChecked"]) {
    assert.throws(() => validateCcnaSupplementQa(candidate, f.files.reviewRaw, stringify({ ...f.qa, [key]: false }), f.files.pixels, now));
  }
  for (const patch of [
    { checkedBy: "author" }, { checkedAt: "2026-10-20T07:00:00Z" }, { checkedAt: "2099-01-01T00:00:00Z" },
    { baseContentDigest: "0".repeat(64) }, { contentSha256: "0".repeat(64) },
    { coverageSha256: "0".repeat(64) }, { reviewSha256: "0".repeat(64) }, { notes: "" }, { limitations: [] }
  ]) assert.throws(() => validateCcnaSupplementQa(candidate, f.files.reviewRaw, stringify({ ...f.qa, ...patch }), f.files.pixels, now));
  for (const kind of ["image", "desktop", "mobile"]) {
    assert.throws(() => validateCcnaSupplementQa(candidate, f.files.reviewRaw, f.files.qaRaw,
      { ...f.files.pixels, [kind]: Buffer.from("changed") }, now), /pixels changed/);
  }
  const incomplete = { ...f.qa }; delete incomplete.mobileSha256;
  assert.throws(() => validateCcnaSupplementQa(candidate, f.files.reviewRaw, stringify(incomplete), f.files.pixels, now));
});

test("active jobs, non-native ownership and unreconciled native reservations hold apply", () => {
  const f = fixture();
  assert.doesNotThrow(() => assertCcnaSupplementSocialJobs(f.jobs, f.row.id));
  assert.doesNotThrow(() => assertCcnaSupplementSocialJobs([], f.row.id));
  for (const status of ["queued", "retry", "publishing", "unknown-new-state"]) {
    assert.throws(() => assertCcnaSupplementSocialJobs([{ ...f.jobs[0], status }], f.row.id), /Active social/);
    assert.throws(() => assertCcnaSupplementSocialJobs([f.jobs[0], { ...f.jobs[2], status }], f.row.id), /Active social/);
  }
  assert.throws(() => assertCcnaSupplementSocialJobs([f.jobs[1]], f.row.id), /Non-native LinkedIn/);
  assert.throws(() => assertCcnaSupplementSocialJobs([{ ...f.jobs[0], metadata: { plannedDelivery: { provider: "linkedin-native-scheduler" } } }], f.row.id), /pending native reservation/);
});

test("native ownership cannot waive a present malformed or conflicting preservation marker", async t => {
  const f = fixture(), dir = await directory(t);
  f.jobs[0].metadata[ccnaSocialPreservationKey] = null;
  assert.throws(() => assertCcnaSupplementSocialJobs(f.jobs, f.row.id));
  const { prisma, state } = database(f);
  await assert.rejects(applyCcnaSupplement(prisma, f.files, dir, now));
  assert.equal(state.commits, 0);
  assert.equal(state.updates.length, 0);
  assert.equal(state.socialUpdates.length, 0);
  assert.deepEqual(await readdir(dir), []);
});

test("apply backs up the full row/all jobs before a serializable CAS and preserves every protected field", async t => {
  const f = fixture(), dir = await directory(t);
  const original = structuredClone(f);
  const { prisma, state } = database(f, { beforeTransaction: async () => {
    const names = await readdir(dir);
    assert.equal(names.length, 1, "Backup must exist before starting the mutation transaction.");
    const backup = JSON.parse(await readFile(path.join(dir, names[0]), "utf8"));
    assert.deepEqual(backup.row, JSON.parse(JSON.stringify(f.row)));
    assert.deepEqual(backup.jobs, JSON.parse(JSON.stringify(f.jobs)));
    assert.equal(backup.snapshotDigest, ccnaSupplementSnapshotDigest(f.row, f.jobs));
  } });
  const result = await applyCcnaSupplement(prisma, f.files, dir, now);
  assert.equal(result.state, "supplement-applied");
  assert.equal(state.commits, 1);
  assert.equal(state.updates.length, 1);
  assert.deepEqual(state.jobs, original.jobs);
  assert.equal(state.row.status, "published");
  assert.deepEqual(ccnaReviewedRevisionIssues(state.row.content, state.row.generationTrace), []);
  assert.deepEqual(state.row.generationTrace.publicationJob, original.row.generationTrace.publicationJob);
  assert.deepEqual(state.row.generationTrace.retainedEvidence, original.row.generationTrace.retainedEvidence);
  const audit = state.row.generationTrace.localSupplements[0];
  assert.equal(audit.previousBaseContentDigest, ccnaContentDigest(original.row.content));
  assert.equal(audit.previousUpdatedAt, original.row.updatedAt.toISOString());
  assert.equal(audit.backup.sha256, localReleaseSha(await readFile(audit.backup.path)));
  assert.equal(state.jobs[0].contentRevision, original.jobs[0].contentRevision);
  assert.notEqual(state.row.updatedAt.toISOString(), state.jobs[0].contentRevision);
  assert.ok(state.locks.every(lock => /FOR UPDATE/.test(lock.sql)));
  assert.deepEqual(structuredClone(f), original, "The pure policy and apply inputs must not be mutated.");
  await assert.rejects(applyCcnaSupplement(prisma, f.files, dir, now), /Stale base/);
  assert.equal(state.updates.length, 1, "The same reviewed artifacts cannot apply twice.");
  assert.equal((await readdir(dir)).length, 2, "A stale retry does not create additional before/after snapshots.");
  const after = JSON.parse(await readFile(result.afterSnapshot.path, "utf8"));
  assert.deepEqual(after.jobs, JSON.parse(JSON.stringify(state.jobs)));
  assert.match(after.note, /not proof of commit/);
});

test("stale base and incomplete QA fail before any backup or transaction", async t => {
  const dir = await directory(t);
  for (const mutation of [
    f => { f.row.content = { concurrent: true }; },
    f => { f.row.updatedAt = now; },
    f => { f.files.qaRaw = "{}"; },
    f => { f.files.reviewRaw = "{}"; },
    f => { f.row.title = "Changed chapter"; },
    f => { f.jobs[1].status = "publishing"; }
  ]) {
    const f = fixture(); mutation(f);
    const { prisma, state } = database(f);
    await assert.rejects(applyCcnaSupplement(prisma, f.files, dir, now));
    assert.equal(state.commits, 0);
    assert.equal(state.updates.length, 0);
  }
  assert.deepEqual(await readdir(dir), []);
});

test("backup failure prevents transaction entry", async t => {
  const f = fixture(), dir = await directory(t), blocked = path.join(dir, "not-a-directory");
  await writeFile(blocked, "synthetic filesystem obstruction");
  const { prisma, state } = database(f, { beforeTransaction: () => assert.fail("No transaction after backup failure") });
  await assert.rejects(applyCcnaSupplement(prisma, f.files, blocked, now));
  assert.equal(state.updates.length, 0);
});

test("lesson edits, job edits and newly inserted jobs after backup fail before mutation", async t => {
  const dir = await directory(t);
  for (const edit of [
    s => { s.row.updatedAt = now; },
    s => { s.row.content.plainAnswer += " Concurrent edit."; },
    s => { s.row.generationTrace.retainedEvidence.value = "Concurrent trace edit without a new timestamp."; },
    s => { s.jobs[0].metadata.nativeScheduleReceipt.confirmation = "Concurrent receipt edit"; },
    s => { s.jobs.push({ ...s.jobs[1], id: "new-job", status: "queued" }); }
  ]) {
    const f = fixture(), { prisma, state } = database(f, { beforeTransaction: edit });
    await assert.rejects(applyCcnaSupplement(prisma, f.files, dir, now), /Concurrent lesson or social edit/);
    assert.equal(state.updates.length, 0);
    assert.equal(state.commits, 0);
  }
});

test("CAS miss, serialization failure and post-write preservation failure roll back without retry", async t => {
  const dir = await directory(t);
  for (const hooks of [
    { casMiss: true }, { serializationFailure: true },
    { afterUpdate: draft => { draft.jobs[0].commentary = "Unwanted social mutation"; } },
    { afterUpdate: draft => { draft.row.publishedAt = now; } }
  ]) {
    const f = fixture(), { prisma, state } = database(f, hooks);
    await assert.rejects(applyCcnaSupplement(prisma, f.files, dir, now));
    assert.equal(state.commits, 0);
    assert.equal(state.updates.length, 1, "No automatic transaction retry.");
    assert.deepEqual(state.row, f.row);
    assert.deepEqual(state.jobs, f.jobs);
  }
});

test("preservation guard checks metadata, old receipt and job revision, not only captions", () => {
  const f = fixture(), candidate = prepare(f);
  const data = buildCcnaSupplementUpdate(f.row, candidate, approve(f, candidate),
    { path: "synthetic-backup", sha256: "0".repeat(64) }, now);
  const after = { ...f.row, ...data };
  for (const change of [
    jobs => { jobs[0].contentRevision = "new"; },
    jobs => { jobs[0].metadata.nativeScheduleReceipt.extra = true; },
    jobs => { jobs[0].imageUrl = "different"; },
    jobs => { jobs[1].externalId = "different"; },
    jobs => { jobs.pop(); }
  ]) {
    const jobs = structuredClone(f.jobs); change(jobs);
    assert.throws(() => assertCcnaSupplementPreserved(f.row, after, f.jobs, jobs, data), /Social jobs changed/);
  }
});

test("CLI rejects extra arguments or mutation modes before reading files; help is offline", async () => {
  for (const args of [[], ["unpublish", "4"], ["apply", "61"], ["apply", "4", "--force"], ["check", "04"]]) {
    await assert.rejects(runCcnaSupplementCli(args));
  }
  const result = spawnSync(process.execPath, ["--import", "tsx", "scripts/ccna-local-supplement.ts", "--help"], {
    cwd: process.cwd(), encoding: "utf8", env: { ...process.env, DATABASE_URL: "", OPENAI_API_KEY: "" }
  });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /check\|preview\|apply/);
  assert.match(result.stdout, /No mode creates review, coverage or QA receipts/);
});

async function legacyFixture() {
  const f = fixture(6);
  f.jobs = [{ ...f.jobs[0], status: "published", externalId: "synthetic-api-post",
    publishedAt: new Date("2026-10-15T09:40:00.000Z"),
    metadata: { deliveryReceipt: { externalId: "synthetic-api-post", status: 201 },
      permalink: "https://www.linkedin.com/feed/update/synthetic", lineage: { retained: true } }
  }, f.jobs[2]];
  const sourceSha256 = {};
  for (const file of ccnaPreservationSourceFiles) sourceSha256[file] = localReleaseSha(await readFile(file));
  f.files.activationRaw = stringify({
    version: 1, scope: "reviewed-website-supplements-days-2-3-6",
    codeReview: { reviewerId: "synthetic-code-reviewer", independent: true, approved: true,
      reviewedAt: "2026-10-20T08:00:00.000Z", evidence: "Synthetic test-only code review; not an actual approval." },
    sourceSha256,
    deployment: { revision: "synthetic-test-build", verifiedAt: "2026-10-20T09:00:00.000Z",
      evidence: "Synthetic activation fixture, not evidence of a live deployment.",
      allWritersRunningReviewedCode: true, inFlightOperationsDrained: true }
  });
  return f;
}

test("legacy apply is a metadata-only preservation transaction with immutable before/after snapshots", async t => {
  const f = await legacyFixture(), dir = await directory(t);
  const { prisma, state } = database(f, { allowSocialMarkers: true });
  const result = await applyCcnaSupplement(prisma, f.files, dir, now);
  assert.equal(state.commits, 1);
  assert.equal(state.socialUpdates.length, 1);
  const job = state.jobs[0], marker = assertCcnaPreservedJob(job);
  assert.equal(marker.day, 6);
  assert.equal(job.externalId, f.jobs[0].externalId);
  assert.equal(job.contentRevision, f.jobs[0].contentRevision);
  const unmarked = structuredClone(job);
  delete unmarked.metadata[ccnaSocialPreservationKey];
  unmarked.updatedAt = f.jobs[0].updatedAt;
  assert.deepEqual(unmarked, f.jobs[0], "No field beyond the explicit marker/timestamp changes.");
  assert.equal(job.metadata.nativeScheduleReceipt, undefined);
  assert.equal(job.metadata.plannedDelivery, undefined);
  assert.deepEqual(state.jobs[1], f.jobs[1], "Other channels remain byte-for-byte unchanged.");
  const before = JSON.parse(await readFile(result.backup.path, "utf8"));
  const after = JSON.parse(await readFile(result.afterSnapshot.path, "utf8"));
  assert.deepEqual(before.jobs, JSON.parse(JSON.stringify(f.jobs)));
  assert.deepEqual(after.jobs, JSON.parse(JSON.stringify(state.jobs)));
  assert.equal((await readdir(dir)).length, 2);
});

test("legacy activation cannot be absent, stale, unreviewed, undrained or for different source code", async t => {
  const dir = await directory(t);
  for (const mutate of [
    f => { delete f.files.activationRaw; },
    f => { const r = JSON.parse(f.files.activationRaw); r.codeReview.approved = false; f.files.activationRaw = stringify(r); },
    f => { const r = JSON.parse(f.files.activationRaw); r.deployment.inFlightOperationsDrained = false; f.files.activationRaw = stringify(r); },
    f => { const r = JSON.parse(f.files.activationRaw); r.deployment.verifiedAt = "2026-10-18T09:00:00Z"; f.files.activationRaw = stringify(r); },
    f => { const r = JSON.parse(f.files.activationRaw); r.sourceSha256[ccnaPreservationSourceFiles[0]] = "0".repeat(64); f.files.activationRaw = stringify(r); },
    f => { f.jobs[0].externalId = null; },
    f => { f.jobs[0].metadata.deliveryReceipt = null; },
    f => { f.jobs[0].status = "failed"; }
  ]) {
    const f = await legacyFixture(); mutate(f);
    const { prisma, state } = database(f, { allowSocialMarkers: true });
    await assert.rejects(applyCcnaSupplement(prisma, f.files, dir, now));
    assert.equal(state.updates.length, 0);
    assert.equal(state.socialUpdates.length, 0);
  }
  assert.deepEqual(await readdir(dir), []);
});

test("legacy social CAS failure or post-marking drift rolls back both lesson and job changes", async t => {
  const dir = await directory(t);
  for (const hook of [
    { socialCasMiss: true },
    { afterUpdate: draft => { draft.jobs[0].externalId = "changed-post"; } },
    { afterUpdate: draft => { draft.jobs[0].metadata.deliveryReceipt = { changed: true }; } },
    { serializationFailure: true }
  ]) {
    const f = await legacyFixture();
    const { prisma, state } = database(f, { allowSocialMarkers: true, ...hook });
    await assert.rejects(applyCcnaSupplement(prisma, f.files, dir, now));
    assert.equal(state.commits, 0);
    assert.deepEqual(state.row, f.row);
    assert.deepEqual(state.jobs, f.jobs);
  }
});
