import assert from "node:assert/strict";
import test from "node:test";
import { ccnaCurriculum, ccnaModules } from "../src/lib/ccna-curriculum.ts";
import { ccnaLessonContentSchema, ccnaOpenAIResponseSchema, evaluateCcnaLessonQuality } from "../src/lib/ccna-lesson-schema.ts";
import { ccnaFoundationQuiz, ccnaFoundationUnits, ccnaFoundationSources } from "../src/lib/ccna-foundations.ts";
import { ccnaBeginnerWritingPolicy, ccnaBeginnerReviewPolicy, ccnaTeachingPolicyVersion } from "../src/lib/ccna-teaching-policy.ts";
import { ccnaVisualStoryIssues, firstNetworkVisualStory } from "../src/lib/ccna-visual-story.ts";

test("OpenAI schema omits unsupported URI format while runtime URL validation stays strict", () => {
  const schema = ccnaOpenAIResponseSchema();
  assert.equal(JSON.stringify(schema).includes('"format":"uri"'), false);
  assert.equal(schema.$schema, undefined);
  const content = lessonContent();
  content.sources[0].url = "not-a-url";
  assert.equal(ccnaLessonContentSchema.safeParse(content).success, false);
});

test("generation citation fields accept only exact verified URLs", () => {
  const urls = ["https://docs.gns3.com/docs/emulators/vpcs"];
  const schema = ccnaOpenAIResponseSchema(urls);
  assert.deepEqual(schema.properties.sources.items.properties.url.enum, urls);
  assert.deepEqual(schema.properties.sections.items.properties.sourceUrls.items.enum, urls);
});

test("generation visual limits match the publishing composition budgets", async () => {
  const { ccnaVisualTextBudgets } = await import("../src/lib/ccna-visual-story.ts");
  const visual = ccnaOpenAIResponseSchema().properties.visualStory.properties;
  assert.equal(visual.altText.maxLength, ccnaVisualTextBudgets.altText);
  assert.equal(visual.boundary.maxLength, ccnaVisualTextBudgets.boundary);
  assert.equal(visual.nodes.items.properties.detail.maxLength, ccnaVisualTextBudgets.nodeDetail);
  assert.equal(visual.stages.items.properties.title.maxLength, ccnaVisualTextBudgets.stageTitle);
  assert.equal(visual.stages.items.properties.explanation.maxLength, ccnaVisualTextBudgets.stageExplanation);
});

function generationFixture() {
  const content = lessonContent();
  content.visualStory = structuredClone(firstNetworkVisualStory);
  for (const url of new Set(content.visualStory.stages.flatMap((stage) => stage.sourceUrls))) {
    if (!content.sources.some((source) => source.url === url)) content.sources.push({ label: "GNS3 primary documentation", url, supports: "Primary documentation for the GNS3 devices and commands in this lesson." });
  }
  return content;
}

test("a full bibliography makes room for cited visual evidence without losing citations", async () => {
  const { consolidateCcnaCitations } = await import("../src/lib/ccna-citations.ts");
  const content = generationFixture();
  const visualUrls = new Set(content.visualStory.stages.flatMap((stage) => stage.sourceUrls));
  content.sources = content.sources.filter((source) => !visualUrls.has(source.url));
  while (content.sources.length < 10) content.sources.push({ label: "Unused research reference", url: `https://www.cisco.com/research-${content.sources.length}`, supports: "Background research not directly cited by the completed lesson sections." });
  const before = structuredClone(content);
  const allowed = [...content.sources.map((source) => source.url), ...visualUrls];
  const result = consolidateCcnaCitations(content, allowed);
  assert.deepEqual(result.issues, []);
  assert.equal(result.candidate.sources.length, 10);
  const bibliography = new Set(result.candidate.sources.map((source) => source.url));
  assert.ok([...visualUrls, ...content.sections.flatMap((section) => section.sourceUrls)].every((url) => bibliography.has(url)));
  assert.deepEqual(content, before);
  assert.deepEqual(consolidateCcnaCitations(result.candidate, allowed), result);
});

test("canonical citation duplicates share one bibliography entry", async () => {
  const { consolidateCcnaCitations } = await import("../src/lib/ccna-citations.ts");
  const content = generationFixture();
  const url = content.sources[0].url;
  content.sources.push({ ...content.sources[0], url: `${url}/?utm_source=feed#overview` });
  content.sections[0].sourceUrls = [url, `${url}#details`];
  const result = consolidateCcnaCitations(content, content.sources.map((source) => source.url));
  assert.deepEqual(result.issues, []);
  assert.equal(result.candidate.sources.length, content.sources.length - 1);
  assert.deepEqual(result.candidate.sections[0].sourceUrls, [url]);
});

test("eleven genuinely cited sources are retained and sent for repair", async () => {
  const { consolidateCcnaCitations } = await import("../src/lib/ccna-citations.ts");
  const content = generationFixture();
  const urls = Array.from({ length: 11 }, (_, index) => `https://www.cisco.com/verified-${index}`);
  content.sources = urls.slice(0, 10).map((url) => ({ ...content.sources[0], url }));
  content.sections.forEach((section, index) => { section.sourceUrls = urls.slice(index * 3, index * 3 + 3); });
  content.sections[4].sourceUrls = [urls[0]];
  content.visualStory.stages.forEach((stage) => { stage.sourceUrls = [urls[10]]; });
  const result = consolidateCcnaCitations(content, urls);
  assert.equal(result.candidate.sources.length, 11);
  assert.match(result.issues.join(" "), /11 distinct sources/);
  assert.ok(urls.every((url) => result.candidate.sources.some((source) => source.url === url)));
});

test("untrusted and unverified citations are reported together, not substituted", async () => {
  const { consolidateCcnaCitations } = await import("../src/lib/ccna-citations.ts");
  const content = generationFixture();
  content.sections[0].sourceUrls = ["https://cisco.com.example.org/fake", "https://www.cisco.com/unseen", "http://www.cisco.com/insecure", "https://user:pass@www.cisco.com/secret"];
  const result = consolidateCcnaCitations(content, content.sources.map((source) => source.url));
  assert.equal(result.issues.length, 4);
  assert.deepEqual(result.candidate.sections[0].sourceUrls, content.sections[0].sourceUrls);
});

async function pipelineOptions(content) {
  const { inspectCcnaLessonCandidate } = await import("../src/lib/ccna-generation-pipeline.ts");
  return {
    inspect: (text) => inspectCcnaLessonCandidate(text, { allowedSources: content.sources.map((source) => source.url), prepare: (draft) => draft, evaluate: evaluateCcnaLessonQuality }),
    review: async () => ({ passed: true, issues: [] })
  };
}

test("one repair receives all schema, citation and technical findings plus the actual draft", async () => {
  const { runCcnaGenerationPipeline, ccnaContentDigest } = await import("../src/lib/ccna-generation-pipeline.ts");
  const valid = generationFixture();
  const broken = structuredClone(valid);
  broken.metaTitle = "Short";
  broken.visualStory.nodes[0].detail = "A node detail that exceeds its composition limit";
  broken.sections[0].sourceUrls.push("https://www.cisco.com/unverified");
  let writes = 0;
  let reviews = 0;
  const result = await runCcnaGenerationPipeline({
    ...await pipelineOptions(valid),
    write: async (repair) => {
      writes += 1;
      if (writes === 1) return JSON.stringify(broken);
      assert.equal(repair.candidate.metaTitle, "Short");
      assert.ok(repair.issues.some((issue) => issue.includes("metaTitle")));
      assert.ok(repair.issues.some((issue) => issue.includes("nodes.0.detail")));
      assert.ok(repair.issues.some((issue) => issue.includes("unverified source")));
      assert.ok(repair.issues.some((issue) => issue.includes("return path")));
      return JSON.stringify(valid);
    },
    review: async (draft) => {
      reviews += 1;
      if (reviews === 1) {
        assert.equal(draft.metaTitle, "Short");
        return { passed: false, issues: ["Explain the return path before testing cross-subnet connectivity."] };
      }
      assert.equal(draft.metaTitle, valid.metaTitle);
      return { passed: true, issues: [] };
    }
  });
  assert.equal(result.quality.ready, true, result.quality.issues.join(" "));
  assert.equal(writes, 2);
  assert.equal(reviews, 2);
  assert.equal(result.repairPasses, 1);
  assert.equal(result.reviewedContentDigest, ccnaContentDigest(result.content));
});

test("invalid JSON is repaired within the same bounded generation job", async () => {
  const { runCcnaGenerationPipeline } = await import("../src/lib/ccna-generation-pipeline.ts");
  const valid = generationFixture();
  let calls = 0;
  const result = await runCcnaGenerationPipeline({ ...await pipelineOptions(valid), write: async (repair) => {
    calls += 1;
    if (calls === 1) return '{"metaTitle":';
    assert.equal(repair.candidate, '{"metaTitle":');
    assert.match(repair.issues.join(" "), /valid lesson JSON/);
    return JSON.stringify(valid);
  } });
  assert.equal(result.quality.ready, true);
  assert.equal(calls, 2);
});

test("a reviewable visual length error does not hide command or teaching failures", async () => {
  const content = generationFixture();
  content.visualStory.altText = "This sentence describes the complete visible packet path for a beginning learner. ".repeat(3).trim();
  content.lab.steps[0].commandExplanations = [];
  const options = await pipelineOptions(content);
  const result = options.inspect(JSON.stringify(content));
  assert.equal(result.content, null);
  assert.ok(result.quality.usefulWords > 1500);
  assert.ok(result.quality.issues.some((issue) => issue.includes("visualStory.altText")));
  assert.ok(result.quality.issues.some((issue) => issue.includes("Explain every command line")));
});

test("invalid or contradictory review cannot approve a lesson or retry without a limit", async () => {
  const { runCcnaGenerationPipeline, ccnaReviewedRevisionIssues } = await import("../src/lib/ccna-generation-pipeline.ts");
  const valid = generationFixture();
  let writes = 0;
  const result = await runCcnaGenerationPipeline({ ...await pipelineOptions(valid), write: async () => { writes += 1; return JSON.stringify(valid); }, review: async () => ({ passed: true, issues: ["The final destination is missing from this network diagram."] }) });
  assert.equal(writes, 3);
  assert.equal(result.quality.ready, false);
  assert.equal(result.passes.length, 3);
  assert.ok(ccnaReviewedRevisionIssues(result.content, { editorialReview: result.review, reviewedContentDigest: result.reviewedContentDigest }).length > 0);
});

test("unrepairable schema errors preserve all diagnostics after exactly two repairs", async () => {
  const { runCcnaGenerationPipeline, CcnaGenerationValidationError } = await import("../src/lib/ccna-generation-pipeline.ts");
  const valid = generationFixture();
  const broken = { ...valid, metaTitle: "bad", metaDescription: "bad" };
  const options = await pipelineOptions(valid);
  let writes = 0;
  await assert.rejects(() => runCcnaGenerationPipeline({ ...options, write: async () => { writes += 1; return JSON.stringify(broken); } }), (error) => {
    assert.ok(error instanceof CcnaGenerationValidationError);
    assert.equal(error.passes.length, 3);
    assert.match(error.message, /metaTitle/);
    assert.match(error.message, /metaDescription/);
    return true;
  });
  assert.equal(writes, 3);
});

test("a passing review is valid only for the exact saved lesson revision", async () => {
  const { runCcnaGenerationPipeline, ccnaReviewedRevisionIssues } = await import("../src/lib/ccna-generation-pipeline.ts");
  const valid = generationFixture();
  let writes = 0;
  const result = await runCcnaGenerationPipeline({ ...await pipelineOptions(valid), write: async () => { writes += 1; return JSON.stringify(valid); } });
  assert.equal(writes, 1);
  const trace = { editorialReview: result.review, reviewedContentDigest: result.reviewedContentDigest };
  assert.deepEqual(ccnaReviewedRevisionIssues(result.content, trace), []);
  result.content.sections[0].explanation += " The content changed after technical review.";
  assert.match(ccnaReviewedRevisionIssues(result.content, trace).join(" "), /exact saved content/);
});

test("verified section citations are reconciled into the lesson bibliography", async () => {
  const { reconcileCcnaLessonSources } = await import("../src/lib/ccna-content-agent.ts");
  const content = lessonContent();
  const verified = "https://www.rfc-editor.org/rfc/rfc8200.html";
  const discovered = [...content.sources.map((source) => source.url), verified];
  content.sections[0].sourceUrls = [`${verified}#section-3`];
  const reconciled = reconcileCcnaLessonSources(content, discovered);
  const added = reconciled.sources.find((source) => source.url === verified);
  assert.ok(added);
  assert.deepEqual(reconciled.sections[0].sourceUrls, [verified]);

  content.sections[0].sourceUrls = ["https://example.com/unverified"];
  assert.throws(() => reconcileCcnaLessonSources(content, discovered), /untrusted source URL/);
  content.sections[0].sourceUrls = ["https://www.cisco.com/unverified-reference"];
  assert.throws(() => reconcileCcnaLessonSources(content, discovered), /unverified source URL/);
});

test("verified visual citations are reconciled without accepting invented URLs", async () => {
  const { reconcileCcnaLessonSources } = await import("../src/lib/ccna-content-agent.ts");
  const content = lessonContent();
  const verified = "https://www.rfc-editor.org/rfc/rfc8200.html";
  const discovered = [...content.sources.map((source) => source.url), verified];
  content.visualStory = {
    conceptSelection: {
      candidates: [
        { name: "Packet path", scene: "A packet moves from one endpoint through a router to another endpoint.", teachingValue: "Shows where the router changes the forwarding decision.", limitation: "Does not show every Ethernet operation." },
        { name: "Address layers", scene: "Two address labels sit above a small routed path.", teachingValue: "Separates local and routed address decisions.", limitation: "Does not model physical cabling." },
        { name: "Device roles", scene: "Three device roles appear beside one traffic path.", teachingValue: "Connects each device to one forwarding responsibility.", limitation: "Does not represent vendor implementation details." }
      ],
      selectedIndex: 0,
      selectionReason: "The packet path most directly supports the lesson's forwarding explanation."
    },
    title: "A packet crosses one router",
    takeaway: "The endpoint sends the packet to a router when the destination is on another network.",
    altText: "A source endpoint connects to a router, which forwards a packet toward a destination endpoint on another network.",
    boundary: "This conceptual path omits Ethernet address discovery, queueing, and the detailed forwarding-table lookup.",
    layout: "sequence",
    nodes: [
      { id: "source", kind: "computer", label: "Source", detail: "Sends the packet" },
      { id: "router", kind: "router", label: "Router", detail: "Chooses the next network" },
      { id: "target", kind: "server", label: "Destination", detail: "Receives the packet" }
    ],
    connections: [
      { id: "to-router", from: "source", to: "router" },
      { id: "to-target", from: "router", to: "target" }
    ],
    stages: [
      { title: "Send locally", explanation: "The source prepares the packet for a destination outside its local network and sends it toward the router.", activeNodes: ["source", "router"], activeConnections: ["to-router"], direction: "forward", sourceUrls: [`${verified}#section-3`] },
      { title: "Choose the route", explanation: "The router reads the destination network and selects the appropriate next forwarding action.", activeNodes: ["router"], activeConnections: [], direction: "none", sourceUrls: [verified] },
      { title: "Reach the target", explanation: "The router forwards the packet toward the destination network, where the target can receive it.", activeNodes: ["router", "target"], activeConnections: ["to-target"], direction: "forward", sourceUrls: [verified] }
    ]
  };

  const reconciled = reconcileCcnaLessonSources(content, discovered);
  assert.ok(reconciled.sources.some((source) => source.url === verified));
  assert.ok(reconciled.visualStory.stages.every((stage) => stage.sourceUrls[0] === verified));

  content.visualStory.stages[0].sourceUrls = ["https://www.cisco.com/invented-visual-source"];
  assert.throws(() => reconcileCcnaLessonSources(content, discovered), /unverified source URL/);
});

test("Day 2 generation gate requires a complete five-device path and beginner definitions", async () => {
  const { ccnaTopicSpecificIssues } = await import("../src/lib/ccna-content-agent.ts");
  const content = lessonContent();
  const issues = ccnaTopicSpecificIssues(ccnaCurriculum[1], content);
  assert.ok(issues.some((issue) => issue.includes("exactly EndpointA")));
  assert.ok(issues.some((issue) => issue.includes("Define frame")));
  assert.ok(issues.some((issue) => issue.includes("Define segment")));
  assert.ok(issues.some((issue) => issue.includes("Define default gateway")));
  assert.ok(issues.some((issue) => issue.includes("Define VPCS")));
});

test("Day 2 contract supplies the complete reviewed visual without clipping", async () => {
  const { applyCcnaTopicContract, ccnaTopicSpecificIssues } = await import("../src/lib/ccna-content-agent.ts");
  const content = lessonContent();
  content.sections[1].heading = "Access points and firewalls";
  content.sections[1].example = `${content.sections[1].example} An access point and firewall are compared here as separate network roles.`;
  content.visualStory = structuredClone(firstNetworkVisualStory);
  for (const url of new Set(firstNetworkVisualStory.stages.flatMap((stage) => stage.sourceUrls))) {
    if (!content.sources.some((source) => source.url === url)) {
      content.sources.push({ label: `Verified GNS3 source ${content.sources.length + 1}`, url, supports: "The documented GNS3 device and topology behavior used by the lesson visual." });
    }
  }
  const repaired = applyCcnaTopicContract(ccnaCurriculum[1], content);
  assert.deepEqual(repaired.visualStory.nodes.map((node) => [node.label, node.detail]), [
    ["EndpointA", "Sends the packet"],
    ["Switch1", "Forwards local frames"],
    ["Router1", "Routes between networks"],
    ["Switch2", "Forwards final frames"],
    ["EndpointB", "Receives the packet"]
  ]);
  assert.deepEqual(repaired.visualStory.stages.map((stage) => stage.title), ["EndpointA to Switch1", "Switch1 to Router1", "Router1 to EndpointB"]);
  assert.deepEqual(repaired.visualStory.stages.at(-1).activeNodes, ["router-1", "switch-2", "endpoint-b"]);
  assert.deepEqual(ccnaVisualStoryIssues(repaired.visualStory, repaired.sources.map((source) => source.url)), []);
  assert.match(repaired.sections[0].explanation, /^A network segment is/);
  assert.ok(repaired.sections.some((section) => section.keyPoints.some((point) => point.startsWith("Lab boundary:"))));
  assert.ok(repaired.lab.steps.every((step) => !step.commands.length || /right-click Router1 and choose Console before typing/i.test(step.instruction)));
  assert.match(repaired.lab.licensingNote, /do not share or redistribute Cisco image files/i);

  repaired.visualStory.stages[2].title = "Router1 to Switch2 and 2";
  assert.ok(ccnaTopicSpecificIssues(ccnaCurriculum[1], repaired).some((issue) => issue.includes("reviewed Day 2 stage titles")));
});

test("Day 2 gates accept separate console actions for the fault, failed test, repair and retest", async () => {
  const { applyCcnaTopicContract, ccnaTopicSpecificIssues, evaluateCcnaLessonForTopic } = await import("../src/lib/ccna-content-agent.ts");
  const { inspectCcnaLessonCandidate, runCcnaGenerationPipeline } = await import("../src/lib/ccna-generation-pipeline.ts");
  const { ccnaOfficialSources } = await import("../src/lib/ccna-curriculum.ts");
  const content = generationFixture();
  content.sections[1].heading = "Access points and firewalls";
  content.sections[1].example += " An access point and firewall are separate roles, compared here without claiming this lab simulates either one.";
  for (const term of ["Frame", "Segment", "Default gateway", "VPCS"]) content.glossary.push({ term, meaning: `The ${term} concept is introduced in the first section before the learner uses it to explain a device action.` });
  const makeStep = (node, title, commands, expectedResult) => ({ ...content.lab.steps[0], title, commands, commandExplanations: commands.map((command) => `In the ${node} console, enter ${command} and press Enter to perform this isolated lab action.`), instruction: `In GNS3, right-click ${node} and choose Console before typing. Enter each command on its own line and press Enter, then compare the displayed result.`, expectedResult });
  content.lab.steps = [
    makeStep("Router1", "Read the actual interface names", ["show ip interface brief"], "Both cabled interfaces appear in the router's short interface summary."),
    makeStep("Router1", "Configure the first local interface", ["enable", "configure terminal", "interface GigabitEthernet0/0", "ip address 10.1.1.1 255.255.255.0", "no shutdown", "end"], "The first local interface has the planned 10.1.1.1 address and is enabled."),
    makeStep("Router1", "Configure the second local interface", ["configure terminal", "interface GigabitEthernet0/1", "ip address 10.1.2.1 255.255.255.0", "no shutdown", "end"], "The second local interface has the planned 10.1.2.1 address and is enabled."),
    makeStep("EndpointA", "Address EndpointA", ["ip 10.1.1.10/24 10.1.1.1", "show ip"], "EndpointA shows its planned address, prefix length and local gateway."),
    makeStep("EndpointB", "Address EndpointB", ["ip 10.1.2.10/24 10.1.2.1", "show ip"], "EndpointB shows its planned address, prefix length and local gateway."),
    makeStep("EndpointA", "Test the working packet path", ["ping 10.1.2.10"], "Replies from EndpointB confirm this request-and-reply path works."),
    makeStep("EndpointB", "Introduce the wrong gateway", ["ip 10.1.2.10/24 10.1.2.254", "show ip"], "EndpointB shows the deliberately incorrect gateway address in this isolated lab."),
    makeStep("EndpointA", "Observe the failed return path", ["ping 10.1.2.10"], "The test fails with no replies because EndpointB has no valid return path to the source network."),
    makeStep("EndpointB", "Restore the original gateway", ["ip 10.1.2.10/24 10.1.2.1", "save"], "EndpointB uses the real router interface as its gateway again."),
    makeStep("EndpointA", "Repeat the same peer test", ["ping 10.1.2.10"], "Replies from EndpointB confirm recovery of the tested return path.")
  ];
  const normalized = applyCcnaTopicContract(ccnaCurriculum[1], content);
  assert.deepEqual(ccnaTopicSpecificIssues(ccnaCurriculum[1], normalized), []);
  const options = { allowedSources: [...content.sources.map((source) => source.url), ...ccnaOfficialSources.map((source) => source.url)], prepare: (draft) => applyCcnaTopicContract(ccnaCurriculum[1], draft), evaluate: (draft) => evaluateCcnaLessonForTopic(ccnaCurriculum[1], draft) };
  const result = await runCcnaGenerationPipeline({ write: async () => JSON.stringify(normalized), inspect: (text) => inspectCcnaLessonCandidate(text, options), review: async () => ({ passed: true, issues: [] }) });
  assert.equal(result.quality.ready, true, result.quality.issues.join(" "));
  assert.equal(result.repairPasses, 0);

  normalized.lab.steps[7].commands = ["ping 10.1.1.10"];
  assert.ok(ccnaTopicSpecificIssues(ccnaCurriculum[1], normalized).some((issue) => issue.includes("wrong-gateway verification")), "A self-ping must not satisfy the cross-subnet failure check.");
});

test("Day 2 normalization does not discard existing setup or teaching points to fit limits", async () => {
  const { applyCcnaTopicContract } = await import("../src/lib/ccna-content-agent.ts");
  const content = generationFixture();
  content.sections[1].example += " An access point and firewall are separate roles for this comparison.";
  content.sections[1].keyPoints = Array.from({ length: 6 }, (_, index) => `Retain necessary technical explanation number ${index + 1} for the learner.`);
  content.lab.setup = Array.from({ length: 8 }, (_, index) => `Retain necessary setup instruction number ${index + 1} for this isolated lab.`);
  const result = applyCcnaTopicContract(ccnaCurriculum[1], content);
  assert.deepEqual(result.sections[1].keyPoints, content.sections[1].keyPoints);
  assert.deepEqual(result.lab.setup, content.lab.setup);
});

test("presentation ellipses are normalized before the lesson quality gate", async () => {
  const { normalizeCcnaPresentationEllipses } = await import("../src/lib/ccna-content-agent.ts");
  const content = lessonContent();
  content.lab.steps[0].expectedResult = "The console shows '64 bytes from...' replies before the learner records the result.";
  content.sections[0].example = `${content.sections[0].example} The learner's task is simple: first observe… then explain the evidence.`;
  const normalized = normalizeCcnaPresentationEllipses(content);
  assert.doesNotMatch(normalized.lab.steps[0].expectedResult, /\.{3}|…/);
  assert.match(normalized.lab.steps[0].expectedResult, /64 bytes from \[variable value\]/);
  assert.match(normalized.sections[0].example, /first observe… then explain/i);
  assert.ok(evaluateCcnaLessonQuality(normalized).issues.includes("Remove clipped sentences and ellipses."));
});

test("incomplete executable commands remain visible to the quality gate", async () => {
  const { normalizeCcnaPresentationEllipses } = await import("../src/lib/ccna-content-agent.ts");
  const content = lessonContent();
  content.lab.steps[0].commands[0] = "ping ...";
  const normalized = normalizeCcnaPresentationEllipses(content);
  assert.equal(normalized.lab.steps[0].commands[0], "ping ...");
  assert.ok(evaluateCcnaLessonQuality(normalized).issues.includes("Remove clipped sentences and ellipses."));
});

const sources = [
  { label: "Cisco CCNA exam", url: "https://www.cisco.com/site/us/en/learn/training-certifications/exams/ccna.html", supports: "The current CCNA exam version, duration, and official learning scope." },
  { label: "Cisco learning content", url: "https://learningcontent.cisco.com/documents/marketing/exam-topics/200-301-CCNA-v1.1.pdf", supports: "The current exam blueprint mapping used by this lesson." },
  { label: "GNS3 documentation", url: "https://docs.gns3.com/docs/getting-started/your-first-cisco-topology", supports: "The supported topology workflow and image licensing boundary for GNS3." }
];

const teaching = "A learner follows the packet from the source interface through each forwarding decision, records the observed state, compares that evidence with the intended design, and explains why the result proves or disproves the original hypothesis. ";
const explanation = teaching.repeat(7).trim();
const example = "A small office user can reach the local gateway but not a remote server. The engineer compares interface state, addressing, route selection, and return-path evidence before changing configuration.";

function lessonContent() {
  return ccnaLessonContentSchema.parse({
    metaTitle: "CCNA Packet Path Lab and Verification Guide",
    metaDescription: "Learn the CCNA packet path in plain English, build a safe GNS3 lab, verify the result with commands, and test your understanding with original questions.",
    plainAnswer: "A network forwards traffic through a sequence of physical, data-link, and routing decisions. A useful CCNA method predicts each decision first, then compares that prediction with interface, table, and packet evidence.",
    learnerOutcome: "By the end of this lesson, the learner can describe a packet path, build the topology, collect relevant evidence, and explain whether the observed forwarding result is correct.",
    beginnerGuide: {
      startingPoint: "Begin with two practice computers. You do not need to know their commands yet; we explain the address, console and each action before using them.",
      whyItMatters: "Reading an address and checking one small result helps you find a wrong setting before replacing devices or changing unrelated settings.",
      everydayComparison: {
        familiarSituation: "Imagine sending a note to another desk in the same room. Check the desk label first, deliver the note and look for a reply from the intended person.",
        networkMeaning: "Each practice computer has an IP address. The switch connects the local links. A ping asks the other computer for a small test reply.",
        whereItStops: "A switch is not a person reading a desk label. It forwards frames using networking rules, which later lessons explain."
      },
      walkthrough: Array.from({ length: 3 }, (_, index) => ({ action: `Read the planned address for practice step ${index + 1}.`, whatHappens: "Compare the numbers on the page with the address shown in the named device's console.", why: "Reading the values first catches a mistake before you use those settings in another task." })),
      firstPractice: { task: "Draw two boxes on paper and label them PC1 and PC2. Write their planned addresses beside them and compare the four numbers.", expected: "The first three numbers match with this mask, but the last numbers are different.", hint: "Read each address as four whole numbers separated by dots, then compare left to right." },
      checkUnderstanding: { question: "Why should the two practice computers have different addresses?", hint: "Think about how to choose the correct desk when two labels are identical.", answer: "Each connection needs a distinct address within this group so the communication identifies the intended destination without an address conflict." }
    },
    prerequisites: ["Basic familiarity with IPv4 addresses", "A computer able to run GNS3 or Cisco Modeling Labs"],
    objectives: ["Explain the forwarding decision at every network hop", "Build a small reproducible topology without hidden dependencies", "Verify the intended state with commands and retained evidence"],
    sections: Array.from({ length: 5 }, (_, index) => ({
      heading: `Teaching stage ${index + 1}`,
      explanation,
      example,
      keyPoints: ["Predict the expected device decision before running a command.", "Treat command output as evidence that must be interpreted in context."],
      sourceUrls: [sources[index % sources.length].url]
    })),
    realWorldScenario: {
      title: "A branch user cannot reach the application",
      situation: "A branch employee reports that a business application stopped responding after a planned network change. Other local services still work, so the operator needs to identify the first failed decision without making unrelated changes.",
      walkthrough: Array.from({ length: 4 }, (_, index) => `Step ${index + 1} compares the expected packet path with observed interface, address, forwarding-table, and return-path evidence so the learner can isolate the first difference safely.`),
      takeaway: "Troubleshooting becomes repeatable when every command answers a stated question and the operator stops changing configuration once the first failed dependency is identified."
    },
    lab: {
      title: "Build and verify a three-device packet path",
      goal: "Create a small routed path, predict how traffic should move, and retain enough command evidence to explain both a successful test and a deliberately introduced failure.",
      topology: "PC-1 connects to SW-1, which connects to R-1 and a remote test subnet.",
      devices: ["One router", "One Ethernet switch", "One test client"],
      addressing: [{ device: "R-1", interface: "GigabitEthernet0/0", address: "192.0.2.1/24", purpose: "Default gateway for the test client" }],
      setup: ["Create a new isolated GNS3 project for the lesson.", "Add only images and appliances that you are licensed to use.", "Connect the interfaces exactly as shown in the topology description."],
      steps: Array.from({ length: 7 }, (_, index) => ({
        title: `Lab step ${index + 1}`,
        instruction: `Perform controlled lab action ${index + 1}, record the intended state before the change, and save the resulting evidence so another learner can reproduce the observation accurately.`,
        commands: ["show ip interface brief"],
        commandExplanations: ["show displays information without changing it. ip interface brief asks for a short interface and IPv4 summary. Enter it in the named Cisco router console and press Enter."],
        expectedResult: "The relevant interface and protocol state agree with the documented topology and address plan.",
        why: "This action tests one dependency and prevents an unrelated configuration change from hiding the original fault."
      })),
      verification: Array.from({ length: 4 }, (_, index) => `Verification ${index + 1} confirms the running interface, address, forwarding, or reachability state and records the evidence used to reach the conclusion.`),
      troubleshooting: Array.from({ length: 3 }, (_, index) => `Troubleshooting check ${index + 1} compares intended and observed state, changes only the failed dependency, and repeats the same verification command afterward.`),
      cleanup: ["Save the final command evidence outside the lab project.", "Stop all nodes and remove temporary failure conditions."],
      licensingNote: "GNS3 does not provide Cisco software images. Use Cisco image files only when the applicable license permits it, and do not share or redistribute those files. Use Cisco Modeling Labs as the official Cisco alternative."
    },
    practiceQuestions: Array.from({ length: 6 }, (_, index) => ({
      question: `Which evidence should a learner collect for practice situation ${index + 1}?`,
      answer: "Collect the command output that directly proves the state of the dependency under test.",
      explanation: "The strongest answer names the hypothesis, chooses evidence tied to that hypothesis, and avoids changing several unrelated variables at the same time."
    })),
    quiz: Array.from({ length: 5 }, (_, index) => ({
      question: `What is the safest next action in quiz situation ${index + 1}?`,
      options: ["Verify one dependency", "Replace every cable", "Reload every device", "Ignore the evidence"],
      correctIndex: 0,
      explanation: "Verifying one dependency preserves the original evidence and isolates the first point where observed behavior differs from the intended packet path."
    })),
    glossary: Array.from({ length: 5 }, (_, index) => ({ term: `Term ${index + 1}`, meaning: "A defined networking concept that the learner connects to observable device or packet behavior." })),
    takeaways: Array.from({ length: 5 }, (_, index) => `Takeaway ${index + 1}: predict the state, gather focused evidence, and explain the result before making a configuration change.`),
    sources
  });
}

test("the CCNA curriculum is a unique 60-weekday sequence", () => {
  assert.equal(ccnaCurriculum.length, 60);
  assert.equal(ccnaModules.length, 8);
  assert.deepEqual(ccnaCurriculum.map((topic) => topic.sequence), Array.from({ length: 60 }, (_, index) => index + 1));
  assert.equal(new Set(ccnaCurriculum.map((topic) => topic.slug)).size, 60);
  assert.ok(ccnaCurriculum.every((topic) => topic.week >= 1 && topic.week <= 12 && topic.day >= 1 && topic.day <= 5));
});

test("a complete researched lesson clears the publishing gate", () => {
  const quality = evaluateCcnaLessonQuality(lessonContent());
  assert.equal(quality.ready, true, quality.issues.join(" "));
  assert.equal(quality.score, 100);
  assert.ok(quality.usefulWords >= 1_500);
});

test("the CCNA gate rejects serialized prose and duplicated filler lab steps", () => {
  const content = lessonContent();
  content.takeaways[0] = "sources':[{'url':'https://www.cisco.com','supports':'internal generation artifact'}]";
  content.lab.steps[1].title = content.lab.steps[0].title;
  content.lab.steps[2].title = "Glossary";
  const quality = evaluateCcnaLessonQuality(content);
  assert.equal(quality.ready, false);
  assert.ok(quality.issues.some((issue) => issue.includes("serialized data")));
  assert.ok(quality.issues.some((issue) => issue.includes("duplicated steps")));
  assert.ok(quality.issues.some((issue) => issue.includes("repeat article sections")));
});

test("the CCNA gate distinguishes unused VLAN settings from unsupported switching features", () => {
  const content = lessonContent();
  content.quiz[0].explanation = "The built-in Ethernet switch forwards frames without VLAN capabilities.";
  assert.ok(evaluateCcnaLessonQuality(content).issues.some((issue) => issue.includes("VLAN port modes")));
  content.quiz[0].explanation = "The built-in Ethernet switch supports VLAN port modes, but this lab uses one shared access segment.";
  assert.equal(evaluateCcnaLessonQuality(content).ready, true);
});

test("CCNA LinkedIn commentary preserves structure, link, and five hashtags", async () => {
  process.env.NEXT_PUBLIC_SITE_URL = "https://www.qcsstudio.com";
  const { buildCcnaLinkedInCommentary } = await import("../src/lib/social-publications.ts");
  const content = lessonContent();
  const commentary = buildCcnaLinkedInCommentary({
    id: "lesson-1",
    sequence: 1,
    week: 1,
    day: 1,
    slug: "ccna-roadmap-and-lab-method",
    title: "Your CCNA roadmap and evidence-led lab method",
    moduleId: "foundations",
    moduleTitle: "Network Foundations and the Packet Journey",
    examDomain: "Network fundamentals",
    v11Blueprint: "Exam orientation",
    v20Blueprint: "Practical skills orientation",
    status: "published",
    scheduledFor: "2026-09-02T00:00:00.000Z",
    publishedAt: "2026-09-02T00:00:00.000Z",
    content,
    qualityScore: 100,
    attempts: 1,
    lastError: "",
    updatedAt: "2026-09-02T00:00:00.000Z"
  });
  assert.match(commentary, /What Changed\n/);
  assert.match(commentary, /Why It Matters\n/);
  assert.match(commentary, /Action And Verification\n/);
  assert.match(commentary, /Original QCS analysis: https:\/\/www\.qcsstudio\.com\/courses\/ccna\/lessons\/ccna-roadmap-and-lab-method/);
  const tags = commentary.match(/#[A-Za-z0-9]+/g) || [];
  assert.equal(tags.length, 5);
  assert.equal(commentary.split("\n").at(-1), "#CCNA #CiscoNetworking #NetworkEngineering #GNS3 #NetworkingStudents");
  assert.ok(commentary.length <= 2_700);
  assert.doesNotMatch(commentary, /\.{3}|…/);
  assert.doesNotMatch(commentary, /your your|with properly licensed images or use Cisco Modeling Labs/);
  assert.match(commentary, /Which command output would you keep/);
});

test("native CCNA edition includes complete lab commands, assessments and citations", async () => {
  const { buildCcnaNewsletterEdition } = await import("../src/lib/ccna-newsletter.ts");
  const content = lessonContent();
  const edition = buildCcnaNewsletterEdition({ title: "CCNA lab", slug: "ccna-lab", content });
  assert.match(edition, /show ip interface brief/);
  assert.match(edition, /What you should see:/);
  assert.match(edition, /START WITH SOMETHING FAMILIAR/);
  assert.ok(edition.includes(content.beginnerGuide.everydayComparison.whereItStops));
  assert.ok(edition.includes(content.lab.steps[0].commandExplanations[0]));
  assert.match(edition, /courses\/ccna\/start-here/);
  assert.match(edition, /PRACTICE QUESTIONS/);
  assert.match(edition, /QUIZ ANSWER KEY/);
  assert.ok(edition.indexOf("QUIZ ANSWER KEY") > edition.indexOf(content.quiz.at(-1).question));
  assert.ok(content.sources.every((source) => edition.includes(source.url)));
  assert.match(edition, /Original QCS lesson and interactive quiz: https:\/\/www\.qcsstudio\.com\/courses\/ccna\/lessons\/ccna-lab/);
});

test("new generations require beginner support while legacy lessons remain readable", () => {
  const schema = ccnaOpenAIResponseSchema();
  assert.ok(schema.required.includes("beginnerGuide"));
  assert.ok(schema.properties.lab.properties.steps.items.required.includes("commandExplanations"));
  const legacy = lessonContent();
  delete legacy.beginnerGuide;
  for (const step of legacy.lab.steps) delete step.commandExplanations;
  assert.equal(ccnaLessonContentSchema.safeParse(legacy).success, true);
  const quality = evaluateCcnaLessonQuality(legacy);
  assert.equal(quality.ready, false);
  assert.ok(quality.issues.some((issue) => issue.includes("zero-background")));
  assert.ok(quality.issues.some((issue) => issue.includes("every command line")));
});

test("a missing command explanation holds the lesson instead of silently publishing", () => {
  const content = lessonContent();
  content.lab.steps[0].commands.push("show version");
  assert.equal(evaluateCcnaLessonQuality(content).ready, false);
  content.lab.steps[0].commandExplanations.push("show version displays the router software version and platform details without changing its settings. Press Enter after typing it in the router console.");
  assert.equal(evaluateCcnaLessonQuality(content).ready, true);
});

test("the licensing gate rejects vague Cisco image guidance", () => {
  const content = lessonContent();
  content.lab.licensingNote = "Use properly licensed Cisco images in GNS3, or use Cisco Modeling Labs when you need an official Cisco lab environment for this exercise.";
  const quality = evaluateCcnaLessonQuality(content);
  assert.equal(quality.ready, false);
  assert.ok(quality.issues.some((issue) => issue.includes("never share or redistribute")));
});

test("computer basics form an unnumbered prerequisite path without changing the 60 topics", () => {
  assert.equal(ccnaFoundationUnits.length, 6);
  assert.equal(new Set(ccnaFoundationUnits.map((unit) => unit.id)).size, 6);
  assert.ok(ccnaFoundationUnits.every((unit) => unit.paragraphs.length >= 4 && unit.steps.length >= 3 && unit.answer.length >= 60));
  assert.equal(ccnaFoundationQuiz.length, 5);
  assert.ok(ccnaFoundationQuiz.every((item) => item.options.length === 4 && new Set(item.options).size === 4 && item.correctIndex >= 0 && item.correctIndex < 4 && item.explanation.length >= 60));
  assert.equal(ccnaCurriculum[0].slug, "ccna-roadmap-and-lab-method");
  assert.equal(ccnaCurriculum.length, 60);
  assert.ok(ccnaFoundationSources.every((source) => new URL(source.url).protocol === "https:"));
});

test("writing and independent review both enforce the beginner teaching policy", () => {
  assert.equal(ccnaTeachingPolicyVersion, 3);
  assert.match(ccnaBeginnerWritingPolicy, /no prior computer or networking knowledge/);
  assert.match(ccnaBeginnerWritingPolicy, /commandExplanations/);
  assert.match(ccnaBeginnerWritingPolicy, /paper alternative/);
  assert.match(ccnaBeginnerReviewPolicy, /undefined essential jargon/);
  assert.match(ccnaBeginnerReviewPolicy, /every command explanation matches its exact command/);
});
