import OpenAI from "openai";
import { z } from "zod";
import {
  advisoryLinkedInQualityIssues,
  editorialLinkedInQualityIssues,
  formatAgentLinkedInCommentary,
  type LinkedInAdvisoryPost,
  type LinkedInEditorialPost
} from "@/lib/linkedin-commentary";
import { openAIApiKeyStatus, openAICredentialMessage } from "@/lib/openai-config";

const defaultWriterModel = "gpt-4.1-mini";
const defaultCriticModel = "gpt-4.1-mini";

const linkedInDraftSchema = z.object({
  commentary: z.string().min(650).max(2_700),
  audience: z.string().min(15).max(180),
  pointOfView: z.string().min(30).max(400),
  factsUsed: z.array(z.string().min(10).max(320)).min(3).max(12),
  actions: z.array(z.string().min(20).max(300)).min(3).max(4),
  hashtags: z.array(z.string().regex(/^#[A-Za-z0-9]+$/)).min(3).max(5)
});

const linkedInQaSchema = z.object({
  approved: z.boolean(),
  factualFidelityScore: z.number().int().min(0).max(100),
  inferenceDisciplineScore: z.number().int().min(0).max(100),
  specificityScore: z.number().int().min(0).max(100),
  practitionerValueScore: z.number().int().min(0).max(100),
  clarityScore: z.number().int().min(0).max(100),
  platformFitScore: z.number().int().min(0).max(100),
  violations: z.array(z.string().min(2).max(360)).max(12),
  rationale: z.string().min(20).max(1_000),
  correctionPrompt: z.string().max(1_600)
});

type LinkedInQa = z.infer<typeof linkedInQaSchema>;
type LinkedInDraft = z.infer<typeof linkedInDraftSchema>;

type LinkedInAgentTrace = {
  provider: "openai-direct";
  policyVersion: 3;
  writerModel: string;
  criticModel: string;
  attempts: number;
  generatedAt: string;
  audience: string;
  pointOfView: string;
  factsUsed: string[];
  actions: string[];
  qa: LinkedInQa;
};

type LinkedInResult = {
  commentary: string;
  qualityScore: number;
  trace: LinkedInAgentTrace;
};

type LinkedInAgentInput =
  | { kind: "editorial"; post: LinkedInEditorialPost; url: string }
  | { kind: "advisory"; advisory: LinkedInAdvisoryPost; url: string };

const draftJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["commentary", "audience", "pointOfView", "factsUsed", "actions", "hashtags"],
  properties: {
    commentary: { type: "string", minLength: 650, maxLength: 2_700 },
    audience: { type: "string", minLength: 15, maxLength: 180 },
    pointOfView: { type: "string", minLength: 30, maxLength: 400 },
    factsUsed: { type: "array", minItems: 3, maxItems: 12, items: { type: "string", minLength: 10, maxLength: 320 } },
    actions: { type: "array", minItems: 3, maxItems: 4, items: { type: "string", minLength: 20, maxLength: 300 } },
    hashtags: { type: "array", minItems: 3, maxItems: 5, items: { type: "string", pattern: "^#[A-Za-z0-9]+$" } }
  }
};

const qaJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "approved",
    "factualFidelityScore",
    "inferenceDisciplineScore",
    "specificityScore",
    "practitionerValueScore",
    "clarityScore",
    "platformFitScore",
    "violations",
    "rationale",
    "correctionPrompt"
  ],
  properties: {
    approved: { type: "boolean" },
    factualFidelityScore: { type: "integer", minimum: 0, maximum: 100 },
    inferenceDisciplineScore: { type: "integer", minimum: 0, maximum: 100 },
    specificityScore: { type: "integer", minimum: 0, maximum: 100 },
    practitionerValueScore: { type: "integer", minimum: 0, maximum: 100 },
    clarityScore: { type: "integer", minimum: 0, maximum: 100 },
    platformFitScore: { type: "integer", minimum: 0, maximum: 100 },
    violations: { type: "array", maxItems: 12, items: { type: "string", minLength: 2, maxLength: 360 } },
    rationale: { type: "string", minLength: 20, maxLength: 1_000 },
    correctionPrompt: { type: "string", maxLength: 1_600 }
  }
};

function env(name: string) {
  return process.env[name]?.trim() || "";
}

function usesReasoningControls(model: string) {
  return model.startsWith("gpt-5");
}

export function linkedInContentAgentConfiguration() {
  const credential = openAIApiKeyStatus();
  return {
    configured: credential.configured,
    credentialIssue: credential.credentialIssue,
    provider: "OpenAI direct API",
    writerModel: env("LINKEDIN_CONTENT_WRITER_MODEL") || defaultWriterModel,
    criticModel: env("LINKEDIN_CONTENT_CRITIC_MODEL") || defaultCriticModel
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
    timeout: 90_000
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

function compact(value: string | undefined, limit = 1_000) {
  const normalized = (value || "").replace(/\s+/g, " ").trim();
  if (normalized.length <= limit) return normalized;
  return normalized.slice(0, limit + 1).replace(/\s+\S*$/, "").replace(/[,:;\s]+$/, "");
}

function editorialEvidence(post: LinkedInEditorialPost) {
  return {
    title: post.title,
    category: post.content.category || "",
    audience: post.content.audience || "Network and security decision makers",
    primaryKeyword: post.content.primaryKeyword || "",
    answer: compact(post.content.answer, 600),
    readerOutcome: compact(post.content.readerOutcome, 360),
    excerpt: compact(post.content.excerpt, 400),
    takeaways: (post.content.takeaways || []).slice(0, 6).map((item) => compact(item, 360)),
    checklist: (post.content.checklist || []).slice(0, 8).map((item) => compact(item, 320)),
    sections: (post.content.sections || []).slice(0, 7).map((section) => ({
      heading: section.heading,
      body: compact(section.body, 700),
      bullets: (section.bullets || []).slice(0, 5).map((item) => compact(item, 300))
    })),
    sources: (post.content.sources || []).slice(0, 6)
  };
}

function advisoryEvidence(advisory: LinkedInAdvisoryPost) {
  return {
    title: advisory.title,
    vendor: advisory.vendor,
    cves: advisory.cves,
    severity: advisory.severity,
    cvssScore: advisory.cvssScore ?? null,
    products: advisory.products,
    affectedVersions: advisory.affectedVersions || [],
    fixedVersions: advisory.fixedVersions || [],
    exploitationStatus: advisory.exploitationStatus || "Official source does not state an exploitation status.",
    summary: advisory.summary,
    technicalExplanation: advisory.technicalExplanation || "",
    businessImpact: advisory.businessImpact || "",
    remediation: advisory.remediation,
    workaround: advisory.workaround || "",
    evidenceChecklist: advisory.evidenceChecklist || [],
    vendorSourceUrl: advisory.sourceUrl || ""
  };
}

function evidenceFor(input: LinkedInAgentInput) {
  return input.kind === "advisory" ? advisoryEvidence(input.advisory) : editorialEvidence(input.post);
}

function writerInstructions(kind: LinkedInAgentInput["kind"]) {
  const shared = [
    "You are the QCS LinkedIn Editor, a senior network and cybersecurity practitioner writing to peers and technology decision makers.",
    "Write a useful native LinkedIn post, not a synopsis, press release, SEO excerpt, incident ticket, or generic AI template.",
    "Choose one defensible point of view from the supplied evidence. Open with the operational consequence or decision tension in two short lines; do not merely repeat the title.",
    "Use only supplied facts. Preserve exact CVEs, product names, severity, CVSS, versions, exploitation status, fixes, workarounds, and source qualifications. Never upgrade possibility into confirmed exploitation.",
    "Explain why the evidence matters to a named audience and make every action concrete enough for a network or security team to perform and validate.",
    "Use natural professional language, active voice, short paragraphs, deliberate blank lines, and no paragraph longer than three sentences.",
    "Use at most three short Title Case section labels. Do not use emoji, fake Unicode bold or italics, excessive capitals, clickbait, promotional claims, or rhetorical filler.",
    "Do not truncate a sentence with ellipses. Avoid stock phrases such as in today's landscape, game changer, ever-evolving, a useful signal, QCS translated the signal, or could another engineer reproduce.",
    "Place the supplied QCS URL on its own near the end. Finish with three to five precise hashtags on one final line. Do not put hashtags in the opening.",
    "Return the required JSON only. The actions and hashtags arrays must exactly match the actions and final hashtag line used in commentary."
  ];
  if (kind === "advisory") {
    shared.push(
      "For an advisory, include exploitation status, vendor severity and CVSS as separate facts, affected scope, the technical trust or execution path, business consequence, every supplied fixed release, workaround status, exactly four distinct defender actions, and a closure-validation step.",
      "When a vendor source URL is supplied, place it on its own line as the official source in addition to the QCS technical brief.",
      "The result should read like a concise senior analyst briefing: evidence first, interpretation second, action third. Target 1,050 to 2,300 characters."
    );
  } else {
    shared.push(
      "For an article, contribute a clear practitioner perspective rather than restating every section. Use two or three source-supported specifics, one practical implication, and three distinct actions or decision checks.",
      "End with one thoughtful question only when it naturally invites peer experience. Target 800 to 1,700 characters."
    );
  }
  return shared.join(" ");
}

async function writePost(input: LinkedInAgentInput, correction = "") {
  const config = linkedInContentAgentConfiguration();
  const response = await openAIClient().responses.create({
    model: config.writerModel,
    store: false,
    reasoning: usesReasoningControls(config.writerModel) ? { effort: "low" } : undefined,
    instructions: writerInstructions(input.kind),
    input: [
      `CONTENT TYPE: ${input.kind}`,
      `APPROVED SOURCE MATERIAL:\n${JSON.stringify(evidenceFor(input))}`,
      `QCS URL: ${input.url}`,
      correction ? `MANDATORY CORRECTION:\n${correction}` : ""
    ]
      .filter(Boolean)
      .join("\n\n"),
    max_output_tokens: 2_400,
    text: {
      ...(usesReasoningControls(config.writerModel) ? { verbosity: "medium" as const } : {}),
      format: { type: "json_schema", name: "qcs_linkedin_post", strict: true, schema: draftJsonSchema }
    }
  });
  return parseStructured(response.output_text, linkedInDraftSchema, "QCS LinkedIn Editor");
}

function qaPasses(qa: LinkedInQa) {
  return (
    qa.approved &&
    qa.violations.length === 0 &&
    qa.factualFidelityScore >= 95 &&
    qa.inferenceDisciplineScore >= 95 &&
    qa.specificityScore >= 88 &&
    qa.practitionerValueScore >= 88 &&
    qa.clarityScore >= 88 &&
    qa.platformFitScore >= 86
  );
}

function qaDeficits(qa: LinkedInQa) {
  const issues = [...qa.violations];
  const thresholds: Array<[keyof LinkedInQa, number, string]> = [
    ["factualFidelityScore", 95, "factual fidelity"],
    ["inferenceDisciplineScore", 95, "inference discipline"],
    ["specificityScore", 88, "specificity"],
    ["practitionerValueScore", 88, "practitioner value"],
    ["clarityScore", 88, "clarity"],
    ["platformFitScore", 86, "LinkedIn presentation"]
  ];
  for (const [key, minimum, label] of thresholds) {
    const value = qa[key];
    if (typeof value === "number" && value < minimum) issues.push(`Raise ${label} from ${value} to at least ${minimum}.`);
  }
  if (!qa.approved) issues.push("The independent critic did not approve the post.");
  return [...new Set(issues)];
}

function qualityScore(qa: LinkedInQa) {
  return Math.round(
    (qa.factualFidelityScore +
      qa.inferenceDisciplineScore +
      qa.specificityScore +
      qa.practitionerValueScore +
      qa.clarityScore +
      qa.platformFitScore) /
      6
  );
}

async function inspectPost(input: LinkedInAgentInput, draft: LinkedInDraft) {
  const config = linkedInContentAgentConfiguration();
  const response = await openAIClient().responses.create({
    model: config.criticModel,
    store: false,
    reasoning: usesReasoningControls(config.criticModel) ? { effort: "low" } : undefined,
    instructions: [
      "You are the independent QCS LinkedIn QA Editor, combining senior network-security fact checking with B2B thought-leadership editing.",
      "Compare every claim with the approved source material. Reject invented causality, affected scope, exploitation, impact, commands, versions, fixes, workarounds, statistics, or urgency.",
      "Reject a post that merely fills headings, repeats the article title, paraphrases a summary without insight, uses generic actions, sounds promotional, or could be reused for a different vendor or topic by swapping nouns.",
      "Require a precise audience, a defensible practitioner point of view, concrete source-supported details, distinct actions, an honest qualification where evidence is incomplete, and a natural mobile-readable presentation.",
      "For advisories, verify exact CVEs, severity and CVSS separation, exploitation status, affected scope, all supplied fixed versions, workaround status, four actions, and closure validation.",
      "For articles, require an original interpretation that helps the reader understand a business challenge or opportunity and offers concrete guidance rather than a link teaser.",
      "Treat dense paragraphs, excessive labels, all-caps presentation, clipped sentences, fake styling, hashtag stuffing, or a weak opening as publication-blocking defects.",
      "Passing thresholds: factual fidelity 95, inference discipline 95, specificity 88, practitioner value 88, clarity 88, and platform fit 86. Return JSON only."
    ].join(" "),
    input: `CONTENT TYPE: ${input.kind}\n\nAPPROVED SOURCE MATERIAL:\n${JSON.stringify(evidenceFor(input))}\n\nPOST TO REVIEW:\n${draft.commentary}`,
    max_output_tokens: 1_600,
    text: {
      ...(usesReasoningControls(config.criticModel) ? { verbosity: "low" as const } : {}),
      format: { type: "json_schema", name: "qcs_linkedin_qa", strict: true, schema: qaJsonSchema }
    }
  });
  return parseStructured(response.output_text, linkedInQaSchema, "QCS LinkedIn QA Editor");
}

function deterministicIssues(input: LinkedInAgentInput, commentary: string) {
  return input.kind === "advisory"
    ? advisoryLinkedInQualityIssues(commentary, input.url, input.advisory)
    : editorialLinkedInQualityIssues(commentary, input.url, input.post);
}

async function createLinkedInPost(input: LinkedInAgentInput): Promise<LinkedInResult> {
  let correction = "";
  let latestQa: LinkedInQa | null = null;
  let latestDraft: LinkedInDraft | null = null;
  const config = linkedInContentAgentConfiguration();

  for (let attempt = 1; attempt <= 2; attempt += 1) {
    latestDraft = await writePost(input, correction);
    latestDraft = {
      ...latestDraft,
      commentary: formatAgentLinkedInCommentary({
        actions: latestDraft.actions,
        commentary: latestDraft.commentary,
        hashtags: latestDraft.hashtags,
        url: input.url
      })
    };
    const hardIssues = deterministicIssues(input, latestDraft.commentary);
    if (hardIssues.length) {
      correction = `The deterministic publication gate rejected the draft. Fix every item without losing supported facts: ${hardIssues.join(" ")}`;
      continue;
    }

    latestQa = await inspectPost(input, latestDraft);
    if (qaPasses(latestQa)) {
      return {
        commentary: latestDraft.commentary.trim(),
        qualityScore: qualityScore(latestQa),
        trace: {
          provider: "openai-direct",
          policyVersion: 3,
          writerModel: config.writerModel,
          criticModel: config.criticModel,
          attempts: attempt,
          generatedAt: new Date().toISOString(),
          audience: latestDraft.audience,
          pointOfView: latestDraft.pointOfView,
          factsUsed: latestDraft.factsUsed,
          actions: latestDraft.actions,
          qa: latestQa
        }
      };
    }
    correction = latestQa.correctionPrompt || qaDeficits(latestQa).join(" ");
  }

  const detail = latestQa ? `${latestQa.rationale} ${qaDeficits(latestQa).join(" ")}` : correction;
  throw new Error(`LinkedIn editorial QA held the post: ${detail || "the draft did not satisfy the publication contract."}`);
}

export function createEditorialLinkedInPost(post: LinkedInEditorialPost, url: string) {
  return createLinkedInPost({ kind: "editorial", post, url });
}

export function createAdvisoryLinkedInPost(advisory: LinkedInAdvisoryPost, url: string) {
  return createLinkedInPost({ kind: "advisory", advisory, url });
}
