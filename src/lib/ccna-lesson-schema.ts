import { z } from "zod";

const sourceSchema = z.object({
  label: z.string().min(3).max(180),
  url: z.string().url().max(1_000),
  supports: z.string().min(20).max(400)
});

const sectionSchema = z.object({
  heading: z.string().min(5).max(140),
  explanation: z.string().min(180).max(2_400),
  example: z.string().min(100).max(1_200),
  keyPoints: z.array(z.string().min(20).max(360)).min(2).max(6),
  sourceUrls: z.array(z.string().url().max(1_000)).min(1).max(4)
});

const labStepSchema = z.object({
  title: z.string().min(4).max(120),
  instruction: z.string().min(70).max(900),
  commands: z.array(z.string().min(1).max(800)).max(12),
  expectedResult: z.string().min(30).max(700),
  why: z.string().min(40).max(600)
});

const questionSchema = z.object({
  question: z.string().min(12).max(360),
  answer: z.string().min(15).max(500),
  explanation: z.string().min(60).max(900)
});

const quizSchema = z.object({
  question: z.string().min(12).max(360),
  options: z.array(z.string().min(1).max(260)).length(4),
  correctIndex: z.number().int().min(0).max(3),
  explanation: z.string().min(60).max(800)
});

export const ccnaLessonContentSchema = z.object({
  metaTitle: z.string().min(20).max(68),
  metaDescription: z.string().min(80).max(165),
  plainAnswer: z.string().min(120).max(700),
  learnerOutcome: z.string().min(70).max(500),
  prerequisites: z.array(z.string().min(10).max(220)).min(2).max(6),
  objectives: z.array(z.string().min(20).max(300)).min(3).max(6),
  sections: z.array(sectionSchema).min(5).max(8),
  realWorldScenario: z.object({
    title: z.string().min(8).max(140),
    situation: z.string().min(150).max(1_500),
    walkthrough: z.array(z.string().min(50).max(700)).min(4).max(8),
    takeaway: z.string().min(80).max(700)
  }),
  lab: z.object({
    title: z.string().min(8).max(160),
    goal: z.string().min(80).max(600),
    topology: z.string().min(20).max(700),
    devices: z.array(z.string().min(2).max(180)).min(2).max(10),
    addressing: z.array(z.object({ device: z.string().min(1).max(80), interface: z.string().min(1).max(80), address: z.string().min(1).max(120), purpose: z.string().min(5).max(180) })).max(16),
    setup: z.array(z.string().min(20).max(500)).min(3).max(8),
    steps: z.array(labStepSchema).min(7).max(14),
    verification: z.array(z.string().min(30).max(600)).min(4).max(10),
    troubleshooting: z.array(z.string().min(40).max(700)).min(3).max(8),
    cleanup: z.array(z.string().min(20).max(400)).min(2).max(6),
    licensingNote: z.string().min(80).max(700)
  }),
  practiceQuestions: z.array(questionSchema).min(6).max(10),
  quiz: z.array(quizSchema).min(5).max(8),
  glossary: z.array(z.object({ term: z.string().min(2).max(100), meaning: z.string().min(30).max(500) })).min(5).max(12),
  takeaways: z.array(z.string().min(20).max(360)).min(5).max(8),
  sources: z.array(sourceSchema).min(3).max(10)
});

export type CcnaLessonContent = z.infer<typeof ccnaLessonContentSchema>;

function usefulWords(content: CcnaLessonContent) {
  return [
    content.plainAnswer,
    content.learnerOutcome,
    ...content.sections.flatMap((section) => [section.explanation, section.example, ...section.keyPoints]),
    content.realWorldScenario.situation,
    ...content.realWorldScenario.walkthrough,
    content.realWorldScenario.takeaway,
    content.lab.goal,
    ...content.lab.steps.flatMap((step) => [step.instruction, step.expectedResult, step.why]),
    ...content.lab.verification,
    ...content.lab.troubleshooting,
    ...content.practiceQuestions.flatMap((question) => [question.question, question.answer, question.explanation]),
    ...content.quiz.flatMap((question) => [question.question, question.explanation]),
    ...content.glossary.flatMap((item) => [item.term, item.meaning]),
    ...content.takeaways
  ].join(" ").split(/\s+/).filter(Boolean).length;
}

export function evaluateCcnaLessonQuality(content: CcnaLessonContent) {
  const issues: string[] = [];
  const words = usefulWords(content);
  if (words < 1_500) issues.push("Teach the topic with at least 1,500 useful words across explanation, scenario, lab, and assessment.");
  const sourceSet = new Set(content.sources.map((source) => source.url));
  if (sourceSet.size < 3) issues.push("Use at least three distinct authoritative sources.");
  if (content.sections.some((section) => !section.sourceUrls.some((url) => sourceSet.has(url)))) {
    issues.push("Map every teaching section to at least one source listed in the lesson bibliography.");
  }
  if (content.lab.steps.length < 7 || content.lab.verification.length < 4 || content.lab.troubleshooting.length < 3) {
    issues.push("Include a complete lab build, verification path, and troubleshooting path.");
  }
  if (!/GNS3|Cisco Modeling Labs|CML/i.test(content.lab.licensingNote) || !/licen[cs]/i.test(content.lab.licensingNote)) {
    issues.push("Explain that learners must use properly licensed Cisco images in GNS3 or use Cisco Modeling Labs.");
  }
  if (content.practiceQuestions.length < 6 || content.quiz.length < 5) {
    issues.push("Include the required practice set and scored quiz.");
  }
  if (/\.{3}|…/.test(JSON.stringify(content))) issues.push("Remove clipped sentences and ellipses.");
  const score = Math.max(0, 100 - issues.length * 12);
  return { issues, score, usefulWords: words, ready: issues.length === 0 && score >= 88 };
}
