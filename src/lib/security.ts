import crypto from "node:crypto";
import { headers } from "next/headers";

export async function requestContext() {
  const headerStore = await headers();
  const forwardedFor = headerStore.get("x-forwarded-for");
  const ip = forwardedFor?.split(",")[0]?.trim() || headerStore.get("x-real-ip") || "unknown";

  return {
    country: headerStore.get("x-vercel-ip-country") || headerStore.get("cf-ipcountry") || "Unknown",
    ipHash: crypto.createHash("sha256").update(`network-qcss:${ip}`).digest("hex")
  };
}

export function priorityForScore(score: number) {
  if (score >= 80) return "hot" as const;
  if (score >= 50) return "warm" as const;
  if (score >= 25) return "nurture" as const;
  return "low" as const;
}
