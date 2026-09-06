import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight, CheckCircle2, ExternalLink, FlaskConical, Lightbulb, Network, ShieldCheck, Wrench } from "lucide-react";
import { CcnaProgress } from "@/components/ccna-progress";
import { CcnaQuiz } from "@/components/ccna-quiz";
import { CcnaBeginnerGuide } from "@/components/ccna-beginner-guide";
import { CcnaLessonShell } from "@/components/ccna-lesson-shell";
import { CcnaVisualExplainer } from "@/components/ccna-visual-explainer";
import { CcnaTeachingPrelude } from "@/components/ccna-teaching-prelude";
import { ccnaComparisonBoundary, ccnaSectionBoundary } from "@/lib/ccna-lesson-presentation";
import { CcnaLabBoundary } from "@/components/ccna-lab-boundary";
import { firstNetworkArtwork, visualStoryForLesson } from "@/lib/ccna-visual-story";
import { StructuredData } from "@/components/structured-data";
import { getPublishedCcnaLessonBySlug, getPublishedCcnaLessons } from "@/lib/ccna-learning";
import { siteConfig } from "@/lib/content";
import { createPageMetadata } from "@/lib/seo";

export const dynamic = "force-dynamic";

type PageProps = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const lesson = await getPublishedCcnaLessonBySlug(slug).catch(() => null);
  if (!lesson?.content) return createPageMetadata({ title: "CCNA lesson", description: "QCS CCNA daily lesson.", path: `/courses/ccna/lessons/${slug}`, noIndex: true });
  return createPageMetadata({
    title: lesson.content.metaTitle,
    description: lesson.content.metaDescription,
    path: `/courses/ccna/lessons/${slug}`,
    keywords: [lesson.title, "CCNA 200-301", "CCNA lab", "GNS3 CCNA lab", lesson.examDomain],
    image: { url: `/courses/ccna/lessons/${slug}/opengraph-image`, width: 1200, height: 630, alt: `QCS CCNA Daily lesson ${lesson.sequence}: ${lesson.title}` },
    article: { publishedTime: lesson.publishedAt, modifiedTime: lesson.updatedAt }
  });
}

export default async function CcnaLessonPage({ params }: PageProps) {
  const { slug } = await params;
  const lesson = await getPublishedCcnaLessonBySlug(slug).catch(() => null);
  if (!lesson?.content) notFound();
  const lessons = await getPublishedCcnaLessons().catch(() => []);
  const index = lessons.findIndex((item) => item.id === lesson.id);
  const previous = index > 0 ? lessons[index - 1] : null;
  const next = index >= 0 ? lessons[index + 1] : null;
  const content = lesson.content;
  const visualStory = visualStoryForLesson(lesson);
  const canonical = `${siteConfig.url}/courses/ccna/lessons/${lesson.slug}`;

  return (
    <main className="ccna-lesson-page">
      <StructuredData data={[
        {
          "@context": "https://schema.org",
          "@type": ["Article", "LearningResource"],
          headline: lesson.title,
          description: content.metaDescription,
          url: canonical,
          datePublished: lesson.publishedAt,
          dateModified: lesson.updatedAt,
          educationalLevel: "Beginner to associate",
          learningResourceType: ["Lesson", "Lab", "Practice questions", "Quiz"],
          teaches: content.objectives,
          isPartOf: { "@type": "Course", name: "QCS Latest CCNA 200-301 Learning Path", url: `${siteConfig.url}/courses/ccna` },
          author: { "@type": "Organization", name: siteConfig.name, url: siteConfig.url },
          publisher: { "@type": "Organization", name: siteConfig.name, logo: { "@type": "ImageObject", url: `${siteConfig.url}/brand/quantumcrafters-logo.png` } }
        },
        {
          "@context": "https://schema.org",
          "@type": "Quiz",
          name: `${lesson.title} knowledge check`,
          about: lesson.title,
          educationalLevel: "CCNA associate",
          hasPart: content.quiz.map((item) => ({ "@type": "Question", name: item.question, acceptedAnswer: { "@type": "Answer", text: item.options[item.correctIndex] } }))
        },
        {
          "@context": "https://schema.org",
          "@type": "BreadcrumbList",
          itemListElement: [
            { "@type": "ListItem", position: 1, name: "Institute", item: `${siteConfig.url}/institute` },
            { "@type": "ListItem", position: 2, name: "CCNA course", item: `${siteConfig.url}/courses/ccna` },
            { "@type": "ListItem", position: 3, name: lesson.title, item: canonical }
          ]
        }
      ]} />

      <header className="ccna-lesson-hero">
        <div className="ccna-lesson-breadcrumb"><Link href="/courses/ccna"><ArrowLeft aria-hidden="true" size={16} /> Full syllabus</Link><span>Week {lesson.week}</span><span>Day {lesson.sequence}</span></div>
        <div className="ccna-lesson-hero-grid">
          <div><p className="eyebrow">{lesson.moduleTitle}</p><h1>{lesson.title}</h1><p>{content.learnerOutcome}</p><CcnaProgress slug={lesson.slug} /></div>
          <div className="ccna-lesson-map">
            <span>Exam map</span>
            <dl><div><dt>Current v1.1</dt><dd>{lesson.v11Blueprint}</dd></div><div><dt>Announced v2.0</dt><dd>{lesson.v20Blueprint}</dd></div><div><dt>Domain</dt><dd>{lesson.examDomain}</dd></div></dl>
          </div>
        </div>
        <p className="ccna-beginner-link">New to computers? <Link href="/courses/ccna/start-here">Start with computer and network basics <ArrowRight aria-hidden="true" size={16} /></Link></p>
      </header>

      <CcnaLessonShell
        outline={<>{content.teachingPrelude ? <a href="#first-concepts">First concepts</a> : null}{visualStory ? <a href="#visual-walkthrough">See the idea</a> : null}{content.beginnerGuide ? <a href="#start-with-an-example">Start with an example</a> : null}<a href="#new-words">New words</a><a href="#real-world-scenario">Real-life example</a><a href="#gns3-lab">Practice network</a><a href="#practice-questions">Practice questions</a><a href="#lesson-quiz-title">Quiz</a></>}
        sources={<>{content.sources.map((source) => <a href={source.url} key={source.url} rel="noreferrer" target="_blank">{source.label}<ExternalLink aria-hidden="true" size={14} /></a>)}</>}
      >
          {content.teachingPrelude ? <CcnaTeachingPrelude prelude={content.teachingPrelude} /> : null}
          {visualStory ? <CcnaVisualExplainer story={visualStory} artwork={firstNetworkArtwork(lesson)} /> : null}
          {content.beginnerGuide ? <CcnaBeginnerGuide guide={content.beginnerGuide} labBoundary={ccnaComparisonBoundary(content, Object.values(content.beginnerGuide.everydayComparison))} /> : null}
          <section className="ccna-answer-block"><Lightbulb aria-hidden="true" size={24} /><div><p className="eyebrow">Short answer</p><h2>What should you understand today?</h2><p>{content.plainAnswer}</p></div></section>

          <section className="ccna-objectives"><div><p className="eyebrow">Before you begin</p><h2>Learning targets</h2></div><div><strong>Prerequisites</strong><ul>{content.prerequisites.map((item) => <li key={item}>{item}</li>)}</ul></div><div><strong>By the end</strong><ul>{content.objectives.map((item) => <li key={item}>{item}</li>)}</ul></div></section>

          <section className="ccna-early-glossary" id="new-words"><h2>Words you will meet</h2><p>Open a word when you need its meaning. You do not need to memorize the whole list before reading.</p><div>{content.glossary.map((item) => <details key={item.term}><summary>{item.term}</summary><p>{item.meaning}</p></details>)}</div></section>

          {content.sections.map((section, sectionIndex) => {
            const labBoundary = ccnaSectionBoundary(content, section);
            const keyPoints = section.keyPoints.filter((point) => !/^Lab boundary:/i.test(point));
            return (
              <section className="ccna-teaching-section" key={section.heading}>
                <header><span>{String(sectionIndex + 1).padStart(2, "0")}</span><h2>{section.heading}</h2></header>
                <CcnaLabBoundary boundary={labBoundary} />
                {section.explanation.split(/\n\n+/).map((paragraph, paragraphIndex) => <p key={paragraphIndex}>{paragraph}</p>)}
                <aside><Lightbulb aria-hidden="true" size={20} /><div><strong>Put it into a real situation</strong><p>{section.example}</p></div></aside>
                <ul>{keyPoints.map((point) => <li key={point}><CheckCircle2 aria-hidden="true" size={17} />{point}</li>)}</ul>
                <div className="ccna-section-sources"><strong>References</strong>{section.sourceUrls.map((url) => <a href={url} key={url} rel="noreferrer" target="_blank">{content.sources.find((source) => source.url === url)?.label || new URL(url).hostname}<ExternalLink aria-hidden="true" size={14} /></a>)}</div>
              </section>
            );
          })}

          <section className="ccna-scenario-section" id="real-world-scenario"><div className="ccna-section-icon"><Network aria-hidden="true" /></div><p className="eyebrow">Real-world walkthrough</p><h2>{content.realWorldScenario.title}</h2><CcnaLabBoundary boundary={ccnaComparisonBoundary(content, [content.realWorldScenario.title, content.realWorldScenario.situation, ...content.realWorldScenario.walkthrough, content.realWorldScenario.takeaway])} /><p>{content.realWorldScenario.situation}</p><ol>{content.realWorldScenario.walkthrough.map((step) => <li key={step}>{step}</li>)}</ol><strong>{content.realWorldScenario.takeaway}</strong></section>

          <section className="ccna-lab-section" id="gns3-lab">
            <header><div><p className="eyebrow">Guided GNS3 lab</p><h2>{content.lab.title}</h2><p>{content.lab.goal}</p></div><FlaskConical aria-hidden="true" size={36} /></header>
            <div className="ccna-topology-strip"><span>{content.lab.topology}</span><div>{content.lab.devices.map((device) => <i key={device}>{device}</i>)}</div></div>
            {content.lab.addressing.length ? <div className="ccna-address-table"><h3>Addressing plan</h3><div className="ccna-table-scroll"><table><thead><tr><th>Device</th><th>Interface</th><th>Address</th><th>Purpose</th></tr></thead><tbody>{content.lab.addressing.map((row) => <tr key={`${row.device}-${row.interface}-${row.address}`}><td>{row.device}</td><td>{row.interface}</td><td><code>{row.address}</code></td><td>{row.purpose}</td></tr>)}</tbody></table></div></div> : null}
            <div className="ccna-lab-setup"><h3>Set up the lab</h3><ol>{content.lab.setup.map((item) => <li key={item}>{item}</li>)}</ol></div>
            <div className="ccna-lab-steps">
              {content.lab.steps.map((step, stepIndex) => <section key={step.title}><header><span>{String(stepIndex + 1).padStart(2, "0")}</span><h3>{step.title}</h3></header><p>{step.instruction}</p>{step.commands.length ? <><pre><code>{step.commands.join("\n")}</code></pre>{step.commandExplanations?.length ? <div className="ccna-command-explanations"><h4>What each command means</h4><dl>{step.commands.map((command, commandIndex) => <div key={`${commandIndex}-${command}`}><dt><code>{command}</code></dt><dd>{step.commandExplanations?.[commandIndex]}</dd></div>)}</dl></div> : null}</> : null}<dl><div><dt>What you should see</dt><dd>{step.expectedResult}</dd></div><div><dt>Why this step matters</dt><dd>{step.why}</dd></div></dl></section>)}
            </div>
            <div className="ccna-lab-proof-grid"><section><ShieldCheck aria-hidden="true" /><h3>Verify</h3><ul>{content.lab.verification.map((item) => <li key={item}>{item}</li>)}</ul></section><section><Wrench aria-hidden="true" /><h3>Troubleshoot</h3><ul>{content.lab.troubleshooting.map((item) => <li key={item}>{item}</li>)}</ul></section></div>
            <div className="ccna-lab-note"><strong>Licensing and cleanup</strong><p>{content.lab.licensingNote}</p><ul>{content.lab.cleanup.map((item) => <li key={item}>{item}</li>)}</ul></div>
          </section>

          <section className="ccna-practice-section" id="practice-questions"><p className="eyebrow">Practice set</p><h2>Answer before you reveal</h2><div>{content.practiceQuestions.map((question, indexValue) => <details key={question.question}><summary><span>{String(indexValue + 1).padStart(2, "0")}</span>{question.question}</summary><div><strong>{question.answer}</strong><p>{question.explanation}</p></div></details>)}</div></section>

          <CcnaQuiz questions={content.quiz} slug={lesson.slug} />

          <section className="ccna-takeaways"><p className="eyebrow">Keep these</p><h2>Technical takeaways</h2><ul>{content.takeaways.map((item) => <li key={item}>{item}</li>)}</ul></section>
      </CcnaLessonShell>

      <nav className="ccna-lesson-pagination" aria-label="CCNA lesson navigation">
        {previous ? <Link href={`/courses/ccna/lessons/${previous.slug}`}><ArrowLeft aria-hidden="true" /><span>Previous lesson<strong>{previous.title}</strong></span></Link> : <span />}
        {next ? <Link href={`/courses/ccna/lessons/${next.slug}`}><span>Next lesson<strong>{next.title}</strong></span><ArrowRight aria-hidden="true" /></Link> : <Link href="/courses/ccna"><span>Return to<strong>Full CCNA syllabus</strong></span><ArrowRight aria-hidden="true" /></Link>}
      </nav>
    </main>
  );
}
