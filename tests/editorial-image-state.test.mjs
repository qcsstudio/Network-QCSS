import assert from "node:assert/strict";
import test from "node:test";
import {
  editorialImageBillingRetryDelayMs,
  editorialImageGenerationLeaseMs,
  editorialImageRetryDelayMs,
  shouldDeferEditorialImageGeneration
} from "../src/lib/editorial-image-state.ts";

test("failed editorial images become retryable after the next automation cycle", () => {
  assert.equal(
    shouldDeferEditorialImageGeneration({
      ageMs: editorialImageRetryDelayMs - 1,
      force: false,
      promptChanged: false,
      status: "failed"
    }),
    true
  );
  assert.equal(
    shouldDeferEditorialImageGeneration({
      ageMs: editorialImageRetryDelayMs,
      force: false,
      promptChanged: false,
      status: "failed"
    }),
    false
  );
});

test("OpenAI billing failures use a longer retry backoff without blocking a forced admin retry", () => {
  const input = {
    ageMs: editorialImageBillingRetryDelayMs - 1,
    force: false,
    lastError: "429 You have no credits remaining.",
    promptChanged: false,
    status: "failed"
  };
  assert.equal(shouldDeferEditorialImageGeneration(input), true);
  assert.equal(shouldDeferEditorialImageGeneration({ ...input, ageMs: editorialImageBillingRetryDelayMs }), false);
  assert.equal(shouldDeferEditorialImageGeneration({ ...input, force: true }), false);
});

test("stale generation leases recover and prompt changes bypass old leases", () => {
  assert.equal(
    shouldDeferEditorialImageGeneration({
      ageMs: editorialImageGenerationLeaseMs,
      force: false,
      promptChanged: false,
      status: "generating"
    }),
    false
  );
  assert.equal(
    shouldDeferEditorialImageGeneration({ ageMs: 0, force: false, promptChanged: true, status: "failed" }),
    false
  );
});
