type ProviderError = { status?: number; code?: string; message?: string; error?: { code?: string; type?: string }; headers?: Headers };
type RetryEvent = { stage: string; model: string; retry: number; delayMs: number };

export class CcnaRequestDeferredError extends Error {
  constructor(public readonly reason: "rate_limit" | "request_too_large" | "deadline", public readonly retryAfterMs: number, stage: string) {
    super(reason === "request_too_large"
      ? `The ${stage} request exceeds the model's entire token-per-minute allowance. Waiting alone will not help; reduce the request size or request a higher model limit. No lesson was approved.`
      : reason === "deadline"
        ? "The CCNA job reached its safe request-time budget. No unreviewed lesson was approved; retry generation when provider capacity is available."
        : `OpenAI is temporarily limiting the ${stage} step. The bounded automatic retries could not finish; wait at least ${Math.ceil(retryAfterMs / 1000)} seconds before retrying. This is a capacity limit, not a failed technical review.`);
    this.name = "CcnaRequestDeferredError";
  }
}

function durationMs(value: string | null) {
  if (!value || !/^(?:\d+(?:\.\d+)?(?:ms|s|m|h|d))+$/.test(value)) return null;
  const units: Record<string, number> = { ms: 1, s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 };
  return [...value.matchAll(/(\d+(?:\.\d+)?)(ms|s|m|h|d)/g)].reduce((total, match) => total + Number(match[1]) * units[match[2]], 0);
}

export function ccnaProviderRetryDelay(error: unknown, retry: number, now: number): number | null {
  if (!error || typeof error !== "object") return null;
  const failure = error as ProviderError;
  const code = failure.code || failure.error?.code || failure.error?.type;
  const message = failure.message || "";
  if (/insufficient_quota|billing|quota_exceeded|usage_limit/i.test(`${code || ""} ${message}`)) return null;
  if (!(failure.status === 429 && (code === "rate_limit_exceeded" || code === "slow_down" || /rate limit reached/i.test(message))) && !(failure.status === 503 && code === "server_is_overloaded")) return null;

  const hinted: number[] = [];
  const millis = failure.headers?.get("retry-after-ms");
  if (millis && Number.isFinite(Number(millis)) && Number(millis) >= 0) hinted.push(Number(millis));
  const after = failure.headers?.get("retry-after");
  if (after) {
    const parsed = /^\d+(?:\.\d+)?$/.test(after) ? Number(after) * 1000 : /^[A-Za-z]{3},/.test(after) ? Date.parse(after) - now : NaN;
    if (Number.isFinite(parsed)) hinted.push(Math.max(0, parsed));
  }
  const textDelay = message.match(/try again in\s+(\d+(?:\.\d+)?)\s*s(?:econds?)?\b/i);
  if (textDelay) hinted.push(Number(textDelay[1]) * 1000);
  if (hinted.length) return Math.max(...hinted);

  const resets = ["x-ratelimit-reset-tokens", "x-ratelimit-reset-project-tokens", "x-ratelimit-reset-requests"]
    .map((name) => durationMs(failure.headers?.get(name) || null)).filter((value): value is number => value !== null);
  return resets.length ? Math.max(...resets) : 5_000 * 2 ** retry;
}

function exceedsWholeTokenWindow(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const failure = error as ProviderError;
  if (failure.status !== 429 || !/tokens per min|\bTPM\b/i.test(failure.message || "")) return false;
  const values = failure.message?.match(/Limit\s+([\d,]+).*?Requested\s+([\d,]+)/i);
  return !!values && Number(values[2].replaceAll(",", "")) > Number(values[1].replaceAll(",", ""));
}

export function createCcnaRequestRunner(options: {
  deadlineAt: number;
  now?: () => number;
  sleep?: (milliseconds: number) => Promise<void>;
  random?: () => number;
  onRetry?: (event: RetryEvent) => void;
}) {
  const now = options.now || Date.now;
  const sleep = options.sleep || ((milliseconds: number) => new Promise<void>((resolve) => setTimeout(resolve, milliseconds)));
  const random = options.random || Math.random;
  const events: RetryEvent[] = [];
  let remainingWaitMs = 60_000;

  async function run<T>(stage: string, model: string, request: (timeoutMs: number) => Promise<T>) {
    for (let retry = 0; retry <= 2; retry += 1) {
      const remainingMs = options.deadlineAt - now();
      if (remainingMs <= 5_000) throw new CcnaRequestDeferredError("deadline", 60_000, stage);
      try {
        return await request(Math.min(180_000, remainingMs - 5_000));
      } catch (error) {
        const minimumMs = ccnaProviderRetryDelay(error, retry, now());
        if (minimumMs === null) throw error;
        if (exceedsWholeTokenWindow(error)) throw new CcnaRequestDeferredError("request_too_large", 0, stage);
        // Retry-After is a minimum. Positive jitter prevents synchronized retries.
        const delayMs = Math.ceil(minimumMs + 250 + random() * 500);
        if (retry === 2 || delayMs > remainingWaitMs || now() + delayMs + 20_000 >= options.deadlineAt) {
          throw new CcnaRequestDeferredError("rate_limit", delayMs, stage);
        }
        const event = { stage, model, retry: retry + 1, delayMs };
        events.push(event);
        options.onRetry?.(event);
        remainingWaitMs -= delayMs;
        await sleep(delayMs);
      }
    }
    throw new Error("CCNA request exceeded its bounded retry loop.");
  }
  return { run, events };
}
