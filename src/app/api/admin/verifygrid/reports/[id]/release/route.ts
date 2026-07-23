import { NextResponse } from "next/server";
import { jsonError, noStoreHeaders, readJsonBody } from "@/lib/api";
import { rateLimit } from "@/lib/rate-limit";
import { auditVerifyGrid, verifyGridAdminActor } from "@/lib/verifygrid-admin-api";
import { getVerifyGridOperatorFromRequest } from "@/lib/verifygrid-operator-auth";
import { releaseVerifyGridReport } from "@/lib/verifygrid-pipeline";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: RouteContext) {
  const limited = rateLimit(request, { keyPrefix: "verifygrid-report-release", max: 10, windowMs: 60_000 });
  if (limited) return limited;
  const actor = await verifyGridAdminActor(request, "release_report");
  const operator = await getVerifyGridOperatorFromRequest(request, "release_report");
  if (!actor || !operator) return jsonError("Unauthorized", 401);
  const body = await readJsonBody(request);
  if (!body.ok) return body.response;
  try {
    const { id } = await params;
    const result = await releaseVerifyGridReport(id, body.data, operator);
    await auditVerifyGrid("report_released", actor, id, { status: result.status });
    return NextResponse.json({ ok: true, ...result }, { headers: noStoreHeaders });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Unable to release the report.", 400);
  }
}
