import assert from "node:assert/strict";
import test from "node:test";
import {
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
