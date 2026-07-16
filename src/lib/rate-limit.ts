import crypto from "node:crypto";
import { jsonError } from "@/lib/api";

type RateLimitOptions = {
  keyPrefix: string;
  max: number;
  windowMs: number;
};

type Bucket = {
  count: number;
  resetAt: number;
};

const buckets = new Map<string, Bucket>();

function requestIp(request: Request) {
  const forwardedFor = request.headers.get("x-forwarded-for");
  return forwardedFor?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "unknown";
}

function hashKey(value: string) {
  return crypto.createHash("sha256").update(`network-qcss-rate:${value}`).digest("hex");
}

function cleanup(now: number) {
  if (buckets.size < 1000) return;
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
}

export function rateLimit(request: Request, options: RateLimitOptions) {
  const now = Date.now();
  cleanup(now);

  const key = `${options.keyPrefix}:${hashKey(requestIp(request))}`;
  const existing = buckets.get(key);
  const bucket = existing && existing.resetAt > now ? existing : { count: 0, resetAt: now + options.windowMs };
  bucket.count += 1;
  buckets.set(key, bucket);

  if (bucket.count <= options.max) return null;

  const retryAfter = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000));
  const response = jsonError("Too many requests. Please try again shortly.", 429);
  response.headers.set("Retry-After", String(retryAfter));
  return response;
}
