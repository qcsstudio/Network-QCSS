import { NextResponse } from "next/server";
import { getAdminSession, isAdminRequest } from "@/lib/admin-auth";
import { jsonError, noStoreHeaders, readJsonBody } from "@/lib/api";
import { editorialAgentConfiguration } from "@/lib/editorial-image-agents";
import { generateMissingEditorialImages, getEditorialImageSummary } from "@/lib/editorial-image-generation";
import { requestContext } from "@/lib/security";
import { createAuditLog } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(request: Request) {
  if (!isAdminRequest(request)) return jsonError("Unauthorized", 401);
  return NextResponse.json({ ok: true, images: await getEditorialImageSummary() }, { headers: noStoreHeaders });
}

export async function POST(request: Request) {
  if (!isAdminRequest(request)) return jsonError("Unauthorized", 401);
  const agent = editorialAgentConfiguration();
  if (!agent.configured) {
    return jsonError(
      agent.credentialIssue === "malformed"
        ? "OPENAI_API_KEY is malformed. Add the complete OpenAI secret key value beginning with sk-."
        : "OPENAI_API_KEY is required for the direct QCS editorial agent team. No AI gateway is used.",
      503
    );
  }
  const parsed = await readJsonBody(request);
  if (!parsed.ok) return parsed.response;
  const body = parsed.data as { excludeContentIds?: unknown; force?: unknown; limit?: unknown };
  const limit = typeof body.limit === "number" ? Math.max(1, Math.min(Math.floor(body.limit), 5)) : 1;
  const force = body.force === true;
  const excludeContentIds = Array.isArray(body.excludeContentIds)
    ? body.excludeContentIds.filter((value): value is string => typeof value === "string" && value.length <= 160).slice(0, 100)
    : [];
  const outcomes = await generateMissingEditorialImages(limit, force, excludeContentIds);
  const session = await getAdminSession();
  await createAuditLog(
    {
      action: "content.editorial_images_generated",
      actor: session?.email || "admin-api",
      target: "editorial-images",
      metadata: { excluded: excludeContentIds.length, force, limit, outcomes }
    },
    await requestContext()
  );
  return NextResponse.json({ ok: true, outcomes, images: await getEditorialImageSummary() }, { headers: noStoreHeaders });
}
