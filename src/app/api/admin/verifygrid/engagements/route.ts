import { NextResponse } from "next/server";
import { jsonError, noStoreHeaders, readJsonBody } from "@/lib/api";
import { rateLimit } from "@/lib/rate-limit";
import { auditVerifyGrid, verifyGridAdminActor } from "@/lib/verifygrid-admin-api";
import { createVerifyGridEngagement, getVerifyGridPortfolio } from "@/lib/verifygrid";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const actor = await verifyGridAdminActor(request);
  if (!actor) return jsonError("Unauthorized", 401);
  try {
    return NextResponse.json({ ok: true, portfolio: await getVerifyGridPortfolio() }, { headers: noStoreHeaders });
  } catch (error) {
    console.error("Unable to load VerifyGrid portfolio.", error);
    return jsonError("VerifyGrid storage is unavailable.", 503);
  }
}

export async function POST(request: Request) {
  const limited = rateLimit(request, { keyPrefix: "verifygrid-engagement-create", max: 20, windowMs: 60_000 });
  if (limited) return limited;
  const actor = await verifyGridAdminActor(request);
  if (!actor) return jsonError("Unauthorized", 401);
  const body = await readJsonBody(request);
  if (!body.ok) return body.response;
  try {
    const engagement = await createVerifyGridEngagement(body.data, actor);
    await auditVerifyGrid("engagement_created", actor, engagement.id, { reference: engagement.reference, workspaceId: engagement.workspace.id });
    return NextResponse.json({ ok: true, engagement }, { status: 201, headers: noStoreHeaders });
  } catch (error) {
    console.error("Unable to create VerifyGrid engagement.", error);
    return jsonError(error instanceof Error ? error.message : "Unable to create the engagement.", 400);
  }
}
