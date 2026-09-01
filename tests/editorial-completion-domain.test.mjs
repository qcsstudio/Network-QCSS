import assert from "node:assert/strict";
import test from "node:test";
import {
  editorialAutomationFromTrace,
  editorialAutomationIsDue,
  editorialTraceWithAutomation,
  finishEditorialAutomation,
  startEditorialAutomation
} from "../src/lib/editorial-completion-domain.ts";

const now = new Date("2026-09-01T10:00:00.000Z");

test("new editorial work is queued and a running lease prevents duplicate spend", () => {
  const pending = editorialAutomationFromTrace(null);
  assert.equal(pending.status, "pending");
  assert.equal(editorialAutomationIsDue(pending, now), true);

  const running = startEditorialAutomation(pending, now);
  assert.equal(editorialAutomationIsDue(running, new Date("2026-09-01T10:10:00.000Z")), false);
  assert.equal(editorialAutomationIsDue(running, new Date("2026-09-01T10:16:00.000Z")), true);
});

test("failed completion uses bounded backoff before requiring review", () => {
  const first = finishEditorialAutomation(editorialAutomationFromTrace(null), { ready: false, error: "Research incomplete" }, now);
  assert.equal(first.status, "retry_scheduled");
  assert.equal(first.attempts, 1);
  assert.equal(first.nextAttemptAt, "2026-09-01T10:15:00.000Z");

  const second = finishEditorialAutomation(first, { ready: false, error: "Citation repair incomplete" }, now);
  assert.equal(second.status, "retry_scheduled");
  assert.equal(second.attempts, 2);
  assert.equal(second.nextAttemptAt, "2026-09-01T11:00:00.000Z");

  const third = finishEditorialAutomation(second, { ready: false, error: "Quality threshold not reached" }, now);
  assert.equal(third.status, "needs_review");
  assert.equal(third.attempts, 3);
  assert.equal(editorialAutomationIsDue(third, new Date("2026-09-02T10:00:00.000Z")), false);
});

test("successful completion preserves the research trace and waits for human approval", () => {
  const ready = finishEditorialAutomation(editorialAutomationFromTrace(null), { ready: true }, now);
  const trace = editorialTraceWithAutomation({ provider: "openai-direct", research: { coverage: { evidenceSources: 4 } } }, ready);
  assert.equal(ready.status, "ready");
  assert.equal(trace.provider, "openai-direct");
  assert.deepEqual(trace.research, { coverage: { evidenceSources: 4 } });
  assert.equal(editorialAutomationFromTrace(trace).status, "ready");
});
