import { completeCcnaPublicationDelivery, getCcnaLessonById, processCcnaPublication } from "@/lib/ccna-learning";
import { queueLinkedInForCcnaLesson } from "@/lib/social-publications";
import { CcnaRequestDeferredError } from "@/lib/ccna-openai-requests";
import { ccnaFailureSummary } from "@/lib/ccna-publication-policy";

export async function runCcnaPublicationJob(id: string) {
  try {
    const lesson = await processCcnaPublication(id);
    if (lesson.status === "published") {
      const publication = await queueLinkedInForCcnaLesson(lesson);
      await completeCcnaPublicationDelivery(id);
      return { action: "published", lesson, distributionId: publication.id };
    }
    return { action: lesson.status === "retry" ? "retry_wait" : "held", lesson };
  } catch (error) {
    const message = ccnaFailureSummary(error instanceof Error ? error.message : "CCNA publication failed.");
    // Do not log SDK transport objects, cookies, credentials or the complete lesson.
    console.warn("CCNA publication job held", { id, error: message });
    return { action: error instanceof CcnaRequestDeferredError ? "retry_wait" : "held", lesson: await getCcnaLessonById(id), reason: message };
  }
}
