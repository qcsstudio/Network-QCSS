import assert from "node:assert/strict";
import test from "node:test";
import OpenAI from "openai";
import { ccnaOpenAIResponseSchema } from "../src/lib/ccna-lesson-schema.ts";
import { CcnaLessonOutputError, ccnaLessonPartSchemas, createCcnaOutputRunner, writeCcnaLessonParts } from "../src/lib/ccna-lesson-writer.ts";
import { CcnaRequestDeferredError, createCcnaRequestRunner } from "../src/lib/ccna-openai-requests.ts";
import { runCcnaGenerationPipeline, ccnaContentDigest, ccnaReviewedRevisionIssues } from "../src/lib/ccna-generation-pipeline.ts";

const completed = (text = '{"complete":true}') => ({ status: "completed", output_text: text });
const cutoff = () => ({ status: "incomplete", incomplete_details: { reason: "max_output_tokens" }, output_text: '{"partial":' });
const schema = ccnaOpenAIResponseSchema(["https://www.cisco.com/", "https://docs.gns3.com/"]);
const partValues = (part) => Object.fromEntries(part.schema.required.map((key) => [key, `${part.name}:${key}`]));

test("writing partitions cover the complete existing schema once without weakening field limits", () => {
  const parts = ccnaLessonPartSchemas(schema);
  const keys = parts.flatMap((part) => part.schema.required);
  assert.deepEqual([...keys].sort(), [...schema.required].sort());
  assert.equal(new Set(keys).size, keys.length);
  assert.equal(keys.includes("teachingPrelude"), false);
  for (const part of parts) {
    assert.equal(part.schema.additionalProperties, false);
    assert.ok(part.budgets[0] < 14_000);
    assert.ok(part.budgets[1] > part.budgets[0] && part.budgets[1] <= 10_000);
    for (const key of part.keys) assert.deepEqual(part.schema.properties[key], schema.properties[key]);
  }
  assert.throws(() => ccnaLessonPartSchemas({ ...schema, properties: { ...schema.properties, newRequiredField: {} }, required: [...schema.required, "newRequiredField"] }), /every required lesson field exactly once/);
});

test("lab-first assembly gives later parts the same topology and retains all fields", async () => {
  const calls = [];
  const text = await writeCcnaLessonParts({ schema, request: async (part) => {
    calls.push(part.name);
    if (part.name !== "lab") assert.match(part.input, /lab:lab/);
    if (part.name === "assessment") assert.match(part.input, /teaching:sections/);
    return JSON.stringify(partValues(part));
  } });
  assert.deepEqual(calls, ["lab", "teaching", "assessment"]);
  assert.deepEqual(Object.keys(JSON.parse(text)).sort(), [...schema.required].sort());
});

test("a max_output_tokens cutoff retries only the unfinished part, retaining completed work", async () => {
  const outputs = createCcnaOutputRunner();
  const calls = [];
  const result = JSON.parse(await writeCcnaLessonParts({ schema, request: async (part) => {
    const response = await outputs.run(part.name, part.budgets, async (budget, recovery) => {
      calls.push([part.name, budget, recovery]);
      return part.name === "teaching" && !recovery ? cutoff() : completed(JSON.stringify(partValues(part)));
    });
    return response.output_text;
  } }));
  assert.deepEqual(calls.map(([part]) => part), ["lab", "teaching", "teaching", "assessment"]);
  assert.deepEqual(calls[2], ["teaching", 10_000, true]);
  assert.equal(result.lab, "lab:lab");
  assert.equal(result.sections, "teaching:sections");
  assert.equal(result.partial, undefined);
});

test("incomplete output is rejected even when its text happens to be valid JSON", async () => {
  const runner = createCcnaOutputRunner();
  let count = 0;
  await assert.rejects(() => runner.run("teaching", [8_000, 10_000], async () => { count += 1; return { ...cutoff(), output_text: '{"looksComplete":true}' }; }), (error) => error instanceof CcnaLessonOutputError && error.attempts.length === 2);
  assert.equal(count, 2);
});

test("only two overflow recoveries are shared across all draft, repair and review requests", async () => {
  const runner = createCcnaOutputRunner();
  for (const stage of ["lesson draft: lab", "lesson repair: teaching"]) {
    await runner.run(stage, [6_000, 8_000], async (_budget, recovery) => recovery ? completed() : cutoff());
  }
  let calls = 0;
  await assert.rejects(() => runner.run("independent technical review", [1_600, 3_000], async () => { calls += 1; return cutoff(); }), CcnaLessonOutputError);
  assert.equal(calls, 1);
});

for (const [name, response] of [
  ["content filtering", { ...cutoff(), incomplete_details: { reason: "content_filter" } }],
  ["refusal", { ...completed(), output: [{ type: "message", content: [{ type: "refusal" }] }] }],
  ["empty completion", completed(" ")],
  ["failed response", { ...completed(), status: "failed" }],
  ["pending response", { ...completed(), status: "in_progress" }],
  ["unknown status", { output_text: '{"complete":true}' }]
]) {
  test(`${name} is never mistaken for a complete lesson or retried as an output limit`, async () => {
    let calls = 0;
    await assert.rejects(() => createCcnaOutputRunner().run("teaching", [8_000, 10_000], async () => { calls += 1; return response; }), CcnaLessonOutputError);
    assert.equal(calls, 1);
  });
}

test("provider, authentication and deadline errors are not replayed by output recovery", async () => {
  for (const failure of [Object.assign(new Error("Unauthorized"), { status: 401 }), Object.assign(new Error("Quota exhausted"), { status: 429, code: "insufficient_quota" }), new CcnaRequestDeferredError("deadline", 60_000, "teaching")]) {
    let calls = 0;
    await assert.rejects(() => createCcnaOutputRunner().run("teaching", [8_000, 10_000], async () => { calls += 1; throw failure; }), (error) => error === failure);
    assert.equal(calls, 1);
  }
});

test("an expired shared deadline prevents an overflow recovery from making another paid call", async () => {
  let now = 0;
  let calls = 0;
  const requests = createCcnaRequestRunner({ deadlineAt: 30_000, now: () => now });
  await assert.rejects(() => createCcnaOutputRunner().run("teaching", [8_000, 10_000], () => requests.run("teaching", "gpt-4.1-mini", async () => { calls += 1; now = 29_000; return cutoff(); })), (error) => error.reason === "deadline");
  assert.equal(calls, 1);
});

test("part output cannot overwrite another part or quietly reuse a missing repaired field", async () => {
  await assert.rejects(() => writeCcnaLessonParts({ schema, request: async () => '{"sections":[]}' }), /unexpected part fields/);
  for (const text of ['{"lab":', '[]', 'null']) {
    await assert.rejects(() => writeCcnaLessonParts({ schema, request: async () => text }), CcnaLessonOutputError);
  }
  const repaired = JSON.parse(await writeCcnaLessonParts({ schema, repair: { candidate: { plainAnswer: "stale answer", lab: "old lab" }, issues: ["Fix the answer and topology together."] }, request: async (part) => {
    assert.match(part.input, /Fix the answer and topology together/);
    const value = partValues(part);
    delete value.plainAnswer;
    return JSON.stringify(value);
  } }));
  assert.equal(repaired.plainAnswer, undefined, "The full schema gate must see the missing field instead of a stale passing value.");
});

test("the real SDK exposes cutoff and usage metadata to bounded output recovery without networking", async () => {
  const payloads = [];
  const observed = [];
  const client = new OpenAI({ apiKey: "test-placeholder-no-network", maxRetries: 0, fetch: async (_url, init) => {
    payloads.push(JSON.parse(init.body));
    return new Response(JSON.stringify({ id: `resp_${payloads.length}`, object: "response", status: payloads.length === 1 ? "incomplete" : "completed", incomplete_details: payloads.length === 1 ? { reason: "max_output_tokens" } : null, output: [{ type: "message", role: "assistant", content: [{ type: "output_text", text: payloads.length === 1 ? '{"lab":' : '{"lab":"complete"}', annotations: [] }] }], usage: { input_tokens: 100, output_tokens: 200, total_tokens: 300, output_tokens_details: { reasoning_tokens: 10 } } }), { status: 200, headers: { "content-type": "application/json" } });
  } });
  const runner = createCcnaOutputRunner((event) => observed.push(event));
  const result = await runner.run("lab", [6_000, 8_000], (budget) => client.responses.create({ model: "gpt-4.1-mini", input: "Write the lab", store: false, max_output_tokens: budget }));
  assert.equal(result.output_text, '{"lab":"complete"}');
  assert.deepEqual(payloads.map((item) => item.max_output_tokens), [6_000, 8_000]);
  assert.ok(payloads.every((item) => item.store === false && item.previous_response_id === undefined));
  assert.equal(observed[0].reason, "max_output_tokens");
  assert.equal(observed[1].reasoningTokens, 10);
  assert.equal(observed[1].responseId, "resp_2");
});

test("assembled writing still passes through the complete independent-review and revision gate", async () => {
  let reviews = 0;
  const result = await runCcnaGenerationPipeline({
    write: () => writeCcnaLessonParts({ schema, request: async (part) => JSON.stringify(partValues(part)) }),
    inspect: (text) => ({ content: JSON.parse(text), candidate: JSON.parse(text), quality: { ready: true, score: 100, usefulWords: 2_000, issues: [] } }),
    review: async (candidate) => { reviews += 1; assert.deepEqual(Object.keys(candidate).sort(), [...schema.required].sort()); return { passed: false, issues: ["The lab does not prove the lesson's claimed outcome."] }; }
  });
  assert.equal(reviews, 3);
  assert.equal(result.quality.ready, false);
  assert.equal(result.reviewedContentDigest, ccnaContentDigest(result.content));
  assert.ok(ccnaReviewedRevisionIssues(result.content, { editorialReview: result.review, reviewedContentDigest: result.reviewedContentDigest }).length > 0);
});

test("a cut-off part stops assembly before review or publication", async () => {
  let reviews = 0;
  const outputs = createCcnaOutputRunner();
  await assert.rejects(() => runCcnaGenerationPipeline({
    write: () => writeCcnaLessonParts({ schema, request: async (part) => (await outputs.run(part.name, part.budgets, async () => cutoff())).output_text }),
    inspect: () => { throw new Error("Incomplete parts must never reach inspection."); },
    review: async () => { reviews += 1; return { passed: true, issues: [] }; }
  }), CcnaLessonOutputError);
  assert.equal(reviews, 0);
});
