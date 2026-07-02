"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

const DEFAULT_LIMITS = {
  headline: 220,
  about: 2600,
  experienceRoleDescription: 2000,
  experienceBullet: 600,
};
const TARGET_REWRITE_SCORE = 100;

export default function Suggestions() {
  const [report, setReport] = useState(null);
  const [profile, setProfile] = useState(null);
  const [isPaid, setIsPaid] = useState(false);
  const [aiRewrite, setAiRewrite] = useState(null);
  const [rewriteLoading, setRewriteLoading] = useState(false);
  const [rewriteError, setRewriteError] = useState("");

  useEffect(() => {
    setIsPaid(localStorage.getItem("linkedin_rewrite_paid") === "true");

    try {
      const storedReport = localStorage.getItem("linkedin_audit_report");
      const storedProfile = localStorage.getItem("linkedin_audit_profile");
      setReport(storedReport ? JSON.parse(storedReport) : null);
      setProfile(storedProfile ? JSON.parse(storedProfile) : null);
    } catch {
      setReport(null);
      setProfile(null);
    }
  }, []);

  useEffect(() => {
    if (!report || !isPaid) return;

    let cancelled = false;
    const generateRewrite = async () => {
      try {
        setRewriteLoading(true);
        setRewriteError("");
        const res = await fetch("/api/analyze/rewrite", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ report, profile, paymentVerified: true }),
        });
        const data = await safeJson(res);

        if (!res.ok || !data?.success || data?.source !== "openai" || !data?.rewrite) {
          throw new Error(data?.message || "AI-enhanced rewrite could not be generated.");
        }

        if (!cancelled) setAiRewrite(data.rewrite);
      } catch (error) {
        if (!cancelled) {
          setAiRewrite(null);
          setRewriteError(error.message || "AI-enhanced rewrite could not be generated.");
        }
      } finally {
        if (!cancelled) setRewriteLoading(false);
      }
    };

    generateRewrite();
    return () => {
      cancelled = true;
    };
  }, [report, profile, isPaid]);

  const rewrite = useMemo(() => (aiRewrite ? buildRewrite(aiRewrite) : null), [aiRewrite]);
  const subScores = useMemo(() => Object.entries(report?.subScores || {}), [report]);

  if (!report) {
    return (
      <main className="min-vh-100 d-flex align-items-center justify-content-center p-4">
        <div className="text-center" style={{ maxWidth: 620 }}>
          <h1 className="mb-3">No paid rewrite report found</h1>
          <p className="text-muted mb-4">
            Please run your LinkedIn profile audit first, then complete payment to unlock AI-enhanced rewrite suggestions.
          </p>
          <Link href="/linkedin-profile-audit" className="cs_btn cs_style_1">
            <span>Run LinkedIn Audit</span>
          </Link>
        </div>
      </main>
    );
  }

  if (!isPaid) {
    return (
      <main className="min-vh-100 d-flex align-items-center justify-content-center p-4">
        <div className="text-center bg-white rounded-4 shadow-sm p-4 p-lg-5" style={{ maxWidth: 660 }}>
          <p className="text-primary fw-semibold mb-2">QCS LinkedIn Profile Rewrite</p>
          <h1 className="mb-3">Payment is required to generate your AI-enhanced rewrite.</h1>
          <p className="text-muted mb-4">
            Your audit score is ready. Complete payment to generate the final AI rewrite that targets a 100% QCS profile score.
          </p>
          <Link href="/payment" className="cs_btn cs_style_1">
            <span>Complete Payment</span>
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-vh-100 p-4" style={{ background: "#f8fafc" }}>
      <div className="container py-5">
        <div className="bg-white rounded-4 shadow-sm p-4 p-lg-5 mb-4">
          <div className="d-flex flex-column flex-lg-row justify-content-between gap-4">
            <div>
              <p className="text-primary fw-semibold mb-2">QCS LinkedIn Profile Rewrite</p>
              <h1 className="mb-3">Your AI-enhanced rewrite workspace is ready.</h1>
              <p className="text-muted mb-0">
                We generate this only after payment using your role-based audit and scraped profile facts. All rewrite sections are constrained to LinkedIn character limits.
                {rewriteLoading && " Building your AI-enhanced rewrite..."}
              </p>
            </div>
            <div className="text-lg-end">
              <div className="display-5 fw-bold text-success">{rewrite?.projectedScore || TARGET_REWRITE_SCORE}%</div>
              <p className="text-muted mb-1">Projected after rewrite</p>
              <div className="fw-semibold text-black">Current: {report.overallScore || 0}</div>
              <span className="badge bg-success mt-2">Payment verified</span>
              <div className="small text-muted mt-2">Rewrite source: AI enhanced</div>
            </div>
          </div>
        </div>

        {rewriteLoading && !rewrite && (
          <div className="bg-white rounded-4 shadow-sm p-4 mb-4 text-center">
            <h2 className="h4 mb-2">Generating your AI-enhanced rewrite...</h2>
            <p className="text-muted mb-0">This usually takes a few seconds.</p>
          </div>
        )}

        {rewriteError && !rewrite && (
          <div className="bg-white rounded-4 shadow-sm p-4 mb-4">
            <h2 className="h4 mb-2 text-danger">AI rewrite could not be generated</h2>
            <p className="text-muted mb-3">{rewriteError}</p>
            <button className="cs_btn cs_style_1" type="button" onClick={() => window.location.reload()}>
              <span>Try Again</span>
            </button>
          </div>
        )}

        {rewrite && (
          <>
            <div className="row g-4 mb-4">
              <div className="col-lg-6">
                <div className="bg-white rounded-4 shadow-sm p-4 h-100">
                  <h2 className="h4 mb-3">Headline rewrite</h2>
                  <div className="d-flex flex-column gap-3">
                    {rewrite.headlines.map((headline, index) => (
                      <div className="border rounded-3 p-3" key={`${headline}-${index}`}>
                        <span className="badge bg-primary mb-2">Option {index + 1}</span>
                        <p className="text-muted mb-1">{headline}</p>
                        <small className={characterCountClass(headline.length, rewrite.limits.headline)}>
                          {headline.length}/{rewrite.limits.headline} characters
                        </small>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              <div className="col-lg-6">
                <div className="bg-white rounded-4 shadow-sm p-4 h-100">
                  <h2 className="h4 mb-3">About rewrite</h2>
                  <p className="text-muted mb-1" style={{ whiteSpace: "pre-line" }}>
                    {rewrite.about}
                  </p>
                  <small className={characterCountClass(rewrite.about.length, rewrite.limits.about)}>
                    {rewrite.about.length}/{rewrite.limits.about} characters
                  </small>
                  {rewrite.assumptions.length > 0 && (
                    <div className="alert alert-warning mt-3 mb-0 py-2 small">
                      {rewrite.assumptions.map((warning) => (
                        <div key={warning}>{warning}</div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {(rewrite.experienceBullets.length > 0 || rewrite.featuredPlan.length > 0) && (
              <div className="bg-white rounded-4 shadow-sm p-4 mb-4">
                <div className="row g-4">
                  {rewrite.experienceBullets.length > 0 && (
                    <div className="col-lg-8">
                      <h2 className="h4 mb-3">Experience bullet rewrites</h2>
                      <div className="row g-3">
                        {rewrite.experienceBullets.map((role, index) => (
                          <div className="col-lg-6" key={`${role.roleTitle || "role"}-${index}`}>
                            <div className="border rounded-3 p-3 h-100">
                              <strong>{role.roleTitle || "Current role"}{role.company ? ` · ${role.company}` : ""}</strong>
                              <ul className="text-muted mt-2 mb-1 ps-3">
                                {(role.suggestedBullets || []).map((bullet) => (
                                  <li key={bullet}>{bullet}</li>
                                ))}
                              </ul>
                              <small className={characterCountClass(role.suggestedBullets.join("\n").length, rewrite.limits.experienceRoleDescription)}>
                                {role.suggestedBullets.join("\n").length}/{rewrite.limits.experienceRoleDescription} characters for this role
                              </small>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {rewrite.featuredPlan.length > 0 && (
                    <div className="col-lg-4">
                      <h2 className="h4 mb-3">Featured proof plan</h2>
                      <ul className="text-muted mb-0 ps-3">
                        {rewrite.featuredPlan.map((item) => (
                          <li key={item}>{item}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="row g-4">
              <div className="col-lg-7">
                <div className="bg-white rounded-4 shadow-sm p-4 h-100">
                  <h2 className="h4 mb-4">Priority fixes for 100%</h2>
                  <div className="d-flex flex-column gap-3">
                    {rewrite.priorityFixes.map((item) => (
                      <div key={item.id} className="border rounded-3 p-3">
                        <div className="d-flex justify-content-between gap-3 mb-2">
                          <strong>{item.title}</strong>
                          <span className="badge bg-primary">{item.priority}</span>
                        </div>
                        <p className="text-muted mb-0">{item.recommendation}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="col-lg-5">
                <div className="bg-white rounded-4 shadow-sm p-4 h-100">
                  <h2 className="h4 mb-4">Score breakdown</h2>
                  <div className="d-flex justify-content-between align-items-center border rounded-3 p-3 mb-3">
                    <span>Projected rewrite score</span>
                    <strong className="text-success">{rewrite.projectedScore}%</strong>
                  </div>
                  {subScores.length ? (
                    <div className="d-flex flex-column gap-3">
                      {subScores.map(([key, value]) => (
                        <div key={key}>
                          <div className="d-flex justify-content-between mb-1">
                            <span>{value.label || key}</span>
                            <strong>{value.score || 0}</strong>
                          </div>
                          <div className="progress" role="progressbar" aria-valuenow={value.score || 0} aria-valuemin="0" aria-valuemax="100">
                            <div className="progress-bar" style={{ width: `${value.score || 0}%` }}></div>
                          </div>
                          {value.description && <small className="text-muted">{value.description}</small>}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-muted mb-0">No score breakdown was generated.</p>
                  )}
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </main>
  );
}

function buildRewrite(aiRewrite) {
  const limits = aiRewrite.characterLimits || DEFAULT_LIMITS;
  return {
    headlines: Array.isArray(aiRewrite.headlineOptions) ? aiRewrite.headlineOptions : [],
    about: aiRewrite.aboutRewrite || "",
    experienceBullets: Array.isArray(aiRewrite.experienceBulletSuggestions) ? aiRewrite.experienceBulletSuggestions : [],
    featuredPlan: Array.isArray(aiRewrite.featuredPlan) ? aiRewrite.featuredPlan : [],
    priorityFixes: Array.isArray(aiRewrite.priorityFixes) ? aiRewrite.priorityFixes : [],
    assumptions: Array.isArray(aiRewrite.assumptions) ? aiRewrite.assumptions : [],
    projectedScore: Number(aiRewrite.projectedScore || TARGET_REWRITE_SCORE),
    limits,
  };
}

async function safeJson(response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function characterCountClass(count, limit) {
  return count <= limit ? "text-success small" : "text-danger small";
}
