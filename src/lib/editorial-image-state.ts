export const editorialImageRetryDelayMs = 8 * 60_000;
export const editorialImageBillingRetryDelayMs = 6 * 60 * 60_000;
export const editorialImageGenerationLeaseMs = 12 * 60_000;

export function shouldDeferEditorialImageGeneration(input: {
  ageMs: number;
  force: boolean;
  lastError?: string | null;
  promptChanged: boolean;
  status: string;
}) {
  if (input.force || input.promptChanged) return false;
  if (input.status === "generating") return input.ageMs < editorialImageGenerationLeaseMs;
  if (input.status === "failed") {
    const billingLimited = /(?:billing hard limit|no credits remaining)/i.test(input.lastError || "");
    return input.ageMs < (billingLimited ? editorialImageBillingRetryDelayMs : editorialImageRetryDelayMs);
  }
  return false;
}
