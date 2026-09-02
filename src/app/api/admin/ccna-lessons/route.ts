import { NextResponse } from "next/server";
import { z } from "zod";
import { getAdminSession, isAdminRequest } from "@/lib/admin-auth";
import { jsonError, noStoreHeaders, readJsonBody } from "@/lib/api";
import { generateCcnaLesson, listCcnaLessons, publishCcnaLesson, returnCcnaLessonToDraft, runCcnaDailyEdition, skipCcnaLesson, syncCcnaCurriculum } from "@/lib/ccna-learning";
import { queueLinkedInForCcnaLesson } from "@/lib/social-publications";
import { rateLimit } from "@/lib/rate-limit";
import { requestContext } from "@/lib/security";
import { createAuditLog } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const actionSchema = z.object({
  action: z.enum(["draft", "generate", "publish", "queue_linkedin", "run_today", "skip", "sync"]),
  id: z.string().trim().max(120).optional()
});

export async function GET(request: Request) {
  if (!isAdminRequest(request)) return jsonError("Unauthorized", 401);
  await syncCcnaCurriculum("admin-read");
  return NextResponse.json({ ok: true, lessons: await listCcnaLessons() }, { headers: noStoreHeaders });
}

export async function POST(request: Request) {
  const limited = rateLimit(request, { keyPrefix: "ccna-admin", max: 12, windowMs: 60_000 });
  if (limited) return limited;
  if (!isAdminRequest(request)) return jsonError("Unauthorized", 401);
  const actor = (await getAdminSession())?.email || "admin";
  const body = await readJsonBody(request);
  if (!body.ok) return body.response;
  const parsed = actionSchema.safeParse(body.data);
  if (!parsed.success) return jsonError(parsed.error.issues.map((issue) => issue.message).join(" "), 400);
  const { action, id } = parsed.data;
  try {
    let result: unknown;
    if (action === "sync") result = { synchronized: await syncCcnaCurriculum(actor) };
    else if (action === "run_today") {
      const daily = await runCcnaDailyEdition({ actor, force: true });
      if ("lesson" in daily && daily.lesson?.status === "published") await queueLinkedInForCcnaLesson(daily.lesson);
      result = daily;
    } else {
      if (!id) return jsonError("A CCNA lesson id is required.", 400);
      if (action === "generate") result = await generateCcnaLesson(id, actor, false);
      if (action === "publish") {
        const lesson = await publishCcnaLesson(id, actor);
        await queueLinkedInForCcnaLesson(lesson);
        result = lesson;
      }
      if (action === "draft") result = await returnCcnaLessonToDraft(id);
      if (action === "skip") result = await skipCcnaLesson(id, actor);
      if (action === "queue_linkedin") {
        const lesson = (await listCcnaLessons()).find((item) => item.id === id);
        if (!lesson) throw new Error("CCNA lesson not found.");
        result = await queueLinkedInForCcnaLesson(lesson);
      }
    }
    await createAuditLog({ action: `ccna.${action}`, actor, target: id || "ccna-daily", metadata: { result } }, await requestContext());
    return NextResponse.json({ ok: true, result, lessons: await listCcnaLessons() }, { headers: noStoreHeaders });
  } catch (error) {
    console.error(`CCNA admin action ${action} failed.`, error);
    return jsonError(error instanceof Error ? error.message : "The CCNA action failed.", 400);
  }
}
