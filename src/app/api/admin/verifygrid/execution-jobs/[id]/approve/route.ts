import { NextResponse } from "next/server";
import { jsonError, noStoreHeaders, readJsonBody } from "@/lib/api";
import { rateLimit } from "@/lib/rate-limit";
import { auditVerifyGrid, verifyGridAdminActor } from "@/lib/verifygrid-admin-api";
import { approveVerifyGridExecutionJob } from "@/lib/verifygrid-pipeline";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: RouteContext) {
  const limited = rateLimit(request, { keyPrefix: "verifygrid-execution-approve", max: 15, windowMs: 60_000 });
  if (limited) return limited;
  const actor = await verifyGridAdminActor(request);
  if (!actor) return jsonError("Unauthorized", 401);
  const body = await readJsonBody(request);
  if (!body.ok) return body.response;
  try {
    const { id } = await params;
    const engagement = await approveVerifyGridExecutionJob(id, body.data, actor);
    await auditVerifyGrid("execution_controlled_validation_approved", actor, id);
    return NextResponse.json({ ok: true, engagement }, { headers: noStoreHeaders });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Unable to approve the execution record.", 400);
  }
}
