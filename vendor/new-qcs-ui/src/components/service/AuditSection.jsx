"use client";
import Image from "next/image";
import Link from "next/link";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { PulseLoader } from "react-spinners";
import { scoreLinkedInProfilePayload } from "@/scoring/linkedinProfileScoring";


const QCS_EXTENSION_IDS = [
  { id: "fjaidibhjogjhbpdnljpbchhpcdcocaf", label: "Local QCS development extension" },
  { id: "fongccbjkdphnmdigpkbphnjaiodmlek", label: "QCS Chrome Web Store extension" },
];
const PENDING_AUDIT_REQUEST_KEY = "qcs_pending_linkedin_audit_request";
const EXTENSION_DETECTION_WINDOW_MS = 6000;
const EXACT_EXTENSION_CHECK_TIMEOUT_MS = 3000;
const SCRAPE_RESPONSE_TIMEOUT_MS = 600000;

const isExtensionReadyMessage = (data) => {
  if (!data) return false;
  if (data === "EXTENSION_RUNNING" || data === "QCS_LINKEDIN_AUDIT_READY") return true;

  if (typeof data !== "object") return false;

  const type = String(data.type || data.event || "").toUpperCase();
  const from = String(data.from || data.source || "").toUpperCase();

  if (from === "QCS_LINKEDIN_AUDIT_PAGE") return false;

  return (
    from.includes("LINKEDIN_AUDIT_EXT") ||
    from.includes("QCS_LINKEDIN_AUDIT_EXTENSION") ||
    type === "EXTENSION_RUNNING" ||
    type === "EXTENSION_READY" ||
    type === "PONG_EXTENSION" ||
    type === "PONG" ||
    type === "QCS_LINKEDIN_AUDIT_READY"
  );
};

const postExtensionPing = () => {
  window.postMessage("PING_EXTENSION", "*");
  window.postMessage({ type: "PING_EXTENSION", from: "QCS_LINKEDIN_AUDIT_PAGE" }, "*");
  window.postMessage({ type: "QCS_LINKEDIN_AUDIT_PING", from: "QCS_LINKEDIN_AUDIT_PAGE" }, "*");
};

const readPendingAuditRequest = () => {
  if (typeof window === "undefined") return null;

  try {
    const value = window.localStorage.getItem(PENDING_AUDIT_REQUEST_KEY);
    return value ? JSON.parse(value) : null;
  } catch {
    window.localStorage.removeItem(PENDING_AUDIT_REQUEST_KEY);
    return null;
  }
};

const persistPendingAuditRequest = (auditRequest) => {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(PENDING_AUDIT_REQUEST_KEY, JSON.stringify(auditRequest));
};

const clearPendingAuditRequest = () => {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(PENDING_AUDIT_REQUEST_KEY);
};

const getChromeRuntime = () => {
  if (typeof window === "undefined") return null;
  return window.chrome?.runtime?.sendMessage ? window.chrome.runtime : null;
};

const sendExtensionHealthCheck = (runtime, extension) => {
  return new Promise((resolve) => {
    let settled = false;

    const finish = (result) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeout);
      resolve(result);
    };

    const timeout = window.setTimeout(() => {
      finish({
        installed: false,
        extensionId: extension.id,
        extensionLabel: extension.label,
        reason: `${extension.label} did not answer yet.`,
      });
    }, EXACT_EXTENSION_CHECK_TIMEOUT_MS);

    try {
      runtime.sendMessage(
        extension.id,
        {
          type: "QCS_LINKEDIN_AUDIT_HEALTH_CHECK",
          source: "QCS_WEBSITE",
          expectedExtension: "QCS_LINKEDIN_AUDIT",
        },
        (response) => {
          const lastError = runtime.lastError;

          if (lastError) {
            finish({
              installed: false,
              extensionId: extension.id,
              extensionLabel: extension.label,
              reason: `${extension.label} could not be verified by ID yet.`,
            });
            return;
          }

          finish({
            installed: true,
            exactCheckAvailable: true,
            extensionId: extension.id,
            extensionLabel: extension.label,
            response,
          });
        }
      );
    } catch (error) {
      finish({
        installed: false,
        extensionId: extension.id,
        extensionLabel: extension.label,
        reason: `${extension.label} could not be checked by ID.`,
      });
    }
  });
};

const verifyExactQcsExtension = async () => {
  const runtime = getChromeRuntime();

  if (!runtime) {
    return {
      installed: false,
      exactCheckAvailable: false,
      reason: "Exact extension ID check is not available from this tab, so we will connect using the extension content script.",
    };
  }

  for (const extension of QCS_EXTENSION_IDS) {
    const result = await sendExtensionHealthCheck(runtime, extension);
    if (result.installed) return result;
  }

  return {
    installed: false,
    exactCheckAvailable: true,
    reason: "Neither the local QCS test extension nor the Chrome Web Store extension could be verified by ID yet. We will also try to connect to the extension content script in this tab.",
  };
};


const requestAnalyzerReport = async (profilePayload) => {
  const response = await fetch("/api/analyze/url", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(profilePayload),
  });

  if (!response.ok) {
    throw new Error(`Analyzer request failed with status ${response.status}`);
  }

  return response.json();
};

const getScoreTone = (score) => {
  if (score >= 85) return { label: "Excellent", color: "#16a34a", status: "Best-practice aligned" };
  if (score >= 70) return { label: "Strong", color: "#22c55e", status: "Good foundation" };
  if (score >= 50) return { label: "Average", color: "#f59e0b", status: "Needs optimization" };
  return { label: "Needs work", color: "#dc2626", status: "Conversion risk" };
};

export default function AuditSection() {
  // ================= STATES =================
  const [url, setUrl] = useState("");
  const [role, setRole] = useState("Job Seeker");
  const [accepted, setAccepted] = useState(false);

  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  const [showResultModal, setShowResultModal] = useState(false);
  const [showExtensionPopup, setShowExtensionPopup] = useState(false);
  const [checkingExtension, setCheckingExtension] = useState(true);
  const [extensionIdentity, setExtensionIdentity] = useState({
    status: "checking",
    message: "Checking the official QCS Chrome extension...",
  });

  const [isExtensionReady, setIsExtensionReady] = useState(false);
  const [auditSteps, setAuditSteps] = useState([]);

  const extensionIdentityVerifiedRef = useRef(false);
  const extensionDetectedRef = useRef(false);
  const pendingAuditRequestRef = useRef(null);
  const scrapePendingRef = useRef(false);

  const addAuditStep = useCallback((label, detail = "") => {
    setAuditSteps((current) => [
      ...current.slice(-7),
      {
        id: `${Date.now()}-${current.length}`,
        label,
        detail,
      },
    ]);
  }, []);

  const markExtensionReady = useCallback(() => {
    if (extensionDetectedRef.current) return;

    extensionDetectedRef.current = true;
    setIsExtensionReady(true);
    setCheckingExtension(false);
    setShowExtensionPopup(false);
    setExtensionIdentity((current) => ({
      ...current,
      status: current.status === "verified" ? "verified" : "content-script-connected",
      message: "QCS extension is connected in this tab.",
    }));
    addAuditStep("Extension loaded", "QCS extension content script is communicating with this page.");
    localStorage.removeItem("audit_waiting_for_extension");
    localStorage.removeItem("audit_auto_reloaded");

    const pendingAuditRequest = pendingAuditRequestRef.current || readPendingAuditRequest();
    if (pendingAuditRequest) {
      pendingAuditRequestRef.current = null;
      clearPendingAuditRequest();
      beginScrape(pendingAuditRequest);
    }
  }, [addAuditStep]);

  const checkOfficialExtension = useCallback(async ({ showInstallPrompt = false } = {}) => {
    setExtensionIdentity({
      status: "checking",
      message: "Checking the official QCS Chrome extension...",
    });
    addAuditStep("Checking extension", "Looking for the local test extension and the store extension.");

    const result = await verifyExactQcsExtension();

    if (!result.installed) {
      extensionIdentityVerifiedRef.current = false;
      setExtensionIdentity({
        status: "content-script-check",
        message: result.reason || "Checking whether the QCS extension is loaded in this tab...",
      });
      postExtensionPing();
      return true;
    }

    extensionIdentityVerifiedRef.current = true;
    addAuditStep("Extension found", `${result.extensionLabel || "QCS Chrome extension"} answered the health check.`);
    setExtensionIdentity({
      status: "verified",
      message: `${result.extensionLabel || "QCS Chrome extension"} is installed. Waiting for it to load in this tab...`,
      response: result.response,
    });
    setShowExtensionPopup(false);
    postExtensionPing();

    const pendingAuditRequest = pendingAuditRequestRef.current || readPendingAuditRequest();
    if (extensionDetectedRef.current && pendingAuditRequest) {
      pendingAuditRequestRef.current = null;
      clearPendingAuditRequest();
      beginScrape(pendingAuditRequest);
    }

    return true;
  }, [addAuditStep]);

  useEffect(() => {
    checkOfficialExtension({ showInstallPrompt: false });
  }, [checkOfficialExtension]);

  // ================= EXTENSION CHECK =================
  useEffect(() => {
    let pingInterval;
    let detectionTimeout;
    let reloadTimeout;

    const handler = (e) => {
      if (isExtensionReadyMessage(e.data)) {
        markExtensionReady();
      }
    };

    const pingExtension = () => {
      if (!extensionDetectedRef.current) {
        postExtensionPing();
      }
    };

    window.addEventListener("message", handler);
    pingExtension();
    pingInterval = setInterval(pingExtension, 700);

    const hasReloaded = localStorage.getItem("audit_auto_reloaded");
    if (!hasReloaded) {
      localStorage.setItem("audit_auto_reloaded", "true");
      reloadTimeout = setTimeout(() => {
        if (!extensionDetectedRef.current) {
          window.location.reload();
        }
      }, 1200);
    }

    detectionTimeout = setTimeout(() => {
      if (!extensionDetectedRef.current) {
        setCheckingExtension(false);
      }
    }, EXTENSION_DETECTION_WINDOW_MS);

    return () => {
      clearInterval(pingInterval);
      clearTimeout(detectionTimeout);
      clearTimeout(reloadTimeout);
      window.removeEventListener("message", handler);
    };
  }, [markExtensionReady]);


  useEffect(() => {
    const onFocus = async () => {
      const waiting = localStorage.getItem("audit_waiting_for_extension");

      if (waiting) {
        localStorage.removeItem("audit_waiting_for_extension");
        const verified = await checkOfficialExtension({ showInstallPrompt: true });

        if (verified && !extensionDetectedRef.current) {
          postExtensionPing();
          window.setTimeout(() => {
            if (!extensionDetectedRef.current) {
              window.location.reload();
            }
          }, 1200);
        }
      }
    };

    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [checkOfficialExtension]);



  // ================= LISTEN SCRAPE RESULT =================
  useEffect(() => {
    const onMsg = async (e) => {
      if (!e.data || typeof e.data !== "object") return;

      if (isExtensionReadyMessage(e.data)) {
        markExtensionReady();
      }

      if (e.data.from !== "LINKEDIN_AUDIT_EXT") return;

      if (e.data.type === "QCS_LINKEDIN_AUDIT_STATUS") {
        addAuditStep(e.data.status || "Extension update", e.data.message || "");
      }

      if (e.data.from !== "LINKEDIN_AUDIT_EXT") return;

      if (e.data.type === "SCRAPE_RESULT") {
        const rawProfilePayload = e.data.payload;
        scrapePendingRef.current = false;
        addAuditStep("Data received from extension", "Raw LinkedIn profile data reached the QCS website.");

        try {
          addAuditStep("Analysing data", "Sending raw profile data from QCS website to analyzer.");
          const analysis = await requestAnalyzerReport(rawProfilePayload);
          addAuditStep("Analysis complete", "Analyzer returned the profile audit result.");
          setResult({ ...rawProfilePayload, analysis });
        } catch (error) {
          addAuditStep("Analyzer warning", error instanceof Error ? error.message : "Analyzer request failed");
          setResult({
            ...rawProfilePayload,
            analyzerError: error instanceof Error ? error.message : "Analyzer request failed",
          });
        } finally {
          setLoading(false);
          setShowResultModal(true);
        }
      }

      if (e.data.type === "SCRAPE_ERROR") {
        scrapePendingRef.current = false;
        addAuditStep("Extension not found", "Install, reload, or enable site access for the QCS extension.");
        setLoading(false);
        setShowExtensionPopup(true);
      }
    };

    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, [markExtensionReady, addAuditStep]);

  // ================= HELPERS =================
  const normalizeLinkedInUrl = (rawUrl) => {
    let finalUrl = rawUrl.trim();
    if (!finalUrl.startsWith("http://") && !finalUrl.startsWith("https://")) {
      finalUrl = "https://" + finalUrl;
    }
    return finalUrl;
  };

  const beginScrape = ({ finalUrl, selectedRole, termsAccepted }) => {
    clearPendingAuditRequest();
    scrapePendingRef.current = true;
    setAuditSteps([]);
    addAuditStep("Scrape started", "Sending the LinkedIn profile URL to the extension.");
    setLoading(true);
    setShowExtensionPopup(false);

    window.postMessage(
      {
        type: "START_SCRAPE",
        url: finalUrl,
        role: selectedRole,
        accepted: termsAccepted,
        sameTab: true,
        scoringModel: "QCS role-based LinkedIn profile audit",
      },
      "*"
    );

    window.setTimeout(() => {
      if (scrapePendingRef.current) {
        scrapePendingRef.current = false;
        addAuditStep("Extension timeout", "The extension did not return data before the timeout window.");
        setLoading(false);
        setShowExtensionPopup(true);
      }
    }, SCRAPE_RESPONSE_TIMEOUT_MS);
  };

  const waitForExtensionThenScrape = (auditRequest) => {
    pendingAuditRequestRef.current = auditRequest;
    persistPendingAuditRequest(auditRequest);
    addAuditStep("Waiting for extension", "The audit request is saved while we connect to the extension.");
    setLoading(true);
    setShowExtensionPopup(false);
    postExtensionPing();

    window.setTimeout(() => {
      if (pendingAuditRequestRef.current) {
        pendingAuditRequestRef.current = null;
        setExtensionIdentity((current) => ({
          status: "missing",
          message:
            current.status === "verified"
              ? "The QCS extension is installed, but it is not enabled on this page yet. Please refresh this page or enable site access for qcsstudio.com."
              : "We could not connect to the QCS LinkedIn Audit extension in this tab. Please install it or enable site access for qcsstudio.com.",
        }));
        setLoading(false);
        setShowExtensionPopup(true);
      }
    }, SCRAPE_RESPONSE_TIMEOUT_MS);
  };

  // ================= START AUDIT =================
  const startAudit = async () => {
    if (!url) return alert("Enter LinkedIn profile URL");
    if (!accepted) return alert("Please accept Terms & Privacy Policy");

    const finalUrl = normalizeLinkedInUrl(url);

    if (!finalUrl.includes("linkedin.com/")) {
      return alert("Please enter a valid LinkedIn profile URL");
    }

    localStorage.setItem("linkedin_audit_url", finalUrl);
    localStorage.setItem("linkedin_audit_role", role);

    const auditRequest = { finalUrl, selectedRole: role, termsAccepted: accepted };
    pendingAuditRequestRef.current = auditRequest;
    persistPendingAuditRequest(auditRequest);

    if (!extensionIdentityVerifiedRef.current) {
      const verified = await checkOfficialExtension({ showInstallPrompt: true });
      if (!verified) {
        setLoading(false);
        return;
      }
    }

    if (!extensionDetectedRef.current) {
      waitForExtensionThenScrape(auditRequest);
      return;
    }

    beginScrape(auditRequest);
  };

  const auditSummary = useMemo(() => {
    const report = result ? scoreLinkedInProfilePayload(result, role) : null;
    const overallScore = report?.overallScore || 0;

    return {
      report,
      overallScore,
      tone: getScoreTone(overallScore),
      suggestions: report?.suggestions?.slice(0, 3) || [],
    };
  }, [result, role]);

  const handleRewritePayment = useCallback(() => {
    localStorage.setItem("linkedin_audit_score", String(auditSummary.overallScore));
    localStorage.setItem("linkedin_audit_report", JSON.stringify(auditSummary.report));
    localStorage.setItem("linkedin_audit_profile", JSON.stringify(result));
    localStorage.setItem("linkedin_paid_service", "profile-rewrite-100-score");
    localStorage.setItem("linkedin_paid_amount", "49");
    window.location.href = "/payment";
  }, [auditSummary]);

  // ================= UI =================
  return (
    <div className="audit-hero" id="linkedinaudit">
      <div className="audit-inner">

        {/* TRUST with image and star */}
        <div className="audit-trust">
          <Image
            src="/assets/img/Images/auditimage.png"
            alt="users"
            width={124}
            height={40}
          />
          <div>
            <span className="text-warning">★★★★★</span>
            <p>Trusted by 200+ Professionals</p>
          </div>
        </div>

        {/* HEADING */}
        <h2 className="audit-heading">
          Audit Your LinkedIn <span>{`{Profile}`}</span> Score <br />
          <strong>Before We Rewrite It to 100%</strong>
        </h2>

        <p className="audit-desc">
          Enter your LinkedIn profile URL in this Chrome tab, stay logged in to LinkedIn,
          choose your profile type, and get a role-based audit score.
        </p>

        {/* INPUTS */}
        <div className="audit-input-row">
          <input
            placeholder="LINKEDIN PROFILE URL"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            // className="border"
            required
          />

          <select value={role} onChange={(e) => setRole(e.target.value)}>
            <option value="Job Seeker">Job Seeker</option>
            <option value="Founder / CEO">Founder / CEO</option>
            <option value="Sales / SDR / AE">Sales / SDR / AE</option>
            <option value="Consultant / Coach">Consultant / Coach</option>
            <option value="Recruiter / Talent">Recruiter / Talent</option>
          </select>
        </div>

        {/* BUTTON */}
        <button
          className="audit-main-btn"
          onClick={startAudit}
          disabled={loading}
        >
          {loading ? <PulseLoader size={10} color="#fff" /> : checkingExtension ? "Checking Extension..." : "Audit My Profile →"}
        </button>

        <p className="audit-note" style={{ marginTop: 12 }}>
          {extensionIdentity.status === "missing"
            ? extensionIdentity.message
            : isExtensionReady
              ? "QCS extension is connected in this tab. You can run the audit now."
              : checkingExtension
                ? "Checking the QCS extension and waiting for it to load in this tab."
                : "Click Audit My Profile and we will connect to the QCS extension before scraping."}
        </p>

        {auditSteps.length > 0 && (
          <div className="audit-status-list" style={{ marginTop: 14, textAlign: "left" }}>
            {auditSteps.map((step) => (
              <div key={step.id} style={{ fontSize: 13, lineHeight: 1.5, color: "#d1d5db" }}>
                ✅ <strong>{step.label}</strong>{step.detail ? ` — ${step.detail}` : ""}
              </div>
            ))}
          </div>
        )}

        {/* TERMS */}
        <label className="terms">
          <input
            type="checkbox"
            checked={accepted}
            onChange={(e) => setAccepted(e.target.checked)}
          />
          <span>
            I accept the{" "}
            <Link href="/terms-condition" target="_blank">Terms</Link> &{" "}
            <Link href="/privacy-policy" target="_blank">Privacy Policy</Link>
          </span>
        </label>

        <p className="audit-note">
          Keep LinkedIn logged in on this same Chrome browser tab. The extension reads visible profile data and sends it to our role-based scoring model.
        </p>

        <p className="audit-secure">
          No passwords · No contacts · No messages · Rule-based, explainable scoring · ₹49 paid rewrite available after score
        </p>

        {/* ================= EXTENSION POPUP ================= */}
        {showExtensionPopup && (
          <div className="audit-overlay">
            <div className="audit-popup">
              <h2 className="audit-title">
                Install Our <span>Chrome Extension</span>
              </h2>

              <p style={{ textAlign: "center", marginBottom: 20 }}>
                We could not connect to the QCS LinkedIn Audit extension in this tab. Please install the extension, or if it is already installed, enable it for qcsstudio.com and refresh this page. Your audit request is saved and will continue after the extension connects.
              </p>
              <p style={{ textAlign: "center", marginBottom: "40px" }}>
                Please make sure you are logged in to LinkedIn on this Chrome browser.
              </p>

              <Link
                href="https://chromewebstore.google.com/detail/fongccbjkdphnmdigpkbphnjaiodmlek?utm_source=item-share-cb"
                target="_blank"
                rel="noopener noreferrer"
                className="audit-main-btn"
                onClick={() => {
                  localStorage.setItem("audit_waiting_for_extension", "true");
                }}
              >
                Add Extension →
              </Link>


              <button
                className="audit-close"
                onClick={() => setShowExtensionPopup(false)}
              >
                ✕
              </button>
            </div>
          </div>
        )}

        {/* ================= RESULT POPUP ================= */}
        {showResultModal && result && (
          <div className="audit-overlay">
            <div className="audit-popup">
              <h2 className="audit-title">
                Your LinkedIn <span>Audit</span> Is Ready
              </h2>

              <div
                className="progress-ring"
                style={{ borderColor: auditSummary.tone.color, boxShadow: `0 0 0 10px ${auditSummary.tone.color}22` }}
              >
                <div className="progress-text" style={{ color: auditSummary.tone.color }}>
                  {auditSummary.overallScore}%
                </div>
              </div>

              <p style={{ textAlign: "center", margin: "18px 0 8px", color: auditSummary.tone.color, fontWeight: 700 }}>
                {auditSummary.tone.label} · {auditSummary.tone.status} · {auditSummary.report?.persona?.replaceAll("_", " ")}
              </p>
              <p style={{ textAlign: "center", marginBottom: 18 }}>
                This score is aligned with known LinkedIn profile best practices. It is designed to improve clarity, trust, search visibility, and post-click conversion — not to guarantee rankings, jobs, or leads.
              </p>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, marginBottom: 18 }}>
                <div className="rounded-3 p-2" style={{ background: "#f7f8fb" }}>
                  <strong>{auditSummary.report?.searchVisibilityScore || 0}%</strong>
                  <p className="mb-0" style={{ fontSize: 12 }}>Search Visibility</p>
                </div>
                <div className="rounded-3 p-2" style={{ background: "#f7f8fb" }}>
                  <strong>{auditSummary.report?.postClickConversionScore || 0}%</strong>
                  <p className="mb-0" style={{ fontSize: 12 }}>Post-Click Conversion</p>
                </div>
                <div className="rounded-3 p-2" style={{ background: "#f7f8fb" }}>
                  <strong>{auditSummary.report?.trustScore || 0}%</strong>
                  <p className="mb-0" style={{ fontSize: 12 }}>Trust & Proof</p>
                </div>
              </div>

              {auditSummary.report?.subScores && (
                <div style={{ textAlign: "left", marginBottom: 20 }}>
                  <strong>Section scores</strong>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 8, marginTop: 8 }}>
                    {Object.entries(auditSummary.report.subScores).slice(0, 6).map(([key, item]) => (
                      <div key={key} className="rounded-3 p-2" style={{ background: "#fff", border: "1px solid #eee" }}>
                        <span style={{ fontSize: 12 }}>{item.label}</span>
                        <strong style={{ float: "right" }}>{item.score}%</strong>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {auditSummary.suggestions.length > 0 && (
                <div style={{ textAlign: "left", marginBottom: 20 }}>
                  <strong>Top priority fixes</strong>
                  <ul style={{ paddingLeft: 18, marginTop: 8 }}>
                    {auditSummary.suggestions.map((item) => (
                      <li key={item.id} style={{ marginBottom: 6 }}>
                        <span style={{ fontWeight: 700 }}>{item.priority}:</span> {item.reason}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {auditSummary.report?.makeover?.headlineOptions?.[0] && (
                <p style={{ textAlign: "left", fontSize: 13, background: "#f7f8fb", padding: 12, borderRadius: 12 }}>
                  <strong>Makeover preview:</strong> {auditSummary.report.makeover.headlineOptions[0]}
                </p>
              )}

              <button type="button" onClick={handleRewritePayment} className="audit-main-btn">
                Rewrite My Profile With Makeover Plan — Pay ₹49 →
              </button>

              <button
                className="audit-close"
                onClick={() => setShowResultModal(false)}
              >
                ✕
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
