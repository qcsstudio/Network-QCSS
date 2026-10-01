import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { isAdminRequest } from "@/lib/admin-auth";
import { isAutomationRequest } from "@/lib/automation-auth";
import { jsonError, noStoreHeaders } from "@/lib/api";
import { processEditorialImageQueue } from "@/lib/editorial-image-queue";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(request: Request) {
  const admin = isAdminRequest(request);
  if (!admin && !await isAutomationRequest(request)) return jsonError("Unauthorized", 401);
  try {
    const result = await processEditorialImageQueue(admin ? new URL(request.url).searchParams.get("contentId") || "" : "");
    if (result.status === "ready") {
      revalidatePath("/security-advisories", "layout");
      revalidatePath("/resources", "layout");
    }
    return NextResponse.json({ ok: true, result }, { headers: noStoreHeaders });
  } catch {
    return jsonError("Image worker unavailable. Existing articles and artwork are unchanged.", 503);
  }
}
