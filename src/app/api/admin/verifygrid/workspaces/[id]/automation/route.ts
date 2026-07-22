import { NextResponse } from "next/server";
import { jsonError, noStoreHeaders } from "@/lib/api";
import { rateLimit } from "@/lib/rate-limit";
import { verifyGridAdminActor } from "@/lib/verifygrid-admin-api";
import { getVerifyGridAutomation } from "@/lib/verifygrid-connectors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: RouteContext) {
  const limited = rateLimit(request, { keyPrefix: "verifygrid-automation-read", max: 60, windowMs: 60_000 });
  if (limited) return limited;
  const actor = await verifyGridAdminActor(request);
  if (!actor) return jsonError("Unauthorized", 401);
  const { id } = await params;
  return NextResponse.json({ ok: true, automation: await getVerifyGridAutomation(id) }, { headers: noStoreHeaders });
}
