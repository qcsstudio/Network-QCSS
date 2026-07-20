"use client";

import { useState } from "react";
import { ExternalLink, Link2, RefreshCw, Rss, Send, ShieldAlert, Unlink } from "lucide-react";
import type { DistributionSnapshot } from "@/lib/distribution";

export function DistributionControlPanel({ initialSnapshot }: { initialSnapshot: DistributionSnapshot | null }) {
  const [snapshot, setSnapshot] = useState(initialSnapshot);
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState(initialSnapshot ? "Publication operations are current." : "Publication operations are unavailable.");

  async function load() {
    const response = await fetch("/api/admin/distribution", { cache: "no-store" });
    const result = (await response.json()) as DistributionSnapshot & { error?: string };
    if (!response.ok) throw new Error(result.error || "Unable to load publication operations.");
    setSnapshot(result);
    setMessage("Publication operations are current.");
  }

  async function run(path: string, action: string) {
    setBusy(action);
    setMessage(`${action} is running...`);
    try {
      const response = await fetch(path, { cache: "no-store" });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(result.error || `${action} failed.`);
      await load();
      setMessage(`${action} completed.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : `${action} failed.`);
    } finally {
      setBusy("");
    }
  }

  async function disconnect() {
    setBusy("Disconnecting LinkedIn");
    try {
      const response = await fetch("/api/admin/integrations/linkedin", { method: "DELETE" });
      if (!response.ok) throw new Error("Unable to disconnect LinkedIn.");
      await load();
      setMessage("LinkedIn has been disconnected.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to disconnect LinkedIn.");
    } finally {
      setBusy("");
    }
  }

  return (
    <section className="admin-panel distribution-panel" id="integrations">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Intelligence distribution</p>
          <h2>Source health, approvals, and LinkedIn delivery.</h2>
          <p>Website publication remains independent. Social failures stay queued and visible here.</p>
        </div>
        <button className="button secondary" disabled={Boolean(busy)} onClick={() => load().catch((error) => setMessage(String(error)))} type="button">
          <RefreshCw aria-hidden="true" size={17} /> Refresh
        </button>
      </div>
      <p aria-live="polite" className="form-note">{message}</p>

      <div className="distribution-grid">
        <article className="distribution-module">
          <div className="distribution-module-heading"><Link2 aria-hidden="true" /><div><p className="eyebrow">LinkedIn profile</p><h3>{snapshot?.linkedin.accountName || "Not connected"}</h3></div></div>
          <span className={`status-pill ${snapshot?.linkedin.connected ? "ready" : "missing"}`}>{snapshot?.linkedin.status || "loading"}</span>
          <p>{snapshot?.linkedin.expiresAt ? `Authorization expires ${new Date(snapshot.linkedin.expiresAt).toLocaleString("en-IN")}.` : "Connect the approved LinkedIn application to begin publishing."}</p>
          <div className="content-action-row">
            {snapshot?.linkedin.connected ? (
              <button className="button secondary compact-button" disabled={Boolean(busy)} onClick={disconnect} type="button"><Unlink aria-hidden="true" size={16} /> Disconnect</button>
            ) : (
              <a className="button primary compact-button" href="/api/admin/integrations/linkedin/connect"><Link2 aria-hidden="true" size={16} /> Connect LinkedIn</a>
            )}
            <button className="button secondary compact-button" disabled={Boolean(busy)} onClick={() => run("/api/cron/social-publisher", "LinkedIn queue")} type="button"><Send aria-hidden="true" size={16} /> Process queue</button>
            {snapshot?.social.counts.failed ? (
              <button className="button secondary compact-button" disabled={Boolean(busy)} onClick={() => run("/api/cron/social-publisher?retryFailed=1", "Failed LinkedIn posts")} type="button"><RefreshCw aria-hidden="true" size={16} /> Retry failures</button>
            ) : null}
          </div>
          <div className="distribution-metrics">
            <span><strong>{snapshot?.social.counts.published || 0}</strong> Published</span>
            <span><strong>{(snapshot?.social.counts.queued || 0) + (snapshot?.social.counts.retry || 0)}</strong> Waiting</span>
            <span><strong>{snapshot?.social.counts.failed || 0}</strong> Failed</span>
          </div>
        </article>

        <article className="distribution-module">
          <div className="distribution-module-heading"><ShieldAlert aria-hidden="true" /><div><p className="eyebrow">Security Advisory Desk</p><h3>{snapshot?.advisories.total || 0} public advisories</h3></div></div>
          <p>Official sources publish automatically and queue a matching LinkedIn post without editorial approval.</p>
          <div className="content-action-row">
            <button className="button primary compact-button" disabled={Boolean(busy)} onClick={() => run("/api/cron/advisory-discovery", "Advisory scan")} type="button"><RefreshCw aria-hidden="true" size={16} /> Scan now</button>
            <a className="icon-button" href="/security-advisories" rel="noreferrer" target="_blank" title="Open Security Advisory Desk"><ExternalLink aria-hidden="true" size={18} /></a>
            <a className="icon-button" href="/security-advisories/feed.xml" rel="noreferrer" target="_blank" title="Open advisory feed"><Rss aria-hidden="true" size={18} /></a>
          </div>
          <div className="source-status-list">
            {(snapshot?.advisories.sources || []).map((source) => (
              <div key={source.slug}><span className={`source-dot ${source.consecutiveFailures ? "has-error" : ""}`} /><strong>{source.name}</strong><small>{source.lastSuccessAt ? new Date(source.lastSuccessAt).toLocaleString("en-IN") : "Awaiting first scan"}</small></div>
            ))}
          </div>
        </article>

        <article className="distribution-module">
          <div className="distribution-module-heading"><Send aria-hidden="true" /><div><p className="eyebrow">WhatsApp editorial review</p><h3>{snapshot?.approvals.configured ? "Configured" : "Configuration required"}</h3></div></div>
          <p>Applies only to Monday and Thursday blog/resource revisions. Advisory publication bypasses this queue.</p>
          <div className="distribution-metrics">
            <span><strong>{snapshot?.approvals.counts.pending || 0}</strong> Pending</span>
            <span><strong>{snapshot?.approvals.counts.approved || 0}</strong> Approved</span>
            <span><strong>{snapshot?.approvals.counts.feedback_received || 0}</strong> Feedback</span>
          </div>
          <div className="source-status-list">
            {(snapshot?.approvals.latest || []).slice(0, 4).map((approval) => (
              <div key={approval.id}><span className="source-dot" /><strong>{approval.title}</strong><small>Revision {approval.revisionVersion} | {approval.status}</small></div>
            ))}
          </div>
        </article>
      </div>

      {snapshot?.social.latest.some((job) => job.status === "failed") ? (
        <div className="distribution-failures">
          <h3>Delivery failures</h3>
          {snapshot.social.latest.filter((job) => job.status === "failed").map((job) => <p key={job.id}>{job.contentType}: {job.lastError}</p>)}
        </div>
      ) : null}
    </section>
  );
}
