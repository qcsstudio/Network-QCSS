import { NextResponse } from "next/server";
import { jsonError, noStoreHeaders, readJsonBody } from "@/lib/api";
import { rateLimit } from "@/lib/rate-limit";
import { getVerifyGridEngagement, transitionVerifyGridEngagement } from "@/lib/verifygrid";
import { auditVerifyGrid, verifyGridAdminActor } from "@/lib/verifygrid-admin-api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: RouteContext) {
  const actor = await verifyGridAdminActor(request);
  if (!actor) return jsonError("Unauthorized", 401);
  try {
    const { id } = await params;
    return NextResponse.json({ ok: true, engagement: await getVerifyGridEngagement(id) }, { headers: noStoreHeaders });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Engagement not found.", 404);
  }
}

export async function PATCH(request: Request, { params }: RouteContext) {
  const limited = rateLimit(request, { keyPrefix: "verifygrid-engagement-transition", max: 40, windowMs: 60_000 });
  if (limited) return limited;
  const actor = await verifyGridAdminActor(request);
  if (!actor) return jsonError("Unauthorized", 401);
  const body = await readJsonBody(request);
  if (!body.ok) return body.response;
  try {
    const { id } = await params;
    const engagement = await transitionVerifyGridEngagement(id, body.data, actor);
    await auditVerifyGrid("engagement_transitioned", actor, id, { status: engagement.status });
    return NextResponse.json({ ok: true, engagement }, { headers: noStoreHeaders });
  } catch (error) {
    console.error("Unable to transition VerifyGrid engagement.", error);
    return jsonError(error instanceof Error ? error.message : "Unable to change engagement status.", 400);
  }
}
