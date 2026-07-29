import { NextResponse } from "next/server";
import { getAdminSession, isAdminRequest } from "@/lib/admin-auth";
import { jsonError, noStoreHeaders, readJsonBody } from "@/lib/api";
import { requestContext } from "@/lib/security";
import { refreshLinkedInPublication } from "@/lib/social-publications";
import { createAuditLog } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!isAdminRequest(request)) return jsonError("Unauthorized", 401);
  const parsed = await readJsonBody(request);
  if (!parsed.ok) return parsed.response;
  const body = parsed.data as { action?: unknown };
  if (body.action !== "refresh_commentary" && body.action !== "replace_media") {
    return jsonError("Action must be refresh_commentary or replace_media.", 400);
  }

  try {
    const { id } = await params;
    const before = body.action;
    const publication = await refreshLinkedInPublication(id, before === "replace_media");
    const session = await getAdminSession();
    await createAuditLog(
      {
        action: `integration.linkedin_${before}`,
        actor: session?.email || "admin-api",
        target: publication.externalId || id,
        metadata: { publicationId: id }
      },
      await requestContext()
    );
    return NextResponse.json({ ok: true, publication }, { headers: noStoreHeaders });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Unable to refresh the LinkedIn publication.", 400);
  }
}
