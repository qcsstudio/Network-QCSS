"use client";

import { useState } from "react";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Clock3,
  FilePlus2,
  Fingerprint,
  LockKeyhole,
  Pause,
  Play,
  Plus,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
  Target,
  Trash2,
  Wrench
} from "lucide-react";
import type { VerifyGridEngagementRecord, VerifyGridPortfolio } from "@/lib/verifygrid";

type View = "command" | "scope" | "findings" | "activity";

function localDateTime(date = new Date()) {
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function label(value: string) {
  return value.replace(/_/g, " ");
}

function initialEngagementDraft() {
  const start = new Date(Date.now() + 24 * 60 * 60_000);
  const end = new Date(start.getTime() + 7 * 24 * 60 * 60_000);
  return {
    organizationName: "",
    legalName: "",
    primaryContactName: "",
    primaryContactEmail: "",
    countryCode: "IN",
    timezone: "Asia/Kolkata",
    title: "External network security assessment",
    serviceType: "external_network_vapt",
    testMode: "safe_checks",
    riskTier: "standard",
    scopeSummary: "",
    plannedStartAt: localDateTime(start),
    plannedEndAt: localDateTime(end),
    emergencyContactName: "",
    emergencyContactEmail: "",
    emergencyContactPhone: "",
    noExclusionsConfirmed: false
  };
}

function initialScopeDraft() {
  return {
    targetType: "domain",
    value: "",
    environment: "production",
    criticality: "medium",
    permission: "safe_checks",
    inScope: true,
    ownershipConfirmed: false,
    notes: ""
  };
}

function initialFindingDraft() {
  return {
    title: "",
    description: "",
    severity: "medium",
    confidence: "unverified",
    source: "manual",
    sourceReference: "",
    cvssScore: "",
    epssScore: "",
    knownExploited: false,
    businessImpact: "",
    evidenceSummary: "",
    remediation: "",
    ownerName: "",
    ownerEmail: "",
    dueAt: ""
  };
}

function initialAuthorizationDraft() {
  const start = new Date();
  return {
    approvedByName: "",
    approvedByEmail: "",
    approvedByTitle: "",
    authorityConfirmed: false,
    validFrom: localDateTime(start),
    validUntil: localDateTime(new Date(start.getTime() + 7 * 24 * 60 * 60_000)),
    artifactUrl: "",
    artifactSha256: "",
    notes: ""
  };
}

async function responseJson(response: Response) {
  return response.json() as Promise<{ error?: string; portfolio?: VerifyGridPortfolio; engagement?: VerifyGridEngagementRecord }>;
}

export function VerifyGridControlPanel({ initialPortfolio }: { initialPortfolio: VerifyGridPortfolio | null }) {
  const [portfolio, setPortfolio] = useState(initialPortfolio);
  const [selectedId, setSelectedId] = useState(initialPortfolio?.engagements[0]?.id || "");
  const [view, setView] = useState<View>("command");
  const [creating, setCreating] = useState(false);
  const [engagementDraft, setEngagementDraft] = useState(initialEngagementDraft);
  const [scopeDraft, setScopeDraft] = useState(initialScopeDraft);
  const [findingDraft, setFindingDraft] = useState(initialFindingDraft);
  const [authorizationDraft, setAuthorizationDraft] = useState(initialAuthorizationDraft);
  const [resolution, setResolution] = useState({ findingId: "", note: "" });
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState(initialPortfolio ? "VerifyGrid operations are current." : "Apply the VerifyGrid database migration to activate this workspace.");

  const selected = portfolio?.engagements.find((engagement) => engagement.id === selectedId) || portfolio?.engagements[0] || null;

  async function load(preferredId = selectedId) {
    const response = await fetch("/api/admin/verifygrid/engagements", { cache: "no-store" });
    const result = await responseJson(response);
    if (!response.ok || !result.portfolio) throw new Error(result.error || "Unable to load VerifyGrid.");
    setPortfolio(result.portfolio);
    setSelectedId(result.portfolio.engagements.some((item) => item.id === preferredId) ? preferredId : result.portfolio.engagements[0]?.id || "");
  }

  async function mutate(path: string, method: "POST" | "PATCH" | "DELETE", body?: unknown) {
    const response = await fetch(path, {
      method,
      headers: body === undefined ? undefined : { "content-type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body)
    });
    const result = await responseJson(response);
    if (!response.ok) throw new Error(result.error || "VerifyGrid operation failed.");
    return result.engagement;
  }

  async function createEngagement(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy("create");
    try {
      const engagement = await mutate("/api/admin/verifygrid/engagements", "POST", {
        ...engagementDraft,
        rulesOfEngagement: {
          businessHoursOnly: false,
          maxRequestsPerSecond: 5,
          sourceIps: [],
          prohibitedActions: ["Denial of service", "Persistence", "Destructive changes", "Access to third-party targets"],
          stopConditions: ["Service instability", "Client stop request", "Target ownership dispute", "Unexpected sensitive data exposure"],
          noExclusionsConfirmed: engagementDraft.noExclusionsConfirmed,
          notes: ""
        }
      });
      if (!engagement) throw new Error("The engagement was created without a response record.");
      await load(engagement.id);
      setSelectedId(engagement.id);
      setCreating(false);
      setEngagementDraft(initialEngagementDraft());
      setView("scope");
      setMessage(`${engagement.reference} created. Scope authorization remains blocked until targets are recorded.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to create engagement.");
    } finally {
      setBusy("");
    }
  }

  async function addScope(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) return;
    setBusy("scope");
    try {
      await mutate(`/api/admin/verifygrid/engagements/${selected.id}/scope`, "POST", scopeDraft);
      await load(selected.id);
      setScopeDraft(initialScopeDraft());
      setMessage("Scope saved. Any previous authorization was invalidated against the new scope hash.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to save target.");
    } finally {
      setBusy("");
    }
  }

  async function removeScope(targetId: string) {
    if (!selected || !window.confirm("Remove this target and invalidate any authorization for the previous scope?")) return;
    setBusy(`scope-${targetId}`);
    try {
      await mutate(`/api/admin/verifygrid/engagements/${selected.id}/scope`, "DELETE", { targetId });
      await load(selected.id);
      setMessage("Scope target removed. Authorization review is required.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to remove target.");
    } finally {
      setBusy("");
    }
  }

  async function authorize(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) return;
    setBusy("authorize");
    try {
      await mutate(`/api/admin/verifygrid/engagements/${selected.id}/authorize`, "POST", authorizationDraft);
      await load(selected.id);
      setMessage("Authorization recorded and cryptographically bound to the current scope.");
      setView("command");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to record authorization.");
    } finally {
      setBusy("");
    }
  }

  async function transition(action: string) {
    if (!selected) return;
    setBusy(action);
    try {
      await mutate(`/api/admin/verifygrid/engagements/${selected.id}`, "PATCH", { action, reason: "Operator action from VerifyGrid command workspace." });
      await load(selected.id);
      setMessage(`Engagement moved through the ${action} control.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to change engagement state.");
    } finally {
      setBusy("");
    }
  }

  async function addFinding(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) return;
    setBusy("finding");
    try {
      await mutate(`/api/admin/verifygrid/engagements/${selected.id}/findings`, "POST", {
        ...findingDraft,
        cvssScore: findingDraft.cvssScore ? Number(findingDraft.cvssScore) : null,
        epssScore: findingDraft.epssScore ? Number(findingDraft.epssScore) : null
      });
      await load(selected.id);
      setFindingDraft(initialFindingDraft());
      setMessage("Finding added to the evidence-led remediation queue.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to create finding.");
    } finally {
      setBusy("");
    }
  }

  async function updateFinding(findingId: string, status: string, note = "") {
    if (!selected) return;
    setBusy(`finding-${findingId}`);
    try {
      await mutate(`/api/admin/verifygrid/findings/${findingId}`, "PATCH", { status, resolutionNote: note });
      await load(selected.id);
      setResolution({ findingId: "", note: "" });
      setMessage(`Finding moved to ${label(status)}.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to update finding.");
    } finally {
      setBusy("");
    }
  }

  async function requestRetest(findingId: string) {
    if (!selected) return;
    setBusy(`retest-${findingId}`);
    try {
      await mutate(`/api/admin/verifygrid/findings/${findingId}/retests`, "POST");
      await load(selected.id);
      setMessage("Retest requested and added to the verification queue.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to request retest.");
    } finally {
      setBusy("");
    }
  }

  const lifecycleActions = selected ? {
    authorized: ["schedule", "start", "cancel"],
    scheduled: ["start", "pause", "cancel"],
    active: ["pause", "remediation", "cancel"],
    paused: ["resume", "remediation", "cancel"],
    remediation: ["close", "cancel"]
  }[selected.status] || [] : [];

  return (
    <section className="admin-panel verifygrid-panel" id="verifygrid">
      <div className="panel-heading verifygrid-heading">
        <div>
          <p className="eyebrow">VerifyGrid security assurance</p>
          <h2>Authorization, exposure, remediation, and retest control.</h2>
          <p>Network-first PTaaS operations with a scope-bound execution gate.</p>
        </div>
        <div className="content-action-row">
          <button className="icon-button" disabled={Boolean(busy)} onClick={() => load().catch((error) => setMessage(String(error)))} title="Refresh VerifyGrid" type="button"><RefreshCw aria-hidden="true" size={18} /></button>
          <button className="button primary compact-button" disabled={Boolean(busy)} onClick={() => setCreating((value) => !value)} type="button"><FilePlus2 aria-hidden="true" size={17} /> New engagement</button>
        </div>
      </div>
      <p aria-live="polite" className="form-note verifygrid-message">{message}</p>

      {portfolio ? (
        <div className="verifygrid-metrics" aria-label="VerifyGrid portfolio metrics">
          <div><span>Clients</span><strong>{portfolio.metrics.workspaces}</strong></div>
          <div><span>Engagements</span><strong>{portfolio.metrics.engagements}</strong></div>
          <div><span>Authorization review</span><strong>{portfolio.metrics.authorizationPending}</strong></div>
          <div><span>Executable now</span><strong>{portfolio.metrics.executable}</strong></div>
          <div><span>Open findings</span><strong>{portfolio.metrics.openFindings}</strong></div>
          <div><span>Critical</span><strong>{portfolio.metrics.criticalFindings}</strong></div>
          <div><span>Known exploited</span><strong>{portfolio.metrics.knownExploited}</strong></div>
          <div><span>Overdue</span><strong>{portfolio.metrics.overdueFindings}</strong></div>
        </div>
      ) : null}

      {creating ? (
        <form className="content-editor verifygrid-create-form" onSubmit={createEngagement}>
          <div className="content-editor-heading"><div><p className="eyebrow">Engagement intake</p><h3>Open an authorized testing record</h3></div></div>
          <fieldset className="content-editor-section">
            <legend>Client and engagement</legend>
            <div className="content-field-grid">
              <label className="content-field"><span>Organization</span><input required value={engagementDraft.organizationName} onChange={(event) => setEngagementDraft({ ...engagementDraft, organizationName: event.target.value })} /></label>
              <label className="content-field"><span>Legal name</span><input value={engagementDraft.legalName} onChange={(event) => setEngagementDraft({ ...engagementDraft, legalName: event.target.value })} /></label>
              <label className="content-field"><span>Primary contact</span><input required value={engagementDraft.primaryContactName} onChange={(event) => setEngagementDraft({ ...engagementDraft, primaryContactName: event.target.value })} /></label>
              <label className="content-field"><span>Contact email</span><input required type="email" value={engagementDraft.primaryContactEmail} onChange={(event) => setEngagementDraft({ ...engagementDraft, primaryContactEmail: event.target.value })} /></label>
              <label className="content-field content-field-wide"><span>Engagement title</span><input required value={engagementDraft.title} onChange={(event) => setEngagementDraft({ ...engagementDraft, title: event.target.value })} /></label>
              <label className="content-field"><span>Service</span><select value={engagementDraft.serviceType} onChange={(event) => setEngagementDraft({ ...engagementDraft, serviceType: event.target.value })}><option value="external_network_vapt">External network VAPT</option><option value="internal_network_vapt">Internal network VAPT</option><option value="firewall_assurance">Firewall assurance</option><option value="cloud_network_assurance">Cloud network assurance</option><option value="wireless_assessment">Wireless assessment</option><option value="configuration_assurance">Configuration assurance</option><option value="continuous_validation">Continuous validation</option><option value="web_and_api_vapt">Web and API VAPT</option></select></label>
              <label className="content-field"><span>Test mode</span><select value={engagementDraft.testMode} onChange={(event) => setEngagementDraft({ ...engagementDraft, testMode: event.target.value })}><option value="passive_review">Passive review</option><option value="safe_checks">Safe checks</option><option value="controlled_validation">Controlled validation</option><option value="manual_only">Manual only</option></select></label>
              <label className="content-field content-field-wide"><span>Scope summary</span><textarea required rows={3} value={engagementDraft.scopeSummary} onChange={(event) => setEngagementDraft({ ...engagementDraft, scopeSummary: event.target.value })} /></label>
              <label className="content-field"><span>Planned start</span><input type="datetime-local" value={engagementDraft.plannedStartAt} onChange={(event) => setEngagementDraft({ ...engagementDraft, plannedStartAt: event.target.value })} /></label>
              <label className="content-field"><span>Planned end</span><input type="datetime-local" value={engagementDraft.plannedEndAt} onChange={(event) => setEngagementDraft({ ...engagementDraft, plannedEndAt: event.target.value })} /></label>
              <label className="content-field"><span>Emergency contact</span><input required value={engagementDraft.emergencyContactName} onChange={(event) => setEngagementDraft({ ...engagementDraft, emergencyContactName: event.target.value })} /></label>
              <label className="content-field"><span>Emergency email</span><input required type="email" value={engagementDraft.emergencyContactEmail} onChange={(event) => setEngagementDraft({ ...engagementDraft, emergencyContactEmail: event.target.value })} /></label>
              <label className="verifygrid-check content-field-wide"><input checked={engagementDraft.noExclusionsConfirmed} onChange={(event) => setEngagementDraft({ ...engagementDraft, noExclusionsConfirmed: event.target.checked })} type="checkbox" /><span>The client explicitly stated that no exclusions apply.</span></label>
            </div>
          </fieldset>
          <div className="content-action-row"><button className="button primary" disabled={busy === "create"} type="submit"><Plus aria-hidden="true" size={17} /> {busy === "create" ? "Creating..." : "Create engagement"}</button><button className="button secondary" onClick={() => setCreating(false)} type="button">Cancel</button></div>
        </form>
      ) : null}

      {portfolio && portfolio.engagements.length ? (
        <div className="verifygrid-layout">
          <aside className="verifygrid-rail" aria-label="Engagements">
            {portfolio.engagements.map((engagement) => (
              <button aria-current={selected?.id === engagement.id ? "true" : undefined} key={engagement.id} onClick={() => { setSelectedId(engagement.id); setView("command"); }} type="button">
                <span><strong>{engagement.workspace.name}</strong><em>{engagement.reference}</em></span>
                <span className={`verifygrid-state state-${engagement.status}`}>{label(engagement.status)}</span>
                <small>{engagement.title}</small>
              </button>
            ))}
          </aside>

          {selected ? (
            <div className="verifygrid-workspace">
              <header className="verifygrid-engagement-header">
                <div><div className="content-card-statuses"><span className={`status-pill content-status-${selected.gate.executable ? "published" : "draft"}`}>{selected.gate.executable ? "execution gate open" : "execution blocked"}</span><span className="status-pill content-kind-pill">{label(selected.testMode)}</span></div><h3>{selected.title}</h3><p>{selected.workspace.name} | {selected.reference} | {label(selected.serviceType)}</p></div>
                <div className="content-action-row">
                  {lifecycleActions.map((action) => <button className="button secondary compact-button" disabled={Boolean(busy)} key={action} onClick={() => transition(action)} type="button">{action === "start" || action === "resume" ? <Play aria-hidden="true" size={15} /> : action === "pause" ? <Pause aria-hidden="true" size={15} /> : action === "remediation" ? <Wrench aria-hidden="true" size={15} /> : <CheckCircle2 aria-hidden="true" size={15} />}{label(action)}</button>)}
                </div>
              </header>

              <div className="content-filter-tabs verifygrid-tabs" aria-label="Engagement views">
                {(["command", "scope", "findings", "activity"] as const).map((item) => <button aria-pressed={view === item} key={item} onClick={() => setView(item)} type="button">{item}</button>)}
              </div>

              {view === "command" ? (
                <div className="verifygrid-command-grid">
                  <section><div className="verifygrid-section-heading"><ShieldCheck aria-hidden="true" size={20} /><div><h4>Execution gate</h4><p>{selected.gate.scopeHash.slice(0, 16)}...</p></div></div>{selected.gate.blockers.length ? <ul className="verifygrid-blockers">{selected.gate.blockers.map((blocker) => <li key={blocker}><AlertTriangle aria-hidden="true" size={16} />{blocker}</li>)}</ul> : <p className="verifygrid-success"><CheckCircle2 aria-hidden="true" size={18} /> Scope, authority, and time window are current.</p>}</section>
                  <section><div className="verifygrid-section-heading"><Clock3 aria-hidden="true" size={20} /><div><h4>Operating window</h4><p>{selected.plannedStartAt ? new Date(selected.plannedStartAt).toLocaleString() : "Not scheduled"}</p></div></div><dl className="verifygrid-facts"><div><dt>Status</dt><dd>{label(selected.status)}</dd></div><div><dt>Emergency owner</dt><dd>{selected.emergencyContactName}</dd></div><div><dt>Targets</dt><dd>{selected.scopeTargets.filter((target) => target.inScope).length} in / {selected.scopeTargets.filter((target) => !target.inScope).length} out</dd></div><div><dt>Findings</dt><dd>{selected.findings.length}</dd></div></dl></section>
                </div>
              ) : null}

              {view === "scope" ? (
                <div className="verifygrid-scope-view">
                  <div className="verifygrid-scope-list">
                    <div className="verifygrid-section-heading"><Target aria-hidden="true" size={20} /><div><h4>Current scope</h4><p>{selected.scopeTargets.length} recorded target(s)</p></div></div>
                    {selected.scopeTargets.length ? selected.scopeTargets.map((target) => <div className="verifygrid-target" key={target.id}><span className={`verifygrid-target-mark ${target.inScope ? "in" : "out"}`}>{target.inScope ? "IN" : "OUT"}</span><div><strong>{target.value}</strong><span>{label(target.targetType)} | {label(target.permission)} | {target.environment}</span></div><button className="icon-button danger" disabled={Boolean(busy)} onClick={() => removeScope(target.id)} title="Remove scope target" type="button"><Trash2 aria-hidden="true" size={17} /></button></div>) : <p className="content-empty-state">No scope targets recorded.</p>}
                  </div>
                  <form className="content-editor verifygrid-compact-form" onSubmit={addScope}><fieldset className="content-editor-section"><legend>Add target or exclusion</legend><div className="content-field-grid"><label className="content-field"><span>Type</span><select value={scopeDraft.targetType} onChange={(event) => setScopeDraft({ ...scopeDraft, targetType: event.target.value })}><option value="domain">Domain</option><option value="hostname">Hostname</option><option value="ip">IP address</option><option value="cidr">CIDR</option><option value="url">URL</option><option value="cloud_account">Cloud account</option><option value="site">Site</option><option value="wireless_ssid">Wireless SSID</option><option value="application">Application</option></select></label><label className="content-field"><span>Target</span><input required value={scopeDraft.value} onChange={(event) => setScopeDraft({ ...scopeDraft, value: event.target.value })} /></label><label className="content-field"><span>Permission</span><select value={scopeDraft.permission} onChange={(event) => setScopeDraft({ ...scopeDraft, permission: event.target.value })}><option value="observe">Observe only</option><option value="safe_checks">Safe checks</option><option value="controlled_validation">Controlled validation</option><option value="manual_only">Manual only</option></select></label><label className="content-field"><span>Criticality</span><select value={scopeDraft.criticality} onChange={(event) => setScopeDraft({ ...scopeDraft, criticality: event.target.value })}><option value="critical">Critical</option><option value="high">High</option><option value="medium">Medium</option><option value="low">Low</option></select></label><label className="verifygrid-check"><input checked={scopeDraft.inScope} onChange={(event) => setScopeDraft({ ...scopeDraft, inScope: event.target.checked, ownershipConfirmed: event.target.checked ? scopeDraft.ownershipConfirmed : false })} type="checkbox" /><span>In scope</span></label><label className="verifygrid-check"><input checked={scopeDraft.ownershipConfirmed} disabled={!scopeDraft.inScope} onChange={(event) => setScopeDraft({ ...scopeDraft, ownershipConfirmed: event.target.checked })} type="checkbox" /><span>Ownership confirmed</span></label></div><button className="button primary compact-button" disabled={busy === "scope"} type="submit"><Plus aria-hidden="true" size={16} /> Save scope</button></fieldset></form>
                  <form className="content-editor verifygrid-compact-form" onSubmit={authorize}><fieldset className="content-editor-section"><legend>Record authorization</legend><div className="content-field-grid"><label className="content-field"><span>Approver</span><input required value={authorizationDraft.approvedByName} onChange={(event) => setAuthorizationDraft({ ...authorizationDraft, approvedByName: event.target.value })} /></label><label className="content-field"><span>Approver email</span><input required type="email" value={authorizationDraft.approvedByEmail} onChange={(event) => setAuthorizationDraft({ ...authorizationDraft, approvedByEmail: event.target.value })} /></label><label className="content-field"><span>Valid from</span><input required type="datetime-local" value={authorizationDraft.validFrom} onChange={(event) => setAuthorizationDraft({ ...authorizationDraft, validFrom: event.target.value })} /></label><label className="content-field"><span>Valid until</span><input required type="datetime-local" value={authorizationDraft.validUntil} onChange={(event) => setAuthorizationDraft({ ...authorizationDraft, validUntil: event.target.value })} /></label><label className="content-field content-field-wide"><span>Authorization artifact URL</span><input type="url" value={authorizationDraft.artifactUrl} onChange={(event) => setAuthorizationDraft({ ...authorizationDraft, artifactUrl: event.target.value })} /></label><label className="verifygrid-check content-field-wide"><input checked={authorizationDraft.authorityConfirmed} onChange={(event) => setAuthorizationDraft({ ...authorizationDraft, authorityConfirmed: event.target.checked })} type="checkbox" /><span>I verified that this approver can legally authorize testing of the recorded targets.</span></label></div><button className="button primary compact-button" disabled={busy === "authorize" || !authorizationDraft.authorityConfirmed} type="submit"><LockKeyhole aria-hidden="true" size={16} /> Bind authorization</button></fieldset></form>
                </div>
              ) : null}

              {view === "findings" ? (
                <div className="verifygrid-findings-view">
                  <div className="verifygrid-finding-list"><div className="verifygrid-section-heading"><Fingerprint aria-hidden="true" size={20} /><div><h4>Evidence-led findings</h4><p>Ranked by exploitability, confidence, and business criticality</p></div></div>{selected.findings.length ? selected.findings.map((finding) => <article className={`verifygrid-finding severity-${finding.severity}`} key={finding.id}><div className="verifygrid-finding-top"><div><span className={`severity-pill severity-${finding.severity}`}>{finding.severity}</span><span className="status-pill content-kind-pill">risk {finding.riskScore}</span>{finding.knownExploited ? <span className="status-pill content-status-deleted">known exploited</span> : null}<h5>{finding.title}</h5><p>{finding.businessImpact}</p></div><strong>{label(finding.status)}</strong></div><div className="verifygrid-finding-actions">{finding.status === "open" ? <button className="button secondary compact-button" disabled={Boolean(busy)} onClick={() => updateFinding(finding.id, "validated")} type="button"><CheckCircle2 aria-hidden="true" size={15} /> Validate</button> : null}{finding.status === "validated" ? <button className="button secondary compact-button" disabled={Boolean(busy)} onClick={() => updateFinding(finding.id, "remediation_in_progress")} type="button"><Wrench aria-hidden="true" size={15} /> Start remediation</button> : null}{finding.status === "remediation_in_progress" ? <button className="button secondary compact-button" onClick={() => setResolution({ findingId: finding.id, note: "" })} type="button"><CheckCircle2 aria-hidden="true" size={15} /> Mark resolved</button> : null}{finding.status === "resolved" ? <button className="button primary compact-button" disabled={Boolean(busy)} onClick={() => requestRetest(finding.id)} type="button"><RotateCcw aria-hidden="true" size={15} /> Request retest</button> : null}</div>{resolution.findingId === finding.id ? <form className="verifygrid-resolution" onSubmit={(event) => { event.preventDefault(); updateFinding(finding.id, "resolved", resolution.note); }}><label className="content-field"><span>Resolution evidence</span><textarea required minLength={20} rows={2} value={resolution.note} onChange={(event) => setResolution({ findingId: finding.id, note: event.target.value })} /></label><button className="button primary compact-button" type="submit">Confirm resolution</button></form> : null}</article>) : <p className="content-empty-state">No findings recorded.</p>}</div>
                  <form className="content-editor verifygrid-compact-form" onSubmit={addFinding}><fieldset className="content-editor-section"><legend>Add finding</legend><div className="content-field-grid"><label className="content-field content-field-wide"><span>Title</span><input required value={findingDraft.title} onChange={(event) => setFindingDraft({ ...findingDraft, title: event.target.value })} /></label><label className="content-field"><span>Severity</span><select value={findingDraft.severity} onChange={(event) => setFindingDraft({ ...findingDraft, severity: event.target.value })}><option value="critical">Critical</option><option value="high">High</option><option value="medium">Medium</option><option value="low">Low</option><option value="informational">Informational</option></select></label><label className="content-field"><span>Confidence</span><select value={findingDraft.confidence} onChange={(event) => setFindingDraft({ ...findingDraft, confidence: event.target.value })}><option value="unverified">Unverified</option><option value="likely">Likely</option><option value="validated">Validated</option></select></label><label className="content-field content-field-wide"><span>Technical observation</span><textarea required rows={3} value={findingDraft.description} onChange={(event) => setFindingDraft({ ...findingDraft, description: event.target.value })} /></label><label className="content-field content-field-wide"><span>Business impact</span><textarea required rows={2} value={findingDraft.businessImpact} onChange={(event) => setFindingDraft({ ...findingDraft, businessImpact: event.target.value })} /></label><label className="content-field content-field-wide"><span>Remediation</span><textarea required rows={3} value={findingDraft.remediation} onChange={(event) => setFindingDraft({ ...findingDraft, remediation: event.target.value })} /></label><label className="content-field"><span>CVSS</span><input max="10" min="0" step="0.1" type="number" value={findingDraft.cvssScore} onChange={(event) => setFindingDraft({ ...findingDraft, cvssScore: event.target.value })} /></label><label className="content-field"><span>EPSS</span><input max="1" min="0" step="0.001" type="number" value={findingDraft.epssScore} onChange={(event) => setFindingDraft({ ...findingDraft, epssScore: event.target.value })} /></label><label className="verifygrid-check content-field-wide"><input checked={findingDraft.knownExploited} onChange={(event) => setFindingDraft({ ...findingDraft, knownExploited: event.target.checked })} type="checkbox" /><span>Known exploited vulnerability</span></label></div><button className="button primary compact-button" disabled={busy === "finding"} type="submit"><Plus aria-hidden="true" size={16} /> Add finding</button></fieldset></form>
                </div>
              ) : null}

              {view === "activity" ? <div className="verifygrid-activity"><div className="verifygrid-section-heading"><Activity aria-hidden="true" size={20} /><div><h4>Engagement activity</h4><p>Latest accountable product events</p></div></div>{selected.activities.length ? selected.activities.map((item) => <div key={item.id}><span>{new Date(item.createdAt).toLocaleString()}</span><strong>{label(item.action)}</strong><em>{item.actor}</em></div>) : <p className="content-empty-state">No activity recorded.</p>}</div> : null}
            </div>
          ) : null}
        </div>
      ) : portfolio ? <div className="verifygrid-empty"><ShieldCheck aria-hidden="true" size={28} /><h3>No engagements yet</h3><p>Open the first client security assurance record.</p></div> : null}
    </section>
  );
}
