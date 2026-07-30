import dotenv from "dotenv";
import OpenAI from "openai";

const envPath = process.argv[2] || ".env.local";
const requestedModels = process.argv.slice(3);
const models = requestedModels.length ? requestedModels : ["gpt-4.1-mini", "gpt-5-mini", "gpt-5.4-mini", "gpt-5.4-nano"];

// A process-injected secret must win because Vercel masks sensitive values when exporting an env file.
dotenv.config({ path: envPath, override: false, quiet: true });

const value = (name) => process.env[name]?.trim() || "";
const apiKey = value("OPENAI_API_KEY");
const organization = value("OPENAI_ORGANIZATION");
const project = value("OPENAI_PROJECT_ID");

console.log(
  JSON.stringify(
    {
      keyPresent: Boolean(apiKey),
      keyFormat: apiKey
        ? {
            startsWithExpectedPrefix: apiKey.startsWith("sk-"),
            containsAssignmentPrefix: apiKey.startsWith("OPENAI_API_KEY="),
            containsWhitespace: /\s/.test(apiKey),
            wrappedInQuotes:
              (apiKey.startsWith('"') && apiKey.endsWith('"')) ||
              (apiKey.startsWith("'") && apiKey.endsWith("'")),
            length: apiKey.length
          }
        : null,
      organizationHeaderConfigured: Boolean(organization),
      projectHeaderConfigured: Boolean(project),
      applicationModels: {
        writer: value("EDITORIAL_CONTENT_WRITER_MODEL") || "application default",
        contentCritic: value("EDITORIAL_CONTENT_CRITIC_MODEL") || "application default",
        director: value("EDITORIAL_DIRECTOR_MODEL") || "application default",
        visualCritic: value("EDITORIAL_CRITIC_MODEL") || "application default",
        image: value("EDITORIAL_IMAGE_MODEL") || "application default"
      },
      smokeTestModels: models
    },
    null,
    2
  )
);

if (!apiKey) {
  console.error("OPENAI_API_KEY is missing from the selected environment file.");
  process.exit(2);
}

function safeError(error) {
  return {
    status: error?.status || null,
    code: error?.code || null,
    type: error?.type || null,
    message: String(error?.message || error).replaceAll(apiKey, "[REDACTED]")
  };
}

async function probe(label, client) {
  try {
    await client.models.list();
    console.log(JSON.stringify({ probe: label, modelsEndpoint: "ok" }));
    return true;
  } catch (error) {
    console.log(JSON.stringify({ probe: label, modelsEndpoint: "failed", ...safeError(error) }));
    return false;
  }
}

async function testModel(client, model) {
  try {
    const usesReasoningControls = model.startsWith("gpt-5");
    const response = await client.responses.create({
      model,
      store: false,
      reasoning: usesReasoningControls ? { effort: "low" } : undefined,
      instructions: [
        "You are a network-security editorial test agent.",
        "Use only facts supplied in the evidence.",
        "Do not infer versions, exploitation status, remediation, or product behavior.",
        "Return JSON matching the schema with no prose outside it."
      ].join(" "),
      input:
        "Evidence: A vendor advisory says administrators should review its official bulletin before changing production controls. Write one concise verification sentence and list any unsupported claims you avoided.",
      max_output_tokens: 500,
      text: {
        ...(usesReasoningControls ? { verbosity: "low" } : {}),
        format: {
          type: "json_schema",
          name: "qcs_openai_smoke_test",
          strict: true,
          schema: {
            type: "object",
            additionalProperties: false,
            required: ["verification", "unsupportedClaims"],
            properties: {
              verification: { type: "string" },
              unsupportedClaims: { type: "array", items: { type: "string" } }
            }
          }
        }
      }
    });
    const output = JSON.parse(response.output_text);
    console.log(JSON.stringify({ model, result: "ok", output }));
    return true;
  } catch (error) {
    console.log(JSON.stringify({ model, result: "failed", ...safeError(error) }));
    return false;
  }
}

const keyOnlyClient = new OpenAI({ apiKey, maxRetries: 0, timeout: 60_000 });
const applicationClient = new OpenAI({
  apiKey,
  organization: organization || undefined,
  project: project || undefined,
  maxRetries: 0,
  timeout: 60_000
});

const keyWorks = await probe("key-only", keyOnlyClient);
const applicationHeadersWork = await probe("application-headers", applicationClient);

if (!keyWorks || !applicationHeadersWork) process.exitCode = 1;
else {
  const results = [];
  for (const model of models) results.push(await testModel(applicationClient, model));
  if (results.every((result) => !result)) process.exitCode = 1;
}
