import assert from "node:assert/strict";
import test from "node:test";
import { validateGithubAutomationClaims } from "../src/lib/automation-auth.ts";

const now = 1_785_000_000;
const validClaims = {
  iss: "https://token.actions.githubusercontent.com",
  aud: "https://www.qcsstudio.com/automation",
  exp: now + 300,
  nbf: now - 10,
  iat: now - 10,
  repository: "qcsstudio/Network-QCSS",
  repository_id: "1286536826",
  ref: "refs/heads/main",
  workflow_ref: "qcsstudio/Network-QCSS/.github/workflows/editorial-automation.yml@refs/heads/main",
  event_name: "schedule",
  sub: "repo:qcsstudio/Network-QCSS:ref:refs/heads/main"
};

test("GitHub automation identity is constrained to the exact repository, branch, workflow, and audience", () => {
  assert.equal(validateGithubAutomationClaims(validClaims, now), true);
  assert.equal(validateGithubAutomationClaims({ ...validClaims, repository: "someone/fork" }, now), false);
  assert.equal(validateGithubAutomationClaims({ ...validClaims, ref: "refs/heads/feature" }, now), false);
  assert.equal(validateGithubAutomationClaims({ ...validClaims, aud: "https://attacker.example" }, now), false);
  assert.equal(validateGithubAutomationClaims({ ...validClaims, workflow_ref: "qcsstudio/Network-QCSS/.github/workflows/other.yml@refs/heads/main" }, now), false);
});

test("GitHub automation identity rejects expired and unsupported events", () => {
  assert.equal(validateGithubAutomationClaims({ ...validClaims, exp: now - 31 }, now), false);
  assert.equal(validateGithubAutomationClaims({ ...validClaims, event_name: "pull_request" }, now), false);
});
