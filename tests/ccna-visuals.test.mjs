import assert from "node:assert/strict";
import test from "node:test";
import sharp from "sharp";
import { ccnaOpenAIResponseSchema } from "../src/lib/ccna-lesson-schema.ts";
import { ccnaVisualFieldLimits, ccnaVisualStorySchema, ccnaVisualStoryIssues, ccnaVisualTextBudgets, firstNetworkVisualStory, visualStoryForLesson, firstNetworkArtwork } from "../src/lib/ccna-visual-story.ts";
import { visualConceptIssues } from "../src/lib/visual-concept-policy.ts";
import { contrastRatio } from "../src/lib/editorial-quality-policy.ts";

const sources = [...new Set(firstNetworkVisualStory.stages.flatMap((stage) => stage.sourceUrls))];
const lesson = {
  slug: "ccna-roadmap-and-lab-method",
  content: { sources: sources.map((url) => ({ url })), lab: { addressing: [{ address: "192.168.10.1/24" }, { address: "192.168.10.2/24" }] } }
};

test("first lesson has three distinct concepts and source-mapped teaching stages", () => {
  assert.ok(ccnaVisualStorySchema.safeParse(firstNetworkVisualStory).success);
  assert.deepEqual(ccnaVisualStoryIssues(firstNetworkVisualStory, sources), []);
  assert.deepEqual(firstNetworkVisualStory.stages.map((stage) => stage.direction), ["none", "forward", "reverse"]);
  assert.match(firstNetworkVisualStory.boundary, /does not prove/);
});

test("new generation requires the visual plan without breaking stored legacy lessons", () => {
  const schema = ccnaOpenAIResponseSchema(sources);
  assert.ok(schema.required.includes("visualStory"));
  assert.deepEqual(schema.properties.visualStory.properties.stages.items.properties.sourceUrls.items.enum, sources);
  assert.equal(schema.properties.visualStory.properties.conceptSelection.properties.candidates.minItems, 3);
  assert.equal(schema.properties.visualStory.properties.nodes.maxItems, 5);
});

test("visual gate rejects repeated concepts, dangling links, and unmapped citations", () => {
  const story = structuredClone(firstNetworkVisualStory);
  story.conceptSelection.candidates[1] = story.conceptSelection.candidates[0];
  story.connections[0].to = "missing-node";
  story.stages[0].activeConnections.push("missing-edge");
  story.stages[1].sourceUrls = ["https://example.com/unverified"];
  const issues = ccnaVisualStoryIssues(story, sources);
  assert.ok(issues.some((issue) => issue.includes("distinct visual concepts")));
  assert.ok(issues.some((issue) => issue.includes("existing nodes")));
  assert.ok(issues.some((issue) => issue.includes("existing nodes and connections")));
  assert.ok(issues.some((issue) => issue.includes("verified lesson bibliography")));
});

test("a first-lesson illustration is never reused for another topic or address plan", () => {
  assert.equal(visualStoryForLesson(lesson), firstNetworkVisualStory);
  assert.ok(firstNetworkArtwork(lesson));
  assert.equal(visualStoryForLesson({ ...lesson, slug: "dns-name-resolution" }), null);
  assert.equal(firstNetworkArtwork({ ...lesson, content: { ...lesson.content, lab: { addressing: [] } } }), null);
  for (const addresses of [["192.168.10.10/24", "192.168.10.20/24"], ["192.168.10.1/25", "192.168.10.2/25"]]) {
    assert.equal(firstNetworkArtwork({ ...lesson, content: { ...lesson.content, lab: { addressing: addresses.map((address) => ({ address })) } } }), null);
  }
});

test("saved lesson-specific plans take precedence over the first-lesson fallback", () => {
  const plan = structuredClone(firstNetworkVisualStory);
  plan.title = "A different reviewed teaching relationship";
  const record = { ...lesson, content: { ...lesson.content, visualStory: plan } };
  assert.equal(visualStoryForLesson(record).title, plan.title);
  assert.equal(firstNetworkArtwork(record), null);
});

test("technical labels stay bounded and essential text meets contrast requirements", () => {
  for (const node of firstNetworkVisualStory.nodes) {
    assert.ok(node.label.length <= 24);
    assert.ok(node.detail.length <= ccnaVisualTextBudgets.nodeDetail);
  }
  assert.ok(firstNetworkVisualStory.altText.length <= ccnaVisualTextBudgets.altText);
  assert.ok(firstNetworkVisualStory.boundary.length <= ccnaVisualTextBudgets.boundary);
  assert.ok(ccnaVisualTextBudgets.altText < ccnaVisualFieldLimits.altText);
  assert.ok(ccnaVisualTextBudgets.boundary < ccnaVisualFieldLimits.boundary);
  assert.ok(ccnaVisualTextBudgets.nodeDetail < ccnaVisualFieldLimits.nodeDetail);
  for (const foreground of ["#182332", "#425564", "#08777b", "#b03363"]) assert.ok(contrastRatio(foreground, "#fafbfc") >= 4.5);
});

test("visual copy gate identifies overlong and unfinished fields precisely", () => {
  const story = structuredClone(firstNetworkVisualStory);
  story.altText = "A packet crosses the complete path from EndpointA through every named forwarding device before reaching EndpointB. The diagram names the source, each transit device, every connection, and the final destination. The complete route remains visible for a beginner reader.";
  story.boundary = "This diagram shows the reproducible wired path but does not represent";
  story.nodes[0].detail = "Forwards toward final endpoint";
  const issues = ccnaVisualStoryIssues(story, sources);
  assert.ok(issues.some((issue) => issue.includes(`alt text`) && issue.includes(`${ccnaVisualTextBudgets.altText} characters`)));
  assert.ok(issues.some((issue) => issue.includes("visual boundary") && issue.includes("without clipping")));
  assert.ok(issues.some((issue) => issue.includes("PC1") && issue.includes(`${ccnaVisualTextBudgets.nodeDetail} characters`)));
});

test("visual completion checks allow natural sentence endings", () => {
  const story = structuredClone(firstNetworkVisualStory);
  story.altText = "The diagram shows the local connection and where the gateway is.";
  assert.deepEqual(ccnaVisualStoryIssues(story, sources), []);
});

test("course artwork provides genuine 2x source pixels at its 800px maximum display width", async () => {
  const image = await sharp("public/brand/ccna/first-network-tabletop-v1.jpg").metadata();
  assert.ok(image.width >= 1600);
  assert.ok(image.height >= 900);
  assert.equal(image.width, firstNetworkArtwork(lesson).width);
});

test("concept comparison catches duplicate scenes despite punctuation changes", () => {
  const selection = structuredClone(firstNetworkVisualStory.conceptSelection);
  selection.candidates[1].scene = selection.candidates[0].scene.toUpperCase();
  assert.equal(visualConceptIssues(selection).length, 1);
});
