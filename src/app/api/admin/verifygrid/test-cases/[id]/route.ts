import { NextResponse } from "next/server";
import { jsonError, noStoreHeaders, readJsonBody } from "@/lib/api";
import { rateLimit } from "@/lib/rate-limit";
import { auditVerifyGrid, verifyGridAdminActor } from "@/lib/verifygrid-admin-api";
import { updateVerifyGridTestCase } from "@/lib/verifygrid";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: RouteContext) {
  const limited = rateLimit(request, { keyPrefix: "verifygrid-test-case", max: 60, windowMs: 60_000 });
  if (limited) return limited;
  const actor = await verifyGridAdminActor(request);
  if (!actor) return jsonError("Unauthorized", 401);
  const body = await readJsonBody(request);
  if (!body.ok) return body.response;
  try {
    const { id } = await params;
    const engagement = await updateVerifyGridTestCase(id, body.data, actor);
    await auditVerifyGrid("methodology_test_case_updated", actor, id, { status: body.data && typeof body.data === "object" ? (body.data as { status?: string }).status : undefined });
    return NextResponse.json({ ok: true, engagement }, { headers: noStoreHeaders });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Unable to update the methodology test case.", 400);
  }
}
