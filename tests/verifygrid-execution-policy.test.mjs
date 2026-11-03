import assert from "node:assert/strict";
import test from "node:test";
import { validateExecutionBoundary } from "../src/lib/verifygrid-execution-domain.ts";
import { evaluateReportQuality } from "../src/lib/verifygrid-assurance-domain.ts";

const now = new Date("2026-11-03T10:00:00Z");
const boundary = {
  now, engagementStatus: "active", testMode: "safe_checks", scopeHash: "scope-v1", capability: "tls_posture",
  requestedStartAt: now, validUntil: new Date("2026-11-03T11:00:00Z"),
  authorization: { id: "auth", status: "active", scopeHash: "scope-v1", authorityConfirmed: true, validFrom: new Date("2026-11-03T09:00:00Z"), validUntil: new Date("2026-11-03T12:00:00Z") },
  targets: [{ id: "target", targetType: "ip", value: "198.51.100.10", environment: "lab", criticality: "medium", permission: "safe_checks", inScope: true, ownershipConfirmed: true }]
};

test("paused and non-executing engagements cannot create, dispatch or renew work", () => {
  for (const engagementStatus of ["paused", "draft", "authorization_pending", "remediation", "closed", "cancelled", "unknown"]) {
    assert.equal(validateExecutionBoundary({ ...boundary, engagementStatus }).allowed, false, engagementStatus);
  }
  for (const engagementStatus of ["authorized", "scheduled", "active"]) assert.equal(validateExecutionBoundary({ ...boundary, engagementStatus }).allowed, true);
});

test("execution and authorization expiry are exclusive at the exact end timestamp", () => {
  assert.equal(validateExecutionBoundary({ ...boundary, validUntil: now }).allowed, false);
  assert.equal(validateExecutionBoundary({ ...boundary, authorization: { ...boundary.authorization, validUntil: now } }).allowed, false);
  assert.equal(validateExecutionBoundary({ ...boundary, now: new Date("2026-11-03T11:00:00Z") }).allowed, false);
});

test("invalid and backwards time windows fail closed even without schema parsing", () => {
  for (const change of [
    { requestedStartAt: new Date(NaN) }, { validUntil: new Date(NaN) }, { now: new Date(NaN) },
    { requestedStartAt: new Date("2026-11-03T11:30:00Z") },
    { authorization: { ...boundary.authorization, validUntil: new Date(NaN) } },
    { authorization: { ...boundary.authorization, validFrom: new Date(NaN) } },
    { validUntil: new Date("2026-11-05T11:00:00Z") }
  ]) assert.equal(validateExecutionBoundary({ ...boundary, ...change }).allowed, false);
});

test("a valid future scheduled window is still allowed inside current authorization", () => {
  assert.equal(validateExecutionBoundary({ ...boundary, requestedStartAt: new Date("2026-11-03T10:30:00Z") }).allowed, true);
});

test("scope changes and revoked authority block a previously valid lease", () => {
  assert.equal(validateExecutionBoundary({ ...boundary, scopeHash: "scope-v2" }).allowed, false);
  assert.equal(validateExecutionBoundary({ ...boundary, authorization: { ...boundary.authorization, status: "revoked" } }).allowed, false);
});

test("report review stays blocked while results or retries are unsettled", () => {
  for (const state of ["queued", "claimed", "running", "processing_result", "retry", "retry_pending"]) {
    const result = evaluateReportQuality({
      reportType: "technical", now, currentScopeHash: "scope-v1", scopeTargets: boundary.targets,
      activeAuthorization: boundary.authorization, testCases: [], findings: [], importStatuses: [], executionStatuses: [state]
    });
    assert.equal(result.checks.find((item) => item.code === "execution.quiescent").status, "fail", state);
  }
});
