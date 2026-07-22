import { NextResponse } from "next/server";
import { z } from "zod";
import { jsonError, noStoreHeaders, readJsonBody } from "@/lib/api";
import { rateLimit } from "@/lib/rate-limit";
import { auditVerifyGrid, verifyGridAdminActor } from "@/lib/verifygrid-admin-api";
import { emergencyStopVerifyGridEngagement } from "@/lib/verifygrid-sensor";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type RouteContext = { params: Promise<{ id: string }> };
const schema = z.object({ reason: z.string().trim().min(20).max(1000) });

export async function POST(request: Request, { params }: RouteContext) {
  const limited = rateLimit(request, { keyPrefix: "verifygrid-emergency-stop", max: 6, windowMs: 60_000 });
  if (limited) return limited;
  const actor = await verifyGridAdminActor(request);
  if (!actor) return jsonError("Unauthorized", 401);
  const body = await readJsonBody(request);
  if (!body.ok) return body.response;
  try {
    const input = schema.parse(body.data);
    const { id } = await params;
    const result = await emergencyStopVerifyGridEngagement(id, actor, input.reason);
    await auditVerifyGrid("emergency_stop", actor, id, { reason: input.reason, cancelledJobs: result.cancelledJobs });
    return NextResponse.json({ ok: true, ...result }, { headers: noStoreHeaders });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Unable to stop the engagement.", 400);
  }
}
