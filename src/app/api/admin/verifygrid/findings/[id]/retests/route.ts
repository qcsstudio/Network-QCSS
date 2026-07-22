import { NextResponse } from "next/server";
import { jsonError, noStoreHeaders } from "@/lib/api";
import { rateLimit } from "@/lib/rate-limit";
import { requestVerifyGridRetest } from "@/lib/verifygrid";
import { auditVerifyGrid, verifyGridAdminActor } from "@/lib/verifygrid-admin-api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: RouteContext) {
  const limited = rateLimit(request, { keyPrefix: "verifygrid-retest-request", max: 40, windowMs: 60_000 });
  if (limited) return limited;
  const actor = await verifyGridAdminActor(request);
  if (!actor) return jsonError("Unauthorized", 401);
  try {
    const { id } = await params;
    const engagement = await requestVerifyGridRetest(id, actor);
    await auditVerifyGrid("retest_requested", actor, id, { engagementId: engagement.id });
    return NextResponse.json({ ok: true, engagement }, { status: 201, headers: noStoreHeaders });
  } catch (error) {
    console.error("Unable to request VerifyGrid retest.", error);
    return jsonError(error instanceof Error ? error.message : "Unable to request retest.", 400);
  }
}
