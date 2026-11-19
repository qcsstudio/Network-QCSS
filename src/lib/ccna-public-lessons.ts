import "server-only";
import recovery from "@/content/ccna-public-recovery.json";
import { createPublicCcnaReader, validatePublicCcnaRecovery } from "./ccna-public-recovery";
import { publicCcnaBySlug, publicCcnaList } from "./public-ccna-reader";
import { cache } from "react";

// Only public pages use these readers. Admin, review and distribution retain live DB ownership.
const reader = createPublicCcnaReader(validatePublicCcnaRecovery(recovery), {
  bySlug: publicCcnaBySlug,
  list: publicCcnaList
});

export const getPublicCcnaLessonBySlug = cache(reader.bySlug);
export const getPublicCcnaLessons = cache(reader.list);
