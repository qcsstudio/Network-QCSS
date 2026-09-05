import { createHash } from "node:crypto";
import { z } from "zod";
import { consolidateCcnaCitations } from "./ccna-citations.ts";
import { ccnaGeneratedLessonSchema, ccnaReviewableLessonSchema, type CcnaLessonContent, type evaluateCcnaLessonQuality } from "./ccna-lesson-schema.ts";

type Quality = ReturnType<typeof evaluateCcnaLessonQuality>;
export const ccnaTechnicalReviewSchema = z.object({
  passed: z.boolean(),
  issues: z.array(z.string().min(20).max(500)).max(10)
}).refine((review) => review.passed === (review.issues.length === 0), "A passing review must have no issues; a failed review must explain what to repair.");
type Review = z.infer<typeof ccnaTechnicalReviewSchema>;
type Inspection = { candidate: unknown; content: CcnaLessonContent | null; quality: Quality };
type Pass = { attempt: number; schemaPassed: boolean; reviewWasRun: boolean; reviewPassed: boolean; contentDigest: string; issues: string[] };

export function ccnaContentDigest(content: unknown) {
  function ordered(value: unknown): unknown {
    if (Array.isArray(value)) return value.map(ordered);
    if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([key, item]) => [key, ordered(item)]));
    return value;
  }
  return createHash("sha256").update(JSON.stringify(ordered(content))).digest("hex");
}

export function ccnaReviewedRevisionIssues(content: CcnaLessonContent, trace: unknown) {
  if (!trace || typeof trace !== "object") return ["Complete an independent review of this lesson before publishing."];
  const saved = trace as { editorialReview?: unknown; reviewedContentDigest?: unknown };
  const review = ccnaTechnicalReviewSchema.safeParse(saved.editorialReview);
  const issues: string[] = [];
  if (!review.success || !review.data.passed) issues.push("The latest lesson has not passed independent technical and teaching review.");
  if (saved.reviewedContentDigest !== ccnaContentDigest(content)) issues.push("Generate and review the current lesson revision before publishing; approval must match the exact saved content.");
  return issues;
}

export class CcnaGenerationValidationError extends Error {
  constructor(public readonly passes: Pass[], public readonly issues: string[]) {
    super(`CCNA lesson held after ${passes.length} validation pass(es):\n${issues.join("\n")}`);
    this.name = "CcnaGenerationValidationError";
  }
}

function schemaIssues(error: z.ZodError) {
  return error.issues.map((issue) => `${issue.path.join(".") || "lesson"}: ${issue.message}. Rewrite the affected field completely; never truncate it.`);
}

export function inspectCcnaLessonCandidate(text: string, options: {
  allowedSources: string[];
  prepare: (content: CcnaLessonContent) => CcnaLessonContent;
  evaluate: (content: CcnaLessonContent) => Quality;
}): Inspection {
  let candidate: unknown;
  try { candidate = JSON.parse(text); } catch {
    return { candidate: text, content: null, quality: { ready: false, score: 0, usefulWords: 0, issues: ["Return a complete valid lesson JSON object, without fences, partial JSON, or commentary."] } };
  }
  const consolidated = consolidateCcnaCitations(candidate, options.allowedSources);
  candidate = consolidated.candidate;
  const issues = [...consolidated.issues];
  const parsed = ccnaReviewableLessonSchema.safeParse(candidate);
  if (!parsed.success) {
    return { candidate, content: null, quality: { ready: false, score: 0, usefulWords: 0, issues: [...issues, ...schemaIssues(parsed.error)] } };
  }
  let content = parsed.data;
  try {
    // Final review must inspect the exact normalized content that will be saved.
    const prepared = options.prepare(content);
    const finalCitations = consolidateCcnaCitations(prepared, options.allowedSources);
    candidate = finalCitations.candidate;
    issues.push(...finalCitations.issues);
    const final = ccnaGeneratedLessonSchema.safeParse(candidate);
    if (!final.success) {
      const reviewable = ccnaReviewableLessonSchema.safeParse(candidate);
      const additional = reviewable.success ? options.evaluate(reviewable.data) : { usefulWords: 0, issues: [] };
      return { candidate, content: null, quality: { ready: false, score: 0, usefulWords: additional.usefulWords, issues: [...new Set([...issues, ...schemaIssues(final.error), ...additional.issues])] } };
    }
    content = final.data;
  } catch (error) {
    if (!(error instanceof z.ZodError)) throw error;
    return { candidate, content: null, quality: { ready: false, score: 0, usefulWords: 0, issues: [...issues, ...schemaIssues(error)] } };
  }
  const quality = options.evaluate(content);
  issues.push(...quality.issues);
  const unique = [...new Set(issues)];
  return { candidate: content, content, quality: { ...quality, issues: unique, score: Math.max(0, 100 - unique.length * 12), ready: quality.ready && !unique.length } };
}

export async function runCcnaGenerationPipeline(options: {
  write: (repair?: { candidate: unknown; issues: string[] }) => Promise<string>;
  inspect: (text: string) => Inspection;
  review: (candidate: unknown) => Promise<unknown>;
}) {
  const passes: Pass[] = [];
  let repair: { candidate: unknown; issues: string[] } | undefined;
  // One draft and at most two focused repairs: no unbounded paid retry loop.
  for (let attempt = 0; attempt <= 2; attempt += 1) {
    const inspected = options.inspect(await options.write(repair));
    let reviewWasRun = false;
    let review: Review = { passed: false, issues: ["Independent review requires a complete lesson JSON object."] };
    if (inspected.candidate && typeof inspected.candidate === "object" && !Array.isArray(inspected.candidate)) {
      reviewWasRun = true;
      const result = ccnaTechnicalReviewSchema.safeParse(await options.review(inspected.candidate));
      review = result.success ? result.data : { passed: false, issues: ["The independent review response was invalid or contradictory; a valid technical review is required."] };
    }
    const issues = [...new Set([...inspected.quality.issues, ...review.issues])];
    const digest = ccnaContentDigest(inspected.candidate);
    const ready = !!inspected.content && inspected.quality.ready && review.passed && !issues.length;
    passes.push({ attempt: attempt + 1, schemaPassed: !!inspected.content, reviewWasRun, reviewPassed: review.passed, contentDigest: digest, issues });
    if (ready || attempt === 2) {
      if (!inspected.content) throw new CcnaGenerationValidationError(passes, issues);
      return {
        content: inspected.content,
        quality: { ...inspected.quality, issues, ready, score: Math.max(0, 100 - issues.length * 12) },
        review,
        repairPasses: attempt,
        passes,
        reviewedContentDigest: digest
      };
    }
    repair = { candidate: inspected.candidate, issues };
  }
  throw new Error("CCNA validation loop exceeded its fixed attempt budget.");
}
