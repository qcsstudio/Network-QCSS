import crypto from "node:crypto";
import type { BlogPost } from "./blog.ts";

export type EditorialStorySpine = {
  primarySubject: string;
  trigger: string;
  mechanism: string;
  consequence: string;
  operatorDecision: string;
  verification: string;
  secondaryContext: string[];
  visualSequence: [string, string, string];
};

export type EditorialVisualBrief = {
  storyThesis: string;
  sceneConcept: string;
  factualAnchors: string[];
  avoid: string[];
};

export type EditorialLineage = {
  policyVersion: 1;
  hash: string;
  contentType: "ccna_lesson" | "content_post" | "security_advisory";
  contentId: string;
  contentRevision: string;
  storySpine: EditorialStorySpine;
  stages: [
    "source_evidence",
    "approved_revision",
    "visual_storyboard",
    "article_image",
    "linkedin_derivative"
  ];
};

type AdvisoryStorySource = {
  title: string;
  vendor: string;
  summary: string;
  technicalExplanation?: string;
  businessImpact?: string;
  exploitationStatus?: string;
  remediation: string;
  evidenceChecklist?: unknown;
  fixedVersions?: unknown;
  products?: unknown;
  editorialTrace?: unknown;
};

function normalize(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function clip(value: string, limit = 420) {
  const normalized = normalize(value);
  if (normalized.length <= limit) return normalized;
  return normalized.slice(0, limit + 1).replace(/\s+\S*$/, "").replace(/[,:;\s]+$/, "");
}

function strings(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string").map(normalize).filter(Boolean) : [];
}

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

export function isEditorialStorySpine(value: unknown): value is EditorialStorySpine {
  const item = record(value);
  if (!item) return false;
  const required = ["primarySubject", "trigger", "mechanism", "consequence", "operatorDecision", "verification"];
  if (!required.every((key) => typeof item[key] === "string" && normalize(item[key] as string).length >= 20)) return false;
  if (!Array.isArray(item.secondaryContext) || !item.secondaryContext.every((entry) => typeof entry === "string")) return false;
  return Array.isArray(item.visualSequence) && item.visualSequence.length === 3 && item.visualSequence.every((entry) => typeof entry === "string" && normalize(entry).length >= 12);
}

export function normalizeStorySpine(value: EditorialStorySpine): EditorialStorySpine {
  return {
    primarySubject: clip(value.primarySubject, 240),
    trigger: clip(value.trigger),
    mechanism: clip(value.mechanism, 600),
    consequence: clip(value.consequence),
    operatorDecision: clip(value.operatorDecision),
    verification: clip(value.verification),
    secondaryContext: [...new Set(value.secondaryContext.map((item) => clip(item, 240)).filter(Boolean))].slice(0, 4),
    visualSequence: value.visualSequence.map((item) => clip(item, 280)) as [string, string, string]
  };
}

export function alignEditorialVisualStory(value: EditorialStorySpine, visualBrief: EditorialVisualBrief) {
  const spine = normalizeStorySpine(value);
  const storySpine: EditorialStorySpine = {
    ...spine,
    visualSequence: [
      clip(`Establish the trigger: ${spine.trigger}`, 300),
      clip(`Explain the mechanism: ${spine.mechanism}`, 300),
      clip(`Resolve with the operator decision: ${spine.operatorDecision} Verify closure: ${spine.verification}`, 300)
    ]
  };
  return {
    storySpine,
    visualBrief: {
      ...visualBrief,
      storyThesis: clip(`${spine.primarySubject}: ${spine.consequence}`, 500),
      sceneConcept: clip(
        `Establish ${spine.trigger} Explain ${spine.mechanism} Show the consequence: ${spine.consequence} Resolve with ${spine.operatorDecision} Close with ${spine.verification}`,
        1_000
      ),
      factualAnchors: [spine.trigger, spine.mechanism, spine.consequence, spine.operatorDecision, spine.verification].map((item) => clip(item, 320))
    }
  };
}

export function storySpineForArticle(post: BlogPost): EditorialStorySpine {
  if (isEditorialStorySpine(post.storySpine)) return normalizeStorySpine(post.storySpine);
  const verificationSection = post.sections.find((section) => /validat|verify|monitor|measure|confirm|evidence/i.test(section.heading));
  const mechanismSection = post.sections.find((section) => /how|mechanism|understand|cause|work/i.test(section.heading));
  const decision = post.checklist.slice(0, 3).join("; ") || post.readerOutcome || post.answer;
  const verification = verificationSection?.body || post.checklist.slice(-3).join("; ") || post.readerOutcome || post.answer;
  return normalizeStorySpine({
    primarySubject: post.primaryKeyword || post.title,
    trigger: post.answer,
    mechanism: post.visualBrief?.storyThesis || mechanismSection?.body || post.excerpt,
    consequence: post.readerOutcome || post.excerpt,
    operatorDecision: decision,
    verification,
    secondaryContext: [],
    visualSequence: [
      post.visualBrief?.sceneConcept || post.answer,
      post.visualBrief?.storyThesis || post.excerpt,
      verification
    ]
  });
}

export function storySpineForAdvisory(advisory: AdvisoryStorySource): EditorialStorySpine {
  const trace = record(advisory.editorialTrace);
  if (isEditorialStorySpine(trace?.storySpine)) return normalizeStorySpine(trace.storySpine);
  const products = strings(advisory.products);
  const fixedVersions = strings(advisory.fixedVersions);
  const evidence = strings(advisory.evidenceChecklist);
  const primarySubject = [advisory.vendor, products.slice(0, 3).join(", ") || advisory.title].filter(Boolean).join(" ");
  const verification = [
    fixedVersions.length ? `Confirm deployment on vendor-fixed releases: ${fixedVersions.join(", ")}.` : "Confirm the vendor remediation state against the official advisory.",
    ...evidence.slice(0, 2)
  ].join(" ");
  return normalizeStorySpine({
    primarySubject,
    trigger: advisory.exploitationStatus || advisory.summary,
    mechanism: advisory.technicalExplanation || advisory.summary,
    consequence: advisory.businessImpact || advisory.summary,
    operatorDecision: advisory.remediation,
    verification,
    secondaryContext: [],
    visualSequence: [
      `Identify the affected ${primarySubject} boundary and the source-confirmed exposure state.`,
      `Show the source-confirmed technical mechanism leading to the stated operational consequence.`,
      "Show remediation completed and verified with observable evidence, without inventing exploitation."
    ]
  });
}

export function buildStorySpineContext(spine: EditorialStorySpine) {
  return [
    "LOCKED SINGLE-STORY CHRONOLOGY:",
    `Primary subject: ${spine.primarySubject}`,
    `1. Trigger or change: ${spine.trigger}`,
    `2. Supported technical mechanism: ${spine.mechanism}`,
    `3. Operational consequence: ${spine.consequence}`,
    `4. Operator decision or action: ${spine.operatorDecision}`,
    `5. Closure evidence: ${spine.verification}`,
    `Visual frame 1 - establish: ${spine.visualSequence[0]}`,
    `Visual frame 2 - explain: ${spine.visualSequence[1]}`,
    `Visual frame 3 - resolve: ${spine.visualSequence[2]}`,
    spine.secondaryContext.length
      ? `Secondary context that must remain visually subordinate and must not become the headline story: ${spine.secondaryContext.join("; ")}`
      : "Secondary context: none. Do not introduce an adjacent technology, advisory, or trend."
  ].join("\n");
}

function meaningfulTokens(value: string) {
  const stop = new Set([
    "about",
    "after",
    "against",
    "also",
    "and",
    "are",
    "before",
    "being",
    "between",
    "but",
    "can",
    "could",
    "does",
    "every",
    "for",
    "from",
    "has",
    "have",
    "how",
    "into",
    "its",
    "more",
    "must",
    "not",
    "only",
    "other",
    "our",
    "should",
    "such",
    "than",
    "that",
    "the",
    "their",
    "there",
    "these",
    "they",
    "this",
    "through",
    "using",
    "was",
    "were",
    "when",
    "where",
    "which",
    "will",
    "with",
    "without",
    "you",
    "your"
  ]);
  return new Set((value.toLowerCase().match(/[a-z0-9][a-z0-9.+-]{2,}/g) || []).filter((token) => !stop.has(token)));
}

const genericEditorialTokens = new Set([
  "best",
  "controls",
  "management",
  "monitoring",
  "network",
  "operational",
  "practices",
  "security",
  "technical",
  "vulnerability",
  "vulnerabilities"
]);

function overlap(left: string, right: string) {
  const a = meaningfulTokens(left);
  const b = meaningfulTokens(right);
  if (!a.size || !b.size) return 0;
  return [...a].filter((token) => b.has(token)).length / Math.min(a.size, b.size);
}

export function storySpineQualityIssues(post: BlogPost) {
  if (!post.storySpine || !isEditorialStorySpine(post.storySpine)) return ["Add a complete single-story chronology before publication."];
  const spine = normalizeStorySpine(post.storySpine);
  const issues: string[] = [];
  if (overlap(spine.primarySubject, `${post.title} ${post.primaryKeyword}`) < 0.25) {
    issues.push("Make the story spine primary subject match the article title and primary search intent.");
  }
  const articleText = [
    post.title,
    post.answer,
    post.excerpt,
    post.readerOutcome || "",
    ...post.sections.flatMap((section) => [section.heading, section.body, ...(section.bullets || [])]),
    ...post.checklist
  ].join(" ");
  for (const [label, value] of [
    ["trigger", spine.trigger],
    ["mechanism", spine.mechanism],
    ["consequence", spine.consequence],
    ["operator decision", spine.operatorDecision],
    ["verification", spine.verification]
  ] as const) {
    if (overlap(value, articleText) < 0.25) issues.push(`Align the story spine ${label} with the article body.`);
  }
  const titleTokens = meaningfulTokens(`${post.title} ${post.primaryKeyword}`);
  const primaryTokens = meaningfulTokens(spine.primarySubject);
  for (const secondary of spine.secondaryContext) {
    const promotedTokens = [...meaningfulTokens(secondary)].filter(
      (token) => !genericEditorialTokens.has(token) && titleTokens.has(token) && !primaryTokens.has(token)
    );
    if (promotedTokens.length) {
      issues.push("Move secondary context out of the article title and primary search intent.");
      break;
    }
  }
  const visualText = [post.visualBrief?.storyThesis || "", ...(post.visualBrief?.factualAnchors || [])].join(" ");
  if (visualText && overlap(`${spine.primarySubject} ${spine.mechanism} ${spine.consequence}`, visualText) < 0.2) {
    issues.push("Align the visual brief with the locked subject, mechanism, and consequence.");
  }
  const distinctFrames = new Set(spine.visualSequence.map((item) => normalize(item).toLowerCase()));
  if (distinctFrames.size !== 3) issues.push("Use three distinct visual frames: establish, explain, and resolve.");
  const spineText = [spine.primarySubject, spine.trigger, spine.mechanism, spine.consequence, spine.operatorDecision, spine.verification].join(" ");
  if (spine.visualSequence.some((frame) => overlap(frame, spineText) < 0.15)) {
    issues.push("Make every visual frame derive from the locked story chronology.");
  }
  return issues;
}

export function createEditorialLineage(input: {
  contentType: EditorialLineage["contentType"];
  contentId: string;
  contentRevision: string;
  storySpine: EditorialStorySpine;
}): EditorialLineage {
  const storySpine = normalizeStorySpine(input.storySpine);
  const hash = crypto
    .createHash("sha256")
    .update(JSON.stringify({ ...input, storySpine, policyVersion: 1 }))
    .digest("hex");
  return {
    policyVersion: 1,
    hash,
    contentType: input.contentType,
    contentId: input.contentId,
    contentRevision: input.contentRevision,
    storySpine,
    stages: ["source_evidence", "approved_revision", "visual_storyboard", "article_image", "linkedin_derivative"]
  };
}

export function lineageFromMetadata(value: unknown) {
  const metadata = record(value);
  const lineage = record(metadata?.lineage);
  return lineage && typeof lineage.hash === "string" && lineage.policyVersion === 1 ? lineage : null;
}
