import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { getAdminSession, isAdminRequest } from "@/lib/admin-auth";
import {
  deleteAdminSecurityAdvisory,
  getAdminSecurityAdvisory,
  getSecurityAdvisoryForDistribution,
  setAdminAdvisoryState,
  updateAdminSecurityAdvisory
} from "@/lib/advisories";
import { jsonError, noStoreHeaders, readJsonBody } from "@/lib/api";
import { rateLimit } from "@/lib/rate-limit";
import { requestContext } from "@/lib/security";
import { processLinkedInQueue, queueLinkedInForAdvisory } from "@/lib/social-publications";
import { createAuditLog } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

async function adminActor(request: Request) {
  if (!isAdminRequest(request)) return "";
  return (await getAdminSession())?.email || "admin-api";
}

function revalidateAdvisory(slug: string) {
  revalidatePath("/security-advisories");
  revalidatePath(`/security-advisories/${slug}`);
  revalidatePath("/security-advisories/feed.xml");
  revalidatePath("/sitemap.xml");
}

async function queuePublishedAdvisory(id: string, revision: number) {
  const advisory = await getSecurityAdvisoryForDistribution(id);
  if (!advisory || advisory.status !== "published") return;
  try {
    await queueLinkedInForAdvisory(advisory, revision);
    await processLinkedInQueue(1);
  } catch (error) {
    console.error("The advisory was saved, but LinkedIn queueing failed.", error);
  }
}

export async function GET(request: Request, { params }: RouteContext) {
  if (!isAdminRequest(request)) return jsonError("Unauthorized", 401);
  const { id } = await params;
  const advisory = await getAdminSecurityAdvisory(id);
  return advisory ? NextResponse.json({ ok: true, advisory }, { headers: noStoreHeaders }) : jsonError("Advisory not found.", 404);
}

export async function PATCH(request: Request, { params }: RouteContext) {
  const limited = rateLimit(request, { keyPrefix: "admin-advisory-update", max: 40, windowMs: 60_000 });
  if (limited) return limited;
  const actor = await adminActor(request);
  if (!actor) return jsonError("Unauthorized", 401);
  const body = await readJsonBody(request);
  if (!body.ok) return body.response;
  const { id } = await params;
  try {
    const before = await getAdminSecurityAdvisory(id);
    if (!before) return jsonError("Advisory not found.", 404);
    const payload = body.data as { action?: "publish" | "withdraw" | "restore" | "resume_sync"; advisory?: unknown };
    const advisory = payload.action
      ? await setAdminAdvisoryState(id, payload.action, actor)
      : await updateAdminSecurityAdvisory(id, payload.advisory, actor);
    if (!advisory) return jsonError("Advisory not found.", 404);
    await createAuditLog(
      {
        action: `advisory.admin_${payload.action || "updated"}`,
        actor,
        target: id,
        metadata: { slug: advisory.slug, status: advisory.status, editorialOverride: advisory.editorialOverride }
      },
      await requestContext()
    );
    revalidateAdvisory(before.slug);
    if (before.slug !== advisory.slug) revalidateAdvisory(advisory.slug);
    await queuePublishedAdvisory(advisory.id, advisory.revision);
    return NextResponse.json({ ok: true, advisory }, { headers: noStoreHeaders });
  } catch (error) {
    console.error("Unable to update admin advisory.", error);
    return jsonError(error instanceof Error ? error.message : "Unable to update the advisory.", 400);
  }
}

export async function DELETE(request: Request, { params }: RouteContext) {
  const limited = rateLimit(request, { keyPrefix: "admin-advisory-delete", max: 20, windowMs: 60_000 });
  if (limited) return limited;
  const actor = await adminActor(request);
  if (!actor) return jsonError("Unauthorized", 401);
  const { id } = await params;
  try {
    const advisory = await deleteAdminSecurityAdvisory(id, actor);
    if (!advisory) return jsonError("Advisory not found.", 404);
    await createAuditLog(
      { action: "advisory.admin_deleted", actor, target: id, metadata: { slug: advisory.slug, source: advisory.sourceSlug } },
      await requestContext()
    );
    revalidateAdvisory(advisory.slug);
    return NextResponse.json({ ok: true, advisory }, { headers: noStoreHeaders });
  } catch (error) {
    console.error("Unable to delete admin advisory.", error);
    return jsonError(error instanceof Error ? error.message : "Unable to delete the advisory.", 400);
  }
}
