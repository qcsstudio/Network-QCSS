import { NextResponse } from "next/server";
import { z } from "zod";
import { isAdminRequest } from "@/lib/admin-auth";
import { jsonError, noStoreHeaders, readJsonBody } from "@/lib/api";
import { createMetaClient, MetaPublishingError } from "@/lib/meta-publishing";
import { discoverMetaPublications, processMetaQueue } from "@/lib/meta-publications";
import { getPrismaClient } from "@/lib/prisma";
import { createAuditLog } from "@/lib/store";
import { requestContext } from "@/lib/security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const schema = z.object({ action: z.enum(["verify", "prepare", "publish", "retry", "cancel"]), publicationId: z.string().max(100).optional() });

export async function POST(request: Request) {
  if (!isAdminRequest(request)) return jsonError("Unauthorized", 401);
  if (request.headers.get("origin") !== new URL(request.url).origin) return jsonError("Same-origin request required.", 403);
  const body = await readJsonBody(request);
  if (!body.ok) return body.response;
  const parsed = schema.safeParse(body.data);
  if (!parsed.success) return jsonError("Invalid Meta distribution action.", 400);
  const { action, publicationId } = parsed.data;
  try {
    let result: unknown;
    if (action === "verify") result = await createMetaClient().verifyAccounts();
    else if (action === "cancel" || action === "retry") {
      if (!publicationId) return jsonError("Select a publication.", 400);
      const prisma = getPrismaClient();
      const job = await prisma.socialPublication.findUnique({ where: { id: publicationId } });
      if (!job || !["facebook", "instagram"].includes(job.channel)) return jsonError("Publication not found.", 404);
      if (["published", "publishing", "needs_review"].includes(job.status)) return jsonError("Reconcile the live delivery first. This action cannot delete or duplicate a published post.", 409);
      const meta = job.metadata && typeof job.metadata === "object" && !Array.isArray(job.metadata) ? job.metadata : {};
      if (action === "retry" && meta.dispatchStartedAt) return jsonError("This record reached dispatch. Reconcile it in Business Suite before retrying.", 409);
      result = await prisma.socialPublication.updateMany({ where: { id: job.id, updatedAt: job.updatedAt, status: job.status }, data: { status: action === "cancel" ? "cancelled" : "queued", nextAttemptAt: new Date(), attempts: 0, lastError: null } });
    } else {
      if (!publicationId) await discoverMetaPublications();
      result = await processMetaQueue(action === "publish", publicationId);
    }
    await createAuditLog({ action: `social.meta_${action}`, actor: "admin", target: publicationId || "meta", metadata: { action } }, await requestContext());
    return NextResponse.json({ ok: true, result }, { headers: noStoreHeaders });
  } catch (error) {
    return jsonError(error instanceof MetaPublishingError ? error.message : "Meta action could not complete. Check server configuration, account permissions and the delivery queue.", 503);
  }
}
