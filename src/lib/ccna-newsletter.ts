import type { CcnaLessonRecord } from "@/lib/ccna-learning";
import { ccnaComparisonBoundary, ccnaSectionBoundary } from "./ccna-lesson-presentation.ts";

export function buildCcnaNewsletterEdition(lesson: CcnaLessonRecord) {
  if (!lesson.content) return "";
  const content = lesson.content;
  const guide = content.beginnerGuide;
  const lines = (items: string[]) => items.map((item) => `- ${item}`);
  const guideBoundary = guide ? ccnaComparisonBoundary(content, Object.values(guide.everydayComparison)) : undefined;
  const scenarioBoundary = ccnaComparisonBoundary(content, [content.realWorldScenario.title, content.realWorldScenario.situation, ...content.realWorldScenario.walkthrough, content.realWorldScenario.takeaway]);
  return [
    lesson.title, "",
    ...(content.teachingPrelude ? ["FIRST, THE ESSENTIAL IDEAS", ...content.teachingPrelude.terms.flatMap((term) => [`${term.term}: ${term.meaning}`, ""]), content.teachingPrelude.explanation, ""] : []),
    content.plainAnswer, "",
    "LEARNING TARGETS", ...lines(content.objectives), "",
    "BEFORE YOU BEGIN", ...lines(content.prerequisites), "",
    "New to computers? https://www.qcsstudio.com/courses/ccna/start-here", "",
    ...(guide ? [
      "START WITH SOMETHING FAMILIAR", guide.startingPoint, "", "Why learn this?", guide.whyItMatters, "",
      "An everyday comparison", ...(guideBoundary ? [guideBoundary, ""] : []), guide.everydayComparison.familiarSituation, "", "What happens in a network", guide.everydayComparison.networkMeaning, "",
      "Where the comparison stops", guide.everydayComparison.whereItStops, "",
      "FOLLOW ONE WORKED EXAMPLE", ...guide.walkthrough.flatMap((step, index) => [`${index + 1}. ${step.action}`, step.whatHappens, `Why: ${step.why}`, ""]),
      "YOUR FIRST SMALL TASK", guide.firstPractice.task, `Hint: ${guide.firstPractice.hint}`, `Expected result: ${guide.firstPractice.expected}`, "",
      "CHECK YOUR UNDERSTANDING", guide.checkUnderstanding.question, `Hint: ${guide.checkUnderstanding.hint}`, `Explanation: ${guide.checkUnderstanding.answer}`, ""
    ] : []),
    ...content.sections.flatMap((section) => [
      section.heading, "", ...(ccnaSectionBoundary(content, section) ? [ccnaSectionBoundary(content, section), ""] : []), section.explanation, "", `Example: ${section.example}`, "",
      ...lines(section.keyPoints.filter((point) => !/^Lab boundary:/i.test(point))), "", ...section.sourceUrls.map((url) => `Reference: ${url}`), ""
    ]),
    "REAL-WORLD WALKTHROUGH", content.realWorldScenario.title, "", ...(scenarioBoundary ? [scenarioBoundary, ""] : []), content.realWorldScenario.situation, "",
    ...content.realWorldScenario.walkthrough.map((step, index) => `${index + 1}. ${step}`), "", content.realWorldScenario.takeaway, "",
    `LAB: ${content.lab.title}`, content.lab.goal, "", content.lab.topology, "",
    "Devices", ...lines(content.lab.devices), "",
    "Addressing", ...content.lab.addressing.map((row) => `${row.device} / ${row.interface}: ${row.address}. ${row.purpose}`), "",
    "Setup", ...lines(content.lab.setup), "",
    ...content.lab.steps.flatMap((step, index) => [
      `${index + 1}. ${step.title}`, step.instruction, "", ...step.commands, "",
      ...(step.commandExplanations || []).map((explanation, commandIndex) => `${step.commands[commandIndex]}: ${explanation}`), "",
      `What you should see: ${step.expectedResult}`, `Why: ${step.why}`, ""
    ]),
    "Verify", ...lines(content.lab.verification), "",
    "Troubleshoot", ...lines(content.lab.troubleshooting), "",
    "Licensing and cleanup", content.lab.licensingNote, ...lines(content.lab.cleanup), "",
    "PRACTICE QUESTIONS", ...content.practiceQuestions.flatMap((question, index) => [
      `${index + 1}. ${question.question}`, `Answer: ${question.answer}`, question.explanation, ""
    ]),
    "QUIZ: TRY BEFORE CHECKING THE ANSWER KEY", ...content.quiz.flatMap((question, index) => [
      `${index + 1}. ${question.question}`, ...question.options.map((option, optionIndex) => `${String.fromCharCode(65 + optionIndex)}. ${option}`), ""
    ]),
    "QUIZ ANSWER KEY", ...content.quiz.map((question, index) => `${index + 1}. ${String.fromCharCode(65 + question.correctIndex)}. ${question.explanation}`), "",
    "TECHNICAL TAKEAWAYS", ...lines(content.takeaways), "",
    "GLOSSARY", ...content.glossary.map((item) => `${item.term}: ${item.meaning}`), "",
    `Original QCS lesson and interactive quiz: https://www.qcsstudio.com/courses/ccna/lessons/${lesson.slug}`, "",
    "Complete course syllabus: https://www.qcsstudio.com/courses/ccna", "",
    "PRIMARY SOURCES", ...content.sources.map((source) => `${source.label}: ${source.url}`), "",
    "#CCNA #CiscoNetworking #NetworkEngineering #GNS3 #NetworkingStudents"
  ].join("\n");
}
