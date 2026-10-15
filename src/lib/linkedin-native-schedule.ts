import { Prisma } from "@prisma/client";
import { ccnaContentDigest, ccnaReviewedRevisionIssues } from "@/lib/ccna-generation-pipeline";
import { getPrismaClient } from "@/lib/prisma";
import { ccnaLessonContentSchema } from "@/lib/ccna-lesson-schema";

type PublicationClient = Pick<Prisma.TransactionClient, "socialPublication">;

export function hasNativeLinkedInOwnership(metadata: unknown): boolean {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return false;
  const value = metadata as Record<string, unknown>;
  const plan = value.plannedDelivery as Record<string, unknown> | undefined;
  return !!value.nativeScheduleReceipt || plan?.provider === "linkedin-native-scheduler";
}

export async function nativeLinkedInOwner(client: PublicationClient, contentType: string, contentId: string) {
  const jobs = await client.socialPublication.findMany({ where: { channel: "linkedin", contentType, contentId } });
  return jobs.find(job => hasNativeLinkedInOwnership(job.metadata));
}

export async function assertApplicationLinkedInOwnership(client: PublicationClient, contentType: string, contentId: string) {
  if (await nativeLinkedInOwner(client, contentType, contentId)) {
    throw new Error("LinkedIn manages this post in its native scheduler. Reconcile that schedule before using application queue, refresh or rebuild controls.");
  }
}

export async function recordCcnaNativeScheduleReceipt(input: {
  lessonId: string;
  jobId: string;
  publicationRevision: string;
  contentDigest: string;
  commentary: string;
  scheduledUtc: string;
  confirmedAt: string;
  receipt: Prisma.InputJsonObject;
}) {
  return getPrismaClient().$transaction(async tx => {
    const lesson = await tx.ccnaLesson.findUniqueOrThrow({ where: { id: input.lessonId } });
    const parsed = ccnaLessonContentSchema.safeParse(lesson.content);
    if (lesson.status !== "published" || lesson.updatedAt.toISOString() !== input.publicationRevision
      || ccnaContentDigest(lesson.content) !== input.contentDigest
      || !parsed.success || ccnaReviewedRevisionIssues(parsed.data, lesson.generationTrace).length) {
      throw new Error("The website lesson is unpublished, changed or no longer independently reviewed. Preserve the browser receipt and reconcile the native schedule; do not mark this release complete.");
    }
    const job = await tx.socialPublication.findUniqueOrThrow({ where: { id: input.jobId } });
    if (job.channel !== "linkedin" || job.contentType !== "ccna_lesson" || job.contentId !== input.lessonId
      || job.contentRevision !== input.publicationRevision || job.status !== "held" || job.externalId
      || job.commentary !== input.commentary || !hasNativeLinkedInOwnership(job.metadata)) {
      throw new Error("The held native delivery no longer matches the reviewed release. Reconcile it without overwriting.");
    }
    const metadata = job.metadata as Prisma.JsonObject;
    const plan = metadata.plannedDelivery as Prisma.JsonObject;
    if (plan?.notBefore !== input.scheduledUtc) throw new Error("The native schedule differs from the reserved release time.");
    const saved = await tx.socialPublication.updateMany({
      where: { id: job.id, updatedAt: job.updatedAt, status: "held", externalId: null },
      data: { lastError: null, metadata: {
        ...metadata,
        plannedDelivery: { ...plan, status: "scheduled-in-linkedin", confirmedAt: input.confirmedAt },
        nativeScheduleReceipt: input.receipt
      } as Prisma.InputJsonObject }
    });
    if (saved.count !== 1) throw new Error("Social delivery changed while reconciling the receipt.");
    return job.id;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}
