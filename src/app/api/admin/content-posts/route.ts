import { NextResponse } from "next/server";
import { getAdminSession, isAdminRequest } from "@/lib/admin-auth";
import { jsonError, noStoreHeaders, readJsonBody } from "@/lib/api";
import {
  createContentPost,
  listContentPosts,
  starterPostFromRadar,
  type RadarDraftInput
} from "@/lib/content-posts";
import { rateLimit } from "@/lib/rate-limit";
import { requestContext } from "@/lib/security";
import { createAuditLog } from "@/lib/store";
import { blogPosts } from "@/lib/blog";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function adminActor(request: Request) {
  if (!isAdminRequest(request)) return "";
  return (await getAdminSession())?.email || "admin-api";
}

export async function GET(request: Request) {
  if (!isAdminRequest(request)) return jsonError("Unauthorized", 401);
  try {
    return NextResponse.json({ ok: true, posts: await listContentPosts() }, { headers: noStoreHeaders });
  } catch (error) {
    console.error("Unable to list content posts.", error);
    return jsonError("Content studio storage is unavailable.", 503);
  }
}

export async function POST(request: Request) {
  const limited = rateLimit(request, { keyPrefix: "content-post-create", max: 20, windowMs: 60_000 });
  if (limited) return limited;
  const actor = await adminActor(request);
  if (!actor) return jsonError("Unauthorized", 401);
  const body = await readJsonBody(request);
  if (!body.ok) return body.response;

  try {
    const payload = body.data as { draft?: RadarDraftInput; content?: unknown; sourceUrl?: string; staticSlug?: string };
    const staticPost = payload.staticSlug ? blogPosts.find((post) => post.slug === payload.staticSlug) : undefined;
    const content = staticPost || (payload.draft ? starterPostFromRadar(payload.draft) : payload.content);
    if (!content) return jsonError("A radar brief or structured post is required.", 400);
    const sourceUrl = String(payload.sourceUrl || payload.draft?.sourceUrl || staticPost?.sources[0]?.url || "");
    const post = await createContentPost(content, sourceUrl, actor);
    await createAuditLog(
      { action: "content.post_created", actor, target: post?.id || "content-post", metadata: { slug: post?.slug || "" } },
      await requestContext()
    );
    return NextResponse.json({ ok: true, post }, { status: 201, headers: noStoreHeaders });
  } catch (error) {
    console.error("Unable to create content post.", error);
    return jsonError(error instanceof Error ? error.message : "Unable to create content post.", 400);
  }
}
