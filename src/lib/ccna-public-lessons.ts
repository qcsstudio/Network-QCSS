import "server-only";
import recovery from "@/content/ccna-public-recovery.json";
import { createPublicCcnaReader, validatePublicCcnaRecovery } from "./ccna-public-recovery";

// Only public pages use these readers. Admin, review and distribution retain live DB ownership.
const reader = createPublicCcnaReader(validatePublicCcnaRecovery(recovery), {
  bySlug: async slug => (await import("./ccna-learning")).getPublishedCcnaLessonBySlug(slug),
  list: async limit => (await import("./ccna-learning")).getPublishedCcnaLessons(limit)
});

export const getPublicCcnaLessonBySlug = reader.bySlug;
export const getPublicCcnaLessons = reader.list;
