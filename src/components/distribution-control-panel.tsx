"use client";

import { useState } from "react";
import { ExternalLink, ImageIcon, Link2, PencilLine, RefreshCw, Rss, Send, ShieldAlert, Unlink, Facebook, Instagram, Ban } from "lucide-react";
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
    const retry = snapshot?.editorialImages.latest.find((item) => item.status === "failed");
    if (force && (!retry || !window.confirm("Retry this failed image within the existing paid-image budget? A provider call can incur a charge."))) return;
    const action = force ? "Retrying contextual image" : "Generating contextual image";
    setBusy(action);
    setMessage(`${action}...`);
    try {
      const response = await fetch("/api/admin/editorial-images", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ force, limit: 1, ...(force && retry ? { contentId: retry.contentId } : {}) })
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

  async function runMeta(action: "verify" | "prepare" | "publish" | "retry" | "cancel", publicationId?: string) {
    setBusy(`Meta ${action}`);
    setMessage(`Meta ${action} is running...`);
    try {
      const response = await fetch("/api/admin/integrations/meta", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, publicationId }) });
      const data = await response.json() as { error?: string; result?: Array<{ status?: string; error?: string }> | { pageName?: string; instagramUsername?: string } };
      if (!response.ok) throw new Error(data.error || "Meta action failed.");
      await load();
      if (Array.isArray(data.result)) setMessage(data.result.length ? data.result.map((item) => `${item.status}${item.error ? `: ${item.error}` : ""}`).join(" ") : "No eligible posts in the queue.");
      else if (action === "verify" && data.result && "pageName" in data.result) setMessage(`Verified Facebook Page: ${data.result.pageName}. Linked Instagram: @${data.result.instagramUsername}.`);
      else setMessage(`Meta ${action} saved.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Meta action failed.");
    } finally { setBusy(""); }
  }

  return (
    <section className="admin-panel distribution-panel" id="integrations">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Intelligence distribution</p>
          <h2>Editorial quality and social distribution</h2>
          <p>Website publication remains independent. Social failures stay queued and visible here.</p>
        </div>
        <button className="icon-button" aria-label="Refresh distribution" title="Refresh distribution" disabled={Boolean(busy)} onClick={() => load().catch((error) => setMessage(String(error)))} type="button">
          <RefreshCw aria-hidden="true" size={17} />
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
          <p>Source-verified advisories publish after technical checks. Connected social channels use the same reviewed revision.</p>
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
          <div className="distribution-module-heading"><ImageIcon aria-hidden="true" /><div><p className="eyebrow">QCS visual studio</p><h3>Contextual artwork with controlled spend</h3></div></div>
          <span className={`status-pill ${snapshot?.editorialImages.agent.configured ? "ready" : "missing"}`}>
            {snapshot?.editorialImages.agent.premiumConfigured ? "Contextual generation configured" : "Image provider required"}
          </span>
          <p>Each article and advisory receives an evidence-mapped concept and an independent visual review. Budget or review failures hold the social image; no generic template is substituted.</p>
          <div className="content-action-row">
            <button className="button primary compact-button" disabled={Boolean(busy) || !snapshot?.editorialImages.agent.configured} onClick={() => generateEditorialImage(false)} type="button"><ImageIcon aria-hidden="true" size={16} /> Generate next</button>
            {snapshot?.editorialImages.counts.failed ? <button className="button secondary compact-button" disabled={Boolean(busy)} onClick={() => generateEditorialImage(true)} type="button"><RefreshCw aria-hidden="true" size={16} /> Retry latest</button> : null}
          </div>
          <div className="distribution-metrics">
            <span><strong>{snapshot?.editorialImages.counts.ready || 0}</strong> Ready</span>
            <span><strong>{snapshot?.editorialImages.counts.pending || 0}</strong> Queued</span>
            <span><strong>{snapshot?.editorialImages.counts.budget_wait || 0}</strong> Budget wait</span>
            <span><strong>{snapshot?.editorialImages.counts.generating || 0}</strong> Generating</span>
            <span><strong>{snapshot?.editorialImages.counts.failed || 0}</strong> Failed</span>
          </div>
          <p className="form-note">Writer: {snapshot?.editorialContent.writerModel} | Content critic: {snapshot?.editorialContent.criticModel} | Image: {snapshot?.editorialImages.agent.imageModel}</p>
          {snapshot?.editorialImages.latest[0]?.lastError ? <p className="form-note">{snapshot.editorialImages.latest[0].lastError}</p> : null}
        </article>

        <article className="distribution-module">
          <div className="distribution-module-heading"><Facebook aria-hidden="true" /><div><p className="eyebrow">Facebook + Instagram</p><h3>QCS / @{snapshot?.meta.configuration.instagramUsername || "qcsstudio"}</h3></div><Instagram aria-hidden="true" /></div>
          <span className={`status-pill ${snapshot?.meta.configuration.configured ? "ready" : "missing"}`}>{!snapshot?.meta.configuration.configured ? "Connection required" : snapshot.meta.configuration.enabled ? "Automatic delivery enabled" : "Preview only"}</span>
          <p>Page ID: {snapshot?.meta.configuration.pageId || "Not configured"} | Instagram ID: {snapshot?.meta.configuration.instagramId || "Not configured"}</p>
          {snapshot?.meta.configuration.startAt ? <p className="form-note">Eligible website publications from {new Date(snapshot.meta.configuration.startAt).toLocaleString("en-IN")}.</p> : null}
          <ul>{snapshot?.meta.configuration.issues.map((issue) => <li key={issue}>{issue}</li>)}</ul>
          <div className="content-action-row">
            <button className="button secondary compact-button" disabled={Boolean(busy) || !snapshot?.meta.configuration.configured} onClick={() => runMeta("verify")} type="button"><Link2 size={16} aria-hidden="true" /> Verify accounts</button>
            <button className="button secondary compact-button" disabled={Boolean(busy) || !snapshot?.meta.configuration.configured} onClick={() => runMeta("prepare")} type="button"><PencilLine size={16} aria-hidden="true" /> Prepare next</button>
            <button className="button primary compact-button" disabled={Boolean(busy) || !snapshot?.meta.configuration.configured || !snapshot.meta.configuration.enabled} onClick={() => runMeta("publish")} type="button"><Send size={16} aria-hidden="true" /> Process Meta queue</button>
          </div>
        </article>
      </div>

      {snapshot?.meta.latest.length ? <div className="linkedin-publication-list">
        <h3>Facebook and Instagram delivery</h3>
        {snapshot.meta.latest.map((job) => <article className="distribution-module" key={job.id}>
          <div className="distribution-module-heading distribution-delivery-heading"><strong>{job.channel}</strong><span className={`status-pill ${job.status === "published" ? "ready" : ["blocked", "needs_review"].includes(job.status) ? "missing" : ""}`}>{job.status.replaceAll("_", " ")}</span></div>
          <a href={job.sourceUrl} target="_blank" rel="noreferrer">Original QCS article</a>
          {job.lastError ? <p role="status">{job.lastError}</p> : null}
          {job.caption ? <details><summary>Caption preview</summary><p style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{job.caption}</p></details> : null}
          <div className="content-action-row">
            {job.imageUrl ? <a className="button secondary compact-button" href={job.imageUrl} target="_blank" rel="noreferrer"><ImageIcon size={16} aria-hidden="true" /> Preview image</a> : null}
            {job.permalink ? <a className="button secondary compact-button" href={job.permalink} target="_blank" rel="noreferrer"><ExternalLink size={16} aria-hidden="true" /> View published post</a> : null}
            {job.status === "ready" ? <button className="button primary compact-button" disabled={Boolean(busy) || !snapshot.meta.configuration.enabled} onClick={() => runMeta("publish", job.id)} type="button"><Send size={16} aria-hidden="true" /> Publish</button> : null}
            {job.status === "blocked" ? <button className="button secondary compact-button" disabled={Boolean(busy)} onClick={() => runMeta("retry", job.id)} type="button"><RefreshCw size={16} aria-hidden="true" /> Retry preparation</button> : null}
            {["queued", "retry", "ready", "blocked"].includes(job.status) ? <button className="button secondary compact-button" disabled={Boolean(busy)} onClick={() => runMeta("cancel", job.id)} type="button"><Ban size={16} aria-hidden="true" /> Cancel delivery</button> : null}
          </div>
        </article>)}
      </div> : null}

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
                <small>
                  {job.publishedAt ? new Date(job.publishedAt).toLocaleString("en-IN") : new Date(job.updatedAt).toLocaleString("en-IN")}
                  {job.commentaryQualityScore ? ` | LinkedIn QA ${job.commentaryQualityScore}/100` : " | Awaiting LinkedIn QA"}
                </small>
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
