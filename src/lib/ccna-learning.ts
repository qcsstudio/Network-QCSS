import { Prisma, type CcnaLesson } from "@prisma/client";
import { ccnaCurriculum, ccnaTopicBySlug } from "@/lib/ccna-curriculum";
import { evaluateCcnaLessonForTopic, generateResearchedCcnaLesson } from "@/lib/ccna-content-agent";
import { CcnaLessonOutputError } from "@/lib/ccna-lesson-writer";
import { CcnaGenerationValidationError, ccnaReviewedRevisionIssues } from "@/lib/ccna-generation-pipeline";
import { ccnaLessonContentSchema, type CcnaLessonContent } from "@/lib/ccna-lesson-schema";
import { getPrismaClient } from "@/lib/prisma";
import { visualStoryForLesson } from "@/lib/ccna-visual-story";
import { ccnaCheckpointRunLimit, readCcnaGenerationCheckpoint, type CcnaGenerationCheckpoint } from "@/lib/ccna-generation-checkpoint";
import { CcnaRequestDeferredError } from "@/lib/ccna-openai-requests";

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
  generationProgress?: { completedSteps: number; stage: string; retryAt: string };
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
  const trace = generationTrace(lesson.generationTrace);
  const checkpoint = resumableCheckpoint(lesson.status, trace);
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
    updatedAt: lesson.updatedAt.toISOString(),
    ...(checkpoint ? { generationProgress: {
      completedSteps: checkpoint.entries.length,
      stage: typeof trace.waitingStage === "string" ? trace.waitingStage : checkpoint.entries.at(-1)?.stage || "source research",
      retryAt: lesson.status === "retry" ? lesson.nextAttemptAt.toISOString() : ""
    } } : {})
  };
}

function generationTrace(value: Prisma.JsonValue): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function resumableCheckpoint(status: string, trace: Record<string, unknown>) {
  const checkpoint = readCcnaGenerationCheckpoint(trace.checkpoint);
  if (!checkpoint) return null;
  if (["retry", "generating"].includes(status)) return checkpoint;
  // An explicit retry after correcting a provider/schema problem may reuse
  // completed research. Technical failures and exhausted jobs start fresh.
  return status === "needs_review" && typeof trace.operationalError === "string" && checkpoint.runs < ccnaCheckpointRunLimit ? checkpoint : null;
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

  const trace = generationTrace(existing.generationTrace);
  if (["rate_limit", "deadline"].includes(String(trace.pauseReason)) && existing.nextAttemptAt.getTime() > Date.now()) {
    throw new CcnaRequestDeferredError(trace.pauseReason as "rate_limit" | "deadline", existing.nextAttemptAt.getTime() - Date.now(), String(trace.waitingStage || "saved lesson"));
  }
  const previousCheckpoint = resumableCheckpoint(existing.status, trace);
  const shouldPublish = previousCheckpoint && typeof trace.publishWhenReady === "boolean" ? trace.publishWhenReady : publishWhenReady;
  const runStartedAt = new Date();
  let checkpoint: CcnaGenerationCheckpoint | null = previousCheckpoint;
  const ownership = { id, status: "generating", generationStartedAt: runStartedAt };

  const claimed = await prisma.ccnaLesson.updateMany({
    where: {
      id,
      updatedAt: existing.updatedAt,
      OR: [{ status: { not: "generating" } }, { generationStartedAt: null }, { generationStartedAt: { lte: new Date(Date.now() - 20 * 60_000) } }]
    },
    data: {
      attempts: { increment: 1 },
      generationStartedAt: runStartedAt,
      lastError: null,
      qualityScore: null,
      status: "generating"
    }
  });
  if (!claimed.count) throw new Error("This CCNA lesson is already being generated.");

  try {
    const recent = await prisma.ccnaLesson.findMany({ where: { status: "published", id: { not: id } }, orderBy: { publishedAt: "desc" }, take: 8 });
    const recentVisuals = recent.flatMap((record) => {
      const story = visualStoryForLesson(mapLesson(record));
      return story ? [`${record.title}: ${story.conceptSelection.candidates[story.conceptSelection.selectedIndex].scene}`] : [];
    });
    const generated = await generateResearchedCcnaLesson(topic, recentVisuals, {
      checkpoint: previousCheckpoint,
      contentRevision: existing.content,
      onCheckpoint: async (saved) => {
        const result = await prisma.ccnaLesson.updateMany({ where: ownership, data: {
          generationTrace: { checkpoint: saved, publishWhenReady: shouldPublish } as unknown as Prisma.InputJsonValue
        } });
        if (!result.count) throw new Error("CCNA generation ownership changed. The previous worker stopped without publishing.");
        checkpoint = saved;
      }
    });
    const nextStatus: CcnaLessonStatus = generated.quality.ready && shouldPublish ? "published" : generated.quality.ready ? "draft" : "needs_review";
    const sourceValue = generated.content.sources.map((source) => ({ label: source.label, url: source.url, supports: source.supports }));
    const saved = await prisma.ccnaLesson.updateMany({
      where: ownership,
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
    if (!saved.count) throw new Error("CCNA generation ownership changed. The previous worker stopped without publishing.");
    return mapLesson(await prisma.ccnaLesson.findUniqueOrThrow({ where: { id } }));
  } catch (error) {
    const current = await prisma.ccnaLesson.findUniqueOrThrow({ where: { id } });
    const validationFailure = error instanceof CcnaGenerationValidationError;
    const outputFailure = error instanceof CcnaLessonOutputError;
    const deferred = error instanceof CcnaRequestDeferredError;
    const retry = deferred && error.reason !== "request_too_large" && !!checkpoint && checkpoint.runs < ccnaCheckpointRunLimit;
    const nextAttemptAt = new Date(Date.now() + (deferred ? Math.max(1_000, error.retryAfterMs) : Math.max(10, current.attempts * 10) * 60_000));
    const message = error instanceof Error ? error.message : "Unknown CCNA lesson generation error";
    const progressMessage = deferred && checkpoint ? ` ${checkpoint.entries.length} completed stages are saved.${retry ? " Resume after the cooldown; completed requests will be reused." : " Automatic continuation is held for operator review."}` : "";
    await prisma.ccnaLesson.updateMany({
      where: ownership,
      data: {
        generationStartedAt: null,
        lastError: message + progressMessage,
        generationTrace: { ...(checkpoint ? { checkpoint } : {}), publishWhenReady: shouldPublish,
          ...(deferred ? { pauseReason: error.reason, waitingStage: error.stage } : { operationalError: message })
        } as unknown as Prisma.InputJsonValue,
        ...(validationFailure ? { generationTrace: { validationPolicyVersion: 1, validationPasses: error.passes, editorialReview: { passed: false, issues: error.issues }, reviewWasRun: error.passes.some((pass) => pass.reviewWasRun) } as unknown as Prisma.InputJsonValue } : {}),
        ...(outputFailure ? { generationTrace: { writingResponses: error.attempts, editorialReview: { passed: false, issues: [message] }, reviewWasRun: error.attempts.some((attempt) => attempt.stage === "independent technical review") } as unknown as Prisma.InputJsonValue } : {}),
        nextAttemptAt,
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
  if (["generating", "retry"].includes(existing.status)) throw new Error("Finish the active CCNA generation and independent review before publishing.");
  const topic = ccnaTopicBySlug(existing.slug);
  if (!topic) throw new Error("This lesson is not mapped to the controlled CCNA curriculum.");
  const parsed = ccnaLessonContentSchema.safeParse(existing.content);
  if (!parsed.success) throw new Error("Generate a complete structured lesson before publishing.");
  const quality = evaluateCcnaLessonForTopic(topic, parsed.data);
  const issues = [...quality.issues, ...ccnaReviewedRevisionIssues(parsed.data, existing.generationTrace)];
  if (issues.length) throw new Error(`CCNA lesson held by quality gate: ${issues.join(" ")}`);
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
