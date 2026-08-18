import { NextResponse } from "next/server";
import { jsonError, noStoreHeaders, readJsonBody } from "@/lib/api";
import { rateLimit } from "@/lib/rate-limit";
import { auditVerifyGrid, verifyGridAdminActor } from "@/lib/verifygrid-admin-api";
import { sendVerifyGridAccessEmail } from "@/lib/verifygrid-email";
import { inviteVerifyGridMember } from "@/lib/verifygrid-portal-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: RouteContext) {
  const limited = rateLimit(request, { keyPrefix: "verifygrid-member-invite", max: 12, windowMs: 60_000 });
  if (limited) return limited;
  const actor = await verifyGridAdminActor(request);
  if (!actor) return jsonError("Unauthorized", 401);
  const body = await readJsonBody(request);
  if (!body.ok) return body.response;
  try {
    const { id } = await params;
    const result = await inviteVerifyGridMember(id, body.data, actor);
    const delivery = await sendVerifyGridAccessEmail({
      email: result.membership.email,
      displayName: result.membership.displayName,
      organizationName: result.organizationName,
      accessUrl: result.accessUrl,
      tokenId: result.tokenId
    });
    await auditVerifyGrid("member_invited", actor, result.membership.id, { workspaceId: id, role: result.membership.role });
    return NextResponse.json({ ok: true, ...result, emailDelivery: delivery.reason }, { status: 201, headers: noStoreHeaders });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Unable to invite workspace member.", 400);
  }
}
