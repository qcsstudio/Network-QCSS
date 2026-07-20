import { NextResponse } from "next/server";
import { getAdminSession, isAdminRequest } from "@/lib/admin-auth";
import { jsonError, noStoreHeaders } from "@/lib/api";
import { requestEditorialApproval } from "@/lib/editorial-approvals";
import { rateLimit } from "@/lib/rate-limit";
import { requestContext } from "@/lib/security";
import { createAuditLog } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: RouteContext) {
  const limited = rateLimit(request, { keyPrefix: "content-approval-request", max: 10, windowMs: 60_000 });
  if (limited) return limited;
  if (!isAdminRequest(request)) return jsonError("Unauthorized", 401);
  const session = await getAdminSession();
  const { id } = await params;
  try {
    const result = await requestEditorialApproval(id, session?.email || "admin-api");
    await createAuditLog(
      { action: "content.whatsapp_review_requested", actor: session?.email || "admin-api", target: id, metadata: result },
      await requestContext()
    );
    return NextResponse.json({ ok: true, approval: result }, { headers: noStoreHeaders });
  } catch (error) {
    console.error("Unable to request WhatsApp editorial approval.", error);
    return jsonError(error instanceof Error ? error.message : "Unable to request WhatsApp editorial approval.", 400);
  }
}
