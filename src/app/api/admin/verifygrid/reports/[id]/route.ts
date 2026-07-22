import { NextResponse } from "next/server";
import { jsonError, noStoreHeaders } from "@/lib/api";
import { verifyGridAdminActor } from "@/lib/verifygrid-admin-api";
import { getVerifyGridReport } from "@/lib/verifygrid-pipeline";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: RouteContext) {
  const actor = await verifyGridAdminActor(request);
  if (!actor) return jsonError("Unauthorized", 401);
  const { id } = await params;
  const report = await getVerifyGridReport(id);
  if (!report) return jsonError("Report not found.", 404);
  return NextResponse.json({ ok: true, report }, { headers: noStoreHeaders });
}
