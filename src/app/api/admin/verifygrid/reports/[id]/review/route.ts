import { NextResponse } from "next/server";
import { jsonError, noStoreHeaders, readJsonBody } from "@/lib/api";
import { rateLimit } from "@/lib/rate-limit";
import { auditVerifyGrid, verifyGridAdminActor } from "@/lib/verifygrid-admin-api";
import { getVerifyGridOperatorFromRequest } from "@/lib/verifygrid-operator-auth";
import { reviewVerifyGridReport } from "@/lib/verifygrid-pipeline";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: RouteContext) {
  const limited = rateLimit(request, { keyPrefix: "verifygrid-report-review", max: 20, windowMs: 60_000 });
  if (limited) return limited;
  const actor = await verifyGridAdminActor(request, "review_report");
  const operator = await getVerifyGridOperatorFromRequest(request, "review_report");
  if (!actor || !operator) return jsonError("Unauthorized", 401);
  const body = await readJsonBody(request);
  if (!body.ok) return body.response;
  try {
    const { id } = await params;
    const result = await reviewVerifyGridReport(id, body.data, operator);
    await auditVerifyGrid("report_reviewed", actor, id, { status: result.status });
    return NextResponse.json({ ok: true, ...result }, { headers: noStoreHeaders });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Unable to review the report.", 400);
  }
}
