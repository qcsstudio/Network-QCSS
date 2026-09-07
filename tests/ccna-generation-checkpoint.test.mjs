import assert from "node:assert/strict";
import test from "node:test";
import { ccnaCheckpointLifetimeMs, ccnaCheckpointRunLimit, createCcnaGenerationCheckpoint, readCcnaGenerationCheckpoint } from "../src/lib/ccna-generation-checkpoint.ts";
import { createCcnaOutputRunner, CcnaLessonOutputError } from "../src/lib/ccna-lesson-writer.ts";
import { CcnaRequestDeferredError } from "../src/lib/ccna-openai-requests.ts";
import { runCcnaGenerationPipeline, ccnaReviewedRevisionIssues, ccnaContentDigest } from "../src/lib/ccna-generation-pipeline.ts";

const completed = (value) => ({ id: "mock-response", status: "completed", output_text: JSON.stringify(value), output: [] });
const cutoff = () => ({ status: "incomplete", output_text: '{"partial":', incomplete_details: { reason: "max_output_tokens" } });
const scope = { day: 3, model: "gpt-4.1", contentRevision: "unchanged", policy: 1 };
const now = Date.parse("2026-09-07T10:00:00Z");

function storage() {
  let saved;
  return {
    load: () => structuredClone(saved),
    create: (options = {}) => createCcnaGenerationCheckpoint({ scope, now: () => now, previous: saved, persist: async (value) => { saved = JSON.parse(JSON.stringify(value)); }, ...options })
  };
}

for (const interrupted of ["research-2", "draft-teaching", "repair-lab", "repair-assessment", "final-review"]) {
  test(`process restart resumes at ${interrupted} without repeating completed provider calls`, async () => {
    const db = storage();
    const calls = [];
    let pause = true;
    const stages = ["research-1", "research-2", "research-3", "draft-lab", "draft-teaching", "draft-assessment", "initial-review", "repair-lab", "repair-teaching", "repair-assessment", "final-review"];
    async function run() {
      const progress = db.create();
      await progress.start();
      const output = [];
      for (const stage of stages) {
        const response = await progress.run(stage, { model: scope.model, input: output, budget: 6000 }, async () => {
          calls.push(stage);
          if (pause && stage === interrupted) throw new CcnaRequestDeferredError("rate_limit", 33_000, stage);
          return completed({ stage });
        });
        output.push(JSON.parse(response.output_text));
      }
      return progress;
    }
    await assert.rejects(run, (error) => error.retryAfterMs === 33_000);
    const completedBeforePause = stages.indexOf(interrupted);
    assert.equal(db.load().entries.length, completedBeforePause);
    pause = false;
    const resumed = await run();
    assert.equal(resumed.reusedStages.length, completedBeforePause);
    assert.equal(calls.length, stages.length + 1);
    assert.equal(db.load().runs, 2);
  });
}

test("the real combined pipeline resumes its final review and retains the exact revision gate", async () => {
  const db = storage();
  let shouldPause = true;
  const calls = [];
  async function generate() {
    const progress = db.create();
    await progress.start();
    return runCcnaGenerationPipeline({
      write: async (repair) => (await progress.run("write", { repair: repair || null }, async () => {
        calls.push("write"); return completed({ repaired: !!repair });
      })).output_text,
      inspect: (text) => ({ candidate: JSON.parse(text), content: JSON.parse(text), quality: { ready: true, score: 100, issues: [] } }),
      review: async (candidate) => JSON.parse((await progress.run("review", candidate, async () => {
        calls.push("review");
        if (candidate.repaired && shouldPause) throw new CcnaRequestDeferredError("rate_limit", 33_000, "independent technical review");
        return completed(candidate.repaired ? { passed: true, issues: [] } : { passed: false, issues: ["Explain the actual return-path failure in the lab."] });
      })).output_text)
    });
  }
  await assert.rejects(generate, CcnaRequestDeferredError);
  shouldPause = false;
  const result = await generate();
  assert.deepEqual(calls, ["write", "review", "write", "review", "review"]);
  assert.equal(result.quality.ready, true);
  assert.deepEqual(ccnaReviewedRevisionIssues(result.content, { editorialReview: result.review, reviewedContentDigest: result.reviewedContentDigest }), []);
  assert.ok(ccnaReviewedRevisionIssues({ ...result.content, edited: true }, { editorialReview: result.review, reviewedContentDigest: result.reviewedContentDigest }).length);
});

test("completed higher-budget output is reused and output recovery reservations survive a capacity pause", async () => {
  const db = storage();
  let pause = true;
  const calls = [];
  async function write(stage) {
    const progress = db.create();
    await progress.start();
    const outputs = createCcnaOutputRunner(progress.recordAttempt, progress.snapshot().outputAttempts);
    return progress.run(stage, { model: "gpt-4.1", budgets: [6000, 8000] }, (key) => outputs.run(stage, [6000, 8000], async (cap, recovery) => {
      calls.push([stage, cap]);
      if (!recovery) return cutoff();
      if (pause) throw new CcnaRequestDeferredError("rate_limit", 33_000, stage);
      return completed({ finished: true });
    }, key));
  }
  await assert.rejects(() => write("lab"), CcnaRequestDeferredError);
  pause = false;
  await write("lab");
  await write("lab");
  assert.deepEqual(calls, [["lab", 6000], ["lab", 8000], ["lab", 8000]]);
  await write("teaching");
  await assert.rejects(() => write("assessment"), CcnaLessonOutputError);
  assert.deepEqual(calls.at(-1), ["assessment", 6000]);
  assert.equal(db.load().outputAttempts.filter((attempt) => attempt.recoveryScheduled).length, 2);
});

test("full request identities invalidate changed models, prompts, schemas, evidence, limits and revisions", async () => {
  const db = storage();
  const input = { model: "gpt-4.1", prompt: "review lesson", schema: { minLength: 20 }, sources: ["source-a"], maxOutputTokens: 1600, content: { revision: 1 } };
  const first = db.create();
  await first.start();
  await first.run("review", input, async () => completed({ passed: true }));
  for (const change of [{ model: "different" }, { prompt: "changed" }, { schema: { minLength: 30 } }, { sources: ["source-b"] }, { maxOutputTokens: 3000 }, { content: { revision: 2 } }]) {
    let called = false;
    await db.create().run("review", { ...input, ...change }, async () => { called = true; return completed({ passed: false }); });
    assert.equal(called, true);
  }
  for (const changedScope of [{ ...scope, day: 4 }, { ...scope, policy: 2 }, { ...scope, contentRevision: "edited" }]) {
    assert.equal(db.create({ scope: changedScope }).snapshot().entries.length, 0);
  }
});

test("research context stays stable across midnight and stale or corrupted checkpoints are rejected", async () => {
  const db = storage();
  const beforeMidnight = Date.parse("2026-09-07T23:59:00Z");
  const first = db.create({ now: () => beforeMidnight, recentVisuals: ["original visual"] });
  await first.start();
  await first.run("research", { query: "q" }, async () => completed({ memo: "fact" }));
  const resumed = db.create({ now: () => beforeMidnight + 120_000, recentVisuals: ["new visual"] });
  assert.equal(resumed.context.asOf, "2026-09-07");
  assert.deepEqual(resumed.context.recentVisuals, ["original visual"]);
  assert.equal(readCcnaGenerationCheckpoint(db.load(), beforeMidnight + ccnaCheckpointLifetimeMs), null);
  const corrupt = db.load();
  corrupt.entries[0].response.output_text = "tampered";
  assert.equal(readCcnaGenerationCheckpoint(corrupt, beforeMidnight), null);
  assert.equal(readCcnaGenerationCheckpoint(db.load(), beforeMidnight - 1), null);
});

for (const response of [cutoff(), { ...completed({}), status: "failed" }, { ...completed({}), output_text: " " }, { ...completed({}), output: [{ type: "message", content: [{ type: "refusal" }] }] }]) {
  test(`non-complete evidence is not checkpointed: ${response.status}/${response.output_text}`, async () => {
    const progress = storage().create();
    await progress.start();
    await assert.rejects(() => progress.run("research", {}, async () => response), /incomplete or refused/);
    assert.equal(progress.snapshot().entries.length, 0);
  });
}

test("provider failures and credentials are not saved as reusable responses", async () => {
  const progress = storage().create();
  await progress.start();
  await assert.rejects(() => progress.run("research", {}, async () => { throw Object.assign(new Error("quota"), { status: 429 }); }));
  assert.equal(progress.snapshot().entries.length, 0);
  await progress.run("research", {}, async () => ({ ...completed({ memo: "fact" }), apiKey: "must-not-save", headers: { authorization: "secret" } }));
  assert.equal(JSON.stringify(progress.snapshot()).includes("must-not-save"), false);
  assert.equal(JSON.stringify(progress.snapshot()).includes("authorization"), false);
});

test("a failed progress save stops before the next paid stage", async () => {
  let writes = 0;
  let paid = 0;
  const progress = createCcnaGenerationCheckpoint({ scope, now: () => now, persist: async () => { if (++writes === 2) throw new Error("database unavailable"); } });
  await progress.start();
  await assert.rejects(async () => {
    await progress.run("lab", {}, async () => { paid += 1; return completed({}); });
    await progress.run("teaching", {}, async () => { paid += 1; return completed({}); });
  }, /database unavailable/);
  assert.equal(paid, 1);
});

test("resume runs, response count and storage size are bounded", async () => {
  const db = storage();
  for (let index = 0; index < ccnaCheckpointRunLimit; index += 1) await db.create().start();
  await assert.rejects(() => db.create().start(), /bounded resume limit/);
  const oversized = db.load();
  oversized.entries = [{ key: ccnaContentDigest("key"), stage: "research", response: completed("x".repeat(1_600_000)), digest: ccnaContentDigest(completed("x".repeat(1_600_000))) }];
  assert.equal(readCcnaGenerationCheckpoint(oversized, now), null);
});
