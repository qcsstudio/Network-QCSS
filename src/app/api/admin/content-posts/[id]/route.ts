import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getAdminSession, isAdminRequest } from "@/lib/admin-auth";
import { jsonError, noStoreHeaders, readJsonBody } from "@/lib/api";
import {
  approveContentPost,
  archiveContentPost,
  getContentPost,
  publishContentPost,
  updateContentPost
} from "@/lib/content-posts";
import { rateLimit } from "@/lib/rate-limit";
import { requestContext } from "@/lib/security";
import { createAuditLog } from "@/lib/store";
import { processLinkedInQueue, queueLinkedInForContentPost } from "@/lib/social-publications";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

async function adminActor(request: Request) {
  if (!isAdminRequest(request)) return "";
  return (await getAdminSession())?.email || "admin-api";
}

export async function GET(request: Request, { params }: RouteContext) {
  if (!isAdminRequest(request)) return jsonError("Unauthorized", 401);
  const { id } = await params;
  try {
    const post = await getContentPost(id);
    return post ? NextResponse.json({ ok: true, post }, { headers: noStoreHeaders }) : jsonError("Post not found.", 404);
  } catch (error) {
    console.error("Unable to load content post.", error);
    return jsonError("Content studio storage is unavailable.", 503);
  }
}

export async function PATCH(request: Request, { params }: RouteContext) {
  const limited = rateLimit(request, { keyPrefix: "content-post-update", max: 40, windowMs: 60_000 });
  if (limited) return limited;
  const actor = await adminActor(request);
  if (!actor) return jsonError("Unauthorized", 401);
  const body = await readJsonBody(request);
  if (!body.ok) return body.response;
  const { id } = await params;

  try {
    const payload = body.data as { action?: string; content?: unknown; sourceUrl?: string };
    const action = payload.action || "save";
    const post =
      action === "approve"
        ? await approveContentPost(id, actor)
        : action === "publish"
          ? await publishContentPost(id, actor)
          : action === "archive"
            ? await archiveContentPost(id, actor)
            : await updateContentPost(id, payload.content, String(payload.sourceUrl || ""), actor);
    if (!post) return jsonError("Post not found.", 404);

    await createAuditLog(
      { action: `content.post_${action}`, actor, target: id, metadata: { slug: post.slug, status: post.status } },
      await requestContext()
    );
    if (action === "publish" || action === "archive") {
      revalidatePath("/resources");
      revalidatePath(`/resources/${post.slug}`);
      revalidatePath("/sitemap.xml");
    }
    if (action === "publish") {
      try {
        await queueLinkedInForContentPost(post);
        await processLinkedInQueue(1);
      } catch (error) {
        console.error("The article was published, but LinkedIn queueing failed.", error);
      }
    }
    return NextResponse.json({ ok: true, post }, { headers: noStoreHeaders });
  } catch (error) {
    console.error("Unable to update content post.", error);
    return jsonError(error instanceof Error ? error.message : "Unable to update content post.", 400);
  }
}
