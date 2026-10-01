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
import { discoverMetaPublications, processMetaQueue } from "@/lib/meta-publications";
import { metaConfiguration } from "@/lib/meta-publishing";

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
  const channel = new URL(request.url).searchParams.get("channel");
  let upgrades: Awaited<ReturnType<typeof refreshRecentOutdatedLinkedInPublications>> = [];
  let outcomes: Awaited<ReturnType<typeof processLinkedInQueue>> = [];
  if (channel !== "meta") {
    try {
      upgrades = publicationId ? [] : await refreshRecentOutdatedLinkedInPublications(1, 72);
      outcomes = await processLinkedInQueue(1, publicationId);
    } catch {
      outcomes = [{ id: publicationId, status: "blocked", error: "LinkedIn queue unavailable. Inspect distribution operations." }];
    }
  }
  let metaOutcomes: Awaited<ReturnType<typeof processMetaQueue>> = [];
  if (channel === "meta" && metaConfiguration().enabled) {
    try {
      await discoverMetaPublications();
      metaOutcomes = await processMetaQueue(true, channel === "meta" ? publicationId : "");
    } catch {
      metaOutcomes = [{ status: "blocked", error: "Meta queue could not run; inspect distribution operations." }];
    }
  }
  await createAuditLog(
    {
      action: "social.linkedin_worker",
      actor: automatedRequest ? "automation-worker" : "admin",
      target: "linkedin",
      metadata: { reset, upgraded: upgrades.length, upgrades, processed: outcomes.length, outcomes, metaOutcomes }
    },
    await requestContext()
  );
  return NextResponse.json(
    { ok: true, reset, upgraded: upgrades.length, upgrades, processed: outcomes.length, outcomes, metaOutcomes },
    { headers: noStoreHeaders }
  );
}
