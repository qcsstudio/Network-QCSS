"use client";

import { FormEvent, useMemo, useState } from "react";
import { getStoredConsent } from "@/components/consent-banner";
import { tools } from "@/lib/content";
import { trackBrowserEvent } from "@/lib/client-tracking";

type AssessmentToolProps = {
  slug?: string;
};

function scoreAnswers(values: string[]) {
  let score = 0;
  for (const value of values) {
    const text = value.toLowerCase();
    if (["no", "none", "never", "not enabled", "not sure", "over 12 months", "500+", "major", "site down", "multiple sites", "this week"].some((term) => text.includes(term))) {
      score += 16;
    } else if (["partial", "manual", "older", "maybe", "today", "101-500", "200-500"].some((term) => text.includes(term))) {
      score += 10;
    } else {
      score += 5;
    }
  }
  return Math.min(100, Math.max(18, score));
}

function riskLevel(score: number) {
  if (score >= 75) return "Critical priority";
  if (score >= 55) return "High priority";
  if (score >= 35) return "Medium priority";
  return "Low attention";
}

function sessionId() {
  const key = "network-qcss-session";
  const existing = window.localStorage.getItem(key);
  if (existing) return existing;
  const created = `sess_${Math.random().toString(36).slice(2)}_${Date.now().toString(36)}`;
  window.localStorage.setItem(key, created);
  return created;
}

export function AssessmentTool({ slug = "network-risk-score" }: AssessmentToolProps) {
  const initialTool = useMemo(() => tools.find((tool) => tool.slug === slug) || tools[0], [slug]);
  const [activeSlug, setActiveSlug] = useState(initialTool.slug);
  const [result, setResult] = useState<{ score: number; riskLevel: string; recommendation: string; pipeline: string } | null>(null);

  const activeTool = tools.find((tool) => tool.slug === activeSlug) || tools[0];

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const answers = Object.fromEntries(formData.entries());
    const score = scoreAnswers(Object.values(answers).map(String));
    const level = riskLevel(score);
    const nextResult = {
      score,
      riskLevel: level,
      recommendation: activeTool.recommendation,
      pipeline: activeTool.pipeline
    };
    setResult(nextResult);
    trackBrowserEvent("assessment_complete", {
      tool: activeTool.slug,
      pipeline: activeTool.pipeline,
      score
    });

    await fetch("/api/assessments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tool: activeTool.slug,
        title: activeTool.title,
        pipeline: activeTool.pipeline,
        recommendation: activeTool.recommendation,
        riskLevel: level,
        score,
        answers,
        sessionId: sessionId(),
        attribution: { landing: window.location.pathname, referrer: document.referrer || undefined },
        consent: getStoredConsent()
      })
    });
  }

  return (
    <div className="tool-shell">
      <aside className="tool-tabs" aria-label="Diagnostic tools">
        {tools.map((tool) => (
          <button className={tool.slug === activeSlug ? "active" : ""} key={tool.slug} onClick={() => setActiveSlug(tool.slug)} type="button">
            {tool.title}
          </button>
        ))}
      </aside>

      <div className="tool-workspace">
        <p className="eyebrow">{activeTool.category}</p>
        <h2>{activeTool.title}</h2>
        <p>{activeTool.description}</p>

        <form className="assessment-form" onSubmit={submit}>
          {activeTool.fields.map((field) => (
            <label key={field.name}>
              {field.label}
              <select name={field.name} required defaultValue="">
                <option value="" disabled>
                  Select
                </option>
                {field.options.map((option) => (
                  <option key={option}>{option}</option>
                ))}
              </select>
            </label>
          ))}
          <button className="button primary" type="submit">
            Generate Score
          </button>
        </form>

        <div className="assessment-result">
          <span className="score-ring">{result?.score ?? "--"}</span>
          <div>
            <p className="eyebrow">Assessment result</p>
            <h3>{result ? `${result.riskLevel}: ${result.recommendation}` : "Run a tool to generate a lead profile."}</h3>
            <p>
              {result
                ? `Route this visitor to ${result.pipeline}. The result is stored for admin review and follow-up.`
                : "Results map the visitor to a service, lead score, CRM pipeline, and automation workflow."}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
