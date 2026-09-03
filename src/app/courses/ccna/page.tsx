import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, BookOpenCheck, CalendarDays, FlaskConical, Route, ShieldCheck } from "lucide-react";
import { StructuredData } from "@/components/structured-data";
import { ccnaCourseFacts, ccnaModules, ccnaOfficialSources, ccnaCurriculum } from "@/lib/ccna-curriculum";
import { getPublishedCcnaLessons } from "@/lib/ccna-learning";
import { siteConfig } from "@/lib/content";
import { createPageMetadata } from "@/lib/seo";
import { ccnaFoundationUnits } from "@/lib/ccna-foundations";

export const dynamic = "force-dynamic";

export const metadata: Metadata = createPageMetadata({
  title: "Latest CCNA 200-301 Course, Syllabus, GNS3 Labs and Daily Lessons",
  description: "Study the current CCNA 200-301 v1.1 syllabus with a v2.0 transition map, 60 weekday lessons, simple explanations, GNS3 labs, practice questions, and quizzes.",
  path: "/courses/ccna",
  keywords: ["latest CCNA course", "CCNA 200-301 syllabus", "CCNA v1.1 course", "CCNA v2.0 syllabus", "CCNA GNS3 labs", "CCNA daily lessons"]
});

export default async function CcnaCoursePage() {
  const published = await getPublishedCcnaLessons().catch(() => []);
  const publishedBySequence = new Map(published.map((lesson) => [lesson.sequence, lesson]));
  const latest = published.at(-1);
  return (
    <main className="ccna-course-page purpose-learning">
      <StructuredData data={[
        {
          "@context": "https://schema.org",
          "@type": "Course",
          name: "QCS Latest CCNA 200-301 Learning Path",
          description: metadata.description,
          url: `${siteConfig.url}/courses/ccna`,
          provider: { "@type": "Organization", name: siteConfig.name, url: siteConfig.url },
          educationalLevel: "Beginner to associate",
          inLanguage: "en",
          isAccessibleForFree: true,
          coursePrerequisites: "No previous computer or network knowledge. Begin with the free Start from zero guide, then study at your own pace.",
          hasCourseInstance: { "@type": "CourseInstance", courseMode: "online" },
          syllabusSections: ccnaModules.map((module) => ({ "@type": "Syllabus", name: module.title, description: module.domain }))
        },
        {
          "@context": "https://schema.org",
          "@type": "ItemList",
          name: "CCNA daily lesson syllabus",
          numberOfItems: ccnaCurriculum.length,
          itemListElement: ccnaCurriculum.map((topic) => ({ "@type": "ListItem", position: topic.sequence, name: topic.title }))
        }
      ]} />

      <section className="ccna-course-hero">
        <div className="ccna-course-copy">
          <p className="eyebrow">QCS CCNA Daily / 200-301</p>
          <h1><span>CCNA 200-301</span> Networking Course</h1>
          <p className="ccna-course-lead">New to computers? Start with clicking, typing and saving a file. Then learn how networks work, one clear example at a time. No previous computer or networking knowledge is needed.</p>
          <p>CCNA means Cisco Certified Network Associate. This free course helps you build the skills behind that certification. Read, try and repeat at your own pace.</p>
          <div className="button-row">
            <Link className="button primary" href="/courses/ccna/start-here">Start from zero <ArrowRight aria-hidden="true" size={17} /></Link>
            {latest ? <Link className="button secondary" href={`/courses/ccna/lessons/${latest.slug}`}>Open latest lesson</Link> : <a className="button secondary" href="#syllabus">Explore syllabus</a>}
          </div>
          <dl className="ccna-course-stats">
            <div><dt>Current exam</dt><dd>v1.1 through 2 Feb 2027</dd></div>
            <div><dt>Next exam</dt><dd>v2.0 from 3 Feb 2027</dd></div>
            <div><dt>Learning rhythm</dt><dd>Monday to Friday</dd></div>
          </dl>
        </div>
        <div className="ccna-course-visual" aria-label="CCNA lab topology connecting users, switches, routers, security, and cloud services">
          <Image alt="Isometric network lab connecting switches, routers, servers, and monitoring consoles" fill priority sizes="(max-width: 900px) 100vw, 48vw" src="/brand/envato/illustrations/isometric-data-center-network.svg" />
          <div className="ccna-visual-console"><span>LESSON {String((latest?.sequence || 1)).padStart(2, "0")}</span><strong>{latest?.title || "Your first practice network"}</strong><i>UNDERSTAND / TRY / CHECK</i></div>
          <div className="ccna-visual-node is-one"><Route aria-hidden="true" size={19} /> Route</div>
          <div className="ccna-visual-node is-two"><ShieldCheck aria-hidden="true" size={19} /> Secure</div>
          <div className="ccna-visual-node is-three"><FlaskConical aria-hidden="true" size={19} /> Prove</div>
        </div>
      </section>

      <section className="ccna-zero-band">
        <div><p className="eyebrow">Before the 60 lessons</p><h2>Your first six small steps.</h2><p>Begin here when computer words are new to you. Each step includes an explanation, a safe task and a question with an answer. You can read on a phone; later software labs need a suitable computer.</p><Link href="/courses/ccna/start-here">Open the beginner guide <ArrowRight aria-hidden="true" size={17} /></Link></div>
        <ol>{ccnaFoundationUnits.map((unit, index) => <li key={unit.id}><span>{String(index + 1).padStart(2, "0")}</span><Link href={`/courses/ccna/start-here#${unit.id}`}>{unit.title}</Link></li>)}</ol>
      </section>

      <section className="ccna-version-band">
        <div><p className="eyebrow">Which exam version?</p><h2>Choose by your planned exam date.</h2></div>
        <p>Cisco says the current exam remains available through <strong>2 February 2027</strong>, with v2.0 starting on <strong>3 February 2027</strong>. The refreshed blueprint keeps the technical core but gives more weight to practical troubleshooting, security-first operations, IPv6, AI, and network management. Each QCS lesson shows both mappings.</p>
      </section>

      <section className="section ccna-method-section">
        <div className="section-heading"><p className="eyebrow">How every lesson works</p><h2>Understand. Try. Check. Repeat.</h2><p>Start with something familiar, learn the new words, and see a worked example before trying it yourself. There is no deadline for understanding an idea.</p></div>
        <div className="ccna-method-grid">
          <article><BookOpenCheck aria-hidden="true" /><strong>Everyday explanations</strong><p>Start with a familiar situation. Learn what the network does and where the comparison stops being accurate.</p></article>
          <article><FlaskConical aria-hidden="true" /><strong>One action at a time</strong><p>See where to click, what to type and what each command means. Practice only on the course&apos;s safe test network.</p></article>
          <article><ShieldCheck aria-hidden="true" /><strong>Check what happened</strong><p>Compare your result with the expected result. Follow the checks when something goes wrong, then try again.</p></article>
          <article><CalendarDays aria-hidden="true" /><strong>Practice with feedback</strong><p>Use a hint when you need one. Answer original questions and take a quiz with explanations, not just a score.</p></article>
        </div>
      </section>

      <section className="section ccna-syllabus-section" id="syllabus">
        <div className="section-heading"><p className="eyebrow">Complete syllabus</p><h2>{ccnaCourseFacts.weekdayLessons} lessons, at your pace.</h2><p>New lessons are scheduled Monday to Friday over {ccnaCourseFacts.weeks} weeks. That is our publication schedule, not a time limit for you. Start with the beginner guide and work through the lessons in order.</p></div>
        <div className="ccna-module-list">
          {ccnaModules.map((module, moduleIndex) => (
            <section className="ccna-module" key={module.id}>
              <header><span>{String(moduleIndex + 1).padStart(2, "0")}</span><div><p>{module.domain}</p><h3>{module.title}</h3></div><strong>{module.topics.length} lessons</strong></header>
              <ol>
                {module.topics.map((topic) => {
                  const lesson = publishedBySequence.get(topic.sequence);
                  return <li key={topic.slug}>
                    <span>Day {String(topic.sequence).padStart(2, "0")}</span>
                    <div><strong>{topic.title}</strong><p>{topic.objective}</p><small>v1.1: {topic.v11} / v2.0: {topic.v20}</small></div>
                    {lesson ? <Link aria-label={`Open ${topic.title}`} href={`/courses/ccna/lessons/${topic.slug}`}><ArrowRight aria-hidden="true" size={18} /></Link> : <i className="ccna-lesson-scheduled" role="img" aria-label="Scheduled lesson" title="Scheduled lesson"><CalendarDays aria-hidden="true" size={19} /></i>}
                  </li>;
                })}
              </ol>
            </section>
          ))}
        </div>
      </section>

      <section className="section ccna-source-section">
        <div className="section-heading"><p className="eyebrow">Evidence and lab integrity</p><h2>Built around primary sources, not exam dumps.</h2><p>QCS lessons cite current documentation, write original questions, and never distribute Cisco software images. GNS3 learners must use images they are licensed to use; Cisco Modeling Labs is the official Cisco alternative.</p></div>
        <div className="ccna-source-links">{ccnaOfficialSources.map((source) => <a href={source.url} key={source.url} rel="noreferrer" target="_blank"><strong>{source.label}</strong><span>Open official source <ArrowRight aria-hidden="true" size={15} /></span></a>)}</div>
      </section>
    </main>
  );
}
