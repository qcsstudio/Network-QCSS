import assert from "node:assert/strict";
import test from "node:test";
import OpenAI from "openai";
import { CcnaRequestDeferredError, ccnaProviderRetryDelay, createCcnaRequestRunner } from "../src/lib/ccna-openai-requests.ts";

const message = "Rate limit reached for gpt-4.1 on tokens per min (TPM): Limit 30000, Used 16589, Requested 18822. Please try again in 10.822s.";
const rateError = (headers = {}, extra = {}) => Object.assign(new Error(message), { status: 429, code: "rate_limit_exceeded", headers: new Headers(headers), ...extra });

function clockedRunner(deadlineAt = 270_000) {
  let now = 0;
  const waits = [];
  const runner = createCcnaRequestRunner({ deadlineAt, now: () => now, random: () => 0, sleep: async (ms) => { waits.push(ms); now += ms; } });
  return { ...runner, waits, advance: (ms) => { now += ms; } };
}

test("the reported 10.822 second TPM error respects the provider minimum", () => {
  assert.equal(ccnaProviderRetryDelay(rateError(), 0, 0), 10_822);
  assert.equal(ccnaProviderRetryDelay(rateError({ "retry-after": "12" }), 0, 0), 12_000);
  assert.equal(ccnaProviderRetryDelay(rateError({ "retry-after-ms": "13000", "retry-after": "12" }), 0, 0), 13_000);
});

test("HTTP date, reset headers, and fallback backoff are supported", () => {
  const base = { message: "Rate limit reached." };
  assert.equal(ccnaProviderRetryDelay(rateError({ "retry-after": "Thu, 01 Jan 1970 00:00:15 GMT" }, base), 0, 0), 15_000);
  assert.equal(ccnaProviderRetryDelay(rateError({ "x-ratelimit-reset-tokens": "1m2.5s", "x-ratelimit-reset-project-tokens": "2s", "x-ratelimit-reset-requests": "200ms" }, base), 0, 0), 62_500);
  assert.equal(ccnaProviderRetryDelay(rateError({ "retry-after": "-1", "retry-after-ms": "NaN" }, base), 0, 0), 5_000);
  assert.equal(ccnaProviderRetryDelay(rateError({}, base), 1, 0), 10_000);
});

test("temporary throttle retries the same SDK payload and retains the response", async () => {
  const runner = clockedRunner();
  const payloads = [];
  const client = new OpenAI({ apiKey: "test-placeholder-no-network", maxRetries: 0, fetch: async (_url, init) => {
    payloads.push(JSON.parse(init.body));
    if (payloads.length === 1) return new Response(JSON.stringify({ error: { message, code: "rate_limit_exceeded", type: "tokens" } }), { status: 429, headers: { "content-type": "application/json", "retry-after": "10.822" } });
    return new Response(JSON.stringify({ id: "resp_test", object: "response", status: "completed", output: [{ type: "message", role: "assistant", content: [{ type: "output_text", text: "complete lesson", annotations: [] }] }] }), { status: 200, headers: { "content-type": "application/json" } });
  } });
  const request = { model: "gpt-4.1", input: "Preserve the complete lesson and source evidence.", max_output_tokens: 14_000, store: false };
  const response = await runner.run("lesson repair", request.model, (timeout) => client.responses.create(request, { timeout, maxRetries: 0 }));
  assert.equal(response.output_text, "complete lesson");
  assert.equal(payloads.length, 2);
  assert.deepEqual(payloads[0], payloads[1]);
  assert.equal(payloads[1].max_output_tokens, 14_000);
  assert.deepEqual(runner.waits, [11_072]);
  assert.deepEqual(runner.events, [{ stage: "lesson repair", model: "gpt-4.1", retry: 1, delayMs: 11_072 }]);
});

test("only two retries are allowed for one request", async () => {
  const runner = clockedRunner();
  let calls = 0;
  await assert.rejects(() => runner.run("lesson repair", "gpt-4.1", async () => { calls += 1; throw rateError(); }), (error) => error instanceof CcnaRequestDeferredError && error.reason === "rate_limit");
  assert.equal(calls, 3);
  assert.equal(runner.waits.length, 2);
});

test("the wait budget is shared across research, writing and review requests", async () => {
  const runner = clockedRunner();
  for (const stage of ["source research", "lesson draft"]) {
    let calls = 0;
    await runner.run(stage, "gpt-4.1", async () => { if (++calls === 1) throw rateError({ "retry-after": "25" }); return "complete"; });
  }
  await assert.rejects(() => runner.run("independent technical review", "gpt-4.1", async () => { throw rateError({ "retry-after": "25" }); }), (error) => error.reason === "rate_limit");
  assert.deepEqual(runner.waits, [25_250, 25_250]);
});

test("quota, billing, authentication and ambiguous network failures are never replayed", async () => {
  for (const error of [rateError({}, { code: "insufficient_quota" }), rateError({}, { code: "billing_hard_limit_reached" }), Object.assign(new Error("Unauthorized"), { status: 401 }), new Error("Connection interrupted"), Object.assign(new Error("Internal error"), { status: 500 })]) {
    const runner = clockedRunner();
    let calls = 0;
    await assert.rejects(() => runner.run("lesson draft", "gpt-4.1", async () => { calls += 1; throw error; }), (observed) => observed === error);
    assert.equal(calls, 1);
    assert.deepEqual(runner.waits, []);
  }
});

test("temporary overload and slow_down retry only with their explicit provider codes", async () => {
  for (const error of [rateError({}, { code: "slow_down", message: "Slow down" }), rateError({}, { status: 503, code: "server_is_overloaded", message: "Model overloaded" })]) {
    const runner = clockedRunner();
    let calls = 0;
    assert.equal(await runner.run("lesson draft", "gpt-4.1", async () => { if (++calls === 1) throw error; return "ok"; }), "ok");
    assert.equal(calls, 2);
    assert.deepEqual(runner.waits, [5_250]);
  }
});

test("a request larger than the entire TPM limit does not waste time retrying", async () => {
  const runner = clockedRunner();
  let calls = 0;
  await assert.rejects(() => runner.run("lesson repair", "gpt-4.1", async () => { calls += 1; throw rateError({}, { message: "Rate limit reached on tokens per min (TPM): Limit 30,000, Used 0, Requested 31,001. Please try again in 10s." }); }), (error) => error.reason === "request_too_large" && error.retryAfterMs === 0);
  assert.equal(calls, 1);
  assert.deepEqual(runner.waits, []);
});

test("long Retry-After values are not shortened to fit the wait budget", async () => {
  const runner = clockedRunner();
  await assert.rejects(() => runner.run("lesson repair", "gpt-4.1", async () => { throw rateError({ "retry-after": "120" }); }), (error) => error.retryAfterMs >= 120_000);
  assert.deepEqual(runner.waits, []);
});

test("an expired request deadline prevents new calls and leaves time for saving status", async () => {
  const runner = clockedRunner(4_000);
  let calls = 0;
  await assert.rejects(() => runner.run("lesson draft", "gpt-4.1", async () => { calls += 1; }), (error) => error.reason === "deadline");
  assert.equal(calls, 0);
  const limited = clockedRunner(30_000);
  await assert.rejects(() => limited.run("lesson repair", "gpt-4.1", async (timeout) => { assert.equal(timeout, 25_000); throw rateError(); }), (error) => error.reason === "rate_limit");
  assert.deepEqual(limited.waits, []);
});
