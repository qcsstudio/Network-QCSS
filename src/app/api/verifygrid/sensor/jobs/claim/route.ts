import { NextResponse } from "next/server";
import { jsonError, noStoreHeaders } from "@/lib/api";
import { rateLimit } from "@/lib/rate-limit";
import { claimVerifyGridSensorJob } from "@/lib/verifygrid-sensor";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const limited = rateLimit(request, { keyPrefix: "verifygrid-sensor-claim", max: 120, windowMs: 60_000 });
  if (limited) return limited;
  try {
    const result = await claimVerifyGridSensorJob(request);
    if (!result) return jsonError("Unauthorized", 401);
    return NextResponse.json({ ok: true, job: result.job }, { headers: noStoreHeaders });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Unable to claim a sensor job.", 400);
  }
}
