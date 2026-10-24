import { z } from "zod";
import { ccnaLessonContentSchema } from "./ccna-lesson-schema";
import type { CcnaLessonRecord } from "./ccna-learning";

export type PublicCcnaLesson = Pick<CcnaLessonRecord,
  "id" | "sequence" | "week" | "day" | "slug" | "title" | "moduleId" | "moduleTitle" |
  "examDomain" | "v11Blueprint" | "v20Blueprint" | "status" | "publishedAt" | "updatedAt" | "content">;

const approvedSlugs = new Map([
  [14, "slaac-eui64-and-neighbor-discovery"],
  [15, "cisco-ios-cli-workflow"],
  [16, "ethernet-switching-and-mac-learning"]
]);
const timestamp = z.string().datetime();
const publicLessonSchema = z.object({
  id: z.string().min(1), sequence: z.number().int(), week: z.number().int().positive(), day: z.number().int().min(1).max(5),
  slug: z.string(), title: z.string().min(1), moduleId: z.string(), moduleTitle: z.string(), examDomain: z.string(),
  v11Blueprint: z.string(), v20Blueprint: z.string(), status: z.literal("published"),
  publishedAt: timestamp, updatedAt: timestamp, content: ccnaLessonContentSchema
}).strict();

export const ccnaRecoveryDatabaseHoldUntil = "2026-11-01T00:00:00.000Z";

export function validatePublicCcnaRecovery(input: unknown): PublicCcnaLesson[] {
  const lessons = z.array(publicLessonSchema).length(3).parse(input);
  if (new Set(lessons.map(lesson => lesson.sequence)).size !== 3 || lessons.some(lesson =>
    approvedSlugs.get(lesson.sequence) !== lesson.slug ||
    lesson.week !== Math.ceil(lesson.sequence / 5) || lesson.day !== (lesson.sequence - 1) % 5 + 1 ||
    Date.parse(lesson.updatedAt) < Date.parse(lesson.publishedAt)
  )) throw new Error("The public recovery bundle must contain only verified Days 14-16.");
  return lessons.sort((a, b) => a.sequence - b.sequence);
}

function unavailable(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const { code, message } = error as { code?: string; message?: string };
  return ["P1001", "P1002", "P1017", "P2024", "53000"].includes(code || "") ||
    /DATABASE_URL is required|exceeded.*(?:quota|data transfer)|(?:quota|data transfer).*exceeded|compute.*suspend/i.test(message || "");
}

export function createPublicCcnaReader(recovery: PublicCcnaLesson[], live: {
  bySlug: (slug: string) => Promise<PublicCcnaLesson | null>;
  list: (limit: number) => Promise<PublicCcnaLesson[]>;
}, now = () => Date.now()) {
  const offline = () => now() < Date.parse(ccnaRecoveryDatabaseHoldUntil);
  return {
    async bySlug(slug: string) {
      const snapshot = recovery.find(lesson => lesson.slug === slug) || null;
      // The explicitly approved outage window must not repeatedly query suspended Neon.
      if (offline()) return snapshot;
      try { return await live.bySlug(slug); }
      catch (error) { if (snapshot && unavailable(error)) return snapshot; throw error; }
    },
    async list(limit = 100) {
      const count = Number.isFinite(limit) ? Math.max(1, Math.min(Math.trunc(limit), 100)) : 100;
      if (offline()) return recovery.slice(0, count);
      // A healthy empty result is authoritative: never resurrect a withdrawn lesson.
      try { return await live.list(count); }
      catch (error) { if (unavailable(error)) return recovery.slice(0, count); throw error; }
    }
  };
}
