import { z } from "zod";
import { visualConceptIssues, visualConceptSelectionSchema } from "./visual-concept-policy.ts";

const id = z.string().regex(/^[a-z][a-z0-9-]{0,19}$/);
export const ccnaVisualFieldLimits = { altText: 300, boundary: 300, nodeDetail: 34, stageTitle: 32, stageExplanation: 280 } as const;
export const ccnaVisualTextBudgets = { altText: 200, boundary: 220, nodeDetail: 24, stageTitle: 26, stageExplanation: 240 } as const;

const ccnaVisualNodeSchema = z.object({
  id,
  kind: z.enum(["computer", "switch", "router", "server", "packet", "address", "record", "cloud", "boundary"]),
  label: z.string().min(2).max(24),
  detail: z.string().max(ccnaVisualFieldLimits.nodeDetail)
});

export const ccnaVisualStorySchema = z.object({
  conceptSelection: visualConceptSelectionSchema,
  title: z.string().min(8).max(65),
  takeaway: z.string().min(30).max(180),
  altText: z.string().min(40).max(ccnaVisualFieldLimits.altText),
  boundary: z.string().min(40).max(ccnaVisualFieldLimits.boundary),
  layout: z.enum(["sequence", "comparison", "layers"]),
  nodes: z.array(ccnaVisualNodeSchema).min(2).max(5),
  connections: z.array(z.object({ id, from: id, to: id })).max(5),
  stages: z.array(z.object({
    title: z.string().min(4).max(ccnaVisualFieldLimits.stageTitle),
    explanation: z.string().min(40).max(ccnaVisualFieldLimits.stageExplanation),
    activeNodes: z.array(id).min(1).max(4),
    activeConnections: z.array(id).max(5),
    direction: z.enum(["forward", "reverse", "none"]),
    sourceUrls: z.array(z.string().url()).min(1).max(3)
  })).length(3)
});

export type CcnaVisualStory = z.infer<typeof ccnaVisualStorySchema>;

export const ccnaVisualGenerationSchema = ccnaVisualStorySchema.extend({
  altText: z.string().min(40).max(ccnaVisualTextBudgets.altText),
  boundary: z.string().min(40).max(ccnaVisualTextBudgets.boundary),
  nodes: z.array(ccnaVisualNodeSchema.extend({ detail: z.string().min(1).max(ccnaVisualTextBudgets.nodeDetail) })).min(2).max(5),
  stages: z.array(ccnaVisualStorySchema.shape.stages.element.extend({
    title: z.string().min(4).max(ccnaVisualTextBudgets.stageTitle),
    explanation: z.string().min(40).max(ccnaVisualTextBudgets.stageExplanation)
  })).length(3)
});

const danglingSentenceEnding = /\b(?:a|an|and|or|the)[.!?]?$/i;
const danglingNodeEnding = /\b(?:a|an|and|as|at|between|by|for|from|in|into|of|on|or|the|through|to|toward|with)$/i;

function isCompleteVisualSentence(value: string) {
  const text = value.trim();
  return /[.!?]$/.test(text) && !/\.{3}|…/.test(text) && !danglingSentenceEnding.test(text);
}

function isCompleteNodeDetail(value: string) {
  const text = value.trim();
  return text.length > 0 && !/\.{3}|…/.test(text) && !/[,;:\-]$/.test(text) && !danglingNodeEnding.test(text);
}

export function ccnaVisualStoryIssues(story: CcnaVisualStory, sources: string[]) {
  const issues = visualConceptIssues(story.conceptSelection);
  const nodes = new Set(story.nodes.map((node) => node.id));
  const connections = new Set(story.connections.map((edge) => edge.id));
  if (nodes.size !== story.nodes.length || connections.size !== story.connections.length) issues.push("Use unique visual node and connection identifiers.");
  if (story.connections.some((edge) => !nodes.has(edge.from) || !nodes.has(edge.to) || edge.from === edge.to)) issues.push("Every visual connection must join two different, existing nodes.");
  if (story.stages.some((stage) => stage.activeNodes.some((node) => !nodes.has(node)) || stage.activeConnections.some((edge) => !connections.has(edge)))) issues.push("Every visual stage must reference existing nodes and connections.");
  if (story.stages.some((stage) => stage.sourceUrls.some((url) => !sources.includes(url)))) issues.push("Cite verified lesson bibliography sources for every visual stage.");
  if (new Set(story.stages.map((stage) => stage.title.toLowerCase())).size !== 3) issues.push("Each visual stage must explain a different step.");
  if ([story.title, ...story.nodes.flatMap((node) => [node.label, node.detail])].some((value) => /\S{25}/.test(value))) issues.push("Shorten unbroken visual labels so they remain legible without clipping.");
  if (!isCompleteVisualSentence(story.altText) || story.altText.length > ccnaVisualTextBudgets.altText) {
    issues.push(`Rewrite visual alt text as one or two complete sentences within ${ccnaVisualTextBudgets.altText} characters; current length is ${story.altText.length}. Name the full path and destination without clipping.`);
  }
  if (!isCompleteVisualSentence(story.boundary) || story.boundary.length > ccnaVisualTextBudgets.boundary) {
    issues.push(`Rewrite the visual boundary as one or two complete sentences within ${ccnaVisualTextBudgets.boundary} characters; current length is ${story.boundary.length}. State what the diagram omits and why without clipping.`);
  }
  const incompleteNodeDetails = story.nodes.filter((node) => node.detail.length > ccnaVisualTextBudgets.nodeDetail || !isCompleteNodeDetail(node.detail));
  if (incompleteNodeDetails.length) {
    issues.push(`Rewrite node details as complete phrases of no more than ${ccnaVisualTextBudgets.nodeDetail} characters for: ${incompleteNodeDetails.map((node) => node.label).join(", ")}. Move supporting explanation into the visual stages instead of cutting text.`);
  }
  const incompleteStageTitles = story.stages.flatMap((stage, index) => stage.title.length > ccnaVisualTextBudgets.stageTitle || !isCompleteNodeDetail(stage.title) ? [index + 1] : []);
  if (incompleteStageTitles.length) {
    issues.push(`Rewrite visual stage titles as complete phrases of no more than ${ccnaVisualTextBudgets.stageTitle} characters for stage(s): ${incompleteStageTitles.join(", ")}. Do not abbreviate or cut device names.`);
  }
  const incompleteStageExplanations = story.stages.flatMap((stage, index) => stage.explanation.length > ccnaVisualTextBudgets.stageExplanation || !isCompleteVisualSentence(stage.explanation) ? [index + 1] : []);
  if (incompleteStageExplanations.length) {
    issues.push(`Rewrite visual stage explanations as complete sentences of no more than ${ccnaVisualTextBudgets.stageExplanation} characters for stage(s): ${incompleteStageExplanations.join(", ")}. Preserve the complete action and destination.`);
  }
  return issues;
}

export const ccnaVisualWritingInstructions = [
  "visualStory is a required teaching diagram, not decorative artwork. Choose one specific relationship from the completed lesson and explain it in three stages. Keep exact labels short and write a meaningful altText and a boundary stating what this simplified model does NOT prove.",
  `Use two to five stable nodes and up to five explicitly named connections. Node order controls placement: sequence runs left to right; comparison is a two-column grid; layers runs top to bottom. Select a layout because it explains the subject, not to vary colours. A node may be a device, an address group, a packet, a record, or a conceptual boundary; its label must name the actual thing it represents. Write altText as one or two complete sentences of 90-${ccnaVisualTextBudgets.altText} characters, boundary as one or two complete sentences of 90-${ccnaVisualTextBudgets.boundary} characters, every node detail as a complete 8-${ccnaVisualTextBudgets.nodeDetail}-character phrase, every stage title within ${ccnaVisualTextBudgets.stageTitle} characters, and every stage explanation within ${ccnaVisualTextBudgets.stageExplanation} characters. These are composition budgets, not truncation targets. Move extra facts into the lesson; never cut a word or sentence to fit a field.`,
  "Connections have from/to identifiers; each stage highlights existing nodes/connections. forward follows from-to, reverse follows to-from, none means an undirected relationship. Do not add links that the lesson does not establish. In a layered or conceptual model, the boundary must say this is not a physical wiring diagram.",
  "Before returning the visual, count every text field and rewrite any text over its composition budget as complete shorter wording. The generation schema and approval checks use the same budgets. Do not slice or truncate strings.",
  "Cite bibliography URLs that support each visual stage. The independent instructor reviews all labels, arrow direction, topology, address examples and explanation boundaries against the researched lesson. Do not imply that VLAN separation is encryption, DNS queries carry web pages, RPKI proves the whole AS path, or a ping proves application health."
].join(" ");

const vpcs = "https://docs.gns3.com/docs/emulators/vpcs";
const topology = "https://docs.gns3.com/docs/getting-started/your-first-gns3-topology";

export const firstNetworkVisualStory: CcnaVisualStory = {
  conceptSelection: {
    candidates: [
      { name: "A first network on a desk", scene: "Two computers and a small switch, with two clearly traceable cable paths and a separate request-and-reply explanation.", teachingValue: "Connect familiar physical objects to the smallest practical GNS3 network.", limitation: "Visible cables alone cannot prove that addresses or connectivity work." },
      { name: "A note between two desks", scene: "A note travels between two labelled desks, then a reply returns along the same corridor.", teachingValue: "Explain why a test needs both a destination and a reply.", limitation: "People delivering notes do not model Ethernet switching rules accurately." },
      { name: "A failed address and a repair", scene: "Compare the planned address with a wrong-subnet address, then show the restored address beside a new ping check.", teachingValue: "Connect one reversible fault to the evidence used to find it.", limitation: "This introduces subnet reasoning before a new learner understands the devices." }
    ],
    selectedIndex: 0,
    selectionReason: "Start with familiar computers and a visible connection. Then separate physical setup, the test request and its reply without introducing untaught address mathematics."
  },
  title: "Two computers. One small network.",
  takeaway: "A cable connects the devices. A request and reply test whether they can communicate.",
  altText: "PC1 connects through one Ethernet switch to PC2. A ping request travels from PC1 to PC2; a reply travels back. Both computers need the planned addresses.",
  boundary: "This simplifies the ping request and reply. It omits address discovery and frame forwarding details. A reply does not prove that a website or application works.",
  layout: "sequence",
  nodes: [
    { id: "pc1", kind: "computer", label: "PC1", detail: "192.168.10.1/24" },
    { id: "sw1", kind: "switch", label: "Ethernet switch", detail: "Connects the local links" },
    { id: "pc2", kind: "computer", label: "PC2", detail: "192.168.10.2/24" }
  ],
  connections: [{ id: "left-link", from: "pc1", to: "sw1" }, { id: "right-link", from: "sw1", to: "pc2" }],
  stages: [
    { title: "Connect the devices", explanation: "Give each computer its own cable to the switch. In GNS3, connect two VPCS nodes to one built-in Ethernet switch. A cable alone is not a successful test.", activeNodes: ["pc1", "sw1", "pc2"], activeConnections: ["left-link", "right-link"], direction: "none", sourceUrls: [topology] },
    { title: "Send a test request", explanation: "After setting the planned addresses, run ping 192.168.10.2 in PC1. The request is for PC2, not PC1's own address. The arrows show its simplified outbound path.", activeNodes: ["pc1", "pc2"], activeConnections: ["left-link", "right-link"], direction: "forward", sourceUrls: [vpcs] },
    { title: "Look for the reply", explanation: "A reply from PC2 comes back to PC1. Read the result in PC1's console. No reply means you should check the links, addresses and test settings before changing anything else.", activeNodes: ["pc2", "pc1"], activeConnections: ["left-link", "right-link"], direction: "reverse", sourceUrls: [vpcs] }
  ]
};

type VisualLesson = { slug: string; content: { visualStory?: CcnaVisualStory; sources: Array<{ url: string }>; lab: { addressing: Array<{ address: string }> } } | null };

export function visualStoryForLesson(lesson: VisualLesson) {
  if (!lesson.content) return null;
  const story = lesson.content.visualStory;
  if (story && !ccnaVisualStoryIssues(story, lesson.content.sources.map((source) => source.url)).length) return story;
  // The reviewed first-lesson illustration is only valid for this exact address plan.
  const addresses = lesson.content.lab.addressing.map((row) => row.address.trim());
  if (lesson.slug === "ccna-roadmap-and-lab-method" && addresses.some((value) => /^192\.168\.10\.1\/24(?:\s|$)/.test(value)) && addresses.some((value) => /^192\.168\.10\.2\/24(?:\s|$)/.test(value))) return firstNetworkVisualStory;
  return null;
}

export function firstNetworkArtwork(lesson: VisualLesson) {
  return visualStoryForLesson(lesson) === firstNetworkVisualStory
    ? { src: "/brand/ccna/first-network-tabletop-v1.jpg", width: 1672, height: 941, alt: "Illustration of two laptops, each connected by a separate cable to one small Ethernet switch." }
    : null;
}
