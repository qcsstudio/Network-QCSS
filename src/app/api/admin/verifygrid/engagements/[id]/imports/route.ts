import { NextResponse } from "next/server";
import { jsonError, noStoreHeaders, readJsonBody } from "@/lib/api";
import { rateLimit } from "@/lib/rate-limit";
import { auditVerifyGrid, verifyGridAdminActor } from "@/lib/verifygrid-admin-api";
import { importVerifyGridScannerExport } from "@/lib/verifygrid-pipeline";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: RouteContext) {
  const limited = rateLimit(request, { keyPrefix: "verifygrid-import-create", max: 12, windowMs: 60_000 });
  if (limited) return limited;
  const actor = await verifyGridAdminActor(request);
  if (!actor) return jsonError("Unauthorized", 401);
  const body = await readJsonBody(request);
  if (!body.ok) return body.response;
  try {
    const { id } = await params;
    const result = await importVerifyGridScannerExport(id, body.data, actor);
    await auditVerifyGrid("import_completed", actor, result.batchId, { engagementId: id });
    return NextResponse.json({ ok: true, engagement: result.engagement, batchId: result.batchId }, { status: 201, headers: noStoreHeaders });
  } catch (error) {
    console.error("Unable to import VerifyGrid scanner evidence.", error);
    return jsonError(error instanceof Error ? error.message : "Unable to import scanner evidence.", 400);
  }
}
