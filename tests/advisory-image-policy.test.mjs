import assert from "node:assert/strict";
import test from "node:test";
import { advisoryConceptIssues, advisoryRenderNeedsManualRetry, generateAdvisoryConceptImage } from "../src/lib/advisory-image-policy.ts";

// Synthetic briefs test visual grounding, not claims about a real vulnerability.
const facts = "The request handler runs before authentication. Restrict access until the approved update is applied. Exploitation has not been confirmed.";
const concept = {
  sceneConcept: "A cutaway isolates a request parser on the public side of an authentication boundary.",
  diversitySignature: "request-parser-cutaway-authentication-boundary",
  advisoryConcept: {
    evidenceToVisual: [
      { evidenceQuote: "The request handler runs before authentication.", visualElement: "A parser sits before the authentication boundary, without implying a successful compromise." },
      { evidenceQuote: "Restrict access until the approved update is applied.", visualElement: "A temporary restricted path separates the exposed service from external requests." }
    ],
    compositionRationale: "A cutaway explains the ordering of the request handler and authentication boundary.",
    differenceFromRecent: "This is a component cutaway, not the previous credential handoff scene."
  }
};
const config = { premiumAllowed: true, openAIConfigured: true, bflConfigured: true, openAIFallbackEnabled: false };

test("a grounded advisory concept passes without prescribing its layout", () => {
  assert.deepEqual(advisoryConceptIssues(facts, concept, []), []);
});

test("a missing concept, fabricated evidence or duplicate evidence fails before rendering", () => {
  assert.match(advisoryConceptIssues(facts, { ...concept, advisoryConcept: null }, []).join(), /evidence-mapped/);
  const fabricated = structuredClone(concept);
  fabricated.advisoryConcept.evidenceToVisual[0].evidenceQuote = "Attackers stole production credentials.";
  assert.match(advisoryConceptIssues(facts, fabricated, []).join(), /quote the supplied/);
  const duplicate = structuredClone(concept);
  duplicate.advisoryConcept.evidenceToVisual[1] = duplicate.advisoryConcept.evidenceToVisual[0];
  assert.match(advisoryConceptIssues(facts, duplicate, []).join(), /distinct advisory facts/);
});

test("repeated scenes and signatures fail even when vendor names or colours change", () => {
  assert.match(advisoryConceptIssues(facts, concept, [concept]).join(), /repeats recent work/);
  assert.match(advisoryConceptIssues(facts, concept, [{ ...concept, sceneConcept: "Different vendor and blue colours" }]).join(), /repeats recent work/);
});

test("BFL uses the directed pipeline exactly once", async () => {
  let calls = 0;
  const source = { source: Buffer.from("approved master") };
  const result = await generateAdvisoryConceptImage(config, {
    bfl: async () => { calls++; return source; },
    openAI: async () => { throw new Error("Unexpected fallback"); }
  });
  assert.equal(result, source);
  assert.equal(calls, 1);
});

test("direct OpenAI rendering requires its explicit opt-in", async () => {
  let calls = 0;
  const runners = { bfl: async () => assert.fail("BFL is disabled"), openAI: async () => { calls++; return "approved"; } };
  await assert.rejects(generateAdvisoryConceptImage({ ...config, bflConfigured: false }, runners), /explicitly enable/);
  assert.equal(calls, 0);
  assert.equal(await generateAdvisoryConceptImage({ ...config, bflConfigured: false, openAIFallbackEnabled: true }, runners), "approved");
});

test("missing director credentials or exhausted budget performs no paid render", async () => {
  const runners = { bfl: async () => assert.fail("Must not render"), openAI: async () => assert.fail("Must not render") };
  await assert.rejects(generateAdvisoryConceptImage({ ...config, openAIConfigured: false }, runners), /configure OpenAI/);
  await assert.rejects(generateAdvisoryConceptImage({ ...config, premiumAllowed: false }, runners), /budget unavailable/);
});

test("provider and visual-QA failures propagate without a template or second paid render", async () => {
  for (const reason of ["Provider unavailable", "Visual QA rejected the image"]) {
    const failure = new Error(reason);
    await assert.rejects(generateAdvisoryConceptImage({ ...config, openAIFallbackEnabled: true }, {
      bfl: async () => { throw failure; },
      openAI: async () => assert.fail("Must not start another paid render")
    }), (error) => error === failure);
  }
});

test("automation does not repeat a failed paid advisory render", () => {
  const failure = { contentType: "security_advisory", status: "failed", renderAttempts: 1, force: false, promptChanged: false };
  assert.equal(advisoryRenderNeedsManualRetry(failure), true);
  assert.equal(advisoryRenderNeedsManualRetry({ ...failure, force: true }), false);
  assert.equal(advisoryRenderNeedsManualRetry({ ...failure, promptChanged: true }), false);
  assert.equal(advisoryRenderNeedsManualRetry({ ...failure, renderAttempts: undefined }), false);
  assert.equal(advisoryRenderNeedsManualRetry({ ...failure, status: "ready" }), false);
  assert.equal(advisoryRenderNeedsManualRetry({ ...failure, contentType: "content_post" }), true);
});
