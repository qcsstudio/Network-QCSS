"use client";

import { useEffect, useState } from "react";
import { Check, Copy, LoaderCircle, RefreshCw, ShieldCheck, X } from "lucide-react";
import type { VerifyGridOnboardingRecord } from "@/lib/verifygrid-onboarding";

function label(value: string) {
  return value.replace(/_/g, " ");
}

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Not recorded" : new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata", hour12: false }).format(date);
}

export function VerifyGridOnboardingQueue() {
  const [requests, setRequests] = useState<VerifyGridOnboardingRecord[]>([]);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("Loading client onboarding requests...");
  const [accessUrl, setAccessUrl] = useState("");

  async function load() {
    setBusy("load");
    try {
      const response = await fetch("/api/admin/verifygrid/onboarding", { cache: "no-store" });
      const result = await response.json() as { requests?: VerifyGridOnboardingRecord[]; error?: string };
      if (!response.ok || !result.requests) throw new Error(result.error || "Unable to load onboarding requests.");
      setRequests(result.requests);
      setMessage(result.requests.length ? `${result.requests.filter((item) => ["pending_email", "email_verified", "provisioning"].includes(item.status)).length} request(s) require attention.` : "No client onboarding requests yet.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to load onboarding requests.");
    } finally {
      setBusy("");
    }
  }

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/admin/verifygrid/onboarding", { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        const result = await response.json() as { requests?: VerifyGridOnboardingRecord[]; error?: string };
        if (!response.ok || !result.requests) throw new Error(result.error || "Unable to load onboarding requests.");
        setRequests(result.requests);
        setMessage(result.requests.length ? `${result.requests.filter((item) => ["pending_email", "email_verified", "provisioning"].includes(item.status)).length} request(s) require attention.` : "No client onboarding requests yet.");
      })
      .catch((error) => {
        if ((error as Error).name !== "AbortError") setMessage(error instanceof Error ? error.message : "Unable to load onboarding requests.");
      });
    return () => controller.abort();
  }, []);

  async function review(id: string, action: "approve" | "reject") {
    setBusy(`${action}-${id}`);
    setAccessUrl("");
    try {
      const response = await fetch(`/api/admin/verifygrid/onboarding/${id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action, reviewNote: notes[id] || "" })
      });
      const result = await response.json() as { request?: VerifyGridOnboardingRecord; accessUrl?: string; emailDelivery?: string; error?: string };
      if (!response.ok || !result.request) throw new Error(result.error || "Unable to review this request.");
      setAccessUrl(result.accessUrl || "");
      setNotes((current) => ({ ...current, [id]: "" }));
      await load();
      setMessage(action === "approve" ? `Workspace created. Access email: ${label(result.emailDelivery || "not sent")}.` : "Onboarding request rejected.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to review this request.");
    } finally {
      setBusy("");
    }
  }

  const activeRequests = requests.filter((item) => ["pending_email", "email_verified", "provisioning"].includes(item.status));
  const recentDecisions = requests.filter((item) => ["approved", "rejected"].includes(item.status)).slice(0, 6);

  return (
    <section className="admin-panel verifygrid-onboarding-queue" id="verifygrid-onboarding">
      <div className="panel-heading verifygrid-heading">
        <div><p className="eyebrow">Client intake</p><h2>VerifyGrid onboarding approvals</h2><p>Email verification establishes contact ownership only. QCS approval creates a draft, execution-blocked workspace.</p></div>
        <button className="icon-button" disabled={Boolean(busy)} onClick={load} title="Refresh onboarding queue" type="button">{busy === "load" ? <LoaderCircle aria-hidden="true" className="spin" size={18} /> : <RefreshCw aria-hidden="true" size={18} />}</button>
      </div>
      <p aria-live="polite" className="form-note verifygrid-message">{message}</p>
      {accessUrl ? <div className="verifygrid-one-time" role="status"><div><strong>One-time client access link</strong><span>Delivered by email when configured; retain this as the immediate fallback.</span></div><code>{accessUrl}</code><button className="button primary compact-button" onClick={() => navigator.clipboard.writeText(accessUrl)} type="button"><Copy aria-hidden="true" size={15} /> Copy</button></div> : null}
      <div className="verifygrid-onboarding-list">
        {activeRequests.length ? activeRequests.map((request) => (
          <article className="verifygrid-onboarding-record" key={request.id}>
            <header><div><strong>{request.organizationName}</strong><span>{request.displayName} | {request.email} | {request.phone}</span></div><span className={`status-pill onboarding-${request.status}`}>{label(request.status)}</span></header>
            <div className="verifygrid-onboarding-meta"><span>{request.serviceLabel}</span><span>{request.countryCode || request.sourceCountry || "Country not supplied"}</span><span>{request.requestedStartAt ? `Preferred ${formatDate(request.requestedStartAt)}` : "Start date open"}</span><span>{request.reference}</span></div>
            <p>{request.scopeSummary}</p>
            <label className="content-field"><span>Review note</span><textarea onChange={(event) => setNotes((current) => ({ ...current, [request.id]: event.target.value }))} placeholder={request.status === "email_verified" ? "Optional approval note or required rejection reason." : "Add a rejection reason if this request is not eligible."} rows={2} value={notes[request.id] || ""} /></label>
            <div className="content-action-row">
              <button className="button primary compact-button" disabled={Boolean(busy) || request.status !== "email_verified"} onClick={() => review(request.id, "approve")} type="button"><ShieldCheck aria-hidden="true" size={16} /> {busy === `approve-${request.id}` ? "Provisioning..." : "Approve and provision"}</button>
              <button className="button secondary compact-button" disabled={Boolean(busy) || (notes[request.id] || "").trim().length < 10 || request.status === "provisioning"} onClick={() => review(request.id, "reject")} type="button"><X aria-hidden="true" size={16} /> Reject</button>
            </div>
          </article>
        )) : <div className="verifygrid-empty compact"><Check aria-hidden="true" size={24} /><h3>Queue clear</h3><p>Verified client requests will appear here.</p></div>}
      </div>
      {recentDecisions.length ? <div className="verifygrid-onboarding-decisions"><strong>Recent decisions</strong>{recentDecisions.map((request) => <div key={request.id}><span>{request.organizationName}</span><span>{request.serviceLabel}</span><span className={`status-pill onboarding-${request.status}`}>{label(request.status)}</span><small>{request.reviewedAt ? formatDate(request.reviewedAt) : formatDate(request.updatedAt)}</small></div>)}</div> : null}
    </section>
  );
}
