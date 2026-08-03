import { NextResponse } from "next/server";
import { getAdminSession, isAdminRequest } from "@/lib/admin-auth";
import { jsonError, noStoreHeaders, readJsonBody } from "@/lib/api";
import { requestContext } from "@/lib/security";
import { rebuildLinkedInPublicationsSince } from "@/lib/social-publications";
import { createAuditLog } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const defaultSince = "2026-07-30T18:30:00.000Z";
const maximumLookbackMs = 14 * 24 * 60 * 60 * 1000;

export async function POST(request: Request) {
  if (!isAdminRequest(request)) return jsonError("Unauthorized", 401);

  const parsed = await readJsonBody(request);
  if (!parsed.ok) return parsed.response;
  const body = parsed.data as { since?: unknown };
  const since = new Date(typeof body.since === "string" ? body.since : defaultSince);
  if (Number.isNaN(since.getTime())) return jsonError("A valid ISO start date is required.", 400);
  if (Date.now() - since.getTime() > maximumLookbackMs) {
    return jsonError("The LinkedIn rebuild window cannot exceed 14 days.", 400);
  }

  try {
    const outcomes = await rebuildLinkedInPublicationsSince(since, true);
    const session = await getAdminSession();
    await createAuditLog(
      {
        action: "integration.linkedin_recent_publications_rebuilt",
        actor: session?.email || "admin-api",
        target: "linkedin",
        metadata: { since: since.toISOString(), outcomes }
      },
      await requestContext()
    );
    return NextResponse.json({ ok: true, since: since.toISOString(), outcomes }, { headers: noStoreHeaders });
  } catch (error) {
    console.error("Unable to rebuild recent LinkedIn publications.", error);
    return jsonError(error instanceof Error ? error.message : "Unable to rebuild recent LinkedIn publications.", 500);
  }
}
