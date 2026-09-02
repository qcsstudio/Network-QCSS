import OpenAI from "openai";
import { ccnaOfficialSources, type CcnaCurriculumTopic } from "@/lib/ccna-curriculum";
import { ccnaLessonContentSchema, ccnaOpenAIResponseSchema, evaluateCcnaLessonQuality, type CcnaLessonContent } from "@/lib/ccna-lesson-schema";
import { openAIApiKeyStatus, openAICredentialMessage } from "@/lib/openai-config";

const allowedSourceHosts = [
  "cisco.com",
  "learningcontent.cisco.com",
  "learningnetwork.cisco.com",
  "docs.gns3.com",
  "ietf.org",
  "rfc-editor.org",
  "nist.gov",
  "wireshark.org"
];

function env(name: string) {
  return process.env[name]?.trim() || "";
}

function openAIClient() {
  const credential = openAIApiKeyStatus();
  if (!credential.configured) throw new Error(openAICredentialMessage(credential));
  return new OpenAI({
    apiKey: credential.apiKey,
    organization: env("OPENAI_ORGANIZATION") || undefined,
    project: env("OPENAI_PROJECT_ID") || undefined,
    maxRetries: 0,
    timeout: 180_000
  });
}

function isTrustedSource(value: string) {
  try {
    const host = new URL(value).hostname.toLowerCase().replace(/^www\./, "");
    return allowedSourceHosts.some((allowed) => host === allowed || host.endsWith(`.${allowed}`));
  } catch {
    return false;
  }
}

function webActivity(response: { output: unknown[] }) {
  const urls = new Set<string>();
  const queries = new Set<string>();
  for (const item of response.output) {
    if (!item || typeof item !== "object" || !("type" in item) || item.type !== "web_search_call") continue;
    if (!("action" in item) || !item.action || typeof item.action !== "object") continue;
    const action = item.action as { query?: unknown; queries?: unknown[]; url?: unknown; sources?: Array<{ url?: unknown }> };
    if (typeof action.query === "string") queries.add(action.query);
    for (const query of action.queries || []) if (typeof query === "string") queries.add(query);
    if (typeof action.url === "string" && isTrustedSource(action.url)) urls.add(action.url);
    for (const source of action.sources || []) {
      if (typeof source.url === "string" && isTrustedSource(source.url)) urls.add(source.url);
    }
  }
  return { queries: [...queries], urls: [...urls] };
}

function parseContent(value: string) {
  if (!value.trim()) throw new Error("The CCNA teaching agent returned no lesson content.");
  try {
    return ccnaLessonContentSchema.parse(JSON.parse(value));
  } catch (error) {
    throw new Error(`The CCNA teaching agent returned invalid structured content: ${error instanceof Error ? error.message : "unknown error"}`);
  }
}

function validateSources(content: CcnaLessonContent, discovered: string[]) {
  const accepted = new Set([...ccnaOfficialSources.map((source) => source.url), ...discovered]);
  const invalid = content.sources.filter((source) => !isTrustedSource(source.url) || !accepted.has(source.url));
  if (invalid.length) throw new Error(`The CCNA lesson cited unverified source URLs: ${invalid.map((source) => source.url).join(", ")}`);
  const sourceUrls = new Set(content.sources.map((source) => source.url));
  if (content.sections.some((section) => section.sourceUrls.some((url) => !sourceUrls.has(url)))) {
    throw new Error("The CCNA lesson contains section citations that are not present in its bibliography.");
  }
}

export function ccnaContentAgentConfiguration() {
  const credential = openAIApiKeyStatus();
  return {
    configured: credential.configured,
    credentialIssue: credential.credentialIssue,
    model: env("CCNA_CONTENT_MODEL") || "gpt-4.1-mini",
    provider: "OpenAI direct API"
  };
}

export async function generateResearchedCcnaLesson(topic: CcnaCurriculumTopic) {
  const config = ccnaContentAgentConfiguration();
  const schema = ccnaOpenAIResponseSchema();
  const startedAt = Date.now();
  const response = await openAIClient().responses.create({
    model: config.model,
    store: false,
    include: ["web_search_call.action.sources"],
    tools: [{ type: "web_search", search_context_size: "medium" }],
    tool_choice: "required",
    instructions: [
      "You are the QCS CCNA Learning Architect: a senior Cisco instructor, network operations engineer, lab designer, and assessment writer.",
      "Research the assigned topic on the live web before writing. Prefer current Cisco documentation, the official Cisco exam pages, standards sources, and official GNS3 documentation. Cite only URLs returned by web search or supplied in the brief.",
      "Teach a beginner in clear international English. Define each new term before using it, keep paragraphs short, and connect every concept to what a packet, device, or operator actually does.",
      "The lesson must be original and educational. Never reproduce real certification exam questions, leaked material, or copyrighted course text. Practice and quiz questions must be newly written and test understanding, configuration reasoning, verification, and troubleshooting.",
      "Build one coherent learning path: direct answer, mental model, technical mechanism, real-life scenario, safe lab, verification, troubleshooting, practice, quiz, and takeaways.",
      "Use accurate Cisco IOS or IOS XE commands only when they are genuinely relevant. Explain the mode, expected evidence, and why each command is run. Never invent command output or claim a feature exists on every image.",
      "The GNS3 lab must be reproducible with a small topology. State when a feature is better explored as a paper exercise or with Cisco Modeling Labs. Never tell learners where to download unauthorized Cisco software images.",
      "The licensing note must say that GNS3 does not provide Cisco images, learners must use images they are licensed to use, and Cisco Modeling Labs is an official alternative.",
      "Distinguish the current 200-301 CCNA v1.1 scope from the announced v2.0 scope. Do not tell learners to wait: build transferable skills and identify the v2.0 bridge where relevant.",
      "Every teaching section must cite one or more bibliography URLs. Claims, commands, protocol behavior, and exam-version statements must be traceable to authoritative sources.",
      "Write at least 1,500 useful words across the teaching sections, real-life scenario, lab, practice explanations, quiz explanations, glossary, and takeaways. Return the required JSON only."
    ].join(" "),
    input: [
      `DAY ${topic.sequence} / WEEK ${topic.week} / WEEKDAY ${topic.day}`,
      `MODULE: ${topic.moduleTitle}`,
      `TOPIC: ${topic.title}`,
      `LEARNING OUTCOME: ${topic.objective}`,
      `CURRENT V1.1 BLUEPRINT MAP: ${topic.v11}`,
      `ANNOUNCED V2.0 BLUEPRINT MAP: ${topic.v20}`,
      `LAB MODE: ${topic.labKind}`,
      `STARTING OFFICIAL SOURCES:\n${ccnaOfficialSources.map((source) => `${source.label}: ${source.url}`).join("\n")}`,
      "SOURCE RULE: You may add only authoritative URLs that your live web search actually returns. Use exact, unshortened URLs."
    ].join("\n\n"),
    max_output_tokens: 10_000,
    text: {
      format: {
        type: "json_schema",
        name: "qcs_ccna_daily_lesson",
        strict: true,
        schema
      }
    }
  });
  if (response.status === "incomplete") {
    throw new Error(`The CCNA teaching response was incomplete: ${response.incomplete_details?.reason || "unknown reason"}.`);
  }
  const activity = webActivity(response);
  if (!activity.queries.length || activity.urls.length < 2) {
    throw new Error("The CCNA teaching agent did not complete an adequate authoritative live-web research pass.");
  }
  const content = parseContent(response.output_text);
  validateSources(content, activity.urls);
  const quality = evaluateCcnaLessonQuality(content);
  return {
    content,
    quality,
    trace: {
      provider: config.provider,
      model: config.model,
      generatedAt: new Date().toISOString(),
      durationMs: Date.now() - startedAt,
      policyVersion: 1,
      searchQueries: activity.queries,
      discoveredSources: activity.urls,
      quality
    }
  };
}
