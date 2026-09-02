import { NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/admin-auth";
import { jsonError, noStoreHeaders } from "@/lib/api";
import { isAutomationRequest } from "@/lib/automation-auth";
import { requestContext } from "@/lib/security";
import {
  processLinkedInQueue,
  refreshRecentOutdatedLinkedInPublications,
  resetFailedLinkedInPublications
} from "@/lib/social-publications";
import { createAuditLog } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(request: Request) {
  const adminRequest = isAdminRequest(request);
  const automatedRequest = await isAutomationRequest(request);
  if (!automatedRequest && !adminRequest) return jsonError("Unauthorized", 401);
  const publicationId = new URL(request.url).searchParams.get("publicationId")?.trim() || "";
  const retryFailed = adminRequest && new URL(request.url).searchParams.get("retryFailed") === "1";
  const reset = retryFailed ? await resetFailedLinkedInPublications() : 0;
  const upgrades = publicationId ? [] : await refreshRecentOutdatedLinkedInPublications(1, 72);
  const outcomes = await processLinkedInQueue(1, publicationId);
  await createAuditLog(
    {
      action: "social.linkedin_worker",
      actor: automatedRequest ? "automation-worker" : "admin",
      target: "linkedin",
      metadata: { reset, upgraded: upgrades.length, upgrades, processed: outcomes.length, outcomes }
    },
    await requestContext()
  );
  return NextResponse.json(
    { ok: true, reset, upgraded: upgrades.length, upgrades, processed: outcomes.length, outcomes },
    { headers: noStoreHeaders }
  );
}
