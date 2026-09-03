"use client";

import Link from "next/link";
import { BookOpenCheck, CalendarCheck, Check, Clipboard, ExternalLink, GraduationCap, LoaderCircle, Play, RefreshCcw, Send, SkipForward } from "lucide-react";
import { useMemo, useState } from "react";
import type { CcnaLessonRecord } from "@/lib/ccna-learning";
import { buildCcnaNewsletterEdition } from "@/lib/ccna-newsletter";

type Action = "draft" | "generate" | "publish" | "queue_linkedin" | "run_today" | "skip" | "sync";

export function CcnaLearningDesk({ initialLessons }: { initialLessons: CcnaLessonRecord[] }) {
  const [lessons, setLessons] = useState(initialLessons);
  const [selectedId, setSelectedId] = useState(initialLessons.find((lesson) => !["published", "skipped"].includes(lesson.status))?.id || initialLessons[0]?.id || "");
  const [busy, setBusy] = useState("");
  const [copied, setCopied] = useState(false);
  const [requestError, setRequestError] = useState("");
  const selected = lessons.find((lesson) => lesson.id === selectedId) || lessons[0];
  const commandCount = selected?.content?.lab.steps.reduce((total, step) => total + step.commands.length, 0) || 0;
  const explainedCommandCount = selected?.content?.lab.steps.reduce((total, step) => total + step.commands.filter((_, index) => Boolean(step.commandExplanations?.[index])).length, 0) || 0;
  const stats = useMemo(() => ({
    published: lessons.filter((lesson) => lesson.status === "published").length,
    review: lessons.filter((lesson) => lesson.status === "needs_review").length,
    remaining: lessons.filter((lesson) => !["published", "skipped"].includes(lesson.status)).length
  }), [lessons]);

  async function mutate(action: Action, id = "") {
    setBusy(`${action}:${id}`);
    setRequestError("");
    try {
      const response = await fetch("/api/admin/ccna-lessons", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action, id: id || undefined }) });
      const payload = await response.json() as { error?: string; lessons?: CcnaLessonRecord[] };
      if (!response.ok) throw new Error(payload.error || "CCNA action failed.");
      if (payload.lessons) setLessons(payload.lessons);
    } catch (error) {
      setRequestError(error instanceof Error ? error.message : "CCNA action failed. Please retry.");
    } finally {
      setBusy("");
    }
  }

  async function copyEdition() {
    if (!selected?.content) return;
    try {
      await navigator.clipboard.writeText(buildCcnaNewsletterEdition(selected));
      setCopied(true);
      setRequestError("");
      window.setTimeout(() => setCopied(false), 2500);
    } catch {
      setRequestError("The browser blocked clipboard access. Allow clipboard access and try again.");
    }
  }

  return (
    <section className="ccna-admin-desk">
      <header className="ccna-admin-heading">
        <div><p className="eyebrow">CCNA Learning Desk</p><h2>Weekday lesson and LinkedIn distribution control</h2><p>The next syllabus topic runs once per India weekday after 08:00. Only complete, cited, lab-ready lessons pass automatic publication.</p></div>
        <div className="button-row"><button className="button secondary" disabled={Boolean(busy)} onClick={() => mutate("sync")} type="button"><RefreshCcw aria-hidden="true" size={17} /> Sync syllabus</button><button className="button primary" disabled={Boolean(busy)} onClick={() => mutate("run_today")} type="button">{busy.startsWith("run_today") ? <LoaderCircle aria-hidden="true" className="admin-action-spinner" size={17} /> : <Play aria-hidden="true" size={17} />} Run today&apos;s edition</button></div>
      </header>
      {requestError ? <p className="form-error" role="alert">{requestError}</p> : null}
      <div className="ccna-admin-metrics"><div><GraduationCap aria-hidden="true" /><span>Curriculum</span><strong>{lessons.length}</strong></div><div><CalendarCheck aria-hidden="true" /><span>Published</span><strong>{stats.published}</strong></div><div><BookOpenCheck aria-hidden="true" /><span>Remaining</span><strong>{stats.remaining}</strong></div><div><RefreshCcw aria-hidden="true" /><span>Needs review</span><strong>{stats.review}</strong></div></div>

      <div className="ccna-admin-layout">
        <aside className="ccna-admin-queue" aria-label="CCNA lesson queue">
          {lessons.map((lesson) => <button className={lesson.id === selected?.id ? "is-selected" : ""} key={lesson.id} onClick={() => setSelectedId(lesson.id)} type="button"><span>Day {String(lesson.sequence).padStart(2, "0")}</span><strong>{lesson.title}</strong><i className={`content-status-${lesson.status}`}>{lesson.status.replace("_", " ")}</i></button>)}
        </aside>

        {selected ? <article className="ccna-admin-detail">
          <header><div><p className="eyebrow">Week {selected.week} / Day {selected.sequence}</p><h3>{selected.title}</h3><p>{selected.moduleTitle}</p></div><span className={`status-pill content-status-${selected.status}`}>{selected.status.replace("_", " ")}</span></header>
          <dl className="ccna-admin-map"><div><dt>Current v1.1</dt><dd>{selected.v11Blueprint}</dd></div><div><dt>Announced v2.0</dt><dd>{selected.v20Blueprint}</dd></div><div><dt>Quality</dt><dd>{selected.qualityScore || "Pending"}</dd></div><div><dt>Attempts</dt><dd>{selected.attempts}</dd></div></dl>
          {selected.content ? <div className="ccna-admin-preview"><strong>{selected.content.learnerOutcome}</strong><p>{selected.content.plainAnswer}</p><div><span>{selected.content.sections.length} teaching sections</span><span>{selected.content.lab.steps.length} lab steps</span><span>{selected.content.practiceQuestions.length} practice questions</span><span>{selected.content.quiz.length} quiz questions</span><span>{selected.content.sources.length} sources</span></div></div> : <div className="empty-state"><h3>Lesson content is not generated yet.</h3><p>Generation researches the controlled topic, builds the lesson and lab, then applies the publishing gate.</p></div>}
          {selected.content ? <p className="ccna-admin-beginner-status">Beginner guide: {selected.content.beginnerGuide ? "included" : "required before the next publication"}. Command explanations: {explainedCommandCount}/{commandCount}. Automated checks do not replace testing with real learners.</p> : null}
          {selected.lastError ? <p className="ccna-admin-error">{selected.lastError}</p> : null}
          <div className="ccna-admin-actions">
            {["scheduled", "retry", "needs_review", "draft"].includes(selected.status) ? <button className="button secondary" disabled={Boolean(busy)} onClick={() => mutate("generate", selected.id)} type="button"><RefreshCcw aria-hidden="true" size={17} /> {selected.content ? "Regenerate" : "Generate lesson"}</button> : null}
            {["draft", "needs_review"].includes(selected.status) && selected.content ? <button className="button primary" disabled={Boolean(busy)} onClick={() => mutate("publish", selected.id)} type="button"><Check aria-hidden="true" size={17} /> Publish</button> : null}
            {selected.status === "published" ? <><Link className="button secondary" href={`/courses/ccna/lessons/${selected.slug}`} target="_blank">Open lesson <ExternalLink aria-hidden="true" size={16} /></Link><button className="button secondary" disabled={Boolean(busy)} onClick={() => mutate("queue_linkedin", selected.id)} type="button"><Send aria-hidden="true" size={17} /> Queue LinkedIn</button><button className="button secondary" onClick={copyEdition} type="button">{copied ? <Check aria-hidden="true" size={17} /> : <Clipboard aria-hidden="true" size={17} />} {copied ? "Copied" : "Copy native edition"}</button><a className="button secondary" href="https://www.linkedin.com/article/new/" rel="noreferrer" target="_blank">Open LinkedIn editor <ExternalLink aria-hidden="true" size={16} /></a><button className="button secondary" disabled={Boolean(busy)} onClick={() => mutate("draft", selected.id)} type="button">Return to draft</button></> : null}
            {!["published", "skipped"].includes(selected.status) ? <button aria-label="Skip lesson" className="icon-button danger" disabled={Boolean(busy)} onClick={() => mutate("skip", selected.id)} title="Skip lesson" type="button"><SkipForward aria-hidden="true" size={18} /></button> : null}
          </div>
          <aside className="ccna-native-note"><strong>Native LinkedIn Newsletter</strong><p>LinkedIn does not expose newsletter-edition publishing in the documented Posts API. Copy native edition prepares the full lesson for LinkedIn&apos;s article editor; the supported API distribution still posts the canonical QCS lesson with its 16:9 cover, structured commentary, link, and hashtags.</p></aside>
        </article> : null}
      </div>
    </section>
  );
}
