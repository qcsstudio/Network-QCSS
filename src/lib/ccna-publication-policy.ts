import { z } from "zod";

const jobSchema = z.object({
  requestedAt: z.string().datetime(), actor: z.string().min(1).max(200),
  runs: z.number().int().min(0).max(6), delivery: z.enum(["pending", "complete"])
});
export type CcnaPublicationJob = z.infer<typeof jobSchema>;
export function ccnaPublicationJob(trace: unknown) {
  const parsed = jobSchema.safeParse(trace && typeof trace === "object" && "publicationJob" in trace ? trace.publicationJob : null);
  return parsed.success ? parsed.data : null;
}

export function ccnaFailureSummary(message: string) {
  if (/credit_balance_exhausted|no credits remaining|insufficient_quota|billing|quota exceeded/i.test(message)) return "OpenAI API billing needs attention. Add API credit or resolve the project spending limit before retrying; waiting does not resolve this.";
  if (/401|invalid_api_key|incorrect API key/i.test(message)) return "OpenAI credentials need attention. Check the production API key before retrying.";
  if (/invalid schema|unsupported keywords|response_format/i.test(message)) return "The provider rejected the output schema. This is an application compatibility issue, not a lesson quality failure.";
  return message;
}
