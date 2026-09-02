import { NextResponse } from "next/server";
import { jsonError, noStoreHeaders } from "@/lib/api";
import { isAutomationRequest } from "@/lib/automation-auth";
import { runCcnaDailyEdition } from "@/lib/ccna-learning";
import { queueLinkedInForCcnaLesson } from "@/lib/social-publications";
import { requestContext } from "@/lib/security";
import { createAuditLog } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(request: Request) {
  if (!(await isAutomationRequest(request))) return jsonError("Unauthorized", 401);
  try {
    const result = await runCcnaDailyEdition({ actor: "ccna-daily-automation", force: new URL(request.url).searchParams.get("runNow") === "1" });
    let distribution = null;
    if ("lesson" in result && result.lesson?.status === "published") distribution = await queueLinkedInForCcnaLesson(result.lesson);
    await createAuditLog({ action: "ccna.daily_run", actor: "automation-worker", target: "ccna-daily", metadata: { result, distributionId: distribution?.id } }, await requestContext());
    return NextResponse.json({ ok: true, result, distributionId: distribution?.id || "" }, { headers: noStoreHeaders });
  } catch (error) {
    console.error("CCNA daily automation failed.", error);
    return jsonError(error instanceof Error ? error.message : "CCNA daily automation failed.", 500);
  }
}
