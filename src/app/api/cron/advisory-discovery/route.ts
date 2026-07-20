import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/admin-auth";
import { scanAdvisorySources } from "@/lib/advisories";
import { jsonError, noStoreHeaders } from "@/lib/api";
import { requestContext } from "@/lib/security";
import { processLinkedInQueue, reconcileAdvisoryLinkedInQueue } from "@/lib/social-publications";
import { createAuditLog } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

function cronAuthorized(request: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  return Boolean(secret && request.headers.get("authorization") === `Bearer ${secret}`);
}

export async function GET(request: Request) {
  if (!cronAuthorized(request) && !isAdminRequest(request)) return jsonError("Unauthorized", 401);
  const results = await scanAdvisorySources();
  const reconciled = await reconcileAdvisoryLinkedInQueue();
  const linkedIn = await processLinkedInQueue(5);
  revalidatePath("/security-advisories");
  revalidatePath("/sitemap.xml");
  await createAuditLog(
    {
      action: "advisory.discovery_scan",
      actor: cronAuthorized(request) ? "vercel-cron" : "admin",
      target: "security-advisory-desk",
      metadata: { results, linkedinReconciled: reconciled, linkedinProcessed: linkedIn.length }
    },
    await requestContext()
  );
  return NextResponse.json({ ok: true, scannedAt: new Date().toISOString(), results, linkedinReconciled: reconciled, linkedin: linkedIn }, { headers: noStoreHeaders });
}
