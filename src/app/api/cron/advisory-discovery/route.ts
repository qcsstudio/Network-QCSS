import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/admin-auth";
import { scanAdvisorySources } from "@/lib/advisories";
import { jsonError, noStoreHeaders } from "@/lib/api";
import { isAutomationRequest } from "@/lib/automation-auth";
import { requestContext } from "@/lib/security";
import { reconcileAdvisoryLinkedInQueue } from "@/lib/social-publications";
import { createAuditLog } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(request: Request) {
  const automatedRequest = await isAutomationRequest(request);
  const adminRequest = isAdminRequest(request);
  if (!automatedRequest && !adminRequest) return jsonError("Unauthorized", 401);
  const backfillOnly = adminRequest && new URL(request.url).searchParams.get("backfill") === "1";
  const results = await scanAdvisorySources({ backfillOnly });
  let reconciled = 0;
  let linkedinWarning = "";
  try {
    reconciled = await reconcileAdvisoryLinkedInQueue();
  } catch (error) {
    linkedinWarning = error instanceof Error ? error.message : "LinkedIn reconciliation was held by editorial QA.";
    console.warn("Advisory discovery completed with a LinkedIn reconciliation hold.", error);
  }
  revalidatePath("/security-advisories");
  revalidatePath("/sitemap.xml");
  await createAuditLog(
    {
      action: "advisory.discovery_scan",
      actor: automatedRequest ? "automation-worker" : "admin",
      target: "security-advisory-desk",
      metadata: { results, linkedinReconciled: reconciled, linkedinWarning }
    },
    await requestContext()
  );
  return NextResponse.json(
    { ok: true, scannedAt: new Date().toISOString(), results, linkedinReconciled: reconciled, linkedinWarning },
    { headers: noStoreHeaders }
  );
}
