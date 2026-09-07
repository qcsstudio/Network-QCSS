import { z } from "zod";
import { ccnaContentDigest } from "./ccna-generation-pipeline";
import type { CcnaOutputAttempt } from "./ccna-lesson-writer";

export const ccnaCheckpointLifetimeMs = 6 * 60 * 60_000;
export const ccnaCheckpointRunLimit = 6;
const maxCheckpointBytes = 1_500_000;
const digest = z.string().regex(/^[a-f0-9]{64}$/);
const attemptSchema = z.object({
  stage: z.string(), attempt: z.number().int().min(1).max(2), maxOutputTokens: z.number(),
  status: z.string(), reason: z.string().nullable(), responseId: z.string().nullable(),
  inputTokens: z.number().nullable(), outputTokens: z.number().nullable(), reasoningTokens: z.number().nullable(),
  operationKey: digest.optional(), recoveryScheduled: z.boolean().optional()
});
const checkpointSchema = z.object({
  version: z.literal(1), scope: digest, createdAt: z.number().finite(), runs: z.number().int().min(0).max(ccnaCheckpointRunLimit),
  context: z.object({ asOf: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), recentVisuals: z.array(z.string()).max(8) }),
  entries: z.array(z.object({ key: digest, stage: z.string(), response: z.unknown(), digest })).max(20),
  outputAttempts: z.array(attemptSchema).max(32)
});
export type CcnaGenerationCheckpoint = z.infer<typeof checkpointSchema>;

function completedResponse(value: unknown) {
  if (!value || typeof value !== "object") return false;
  const response = value as { status?: string; output_text?: unknown; output?: unknown; incomplete_details?: unknown };
  return response.status === "completed" && typeof response.output_text === "string" && !!response.output_text.trim()
    && !response.incomplete_details && (!response.output || Array.isArray(response.output))
    && !JSON.stringify(response.output || []).includes('"type":"refusal"');
}

export function readCcnaGenerationCheckpoint(value: unknown, now = Date.now()) {
  if (!value || Buffer.byteLength(JSON.stringify(value), "utf8") > maxCheckpointBytes) return null;
  const parsed = checkpointSchema.safeParse(value);
  if (!parsed.success) return null;
  const checkpoint = parsed.data;
  if (checkpoint.createdAt > now || now - checkpoint.createdAt >= ccnaCheckpointLifetimeMs
    || new Set(checkpoint.entries.map((entry) => entry.key)).size !== checkpoint.entries.length
    || checkpoint.entries.some((entry) => !completedResponse(entry.response) || ccnaContentDigest(entry.response) !== entry.digest)) return null;
  return checkpoint;
}

export function createCcnaGenerationCheckpoint(options: {
  scope: unknown;
  previous?: unknown;
  recentVisuals?: string[];
  now?: () => number;
  persist?: (checkpoint: CcnaGenerationCheckpoint) => Promise<void>;
}) {
  const now = options.now || Date.now;
  const scope = ccnaContentDigest(options.scope);
  const saved = readCcnaGenerationCheckpoint(options.previous, now());
  let checkpoint: CcnaGenerationCheckpoint = saved?.scope === scope ? saved : {
    version: 1, scope, createdAt: now(), runs: 0,
    context: { asOf: new Date(now()).toISOString().slice(0, 10), recentVisuals: (options.recentVisuals || []).slice(0, 8) },
    entries: [], outputAttempts: []
  };
  const reusedStages: string[] = [];
  const snapshot = () => structuredClone(checkpoint);
  async function persist() {
    if (!readCcnaGenerationCheckpoint(checkpoint, now())) throw new Error("CCNA saved progress is expired or exceeds its safety bounds. No lesson was published.");
    await options.persist?.(snapshot());
  }
  async function start() {
    if (checkpoint.runs >= ccnaCheckpointRunLimit) throw new Error("The CCNA saved generation reached its bounded resume limit. Review provider capacity before starting a new generation.");
    checkpoint.runs += 1;
    await persist();
  }
  async function recordAttempt(attempt: CcnaOutputAttempt) {
    checkpoint.outputAttempts.push({ ...attempt });
    // Save an output-recovery reservation before another paid call. Completed
    // attempts are committed together with their response by run().
    if (attempt.status !== "completed") await persist();
  }
  async function run<T>(stage: string, requestIdentity: unknown, request: (key: string) => Promise<T>): Promise<T> {
    const key = ccnaContentDigest({ stage, requestIdentity });
    const entry = checkpoint.entries.find((item) => item.key === key);
    if (entry) {
      reusedStages.push(stage);
      return structuredClone(entry.response) as T;
    }
    const response = await request(key);
    if (!completedResponse(response)) throw new Error(`CCNA ${stage} returned incomplete or refused evidence. No lesson was published.`);
    // Persist only response data consumed by the pipeline, never request headers,
    // credentials or SDK transport objects.
    const fields = ["id", "status", "output_text", "output", "incomplete_details", "usage"];
    const value = JSON.parse(JSON.stringify(Object.fromEntries(fields.filter((field) => field in (response as object)).map((field) => [field, (response as Record<string, unknown>)[field]])))) as unknown;
    checkpoint = { ...checkpoint, entries: [...checkpoint.entries, { key, stage, response: value, digest: ccnaContentDigest(value) }] };
    await persist();
    return response;
  }
  return { start, run, recordAttempt, snapshot, context: checkpoint.context, reusedStages };
}
