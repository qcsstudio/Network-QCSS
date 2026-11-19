import { getPrismaClient } from "./prisma.ts";
import { readPublicSnapshot } from "./public-read-cache.ts";
import { ccnaLessonContentSchema } from "./ccna-lesson-schema.ts";
import type { PublicCcnaLesson } from "./ccna-public-recovery";

const metadata = {
  id: true, sequence: true, slug: true, title: true, moduleId: true, moduleTitle: true,
  examDomain: true, v11Blueprint: true, v20Blueprint: true, status: true,
  publishedAt: true, updatedAt: true
} as const;

export async function publicCcnaBySlug(slug: string): Promise<PublicCcnaLesson | null> {
  const lessons = getPrismaClient().ccnaLesson;
  const result = await readPublicSnapshot(`ccna:${slug}`, () => lessons.findFirst({
    where: { slug, status: "published" }, select: { id: true, updatedAt: true }
  }), async current => current ? lessons.findFirst({
    where: { id: current.id, updatedAt: current.updatedAt, status: "published" },
    select: { ...metadata, content: true }
  }) : null);
  const row = result.data;
  if (!row) return null;
  const parsed = ccnaLessonContentSchema.safeParse(row.content);
  return { ...row, status: "published", week: Math.ceil(row.sequence / 5), day: (row.sequence - 1) % 5 + 1,
    v20Blueprint: row.v20Blueprint || "", content: parsed.success ? parsed.data : null,
    publishedAt: row.publishedAt?.toISOString() || "", updatedAt: row.updatedAt.toISOString() };
}

export async function publicCcnaList(limit = 100): Promise<PublicCcnaLesson[]> {
  // Syllabus and previous/next navigation need metadata, never all 60 lesson bodies.
  const rows = await getPrismaClient().ccnaLesson.findMany({ where: { status: "published" },
    orderBy: { sequence: "asc" }, take: Number.isFinite(limit) ? Math.max(1, Math.min(Math.trunc(limit), 100)) : 100,
    select: metadata });
  return rows.map(row => ({ ...row, status: "published", content: null,
    week: Math.ceil(row.sequence / 5), day: (row.sequence - 1) % 5 + 1,
    v20Blueprint: row.v20Blueprint || "", publishedAt: row.publishedAt?.toISOString() || "",
    updatedAt: row.updatedAt.toISOString() }));
}
