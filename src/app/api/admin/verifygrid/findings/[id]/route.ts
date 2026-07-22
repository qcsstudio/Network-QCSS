import { NextResponse } from "next/server";
import { jsonError, noStoreHeaders, readJsonBody } from "@/lib/api";
import { rateLimit } from "@/lib/rate-limit";
import { updateVerifyGridFinding } from "@/lib/verifygrid";
import { auditVerifyGrid, verifyGridAdminActor } from "@/lib/verifygrid-admin-api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: RouteContext) {
  const limited = rateLimit(request, { keyPrefix: "verifygrid-finding-update", max: 80, windowMs: 60_000 });
  if (limited) return limited;
  const actor = await verifyGridAdminActor(request);
  if (!actor) return jsonError("Unauthorized", 401);
  const body = await readJsonBody(request);
  if (!body.ok) return body.response;
  try {
    const { id } = await params;
    const engagement = await updateVerifyGridFinding(id, body.data, actor);
    await auditVerifyGrid("finding_updated", actor, id, { engagementId: engagement.id });
    return NextResponse.json({ ok: true, engagement }, { headers: noStoreHeaders });
  } catch (error) {
    console.error("Unable to update VerifyGrid finding.", error);
    return jsonError(error instanceof Error ? error.message : "Unable to update finding.", 400);
  }
}
