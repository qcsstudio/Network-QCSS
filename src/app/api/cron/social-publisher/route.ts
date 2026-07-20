import { NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/admin-auth";
import { jsonError, noStoreHeaders } from "@/lib/api";
import { requestContext } from "@/lib/security";
import { processLinkedInQueue, resetFailedLinkedInPublications } from "@/lib/social-publications";
import { createAuditLog } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function cronAuthorized(request: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  return Boolean(secret && request.headers.get("authorization") === `Bearer ${secret}`);
}

export async function GET(request: Request) {
  const adminRequest = isAdminRequest(request);
  if (!cronAuthorized(request) && !adminRequest) return jsonError("Unauthorized", 401);
  const retryFailed = adminRequest && new URL(request.url).searchParams.get("retryFailed") === "1";
  const reset = retryFailed ? await resetFailedLinkedInPublications() : 0;
  const outcomes = await processLinkedInQueue(5);
  await createAuditLog(
    {
      action: "social.linkedin_worker",
      actor: cronAuthorized(request) ? "vercel-cron" : "admin",
      target: "linkedin",
      metadata: { reset, processed: outcomes.length, outcomes }
    },
    await requestContext()
  );
  return NextResponse.json({ ok: true, reset, processed: outcomes.length, outcomes }, { headers: noStoreHeaders });
}
