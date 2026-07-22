"use client";

import { useState } from "react";
import { Eye, FilePlus2, RefreshCw, RotateCcw, Save, ShieldAlert, Trash2, Upload, XCircle } from "lucide-react";
import type { AdminAdvisoryRecord } from "@/lib/advisories";

function lines(value: string) {
  return value.split("\n").map((item) => item.trim()).filter(Boolean);
}

function dateInput(value: string) {
  return value ? new Date(value).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10);
}

function blankAdvisory(): AdminAdvisoryRecord {
  const now = new Date().toISOString();
  return {
    id: "",
    sourceName: "QCS Editorial Advisory Desk",
    sourceSlug: "qcs-editorial",
    externalId: "",
    slug: `new-security-advisory-${Date.now().toString(36)}`,
    title: "New Network Security Advisory",
    vendor: "Vendor name",
    summary: "Draft required: summarize the vulnerability, affected network context, operational risk, and the verified action readers should take.",
    severity: "unrated",
    cvssScore: null,
    priorityScore: 50,
    cves: [],
    products: ["Affected network product"],
    affectedVersions: [],
    fixedVersions: [],
    remediation: "Draft required: document the authoritative fixed release, mitigation, validation sequence, and accountable change owner.",
    workaround: "Draft required: include only a temporary control documented by the authoritative source.",
    exploitationStatus: "Draft required: confirm whether active exploitation has been reported.",
    sourceUrl: "https://www.qcsstudio.com/security-advisories",
    status: "draft",
    editorialOverride: true,
    createdBy: "",
    updatedBy: "",
    vendorPublishedAt: now,
    vendorUpdatedAt: now,
    lastVerifiedAt: now,
    updatedAt: now,
    revision: 0
  };
}

function advisoryPayload(advisory: AdminAdvisoryRecord) {
  return {
    slug: advisory.slug,
    title: advisory.title,
    vendor: advisory.vendor,
    summary: advisory.summary,
    severity: advisory.severity,
    cvssScore: advisory.cvssScore,
    priorityScore: advisory.priorityScore,
    cves: advisory.cves,
    products: advisory.products,
    affectedVersions: advisory.affectedVersions,
    fixedVersions: advisory.fixedVersions,
    remediation: advisory.remediation,
    workaround: advisory.workaround,
    exploitationStatus: advisory.exploitationStatus,
    sourceUrl: advisory.sourceUrl,
    status: advisory.status === "deleted" ? "draft" : advisory.status,
    vendorPublishedAt: advisory.vendorPublishedAt,
    vendorUpdatedAt: advisory.vendorUpdatedAt
  };
}

function ListField({ label, value, onChange }: { label: string; value: string[]; onChange: (value: string[]) => void }) {
  return <label className="content-field"><span>{label}</span><textarea rows={4} value={value.join("\n")} onChange={(event) => onChange(lines(event.target.value))} /></label>;
}

export function AdvisoryManagementPanel({ initialAdvisories }: { initialAdvisories: AdminAdvisoryRecord[] }) {
  const [advisories, setAdvisories] = useState(initialAdvisories);
  const [selected, setSelected] = useState<AdminAdvisoryRecord | null>(null);
  const [draft, setDraft] = useState<AdminAdvisoryRecord | null>(null);
  const [filter, setFilter] = useState<"all" | "source" | "manual" | "deleted">("all");
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("Advisory management is ready. Source-fed records remain automatic until an editor saves an override.");

  async function load() {
    const response = await fetch("/api/admin/security-advisories", { cache: "no-store" });
    const result = (await response.json()) as { advisories?: AdminAdvisoryRecord[]; error?: string };
    if (!response.ok || !result.advisories) throw new Error(result.error || "Unable to load advisories.");
    setAdvisories(result.advisories);
  }

  function edit(advisory: AdminAdvisoryRecord) {
    setSelected(advisory);
    setDraft(structuredClone(advisory));
    setMessage(`Editing ${advisory.title}. Saving a source-fed item creates an editorial override.`);
    window.setTimeout(() => document.querySelector("#advisory-editor")?.scrollIntoView({ behavior: "smooth", block: "start" }), 0);
  }

  function createNew() {
    const next = blankAdvisory();
    setSelected(null);
    setDraft(next);
    setMessage("Complete the manual advisory, save it as a draft, then publish after checking the authoritative source.");
    window.setTimeout(() => document.querySelector("#advisory-editor")?.scrollIntoView({ behavior: "smooth", block: "start" }), 0);
  }

  function patch<K extends keyof AdminAdvisoryRecord>(key: K, value: AdminAdvisoryRecord[K]) {
    setDraft((current) => current ? { ...current, [key]: value } : current);
  }

  async function save() {
    if (!draft) return;
    setBusy("save");
    try {
      const response = await fetch(selected ? `/api/admin/security-advisories/${selected.id}` : "/api/admin/security-advisories", {
        method: selected ? "PATCH" : "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(selected ? { advisory: advisoryPayload(draft) } : advisoryPayload(draft))
      });
      const result = (await response.json()) as { advisory?: AdminAdvisoryRecord; error?: string };
      if (!response.ok || !result.advisory) throw new Error(result.error || "Unable to save the advisory.");
      setSelected(result.advisory);
      setDraft(structuredClone(result.advisory));
      await load();
      setMessage(`${result.advisory.title} saved at revision ${result.advisory.revision}.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to save the advisory.");
    } finally {
      setBusy("");
    }
  }

  async function changeState(action: "publish" | "withdraw" | "restore" | "resume_sync") {
    if (!selected) return;
    setBusy(action);
    try {
      const response = await fetch(`/api/admin/security-advisories/${selected.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action })
      });
      const result = (await response.json()) as { advisory?: AdminAdvisoryRecord; error?: string };
      if (!response.ok || !result.advisory) throw new Error(result.error || `Unable to ${action.replace("_", " ")} the advisory.`);
      setSelected(result.advisory);
      setDraft(structuredClone(result.advisory));
      await load();
      setMessage(`${result.advisory.title} is now ${result.advisory.status}.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to change advisory status.");
    } finally {
      setBusy("");
    }
  }

  async function remove(advisory: AdminAdvisoryRecord) {
    if (!window.confirm("Delete this advisory from the public desk? The internal revision history will be retained and vendor synchronization will remain paused.")) return;
    setBusy("delete");
    try {
      const response = await fetch(`/api/admin/security-advisories/${advisory.id}`, { method: "DELETE" });
      const result = (await response.json()) as { advisory?: AdminAdvisoryRecord; error?: string };
      if (!response.ok || !result.advisory) throw new Error(result.error || "Unable to delete the advisory.");
      if (selected?.id === advisory.id) {
        setSelected(result.advisory);
        setDraft(structuredClone(result.advisory));
      }
      await load();
      setMessage(`${advisory.title} has been removed from the public advisory desk.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to delete the advisory.");
    } finally {
      setBusy("");
    }
  }

  const visible = advisories.filter((advisory) => {
    if (filter === "source") return advisory.sourceSlug !== "qcs-editorial" && advisory.status !== "deleted";
    if (filter === "manual") return advisory.sourceSlug === "qcs-editorial" && advisory.status !== "deleted";
    if (filter === "deleted") return advisory.status === "deleted";
    return true;
  });

  return (
    <section className="admin-panel advisory-management-panel" id="advisory-management">
      <div className="panel-heading">
        <div><p className="eyebrow">Advisory management</p><h2>Create, correct, publish, withdraw, and delete.</h2><p>Source synchronization is preserved until an administrator intentionally overrides a record.</p></div>
        <div className="content-action-row">
          <button className="button secondary" disabled={Boolean(busy)} onClick={() => load().catch((error) => setMessage(String(error)))} type="button"><RefreshCw aria-hidden="true" size={17} /> Refresh</button>
          <button className="button primary" disabled={Boolean(busy)} onClick={createNew} type="button"><FilePlus2 aria-hidden="true" size={17} /> New advisory</button>
        </div>
      </div>
      <p aria-live="polite" className="form-note">{message}</p>

      <div className="content-queue-header">
        <div><h3>Advisory library</h3><p>{advisories.length} retained record(s), including source and manual advisories.</p></div>
        <div className="content-filter-tabs" aria-label="Filter advisories">
          {(["all", "source", "manual", "deleted"] as const).map((item) => <button aria-pressed={filter === item} key={item} onClick={() => setFilter(item)} type="button">{item}</button>)}
        </div>
      </div>

      <div className="content-queue advisory-admin-queue">
        {visible.length ? visible.map((advisory) => (
          <article className="content-queue-card" key={advisory.id}>
            <div>
              <div className="content-card-statuses"><span className={`severity-pill severity-${advisory.severity}`}>{advisory.severity}</span><span className={`status-pill content-status-${advisory.status}`}>{advisory.status}</span>{advisory.editorialOverride ? <span className="status-pill content-kind-pill">editorial control</span> : null}</div>
              <h4>{advisory.title}</h4>
              <p>{advisory.vendor} | {advisory.sourceName} | Revision {advisory.revision}</p>
            </div>
            <div className="content-action-row">
              {advisory.status === "deleted" ? <button className="button secondary compact-button" onClick={() => { edit(advisory); }} type="button"><RotateCcw aria-hidden="true" size={16} /> Review</button> : <button className="button secondary compact-button" onClick={() => edit(advisory)} type="button"><Save aria-hidden="true" size={16} /> Edit</button>}
              {advisory.status === "published" || advisory.status === "withdrawn" ? <a className="icon-button" href={`/security-advisories/${advisory.slug}`} rel="noreferrer" target="_blank" title="Open advisory"><Eye aria-hidden="true" size={18} /></a> : null}
              {advisory.status !== "deleted" ? <button className="icon-button danger" disabled={Boolean(busy)} onClick={() => remove(advisory)} title="Delete advisory" type="button"><Trash2 aria-hidden="true" size={18} /></button> : null}
            </div>
          </article>
        )) : <div className="content-empty-state">No advisories match this filter.</div>}
      </div>

      {draft ? (
        <form className="content-editor" id="advisory-editor" onSubmit={(event) => { event.preventDefault(); save(); }}>
          <div className="content-editor-heading">
            <div><p className="eyebrow">Structured advisory editor</p><h3>{draft.title}</h3><p>{draft.sourceSlug === "qcs-editorial" ? "Manual QCS advisory" : `${draft.sourceName}; saving enables editorial control`}</p></div>
            <div className="content-card-statuses"><span className={`status-pill content-status-${draft.status}`}>{draft.status}</span>{draft.editorialOverride ? <span className="status-pill content-kind-pill">source sync paused</span> : <span className="status-pill content-status-published">source sync active</span>}</div>
          </div>

          <fieldset className="content-editor-section">
            <legend>Identity and priority</legend>
            <div className="content-field-grid">
              <label className="content-field content-field-wide"><span>Title</span><input value={draft.title} onChange={(event) => patch("title", event.target.value)} /></label>
              <label className="content-field"><span>Slug</span><input value={draft.slug} onChange={(event) => patch("slug", event.target.value.toLowerCase().replace(/[^a-z0-9-]+/g, "-"))} /></label>
              <label className="content-field"><span>Vendor</span><input value={draft.vendor} onChange={(event) => patch("vendor", event.target.value)} /></label>
              <label className="content-field"><span>Severity</span><select value={draft.severity} onChange={(event) => patch("severity", event.target.value)}><option value="critical">Critical</option><option value="high">High</option><option value="medium">Medium</option><option value="low">Low</option><option value="unrated">Unrated</option></select></label>
              <label className="content-field"><span>CVSS score</span><input max="10" min="0" step="0.1" type="number" value={draft.cvssScore ?? ""} onChange={(event) => patch("cvssScore", event.target.value ? Number(event.target.value) : null)} /></label>
              <label className="content-field"><span>QCS priority</span><input max="100" min="0" type="number" value={draft.priorityScore} onChange={(event) => patch("priorityScore", Number(event.target.value))} /></label>
              <label className="content-field"><span>Vendor published</span><input type="date" value={dateInput(draft.vendorPublishedAt)} onChange={(event) => patch("vendorPublishedAt", `${event.target.value}T00:00:00.000Z`)} /></label>
              <label className="content-field"><span>Vendor updated</span><input type="date" value={dateInput(draft.vendorUpdatedAt)} onChange={(event) => patch("vendorUpdatedAt", `${event.target.value}T00:00:00.000Z`)} /></label>
              <label className="content-field content-field-wide"><span>Authoritative source URL</span><input type="url" value={draft.sourceUrl} onChange={(event) => patch("sourceUrl", event.target.value)} /></label>
            </div>
          </fieldset>

          <fieldset className="content-editor-section">
            <legend>Technical scope</legend>
            <div className="content-field-grid">
              <label className="content-field content-field-wide"><span>Summary</span><textarea rows={5} value={draft.summary} onChange={(event) => patch("summary", event.target.value)} /></label>
              <ListField label="CVE identifiers" value={draft.cves} onChange={(value) => patch("cves", value)} />
              <ListField label="Affected products" value={draft.products} onChange={(value) => patch("products", value)} />
              <ListField label="Affected versions" value={draft.affectedVersions} onChange={(value) => patch("affectedVersions", value)} />
              <ListField label="Fixed versions" value={draft.fixedVersions} onChange={(value) => patch("fixedVersions", value)} />
              <label className="content-field content-field-wide"><span>Exploitation status</span><textarea rows={3} value={draft.exploitationStatus} onChange={(event) => patch("exploitationStatus", event.target.value)} /></label>
            </div>
          </fieldset>

          <fieldset className="content-editor-section">
            <legend>Action guidance</legend>
            <div className="content-field-grid">
              <label className="content-field content-field-wide"><span>Remediation</span><textarea rows={5} value={draft.remediation} onChange={(event) => patch("remediation", event.target.value)} /></label>
              <label className="content-field content-field-wide"><span>Temporary workaround</span><textarea rows={4} value={draft.workaround} onChange={(event) => patch("workaround", event.target.value)} /></label>
            </div>
          </fieldset>

          <div className="content-publish-bar">
            <div><span className={`status-pill content-status-${draft.status}`}>{draft.status}</span><small>Saving a vendor record protects the edit from automated overwrite. Publishing queues a new LinkedIn revision.</small></div>
            <div className="content-action-row">
              <button className="button secondary" disabled={Boolean(busy) || draft.status === "deleted"} type="submit"><Save aria-hidden="true" size={17} /> {busy === "save" ? "Saving..." : "Save"}</button>
              {selected && draft.status !== "published" && draft.status !== "deleted" ? <button className="button primary" disabled={Boolean(busy)} onClick={() => changeState("publish")} type="button"><Upload aria-hidden="true" size={17} /> Publish</button> : null}
              {selected && draft.status === "published" ? <button className="button secondary" disabled={Boolean(busy)} onClick={() => changeState("withdraw")} type="button"><XCircle aria-hidden="true" size={17} /> Withdraw</button> : null}
              {selected && draft.status === "deleted" ? <button className="button secondary" disabled={Boolean(busy)} onClick={() => changeState("restore")} type="button"><RotateCcw aria-hidden="true" size={17} /> Restore draft</button> : null}
              {selected && draft.status !== "deleted" && draft.editorialOverride && draft.sourceSlug !== "qcs-editorial" ? <button className="button secondary" disabled={Boolean(busy)} onClick={() => changeState("resume_sync")} type="button"><ShieldAlert aria-hidden="true" size={17} /> Resume source sync</button> : null}
              {selected && draft.status !== "deleted" ? <button className="icon-button danger" disabled={Boolean(busy)} onClick={() => remove(draft)} title="Delete advisory" type="button"><Trash2 aria-hidden="true" size={18} /></button> : null}
            </div>
          </div>
        </form>
      ) : null}
    </section>
  );
}
