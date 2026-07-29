import OpenAI from "openai";
import { z } from "zod";

export const defaultEditorialDirectorModel = "gpt-5.6-terra";
export const defaultEditorialImageModel = "gpt-image-2";
export const defaultEditorialCriticModel = "gpt-5.6-terra";

const visualDirectionSchema = z.object({
  storyThesis: z.string().min(20).max(500),
  sceneConcept: z.string().min(40).max(1_200),
  focalSubject: z.string().min(10).max(400),
  supportingElements: z.array(z.string().min(2).max(240)).min(1).max(8),
  environment: z.string().min(10).max(400),
  viewpoint: z.string().min(5).max(240),
  lighting: z.string().min(5).max(240),
  palette: z.array(z.string().min(2).max(80)).min(2).max(7),
  avoid: z.array(z.string().min(2).max(240)).min(3).max(12),
  diversitySignature: z.string().min(10).max(240),
  altText: z.string().min(20).max(240)
});

const visualQaSchema = z.object({
  approved: z.boolean(),
  relevanceScore: z.number().int().min(0).max(100),
  specificityScore: z.number().int().min(0).max(100),
  diversityScore: z.number().int().min(0).max(100),
  compositionScore: z.number().int().min(0).max(100),
  violations: z.array(z.string().min(2).max(300)).max(12),
  rationale: z.string().min(10).max(900),
  correctionPrompt: z.string().max(1_200)
});

export type VisualDirection = z.infer<typeof visualDirectionSchema>;
export type VisualQa = z.infer<typeof visualQaSchema>;

export type RecentVisualConcept = {
  contentId: string;
  diversitySignature: string;
  sceneConcept: string;
  title?: string;
};

export type EditorialAgentTrace = {
  provider: "openai-direct";
  qaPolicyVersion: 2;
  directorModel: string;
  imageModel: string;
  criticModel: string;
  direction: VisualDirection;
  qa: VisualQa;
  renderAttempts: number;
};

const editorialAgentTraceSchema = z.object({
  provider: z.literal("openai-direct"),
  qaPolicyVersion: z.literal(2),
  directorModel: z.string(),
  imageModel: z.string(),
  criticModel: z.string(),
  direction: visualDirectionSchema,
  qa: visualQaSchema,
  renderAttempts: z.number().int().min(1)
});

export class EditorialAgentError extends Error {
  trace?: Partial<EditorialAgentTrace>;

  constructor(message: string, trace?: Partial<EditorialAgentTrace>) {
    super(message);
    this.name = "EditorialAgentError";
    this.trace = trace;
  }
}

const visualDirectionJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "storyThesis",
    "sceneConcept",
    "focalSubject",
    "supportingElements",
    "environment",
    "viewpoint",
    "lighting",
    "palette",
    "avoid",
    "diversitySignature",
    "altText"
  ],
  properties: {
    storyThesis: { type: "string", minLength: 20, maxLength: 500 },
    sceneConcept: { type: "string", minLength: 40, maxLength: 1_200 },
    focalSubject: { type: "string", minLength: 10, maxLength: 400 },
    supportingElements: {
      type: "array",
      minItems: 1,
      maxItems: 8,
      items: { type: "string", minLength: 2, maxLength: 240 }
    },
    environment: { type: "string", minLength: 10, maxLength: 400 },
    viewpoint: { type: "string", minLength: 5, maxLength: 240 },
    lighting: { type: "string", minLength: 5, maxLength: 240 },
    palette: {
      type: "array",
      minItems: 2,
      maxItems: 7,
      items: { type: "string", minLength: 2, maxLength: 80 }
    },
    avoid: {
      type: "array",
      minItems: 3,
      maxItems: 12,
      items: { type: "string", minLength: 2, maxLength: 240 }
    },
    diversitySignature: { type: "string", minLength: 10, maxLength: 240 },
    altText: { type: "string", minLength: 20, maxLength: 240 }
  }
};

const visualQaJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "approved",
    "relevanceScore",
    "specificityScore",
    "diversityScore",
    "compositionScore",
    "violations",
    "rationale",
    "correctionPrompt"
  ],
  properties: {
    approved: { type: "boolean" },
    relevanceScore: { type: "integer", minimum: 0, maximum: 100 },
    specificityScore: { type: "integer", minimum: 0, maximum: 100 },
    diversityScore: { type: "integer", minimum: 0, maximum: 100 },
    compositionScore: { type: "integer", minimum: 0, maximum: 100 },
    violations: { type: "array", maxItems: 12, items: { type: "string", minLength: 2, maxLength: 300 } },
    rationale: { type: "string", minLength: 10, maxLength: 900 },
    correctionPrompt: { type: "string", maxLength: 1_200 }
  }
};

function env(name: string) {
  return process.env[name]?.trim() || "";
}

export function editorialAgentConfiguration() {
  return {
    configured: Boolean(env("OPENAI_API_KEY")),
    provider: "OpenAI direct API",
    directorModel: env("EDITORIAL_DIRECTOR_MODEL") || defaultEditorialDirectorModel,
    imageModel: env("EDITORIAL_IMAGE_MODEL") || defaultEditorialImageModel,
    criticModel: env("EDITORIAL_CRITIC_MODEL") || defaultEditorialCriticModel
  };
}

function openAIClient() {
  const apiKey = env("OPENAI_API_KEY");
  if (!apiKey) {
    throw new EditorialAgentError(
      "OPENAI_API_KEY is not configured. Add a direct OpenAI API key to Vercel before generating editorial images."
    );
  }
  return new OpenAI({
    apiKey,
    organization: env("OPENAI_ORGANIZATION") || undefined,
    project: env("OPENAI_PROJECT_ID") || undefined,
    maxRetries: 2,
    timeout: 240_000
  });
}

function parseStructuredOutput<T>(outputText: string, schema: z.ZodType<T>, agentName: string) {
  if (!outputText.trim()) throw new EditorialAgentError(`${agentName} returned no structured output.`);
  try {
    return schema.parse(JSON.parse(outputText));
  } catch (error) {
    throw new EditorialAgentError(`${agentName} returned invalid structured output: ${error instanceof Error ? error.message : "unknown error"}`);
  }
}

function recentConceptBrief(concepts: RecentVisualConcept[]) {
  if (!concepts.length) return "No earlier OpenAI-directed QCS concepts are stored yet. Establish an original composition.";
  return concepts
    .slice(0, 8)
    .map(
      (concept, index) =>
        `${index + 1}. ${concept.title ? `${concept.title}: ` : ""}${concept.sceneConcept} Diversity signature: ${concept.diversitySignature}.`
    )
    .join("\n");
}

async function directVisualDirection(editorialPrompt: string, recentConcepts: RecentVisualConcept[]) {
  const config = editorialAgentConfiguration();
  const response = await openAIClient().responses.create({
    model: config.directorModel,
    store: false,
    reasoning: { effort: "medium" },
    instructions: [
      "You are the QCS Visual Director, a senior editorial art director with deep network engineering and cybersecurity literacy.",
      "Translate the supplied article facts into one precise visual story. Do not use a category preset or generic cyber symbolism.",
      "The scene must be technically plausible, visibly different from recent QCS work, and understandable without embedded text.",
      "Describe only what the image producer should render. Never invent a vulnerability, product behavior, or factual claim absent from the brief.",
      "Return the required JSON only."
    ].join(" "),
    input: [
      editorialPrompt,
      "",
      "RECENT QCS VISUAL CONCEPTS TO AVOID REPEATING:",
      recentConceptBrief(recentConcepts),
      "",
      "Create a new art direction with a different focal object, spatial arrangement, viewpoint, and narrative mechanism."
    ].join("\n"),
    max_output_tokens: 2_400,
    text: {
      verbosity: "low",
      format: {
        type: "json_schema",
        name: "qcs_visual_direction",
        strict: true,
        schema: visualDirectionJsonSchema
      }
    }
  });
  return parseStructuredOutput(response.output_text, visualDirectionSchema, "QCS Visual Director");
}

export function buildImageRenderPrompt(editorialPrompt: string, direction: VisualDirection, correction = "") {
  return [
    editorialPrompt,
    "",
    "APPROVED ART DIRECTION:",
    `Story thesis: ${direction.storyThesis}`,
    `Scene: ${direction.sceneConcept}`,
    `Focal subject: ${direction.focalSubject}`,
    `Supporting elements: ${direction.supportingElements.join("; ")}`,
    `Environment: ${direction.environment}`,
    `Viewpoint and composition: ${direction.viewpoint}`,
    `Lighting: ${direction.lighting}`,
    `Palette: ${direction.palette.join(", ")}`,
    `Explicitly avoid: ${direction.avoid.join("; ")}`,
    correction ? `MANDATORY QA CORRECTION: ${correction}` : "",
    "Render a finished editorial image, not a design mockup or annotated diagram. Include no visible words, letters, numbers, logos, labels, captions, borders, or watermarks."
  ]
    .filter(Boolean)
    .join("\n");
}

function imageQuality(): "low" | "medium" | "high" | "auto" {
  const value = env("EDITORIAL_IMAGE_QUALITY").toLowerCase();
  return value === "low" || value === "medium" || value === "auto" ? value : "high";
}

async function produceImage(editorialPrompt: string, direction: VisualDirection, correction = "") {
  const config = editorialAgentConfiguration();
  const result = await openAIClient().images.generate({
    model: config.imageModel,
    prompt: buildImageRenderPrompt(editorialPrompt, direction, correction),
    background: "opaque",
    moderation: "auto",
    n: 1,
    output_format: "png",
    quality: imageQuality(),
    size: "1536x864",
    user: "qcs-editorial-image-agent"
  });
  const encoded = result.data?.[0]?.b64_json;
  if (!encoded) throw new EditorialAgentError("The OpenAI image agent returned no usable image data.");
  return Buffer.from(encoded, "base64");
}

async function inspectVisual(
  editorialPrompt: string,
  direction: VisualDirection,
  source: Buffer,
  recentConcepts: RecentVisualConcept[]
) {
  const config = editorialAgentConfiguration();
  const response = await openAIClient().responses.create({
    model: config.criticModel,
    store: false,
    reasoning: { effort: "medium" },
    instructions: [
      "You are the QCS Visual QA Critic. Inspect the actual generated image against the complete article brief and approved art direction.",
      "Reject attractive but generic cybersecurity imagery, factual mismatches, repeated compositions, unreadable focal hierarchy, embedded text, cropped essential subjects, and LinkedIn-unsafe framing.",
      "This is an editorial hero image, not a technical diagram. It must communicate the article's one central technical relationship at a glance; it does not need to encode every secondary fact, workflow step, classification, version, or checklist item.",
      "Use violations only for publication-blocking defects: the wrong core story, materially misleading technology, generic or repeated symbolism, visible text or invented branding, broken anatomy or geometry, an incoherent focal hierarchy, or an essential subject outside the safe crop. Mention non-blocking omissions only in rationale and leave violations empty.",
      "A mismatch in an optional person's age, gender presentation, ethnicity, clothing, hand position, or other casting detail is never a blocking violation unless that identity is an explicit factual subject of the article. Likewise, shared domain objects such as routers, cables, racks, or laptops do not make a composition repetitive by themselves; judge diversity from the overall scene, viewpoint, focal mechanism, and spatial arrangement.",
      "Every score must use the full 0-to-100 scale. For excellent work return values such as 90 or 95, never 9 or 9.5.",
      "Set approved true only when the image is article-specific and every score honestly meets professional publication quality.",
      "If rejected, correctionPrompt must give concrete visual changes for one regeneration. Return the required JSON only."
    ].join(" "),
    input: [
      {
        role: "user",
        content: [
          {
            type: "input_text",
            text: [
              editorialPrompt,
              "",
              "APPROVED DIRECTION:",
              JSON.stringify(direction),
              "",
              "RECENT CONCEPTS USED FOR DIVERSITY COMPARISON:",
              recentConceptBrief(recentConcepts)
            ].join("\n")
          },
          {
            type: "input_image",
            detail: "high",
            image_url: `data:image/png;base64,${source.toString("base64")}`
          }
        ]
      }
    ],
    max_output_tokens: 1_800,
    text: {
      verbosity: "low",
      format: {
        type: "json_schema",
        name: "qcs_visual_qa",
        strict: true,
        schema: visualQaJsonSchema
      }
    }
  });
  return parseStructuredOutput(response.output_text, visualQaSchema, "QCS Visual QA Critic");
}

export function visualQaPasses(qa: VisualQa) {
  return (
    qa.approved &&
    qa.violations.length === 0 &&
    qa.relevanceScore >= 82 &&
    qa.specificityScore >= 82 &&
    qa.diversityScore >= 78 &&
    qa.compositionScore >= 82
  );
}

export function normalizeVisualQaScores(qa: VisualQa) {
  const scores = [qa.relevanceScore, qa.specificityScore, qa.diversityScore, qa.compositionScore];
  if (!scores.every((score) => score >= 0 && score <= 10)) return qa;
  return {
    ...qa,
    relevanceScore: qa.relevanceScore * 10,
    specificityScore: qa.specificityScore * 10,
    diversityScore: qa.diversityScore * 10,
    compositionScore: qa.compositionScore * 10
  };
}

export function restoreEditorialAgentTrace(value: unknown) {
  const result = editorialAgentTraceSchema.safeParse(value);
  return result.success ? result.data : null;
}

export function traceForEditorialRetry(trace: EditorialAgentTrace | null) {
  return trace && trace.renderAttempts < 3 ? trace : null;
}

function attemptsPerRun() {
  const configured = Number(env("EDITORIAL_IMAGE_ATTEMPTS_PER_RUN"));
  if (Number.isFinite(configured) && configured >= 1) return Math.min(Math.floor(configured), 2);
  return process.env.VERCEL ? 1 : 2;
}

export async function runEditorialImageAgents(
  editorialPrompt: string,
  recentConcepts: RecentVisualConcept[],
  previousTrace: EditorialAgentTrace | null = null
) {
  const config = editorialAgentConfiguration();
  const retryTrace = traceForEditorialRetry(previousTrace);
  const direction = retryTrace?.direction || (await directVisualDirection(editorialPrompt, recentConcepts));
  let correction = retryTrace?.qa.correctionPrompt || retryTrace?.qa.violations.join("; ") || "";
  let latestQa: VisualQa | undefined;
  const priorAttempts = retryTrace?.renderAttempts || 0;
  const maximumAttempts = attemptsPerRun();

  for (let attempt = 1; attempt <= maximumAttempts; attempt += 1) {
    const source = await produceImage(editorialPrompt, direction, correction);
    latestQa = normalizeVisualQaScores(await inspectVisual(editorialPrompt, direction, source, recentConcepts));
    const trace: EditorialAgentTrace = {
      provider: "openai-direct",
      qaPolicyVersion: 2,
      directorModel: config.directorModel,
      imageModel: config.imageModel,
      criticModel: config.criticModel,
      direction,
      qa: latestQa,
      renderAttempts: priorAttempts + attempt
    };
    if (visualQaPasses(latestQa)) return { source, trace };
    correction = latestQa.correctionPrompt || latestQa.violations.join("; ");
    if (attempt === maximumAttempts) {
      throw new EditorialAgentError(
        `Visual QA rejected the generated image after ${priorAttempts + attempt} total render attempts: ${latestQa.rationale}`,
        trace
      );
    }
  }

  throw new EditorialAgentError("Visual generation ended without an approved image.", {
    provider: "openai-direct",
    qaPolicyVersion: 2,
    directorModel: config.directorModel,
    imageModel: config.imageModel,
    criticModel: config.criticModel,
    direction,
    qa: latestQa,
    renderAttempts: priorAttempts
  });
}
