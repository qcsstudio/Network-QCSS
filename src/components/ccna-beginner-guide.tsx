import type { CcnaLessonContent } from "@/lib/ccna-lesson-schema";
import { CcnaLabBoundary } from "@/components/ccna-lab-boundary";

export function CcnaBeginnerGuide({ guide, labBoundary }: { guide: NonNullable<CcnaLessonContent["beginnerGuide"]>; labBoundary?: string }) {
  return <section className="ccna-beginner-guide" id="start-with-an-example">
    <p className="eyebrow">One idea at a time</p>
    <h2>Start with something familiar.</h2>
    <p>{guide.startingPoint}</p>
    <h3>Why learn this?</h3><p>{guide.whyItMatters}</p>
    <div className="ccna-beginner-comparison">
      <h3>An everyday comparison</h3><CcnaLabBoundary boundary={labBoundary} /><p>{guide.everydayComparison.familiarSituation}</p>
      <h3>What happens in a network</h3><p>{guide.everydayComparison.networkMeaning}</p>
      <strong>Where the comparison stops</strong><p>{guide.everydayComparison.whereItStops}</p>
    </div>
    <h3>Follow one worked example</h3>
    <ol className="ccna-beginner-walkthrough">{guide.walkthrough.map((step) => <li key={step.action}><strong>{step.action}</strong><p>{step.whatHappens}</p><p><strong>Why:</strong> {step.why}</p></li>)}</ol>
    <div className="ccna-beginner-practice"><h3>Your first small task</h3><p>{guide.firstPractice.task}</p><details><summary>Show a hint</summary><p>{guide.firstPractice.hint}</p></details><details><summary>Check the expected result</summary><p>{guide.firstPractice.expected}</p></details></div>
    <div className="ccna-beginner-check"><h3>Pause and explain it in your own words</h3><p>{guide.checkUnderstanding.question}</p><details><summary>Show a hint</summary><p>{guide.checkUnderstanding.hint}</p></details><details><summary>Show the explanation</summary><p>{guide.checkUnderstanding.answer}</p></details></div>
  </section>;
}
