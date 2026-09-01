import OpenAI from "openai";
import { z } from "zod";
import { editorialReadingQualityInstruction } from "./editorial-quality-policy.ts";
import type { BlogPost } from "@/lib/blog";
import { evaluateEditorialReadiness } from "@/lib/editorial-publication-policy";
import {
  collectEditorialEvidence,
  isTrustedEditorialUrl,
  type EditorialEvidenceSource
} from "@/lib/editorial-source-policy";
import { mapClaimSourceUrls } from "@/lib/editorial-citations";
import { alignEditorialVisualStory } from "@/lib/editorial-story-lineage";
import { openAIApiKeyStatus, openAICredentialMessage } from "./openai-config.ts";

const defaultContentWriterModel = "gpt-4.1-mini";
const defaultContentCriticModel = "gpt-4.1-mini";
const defaultResearchModel = "gpt-4.1-mini";

const researchFindingSchema = z.object({
  question: z.string().min(20).max(320),
  finding: z.string().min(60).max(1_200),
  sourceUrls: z.array(z.string().url().max(1_000)).min(1).max(5),
  confidence: z.enum(["high", "medium", "low"])
});

const technicalGuideStepSchema = z.object({
  step: z.string().min(10).max(180),
  action: z.string().min(40).max(800),
  rationale: z.string().min(40).max(700),
  validation: z.string().min(30).max(600),
  rollback: z.string().min(20).max(600),
  sourceUrls: z.array(z.string().url().max(1_000)).min(1).max(4)
});

const researchDossierSchema = z.object({
  problemDefinition: z.string().min(80).max(1_200),
  audienceDecision: z.string().min(60).max(800),
  searchQueries: z.array(z.string().min(8).max(240)).min(3).max(8),
  findings: z.array(researchFindingSchema).min(4).max(8),
  practicalSolution: z.string().min(100).max(1_600),
  technicalGuide: z.array(technicalGuideStepSchema).min(5).max(10),
  disagreementsAndUnknowns: z.array(z.string().min(20).max(500)).max(8),
  escalationCriteria: z.array(z.string().min(20).max(500)).min(2).max(8)
});

export type EditorialResearchDossier = z.infer<typeof researchDossierSchema>;

export type EditorialResearchCoverage = {
  liveWebResearch: boolean;
  webQueries: number;
  researchQuestions: number;
  evidenceSources: number;
  citedSections: number;
  sectionCount: number;
  technicalSteps: number;
  unknownsRecorded: number;
};

const storySpineSchema = z.object({
  primarySubject: z.string().min(20).max(240),
  trigger: z.string().min(20).max(500),
  mechanism: z.string().min(20).max(700),
  consequence: z.string().min(20).max(500),
  operatorDecision: z.string().min(20).max(500),
  verification: z.string().min(20).max(500),
  secondaryContext: z.array(z.string().min(10).max(240)).max(4),
  visualSequence: z.tuple([
    z.string().min(12).max(300),
    z.string().min(12).max(300),
    z.string().min(12).max(300)
  ])
});

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
  evidenceChecklist: z.array(z.string().min(20).max(500)).min(4).max(10),
  storySpine: storySpineSchema
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
  storySpine: storySpineSchema,
  sections: z.array(sectionSchema).min(6).max(8),
  checklist: z.array(z.string().min(15).max(400)).min(8).max(14),
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
  rationale: z.string().min(10).max(1_600),
  correctionPrompt: z.string().max(1_600)
});

type ContentQa = z.infer<typeof contentQaSchema>;
export type AdvisoryEditorialContent = z.infer<typeof advisoryContentSchema>;

type EditorialAgentTrace = {
  provider: "openai-direct";
  contentPolicyVersion: 3;
  writerModel: string;
  criticModel: string;
  attempts: number;
  generatedAt: string;
  evidence: Array<{ label: string; url: string; fetched: boolean; characters: number }>;
  qa: ContentQa;
  storySpine: z.infer<typeof storySpineSchema>;
  research?: {
    dossier: EditorialResearchDossier;
    coverage: EditorialResearchCoverage;
  };
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
  mode?: "strict" | "draft";
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
    criticModel: env("EDITORIAL_CONTENT_CRITIC_MODEL") || defaultContentCriticModel,
    researchModel: env("EDITORIAL_RESEARCH_MODEL") || defaultResearchModel
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

const storySpineJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "primarySubject",
    "trigger",
    "mechanism",
    "consequence",
    "operatorDecision",
    "verification",
    "secondaryContext",
    "visualSequence"
  ],
  properties: {
    primarySubject: { type: "string", minLength: 20, maxLength: 240 },
    trigger: { type: "string", minLength: 20, maxLength: 500 },
    mechanism: { type: "string", minLength: 20, maxLength: 700 },
    consequence: { type: "string", minLength: 20, maxLength: 500 },
    operatorDecision: { type: "string", minLength: 20, maxLength: 500 },
    verification: { type: "string", minLength: 20, maxLength: 500 },
    secondaryContext: { type: "array", maxItems: 4, items: { type: "string", minLength: 10, maxLength: 240 } },
    visualSequence: {
      type: "array",
      minItems: 3,
      maxItems: 3,
      items: { type: "string", minLength: 12, maxLength: 300 }
    }
  }
};

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
    "evidenceChecklist",
    "storySpine"
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
    evidenceChecklist: { type: "array", minItems: 4, maxItems: 10, items: { type: "string", minLength: 20, maxLength: 500 } },
    storySpine: storySpineJsonSchema
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
    "storySpine",
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
    storySpine: storySpineJsonSchema,
    sections: { type: "array", minItems: 6, maxItems: 8, items: sectionJsonSchema },
    checklist: { type: "array", minItems: 8, maxItems: 14, items: { type: "string", minLength: 15, maxLength: 400 } },
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
    rationale: { type: "string", minLength: 10, maxLength: 1_600 },
    correctionPrompt: { type: "string", maxLength: 1_600 }
  }
};

const researchFindingJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["question", "finding", "sourceUrls", "confidence"],
  properties: {
    question: { type: "string", minLength: 20, maxLength: 320 },
    finding: { type: "string", minLength: 60, maxLength: 1_200 },
    sourceUrls: { type: "array", minItems: 1, maxItems: 5, items: { type: "string", maxLength: 1_000 } },
    confidence: { type: "string", enum: ["high", "medium", "low"] }
  }
};

const technicalGuideStepJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["step", "action", "rationale", "validation", "rollback", "sourceUrls"],
  properties: {
    step: { type: "string", minLength: 10, maxLength: 180 },
    action: { type: "string", minLength: 40, maxLength: 800 },
    rationale: { type: "string", minLength: 40, maxLength: 700 },
    validation: { type: "string", minLength: 30, maxLength: 600 },
    rollback: { type: "string", minLength: 20, maxLength: 600 },
    sourceUrls: { type: "array", minItems: 1, maxItems: 4, items: { type: "string", maxLength: 1_000 } }
  }
};

const researchDossierJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "problemDefinition",
    "audienceDecision",
    "searchQueries",
    "findings",
    "practicalSolution",
    "technicalGuide",
    "disagreementsAndUnknowns",
    "escalationCriteria"
  ],
  properties: {
    problemDefinition: { type: "string", minLength: 80, maxLength: 1_200 },
    audienceDecision: { type: "string", minLength: 60, maxLength: 800 },
    searchQueries: { type: "array", minItems: 3, maxItems: 8, items: { type: "string", minLength: 8, maxLength: 240 } },
    findings: { type: "array", minItems: 4, maxItems: 8, items: researchFindingJsonSchema },
    practicalSolution: { type: "string", minLength: 100, maxLength: 1_600 },
    technicalGuide: { type: "array", minItems: 5, maxItems: 10, items: technicalGuideStepJsonSchema },
    disagreementsAndUnknowns: { type: "array", maxItems: 8, items: { type: "string", minLength: 20, maxLength: 500 } },
    escalationCriteria: { type: "array", minItems: 2, maxItems: 8, items: { type: "string", minLength: 20, maxLength: 500 } }
  }
};

function webSearchActivity(response: { output: unknown[] }) {
  const urls = new Set<string>();
  const queries = new Set<string>();
  let searchCalls = 0;
  for (const item of response.output) {
    if (!item || typeof item !== "object" || !("type" in item) || item.type !== "web_search_call") continue;
    if (!("action" in item) || !item.action || typeof item.action !== "object") continue;
    const action = item.action as { type?: unknown; query?: unknown; queries?: unknown[]; url?: unknown; sources?: Array<{ url?: unknown }> };
    if (action.type === "search") searchCalls += 1;
    if (typeof action.query === "string") queries.add(action.query);
    for (const query of action.queries || []) {
      if (typeof query === "string") queries.add(query);
    }
    if (typeof action.url === "string") urls.add(action.url);
    for (const source of action.sources || []) {
      if (typeof source.url === "string") urls.add(source.url);
    }
  }
  return { queries: [...queries], urls: [...urls].filter(isTrustedEditorialUrl), searchCalls };
}

function isExternalEditorialUrl(url: string) {
  try {
    const host = new URL(url).hostname.toLowerCase().replace(/^www\./, "");
    return host !== "qcsstudio.com" && !host.endsWith(".qcsstudio.com");
  } catch {
    return false;
  }
}

function restrictDossierSources(dossier: EditorialResearchDossier, allowedUrls: Set<string>) {
  const canonical = (value: string) => {
    try {
      const url = new URL(value);
      url.hash = "";
      url.pathname = url.pathname.replace(/\/$/, "") || "/";
      return url.toString();
    } catch {
      return "";
    }
  };
  const exactUrl = new Map([...allowedUrls].map((url) => [canonical(url), url]));
  const approvedUrls = (urls: string[]) =>
    [...new Set(urls.map((url) => exactUrl.get(canonical(url))).filter((url): url is string => Boolean(url)))].slice(0, 4);
  return {
    ...dossier,
    findings: dossier.findings
      .map((finding) => ({ ...finding, sourceUrls: approvedUrls(finding.sourceUrls) }))
      .filter((finding) => finding.sourceUrls.length),
    technicalGuide: dossier.technicalGuide.map((step) => ({ ...step, sourceUrls: approvedUrls(step.sourceUrls) }))
  };
}

function researchScoutAngles(input: BlogEditorialInput) {
  const topic = input.topic.replace(/\s+/g, " ").trim();
  return [
    {
      label: "current scope and authoritative context",
      query: `${topic} official advisory current scope affected products`
    },
    {
      label: "technical mechanism and evidence",
      query: `${topic} technical mechanism detection evidence official documentation`
    },
    {
      label: "implementation, validation, and recovery",
      query: `${topic} remediation implementation validation rollback official guidance`
    }
  ];
}

async function runResearchScout(
  client: OpenAI,
  input: BlogEditorialInput,
  angle: { label: string; query: string },
  model: string,
  suppliedUrls: string[]
) {
  const response = await client.responses.create({
    model,
    store: false,
    include: ["web_search_call.action.sources"],
    tools: [
      {
        type: "web_search",
        search_context_size: "medium"
      }
    ],
    tool_choice: "required",
    reasoning: usesReasoningControls(model) ? { effort: "low" } : undefined,
    instructions: [
      "You are a QCS technical research scout. Complete one focused live-web research pass for the assigned angle.",
      "Use official vendor, government, cloud-provider, standards-body, or operator-authority evidence only.",
      "Return a concise research memo that separates source facts, operational interpretation, unknowns, and safe validation guidance.",
      "Do not invent commands, versions, exploit status, metrics, or product behavior."
    ].join(" "),
    input: [
      `ARTICLE TOPIC: ${input.topic}`,
      `ASSIGNED RESEARCH ANGLE: ${angle.label}`,
      `SEARCH QUERY: ${angle.query}`,
      `STARTING PRIMARY SOURCES:\n${suppliedUrls.join("\n")}`
    ].join("\n\n"),
    max_output_tokens: 1_200
  });
  if (response.status === "incomplete") {
    throw new Error(`Research scout ${angle.label} was incomplete: ${response.incomplete_details?.reason || "unknown reason"}.`);
  }
  const activity = webSearchActivity(response);
  if (activity.searchCalls < 1) throw new Error(`Research scout ${angle.label} did not execute a live web search.`);
  return {
    angle: angle.label,
    note: response.output_text.trim(),
    queries: [...new Set([angle.query, ...activity.queries])],
    urls: activity.urls
  };
}

export async function researchBlogTopic(input: BlogEditorialInput) {
  const config = editorialContentAgentConfiguration();
  const suppliedUrls = input.sources.map((source) => source.url).filter(isTrustedEditorialUrl);
  const startedAt = Date.now();
  console.info("QCS editorial agent started.", { stage: "blog-research", model: config.researchModel });
  try {
    const client = openAIClient();
    const scouts = await Promise.all(
      researchScoutAngles(input).map((angle) => runResearchScout(client, input, angle, config.researchModel, suppliedUrls))
    );
    const searchQueries = [...new Set(scouts.flatMap((scout) => scout.queries))];
    const discoveredUrls = [...new Set(scouts.flatMap((scout) => scout.urls))];
    if (searchQueries.length < 3) throw new Error("The live research scouts did not complete three distinct research queries.");
    const allowedUrls = new Set([...suppliedUrls, ...discoveredUrls]);
    if ([...allowedUrls].filter(isExternalEditorialUrl).length < 3) {
      throw new Error("The live research scouts did not find three approved evidence sources.");
    }

    const response = await client.responses.create({
      model: config.researchModel,
      store: false,
      reasoning: usesReasoningControls(config.researchModel) ? { effort: "low" } : undefined,
      instructions: [
        "You are the QCS Technical Research Analyst. Synthesize the three completed live-web scout reports into one evidence-led operational dossier.",
        "Use only the exact approved source URLs supplied with the reports. Do not add, alter, shorten, or infer a URL.",
        "Do not summarize headlines. Establish the current trigger, technical mechanism, affected operational decision, implementation options, validation evidence, rollback or recovery path, limitations, disagreements, and escalation conditions.",
        "Use multiple independent research angles and prefer the most direct primary source for each claim. If sources conflict or do not answer a question, record that explicitly instead of guessing.",
        "Every factual finding and evidence-dependent guide step must contain the exact supporting source URLs. Practical recommendations must be safe, reversible, scoped, and distinguish vendor guidance from QCS analysis.",
        "The technical guide must be useful to a working network or security operator: define prerequisites, action, rationale, validation, and rollback for each step. Never invent commands, versions, metrics, or product behavior.",
        "Keep the dossier concise and decision-focused: return four to six findings and five to seven technical-guide steps, using compact paragraphs instead of exhausting field limits.",
        "Return the required JSON only."
      ].join(" "),
      input: [
        `TOPIC: ${input.topic}`,
        `BUSINESS AND OPERATIONAL ANGLE: ${input.businessAngle}`,
        `SEARCH INTENT: ${input.keywordCluster.join(", ")}`,
        `COMPLETED SEARCH QUERIES:\n${searchQueries.join("\n")}`,
        `APPROVED SOURCE URLS:\n${[...allowedUrls].join("\n")}`,
        `SCOUT REPORTS:\n${scouts.map((scout, index) => `REPORT ${index + 1} - ${scout.angle}\nSOURCE URLS:\n${scout.urls.join("\n")}\nMEMO:\n${scout.note}`).join("\n\n")}`
      ].join("\n\n"),
      max_output_tokens: 6_000,
      text: {
        ...(usesReasoningControls(config.researchModel) ? { verbosity: "medium" as const } : {}),
        format: { type: "json_schema", name: "qcs_editorial_research_dossier", strict: true, schema: researchDossierJsonSchema }
      }
    });
    if (response.status === "incomplete") {
      throw new Error(`The live research response was incomplete: ${response.incomplete_details?.reason || "unknown reason"}.`);
    }
    const dossier = parseStructured(response.output_text, researchDossierSchema, "QCS Technical Research Analyst");
    const restricted = researchDossierSchema.parse(restrictDossierSources(dossier, allowedUrls));
    if (restricted.findings.length < 4) throw new Error("The live research pass did not return four source-backed findings.");
    console.info("QCS editorial agent completed.", {
      stage: "blog-research",
      model: config.researchModel,
      durationMs: Date.now() - startedAt,
      findings: restricted.findings.length,
      sources: allowedUrls.size
    });
    return {
      dossier: restricted,
      discoveredSources: discoveredUrls
        .filter((url) => !suppliedUrls.includes(url))
        .slice(0, 8)
        .map((url) => ({ label: new URL(url).hostname.replace(/^www\./, ""), url })),
      webQueries: searchQueries.length,
      liveWebResearch: true
    };
  } catch (error) {
    console.error("QCS live editorial research failed.", error);
    return { dossier: null, discoveredSources: [] as EditorialEvidenceSource[], webQueries: 0, liveWebResearch: false };
  }
}

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
      "Reject a draft when its headline, central thesis, or operational recommendations force a relationship that the supplied evidence does not establish. Adjacent vendor advisories are not evidence of a shared cause, attack path, or control failure.",
      "Require one locked story chronology: primary subject, source-confirmed trigger, supported mechanism, operational consequence, operator decision, and closure evidence. Reject a draft or visual brief that promotes secondary context into a competing headline story.",
      "For blogs, verify that sourceUrls point only to supplied evidence and are attached to the sections or answers whose claims they support. A source list alone is not traceability.",
      "Reject generic filler, repetitive template language, unexplained jargon, sensational phrasing, copied source wording, weak search intent, and content that would not help a real operator make a decision.",
      "For blogs, require a direct answer, a clear reader outcome, defined entities, useful headings, evidence-led reasoning, implementation and validation guidance, realistic limitations, and FAQs that resolve genuine follow-up questions.",
      "Plain-language passages should be understandable to an IT decision maker; technical passages must remain precise for engineers.",
      editorialReadingQualityInstruction,
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
      "Build one advisory storySpine in this exact order: affected product or trust boundary; disclosure or exploitation trigger; source-confirmed technical mechanism; operational consequence; required remediation decision; evidence that proves closure. Put unrelated context only in secondaryContext and never turn it into the visual subject.",
      editorialReadingQualityInstruction,
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
          contentPolicyVersion: 3,
          writerModel: editorialContentAgentConfiguration().writerModel,
          criticModel: editorialContentAgentConfiguration().criticModel,
          attempts: attempt,
          generatedAt: new Date().toISOString(),
          evidence: evidence.map((item) => ({ label: item.label, url: item.url, fetched: item.fetched, characters: item.text.length })),
          qa: latestQa,
          storySpine: latestContent.storySpine
        } satisfies EditorialAgentTrace
      };
    }
    correction = latestQa.correctionPrompt || contentQaDeficits(latestQa).join("; ");
  }
  throw new Error(`Advisory editorial QA rejected the content: ${latestQa?.rationale || "unknown reason"}`);
}

async function writeBlog(input: BlogEditorialInput, evidence: string, dossier: EditorialResearchDossier | null, correction = "") {
  const config = editorialContentAgentConfiguration();
  const startedAt = Date.now();
  console.info("QCS editorial agent started.", { stage: "blog-writer", model: config.writerModel });
  const response = await openAIClient().responses.create({
    model: config.writerModel,
    store: false,
    reasoning: usesReasoningControls(config.writerModel) ? { effort: "low" } : undefined,
    instructions: [
      "You are the QCS Research Editor, a senior network engineer, cybersecurity writer, SEO strategist, and educator.",
      "Create an original, authoritative article from the supplied research dossier and primary-source evidence. Search demand may shape the question, but never treat a trend or headline as technical evidence.",
      "Treat the evidence as the boundary of the article. If the editorial topic or business angle is not supported by that evidence, reframe the title and article around what the sources actually establish instead of forcing a connection. Never imply that separate advisories share a technical cause or affect routing, cloud, or security controls unless a supplied source says so.",
      "Answer the reader's real question immediately, explain terminology in plain English, then provide technically precise reasoning, examples, evidence, decisions, safeguards, and practical next steps.",
      "Build the article for human readers and answer engines: state a self-contained direct answer first; define important entities; organize the body around the reader's decision; distinguish evidence, interpretation, and recommendation; include implementation, validation, limitations, and escalation guidance where relevant.",
      "Make the article solve the researched problem. It must explain the problem and mechanism, show the evidence, compare viable response choices, provide a safe implementation sequence, state validation and rollback steps, identify limitations and unknowns, and end with a technical takeaway an operator can apply.",
      "Use six to eight decision-focused sections. Their headings must make these purposes immediately visible: problem and scope; technical mechanism and evidence; solution choices; implementation or step-by-step guide; validation and success criteria; and limitations, rollback or recovery, and escalation.",
      "Before writing sections, lock one storySpine in this order: primary subject; source-supported trigger; technical mechanism; operational consequence; operator decision; verification evidence. Every headline, section, visual anchor, and recommendation must serve that same story. Place adjacent but non-causal topics only in secondaryContext and keep them out of the title and focal visual.",
      "Copy source URLs exactly from the supplied evidence. Use sourceUrls on every section and FAQ answer with evidence-dependent claims; use an empty array only for clearly labeled QCS analysis or practical advice that does not depend on an external fact. At least one section must carry a primary-source citation.",
      "The description, excerpt, direct answer, section headings, section bodies, and section bullets must contain at least 1,100 useful words by themselves. Checklists, definitions, takeaways, and FAQs do not count toward that minimum. Keep the complete article near 1,500 to 2,100 words, with six to eight focused sections and four to six genuine FAQs.",
      "The checklist is the compact technical takeaway. Include prerequisites and scope, evidence capture, the controlled action sequence, explicit validation, exception handling, explicit rollback or recovery, ownership, and the next review point.",
      "Create a topic-specific visualBrief from the locked storySpine. Its factualAnchors must be supported by the article; its scene must follow the three visualSequence frames establish, explain, and resolve; and its avoid list must block secondary topics, likely visual misinterpretations, and generic cyber imagery.",
      "Do not produce a vendor-news rewrite, generic checklist template, sales pitch, or repetitive QCS boilerplate. Do not invent versions, statistics, commands, exploit claims, outcomes, or quotations.",
      editorialReadingQualityInstruction,
      "Use short paragraphs, meaningful headings, active voice, and natural language suitable for informed readers worldwide and in India. Paraphrase sources and return JSON only."
    ].join(" "),
    input: [
      `EDITORIAL BRIEF:\n${JSON.stringify({ topic: input.topic, businessAngle: input.businessAngle, keywordCluster: input.keywordCluster })}`,
      dossier ? `RESEARCH DOSSIER:\n${JSON.stringify(dossier)}` : "RESEARCH DOSSIER: Live-web research was unavailable. Do not fill gaps by inference; keep unsupported points explicit and limited.",
      `PRIMARY-SOURCE EVIDENCE:\n${evidence}`,
      correction ? `MANDATORY EDITORIAL CORRECTION:\n${correction}` : ""
    ]
      .filter(Boolean)
      .join("\n\n"),
    max_output_tokens: 5_200,
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
  const sourceUrls = (values: string[], claim: string) => mapClaimSourceUrls(values, claim, evidence);
  const alignedVisualStory = alignEditorialVisualStory(draft.storySpine, draft.visualBrief);

  return {
    contentVersion: 3,
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
    visualBrief: alignedVisualStory.visualBrief,
    storySpine: alignedVisualStory.storySpine,
    relatedTools: (tools.length ? tools : ["/network-tools"]).slice(0, 4).map((href) => ({ label: labelFromPath(href), href })),
    relatedServices: (services.length ? services : ["/services/managed-network-services"])
      .slice(0, 4)
      .map((href) => ({ label: labelFromPath(href), href })),
    takeaways: draft.takeaways,
    sections: draft.sections.map((section) => ({
      ...section,
      sourceUrls: sourceUrls(section.sourceUrls, [section.heading, section.body, ...(section.bullets || [])].join(" "))
    })),
    checklist: draft.checklist,
    questions: draft.questions.map((question) => ({
      ...question,
      sourceUrls: sourceUrls(question.sourceUrls, `${question.question} ${question.answer}`)
    })),
    sources: evidence.map((source) => ({ label: source.label, url: source.url }))
  } satisfies BlogPost;
}

export async function createResearchedBlog(input: BlogEditorialInput) {
  const research = await researchBlogTopic(input);
  const evidenceSources = [...input.sources, ...research.discoveredSources];
  const evidence = await collectEditorialEvidence(evidenceSources, 8);
  const usable = evidence.filter((source) => source.text.length >= 120);
  if (!usable.length) throw new Error("No usable primary-source evidence was available for this article.");
  const brief = evidenceBrief(usable);
  let correction = "";
  let latestQa: ContentQa | null = null;
  let latestContent: BlogPost | null = null;
  let latestReadinessIssues: string[] = [];

  for (let attempt = 1; attempt <= 2; attempt += 1) {
    const written = await writeBlog(input, brief, research.dossier, correction);
    const content = buildBlogPost(input, written, usable);
    latestContent = content;
    latestReadinessIssues = evaluateEditorialReadiness(content).issues;
    if (latestReadinessIssues.length) {
      console.info("QCS deterministic editorial checks rejected the draft.", { attempt, issues: latestReadinessIssues });
      correction = [
        "The previous draft failed mandatory publication checks. Resolve every item:",
        ...latestReadinessIssues.map((issue) => `- ${issue}`),
        "Use exact URLs copied from PRIMARY-SOURCE EVIDENCE for claim-level sourceUrls. The core useful-word total excludes checklists, definitions, takeaways, and FAQs."
      ].join("\n");
      continue;
    }
    latestQa = await inspectContent("blog", brief, content);
    console.info("QCS editorial QA result.", { kind: "blog", attempt, qa: latestQa });
    if (contentQaPasses(latestQa)) {
      const coverage: EditorialResearchCoverage = {
        liveWebResearch: research.liveWebResearch,
        webQueries: research.webQueries,
        researchQuestions: research.dossier?.findings.length || 0,
        evidenceSources: usable.filter((source) => isExternalEditorialUrl(source.url)).length,
        citedSections: content.sections.filter((section) => section.sourceUrls?.length).length,
        sectionCount: content.sections.length,
        technicalSteps: research.dossier?.technicalGuide.length || 0,
        unknownsRecorded: research.dossier?.disagreementsAndUnknowns.length || 0
      };
      return {
        content,
        qualityScore: qualityScore(latestQa),
        trace: {
          provider: "openai-direct",
          contentPolicyVersion: 3,
          writerModel: editorialContentAgentConfiguration().writerModel,
          criticModel: editorialContentAgentConfiguration().criticModel,
          attempts: attempt,
          generatedAt: new Date().toISOString(),
          evidence: usable.map((item) => ({ label: item.label, url: item.url, fetched: item.fetched, characters: item.text.length })),
          qa: latestQa,
          storySpine: content.storySpine!,
          research: research.dossier ? { dossier: research.dossier, coverage } : undefined
        } satisfies EditorialAgentTrace
      };
    }
    correction = latestQa.correctionPrompt || contentQaDeficits(latestQa).join("; ");
  }
  if (input.mode === "draft" && latestContent) {
    const heldQa: ContentQa = latestQa || {
      approved: false,
      factualGroundingScore: 0,
      evidenceTraceabilityScore: 0,
      authorityScore: 0,
      clarityScore: 0,
      structureScore: 0,
      usefulnessScore: 0,
      searchAnswerScore: 0,
      violations: latestReadinessIssues.slice(0, 12),
      rationale: "The researched article was saved as a draft because mandatory editorial checks still require review.",
      correctionPrompt: latestReadinessIssues.join(" ").slice(0, 1_600)
    };
    const coverage: EditorialResearchCoverage = {
      liveWebResearch: research.liveWebResearch,
      webQueries: research.webQueries,
      researchQuestions: research.dossier?.findings.length || 0,
      evidenceSources: usable.filter((source) => isExternalEditorialUrl(source.url)).length,
      citedSections: latestContent.sections.filter((section) => section.sourceUrls?.length).length,
      sectionCount: latestContent.sections.length,
      technicalSteps: research.dossier?.technicalGuide.length || 0,
      unknownsRecorded: research.dossier?.disagreementsAndUnknowns.length || 0
    };
    return {
      content: latestContent,
      qualityScore: Math.min(83, qualityScore(heldQa)),
      trace: {
        provider: "openai-direct",
        contentPolicyVersion: 3,
        writerModel: editorialContentAgentConfiguration().writerModel,
        criticModel: editorialContentAgentConfiguration().criticModel,
        attempts: 2,
        generatedAt: new Date().toISOString(),
        evidence: usable.map((item) => ({ label: item.label, url: item.url, fetched: item.fetched, characters: item.text.length })),
        qa: heldQa,
        storySpine: latestContent.storySpine!,
        research: research.dossier ? { dossier: research.dossier, coverage } : undefined
      } satisfies EditorialAgentTrace
    };
  }
  throw new Error(
    latestReadinessIssues.length
      ? `Blog generation did not satisfy the publication policy: ${latestReadinessIssues.join(" ")}`
      : `Blog editorial QA rejected the content: ${latestQa?.rationale || "unknown reason"}. Deficits: ${latestQa ? contentQaDeficits(latestQa).join(" ") : "unknown"}`
  );
}
