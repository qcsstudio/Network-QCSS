import { NextResponse } from "next/server";
import { jsonError, noStoreHeaders, readJsonBody } from "@/lib/api";
import { rateLimit } from "@/lib/rate-limit";
import { auditVerifyGrid, verifyGridAdminActor } from "@/lib/verifygrid-admin-api";
import { createVerifyGridReport } from "@/lib/verifygrid-pipeline";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: RouteContext) {
  const limited = rateLimit(request, { keyPrefix: "verifygrid-report-create", max: 20, windowMs: 60_000 });
  if (limited) return limited;
  const actor = await verifyGridAdminActor(request);
  if (!actor) return jsonError("Unauthorized", 401);
  const body = await readJsonBody(request);
  if (!body.ok) return body.response;
  try {
    const { id } = await params;
    const result = await createVerifyGridReport(id, body.data, actor);
    await auditVerifyGrid("report_generated", actor, result.reportId, { engagementId: id });
    return NextResponse.json({ ok: true, engagement: result.engagement, reportId: result.reportId }, { status: 201, headers: noStoreHeaders });
  } catch (error) {
    console.error("Unable to generate VerifyGrid report.", error);
    return jsonError(error instanceof Error ? error.message : "Unable to generate the report.", 400);
  }
}
