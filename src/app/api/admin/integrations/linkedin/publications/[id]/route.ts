import { NextResponse } from "next/server";
import { getAdminSession, isAdminRequest } from "@/lib/admin-auth";
import { jsonError, noStoreHeaders, readJsonBody } from "@/lib/api";
import { getLinkedInPost } from "@/lib/linkedin";
import { getPrismaClient } from "@/lib/prisma";
import { requestContext } from "@/lib/security";
import { rebuildLinkedInPublication, refreshLinkedInPublication } from "@/lib/social-publications";
import { createAuditLog } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!isAdminRequest(request)) return jsonError("Unauthorized", 401);
  try {
    const { id } = await params;
    const publication = await getPrismaClient().socialPublication.findUnique({ where: { id } });
    if (!publication || publication.channel !== "linkedin") return jsonError("LinkedIn publication not found.", 404);
    if (!publication.externalId) return jsonError("LinkedIn publication has no external post identifier.", 409);
    const livePost = await getLinkedInPost(publication.externalId);
    return NextResponse.json(
      {
        ok: true,
        publication: {
          id: publication.id,
          externalId: publication.externalId,
          commentary: publication.commentary,
          imageUrl: publication.imageUrl,
          status: publication.status
        },
        livePost
      },
      { headers: noStoreHeaders }
    );
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Unable to inspect the LinkedIn publication.", 502);
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!isAdminRequest(request)) return jsonError("Unauthorized", 401);
  const parsed = await readJsonBody(request);
  if (!parsed.ok) return parsed.response;
  const body = parsed.data as { action?: unknown; commentary?: unknown; imageMode?: unknown };
  if (body.action !== "refresh_commentary" && body.action !== "replace_media" && body.action !== "rebuild") {
    return jsonError("Action must be refresh_commentary, replace_media, or rebuild.", 400);
  }

  try {
    const { id } = await params;
    const action = body.action;
    const commentary = typeof body.commentary === "string" && body.commentary.trim() ? body.commentary.trim() : undefined;
    const forceProceduralImage = body.imageMode === "procedural";
    const publication =
      action === "rebuild"
        ? await rebuildLinkedInPublication(id)
        : await refreshLinkedInPublication(id, action === "replace_media", commentary, forceProceduralImage);
    const session = await getAdminSession();
    await createAuditLog(
      {
        action: `integration.linkedin_${action}`,
        actor: session?.email || "admin-api",
        target: publication.externalId || id,
        metadata: { publicationId: id, reviewedCommentary: Boolean(commentary), imageMode: forceProceduralImage ? "procedural" : "automatic" }
      },
      await requestContext()
    );
    return NextResponse.json({ ok: true, publication }, { headers: noStoreHeaders });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Unable to refresh the LinkedIn publication.", 400);
  }
}
