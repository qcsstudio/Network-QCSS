import { NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/admin-auth";
import { jsonError, noStoreHeaders } from "@/lib/api";
import { isAutomationRequest } from "@/lib/automation-auth";
import { processEditorialCompletionQueue } from "@/lib/content-posts";
import { requestContext } from "@/lib/security";
import { createAuditLog } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(request: Request) {
  const adminRequest = isAdminRequest(request);
  const automatedRequest = await isAutomationRequest(request);
  if (!automatedRequest && !adminRequest) return jsonError("Unauthorized", 401);

  const outcomes = await processEditorialCompletionQueue(1);
  await createAuditLog(
    {
      action: "content.editorial_completion_worker",
      actor: automatedRequest ? "automation-worker" : "admin",
      target: "content-desk",
      metadata: { processed: outcomes.length, outcomes }
    },
    await requestContext()
  );

  return NextResponse.json(
    {
      ok: true,
      processed: outcomes.length,
      ready: outcomes.filter((outcome) => outcome.ready).length,
      outcomes
    },
    { headers: noStoreHeaders }
  );
}
