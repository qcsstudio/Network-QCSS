import assert from "node:assert/strict";
import test from "node:test";
import { buildImageRenderPrompt, restoreEditorialAgentTrace, visualQaPasses } from "../src/lib/editorial-image-agents.ts";

const direction = {
  storyThesis: "An unauthorized route origin is checked against the operator's ROA evidence before policy changes.",
  sceneConcept: "A physical route handoff is inspected at an exchange boundary, with one path isolated for evidence review.",
  focalSubject: "The disputed network path crossing an exchange boundary",
  supportingElements: ["Distinct authorized path", "Route validation evidence"],
  environment: "A restrained, technically plausible internet exchange operations environment",
  viewpoint: "Wide oblique view with the disputed path in the central safe area",
  lighting: "Neutral operational lighting with focused edge illumination",
  palette: ["cool blue", "white", "restrained coral accent"],
  avoid: ["padlock", "globe", "dashboard", "radial topology"],
  diversitySignature: "exchange-boundary-oblique-route-isolation",
  altText: "Illustration of a disputed internet route being checked at an exchange boundary before a policy change"
};

test("render prompt preserves article facts and prohibits generated branding or labels", () => {
  const prompt = buildImageRenderPrompt("ARTICLE: validate RPKI origin ASN against the published ROA.", direction);
  assert.match(prompt, /RPKI origin ASN/i);
  assert.match(prompt, /exchange boundary/i);
  assert.match(prompt, /no visible words, letters, numbers, logos/i);
});

test("visual QA requires both model approval and hard score thresholds", () => {
  const passing = {
    approved: true,
    relevanceScore: 90,
    specificityScore: 88,
    diversityScore: 82,
    compositionScore: 91,
    violations: [],
    rationale: "The route validation relationship is clear and article-specific.",
    correctionPrompt: ""
  };
  assert.equal(visualQaPasses(passing), true);
  assert.equal(visualQaPasses({ ...passing, specificityScore: 81 }), false);
  assert.equal(visualQaPasses({ ...passing, violations: ["Contains embedded text"] }), false);
  assert.equal(visualQaPasses({ ...passing, approved: false }), false);
});

test("QA correction is passed into the second image render", () => {
  const prompt = buildImageRenderPrompt("ARTICLE: packet capture at both firewall interfaces.", direction, "Show both capture points clearly.");
  assert.match(prompt, /MANDATORY QA CORRECTION: Show both capture points clearly/i);
});

test("stored agent traces are validated before a production retry reuses them", () => {
  const trace = {
    provider: "openai-direct",
    directorModel: "director",
    imageModel: "image",
    criticModel: "critic",
    direction,
    qa: {
      approved: false,
      relevanceScore: 88,
      specificityScore: 80,
      diversityScore: 90,
      compositionScore: 87,
      violations: ["The mirror path is ambiguous"],
      rationale: "The central technical relationship needs a clearer path.",
      correctionPrompt: "Make the passive mirror path visually explicit."
    },
    renderAttempts: 1
  };
  assert.deepEqual(restoreEditorialAgentTrace(trace), trace);
  assert.equal(restoreEditorialAgentTrace({ ...trace, provider: "gateway" }), null);
});
