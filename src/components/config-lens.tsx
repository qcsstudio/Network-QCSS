"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { ArrowDown, ArrowRight, BookOpen, Check, ChevronLeft, ChevronRight, Download, FileCode2, GitBranch, ListFilter, LockKeyhole, Network, Play, Router, ShieldCheck, Trash2, Upload, X } from "lucide-react";
import { CATALOG_REVIEWED, getProfile, glossary, LENS_PATH, LENS_VERSION, profiles, type Selection, type Vendor } from "@/lib/config-lens/catalog";
import { MAX_BYTES } from "@/lib/config-lens/masking";
import { reportText, type Analysis } from "@/lib/config-lens/engine";
import { samples } from "@/lib/config-lens/samples";
import styles from "./config-lens.module.css";

const tabs = ["Overview", "Diagram", "Explanations", "Checks", "Source", "Glossary"] as const;
type Tab = typeof tabs[number];
const pageSize = 60;
function saveText(name: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: "text/plain;charset=utf-8" }));
  const a = document.createElement("a"); a.href = url; a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const subscribeDocument = (notify: () => void) => {
  window.addEventListener("load", notify); window.addEventListener("pageshow", notify);
  return () => { window.removeEventListener("load", notify); window.removeEventListener("pageshow", notify); };
};
const serverDocumentReady = () => false;
function documentReady() {
  const navigation = performance.getEntriesByType("navigation")[0];
  return Boolean(navigation && new URL(navigation.name).pathname.replace(/\/$/, "") === LENS_PATH);
}
export function ConfigLens() {
  const ready = useSyncExternalStore(subscribeDocument, documentReady, serverDocumentReady);
  useEffect(() => {
    // A full document load applies the private route CSP and unloads earlier tracking listeners.
    if (!documentReady() && performance.getEntriesByType("navigation").length) window.location.replace(LENS_PATH);
  }, [ready]);
  if (!ready) return <p role="status">Opening the private workspace. <a href={LENS_PATH}>Open Config Lens</a></p>;
  return <LocalConfigLens />;
}

function LocalConfigLens() {
  const [vendor, setVendor] = useState<Vendor>("cisco");
  const [selection, setSelection] = useState<Selection>({ profileId: "cisco-router", version: "IOS XE 17.x", build: "", configType: "unknown" });
  const [input, setInput] = useState("");
  const [result, setResult] = useState<Analysis | null>(null);
  const [busy, setBusy] = useState(false), [error, setError] = useState("");
  const [tab, setTab] = useState<Tab>("Overview"), [filter, setFilter] = useState("all"), [page, setPage] = useState(0);
  const [selectedEntity, setSelectedEntity] = useState("");
  const [exportKind, setExportKind] = useState<"report" | "config" | null>(null), [exportApproved, setExportApproved] = useState(false);
  const [announcement, setAnnouncement] = useState("");
  const worker = useRef<Worker | null>(null), generation = useRef(0), timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fileInput = useRef<HTMLInputElement>(null), resultHeading = useRef<HTMLHeadingElement>(null), exportButton = useRef<HTMLButtonElement>(null);
  const profile = getProfile(selection.profileId)!;
  function stop() { worker.current?.terminate(); worker.current = null; if (timer.current) clearTimeout(timer.current); timer.current = null; }
  useEffect(() => {
    const dispose = () => { generation.current++; worker.current?.terminate(); if (timer.current) clearTimeout(timer.current); };
    const restore = (event: PageTransitionEvent) => { if (event.persisted) window.location.reload(); };
    window.addEventListener("pagehide", dispose); window.addEventListener("pageshow", restore);
    return () => { dispose(); window.removeEventListener("pagehide", dispose); window.removeEventListener("pageshow", restore); };
  }, []);
  function invalidate() { generation.current++; stop(); setBusy(false); setResult(null); setError(""); setAnnouncement(""); setExportKind(null); setPage(0); }
  function chooseProfile(id: string) { invalidate(); const p = getProfile(id)!; setSelection({ profileId: id, version: p.versions[0], build: "", configType: "unknown" }); }
  function changeSelection(next: Partial<Selection>) { invalidate(); setSelection(s => ({ ...s, ...next })); }
  function clear() { invalidate(); setInput(""); setAnnouncement("Configuration and results cleared from this workspace."); if (fileInput.current) fileInput.current.value = ""; }
  async function loadFile(file?: File) {
    if (!file) return;
    invalidate(); const request = generation.current;
    if (file.size > MAX_BYTES || !/\.(?:txt|conf|cfg|config|log)$/i.test(file.name)) { setError("Choose a UTF-8 .txt, .conf, .cfg, .config or .log file up to 512 KiB. No archives or encrypted backups."); return; }
    try { const data = await file.arrayBuffer(); const text = new TextDecoder("utf-8", { fatal: true }).decode(data); if (generation.current === request) { setInput(text); setAnnouncement("Text file loaded locally. Review the selection before analysis."); } }
    catch { if (generation.current === request) setError("This file is not readable UTF-8 text. Export a plain-text CLI configuration."); }
    if (fileInput.current) fileInput.current.value = "";
  }
  function analyze() {
    invalidate(); if (!input.trim()) { setError("Add a configuration first."); return; }
    if (new TextEncoder().encode(input).length > MAX_BYTES) { setError("Configuration exceeds 512 KiB."); return; }
    setBusy(true); const request = generation.current;
    try {
      const w = new Worker(new URL("./config-lens.worker.ts", import.meta.url)); worker.current = w;
      w.onmessage = (event: MessageEvent<{ analysis?: Analysis; error?: string }>) => {
        if (request !== generation.current) return;
        stop(); setBusy(false);
        if (!event.data.analysis) { setError(event.data.error || "Local analysis failed."); return; }
        const analysis = event.data.analysis;
        setResult(analysis); setInput(analysis.maskedSource); setTab("Overview"); setFilter("all"); setPage(0);
        setSelectedEntity(analysis.entities.find(e => e.kind.includes("policy"))?.id || analysis.entities[0]?.id || "");
        setAnnouncement(`Analysis complete. ${analysis.coverage.unknown} statements need review. ${analysis.maskedCount} lines masked.`);
        setTimeout(() => resultHeading.current?.focus(), 0);
      };
      w.onerror = () => { if (request === generation.current) { stop(); setBusy(false); setError("The local analysis worker could not start. No server fallback or API request was made."); } };
      timer.current = setTimeout(() => { stop(); setBusy(false); setError("Local analysis exceeded 10 seconds. Use a smaller scoped export."); }, 10000);
      w.postMessage({ input, selection });
    } catch { stop(); setBusy(false); setError("This browser could not start the local worker. No configuration was uploaded."); }
  }
  function showSource(line?: number) { setTab("Source"); setFilter("all"); setPage(line && result ? Math.floor(Math.max(0, result.lines.findIndex(l => l.line === line)) / pageSize) : 0); }
  function openExport(kind: "report" | "config") { setExportKind(kind); setExportApproved(false); }
  const displayed = result?.lines.filter(l => filter === "all" || l.status === filter) || [];
  const selected = result?.entities.find(e => e.id === selectedEntity);
  const relationships = result?.relationships.filter(r => r.from === selectedEntity) || [];

  return <div className={styles.lens} data-clarity-mask="true">
    <div className={styles.privacy}><LockKeyhole size={18} aria-hidden="true" /><span>Browser-local processing</span><span>No paid API</span><span>No configuration upload</span><span>Parser {LENS_VERSION}</span></div>
    <section className={styles.setup} aria-labelledby="lens-device">
      <div className={styles.sectionTitle}><span className={styles.step}>1</span><h2 id="lens-device">Choose your device</h2></div>
      <div className={styles.selectors}>
        <label>Vendor<select value={vendor} onChange={e => { const v = e.target.value as Vendor; setVendor(v); chooseProfile(profiles.find(p => p.vendor === v)!.id); }}><option value="cisco">Cisco</option><option value="fortinet">Fortinet</option></select></label>
        <label>Device family<select value={selection.profileId} onChange={e => chooseProfile(e.target.value)}>{profiles.filter(p => p.vendor === vendor).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
        <label>Operating system / train<select value={selection.version} onChange={e => changeSelection({ version: e.target.value })}>{[...profile.versions, "Other / unknown"].map(v => <option key={v}>{v}</option>)}</select></label>
        <label>Exact version / build (optional)<input maxLength={60} autoComplete="off" value={selection.build} onChange={e => changeSelection({ build: e.target.value })} placeholder="For example 17.9.4 or 7.4.7" /></label>
        <label>Export type<select value={selection.configType} onChange={e => changeSelection({ configType: e.target.value as Selection["configType"] })}><option value="unknown">Not sure</option><option value="running">Running configuration</option><option value="saved">Saved / startup configuration</option><option value="candidate">Candidate / proposed configuration</option></select></label>
      </div>
      <aside className={styles.scope}><ShieldCheck size={22} aria-hidden="true" /><div><strong>{profile.os}: supported scope</strong><p>{profile.scope}</p><a href={profile.source} target="_blank" rel="noreferrer">Official product documentation</a><span>Catalog reviewed {CATALOG_REVIEWED}. Listed trains are not upgrade recommendations.</span></div></aside>
    </section>
    <section className={styles.editorSection} aria-labelledby="lens-import">
      <div className={styles.sectionTitle}><span className={styles.step}>2</span><h2 id="lens-import">Add a text configuration</h2></div>
      <p>{profile.exportHint}</p>
      <div className={styles.toolbar}>
        <button type="button" onClick={() => fileInput.current?.click()}><Upload size={17} aria-hidden="true" /> Select file</button>
        <input ref={fileInput} type="file" aria-label="Configuration file" accept=".txt,.conf,.cfg,.config,.log" hidden onChange={e => { void loadFile(e.target.files?.[0]); }} />
        <button type="button" onClick={() => { invalidate(); setInput(samples[profile.id]); setAnnouncement("Synthetic teaching example loaded. It is not a deployable configuration."); }}><Play size={17} aria-hidden="true" /> Try an example</button>
        <button type="button" className={styles.iconButton} title="Clear configuration and results" aria-label="Clear configuration and results" onClick={clear}><Trash2 size={18} /></button>
      </div>
      <label className={styles.editorLabel}>Configuration<textarea value={input} onChange={e => { invalidate(); setInput(e.target.value); }} spellCheck={false} autoComplete="off" autoCorrect="off" autoCapitalize="off" rows={11} placeholder="Paste the authorized plain-text export here." /></label>
      <div className={styles.editorFooter}><p>Known secret formats and free-text comments are masked before explanation. Unknown secrets and identifiers may remain; review before sharing. Only analyze configurations you are authorized to use.</p><button type="button" className={styles.primary} onClick={analyze} disabled={busy || !input.trim()}><FileCode2 size={18} aria-hidden="true" />{busy ? "Analyzing locally..." : "Explain configuration"}</button>{busy && <button type="button" onClick={() => invalidate()}>Cancel</button>}</div>
      {error && <p className={styles.error} role="alert">{error}</p>}
      <p role="status" className={styles.status}>{announcement}</p>
    </section>
    {result && <section className={styles.results} aria-labelledby="lens-results">
      <div className={styles.resultTitle}><div><p className={styles.eyebrow}>YOUR CONFIGURATION, EXPLAINED</p><h2 ref={resultHeading} tabIndex={-1} id="lens-results">{profile.name} analysis</h2></div><div className={styles.toolbar}><button ref={exportButton} type="button" onClick={() => openExport("report")}><Download size={17} aria-hidden="true" /> Report</button><button type="button" onClick={() => openExport("config")}><Download size={17} aria-hidden="true" /> Masked text</button></div></div>
      <div className={styles.tabs} role="tablist" aria-label="Analysis views">{tabs.map((name, i) => <button key={name} id={`lens-tab-${i}`} role="tab" aria-selected={tab === name} aria-controls="lens-panel" tabIndex={tab === name ? 0 : -1} onClick={() => { setTab(name); setPage(0); }} onKeyDown={e => { let n = i; if (e.key === "ArrowRight") n = (i + 1) % tabs.length; else if (e.key === "ArrowLeft") n = (i + tabs.length - 1) % tabs.length; else if (e.key === "Home") n = 0; else if (e.key === "End") n = tabs.length - 1; else return; e.preventDefault(); setTab(tabs[n]); document.getElementById(`lens-tab-${n}`)?.focus(); }}>{name}</button>)}</div>
      <div id="lens-panel" role="tabpanel" aria-labelledby={`lens-tab-${tabs.indexOf(tab)}`} className={styles.panel}>
        {tab === "Overview" && <>
          <div className={styles.metrics}>{[[result.coverage.explained, "Explained statements"], [result.entities.length, "Declared objects"], [result.coverage.unknown, "Need review"], [result.maskedCount, "Masked lines"]].map(([value, label]) => <div key={label}><strong>{value}</strong><span>{label}</span></div>)}</div>
          <p className={styles.notice}>This is a configuration explanation, not a live network test or a security certification. {result.coverage.context} structural lines are identified separately; coverage counts are not an accuracy score.</p>
          <h3>What is declared</h3>
          <div className={styles.inventory}>{[...new Set(result.entities.map(e => e.kind))].map(kind => <div key={kind}><Network size={20} aria-hidden="true" /><strong>{result.entities.filter(e => e.kind === kind).length} {kind}{result.entities.filter(e => e.kind === kind).length === 1 ? "" : "s"}</strong><span>{result.entities.filter(e => e.kind === kind).map(e => e.name).join(", ")}</span></div>)}</div>
          {!result.entities.length && <p>No supported named objects were declared. Read the individual statements and review the unsupported lines.</p>}
          <h3>What needs checking</h3>{result.findings.slice(0, 4).map(f => <div className={styles.finding} key={f.title}><strong>{f.title}</strong><p>{f.explanation}</p></div>)}
        </>}
        {tab === "Diagram" && <>
          <h3>Configured relationships</h3><p>Arrows mean “references”, not packet direction, live traffic or physical cabling. Each view shows one declared object and all its parsed references.</p>
          <label>Object<select value={selectedEntity} onChange={e => setSelectedEntity(e.target.value)}>{result.entities.map(e => <option key={e.id} value={e.id}>{e.kind}: {e.name} ({e.scope})</option>)}</select></label>
          {selected ? <><div className={styles.graph} aria-label={`Configuration references for ${selected.name}`}>
            <div className={styles.graphRoot}><Router size={34} aria-hidden="true" /><span>{selected.kind}</span><strong>{selected.name}</strong><small>{selected.scope}</small><button type="button" onClick={() => showSource(selected.lines[0])}>Source L{selected.lines[0]}</button></div>
            <ArrowRight className={styles.graphArrow} size={30} aria-hidden="true" />
            <div className={styles.graphTargets}>{relationships.length ? relationships.map((r, i) => <div className={styles.graphTarget} key={`${r.line}-${i}`}><GitBranch size={20} aria-hidden="true" /><div><span>{r.kind} reference</span><strong>{r.target}</strong><small>{r.to ? "Declared in this export" : "Built-in, external or unresolved"}</small></div><button type="button" onClick={() => showSource(r.line)}>L{r.line}</button></div>) : <div className={styles.graphTarget}><BookOpen size={22} aria-hidden="true" /><p>No supported references were extracted for this object. Its settings are listed below; no connection is invented.</p></div>}</div>
          </div><h3>Declared settings</h3><div className={styles.settingList}>{selected.settings.map((s, i) => <div key={`${s.line}-${i}`}><button type="button" onClick={() => showSource(s.line)}>L{s.line}</button><strong>{s.key}</strong><span>{s.value}</span></div>)}</div></> : <p>No supported objects are available to draw.</p>}
        </>}
        {(tab === "Explanations" || tab === "Source") && <>
          <div className={styles.toolbar}><ListFilter size={18} aria-hidden="true" /><label>Statement filter<select value={filter} onChange={e => { setFilter(e.target.value); setPage(0); }}><option value="all">All statements</option><option value="explained">Explained</option><option value="unknown">Needs review</option><option value="context">Structure</option><option value="masked">Masked</option></select></label><span>{displayed.length} statements</span></div>
          {displayed.slice(page * pageSize, (page + 1) * pageSize).map(l => <article className={styles.line} key={l.line}><div className={styles.lineMeta}><span>L{l.line}</span><span className={l.status === "unknown" ? styles.reviewBadge : styles.badge}>{l.status === "unknown" ? "Needs review" : l.status}</span><span>{l.category}</span></div><code>{l.text}</code><small>{l.context}</small>{tab === "Explanations" && <p>{l.explanation}</p>}</article>)}
          {!displayed.length && <p>No statements in this filter.</p>}
          <nav className={styles.pagination} aria-label="Statement pages"><button type="button" aria-label="Previous statements" title="Previous statements" disabled={page === 0} onClick={() => setPage(p => p - 1)}><ChevronLeft size={18} /></button><span>Page {page + 1} of {Math.max(1, Math.ceil(displayed.length / pageSize))}</span><button type="button" aria-label="Next statements" title="Next statements" disabled={(page + 1) * pageSize >= displayed.length} onClick={() => setPage(p => p + 1)}><ChevronRight size={18} /></button></nav>
        </>}
        {tab === "Checks" && <>{result.findings.map(f => <article className={styles.finding} key={f.title}><span className={f.level === "review" ? styles.reviewBadge : styles.badge}>{f.level}</span><h3>{f.title}</h3><p>{f.explanation}</p>{f.lines.length > 0 && <button type="button" onClick={() => { showSource(f.lines[0]); }}>View first cited statement: L{f.lines[0]}</button>}</article>)}<a href={profile.source} target="_blank" rel="noreferrer">Verify against official {profile.os} documentation</a></>}
        {tab === "Glossary" && <dl className={styles.glossary}>{glossary.map(([term, meaning]) => <div key={term}><dt>{term}</dt><dd>{meaning}</dd></div>)}</dl>}
      </div>
      {exportKind && <div className={styles.exportPanel} role="region" aria-label="Export privacy review"><div className={styles.resultTitle}><h3>Review before download</h3><button type="button" className={styles.iconButton} aria-label="Close export review" title="Close export review" onClick={() => { setExportKind(null); exportButton.current?.focus(); }}><X size={18} /></button></div><p>The download contains the text below. IP addresses, object names and unrecognized secrets may remain. A masked export is not a restorable backup.</p><pre>{exportKind === "report" ? reportText(result) : result.maskedSource}</pre><label className={styles.checkbox}><input type="checkbox" checked={exportApproved} onChange={e => setExportApproved(e.target.checked)} />I reviewed this text and am authorized to download it.</label><button type="button" className={styles.primary} disabled={!exportApproved} onClick={() => { saveText(exportKind === "report" ? "qcs-config-lens-report.txt" : "qcs-config-masked.txt", exportKind === "report" ? reportText(result) : result.maskedSource); setExportKind(null); setAnnouncement("Download prepared locally. No configuration was sent to QCS."); }}><Check size={18} aria-hidden="true" />Download reviewed text</button></div>}
    </section>}
    {!result && <div className={styles.emptyGraphic} aria-hidden="true"><FileCode2 size={30} /><ArrowRight size={22} /><ShieldCheck size={30} /><ArrowRight size={22} /><Network size={30} /><ArrowDown size={22} /><BookOpen size={30} /></div>}
  </div>;
}
