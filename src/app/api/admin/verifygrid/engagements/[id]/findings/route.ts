import { NextResponse } from "next/server";
import { jsonError, noStoreHeaders, readJsonBody } from "@/lib/api";
import { rateLimit } from "@/lib/rate-limit";
import { createVerifyGridFinding } from "@/lib/verifygrid";
import { auditVerifyGrid, verifyGridAdminActor } from "@/lib/verifygrid-admin-api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: RouteContext) {
  const limited = rateLimit(request, { keyPrefix: "verifygrid-finding-create", max: 80, windowMs: 60_000 });
  if (limited) return limited;
  const actor = await verifyGridAdminActor(request);
  if (!actor) return jsonError("Unauthorized", 401);
  const body = await readJsonBody(request);
  if (!body.ok) return body.response;
  try {
    const { id } = await params;
    const result = await createVerifyGridFinding(id, body.data, actor);
    await auditVerifyGrid("finding_created", actor, result.findingId, { engagementId: id });
    return NextResponse.json({ ok: true, engagement: result.engagement }, { status: 201, headers: noStoreHeaders });
  } catch (error) {
    console.error("Unable to create VerifyGrid finding.", error);
    return jsonError(error instanceof Error ? error.message : "Unable to create finding.", 400);
  }
}
