import assert from "node:assert/strict";
import test from "node:test";
import { ccnaReviewCategories, ccnaIndependentReviewPolicy, ccnaIndependentReviewResponseSchema, validateCcnaIndependentReview, runCcnaIndependentReview } from "../src/lib/ccna-independent-review.ts";
import { assertCcnaOpenAISchema } from "../src/lib/ccna-openai-schema.ts";

const source = "https://www.cisco.com/c/en/us/support/docs/security/ios-firewall/23602-confaccesslists.html";
const content = { lab: { steps: [{ instruction: "Delete an unfamiliar list without checking its ownership." }] } };
const passing = () => ({ checks: ccnaReviewCategories.map((category) => ({ category, passed: true })), findings: [] });
const failing = () => {
  const result = passing();
  result.checks.find((item) => item.category === "safety_and_licensing").passed = false;
  result.findings.push({ category: "safety_and_licensing", path: "/lab/steps/0/instruction", quote: "Delete an unfamiliar list", impact: "Deleting another owner's policy can change unrelated traffic.", repair: "Stop on unknown ownership and preserve the existing list.", sourceUrls: [source] });
  return result;
};

test("independent review schema is OpenAI compatible and requires all nine checks", () => {
  assert.doesNotThrow(() => assertCcnaOpenAISchema(ccnaIndependentReviewResponseSchema));
  const result = validateCcnaIndependentReview(passing(), content, [source]);
  assert.deepEqual(result.review, { passed: true, issues: [] });
  assert.equal(result.evidence.checks.length, 9);
  const omitted = passing(); omitted.checks.pop();
  assert.throws(() => validateCcnaIndependentReview(omitted, content, [source]), /incomplete checklist/);
});

test("a genuine anchored safety finding blocks approval and preserves its evidence", () => {
  const result = validateCcnaIndependentReview(failing(), content, [source]);
  assert.equal(result.review.passed, false);
  assert.equal(result.review.issues.length, 1);
  assert.match(result.review.issues[0], /^\/lab\/steps\/0\/instruction:.*Repair:/);
  assert.deepEqual(result.evidence.findings[0].sourceUrls, [source]);
  assert.ok(result.review.issues[0].length <= 500);
});

test("duplicated categories cannot substitute for an omitted check", () => {
  const result = passing(); result.checks[1] = result.checks[0];
  assert.throws(() => validateCcnaIndependentReview(result, content, [source]), /repeated or omitted/);
});

test("unanchored or paraphrased review claims are not accepted as content defects", () => {
  for (const modify of [
    (finding) => { finding.path = "/lab/steps/5/instruction"; },
    (finding) => { finding.quote = "Made up wording"; },
    (finding) => { finding.path = "/__proto__/constructor"; },
    (finding) => { finding.path = "/lab~2steps"; }
  ]) {
    const result = failing(); modify(result.findings[0]);
    assert.throws(() => validateCcnaIndependentReview(result, content, [source]), /substantiate/);
  }
});

test("review source references must belong to verified evidence", () => {
  const result = failing(); result.findings[0].sourceUrls = ["https://www.cisco.com/invented-reference"];
  assert.throws(() => validateCcnaIndependentReview(result, content, [source]), /unverified source/);
});

test("contradictory review verdicts cannot approve or fabricate a failed category", () => {
  const falsePass = failing(); falsePass.checks.forEach((check) => { check.passed = true; });
  assert.throws(() => validateCcnaIndependentReview(falsePass, content, [source]), /contradicted/);
  const falseFail = passing(); falseFail.checks[0].passed = false;
  assert.throws(() => validateCcnaIndependentReview(falseFail, content, [source]), /contradicted/);
});

test("valid JSON Pointer escaped property names resolve without prototype access", () => {
  const result = failing(); result.findings[0].path = "/a~1b/~0key";
  assert.equal(validateCcnaIndependentReview(result, { "a/b": { "~key": content.lab.steps[0].instruction } }, [source]).review.passed, false);
});

test("review policy distinguishes material blockers from scope creep, without waiving safety", () => {
  assert.match(ccnaIndependentReviewPolicy, /material consequence.*Optional extra commands/);
  assert.match(ccnaIndependentReviewPolicy, /Do not dismiss genuine defects.*deterministic tests/);
  assert.match(ccnaIndependentReviewPolicy, /first check the entire prelude.*paired command explanation/);
  assert.match(ccnaIndependentReviewPolicy, /Do not introduce new lesson objectives/);
});

test("technical corrections must cite primary evidence, not unsupported reviewer recollection", () => {
  const result = failing();
  result.checks.forEach((check) => { check.passed = check.category !== "technical_accuracy"; });
  result.findings[0].category = "technical_accuracy";
  result.findings[0].sourceUrls = [];
  assert.throws(() => validateCcnaIndependentReview(result, content, [source]), /requires a verified primary source/);
});

test("clipped review feedback cannot become a lesson repair instruction", () => {
  for (const field of ["impact", "repair"]) {
    const result = failing(); result.findings[0][field] = "This field was cut before the";
    assert.throws(() => validateCcnaIndependentReview(result, content, [source]), /unfinished impact or repair/);
    result.findings[0][field] = "This explanation is incomplete...";
    assert.throws(() => validateCcnaIndependentReview(result, content, [source]), /unfinished impact or repair/);
  }
  const result = failing(); result.findings[0].repair = "Tell the learner: 'Stop on unknown ownership.'";
  assert.equal(validateCcnaIndependentReview(result, content, [source]).review.passed, false);
});

test("one invalid review response can be corrected without rewriting or approving flawed content", async () => {
  const feedbacks = [];
  const result = await runCcnaIndependentReview({ content, allowedSources: [source], request: async (feedback) => {
    feedbacks.push(feedback);
    return feedback ? JSON.stringify(failing()) : JSON.stringify({ checks: [], findings: [] });
  } });
  assert.equal(feedbacks.length, 2);
  assert.equal(feedbacks[0], undefined);
  assert.match(feedbacks[1], /incomplete checklist/);
  assert.equal(result.review.passed, false, "Corrected review still reports the actual safety defect.");
});

test("invalid reviews have a two-call ceiling and capacity errors do not start another review", async () => {
  let requests = 0;
  await assert.rejects(() => runCcnaIndependentReview({ content, allowedSources: [source], request: async () => { requests++; return "not JSON"; } }));
  assert.equal(requests, 2);
  requests = 0;
  const deferred = new Error("Capacity pause");
  await assert.rejects(() => runCcnaIndependentReview({ content, allowedSources: [source], request: async () => { requests++; throw deferred; } }), (error) => error === deferred);
  assert.equal(requests, 1);
});
