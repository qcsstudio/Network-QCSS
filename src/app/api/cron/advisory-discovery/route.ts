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
  if (!automatedRequest && !isAdminRequest(request)) return jsonError("Unauthorized", 401);
  const results = await scanAdvisorySources();
  const reconciled = await reconcileAdvisoryLinkedInQueue();
  revalidatePath("/security-advisories");
  revalidatePath("/sitemap.xml");
  await createAuditLog(
    {
      action: "advisory.discovery_scan",
      actor: automatedRequest ? "automation-worker" : "admin",
      target: "security-advisory-desk",
      metadata: { results, linkedinReconciled: reconciled }
    },
    await requestContext()
  );
  return NextResponse.json({ ok: true, scannedAt: new Date().toISOString(), results, linkedinReconciled: reconciled }, { headers: noStoreHeaders });
}
