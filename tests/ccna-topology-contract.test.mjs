import assert from "node:assert/strict";
import test from "node:test";
import { ccnaTopologyVisual, ccnaTopologyLab, ccnaTopologyPrelude, ccnaTopologySources, ccnaTopologyIssues, ccnaTopologyWritingBoundary, ccnaSpineLeafSection, applyCcnaTopologyContract } from "../src/lib/ccna-topology-contract.ts";
import { ccnaLessonContentSchema, ccnaOpenAIResponseSchema } from "../src/lib/ccna-lesson-schema.ts";
import { ccnaVisualStorySchema, ccnaVisualStoryIssues } from "../src/lib/ccna-visual-story.ts";
import { consolidateCcnaCitations } from "../src/lib/ccna-citations.ts";
import { ccnaReviewedRevisionIssues, ccnaContentDigest } from "../src/lib/ccna-generation-pipeline.ts";
import { ccnaDiagramGeometry } from "../src/components/ccna-visual-diagram.tsx";

const urls = ccnaTopologySources.map((source) => source.url);
function fixture() {
  return applyCcnaTopologyContract({ sources: [], lab: {}, plainAnswer: "Compare all five designs.", sections: [
    { heading: "Campus", explanation: "Real campuses can have redundant switches and paths.", example: "This single-switch lab is deliberately limited.", keyPoints: [], sourceUrls: [urls[3]] },
    { heading: "Cloud", explanation: "The paper exercise does not test provider failover or logical isolation.", example: "The campus cable fault is not a public cloud test.", keyPoints: [], sourceUrls: [urls[5]] },
    { heading: "Spine-leaf", explanation: "Equal-cost multipath is examined as a paper comparison, not simulated.", example: "Trace the alternative path on paper.", keyPoints: [], sourceUrls: [urls[4]] }
  ], realWorldScenario: { walkthrough: [] }, practiceQuestions: [], quiz: [] });
}

test("all five topology diagrams fit their text budgets with complete paths and boundaries", () => {
  const story = ccnaTopologyVisual();
  assert.deepEqual(ccnaVisualStorySchema.safeParse(story).error?.issues || [], []);
  assert.deepEqual(ccnaVisualStoryIssues(story, urls), []);
  const scenes = [story, ...story.comparisons];
  assert.deepEqual(scenes.map((scene) => scene.title), ["Campus access", "WAN between sites", "SOHO gateway", "Cloud service", "Spine-leaf fabric"]);
  for (const scene of scenes) {
    const destination = scene.nodes.at(-1);
    assert.ok(scene.altText.length < 200, `${scene.title}: leave room for complete alt text`);
    assert.match(scene.altText, /[.!?]$/);
    assert.match(scene.boundary, /[.!?]$/);
    for (const node of scene.nodes) assert.ok(scene.altText.includes(node.label), `${scene.title}: alt text must name ${node.label}`);
    assert.ok(scene.altText.includes(destination.label));
    assert.ok(scene.connections.some((edge) => edge.to === destination.id));
    assert.ok(scene.stages.some((step) => step.activeNodes.includes(destination.id)));
    for (const step of scene.stages) {
      assert.ok(step.title.length <= 26, `${scene.title}: ${step.title}`);
      assert.match(step.explanation, /[.!?]$/);
      assert.doesNotMatch(step.title + step.explanation, /\.\.\.|\u2026/);
      for (const id of step.activeConnections) {
        const edge = scene.connections.find((edge) => edge.id === id);
        assert.ok(step.activeNodes.includes(edge.from) && step.activeNodes.includes(edge.to), `${scene.title}: ${id}`);
      }
    }
  }
});

test("six-node fabric shows both complete paths and every leaf-to-spine connection", () => {
  const fabric = ccnaTopologyVisual().comparisons.at(-1);
  assert.equal(fabric.nodes.length, 6);
  for (const path of [["spine-pc", "leaf-1", "spine-1", "leaf-2", "spine-server"], ["spine-pc", "leaf-1", "spine-2", "leaf-2", "spine-server"]]) {
    for (let i = 1; i < path.length; i++) assert.ok(fabric.connections.some((edge) => edge.from === path[i - 1] && edge.to === path[i]));
  }
  assert.match(fabric.stages[2].explanation, /LeafSwitch2.*single-attached server/);
  assert.match(fabric.boundary, /do not demonstrate routed ECMP/);
});

test("GNS3 lab has one address per actual VPCS, isolated faults, console context and licensing", () => {
  const lab = ccnaTopologyLab();
  assert.deepEqual(ccnaLessonContentSchema.shape.lab.safeParse(lab).error?.issues || [], []);
  assert.deepEqual(lab.addressing.map((row) => [row.device, row.interface, row.address]), [["CampusPC1", "Ethernet0", "192.168.1.10/24"], ["CampusPC2", "Ethernet0", "192.168.1.20/24"]]);
  for (const step of lab.steps.filter((step) => step.commands.length)) {
    assert.match(step.instruction, /right-click CampusPC[12] and choose Console before typing/);
    assert.equal(step.commands.length, step.commandExplanations.length);
    assert.ok(!step.commands.some((command) => /show (?:mac|interfaces)|configure terminal|shutdown|enable|172\.16\.0/.test(command)));
  }
  const explanations = lab.steps.flatMap((step) => step.commandExplanations);
  assert.equal(new Set(explanations).size, explanations.length, "Every command explanation has device/test-specific context.");
  const pings = lab.steps.filter((step) => step.commands.includes("ping 192.168.1.20"));
  assert.equal(pings.length, 3);
  assert.match(pings[0].expectedResult, /Replies/);
  assert.match(pings[1].expectedResult, /No echo replies/);
  assert.match(pings[2].expectedResult, /Replies.*resume/);
  assert.match(lab.licensingNote, /GNS3 does not provide Cisco software images/);
  assert.match(lab.licensingNote, /do not share or redistribute Cisco image files/);
  assert.match(lab.licensingNote, /licensed for use within CML/);
  assert.ok(lab.setup.some((line) => /no SOHORouter or CloudDevice template/.test(line)));
  assert.deepEqual(ccnaLessonContentSchema.shape.teachingPrelude.safeParse(ccnaTopologyPrelude).error?.issues || [], []);
});

test("beginner prelude defines campus layers, console access and ping before teaching", () => {
  const terms = new Map(ccnaTopologyPrelude.terms.map((entry) => [entry.term, entry.meaning]));
  assert.match(terms.get("Campus, WAN and SOHO"), /access layer connects user devices; distribution joins access networks; a core joins distribution areas/);
  assert.match(terms.get("Spine and leaf"), /leaf switch connects endpoint devices.*spine switch connects leaves/);
  assert.match(terms.get("Spine and leaf"), /same leaf need not cross a spine/);
  assert.match(terms.get("Interface and console"), /interface is a device's network connection.*console is a text window/);
  assert.match(terms.get("Ping and ICMP"), /echo request.*Internet Control Message Protocol.*echo reply/);
  assert.match(terms.get("Ping and ICMP"), /not that every application works/);
  assert.match(ccnaTopologyPrelude.explanation, /memory aids, not literal network rules/);
  assert.match(ccnaTopologyWritingBoundary, /do not add privileged EXEC/);
  assert.match(ccnaTopologyWritingBoundary, /Distinguish physical links from IP hop counts/);
  assert.match(ccnaTopologyWritingBoundary, /whereItStops/);
});

test("topic gates aggregate missing diagrams, wrong addressing and misleading teaching in one pass", () => {
  const content = fixture();
  assert.deepEqual(ccnaTopologyIssues(content), []);
  content.visualStory.comparisons.pop();
  content.lab.addressing[0].address = "172.16.0.10/24";
  content.teachingPrelude = undefined;
  content.sections = [{ heading: "Network", explanation: "Configure SOHORouter in GNS3. Set PC1 to 172.16.0.10/24.", example: "No complete comparison.", keyPoints: [] }];
  const issues = ccnaTopologyIssues(content);
  assert.equal(issues.length, 8, issues.join("\n"));
});

test("the production ECMP omission is replaced before review without changing other sections", () => {
  const content = fixture();
  const section = content.sections.at(-1);
  section.heading = "Spine-Leaf Topology: Data Center with Equal-Cost Multipath";
  section.explanation = "Leaf switches connect servers. Equal-cost multipath (ECMP) distributes traffic over equal-cost paths for resilience.";
  section.example = "If SpineSwitch1 fails, traffic reroutes via SpineSwitch2 without loss, thanks to ECMP. ECMP ensures fast recovery.";
  section.keyPoints = ["Equal-cost multipath (ECMP) allows traffic load balancing."];
  const before = structuredClone(content);
  assert.deepEqual(ccnaTopologyIssues(content), ["State in the spine-leaf section: This paper comparison does not measure routed ECMP in GNS3; load distribution and routing convergence remain untested."]);
  const repaired = applyCcnaTopologyContract(content);
  assert.deepEqual(content, before, "Composition must not mutate the saved input.");
  assert.deepEqual(repaired.sections.slice(0, -1), before.sections.slice(0, -1));
  assert.deepEqual(repaired.sections.at(-1), ccnaSpineLeafSection());
  assert.deepEqual(ccnaTopologyIssues(repaired), []);
  assert.deepEqual(applyCcnaTopologyContract(repaired), repaired, "Repeated composition must not duplicate prose or sources.");
  assert.equal(ccnaLessonContentSchema.shape.sections.element.safeParse(repaired.sections.at(-1)).success, true);
  assert.match(repaired.sections.at(-1).explanation, /same destination.*same routing cost/);
  assert.match(repaired.sections.at(-1).explanation, /does not measure routed ECMP in GNS3/);
  assert.match(repaired.sections.at(-1).example, /packets may be lost/);
  assert.doesNotMatch(JSON.stringify(repaired.sections.at(-1)), /reroutes.*without loss|ensures fast recovery/);
  const previousApproval = { editorialReview: { passed: true, issues: [] }, reviewedContentDigest: ccnaContentDigest(before) };
  assert.ok(ccnaReviewedRevisionIssues(repaired, previousApproval).length, "Previous approval must not authorize the repaired content.");
});

test("ECMP validation checks visible key points and distinguishes definition from boundary failures", () => {
  const content = fixture();
  const section = content.sections.at(-1);
  section.explanation = "Trace the eligible routes between the leaves.";
  section.example = "Cover a spine on the paper diagram.";
  section.keyPoints = ["Equal\u2011cost multipath (ECMP) uses eligible routes to the same destination with the same routing cost.", "This paper comparison does not measure routed ECMP in GNS3."];
  assert.deepEqual(ccnaTopologyIssues(content), []);
  section.keyPoints.shift();
  assert.ok(ccnaTopologyIssues(content).some((issue) => issue.startsWith("Define equal-cost multipath")));
  section.keyPoints = ["Equal-cost multipath is discussed in this paper exercise.", "We measure routed ECMP in GNS3."];
  assert.ok(ccnaTopologyIssues(content).some((issue) => issue.startsWith("State in the spine-leaf section")));
});

test("missing or duplicate spine-leaf sections are held instead of overwriting unrelated teaching", () => {
  for (const count of [0, 2]) {
    const content = fixture();
    content.sections = [...content.sections.slice(0, -1), ...Array.from({ length: count }, () => ccnaSpineLeafSection())];
    const repaired = applyCcnaTopologyContract(content);
    assert.deepEqual(repaired.sections, content.sections);
    assert.ok(ccnaTopologyIssues(repaired).some((issue) => issue.startsWith("Include one clearly named spine-leaf")));
  }
});

test("comparison citations survive canonicalization and source limits include all five scenes", () => {
  const content = fixture();
  const result = consolidateCcnaCitations(content, urls);
  assert.deepEqual(result.issues, []);
  assert.deepEqual(ccnaTopologyIssues(result.candidate), []);
  const story = result.candidate.visualStory;
  const listed = new Set(result.candidate.sources.map((source) => source.url));
  for (const scene of [story, ...story.comparisons]) for (const step of scene.stages) for (const url of step.sourceUrls) assert.ok(listed.has(url));
  assert.ok(listed.size <= 10);
  const untrusted = fixture();
  untrusted.visualStory.comparisons[0].stages[0].sourceUrls = ["https://example.com/fake"];
  assert.ok(consolidateCcnaCitations(untrusted, urls).issues.some((issue) => /comparisons.*untrusted/.test(issue)));
});

test("composed diagrams remain in saved data but are not an extra paid writing output", () => {
  assert.equal(ccnaOpenAIResponseSchema(urls).properties.visualStory.properties.comparisons, undefined);
  const content = fixture();
  const trace = { editorialReview: { passed: true, issues: [] }, reviewedContentDigest: ccnaContentDigest(content) };
  assert.deepEqual(ccnaReviewedRevisionIssues(content, trace), []);
  content.visualStory.comparisons[3].stages[2].explanation = "A changed explanation requires another exact-revision review.";
  assert.ok(ccnaReviewedRevisionIssues(content, trace).length);
});

test("geometry includes every node and label without clipping on comparison and fabric layouts", () => {
  const story = ccnaTopologyVisual();
  for (const scene of [story, ...story.comparisons]) for (const compact of [false, true]) {
    const geometry = ccnaDiagramGeometry(scene, compact);
    for (const node of geometry.nodes) {
      assert.ok(node.x - 53 >= 0 && node.x + 53 <= geometry.width);
      assert.ok(node.y - 53 >= 0 && node.y + 180 <= geometry.height);
    }
  }
  const comparison = { ...story.comparisons[3], layout: "comparison" };
  assert.ok(ccnaDiagramGeometry(comparison).height > 900, "The third row must not be clipped by a fixed 650px height.");
});
