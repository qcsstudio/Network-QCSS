import assert from "node:assert/strict";
import test from "node:test";
import { firstNetworkVisualStory } from "../src/lib/ccna-visual-story.ts";
import {
  buildImageRenderPrompt,
  directVisualDirection,
  normalizeVisualQaScores,
  restoreEditorialAgentTrace,
  runBflEditorialImageAgents,
  traceForEditorialRetry,
  visualQaPasses
} from "../src/lib/editorial-image-agents.ts";
import { buildEditorialImagePrompt } from "../src/lib/editorial-image-prompt.ts";

const direction = {
  storyThesis: "An unauthorized route origin is checked against the operator's ROA evidence before policy changes.",
  mechanismStatement: "The observed BGP origin is compared with the prefix authorization in a published ROA.",
  factualAnchors: ["An observed BGP route", "A separate ROA authorization record"],
  prohibitedInferences: ["Do not imply an active hijack", "Do not imply traffic theft", "Do not show vendor-specific hardware"],
  confidenceBoundary: "The scene shows validation evidence and a policy decision, not a confirmed malicious route hijack.",
  sceneConcept: "A physical route handoff is inspected at an exchange boundary, with one path isolated for evidence review.",
  focalSubject: "The disputed network path crossing an exchange boundary",
  supportingElements: ["Distinct authorized path", "Route validation evidence"],
  environment: "A restrained, technically plausible internet exchange operations environment",
  viewpoint: "Wide oblique view with the disputed path in the central safe area",
  lighting: "Neutral operational lighting with focused edge illumination",
  palette: ["cool blue", "white", "restrained coral accent"],
  avoid: ["padlock", "globe", "dashboard", "radial topology"],
  diversitySignature: "exchange-boundary-oblique-route-isolation",
  altText: "Illustration of a disputed internet route being checked at an exchange boundary before a policy change."
};

test("render prompt preserves article facts and prohibits generated branding or labels", () => {
  const prompt = buildImageRenderPrompt("ARTICLE: validate RPKI origin ASN against the published ROA.", direction);
  assert.match(prompt, /RPKI origin ASN/i);
  assert.match(prompt, /exchange boundary/i);
  assert.match(prompt, /no visible words, letters, numbers, logos/i);
});

test("the selected concept and its teaching rationale reach the image producer", () => {
  const conceptSelection = firstNetworkVisualStory.conceptSelection;
  const prompt = buildImageRenderPrompt("A first local network.", { ...direction, conceptSelection });
  assert.ok(prompt.includes(conceptSelection.candidates[conceptSelection.selectedIndex].scene));
  assert.ok(prompt.includes(conceptSelection.selectionReason));
});

test("visual QA uses blocking violations and hard score thresholds as the authority", () => {
  const passing = {
    approved: true,
    factualAccuracyScore: 94,
    inferenceDisciplineScore: 93,
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

test("ten-point critic scores are normalized to the required hundred-point scale", () => {
  const normalized = normalizeVisualQaScores({
    approved: true,
    factualAccuracyScore: 10,
    inferenceDisciplineScore: 10,
    relevanceScore: 10,
    specificityScore: 10,
    diversityScore: 9,
    compositionScore: 9,
    violations: [],
    rationale: "The article-specific relationship is clear and publication ready.",
    correctionPrompt: ""
  });
  assert.equal(normalized.relevanceScore, 100);
  assert.equal(normalized.factualAccuracyScore, 100);
  assert.equal(normalized.diversityScore, 90);
  assert.equal(visualQaPasses(normalized), true);
});

test("QA correction is passed into the second image render", () => {
  const prompt = buildImageRenderPrompt("ARTICLE: packet capture at both firewall interfaces.", direction, "Show both capture points clearly.");
  assert.match(prompt, /MANDATORY QA CORRECTION: Show both capture points clearly/i);
});

test("visible-text corrections structurally override conflicting screen details", () => {
  const screenDirection = {
    ...direction,
    supportingElements: ["A terminal displaying update commands and progress"]
  };
  const prompt = buildImageRenderPrompt(
    "ARTICLE: apply the approved kernel update and reboot.",
    screenDirection,
    "Remove all visible text and code from the monitor."
  );
  assert.match(prompt, /TEXT-VIOLATION OVERRIDE/i);
  assert.match(prompt, /Remove those objects from the composition completely/i);
  assert.match(prompt, /supersedes every conflicting screen, terminal, command, log, label, document, interface, or keyboard detail/i);
});

test("stored agent traces are validated before a production retry reuses them", () => {
  const trace = {
    provider: "openai-direct",
    qaPolicyVersion: 3,
    directorModel: "director",
    imageModel: "image",
    criticModel: "critic",
    direction,
    qa: {
      approved: false,
      factualAccuracyScore: 94,
      inferenceDisciplineScore: 92,
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
  const legacyTrace = structuredClone(trace);
  legacyTrace.qaPolicyVersion = 2;
  assert.equal(restoreEditorialAgentTrace(legacyTrace), null);
});

test("paid renders are never retried automatically", () => {
  const trace = {
    provider: "openai-direct",
    qaPolicyVersion: 3,
    directorModel: "director",
    imageModel: "image",
    criticModel: "critic",
    direction,
    qa: {
      approved: false,
      factualAccuracyScore: 95,
      inferenceDisciplineScore: 94,
      relevanceScore: 90,
      specificityScore: 86,
      diversityScore: 40,
      compositionScore: 90,
      violations: ["The composition repeats a recent scene"],
      rationale: "The image needs a genuinely different narrative mechanism.",
      correctionPrompt: "Replace the bench scene with a different composition."
    },
    renderAttempts: 3
  };
  const firstAttempt = { ...trace, renderAttempts: 1 };
  assert.equal(traceForEditorialRetry(firstAttempt), null);
  assert.equal(traceForEditorialRetry(trace), null);
});

function advisoryDirection() {
  return {
    ...direction,
    conceptSelection: firstNetworkVisualStory.conceptSelection,
    advisoryConcept: {
      evidenceToVisual: direction.factualAnchors.map((fact) => ({ evidenceQuote: fact, visualElement: `A visible component represents ${fact}.` })),
      compositionRationale: "The scene separates the observed route from the independent authorization evidence.",
      differenceFromRecent: "No previous advisory compositions are present in this synthetic test."
    }
  };
}

function directorResponse(value) {
  return new Response(JSON.stringify({
    id: "resp_mock", object: "response", status: "completed", output_text: JSON.stringify(value),
    output: [{ type: "message", role: "assistant", content: [{ type: "output_text", text: JSON.stringify(value), annotations: [] }] }]
  }), { headers: { "content-type": "application/json" } });
}

async function withMockCredentials(callback) {
  const saved = { OPENAI_API_KEY: process.env.OPENAI_API_KEY, BFL_API_KEY: process.env.BFL_API_KEY };
  process.env.OPENAI_API_KEY = "sk-test-only-not-a-real-key";
  process.env.BFL_API_KEY = "test-only-not-a-real-key";
  try { return await callback(); }
  finally {
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

test("the actual director repairs missing advisory grounding before a paid render", async (t) => {
  const bodies = [];
  t.mock.method(globalThis, "fetch", async (input, init) => {
    const request = new Request(input, init);
    assert.match(request.url, /\/responses$/);
    bodies.push(await request.json());
    return directorResponse(bodies.length === 1 ? { ...advisoryDirection(), advisoryConcept: null } : advisoryDirection());
  });
  const prompt = buildEditorialImagePrompt({ contentType: "security_advisory", title: "Synthetic advisory", context: direction.factualAnchors.join("\n") });
  const result = await withMockCredentials(() => directVisualDirection(prompt, []));
  assert.deepEqual(result.advisoryConcept, advisoryDirection().advisoryConcept);
  assert.equal(bodies.length, 2);
  assert.match(bodies[1].input, /Create an evidence-mapped advisory concept/);
  assert.ok(bodies[0].text.format.schema.required.includes("advisoryConcept"));
});

test("the actual director refuses repeated advisory concepts after bounded planning retries", async (t) => {
  let calls = 0;
  t.mock.method(globalThis, "fetch", async () => { calls++; return directorResponse(advisoryDirection()); });
  const prompt = buildEditorialImagePrompt({ contentType: "security_advisory", title: "Synthetic advisory", context: direction.factualAnchors.join("\n") });
  await withMockCredentials(() => assert.rejects(directVisualDirection(prompt, [direction]), /repeats recent work/));
  assert.equal(calls, 2);
});

test("clipped alt text is rewritten during planning before a paid render", async (t) => {
  const bodies = [];
  t.mock.method(globalThis, "fetch", async (input, init) => {
    const request = new Request(input, init);
    assert.match(request.url, /\/responses$/);
    bodies.push(await request.json());
    return directorResponse(bodies.length === 1 ? { ...advisoryDirection(), altText: "Illustration of a route boundary where the" } : advisoryDirection());
  });
  const prompt = buildEditorialImagePrompt({ contentType: "security_advisory", title: "Synthetic advisory", context: direction.factualAnchors.join("\n") });
  const result = await withMockCredentials(() => directVisualDirection(prompt, []));
  assert.equal(bodies.length, 2);
  assert.match(bodies[1].input, /Rewrite altText/);
  assert.match(result.altText, /\.$/);
});

test("provider failures retain a paid-attempt trace for the automation retry guard", async (t) => {
  let renders = 0;
  t.mock.method(globalThis, "fetch", async (input, init) => {
    const request = new Request(input, init);
    if (request.url.endsWith("/responses")) return directorResponse(advisoryDirection());
    assert.match(request.url, /^https:\/\/api\.bfl\.ai\//);
    renders++;
    return new Response("Provider unavailable", { status: 503 });
  });
  const prompt = buildEditorialImagePrompt({ contentType: "security_advisory", title: "Synthetic advisory", context: direction.factualAnchors.join("\n") });
  await withMockCredentials(() => assert.rejects(runBflEditorialImageAgents(prompt, []), (error) => {
    assert.equal(error.trace.provider, "black-forest-labs");
    assert.equal(error.trace.renderAttempts, 1);
    return true;
  }));
  assert.equal(renders, 1);
});
