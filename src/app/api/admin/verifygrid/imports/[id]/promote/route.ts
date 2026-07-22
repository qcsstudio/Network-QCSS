import { NextResponse } from "next/server";
import { jsonError, noStoreHeaders, readJsonBody } from "@/lib/api";
import { rateLimit } from "@/lib/rate-limit";
import { auditVerifyGrid, verifyGridAdminActor } from "@/lib/verifygrid-admin-api";
import { promoteVerifyGridObservations } from "@/lib/verifygrid-pipeline";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: RouteContext) {
  const limited = rateLimit(request, { keyPrefix: "verifygrid-import-promote", max: 20, windowMs: 60_000 });
  if (limited) return limited;
  const actor = await verifyGridAdminActor(request);
  if (!actor) return jsonError("Unauthorized", 401);
  const body = await readJsonBody(request);
  if (!body.ok) return body.response;
  try {
    const { id } = await params;
    const result = await promoteVerifyGridObservations(id, body.data, actor);
    await auditVerifyGrid("observations_promoted", actor, id, { promoted: result.promoted, duplicates: result.duplicates });
    return NextResponse.json({ ok: true, engagement: result.engagement, promoted: result.promoted, duplicates: result.duplicates }, { headers: noStoreHeaders });
  } catch (error) {
    console.error("Unable to promote VerifyGrid observations.", error);
    return jsonError(error instanceof Error ? error.message : "Unable to promote observations.", 400);
  }
}
