import { NextResponse } from "next/server";
import { jsonError, noStoreHeaders, readJsonBody } from "@/lib/api";
import { rateLimit } from "@/lib/rate-limit";
import { failVerifyGridSensorJob } from "@/lib/verifygrid-sensor";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const limited = rateLimit(request, { keyPrefix: "verifygrid-sensor-failure", max: 30, windowMs: 60_000 });
  if (limited) return limited;
  const body = await readJsonBody(request);
  if (!body.ok) return body.response;
  try {
    const result = await failVerifyGridSensorJob(request, body.data);
    if (!result) return jsonError("Unauthorized", 401);
    return NextResponse.json(result, { headers: noStoreHeaders });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Unable to record sensor failure.", 400);
  }
}
