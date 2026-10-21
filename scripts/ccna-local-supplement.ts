import assert from "node:assert/strict";
import { mkdir, open, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { randomUUID } from "node:crypto";
import { Prisma, type PrismaClient } from "@prisma/client";
import {
  assertCcnaSupplementBase, assertCcnaSupplementPreserved, assertCcnaSupplementSocialJobs,
  buildCcnaSupplementUpdate, ccnaSupplementSnapshotDigest, ccnaSupplementTopic, prepareCcnaSupplement,
  validateCcnaSupplementQa, validateCcnaSupplementReview, type SupplementPixels
} from "../src/lib/ccna-local-supplement-policy";
import { localReleaseSha } from "../src/lib/ccna-local-release-policy";
import type { CcnaLessonRecord } from "../src/lib/ccna-learning";
import { hasNativeLinkedInOwnership } from "../src/lib/linkedin-native-schedule";
import { ccnaPreservationSourceFiles, lockCcnaSocialRevision, preserveCcnaApiJob,
  validateCcnaPreservationActivation, type CcnaPreservationActivation } from "../src/lib/ccna-social-preservation";

const root = "test-results";
const file = (day: number, suffix: string) => path.join(root, `ccna-day${day}-${suffix}`);
type CandidateFiles = { day: number; raw: string; coverageRaw: string };
type ReleaseFiles = CandidateFiles & { reviewRaw: string; qaRaw: string; pixels: SupplementPixels; activationRaw?: string };

export async function writeCcnaSupplementBackup(directory: string, day: number, snapshot: unknown, phase = "before") {
  const absolute = path.resolve(directory);
  await mkdir(absolute, { recursive: true });
  const backupPath = path.join(absolute, `ccna-day${day}-supplement-${phase}-backup-${randomUUID()}.json`);
  const raw = JSON.stringify(snapshot, null, 2) + "\n";
  const handle = await open(backupPath, "wx", 0o600);
  try {
    await handle.writeFile(raw, "utf8");
    await handle.sync();
  } finally {
    await handle.close();
  }
  assert.equal(await readFile(backupPath, "utf8"), raw, "Local backup verification failed.");
  return { path: backupPath, sha256: localReleaseSha(raw) };
}

export async function applyCcnaSupplement(prisma: PrismaClient, files: ReleaseFiles,
  backupDirectory = root, now = new Date()) {
  const candidate = prepareCcnaSupplement(files.day, files.raw, files.coverageRaw, now);
  validateCcnaSupplementQa(candidate, files.reviewRaw, files.qaRaw, files.pixels, now);
  const row = await prisma.ccnaLesson.findUniqueOrThrow({ where: { id: candidate.coverage.identity.id } });
  const where = { contentType: "ccna_lesson", contentId: row.id };
  const jobs = await prisma.socialPublication.findMany({ where, orderBy: { id: "asc" } });
  assertCcnaSupplementBase(row, candidate);
  const legacyApi = jobs.some(job => job.channel === "linkedin") &&
    !jobs.some(job => job.channel === "linkedin" && hasNativeLinkedInOwnership(job.metadata));
  let legacy: { day: number; activation: CcnaPreservationActivation } | undefined;
  if (legacyApi) {
    assert.ok(files.activationRaw, "Legacy API supplements require a separate code-review and deployment activation receipt.");
    const hashes: Record<string, string> = {};
    for (const source of ccnaPreservationSourceFiles) hashes[source] = localReleaseSha(await readFile(source));
    legacy = { day: files.day, activation: validateCcnaPreservationActivation(files.activationRaw, hashes, now) };
  }
  assertCcnaSupplementSocialJobs(jobs, row.id, legacy);
  const snapshotDigest = ccnaSupplementSnapshotDigest(row, jobs);
  const backup = await writeCcnaSupplementBackup(backupDirectory, files.day, {
    kind: "ccna-supplement-before-apply", at: now.toISOString(), snapshotDigest, row, jobs,
    candidateSha256: localReleaseSha(files.raw), coverageSha256: localReleaseSha(files.coverageRaw),
    reviewSha256: localReleaseSha(files.reviewRaw), qaSha256: localReleaseSha(files.qaRaw),
    ...(legacy ? { preservationActivation: legacy.activation } : {})
  });

  // Lock only this chapter and its existing jobs. Never enqueue, refresh or reconcile delivery.
  const result = await prisma.$transaction(async tx => {
    await lockCcnaSocialRevision(tx, row.id);
    const current = await tx.ccnaLesson.findUniqueOrThrow({ where: { id: row.id } });
    const currentJobs = await tx.socialPublication.findMany({ where, orderBy: { id: "asc" } });
    assert.equal(ccnaSupplementSnapshotDigest(current, currentJobs), snapshotDigest,
      "Concurrent lesson or social edit after backup; nothing applied. Recheck and retry explicitly.");
    assertCcnaSupplementBase(current, candidate);
    assertCcnaSupplementSocialJobs(currentJobs, current.id, legacy);
    const approved = validateCcnaSupplementQa(candidate, files.reviewRaw, files.qaRaw, files.pixels, now);
    const expectedJobs = currentJobs.map(job => legacy && job.channel === "linkedin" ? preserveCcnaApiJob(job, {
      day: files.day, lessonId: current.id, baseContentDigest: candidate.coverage.baseContentDigest,
      supplementedContentDigest: candidate.contentDigest, reviewSha256: approved.review.receiptSha256,
      qaSha256: approved.qaSha256, activation: legacy.activation, beforeSnapshot: backup, now
    }) : job);
    const socialPreservation = legacy ? { activationSha256: legacy.activation.sha256,
      beforeJobsDigest: ccnaSupplementSnapshotDigest(null, currentJobs),
      afterJobsDigest: ccnaSupplementSnapshotDigest(null, expectedJobs) } : undefined;
    const data = buildCcnaSupplementUpdate(current, candidate, approved, backup, now, socialPreservation);
    for (const [index, job] of currentJobs.entries()) {
      const expected = expectedJobs[index];
      if (expected === job) continue;
      const marked = await tx.socialPublication.updateMany({
        where: { id: job.id, updatedAt: job.updatedAt, status: "published", externalId: job.externalId,
          contentRevision: job.contentRevision, metadata: { equals: job.metadata as Prisma.InputJsonValue } },
        data: { metadata: expected.metadata as Prisma.InputJsonObject, updatedAt: expected.updatedAt }
      });
      assert.equal(marked.count, 1, "Social preservation CAS failed; roll back the website supplement.");
    }
    const saved = await tx.ccnaLesson.updateMany({
      where: { id: current.id, status: "published", updatedAt: current.updatedAt,
        content: { equals: current.content as Prisma.InputJsonValue } },
      data: data as unknown as Prisma.CcnaLessonUpdateManyMutationInput
    });
    assert.equal(saved.count, 1, "Concurrent edit detected; supplement transaction must roll back.");
    const after = await tx.ccnaLesson.findUniqueOrThrow({ where: { id: row.id } });
    const afterJobs = await tx.socialPublication.findMany({ where, orderBy: { id: "asc" } });
    assertCcnaSupplementPreserved(current, after, currentJobs, afterJobs, data);
    const afterSnapshot = await writeCcnaSupplementBackup(backupDirectory, files.day, {
      kind: "ccna-supplement-validated-after-state",
      note: "Written before transaction commit; not proof of commit. Retain even if commit fails.",
      beforeSnapshot: backup, row: after, jobs: afterJobs,
      snapshotDigest: ccnaSupplementSnapshotDigest(after, afterJobs)
    }, "after");
    return { day: files.day, lessonId: current.id, previousBaseContentDigest: candidate.coverage.baseContentDigest,
      contentDigest: candidate.contentDigest, updatedAt: after.updatedAt, backup, afterSnapshot,
      socialJobsPreserved: currentJobs.length, state: "supplement-applied" };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, maxWait: 5_000, timeout: 15_000 });
  return result;
}

async function optionalText(filename: string) {
  try { return await readFile(filename, "utf8"); } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
    throw error;
  }
}

async function readPixels(day: number): Promise<SupplementPixels> {
  return {
    image: await readFile(file(day, "supplement-preview.png")),
    desktop: await readFile(file(day, "supplement-desktop.png")),
    mobile: await readFile(file(day, "supplement-mobile.png"))
  };
}

const help = `Use: node --import tsx scripts/ccna-local-supplement.ts check|preview|apply N
One existing published chapter, Days 1-60. No social publication or API generation.
Inputs under test-results/ccna-dayN-:
  supplemented-content.json: the complete reviewed replacement content
  supplement-coverage.json: day, authorId, baseContentDigest, baseUpdatedAt,
    contentSha256, identity {id,slug,title,sequence,publishedAt,scheduledFor},
    changes [{objective,contentPointers,assessmentPointers}], limitations
  supplement-independent-review.json: existing Harvey receipt format; the lesson
    entry also requires baseContentDigest and coverageSha256
  supplement-release-qa.json: day, baseContentDigest, baseUpdatedAt, contentSha256,
    coverageSha256, reviewSha256, imageSha256, desktopSha256, mobileSha256,
    checkedBy:"parent", checkedAt, visualChecked/sourceLinksChecked/
    desktopChecked/mobileChecked:true, notes, limitations
Preview writes only supplement-preview.png (1920x1080); inspect full/feed size.
The parent supplies supplement-desktop.png and supplement-mobile.png after actual
page pixel QA. No mode creates review, coverage or QA receipts.
Check/preview use the existing ccna-full-course-snapshot.json, never the database.
Check reports missing approvals; offline validation is not permission to apply.
Apply revalidates live base/identity/ownership, backs up every row/job field locally,
then uses a serializable CAS. Pending native receipts and active/non-owned delivery
block apply. Confirm native receipts before supplementing; never rewrite old ones.
Legacy delivered API jobs are eligible only for Days 2/3/6, with a separately
supplied test-results/ccna-supplement-preservation-activation.json. Its exact schema
is in ccna-social-preservation.ts: independent code review, all safeguard/test
source hashes, and activation evidence within 24 hours confirming every writer
uses the reviewed code and older in-flight operations have drained. Do not
manufacture this operational attestation. Local file hashes do not prove deployment.
Once deployed, guards hold delivered API jobs for Days 2/3/6 even before their
preservation markers exist, so the deployment-to-apply gap cannot refresh them.
Apply adds only distinct API-preservation metadata plus its timestamp to those
jobs, never native ownership. All other job fields/receipts remain unchanged.
Immutable before/after snapshots are saved; an after snapshot alone is not proof
of transaction commit. Repeated supplements do not rewrite preservation metadata.
No automatic retry, unpublish, schedule changes or rollback command.`;

export async function runCcnaSupplementCli(args: string[]) {
  if (args.length === 1 && args[0] === "--help") { console.log(help); return; }
  assert.equal(args.length, 2, help);
  const [mode, text] = args;
  assert.ok(["check", "preview", "apply"].includes(mode) && /^[1-9]\d?$/.test(text), help);
  const day = Number(text);
  ccnaSupplementTopic(day);
  const raw = await readFile(file(day, "supplemented-content.json"), "utf8");
  const coverageRaw = await readFile(file(day, "supplement-coverage.json"), "utf8");
  const now = new Date();
  const candidate = prepareCcnaSupplement(day, raw, coverageRaw, now);
  if (mode === "apply") {
    const files = { day, raw, coverageRaw,
      reviewRaw: await readFile(file(day, "supplement-independent-review.json"), "utf8"),
      qaRaw: await readFile(file(day, "supplement-release-qa.json"), "utf8"),
      activationRaw: await optionalText(path.join(root, "ccna-supplement-preservation-activation.json")),
      pixels: await readPixels(day) };
    validateCcnaSupplementQa(candidate, files.reviewRaw, files.qaRaw, files.pixels, now);
    const { loadEnvConfig } = await import("@next/env");
    loadEnvConfig(process.cwd(), true);
    const { getPrismaClient } = await import("../src/lib/prisma");
    const prisma = getPrismaClient();
    try { console.log(JSON.stringify(await applyCcnaSupplement(prisma, files), null, 2)); }
    finally { await prisma.$disconnect(); }
    return;
  }
  const snapshot = JSON.parse(await readFile(path.join(root, "ccna-full-course-snapshot.json"), "utf8"));
  const row = snapshot.lessons.find((item: { id: string }) => item.id === candidate.coverage.identity.id);
  assert.ok(row, "Published chapter absent from the local snapshot; obtain a fresh read-only snapshot.");
  assertCcnaSupplementBase(row, candidate);
  if (mode === "preview") {
    const { ccnaSocialVisual } = await import("../src/lib/ccna-social-visual");
    const visual = await ccnaSocialVisual({ ...row, content: candidate.content } as CcnaLessonRecord, 1920, 1080);
    const imagePath = file(day, "supplement-preview.png");
    await writeFile(imagePath, Buffer.from(await visual.arrayBuffer()));
    console.log(JSON.stringify({ day, imagePath, state: "awaiting-parent-pixel-inspection",
      published: false, socialDeliveryChanged: false }));
    return;
  }
  const reviewRaw = await optionalText(file(day, "supplement-independent-review.json"));
  const qaRaw = await optionalText(file(day, "supplement-release-qa.json"));
  if (reviewRaw !== undefined) validateCcnaSupplementReview(candidate, reviewRaw, now);
  if (qaRaw !== undefined) {
    assert.ok(reviewRaw, "QA cannot pass without the independent review.");
    validateCcnaSupplementQa(candidate, reviewRaw, qaRaw, await readPixels(day), now);
  }
  console.log(JSON.stringify({ day, quality: candidate.quality, contentDigest: candidate.contentDigest,
    contentSha256: localReleaseSha(raw), coverageSha256: localReleaseSha(coverageRaw),
    review: reviewRaw === undefined ? "missing" : "validated", qa: qaRaw === undefined ? "missing" : "validated",
    state: "offline-check-only", liveBaseAndSocialOwnershipChecked: false }, null, 2));
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  runCcnaSupplementCli(process.argv.slice(2)).catch(error => {
    console.error(error instanceof Error ? error.message : "Supplement failed.");
    process.exitCode = 1;
  });
}
