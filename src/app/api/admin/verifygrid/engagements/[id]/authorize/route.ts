import { NextResponse } from "next/server";
import { jsonError, noStoreHeaders, readJsonBody } from "@/lib/api";
import { rateLimit } from "@/lib/rate-limit";
import { authorizeVerifyGridEngagement } from "@/lib/verifygrid";
import { auditVerifyGrid, verifyGridAdminActor } from "@/lib/verifygrid-admin-api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: RouteContext) {
  const limited = rateLimit(request, { keyPrefix: "verifygrid-authorize", max: 20, windowMs: 60_000 });
  if (limited) return limited;
  const actor = await verifyGridAdminActor(request);
  if (!actor) return jsonError("Unauthorized", 401);
  const body = await readJsonBody(request);
  if (!body.ok) return body.response;
  try {
    const { id } = await params;
    const engagement = await authorizeVerifyGridEngagement(id, body.data, actor);
    await auditVerifyGrid("authorization_recorded", actor, id, { scopeHash: engagement.gate.scopeHash, validUntil: engagement.gate.authorization?.validUntil });
    return NextResponse.json({ ok: true, engagement }, { headers: noStoreHeaders });
  } catch (error) {
    console.error("Unable to authorize VerifyGrid engagement.", error);
    return jsonError(error instanceof Error ? error.message : "Unable to record authorization.", 400);
  }
}
