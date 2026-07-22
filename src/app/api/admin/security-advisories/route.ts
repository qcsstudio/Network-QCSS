import { NextResponse } from "next/server";
import { getAdminSession, isAdminRequest } from "@/lib/admin-auth";
import { createAdminSecurityAdvisory, listAdminSecurityAdvisories } from "@/lib/advisories";
import { jsonError, noStoreHeaders, readJsonBody } from "@/lib/api";
import { rateLimit } from "@/lib/rate-limit";
import { requestContext } from "@/lib/security";
import { createAuditLog } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function adminActor(request: Request) {
  if (!isAdminRequest(request)) return "";
  return (await getAdminSession())?.email || "admin-api";
}

export async function GET(request: Request) {
  if (!isAdminRequest(request)) return jsonError("Unauthorized", 401);
  try {
    return NextResponse.json({ ok: true, advisories: await listAdminSecurityAdvisories() }, { headers: noStoreHeaders });
  } catch (error) {
    console.error("Unable to list admin advisories.", error);
    return jsonError("Advisory management is unavailable.", 503);
  }
}

export async function POST(request: Request) {
  const limited = rateLimit(request, { keyPrefix: "admin-advisory-create", max: 20, windowMs: 60_000 });
  if (limited) return limited;
  const actor = await adminActor(request);
  if (!actor) return jsonError("Unauthorized", 401);
  const body = await readJsonBody(request);
  if (!body.ok) return body.response;
  try {
    const advisory = await createAdminSecurityAdvisory(body.data, actor);
    await createAuditLog(
      { action: "advisory.admin_created", actor, target: advisory.id, metadata: { slug: advisory.slug, status: advisory.status } },
      await requestContext()
    );
    return NextResponse.json({ ok: true, advisory }, { status: 201, headers: noStoreHeaders });
  } catch (error) {
    console.error("Unable to create admin advisory.", error);
    return jsonError(error instanceof Error ? error.message : "Unable to create the advisory.", 400);
  }
}
