import { NextResponse } from "next/server";
import { jsonError, noStoreHeaders, readJsonBody } from "@/lib/api";
import { rateLimit } from "@/lib/rate-limit";
import { auditVerifyGrid, verifyGridAdminActor } from "@/lib/verifygrid-admin-api";
import { createVerifyGridConnectorProfile, getVerifyGridAutomation } from "@/lib/verifygrid-connectors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: RouteContext) {
  const limited = rateLimit(request, { keyPrefix: "verifygrid-connector-create", max: 12, windowMs: 60_000 });
  if (limited) return limited;
  const actor = await verifyGridAdminActor(request);
  if (!actor) return jsonError("Unauthorized", 401);
  const body = await readJsonBody(request);
  if (!body.ok) return body.response;
  try {
    const { id } = await params;
    const connector = await createVerifyGridConnectorProfile(id, body.data, actor);
    await auditVerifyGrid("connector_created", actor, connector.id, { workspaceId: id, provider: connector.provider });
    return NextResponse.json({ ok: true, connector, automation: await getVerifyGridAutomation(id) }, { status: 201, headers: noStoreHeaders });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Unable to create connector profile.", 400);
  }
}
