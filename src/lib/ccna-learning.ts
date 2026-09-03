import { Prisma, type CcnaLesson } from "@prisma/client";
import { ccnaCurriculum, ccnaTopicBySlug } from "@/lib/ccna-curriculum";
import { generateResearchedCcnaLesson } from "@/lib/ccna-content-agent";
import { ccnaLessonContentSchema, evaluateCcnaLessonQuality, type CcnaLessonContent } from "@/lib/ccna-lesson-schema";
import { getPrismaClient } from "@/lib/prisma";

export type CcnaLessonStatus = "scheduled" | "generating" | "retry" | "needs_review" | "draft" | "published" | "skipped";

export type CcnaLessonRecord = {
  id: string;
  sequence: number;
  week: number;
  day: number;
  slug: string;
  title: string;
  moduleId: string;
  moduleTitle: string;
  examDomain: string;
  v11Blueprint: string;
  v20Blueprint: string;
  status: CcnaLessonStatus;
  scheduledFor: string;
  publishedAt: string;
  content: CcnaLessonContent | null;
  qualityScore: number;
  attempts: number;
  lastError: string;
  updatedAt: string;
};

function status(value: string): CcnaLessonStatus {
  return ["scheduled", "generating", "retry", "needs_review", "draft", "published", "skipped"].includes(value)
    ? (value as CcnaLessonStatus)
    : "needs_review";
}

function content(value: Prisma.JsonValue): CcnaLessonContent | null {
  const parsed = ccnaLessonContentSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

function mapLesson(lesson: CcnaLesson): CcnaLessonRecord {
  return {
    id: lesson.id,
    sequence: lesson.sequence,
    week: Math.ceil(lesson.sequence / 5),
    day: ((lesson.sequence - 1) % 5) + 1,
    slug: lesson.slug,
    title: lesson.title,
    moduleId: lesson.moduleId,
    moduleTitle: lesson.moduleTitle,
    examDomain: lesson.examDomain,
    v11Blueprint: lesson.v11Blueprint,
    v20Blueprint: lesson.v20Blueprint || "",
    status: status(lesson.status),
    scheduledFor: lesson.scheduledFor?.toISOString() || "",
    publishedAt: lesson.publishedAt?.toISOString() || "",
    content: content(lesson.content),
    qualityScore: lesson.qualityScore || 0,
    attempts: lesson.attempts,
    lastError: lesson.lastError || "",
    updatedAt: lesson.updatedAt.toISOString()
  };
}

function indiaClock(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23",
    weekday: "short"
  }).formatToParts(now);
  const value = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value || "";
  return {
    date: `${value("year")}-${value("month")}-${value("day")}`,
    hour: Number(value("hour")),
    weekday: value("weekday")
  };
}

function indiaDayStart(date: string) {
  return new Date(`${date}T00:00:00+05:30`);
}

export async function syncCcnaCurriculum(actor = "system") {
  const prisma = getPrismaClient();
  const existing = await prisma.ccnaLesson.findMany({
    select: {
      sequence: true,
      slug: true,
      title: true,
      moduleId: true,
      moduleTitle: true,
      examDomain: true,
      v11Blueprint: true,
      v20Blueprint: true
    }
  });
  const bySequence = new Map(existing.map((lesson) => [lesson.sequence, lesson]));
  const missing = ccnaCurriculum.filter((topic) => !bySequence.has(topic.sequence));
  if (missing.length) {
    await prisma.ccnaLesson.createMany({
      data: missing.map((topic) => ({
        sequence: topic.sequence,
        slug: topic.slug,
        title: topic.title,
        moduleId: topic.moduleId,
        moduleTitle: topic.moduleTitle,
        examDomain: topic.domain,
        v11Blueprint: topic.v11,
        v20Blueprint: topic.v20,
        createdBy: actor
      })),
      skipDuplicates: true
    });
  }
  const changed = ccnaCurriculum.filter((topic) => {
    const lesson = bySequence.get(topic.sequence);
    return lesson && (
      lesson.slug !== topic.slug ||
      lesson.title !== topic.title ||
      lesson.moduleId !== topic.moduleId ||
      lesson.moduleTitle !== topic.moduleTitle ||
      lesson.examDomain !== topic.domain ||
      lesson.v11Blueprint !== topic.v11 ||
      lesson.v20Blueprint !== topic.v20
    );
  });
  for (let index = 0; index < changed.length; index += 10) {
    await prisma.$transaction(changed.slice(index, index + 10).map((topic) => prisma.ccnaLesson.update({
      where: { sequence: topic.sequence },
      data: {
        slug: topic.slug,
        title: topic.title,
        moduleId: topic.moduleId,
        moduleTitle: topic.moduleTitle,
        examDomain: topic.domain,
        v11Blueprint: topic.v11,
        v20Blueprint: topic.v20
      }
    })));
  }
  return prisma.ccnaLesson.count();
}

export async function listCcnaLessons() {
  const records = await getPrismaClient().ccnaLesson.findMany({ orderBy: { sequence: "asc" } });
  return records.map(mapLesson);
}

export async function getCcnaLessonById(id: string) {
  const record = await getPrismaClient().ccnaLesson.findUnique({ where: { id } });
  return record ? mapLesson(record) : null;
}

export async function getPublishedCcnaLessonBySlug(slug: string) {
  const record = await getPrismaClient().ccnaLesson.findFirst({ where: { slug, status: "published" } });
  return record ? mapLesson(record) : null;
}

export async function getPublishedCcnaLessons(limit = 100) {
  const records = await getPrismaClient().ccnaLesson.findMany({
    where: { status: "published" },
    orderBy: { sequence: "asc" },
    take: Math.max(1, Math.min(limit, 100))
  });
  return records.map(mapLesson);
}

export async function getLatestPublishedCcnaLesson() {
  const record = await getPrismaClient().ccnaLesson.findFirst({ where: { status: "published" }, orderBy: { publishedAt: "desc" } });
  return record ? mapLesson(record) : null;
}

export async function generateCcnaLesson(id: string, actor: string, publishWhenReady: boolean, scheduledFor?: Date) {
  const prisma = getPrismaClient();
  const existing = await prisma.ccnaLesson.findUnique({ where: { id } });
  if (!existing) throw new Error("CCNA lesson not found.");
  const topic = ccnaTopicBySlug(existing.slug);
  if (!topic) throw new Error("This lesson is not mapped to the controlled CCNA curriculum.");
  if (existing.status === "published" && !publishWhenReady) throw new Error("Return the lesson to draft before regenerating it.");

  const claimed = await prisma.ccnaLesson.updateMany({
    where: {
      id,
      OR: [{ status: { not: "generating" } }, { generationStartedAt: null }, { generationStartedAt: { lte: new Date(Date.now() - 20 * 60_000) } }]
    },
    data: {
      attempts: { increment: 1 },
      generationStartedAt: new Date(),
      lastError: null,
      qualityScore: null,
      status: "generating"
    }
  });
  if (!claimed.count) throw new Error("This CCNA lesson is already being generated.");

  try {
    const generated = await generateResearchedCcnaLesson(topic);
    const nextStatus: CcnaLessonStatus = generated.quality.ready && publishWhenReady ? "published" : generated.quality.ready ? "draft" : "needs_review";
    const sourceValue = generated.content.sources.map((source) => ({ label: source.label, url: source.url, supports: source.supports }));
    const record = await prisma.ccnaLesson.update({
      where: { id },
      data: {
        approvedAt: nextStatus === "published" ? new Date() : null,
        approvedBy: nextStatus === "published" ? actor : null,
        content: generated.content as unknown as Prisma.InputJsonValue,
        generationStartedAt: null,
        generationTrace: generated.trace as unknown as Prisma.InputJsonValue,
        lastError: generated.quality.ready ? null : generated.quality.issues.join(" "),
        nextAttemptAt: new Date(Date.now() + 30 * 60_000),
        publishedAt: nextStatus === "published" ? new Date() : null,
        qualityScore: generated.quality.score,
        scheduledFor: scheduledFor || existing.scheduledFor,
        sources: sourceValue as unknown as Prisma.InputJsonValue,
        status: nextStatus
      }
    });
    return mapLesson(record);
  } catch (error) {
    const current = await prisma.ccnaLesson.findUniqueOrThrow({ where: { id } });
    const retry = current.attempts < 3;
    const message = error instanceof Error ? error.message.slice(0, 1_800) : "Unknown CCNA lesson generation error";
    await prisma.ccnaLesson.update({
      where: { id },
      data: {
        generationStartedAt: null,
        lastError: message,
        nextAttemptAt: new Date(Date.now() + Math.max(10, current.attempts * 10) * 60_000),
        status: retry ? "retry" : "needs_review"
      }
    });
    throw error;
  }
}

export async function publishCcnaLesson(id: string, actor: string) {
  const prisma = getPrismaClient();
  const existing = await prisma.ccnaLesson.findUnique({ where: { id } });
  if (!existing) throw new Error("CCNA lesson not found.");
  const parsed = ccnaLessonContentSchema.safeParse(existing.content);
  if (!parsed.success) throw new Error("Generate a complete structured lesson before publishing.");
  const quality = evaluateCcnaLessonQuality(parsed.data);
  if (!quality.ready) throw new Error(`CCNA lesson held by quality gate: ${quality.issues.join(" ")}`);
  const trace = existing.generationTrace as { editorialReview?: { passed?: boolean; issues?: unknown[] } } | null;
  if (!trace?.editorialReview?.passed || !Array.isArray(trace.editorialReview.issues) || trace.editorialReview.issues.length) {
    throw new Error("Regenerate this lesson to complete its independent technical and teaching review before publication.");
  }
  const record = await prisma.ccnaLesson.update({
    where: { id },
    data: {
      approvedAt: new Date(),
      approvedBy: actor,
      lastError: null,
      publishedAt: new Date(),
      qualityScore: quality.score,
      status: "published"
    }
  });
  return mapLesson(record);
}

export async function returnCcnaLessonToDraft(id: string) {
  const record = await getPrismaClient().ccnaLesson.update({
    where: { id },
    data: { approvedAt: null, approvedBy: null, publishedAt: null, status: "draft" }
  });
  return mapLesson(record);
}

export async function skipCcnaLesson(id: string, actor: string) {
  const record = await getPrismaClient().ccnaLesson.update({
    where: { id },
    data: { approvedBy: actor, lastError: "Skipped by an authenticated operator.", status: "skipped" }
  });
  return mapLesson(record);
}

export async function runCcnaDailyEdition(options: { actor: string; force?: boolean } = { actor: "automation-worker" }) {
  const clock = indiaClock();
  if (!options.force && (["Sat", "Sun"].includes(clock.weekday) || clock.hour < 8)) {
    return { action: "not_due", date: clock.date, reason: "CCNA Daily runs after 08:00 Asia/Kolkata on weekdays." } as const;
  }
  const start = indiaDayStart(clock.date);
  const end = new Date(start.getTime() + 24 * 60 * 60_000);
  const prisma = getPrismaClient();
  const today = await prisma.ccnaLesson.findFirst({
    where: { status: "published", scheduledFor: { gte: start, lt: end } },
    orderBy: { sequence: "asc" }
  });
  if (today) return { action: "already_published", date: clock.date, lesson: mapLesson(today) } as const;

  await syncCcnaCurriculum(options.actor);

  const next = await prisma.ccnaLesson.findFirst({
    where: { status: { notIn: ["published", "skipped"] } },
    orderBy: { sequence: "asc" }
  });
  if (!next) return { action: "course_complete", date: clock.date } as const;
  const activeGeneration = next.status === "generating" && next.generationStartedAt && next.generationStartedAt.getTime() > Date.now() - 20 * 60_000;
  if (["draft", "needs_review"].includes(next.status) || activeGeneration) {
    return { action: "held", date: clock.date, lesson: mapLesson(next), reason: next.lastError || "The next lesson needs operator review." } as const;
  }
  if (next.nextAttemptAt > new Date()) {
    return { action: "retry_wait", date: clock.date, lesson: mapLesson(next), retryAt: next.nextAttemptAt.toISOString() } as const;
  }
  const lesson = await generateCcnaLesson(next.id, options.actor, true, start);
  return { action: lesson.status === "published" ? "published" : "held", date: clock.date, lesson } as const;
}
