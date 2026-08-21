"use client";

import { useMemo, useState } from "react";
import {
  Activity,
  ArrowDownAZ,
  Bot,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  Eye,
  FilePenLine,
  FilePlus2,
  RefreshCw,
  RotateCcw,
  Save,
  Search,
  ShieldAlert,
  SlidersHorizontal,
  Trash2,
  Upload,
  X,
  XCircle
} from "lucide-react";
import type { AdminAdvisoryRecord } from "@/lib/advisories";

type AdvisoryOriginFilter = "all" | "source" | "manual" | "deleted";
type AdvisoryStatusFilter = "all" | "draft" | "published" | "withdrawn" | "deleted";
type AdvisorySeverityFilter = "all" | "critical" | "high" | "medium" | "low" | "unrated";
type AdvisorySort = "priority-desc" | "updated-desc" | "vendor-asc";

const severityOrder: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3, unrated: 4 };
const adminAdvisoryPageSize = 12;

function includesSearch(advisory: AdminAdvisoryRecord, query: string) {
  if (!query) return true;
  return [
    advisory.title,
    advisory.vendor,
    advisory.sourceName,
    advisory.slug,
    advisory.exploitationStatus,
    ...advisory.cves,
    ...advisory.products
  ].join(" ").toLowerCase().includes(query);
}

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
    technicalExplanation: "Draft required: explain the vulnerability mechanism and applicability conditions using only the authoritative source.",
    businessImpact: "Draft required: explain the service, confidentiality, integrity, or availability impact without overstating the source.",
    evidenceChecklist: [
      "Confirm the deployed product, release, role, and accountable owner.",
      "Compare the environment with every applicability condition in the official advisory.",
      "Record current exposure, configuration, logs, and compensating controls.",
      "Retain before-and-after remediation and service-validation evidence."
    ],
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
    revision: 0,
    qualityScore: null
  };
}

function advisoryPayload(advisory: AdminAdvisoryRecord) {
  return {
    slug: advisory.slug,
    title: advisory.title,
    vendor: advisory.vendor,
    summary: advisory.summary,
    technicalExplanation: advisory.technicalExplanation,
    businessImpact: advisory.businessImpact,
    evidenceChecklist: advisory.evidenceChecklist,
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
  const [originFilter, setOriginFilter] = useState<AdvisoryOriginFilter>("all");
  const [statusFilter, setStatusFilter] = useState<AdvisoryStatusFilter>("all");
  const [severityFilter, setSeverityFilter] = useState<AdvisorySeverityFilter>("all");
  const [vendorFilter, setVendorFilter] = useState("all");
  const [sort, setSort] = useState<AdvisorySort>("priority-desc");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
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

  function closeEditor() {
    setSelected(null);
    setDraft(null);
    setMessage("Advisory queue ready.");
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

  async function changeState(action: "publish" | "withdraw" | "restore" | "resume_sync", target = selected) {
    if (!target) return;
    setBusy(action);
    try {
      const response = await fetch(`/api/admin/security-advisories/${target.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action })
      });
      const result = (await response.json()) as { advisory?: AdminAdvisoryRecord; error?: string };
      if (!response.ok || !result.advisory) throw new Error(result.error || `Unable to ${action.replace("_", " ")} the advisory.`);
      if (selected?.id === target.id) {
        setSelected(result.advisory);
        setDraft(structuredClone(result.advisory));
      }
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

  const vendors = useMemo(
    () => [...new Set(advisories.filter((item) => item.status !== "deleted").map((item) => item.vendor))].sort((left, right) => left.localeCompare(right)),
    [advisories]
  );
  const metrics = useMemo(() => ({
    urgent: advisories.filter((item) => item.status === "published" && (item.severity === "critical" || item.severity === "high")).length,
    draft: advisories.filter((item) => item.status === "draft").length,
    live: advisories.filter((item) => item.status === "published").length,
    overrides: advisories.filter((item) => item.editorialOverride && item.status !== "deleted").length
  }), [advisories]);
  const visible = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return advisories
      .filter((advisory) => {
        if (originFilter === "source" && (advisory.sourceSlug === "qcs-editorial" || advisory.status === "deleted")) return false;
        if (originFilter === "manual" && (advisory.sourceSlug !== "qcs-editorial" || advisory.status === "deleted")) return false;
        if (originFilter === "deleted" && advisory.status !== "deleted") return false;
        if (originFilter !== "deleted" && advisory.status === "deleted") return false;
        if (statusFilter !== "all" && advisory.status !== statusFilter) return false;
        if (severityFilter !== "all" && advisory.severity !== severityFilter) return false;
        if (vendorFilter !== "all" && advisory.vendor !== vendorFilter) return false;
        return includesSearch(advisory, normalizedQuery);
      })
      .sort((left, right) => {
        if (sort === "updated-desc") return new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime();
        if (sort === "vendor-asc") return left.vendor.localeCompare(right.vendor) || severityOrder[left.severity] - severityOrder[right.severity];
        return right.priorityScore - left.priorityScore || severityOrder[left.severity] - severityOrder[right.severity];
      });
  }, [advisories, originFilter, query, severityFilter, sort, statusFilter, vendorFilter]);

  function resetFilters() {
    setOriginFilter("all");
    setStatusFilter("all");
    setSeverityFilter("all");
    setVendorFilter("all");
    setSort("priority-desc");
    setQuery("");
    setPage(1);
  }
  const totalPages = Math.max(1, Math.ceil(visible.length / adminAdvisoryPageSize));
  const currentPage = Math.min(page, totalPages);
  const pageStart = (currentPage - 1) * adminAdvisoryPageSize;
  const pageItems = visible.slice(pageStart, pageStart + adminAdvisoryPageSize);

  return (
    <section className="admin-panel advisory-management-panel" id="advisory-management">
      <div className="panel-heading">
        <div><p className="eyebrow">Advisory operations</p><h2>One queue for source intelligence and editorial control.</h2><p>Prioritize urgent items, protect verified source data, and move each advisory through a visible publishing state.</p></div>
        <div className="content-action-row">
          <button className="button secondary" disabled={Boolean(busy)} onClick={() => load().catch((error) => setMessage(String(error)))} type="button"><RefreshCw aria-hidden="true" size={17} /> Refresh</button>
          <button className="button primary" disabled={Boolean(busy)} onClick={createNew} type="button"><FilePlus2 aria-hidden="true" size={17} /> New advisory</button>
        </div>
      </div>
      <div aria-live="polite" className="admin-operation-status" role="status"><Activity aria-hidden="true" size={17} /><span>{message}</span></div>

      <div className="editorial-control-strip" aria-label="Advisory operations summary">
        <article><CircleAlert aria-hidden="true" /><span>Urgent and live</span><strong>{metrics.urgent}</strong></article>
        <article><FilePenLine aria-hidden="true" /><span>Draft review</span><strong>{metrics.draft}</strong></article>
        <article><ShieldAlert aria-hidden="true" /><span>Published</span><strong>{metrics.live}</strong></article>
        <article><Bot aria-hidden="true" /><span>Editorial overrides</span><strong>{metrics.overrides}</strong></article>
      </div>

      <div className="content-queue-header">
        <div><h3>Advisory queue</h3><p>{visible.length ? `Showing ${pageStart + 1}-${Math.min(pageStart + adminAdvisoryPageSize, visible.length)} of ${visible.length} matching records.` : "No matching records."}</p></div>
        <div className="content-filter-tabs" aria-label="Filter advisories">
          {(["all", "source", "manual", "deleted"] as const).map((item) => <button aria-pressed={originFilter === item} key={item} onClick={() => { setOriginFilter(item); if (item === "deleted") setStatusFilter("all"); setPage(1); }} type="button">{item}</button>)}
        </div>
      </div>

      <div className="advisory-admin-toolbar">
        <label className="advisory-admin-search"><span>Search</span><div><Search aria-hidden="true" size={17} /><input onChange={(event) => { setQuery(event.target.value); setPage(1); }} placeholder="CVE, title, vendor, product" type="search" value={query} /></div></label>
        <label><span>Status</span><select onChange={(event) => { setStatusFilter(event.target.value as AdvisoryStatusFilter); setPage(1); }} value={statusFilter}><option value="all">All statuses</option><option value="draft">Draft</option><option value="published">Published</option><option value="withdrawn">Withdrawn</option></select></label>
        <label><span>Severity</span><select onChange={(event) => { setSeverityFilter(event.target.value as AdvisorySeverityFilter); setPage(1); }} value={severityFilter}><option value="all">All severities</option><option value="critical">Critical</option><option value="high">High</option><option value="medium">Medium</option><option value="low">Low</option><option value="unrated">Unrated</option></select></label>
        <label><span>Vendor</span><select onChange={(event) => { setVendorFilter(event.target.value); setPage(1); }} value={vendorFilter}><option value="all">All vendors</option>{vendors.map((vendor) => <option key={vendor} value={vendor}>{vendor}</option>)}</select></label>
        <label><span>Order</span><select onChange={(event) => { setSort(event.target.value as AdvisorySort); setPage(1); }} value={sort}><option value="priority-desc">Highest priority</option><option value="updated-desc">Recently updated</option><option value="vendor-asc">Vendor A-Z</option></select></label>
        <button className="icon-button" onClick={resetFilters} title="Reset advisory filters" type="button"><SlidersHorizontal aria-hidden="true" size={18} /></button>
      </div>

      <div className="content-queue advisory-admin-queue">
        {visible.length ? pageItems.map((advisory) => (
          <article className={`content-queue-card${selected?.id === advisory.id ? " is-selected" : ""}`} key={advisory.id}>
            <div className="content-queue-card-main">
              <div className="content-card-statuses"><span className={`severity-pill severity-${advisory.severity}`}>{advisory.severity}</span><span className={`status-pill content-status-${advisory.status}`}>{advisory.status}</span>{advisory.qualityScore !== null ? <span className="status-pill content-kind-pill">QA {advisory.qualityScore}</span> : null}{advisory.editorialOverride ? <span className="status-pill content-kind-pill">editorial control</span> : null}</div>
              <h4>{advisory.title}</h4>
              <p>{advisory.summary}</p>
              <dl className="content-queue-facts">
                <div><dt>Vendor</dt><dd>{advisory.vendor}</dd></div>
                <div><dt>Priority</dt><dd>{advisory.priorityScore}/100</dd></div>
                <div><dt>Source</dt><dd>{advisory.sourceName}</dd></div>
                <div><dt>Updated</dt><dd>{new Date(advisory.updatedAt).toLocaleDateString("en-IN")}</dd></div>
              </dl>
            </div>
            <div className="content-queue-actions">
              {advisory.status === "deleted" ? <button className="button secondary compact-button" onClick={() => edit(advisory)} type="button"><RotateCcw aria-hidden="true" size={16} /> Review</button> : <button className="button secondary compact-button" onClick={() => edit(advisory)} type="button"><FilePenLine aria-hidden="true" size={16} /> Edit</button>}
              {advisory.status === "draft" ? <button className="button primary compact-button" disabled={Boolean(busy)} onClick={() => changeState("publish", advisory)} type="button"><Upload aria-hidden="true" size={16} /> Publish</button> : null}
              {advisory.status === "published" ? <button className="button secondary compact-button" disabled={Boolean(busy)} onClick={() => changeState("withdraw", advisory)} type="button"><XCircle aria-hidden="true" size={16} /> Withdraw</button> : null}
              {advisory.status === "published" || advisory.status === "withdrawn" ? <a className="icon-button" href={`/security-advisories/${advisory.slug}`} rel="noreferrer" target="_blank" title="Open advisory"><Eye aria-hidden="true" size={18} /></a> : null}
              {advisory.status !== "deleted" ? <button className="icon-button danger" disabled={Boolean(busy)} onClick={() => remove(advisory)} title="Delete advisory" type="button"><Trash2 aria-hidden="true" size={18} /></button> : null}
            </div>
          </article>
        )) : <div className="content-empty-state"><ArrowDownAZ aria-hidden="true" size={28} /><strong>No advisories match this view.</strong><span>Reset the filters or broaden the search.</span><button className="button secondary compact-button" onClick={resetFilters} type="button">Reset filters</button></div>}
      </div>
      {visible.length > adminAdvisoryPageSize ? (
        <nav aria-label="Admin advisory pages" className="advisory-pagination">
          <button disabled={currentPage === 1} onClick={() => setPage((value) => Math.max(1, value - 1))} type="button"><ChevronLeft aria-hidden="true" size={17} /> Previous</button>
          <span>Page {currentPage} of {totalPages}</span>
          <button disabled={currentPage === totalPages} onClick={() => setPage((value) => Math.min(totalPages, value + 1))} type="button">Next <ChevronRight aria-hidden="true" size={17} /></button>
        </nav>
      ) : null}

      {draft ? (
        <form className="content-editor" id="advisory-editor" onSubmit={(event) => { event.preventDefault(); save(); }}>
          <div className="content-editor-heading">
            <div><p className="eyebrow">Structured advisory editor</p><h3>{draft.title}</h3><p>{draft.sourceSlug === "qcs-editorial" ? "Manual QCS advisory" : `${draft.sourceName}; saving enables editorial control`}</p></div>
            <div className="content-editor-controls"><div className="content-card-statuses"><span className={`status-pill content-status-${draft.status}`}>{draft.status}</span>{draft.editorialOverride ? <span className="status-pill content-kind-pill">source sync paused</span> : <span className="status-pill content-status-published">source sync active</span>}</div><button aria-label="Close advisory editor" className="icon-button" onClick={closeEditor} title="Close editor" type="button"><X aria-hidden="true" size={18} /></button></div>
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
              <label className="content-field content-field-wide"><span>Plain-language summary</span><textarea rows={5} value={draft.summary} onChange={(event) => patch("summary", event.target.value)} /></label>
              <label className="content-field content-field-wide"><span>Technical explanation</span><textarea rows={6} value={draft.technicalExplanation} onChange={(event) => patch("technicalExplanation", event.target.value)} /></label>
              <label className="content-field content-field-wide"><span>Operational and business impact</span><textarea rows={4} value={draft.businessImpact} onChange={(event) => patch("businessImpact", event.target.value)} /></label>
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
              <label className="content-field content-field-wide"><span>Evidence checklist</span><textarea rows={6} value={draft.evidenceChecklist.join("\n")} onChange={(event) => patch("evidenceChecklist", lines(event.target.value))} /></label>
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
