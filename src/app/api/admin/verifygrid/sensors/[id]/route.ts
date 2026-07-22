import { NextResponse } from "next/server";
import { z } from "zod";
import { jsonError, noStoreHeaders, readJsonBody } from "@/lib/api";
import { rateLimit } from "@/lib/rate-limit";
import { auditVerifyGrid, verifyGridAdminActor } from "@/lib/verifygrid-admin-api";
import { revokeVerifyGridSensor } from "@/lib/verifygrid-sensor";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type RouteContext = { params: Promise<{ id: string }> };
const schema = z.object({ reason: z.string().trim().min(10).max(500) });

export async function PATCH(request: Request, { params }: RouteContext) {
  const limited = rateLimit(request, { keyPrefix: "verifygrid-sensor-revoke", max: 12, windowMs: 60_000 });
  if (limited) return limited;
  const actor = await verifyGridAdminActor(request);
  if (!actor) return jsonError("Unauthorized", 401);
  const body = await readJsonBody(request);
  if (!body.ok) return body.response;
  try {
    const input = schema.parse(body.data);
    const { id } = await params;
    await revokeVerifyGridSensor(id, actor, input.reason);
    await auditVerifyGrid("sensor_revoked", actor, id, { reason: input.reason });
    return NextResponse.json({ ok: true }, { headers: noStoreHeaders });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Unable to revoke sensor.", 400);
  }
}
