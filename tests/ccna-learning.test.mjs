import assert from "node:assert/strict";
import test from "node:test";
import { ccnaCurriculum, ccnaModules } from "../src/lib/ccna-curriculum.ts";
import { ccnaLessonContentSchema, ccnaOpenAIResponseSchema, evaluateCcnaLessonQuality } from "../src/lib/ccna-lesson-schema.ts";

test("OpenAI schema omits unsupported URI format while runtime URL validation stays strict", () => {
  const schema = ccnaOpenAIResponseSchema();
  assert.equal(JSON.stringify(schema).includes('"format":"uri"'), false);
  assert.equal(schema.$schema, undefined);
  const content = lessonContent();
  content.sources[0].url = "not-a-url";
  assert.equal(ccnaLessonContentSchema.safeParse(content).success, false);
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
        expectedResult: "The relevant interface and protocol state agree with the documented topology and address plan.",
        why: "This action tests one dependency and prevents an unrelated configuration change from hiding the original fault."
      })),
      verification: Array.from({ length: 4 }, (_, index) => `Verification ${index + 1} confirms the running interface, address, forwarding, or reachability state and records the evidence used to reach the conclusion.`),
      troubleshooting: Array.from({ length: 3 }, (_, index) => `Troubleshooting check ${index + 1} compares intended and observed state, changes only the failed dependency, and repeats the same verification command afterward.`),
      cleanup: ["Save the final command evidence outside the lab project.", "Stop all nodes and remove temporary failure conditions."],
      licensingNote: "GNS3 does not provide Cisco images. Learners must use Cisco software images they are properly licensed to use, or use Cisco Modeling Labs as the official Cisco alternative."
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
});
