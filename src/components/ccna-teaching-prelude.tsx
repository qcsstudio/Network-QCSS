import type { CcnaLessonContent } from "@/lib/ccna-lesson-schema";

export function CcnaTeachingPrelude({ prelude }: { prelude: NonNullable<CcnaLessonContent["teachingPrelude"]> }) {
  return <section className="ccna-teaching-prelude" id="first-concepts" aria-labelledby="first-concepts-title">
    <h2 id="first-concepts-title">First, the essential ideas</h2>
    <dl>{prelude.terms.map(({ term, meaning }) => <div key={term}><dt>{term}</dt><dd>{meaning}</dd></div>)}</dl>
    <p>{prelude.explanation}</p>
  </section>;
}
