import assert from "node:assert/strict";
import test from "node:test";
import {
  editorialImageWaitMessage,
  socialPublicationFailurePolicy
} from "../src/lib/social-publication-state.ts";

test("editorial image waits never exhaust the LinkedIn publication", () => {
  assert.deepEqual(socialPublicationFailurePolicy(20, editorialImageWaitMessage), {
    delayMinutes: 10,
    terminal: false
  });
});

test("ordinary LinkedIn failures retain capped exponential retries", () => {
  assert.deepEqual(socialPublicationFailurePolicy(2, "LinkedIn API unavailable"), {
    delayMinutes: 20,
    terminal: false
  });
  assert.deepEqual(socialPublicationFailurePolicy(6, "LinkedIn API unavailable"), {
    delayMinutes: 320,
    terminal: true
  });
});
