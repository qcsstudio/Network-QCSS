import { NextResponse } from "next/server";
import { jsonError, noStoreHeaders, readJsonBody } from "@/lib/api";
import { rateLimit } from "@/lib/rate-limit";
import { addVerifyGridScopeTarget, removeVerifyGridScopeTarget } from "@/lib/verifygrid";
import { auditVerifyGrid, verifyGridAdminActor } from "@/lib/verifygrid-admin-api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: RouteContext) {
  const limited = rateLimit(request, { keyPrefix: "verifygrid-scope-upsert", max: 80, windowMs: 60_000 });
  if (limited) return limited;
  const actor = await verifyGridAdminActor(request);
  if (!actor) return jsonError("Unauthorized", 401);
  const body = await readJsonBody(request);
  if (!body.ok) return body.response;
  try {
    const { id } = await params;
    const engagement = await addVerifyGridScopeTarget(id, body.data, actor);
    await auditVerifyGrid("scope_changed", actor, id, { scopeHash: engagement.gate.scopeHash, executable: engagement.gate.executable });
    return NextResponse.json({ ok: true, engagement }, { headers: noStoreHeaders });
  } catch (error) {
    console.error("Unable to update VerifyGrid scope.", error);
    return jsonError(error instanceof Error ? error.message : "Unable to update scope.", 400);
  }
}

export async function DELETE(request: Request, { params }: RouteContext) {
  const limited = rateLimit(request, { keyPrefix: "verifygrid-scope-remove", max: 40, windowMs: 60_000 });
  if (limited) return limited;
  const actor = await verifyGridAdminActor(request);
  if (!actor) return jsonError("Unauthorized", 401);
  const body = await readJsonBody(request);
  if (!body.ok) return body.response;
  const targetId = String((body.data as { targetId?: unknown }).targetId || "");
  if (!targetId) return jsonError("A target ID is required.", 400);
  try {
    const { id } = await params;
    const engagement = await removeVerifyGridScopeTarget(id, targetId, actor);
    await auditVerifyGrid("scope_target_removed", actor, id, { targetId, scopeHash: engagement.gate.scopeHash });
    return NextResponse.json({ ok: true, engagement }, { headers: noStoreHeaders });
  } catch (error) {
    console.error("Unable to remove VerifyGrid scope target.", error);
    return jsonError(error instanceof Error ? error.message : "Unable to remove scope target.", 400);
  }
}
