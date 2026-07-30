"use client";

import { useState } from "react";
import { ExternalLink, ImageIcon, Link2, PencilLine, RefreshCw, Rss, Send, ShieldAlert, Unlink } from "lucide-react";
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

  async function refreshPublication(id: string, replaceMedia: boolean) {
    if (replaceMedia && !window.confirm("Replace this LinkedIn post with refreshed copy and its current QCS article image? The old post and its engagement will be removed after the replacement publishes.")) return;
    const action = replaceMedia ? "Replacing LinkedIn media" : "Refreshing LinkedIn copy";
    setBusy(action);
    setMessage(`${action}...`);
    try {
      const response = await fetch(`/api/admin/integrations/linkedin/publications/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: replaceMedia ? "replace_media" : "refresh_commentary" })
      });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(result.error || `${action} failed.`);
      await load();
      setMessage(replaceMedia ? "LinkedIn copy and image were replaced." : "LinkedIn copy was refreshed in place.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : `${action} failed.`);
    } finally {
      setBusy("");
    }
  }

  async function generateEditorialImage(force = false) {
    const action = force ? "Retrying contextual image" : "Generating contextual image";
    setBusy(action);
    setMessage(`${action}...`);
    try {
      const response = await fetch("/api/admin/editorial-images", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ force, limit: 1 })
      });
      const result = (await response.json()) as { error?: string; outcomes?: Array<{ status: string }> };
      if (!response.ok) throw new Error(result.error || `${action} failed.`);
      await load();
      const status = result.outcomes?.[0]?.status || "no pending item";
      setMessage(`Contextual image result: ${status}.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : `${action} failed.`);
    } finally {
      setBusy("");
    }
  }

  return (
    <section className="admin-panel distribution-panel" id="integrations">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Intelligence distribution</p>
          <h2>Source health, editorial automation, and LinkedIn delivery.</h2>
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
          <div className="distribution-module-heading"><Rss aria-hidden="true" /><div><p className="eyebrow">Weekly Content Radar</p><h3>Monday + Thursday</h3></div></div>
          <p>Search-demand signals, niche news discovery, and authoritative technical feeds are ranked together. Only authoritative evidence can become an article.</p>
          <div className="content-action-row">
            <button className="button primary compact-button" disabled={Boolean(busy)} onClick={() => run("/api/admin/content-radar", "Content radar")} type="button"><RefreshCw aria-hidden="true" size={16} /> Scan now</button>
            <a className="icon-button" href="/resources" rel="noreferrer" target="_blank" title="Open published resources"><ExternalLink aria-hidden="true" size={18} /></a>
          </div>
          <p className="form-note">The protected Vercel cron creates at most one researched draft per scheduled run. You review, edit, approve, and publish it from Content Studio.</p>
        </article>

        <article className="distribution-module">
          <div className="distribution-module-heading"><ImageIcon aria-hidden="true" /><div><p className="eyebrow">QCS OpenAI agent studio</p><h3>Researched, written, rendered, and inspected</h3></div></div>
          <span className={`status-pill ${snapshot?.editorialImages.agent.configured ? "ready" : "missing"}`}>
            {snapshot?.editorialImages.agent.configured
              ? "Direct API ready"
              : snapshot?.editorialImages.agent.credentialIssue === "malformed"
                ? "OpenAI key malformed"
                : "OpenAI key required"}
          </span>
          <p>Research and critic agents ground the article in approved sources. A visual director, image agent, and visual critic create a contextual asset before website or LinkedIn delivery.</p>
          <div className="content-action-row">
            <button className="button primary compact-button" disabled={Boolean(busy) || !snapshot?.editorialImages.agent.configured} onClick={() => generateEditorialImage(false)} type="button"><ImageIcon aria-hidden="true" size={16} /> Generate next</button>
            {snapshot?.editorialImages.counts.failed ? <button className="button secondary compact-button" disabled={Boolean(busy)} onClick={() => generateEditorialImage(true)} type="button"><RefreshCw aria-hidden="true" size={16} /> Retry latest</button> : null}
          </div>
          <div className="distribution-metrics">
            <span><strong>{snapshot?.editorialImages.counts.ready || 0}</strong> Ready</span>
            <span><strong>{snapshot?.editorialImages.counts.generating || 0}</strong> Generating</span>
            <span><strong>{snapshot?.editorialImages.counts.failed || 0}</strong> Failed</span>
          </div>
          <p className="form-note">Writer: {snapshot?.editorialContent.writerModel} | Content critic: {snapshot?.editorialContent.criticModel} | Image: {snapshot?.editorialImages.agent.imageModel}</p>
          {snapshot?.editorialImages.latest[0]?.lastError ? <p className="form-note">{snapshot.editorialImages.latest[0].lastError}</p> : null}
        </article>
      </div>

      {snapshot?.social.latest.some((job) => job.status === "failed") ? (
        <div className="distribution-failures">
          <h3>Delivery failures</h3>
          {snapshot.social.latest.filter((job) => job.status === "failed").map((job) => <p key={job.id}>{job.contentType}: {job.lastError}</p>)}
        </div>
      ) : null}

      {snapshot?.social.latest.length ? (
        <div className="linkedin-publication-list">
          <div className="linkedin-publication-heading">
            <div><p className="eyebrow">Recent distribution</p><h3>LinkedIn publications</h3></div>
            <span>{snapshot.social.latest.length} recent records</span>
          </div>
          {snapshot.social.latest.map((job) => (
            <article className="linkedin-publication-row" key={job.id}>
              <div className="linkedin-publication-copy">
                <span className={`status-pill ${job.status === "published" ? "ready" : job.status === "failed" ? "missing" : ""}`}>{job.status}</span>
                <strong>{job.title}</strong>
                <small>{job.publishedAt ? new Date(job.publishedAt).toLocaleString("en-IN") : new Date(job.updatedAt).toLocaleString("en-IN")}</small>
              </div>
              <div className="content-action-row">
                {job.status === "published" ? (
                  <>
                    <button className="button secondary compact-button" disabled={Boolean(busy)} onClick={() => refreshPublication(job.id, false)} type="button"><PencilLine aria-hidden="true" size={15} /> Refresh copy</button>
                    <button className="button secondary compact-button" disabled={Boolean(busy)} onClick={() => refreshPublication(job.id, true)} type="button"><ImageIcon aria-hidden="true" size={15} /> Replace image + copy</button>
                  </>
                ) : null}
                {job.permalink ? <a className="icon-button" href={job.permalink} rel="noreferrer" target="_blank" title="Open LinkedIn post"><ExternalLink aria-hidden="true" size={17} /></a> : null}
              </div>
            </article>
          ))}
        </div>
      ) : null}
    </section>
  );
}
