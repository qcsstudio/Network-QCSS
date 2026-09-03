import type { CcnaLessonRecord } from "@/lib/ccna-learning";

export function buildCcnaNewsletterEdition(lesson: CcnaLessonRecord) {
  if (!lesson.content) return "";
  const content = lesson.content;
  const lines = (items: string[]) => items.map((item) => `- ${item}`);
  return [
    lesson.title, "", content.plainAnswer, "",
    "LEARNING TARGETS", ...lines(content.objectives), "",
    "BEFORE YOU BEGIN", ...lines(content.prerequisites), "",
    ...content.sections.flatMap((section) => [
      section.heading, "", section.explanation, "", `Example: ${section.example}`, "",
      ...lines(section.keyPoints), "", ...section.sourceUrls.map((url) => `Reference: ${url}`), ""
    ]),
    "REAL-WORLD WALKTHROUGH", content.realWorldScenario.title, "", content.realWorldScenario.situation, "",
    ...content.realWorldScenario.walkthrough.map((step, index) => `${index + 1}. ${step}`), "", content.realWorldScenario.takeaway, "",
    `LAB: ${content.lab.title}`, content.lab.goal, "", content.lab.topology, "",
    "Devices", ...lines(content.lab.devices), "",
    "Addressing", ...content.lab.addressing.map((row) => `${row.device} / ${row.interface}: ${row.address}. ${row.purpose}`), "",
    "Setup", ...lines(content.lab.setup), "",
    ...content.lab.steps.flatMap((step, index) => [
      `${index + 1}. ${step.title}`, step.instruction, "", ...step.commands, "",
      `Expected evidence: ${step.expectedResult}`, `Why: ${step.why}`, ""
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
