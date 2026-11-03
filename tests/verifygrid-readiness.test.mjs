import assert from "node:assert/strict";
import test from "node:test";
import { buildVerifyGridReadiness } from "../src/lib/verifygrid-readiness.ts";
import { buildVerifyGridLifecycle } from "../src/lib/verifygrid-operating-model.ts";

const at = Date.parse("2026-11-03T10:00:00Z");
const input = {
  status: "active",
  gate: { executable: true, blockers: [], authorization: { validFrom: "2026-11-03T09:00:00Z", validUntil: "2026-11-03T11:00:00Z" } },
  scopeTargets: [{ inScope: true, ownershipConfirmed: true, environment: "lab" }],
  testCases: [{ status: "passed" }, { status: "finding" }, { status: "not_applicable" }, { status: "planned" }],
  executionJobs: [], observations: [], findings: [], reports: []
};

test("coverage distinguishes passed, findings, not applicable and incomplete work", () => {
  const result = buildVerifyGridReadiness(input, at);
  assert.deepEqual(result.coverage, { total: 4, passed: 1, findings: 1, notApplicable: 1, concluded: 3, incomplete: 1, percent: 75 });
  assert.equal(result.next.view, "methodology");
  const empty = buildVerifyGridReadiness({ ...input, testCases: [] }, at);
  assert.equal(empty.coverage.percent, 0);
  assert.equal(empty.next.view, "methodology");
});

test("a cached open gate closes locally at expiry and cannot override a paused state", () => {
  assert.equal(buildVerifyGridReadiness(input, at).executable, true);
  for (const time of [Date.parse("2026-11-03T11:00:00Z"), NaN]) assert.equal(buildVerifyGridReadiness(input, time).executable, false);
  assert.equal(buildVerifyGridReadiness({ ...input, status: "paused" }, at).executable, false);
  assert.equal(buildVerifyGridReadiness({ ...input, gate: { ...input.gate, authorization: null } }, at).executable, false);
});

test("unknown ownership never becomes an authorization or lifecycle pass", () => {
  const scopeTargets = [{ ...input.scopeTargets[0], ownershipConfirmed: undefined }];
  assert.equal(buildVerifyGridReadiness({ ...input, scopeTargets }, at).executable, false);
  assert.notEqual(buildVerifyGridLifecycle({ ...input, scopeTargets }).find((item) => item.key === "scope").state, "complete");
});

test("mixed completed and failed jobs remain incomplete and missing proof is visible", () => {
  const executionJobs = [{ status: "completed", resultBatchId: "" }, { status: "failed", resultBatchId: "" }];
  const result = buildVerifyGridReadiness({ ...input, testCases: [{ status: "passed" }], executionJobs }, at);
  assert.equal(result.jobExceptions, 1);
  assert.equal(result.missingJobEvidence, 1);
  assert.equal(result.next.view, "evidence");
  assert.equal(buildVerifyGridLifecycle({ ...input, executionJobs }).find((item) => item.key === "execute").state, "attention");
});

test("test status alone never completes the evidence stage", () => {
  assert.notEqual(buildVerifyGridLifecycle(input).find((item) => item.key === "evidence").state, "complete");
  const jobs = [{ status: "completed" }, { status: "processing_result" }];
  assert.equal(buildVerifyGridLifecycle({ ...input, executionJobs: jobs }).find((item) => item.key === "execute").state, "active");
});

test("only in-scope unreviewed observations enter the review count", () => {
  const observations = [{ promotionStatus: "pending", scopeDisposition: "in_scope" }, { promotionStatus: "pending", scopeDisposition: "out_of_scope" }, { promotionStatus: "promoted", scopeDisposition: "in_scope" }];
  assert.equal(buildVerifyGridReadiness({ ...input, observations }, at).pendingObservations, 1);
});
