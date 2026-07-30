import assert from "node:assert/strict";
import test from "node:test";
import { validateOpenAIApiKey } from "../src/lib/openai-config.ts";

test("OpenAI key validation distinguishes missing and malformed values", () => {
  assert.deepEqual(validateOpenAIApiKey(undefined), {
    apiKey: "",
    configured: false,
    credentialIssue: "missing"
  });
  assert.deepEqual(validateOpenAIApiKey("Configured"), {
    apiKey: "Configured",
    configured: false,
    credentialIssue: "malformed"
  });
});

test("OpenAI key validation accepts a plausible complete secret", () => {
  assert.deepEqual(validateOpenAIApiKey("  sk-test_abcdefghijklmnopqrstuvwxyz  "), {
    apiKey: "sk-test_abcdefghijklmnopqrstuvwxyz",
    configured: true,
    credentialIssue: null
  });
});
