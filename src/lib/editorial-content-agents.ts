import OpenAI from "openai";
import { z } from "zod";
import type { BlogPost } from "@/lib/blog";
import { collectEditorialEvidence, type EditorialEvidenceSource } from "@/lib/editorial-source-policy";
import { openAIApiKeyStatus, openAICredentialMessage } from "./openai-config.ts";

const defaultContentWriterModel = "gpt-4.1-mini";
const defaultContentCriticModel = "gpt-4.1-mini";

const advisoryContentSchema = z.object({
  plainLanguageSummary: z.string().min(80).max(1_200),
  technicalExplanation: z.string().min(160).max(2_400),
  businessImpact: z.string().min(80).max(1_200),
  products: z.array(z.string().min(2).max(180)).min(1).max(40),
  cves: z.array(z.string().min(3).max(40)).max(30),
  affectedVersions: z.array(z.string().min(1).max(180)).max(40),
  fixedVersions: z.array(z.string().min(1).max(180)).max(40),
  remediation: z.string().min(60).max(2_400),
  workaround: z.string().max(2_000),
  exploitationStatus: z.string().min(20).max(600),
  evidenceChecklist: z.array(z.string().min(20).max(500)).min(4).max(10)
});

const sectionSchema = z.object({
  heading: z.string().min(5).max(180),
  body: z.string().min(150).max(1_800),
  bullets: z.array(z.string().min(15).max(500)).min(2).max(6).optional(),
  sourceUrls: z.array(z.string().url().max(1_000)).max(4)
});

const blogContentSchema = z.object({
  title: z.string().min(10).max(180),
  metaTitle: z.string().min(10).max(70),
  description: z.string().min(50).max(180),
  excerpt: z.string().min(60).max(400),
  answer: z.string().min(80).max(600),
  readerOutcome: z.string().min(40).max(360),
  category: z.string().min(2).max(100),
  audience: z.string().min(2).max(240),
  primaryKeyword: z.string().min(2).max(140),
  keywords: z.array(z.string().min(2).max(140)).min(3).max(16),
  takeaways: z.array(z.string().min(20).max(400)).min(3).max(6),
  definitions: z
    .array(z.object({ term: z.string().min(2).max(100), definition: z.string().min(30).max(500) }))
    .min(2)
    .max(5),
  visualBrief: z.object({
    storyThesis: z.string().min(30).max(500),
    sceneConcept: z.string().min(50).max(1_000),
    factualAnchors: z.array(z.string().min(15).max(320)).min(2).max(6),
    avoid: z.array(z.string().min(10).max(240)).min(3).max(8)
  }),
  sections: z.array(sectionSchema).min(5).max(7),
  checklist: z.array(z.string().min(15).max(400)).min(6).max(12),
  questions: z
    .array(
      z.object({
        question: z.string().min(10).max(240),
        answer: z.string().min(50).max(800),
        sourceUrls: z.array(z.string().url().max(1_000)).max(4)
      })
    )
    .min(4)
    .max(6),
  imageAlt: z.string().min(20).max(240)
});

const contentQaSchema = z.object({
  approved: z.boolean(),
  factualGroundingScore: z.number().int().min(0).max(100),
  evidenceTraceabilityScore: z.number().int().min(0).max(100),
  authorityScore: z.number().int().min(0).max(100),
  clarityScore: z.number().int().min(0).max(100),
  structureScore: z.number().int().min(0).max(100),
  usefulnessScore: z.number().int().min(0).max(100),
  searchAnswerScore: z.number().int().min(0).max(100),
  violations: z.array(z.string().min(2).max(320)).max(12),
  rationale: z.string().min(10).max(1_000),
  correctionPrompt: z.string().max(1_600)
});

type ContentQa = z.infer<typeof contentQaSchema>;
export type AdvisoryEditorialContent = z.infer<typeof advisoryContentSchema>;

type EditorialAgentTrace = {
  provider: "openai-direct";
  contentPolicyVersion: 2;
  writerModel: string;
  criticModel: string;
  attempts: number;
  generatedAt: string;
  evidence: Array<{ label: string; url: string; fetched: boolean; characters: number }>;
  qa: ContentQa;
};

export type AdvisoryEditorialInput = {
  title: string;
  vendor: string;
  summary: string;
  severity: string;
  cvssScore: number | null;
  cves: string[];
  products: string[];
  source: EditorialEvidenceSource;
  sourcePayload: unknown;
};

export type BlogEditorialInput = {
  slug: string;
  topic: string;
  businessAngle: string;
  keywordCluster: string[];
  internalLinks: string[];
  servicePath?: string;
  sources: EditorialEvidenceSource[];
};

function env(name: string) {
  return process.env[name]?.trim() || "";
}

function usesReasoningControls(model: string) {
  return model.startsWith("gpt-5");
}

export function editorialContentAgentConfiguration() {
  const credential = openAIApiKeyStatus();
  return {
    configured: credential.configured,
    credentialIssue: credential.credentialIssue,
    provider: "OpenAI direct API",
    writerModel: env("EDITORIAL_CONTENT_WRITER_MODEL") || defaultContentWriterModel,
    criticModel: env("EDITORIAL_CONTENT_CRITIC_MODEL") || defaultContentCriticModel
  };
}

function openAIClient() {
  const credential = openAIApiKeyStatus();
  if (!credential.configured) throw new Error(openAICredentialMessage(credential));
  return new OpenAI({
    apiKey: credential.apiKey,
    organization: env("OPENAI_ORGANIZATION") || undefined,
    project: env("OPENAI_PROJECT_ID") || undefined,
    maxRetries: 0,
    timeout: 120_000
  });
}

function parseStructured<T>(value: string, schema: z.ZodType<T>, name: string) {
  if (!value.trim()) throw new Error(`${name} returned no structured output.`);
  try {
    return schema.parse(JSON.parse(value));
  } catch (error) {
    throw new Error(`${name} returned invalid structured output: ${error instanceof Error ? error.message : "unknown error"}`);
  }
}

const advisoryContentJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "plainLanguageSummary",
    "technicalExplanation",
    "businessImpact",
    "products",
    "cves",
    "affectedVersions",
    "fixedVersions",
    "remediation",
    "workaround",
    "exploitationStatus",
    "evidenceChecklist"
  ],
  properties: {
    plainLanguageSummary: { type: "string", minLength: 80, maxLength: 1_200 },
    technicalExplanation: { type: "string", minLength: 160, maxLength: 2_400 },
    businessImpact: { type: "string", minLength: 80, maxLength: 1_200 },
    products: { type: "array", minItems: 1, maxItems: 40, items: { type: "string", minLength: 2, maxLength: 180 } },
    cves: { type: "array", maxItems: 30, items: { type: "string", minLength: 3, maxLength: 40 } },
    affectedVersions: { type: "array", maxItems: 40, items: { type: "string", minLength: 1, maxLength: 180 } },
    fixedVersions: { type: "array", maxItems: 40, items: { type: "string", minLength: 1, maxLength: 180 } },
    remediation: { type: "string", minLength: 60, maxLength: 2_400 },
    workaround: { type: "string", maxLength: 2_000 },
    exploitationStatus: { type: "string", minLength: 20, maxLength: 600 },
    evidenceChecklist: { type: "array", minItems: 4, maxItems: 10, items: { type: "string", minLength: 20, maxLength: 500 } }
  }
};

const sectionJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["heading", "body", "bullets", "sourceUrls"],
  properties: {
    heading: { type: "string", minLength: 5, maxLength: 180 },
    body: { type: "string", minLength: 150, maxLength: 1_800 },
    bullets: { type: "array", minItems: 2, maxItems: 6, items: { type: "string", minLength: 15, maxLength: 500 } },
    sourceUrls: {
      type: "array",
      maxItems: 4,
      items: { type: "string", maxLength: 1_000 }
    }
  }
};

const blogContentJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "title",
    "metaTitle",
    "description",
    "excerpt",
    "answer",
    "readerOutcome",
    "category",
    "audience",
    "primaryKeyword",
    "keywords",
    "takeaways",
    "definitions",
    "visualBrief",
    "sections",
    "checklist",
    "questions",
    "imageAlt"
  ],
  properties: {
    title: { type: "string", minLength: 10, maxLength: 180 },
    metaTitle: { type: "string", minLength: 10, maxLength: 70 },
    description: { type: "string", minLength: 50, maxLength: 180 },
    excerpt: { type: "string", minLength: 60, maxLength: 400 },
    answer: { type: "string", minLength: 80, maxLength: 600 },
    readerOutcome: { type: "string", minLength: 40, maxLength: 360 },
    category: { type: "string", minLength: 2, maxLength: 100 },
    audience: { type: "string", minLength: 2, maxLength: 240 },
    primaryKeyword: { type: "string", minLength: 2, maxLength: 140 },
    keywords: { type: "array", minItems: 3, maxItems: 16, items: { type: "string", minLength: 2, maxLength: 140 } },
    takeaways: { type: "array", minItems: 3, maxItems: 6, items: { type: "string", minLength: 20, maxLength: 400 } },
    definitions: {
      type: "array",
      minItems: 2,
      maxItems: 5,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["term", "definition"],
        properties: {
          term: { type: "string", minLength: 2, maxLength: 100 },
          definition: { type: "string", minLength: 30, maxLength: 500 }
        }
      }
    },
    visualBrief: {
      type: "object",
      additionalProperties: false,
      required: ["storyThesis", "sceneConcept", "factualAnchors", "avoid"],
      properties: {
        storyThesis: { type: "string", minLength: 30, maxLength: 500 },
        sceneConcept: { type: "string", minLength: 50, maxLength: 1_000 },
        factualAnchors: {
          type: "array",
          minItems: 2,
          maxItems: 6,
          items: { type: "string", minLength: 15, maxLength: 320 }
        },
        avoid: {
          type: "array",
          minItems: 3,
          maxItems: 8,
          items: { type: "string", minLength: 10, maxLength: 240 }
        }
      }
    },
    sections: { type: "array", minItems: 5, maxItems: 7, items: sectionJsonSchema },
    checklist: { type: "array", minItems: 6, maxItems: 12, items: { type: "string", minLength: 15, maxLength: 400 } },
    questions: {
      type: "array",
      minItems: 4,
      maxItems: 6,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["question", "answer", "sourceUrls"],
        properties: {
          question: { type: "string", minLength: 10, maxLength: 240 },
          answer: { type: "string", minLength: 50, maxLength: 800 },
          sourceUrls: {
            type: "array",
            maxItems: 4,
            items: { type: "string", maxLength: 1_000 }
          }
        }
      }
    },
    imageAlt: { type: "string", minLength: 20, maxLength: 240 }
  }
};

const contentQaJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "approved",
    "factualGroundingScore",
    "evidenceTraceabilityScore",
    "authorityScore",
    "clarityScore",
    "structureScore",
    "usefulnessScore",
    "searchAnswerScore",
    "violations",
    "rationale",
    "correctionPrompt"
  ],
  properties: {
    approved: { type: "boolean" },
    factualGroundingScore: { type: "integer", minimum: 0, maximum: 100 },
    evidenceTraceabilityScore: { type: "integer", minimum: 0, maximum: 100 },
    authorityScore: { type: "integer", minimum: 0, maximum: 100 },
    clarityScore: { type: "integer", minimum: 0, maximum: 100 },
    structureScore: { type: "integer", minimum: 0, maximum: 100 },
    usefulnessScore: { type: "integer", minimum: 0, maximum: 100 },
    searchAnswerScore: { type: "integer", minimum: 0, maximum: 100 },
    violations: { type: "array", maxItems: 12, items: { type: "string", minLength: 2, maxLength: 320 } },
    rationale: { type: "string", minLength: 10, maxLength: 1_000 },
    correctionPrompt: { type: "string", maxLength: 1_600 }
  }
};

function evidenceBrief(evidence: Awaited<ReturnType<typeof collectEditorialEvidence>>) {
  return evidence
    .map(
      (source, index) =>
        `SOURCE ${index + 1}: ${source.label}\nURL: ${source.url}\nFETCHED: ${source.fetched ? "yes" : "feed summary only"}\nEVIDENCE:\n${source.text}`
    )
    .join("\n\n");
}

function contentQaPasses(qa: ContentQa) {
  return (
    qa.approved &&
    qa.violations.length === 0 &&
    qa.factualGroundingScore >= 90 &&
    qa.evidenceTraceabilityScore >= 88 &&
    qa.authorityScore >= 86 &&
    qa.clarityScore >= 84 &&
    qa.structureScore >= 86 &&
    qa.usefulnessScore >= 86 &&
    qa.searchAnswerScore >= 84
  );
}

function contentQaDeficits(qa: ContentQa) {
  const deficits = [...qa.violations];
  if (!qa.approved) deficits.push("The critic did not mark the draft approved; resolve the rationale before approving it.");
  const thresholds: Array<[keyof ContentQa, number, string]> = [
    ["factualGroundingScore", 90, "factual grounding"],
    ["evidenceTraceabilityScore", 88, "evidence traceability"],
    ["authorityScore", 86, "authority"],
    ["clarityScore", 84, "clarity"],
    ["structureScore", 86, "structure"],
    ["usefulnessScore", 86, "operational usefulness"],
    ["searchAnswerScore", 84, "search and answer-engine usefulness"]
  ];
  for (const [key, threshold, label] of thresholds) {
    const score = qa[key];
    if (typeof score === "number" && score < threshold) {
      deficits.push(`Raise ${label} from ${score} to at least ${threshold}.`);
    }
  }
  return [...new Set(deficits)];
}

function qualityScore(qa: ContentQa) {
  return Math.round(
    (qa.factualGroundingScore +
      qa.evidenceTraceabilityScore +
      qa.authorityScore +
      qa.clarityScore +
      qa.structureScore +
      qa.usefulnessScore +
      qa.searchAnswerScore) /
      7
  );
}

async function inspectContent(kind: "advisory" | "blog", evidence: string, content: unknown) {
  const config = editorialContentAgentConfiguration();
  const startedAt = Date.now();
  console.info("QCS editorial agent started.", { stage: `${kind}-critic`, model: config.criticModel });
  const response = await openAIClient().responses.create({
    model: config.criticModel,
    store: false,
    reasoning: usesReasoningControls(config.criticModel) ? { effort: "low" } : undefined,
    instructions: [
      "You are the QCS Editorial QA Critic, a senior network-security editor and fact checker.",
      "Compare every factual claim with the supplied primary-source evidence. Reject unsupported versions, exploit claims, mitigations, commands, dates, or product behavior.",
      "For blogs, verify that sourceUrls point only to supplied evidence and are attached to the sections or answers whose claims they support. A source list alone is not traceability.",
      "Reject generic filler, repetitive template language, unexplained jargon, sensational phrasing, copied source wording, weak search intent, and content that would not help a real operator make a decision.",
      "For blogs, require a direct answer, a clear reader outcome, defined entities, useful headings, evidence-led reasoning, implementation and validation guidance, realistic limitations, and FAQs that resolve genuine follow-up questions.",
      "Plain-language passages should be understandable to an IT decision maker; technical passages must remain precise for engineers.",
      "Set approved true only when the content is authoritative, useful, easy to understand, and ready for professional publication.",
      "Required passing scores are factual grounding 90, evidence traceability 88, authority 86, clarity 84, structure 86, usefulness 86, and search/answer usefulness 84. If any score misses, name the exact deficit in violations and correctionPrompt. Keep approved and rationale consistent with the scores. Return JSON only."
    ].join(" "),
    input: `CONTENT TYPE: ${kind}\n\nPRIMARY-SOURCE EVIDENCE:\n${evidence}\n\nDRAFT TO REVIEW:\n${JSON.stringify(content)}`,
    max_output_tokens: 1_600,
    text: {
      ...(usesReasoningControls(config.criticModel) ? { verbosity: "low" as const } : {}),
      format: { type: "json_schema", name: "qcs_editorial_content_qa", strict: true, schema: contentQaJsonSchema }
    }
  });
  console.info("QCS editorial agent completed.", {
    stage: `${kind}-critic`,
    model: config.criticModel,
    durationMs: Date.now() - startedAt
  });
  return parseStructured(response.output_text, contentQaSchema, "QCS Editorial QA Critic");
}

async function writeAdvisory(input: AdvisoryEditorialInput, evidence: string, correction = "") {
  const config = editorialContentAgentConfiguration();
  const startedAt = Date.now();
  console.info("QCS editorial agent started.", { stage: "advisory-writer", model: config.writerModel });
  const response = await openAIClient().responses.create({
    model: config.writerModel,
    store: false,
    reasoning: usesReasoningControls(config.writerModel) ? { effort: "low" } : undefined,
    instructions: [
      "You are the QCS Security Advisory Analyst, a senior vulnerability-response engineer and plain-language technical writer.",
      "Use only the supplied primary-source evidence. Never infer affected or fixed versions, exploitation, workaround, severity, or product behavior that the evidence does not state.",
      "When a detail is absent, leave its array empty or state that the official source does not specify it. Do not call a mitigation a fix.",
      "Explain the issue first for a non-specialist, then accurately for network and security engineers. Paraphrase the source; do not reproduce long source passages.",
      "Return the required JSON only."
    ].join(" "),
    input: [
      `ADVISORY SIGNAL:\n${JSON.stringify({ ...input, sourcePayload: input.sourcePayload })}`,
      `PRIMARY-SOURCE EVIDENCE:\n${evidence}`,
      correction ? `MANDATORY EDITORIAL CORRECTION:\n${correction}` : ""
    ]
      .filter(Boolean)
      .join("\n\n"),
    max_output_tokens: 3_200,
    text: {
      ...(usesReasoningControls(config.writerModel) ? { verbosity: "medium" as const } : {}),
      format: { type: "json_schema", name: "qcs_security_advisory_content", strict: true, schema: advisoryContentJsonSchema }
    }
  });
  console.info("QCS editorial agent completed.", {
    stage: "advisory-writer",
    model: config.writerModel,
    durationMs: Date.now() - startedAt
  });
  return parseStructured(response.output_text, advisoryContentSchema, "QCS Security Advisory Analyst");
}

export async function enrichSecurityAdvisory(input: AdvisoryEditorialInput) {
  const evidence = await collectEditorialEvidence([input.source], 1);
  const brief = evidenceBrief(evidence);
  let correction = "";
  let latestQa: ContentQa | null = null;
  let latestContent: AdvisoryEditorialContent | null = null;

  for (let attempt = 1; attempt <= 2; attempt += 1) {
    latestContent = await writeAdvisory(input, brief, correction);
    latestQa = await inspectContent("advisory", brief, latestContent);
    console.info("QCS editorial QA result.", { kind: "advisory", attempt, qa: latestQa });
    if (contentQaPasses(latestQa)) {
      return {
        content: latestContent,
        qualityScore: qualityScore(latestQa),
        trace: {
          provider: "openai-direct",
          contentPolicyVersion: 2,
          writerModel: editorialContentAgentConfiguration().writerModel,
          criticModel: editorialContentAgentConfiguration().criticModel,
          attempts: attempt,
          generatedAt: new Date().toISOString(),
          evidence: evidence.map((item) => ({ label: item.label, url: item.url, fetched: item.fetched, characters: item.text.length })),
          qa: latestQa
        } satisfies EditorialAgentTrace
      };
    }
    correction = latestQa.correctionPrompt || contentQaDeficits(latestQa).join("; ");
  }
  throw new Error(`Advisory editorial QA rejected the content: ${latestQa?.rationale || "unknown reason"}`);
}

async function writeBlog(input: BlogEditorialInput, evidence: string, correction = "") {
  const config = editorialContentAgentConfiguration();
  const startedAt = Date.now();
  console.info("QCS editorial agent started.", { stage: "blog-writer", model: config.writerModel });
  const response = await openAIClient().responses.create({
    model: config.writerModel,
    store: false,
    reasoning: usesReasoningControls(config.writerModel) ? { effort: "low" } : undefined,
    instructions: [
      "You are the QCS Research Editor, a senior network engineer, cybersecurity writer, SEO strategist, and educator.",
      "Create an original, authoritative article from the supplied primary-source evidence. Search demand may shape the question, but never treat a trend or headline as technical evidence.",
      "Answer the reader's real question immediately, explain terminology in plain English, then provide technically precise reasoning, examples, evidence, decisions, safeguards, and practical next steps.",
      "Build the article for human readers and answer engines: state a self-contained direct answer first; define important entities; organize the body around the reader's decision; distinguish evidence, interpretation, and recommendation; include implementation, validation, limitations, and escalation guidance where relevant.",
      "Use sourceUrls on each section and FAQ answer to cite only the supplied URL or URLs that support its factual claims. Use an empty array only for clearly labeled QCS analysis or practical advice that does not depend on an external fact.",
      "Keep the finished article between roughly 1,400 and 1,900 words. Use five to seven focused sections, four to six genuine FAQs, and concise bullets only where they improve scanning.",
      "Create a topic-specific visualBrief from the article's concrete systems, evidence, and cause-and-effect relationship. Its factualAnchors must be supported by the article, and its avoid list must prevent likely visual misinterpretations or generic cyber imagery.",
      "Do not produce a vendor-news rewrite, generic checklist template, sales pitch, or repetitive QCS boilerplate. Do not invent versions, statistics, commands, exploit claims, outcomes, or quotations.",
      "Use short paragraphs, meaningful headings, active voice, and natural language suitable for informed readers worldwide and in India. Paraphrase sources and return JSON only."
    ].join(" "),
    input: [
      `EDITORIAL BRIEF:\n${JSON.stringify({ topic: input.topic, businessAngle: input.businessAngle, keywordCluster: input.keywordCluster })}`,
      `PRIMARY-SOURCE EVIDENCE:\n${evidence}`,
      correction ? `MANDATORY EDITORIAL CORRECTION:\n${correction}` : ""
    ]
      .filter(Boolean)
      .join("\n\n"),
    max_output_tokens: 4_000,
    text: {
      ...(usesReasoningControls(config.writerModel) ? { verbosity: "medium" as const } : {}),
      format: { type: "json_schema", name: "qcs_researched_blog_content", strict: true, schema: blogContentJsonSchema }
    }
  });
  console.info("QCS editorial agent completed.", {
    stage: "blog-writer",
    model: config.writerModel,
    durationMs: Date.now() - startedAt
  });
  return parseStructured(response.output_text, blogContentSchema, "QCS Research Editor");
}

function compact(value: string, max: number) {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (normalized.length <= max) return normalized;
  return normalized.slice(0, max + 1).replace(/\s+\S*$/, "").replace(/[,:;\s]+$/, "");
}

function labelFromPath(path: string) {
  return (
    path
      .split("/")
      .filter(Boolean)
      .at(-1)
      ?.split("-")
      .map((word) => `${word.charAt(0).toUpperCase()}${word.slice(1)}`)
      .join(" ") || "QCS Service"
  );
}

function buildBlogPost(input: BlogEditorialInput, draft: z.infer<typeof blogContentSchema>, evidence: Awaited<ReturnType<typeof collectEditorialEvidence>>) {
  const today = new Date().toISOString().slice(0, 10);
  const links = [...new Set([...input.internalLinks, input.servicePath || "", "/network-tools", "/tools/network-risk-score"])].filter(
    (href) => href.startsWith("/")
  );
  const services = links.filter((href) => href.startsWith("/services/") || href.startsWith("/solutions/"));
  const tools = links.filter((href) => href === "/network-tools" || href.startsWith("/tools/"));
  const wordCount = [draft.answer, ...draft.takeaways, ...draft.sections.flatMap((section) => [section.body, ...(section.bullets || [])]), ...draft.checklist, ...draft.questions.map((item) => item.answer)]
    .join(" ")
    .split(/\s+/)
    .filter(Boolean).length;
  const allowedSourceUrls = new Set(evidence.map((source) => source.url));
  const sourceUrls = (values: string[]) => [...new Set(values.filter((url) => allowedSourceUrls.has(url)))];

  return {
    contentVersion: 2,
    contentType: "blog",
    slug: input.slug,
    title: compact(draft.title, 180),
    metaTitle: compact(draft.metaTitle, 60),
    description: compact(draft.description, 160),
    excerpt: draft.excerpt,
    answer: draft.answer,
    category: draft.category,
    audience: draft.audience,
    primaryKeyword: draft.primaryKeyword,
    keywords: [...new Set(draft.keywords)],
    publishedAt: today,
    updatedAt: today,
    readTime: `${Math.max(5, Math.ceil(wordCount / 210))} min read`,
    image: `/resources/${input.slug}/visual`,
    imageAlt: draft.imageAlt,
    readerOutcome: draft.readerOutcome,
    reviewedBy: {
      name: "QCS Network & Security Engineering",
      role: "Technical review team"
    },
    editorialMethod: `Researched from the listed primary and official sources, written for operational decision-making, and reviewed through QCS editorial QA. Sources checked ${today}.`,
    definitions: draft.definitions,
    visualBrief: draft.visualBrief,
    relatedTools: (tools.length ? tools : ["/network-tools"]).slice(0, 4).map((href) => ({ label: labelFromPath(href), href })),
    relatedServices: (services.length ? services : ["/services/managed-network-services"])
      .slice(0, 4)
      .map((href) => ({ label: labelFromPath(href), href })),
    takeaways: draft.takeaways,
    sections: draft.sections.map((section) => ({ ...section, sourceUrls: sourceUrls(section.sourceUrls) })),
    checklist: draft.checklist,
    questions: draft.questions.map((question) => ({ ...question, sourceUrls: sourceUrls(question.sourceUrls) })),
    sources: evidence.map((source) => ({ label: source.label, url: source.url }))
  } satisfies BlogPost;
}

export async function createResearchedBlog(input: BlogEditorialInput) {
  const evidence = await collectEditorialEvidence(input.sources, 4);
  const usable = evidence.filter((source) => source.text.length >= 120);
  if (!usable.length) throw new Error("No usable primary-source evidence was available for this article.");
  const brief = evidenceBrief(usable);
  let correction = "";
  let latestQa: ContentQa | null = null;

  for (let attempt = 1; attempt <= 2; attempt += 1) {
    const written = await writeBlog(input, brief, correction);
    const content = buildBlogPost(input, written, usable);
    latestQa = await inspectContent("blog", brief, content);
    console.info("QCS editorial QA result.", { kind: "blog", attempt, qa: latestQa });
    if (contentQaPasses(latestQa)) {
      return {
        content,
        qualityScore: qualityScore(latestQa),
        trace: {
          provider: "openai-direct",
          contentPolicyVersion: 2,
          writerModel: editorialContentAgentConfiguration().writerModel,
          criticModel: editorialContentAgentConfiguration().criticModel,
          attempts: attempt,
          generatedAt: new Date().toISOString(),
          evidence: usable.map((item) => ({ label: item.label, url: item.url, fetched: item.fetched, characters: item.text.length })),
          qa: latestQa
        } satisfies EditorialAgentTrace
      };
    }
    correction = latestQa.correctionPrompt || contentQaDeficits(latestQa).join("; ");
  }
  throw new Error(
    `Blog editorial QA rejected the content: ${latestQa?.rationale || "unknown reason"}. Deficits: ${latestQa ? contentQaDeficits(latestQa).join(" ") : "unknown"}`
  );
}
