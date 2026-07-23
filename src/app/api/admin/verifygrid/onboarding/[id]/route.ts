import { NextResponse } from "next/server";
import { jsonError, noStoreHeaders, readJsonBody } from "@/lib/api";
import { rateLimit } from "@/lib/rate-limit";
import { auditVerifyGrid, verifyGridAdminActor } from "@/lib/verifygrid-admin-api";
import { reviewVerifyGridOnboardingRequest } from "@/lib/verifygrid-onboarding";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: RouteContext) {
  const limited = rateLimit(request, { keyPrefix: "verifygrid-onboarding-review", max: 20, windowMs: 60_000 });
  if (limited) return limited;
  const actor = await verifyGridAdminActor(request);
  if (!actor) return jsonError("Unauthorized", 401);
  const body = await readJsonBody(request);
  if (!body.ok) return body.response;
  try {
    const { id } = await params;
    const result = await reviewVerifyGridOnboardingRequest(id, body.data, actor);
    await auditVerifyGrid("onboarding_reviewed", actor, id, { status: result.request.status, engagementId: result.request.engagementId, emailDelivery: result.emailDelivery });
    return NextResponse.json({ ok: true, ...result }, { headers: noStoreHeaders });
  } catch (error) {
    console.error("Unable to review VerifyGrid onboarding request.", error);
    return jsonError(error instanceof Error ? error.message : "Unable to review this onboarding request.", 400);
  }
}

