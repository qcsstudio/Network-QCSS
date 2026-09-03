import Link from "next/link";
import { ArrowLeft, ArrowRight, BookOpen, FolderOpen, Globe, Keyboard, Monitor, Terminal } from "lucide-react";
import { CcnaFirstPractice } from "@/components/ccna-first-practice";
import { CcnaQuiz } from "@/components/ccna-quiz";
import { StructuredData } from "@/components/structured-data";
import { ccnaFoundationQuiz, ccnaFoundationSources, ccnaFoundationUnits } from "@/lib/ccna-foundations";
import { siteConfig } from "@/lib/content";
import { createPageMetadata } from "@/lib/seo";

export const metadata = createPageMetadata({ title: "Start CCNA from Zero: Computer and Network Basics", description: "New to computers? Learn clicking, typing, files, apps, Wi-Fi, Internet and IP addresses before your first CCNA lab. Plain English, small exercises and a quiz.", path: "/courses/ccna/start-here" });
const icons = [Monitor, Keyboard, FolderOpen, Globe, BookOpen, Terminal];

export default function CcnaStartHerePage() {
  return <main className="ccna-foundations-page ccna-lesson-page">
    <StructuredData data={{ "@context": "https://schema.org", "@type": "LearningResource", name: "Start CCNA from zero", educationalLevel: "No prior computer or network knowledge", learningResourceType: "Preparatory lesson", isAccessibleForFree: true, url: `${siteConfig.url}/courses/ccna/start-here`, isPartOf: { "@type": "Course", name: "QCS CCNA 200-301 Networking Course", url: `${siteConfig.url}/courses/ccna` }, author: { "@type": "Organization", name: siteConfig.name } }} />
    <header className="ccna-foundations-header">
      <Link href="/courses/ccna"><ArrowLeft aria-hidden="true" size={16} /> Full course syllabus</Link>
      <p className="eyebrow">Before lesson one</p><h1>Start from zero.</h1>
      <p>You do not need to know computer terms yet. Begin with the device in front of you, try one small task at a time, and move on when the idea makes sense.</p>
      <p>CCNA stands for Cisco Certified Network Associate. It is a networking certification. This guide prepares you for the course; it is not an extra exam requirement.</p>
      <a className="button primary" href="#computer">Begin with your computer <ArrowRight aria-hidden="true" size={17} /></a>
    </header>
    <div className="ccna-foundations-layout">
      <nav className="ccna-foundation-index" aria-label="Computer basics chapters"><strong>Your starting path</strong><ol>{ccnaFoundationUnits.map((unit, index) => <li key={unit.id}><a href={`#${unit.id}`}><span>{String(index + 1).padStart(2, "0")}</span>{unit.title}</a></li>)}</ol><a href="#lesson-quiz-title">Check your understanding</a></nav>
      <article>
        {ccnaFoundationUnits.map((unit, index) => { const Icon = icons[index]; return <section className="ccna-foundation-unit" id={unit.id} key={unit.id}>
          <header><Icon size={27} aria-hidden="true" /><div><p className="eyebrow">Step {index + 1} of {ccnaFoundationUnits.length}</p><h2>{unit.title}</h2></div></header>
          <p className="ccna-foundation-outcome">{unit.outcome}</p>
          {unit.paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
          <h3>Try one small task</h3><ol>{unit.steps.map((step) => <li key={step}>{step}</li>)}</ol>
          {unit.id === "click-and-type" ? <CcnaFirstPractice /> : null}
          <div className="ccna-foundation-check"><h3>Pause and think</h3><p>{unit.question}</p><details><summary>Show the explanation</summary><p>{unit.answer}</p></details></div>
          {unit.id === "safe-lab" ? <ul className="ccna-foundation-source-list">{ccnaFoundationSources.filter((source) => /installation|local-server/.test(source.label)).map((source) => <li key={source.url}><a href={source.url} target="_blank" rel="noreferrer">{source.label}</a></li>)}</ul> : null}
        </section>; })}
        <CcnaQuiz questions={ccnaFoundationQuiz} slug="start-here" />
        <section className="ccna-foundation-unit"><h2>Take the next small step.</h2><p>You do not need a perfect score to keep learning. Revisit any idea that is unclear. The daily publication schedule is not a deadline for you: repeat a lesson and take breaks whenever needed.</p><Link className="button primary" href="/courses/ccna/lessons/ccna-roadmap-and-lab-method">Open your first network lesson <ArrowRight aria-hidden="true" size={17} /></Link></section>
        <section className="ccna-foundation-unit"><h2>Official references</h2><ul className="ccna-foundation-source-list">{ccnaFoundationSources.map((source) => <li key={source.url}><a href={source.url} target="_blank" rel="noreferrer">{source.label}</a></li>)}</ul></section>
      </article>
    </div>
  </main>;
}
