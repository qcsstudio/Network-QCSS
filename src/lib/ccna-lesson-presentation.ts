import type { CcnaLessonContent } from "./ccna-lesson-schema.ts";

export function ccnaComparisonBoundary(content: Pick<CcnaLessonContent, "teachingPrelude">, passages: string[]) {
  return /\b(?:access[ -]points?|firewalls?)\b/i.test(passages.join(" ")) ? content.teachingPrelude?.labBoundary : undefined;
}

export function ccnaSectionBoundary(content: CcnaLessonContent, section: CcnaLessonContent["sections"][number]) {
  const legacy = section.keyPoints.find((point) => /^Lab boundary:/i.test(point));
  return ccnaComparisonBoundary(content, [section.heading, section.explanation, section.example, ...section.keyPoints])
    || (legacy ? content.teachingPrelude?.labBoundary || legacy : undefined);
}
