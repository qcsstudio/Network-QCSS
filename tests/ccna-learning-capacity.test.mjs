import assert from "node:assert/strict";
import test from "node:test";
import { ccnaCurriculum } from "../src/lib/ccna-curriculum.ts";
import { generateCcnaLesson, listCcnaLessons, publishCcnaLesson } from "../src/lib/ccna-learning.ts";
import { CcnaRequestDeferredError } from "../src/lib/ccna-openai-requests.ts";

function harness(t) {
  const topic = ccnaCurriculum.find((item) => item.sequence === 3);
  const row = { id: "mock-day-3", sequence: 3, slug: topic.slug, title: topic.title, moduleId: topic.moduleId, moduleTitle: topic.moduleTitle,
    examDomain: topic.domain, v11Blueprint: topic.v11, v20Blueprint: topic.v20, status: "scheduled", content: null, generationTrace: null,
    generationStartedAt: null, nextAttemptAt: new Date(0), updatedAt: new Date(), attempts: 0, qualityScore: null, lastError: null, scheduledFor: null, publishedAt: null };
  const savedPrisma = globalThis.prisma;
  const savedKey = process.env.OPENAI_API_KEY;
  process.env.OPENAI_API_KEY = "sk-test-local-mocked-requests-only";
  t.after(() => {
    if (savedPrisma) globalThis.prisma = savedPrisma; else delete globalThis.prisma;
    if (savedKey === undefined) delete process.env.OPENAI_API_KEY; else process.env.OPENAI_API_KEY = savedKey;
  });
  t.mock.method(console, "info", () => {});
  let loseOwnership = false;
  const calls = [];
  globalThis.prisma = { ccnaLesson: {
    findUnique: async () => structuredClone(row),
    findUniqueOrThrow: async () => structuredClone(row),
    findMany: async ({ where } = {}) => where ? [] : [structuredClone(row)],
    updateMany: async ({ where, data }) => {
      if (loseOwnership && data.generationTrace?.checkpoint) { row.status = "skipped"; loseOwnership = false; }
      if ((where.status && row.status !== where.status)
        || (where.generationStartedAt && row.generationStartedAt?.getTime() !== where.generationStartedAt.getTime())
        || (where.updatedAt && row.updatedAt.getTime() !== where.updatedAt.getTime())) return { count: 0 };
      Object.assign(row, structuredClone({ ...data, ...(data.attempts ? { attempts: row.attempts + data.attempts.increment } : {}), updatedAt: new Date() }));
      return { count: 1 };
    }
  } };
  const sources = ["https://www.cisco.com/c/en/us/training-events/training-certifications/exams/current-list/ccna-200-301.html", "https://docs.gns3.com/docs/emulators/vpcs", "https://www.rfc-editor.org/rfc/rfc1122.html"];
  t.mock.method(globalThis, "fetch", async (url, init) => {
    assert.match(String(url), /^https:\/\/api\.openai\.com\/v1\/responses$/);
    const request = JSON.parse(init.body);
    calls.push(request);
    if (request.tools) {
      const source = sources[calls.filter((call) => call.tools).length - 1];
      return new Response(JSON.stringify({ id: "mock-research", object: "response", status: "completed", output: [
        { type: "web_search_call", id: "mock-search", status: "completed", action: { type: "search", query: request.input, sources: [{ url: source }] } },
        { type: "message", id: "mock-message", role: "assistant", status: "completed", content: [{ type: "output_text", text: `Verified evidence from ${source}.`, annotations: [] }] }
      ] }), { headers: { "content-type": "application/json" } });
    }
    return new Response(JSON.stringify({ error: { message: "Rate limit reached on tokens per min. Try again in 61s.", code: "rate_limit_exceeded", type: "tokens" } }), { status: 429, headers: { "content-type": "application/json", "retry-after": "61" } });
  });
  return { row, calls, loseOwnership: () => { loseOwnership = true; } };
}

test("real generation service saves research, enforces cooldown before spending, and resumes just the missing lab", async (t) => {
  const { row, calls } = harness(t);
  await assert.rejects(() => generateCcnaLesson(row.id, "test-operator", false), CcnaRequestDeferredError);
  assert.equal(row.status, "retry");
  assert.equal(row.generationTrace.checkpoint.entries.length, 3);
  assert.equal(row.generationTrace.pauseReason, "rate_limit");
  assert.ok(row.nextAttemptAt.getTime() - Date.now() > 60_000);
  assert.equal(calls.length, 4);
  assert.equal(row.attempts, 1);
  await assert.rejects(() => generateCcnaLesson(row.id, "test-operator", false), CcnaRequestDeferredError);
  assert.equal(calls.length, 4);
  assert.equal(row.attempts, 1);
  const [listed] = await listCcnaLessons();
  assert.equal(listed.generationProgress.completedSteps, 3);
  assert.equal(listed.generationProgress.stage, "lesson draft: lab");
  assert.equal(listed.generationProgress.retryAt, row.nextAttemptAt.toISOString());
  await assert.rejects(() => publishCcnaLesson(row.id, "test-operator"), /Finish the active CCNA generation/);
  row.nextAttemptAt = new Date(Date.now() - 1);
  await assert.rejects(() => generateCcnaLesson(row.id, "test-worker", true), CcnaRequestDeferredError);
  assert.equal(calls.length, 5);
  assert.equal(calls.filter((call) => call.tools).length, 3);
  assert.equal(row.attempts, 2);
  assert.equal(row.generationTrace.publishWhenReady, false);
  assert.equal(row.generationTrace.checkpoint.runs, 2);
});

test("a cancelled generation cannot save stale progress or publish over the operator's action", async (t) => {
  const { row, calls, loseOwnership } = harness(t);
  loseOwnership();
  await assert.rejects(() => generateCcnaLesson(row.id, "test-operator", false), /ownership changed/);
  assert.equal(row.status, "skipped");
  assert.equal(calls.length, 0);
  assert.equal(row.generationTrace, null);
});

test("the sixth capacity interruption holds the job instead of scheduling unbounded paid retries", async (t) => {
  const { row, calls } = harness(t);
  await assert.rejects(() => generateCcnaLesson(row.id, "test-operator", false), CcnaRequestDeferredError);
  row.generationTrace.checkpoint.runs = 5;
  row.nextAttemptAt = new Date(0);
  await assert.rejects(() => generateCcnaLesson(row.id, "test-operator", false), CcnaRequestDeferredError);
  assert.equal(row.status, "needs_review");
  assert.equal(row.generationTrace.checkpoint.runs, 6);
  assert.equal(calls.length, 5);
  assert.match(row.lastError, /Automatic continuation is held/);
});
