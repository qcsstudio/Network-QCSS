import assert from "node:assert/strict";
import test from "node:test";
import {
  authorizationSchema,
  engagementTransition,
  findingRiskScore,
  scopeHash,
  scopeTargetSchema
} from "../src/lib/verifygrid-domain.ts";

const firstTarget = {
  targetType: "domain",
  value: "example.com",
  environment: "production",
  criticality: "high",
  permission: "safe_checks",
  inScope: true,
  ownershipConfirmed: true
};

const exclusion = {
  targetType: "hostname",
  value: "payments.example.com",
  environment: "production",
  criticality: "critical",
  permission: "manual_only",
  inScope: false,
  ownershipConfirmed: false
};

test("scope hash is deterministic and order independent", () => {
  assert.equal(scopeHash([firstTarget, exclusion]), scopeHash([exclusion, firstTarget]));
});

test("scope hash changes when a testing permission changes", () => {
  const changed = { ...firstTarget, permission: "controlled_validation" };
  assert.notEqual(scopeHash([firstTarget, exclusion]), scopeHash([changed, exclusion]));
});

test("in-scope targets require ownership confirmation", () => {
  const result = scopeTargetSchema.safeParse({ ...firstTarget, ownershipConfirmed: false });
  assert.equal(result.success, false);
});

test("authorization windows are bounded and ordered", () => {
  const validFrom = new Date("2026-07-22T00:00:00.000Z");
  const valid = authorizationSchema.safeParse({
    approvedByName: "Authorized Owner",
    approvedByEmail: "owner@example.com",
    authorityConfirmed: true,
    validFrom,
    validUntil: new Date("2026-07-29T00:00:00.000Z")
  });
  const excessive = authorizationSchema.safeParse({
    approvedByName: "Authorized Owner",
    approvedByEmail: "owner@example.com",
    authorityConfirmed: true,
    validFrom,
    validUntil: new Date("2026-11-01T00:00:00.000Z")
  });
  assert.equal(valid.success, true);
  assert.equal(excessive.success, false);
});

test("engagement state machine blocks unsafe shortcuts", () => {
  assert.equal(engagementTransition("authorized", "start"), "active");
  assert.equal(engagementTransition("draft", "start"), null);
  assert.equal(engagementTransition("active", "close"), null);
  assert.equal(engagementTransition("remediation", "close"), "closed");
});

test("known exploitation materially raises risk priority", () => {
  const baseline = findingRiskScore({ severity: "high", knownExploited: false, epssScore: 0.1, confidence: "likely", assetCriticality: "high" });
  const exploited = findingRiskScore({ severity: "high", knownExploited: true, epssScore: 0.1, confidence: "likely", assetCriticality: "high" });
  assert.ok(exploited >= baseline + 18);
});
