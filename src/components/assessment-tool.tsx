"use client";

import { FormEvent, useMemo, useState } from "react";
import { getStoredConsent } from "@/components/consent-banner";
import { AssessmentResult, getAssessmentFramework, scoreAssessment } from "@/lib/assessment-engine";
import { tools } from "@/lib/content";
import { trackBrowserEvent } from "@/lib/client-tracking";

type AssessmentToolProps = {
  slug?: string;
};

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
  const [result, setResult] = useState<AssessmentResult | null>(null);

  const activeTool = tools.find((tool) => tool.slug === activeSlug) || tools[0];
  const framework = getAssessmentFramework(activeTool.slug);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const answers = Object.fromEntries(formData.entries());
    const nextResult = scoreAssessment(activeTool, answers);
    setResult(nextResult);
    trackBrowserEvent("assessment_complete", {
      tool: activeTool.slug,
      pipeline: nextResult.pipeline,
      score: nextResult.score,
      riskBand: nextResult.riskBand,
      cta: nextResult.cta.label,
      dominantDomains: nextResult.domainScores.slice(0, 3).map((domain) => domain.label)
    });

    await fetch("/api/assessments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tool: activeTool.slug,
        title: activeTool.title,
        pipeline: nextResult.pipeline,
        recommendation: nextResult.recommendation,
        riskLevel: nextResult.riskLevel,
        score: nextResult.score,
        answers: {
          raw: answers,
          profile: nextResult
        },
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
          <button
            className={tool.slug === activeSlug ? "active" : ""}
            key={tool.slug}
            onClick={() => {
              setActiveSlug(tool.slug);
              setResult(null);
            }}
            type="button"
          >
            {tool.title}
          </button>
        ))}
      </aside>

      <div className="tool-workspace">
        <p className="eyebrow">{activeTool.category}</p>
        <h2>{activeTool.title}</h2>
        <p>{activeTool.description}</p>

        <form className="assessment-form" onSubmit={submit}>
          {activeTool.fields.map((field) => {
            const fieldModel = framework?.fields[field.name];
            return (
              <label key={field.name}>
                <span>{field.label}</span>
                {fieldModel ? <small>{fieldModel.domainLabel}</small> : null}
                <select name={field.name} required defaultValue="">
                  <option value="" disabled>
                    Select
                  </option>
                  {field.options.map((option) => (
                    <option key={option}>{option}</option>
                  ))}
                </select>
              </label>
            );
          })}
          <button className="button primary" type="submit">
            Generate Assessment
          </button>
        </form>

        <div className="assessment-result">
          <span className="score-ring">{result?.score ?? "--"}</span>
          <div>
            <p className="eyebrow">Assessment result</p>
            <h3>{result ? `${result.riskLevel}: ${result.recommendation}` : "Run an assessment to generate a readiness snapshot."}</h3>
            <p>
              {result
                ? `Recommended path: ${result.pipeline}. Maturity score: ${result.maturityScore}.`
                : "Your answers create a practical view of risk domains, evidence needs, and suggested next steps."}
            </p>
            {result ? (
              <div className="assessment-cta-row">
                <a className="button primary" href={result.cta.href}>
                  {result.cta.label}
                </a>
                <span>{result.cta.responseWindow}</span>
              </div>
            ) : null}
          </div>
        </div>

        {framework ? (
          <div className="assessment-method">
            <strong>Assessment method</strong>
            <span>{framework.method}</span>
            <div className="method-chip-row">
              {framework.frameworks.map((item) => (
                <em key={item}>{item}</em>
              ))}
            </div>
          </div>
        ) : null}

        {result ? (
          <div className="assessment-report">
            <section className="assessment-panel">
              <div className="panel-heading compact">
                <div>
                  <p className="eyebrow">Risk domains</p>
                  <h3>What is driving the score</h3>
                </div>
              </div>
              <div className="domain-score-list">
                {result.domainScores.map((domain) => (
                  <article key={domain.domain}>
                    <div>
                      <strong>{domain.label}</strong>
                      <span>{domain.score}% risk signal</span>
                    </div>
                    <meter min={0} max={100} value={domain.score}>
                      {domain.score}
                    </meter>
                  </article>
                ))}
              </div>
            </section>

            <section className="assessment-panel">
              <p className="eyebrow">Top findings</p>
              <div className="finding-list">
                {result.topFindings.map((finding) => (
                  <article key={`${finding.question}-${finding.answer}`}>
                    <span className={`severity-pill ${finding.severity.toLowerCase()}`}>{finding.severity}</span>
                    <h3>{finding.domainLabel}</h3>
                    <p>
                      {finding.question}: <strong>{finding.answer}</strong>
                    </p>
                    <small>{finding.technique}</small>
                  </article>
                ))}
              </div>
            </section>

            <section className="assessment-panel wide">
              <p className="eyebrow">Next action logic</p>
              <div className="action-grid">
                <article>
                  <h3>Recommended support path</h3>
                  <p>{result.cta.owner}</p>
                  <span>{result.cta.note}</span>
                </article>
                <article>
                  <h3>Evidence to request</h3>
                  <ul>
                    {result.evidenceRequests.slice(0, 5).map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </article>
                <article>
                  <h3>Follow-up steps</h3>
                  <ul>
                    {result.nextActions.slice(0, 4).map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </article>
              </div>
            </section>
          </div>
        ) : null}
      </div>
    </div>
  );
}
