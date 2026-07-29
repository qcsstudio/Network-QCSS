export const editorialImageRetryDelayMs = 8 * 60_000;
export const editorialImageGenerationLeaseMs = 12 * 60_000;

export function shouldDeferEditorialImageGeneration(input: {
  ageMs: number;
  force: boolean;
  promptChanged: boolean;
  status: string;
}) {
  if (input.force || input.promptChanged) return false;
  if (input.status === "generating") return input.ageMs < editorialImageGenerationLeaseMs;
  if (input.status === "failed") return input.ageMs < editorialImageRetryDelayMs;
  return false;
}
