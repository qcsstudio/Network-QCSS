"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowRight, CheckCircle2, FileCode2, Files, FlaskConical, LockKeyhole, Play, ShieldCheck, Trash2, TriangleAlert, X } from "lucide-react";
import { getProfile, profiles, type Selection, type Vendor } from "@/lib/config-lens/catalog";
import { DEFAULT_INPUT_METADATA, INPUT_LIMITS, inspectConfiguration, validateFileSize, type InputMetadata, type IntakeResult } from "@/lib/config-lens/intake";
import { samples } from "@/lib/config-lens/samples";
import type { Analysis } from "@/lib/config-lens/engine";
import type { AnalyzerInput, ValidatedInputs } from "./config-analyzer-input.worker";
import styles from "./config-analyzer-intake.module.css";

type Props = { onInvalidate: () => void; onAnalyze: (analysis: Analysis, intake: IntakeResult, label: string) => void };
type Draft = AnalyzerInput & { file?: File };
const initialDraft = (): Draft => ({ input: "", selection: { profileId: "cisco-router", version: "IOS XE 17.x", build: "", configType: "unknown" }, metadata: { ...DEFAULT_INPUT_METADATA } });
const stateLabels = { ready: "Ready", limited: "Ready with limitations", blocked: "Blocked", preview: "Preview" };

function DraftFields({ document, index, compare, disabled, change }: { document: Draft; index: number; compare: boolean; disabled: boolean; change: (next: Draft) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const selection = document.selection, meta = document.metadata;
  const profile = getProfile(selection.profileId)!;
  const label = compare ? index === 0 ? "Before" : "After" : "Configuration";
  const select = (next: Partial<Selection>) => change({ ...document, selection: { ...selection, ...next } });
  const metadata = (next: Partial<InputMetadata>) => change({ ...document, metadata: { ...meta, ...next } });
  function example() {
    const input = samples[profile.id];
    const detected = inspectConfiguration(input, { ...selection, version: "Other / unknown", build: "" }, meta).detectedVersion;
    const version = profile.versions.find(version => { const train = version.match(/\d+(?:\.\d+)?/)?.[0]; return train && (detected.startsWith(`${train}.`) || detected.startsWith(`${train}(`)); }) || profile.versions[0];
    change({ ...document, input, file: undefined, selection: { ...selection, version, build: "", configType: "unknown" }, metadata: { ...meta, completeness: "unknown", defaults: "unknown" } });
  }
  return <fieldset className={styles.document} disabled={disabled}>
    <legend><FileCode2 size={18} aria-hidden="true" />{label}</legend>
    <div className={styles.fields}>
      <label>Operating system / train<select value={selection.version} onChange={e => select({ version: e.target.value })}>{[...profile.versions, "Other / unknown"].map(version => <option key={version}>{version}</option>)}</select></label>
      <label>Exact version / build<input value={selection.build} maxLength={60} autoComplete="off" placeholder={profile.vendor === "cisco" ? "For example 17.15.4" : "For example 7.6.4"} onChange={e => select({ build: e.target.value })} /></label>
      <label>Configuration state<select value={selection.configType} onChange={e => select({ configType: e.target.value as Selection["configType"] })}><option value="unknown">Unknown</option><option value="running">Running</option><option value="saved">Saved / startup</option><option value="candidate">Candidate</option></select></label>
      <label>Capture completeness<select value={meta.completeness} onChange={e => metadata({ completeness: e.target.value as InputMetadata["completeness"] })}><option value="unknown">Unknown</option><option value="entire">Entire export</option><option value="fragment">Section / fragment</option></select></label>
      <label>Administrative scope<select value={meta.scope} onChange={e => metadata({ scope: e.target.value as InputMetadata["scope"], scopeName: "" })}><option value="unknown">Unknown</option><option value="device">Whole device</option><option value="global">Global</option><option value="vdom">Named VDOM</option><option value="context">Single security context</option></select></label>
      {["vdom", "context"].includes(meta.scope) && <label>VDOM / context name<input value={meta.scopeName} maxLength={80} autoComplete="off" onChange={e => metadata({ scopeName: e.target.value })} /></label>}
      <label>Default visibility<select value={meta.defaults} onChange={e => metadata({ defaults: e.target.value as InputMetadata["defaults"] })}><option value="unknown">Unknown</option><option value="included">Defaults included</option><option value="omitted">Defaults omitted</option></select></label>
    </div>
    <div className={styles.fileActions}>
      <label className={styles.fileButton}>Select file<input ref={inputRef} type="file" aria-label={`${label} file`} accept=".txt,.cfg,.conf,.config,.log" onChange={e => { const file = e.target.files?.[0]; if (file) change({ ...document, input: "", file }); e.target.value = ""; }} /></label>
      <button type="button" onClick={example}><Play size={15} aria-hidden="true" />Try an example</button>
      {document.file && <button type="button" onClick={() => change({ ...document, file: undefined, input: "" })}><X size={15} aria-hidden="true" />Use pasted text</button>}
    </div>
    {document.file ? <div className={styles.fileSummary}><FileCode2 size={24} aria-hidden="true" /><div><strong>{document.file.name}</strong><span>{document.file.size.toLocaleString()} bytes · selected locally</span></div></div> : <label className={styles.editor}>Configuration<textarea value={document.input} rows={10} spellCheck={false} autoComplete="off" autoCapitalize="off" autoCorrect="off" placeholder="Paste an authorized plaintext configuration." onChange={e => change({ ...document, input: e.target.value, file: undefined })} /></label>}
    <p className={styles.hint}>{profile.exportHint}</p>
    {document.input === samples[profile.id] && <p className={styles.notice}>Synthetic teaching example. This is not a deployable configuration or production evidence.</p>}
  </fieldset>;
}

export function ConfigAnalyzerIntake({ onInvalidate, onAnalyze }: Props) {
  const [documents, setDocuments] = useState<Draft[]>(() => [initialDraft(), initialDraft()]);
  const [compare, setCompare] = useState(false), [busy, setBusy] = useState(false);
  const [validated, setValidated] = useState<ValidatedInputs | null>(null);
  const [error, setError] = useState(""), [status, setStatus] = useState("");
  const worker = useRef<Worker | null>(null), generation = useRef(0), timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const readyHeading = useRef<HTMLHeadingElement>(null);
  const profile = getProfile(documents[0].selection.profileId)!;
  const visible = compare ? documents : documents.slice(0, 1);
  function stop() { worker.current?.terminate(); worker.current = null; if (timer.current) clearTimeout(timer.current); timer.current = null; }
  function invalidate() { generation.current++; stop(); setBusy(false); setValidated(null); setError(""); setStatus(""); onInvalidate(); }
  function change(index: number, next: Draft) {
    invalidate();
    if (next.file) {
      try { validateFileSize(next.file.size); }
      catch (error) { setError(error instanceof Error ? error.message : "Invalid file size."); setDocuments(current => current.map((document, i) => i === index ? { ...next, file: undefined } : document)); return; }
    }
    setDocuments(current => current.map((document, i) => i === index ? next : document));
  }
  function chooseProfile(id: string) {
    invalidate(); const next = getProfile(id)!;
    setDocuments(current => current.map(document => ({ ...document, selection: { ...document.selection, profileId: id, version: next.versions[0], build: "" } })));
  }
  function sharedMetadata(next: Partial<InputMetadata>) { invalidate(); setDocuments(current => current.map(document => ({ ...document, metadata: { ...document.metadata, ...next } }))); }
  function clear() { invalidate(); setDocuments(current => current.map(document => ({ ...initialDraft(), selection: { ...document.selection, build: "" } }))); setCompare(false); setStatus("Configuration inputs and results cleared from this workspace."); }
  function explain(index: number) {
    if (!validated?.analyses[index]) return;
    const analysis = validated.analyses[index];
    setDocuments(current => current.map((document, i) => i === index && !document.file ? { ...document, input: analysis.maskedSource } : document));
    onAnalyze(analysis, validated.intakes[index], compare ? index === 0 ? "Before" : "After" : "Configuration");
  }
  useEffect(() => {
    const dispose = () => { generation.current++; worker.current?.terminate(); if (timer.current) clearTimeout(timer.current); };
    const restore = (event: PageTransitionEvent) => { if (event.persisted) window.location.reload(); };
    window.addEventListener("pagehide", dispose); window.addEventListener("pageshow", restore);
    return () => { dispose(); window.removeEventListener("pagehide", dispose); window.removeEventListener("pageshow", restore); };
  }, []);
  function validate() {
    invalidate(); setBusy(true); const request = generation.current;
    try {
      const next = new Worker(new URL("./config-analyzer-input.worker.ts", import.meta.url)); worker.current = next;
      next.onmessage = (event: MessageEvent<{ validated?: ValidatedInputs; error?: string; progress?: { index: number; phase: string; completed: number; total: number } }>) => {
        if (request !== generation.current) return;
        if (event.data.progress) { const progress = event.data.progress; setStatus(`${compare ? progress.index === 0 ? "Before: " : "After: " : ""}${progress.phase === "reading" ? "Reading locally" : progress.phase === "masking" ? "Masking known secrets" : progress.phase === "explaining" ? "Validating supported statements" : "Resolving references"}${progress.total ? ` · ${Math.round(progress.completed / progress.total * 100)}%` : ""}`); return; }
        stop(); setBusy(false);
        if (!event.data.validated) { setError(event.data.error || "Local validation could not finish."); setStatus("Input blocked. No security verdict was produced."); return; }
        setValidated(event.data.validated); setStatus("Input validation complete. Review scope and evidence limitations before opening the explanation.");
        setTimeout(() => readyHeading.current?.focus(), 0);
      };
      next.onerror = () => { if (request !== generation.current) return; stop(); setBusy(false); setError("Validation could not finish in this browser. No security verdict was produced."); setStatus(""); };
      timer.current = setTimeout(() => { if (request !== generation.current) return; generation.current++; stop(); setBusy(false); setError(`The ${compare ? "60" : "30"}-second processing limit was reached. Assessment interrupted; no final verdict was produced.`); setStatus(""); }, compare ? INPUT_LIMITS.compareMs : INPUT_LIMITS.analysisMs);
      next.postMessage({ inputs: visible });
    } catch { stop(); setBusy(false); setError("This browser could not start local validation. No input was sent to QCS."); }
  }
  return <div className={styles.intake} data-analyzer-intake data-clarity-mask="true">
    <div className={styles.privacy}><LockKeyhole size={17} aria-hidden="true" />On-device processing<span>Read-only</span><span>No configuration upload</span></div>
    <section className={styles.setup} aria-labelledby="analyzer-input-title">
      <div className={styles.heading}><div><span className={styles.eyebrow}>01 / CONFIGURATION INTAKE</span><h2 id="analyzer-input-title">Start with reliable evidence.</h2><p>Identify the device, declare the export scope and validate the text before interpreting its settings.</p></div><ShieldCheck size={44} aria-hidden="true" /></div>
      <div className={styles.mode} role="group" aria-label="Input workflow"><button type="button" aria-pressed={!compare} onClick={() => { invalidate(); setCompare(false); }}><FileCode2 size={17} aria-hidden="true" />Single configuration</button><button type="button" aria-pressed={compare} onClick={() => { invalidate(); setCompare(true); }}><Files size={17} aria-hidden="true" />Before / After</button></div>
      <div className={styles.shared}>
        <label>Vendor<select value={profile.vendor} onChange={e => chooseProfile(profiles.find(p => p.vendor === e.target.value as Vendor)!.id)}><option value="cisco">Cisco</option><option value="fortinet">Fortinet</option></select></label>
        <label>Device family<select value={profile.id} onChange={e => chooseProfile(e.target.value)}>{profiles.filter(p => p.vendor === profile.vendor).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
        <label>Device alias{compare ? " (same device on both sides)" : ""}<input maxLength={80} autoComplete="off" value={documents[0].metadata.deviceAlias} placeholder="For example branch-edge-01" onChange={e => sharedMetadata({ deviceAlias: e.target.value })} /></label>
        <label>Model<input maxLength={80} autoComplete="off" value={documents[0].metadata.model} placeholder="Exact hardware / virtual model" onChange={e => sharedMetadata({ model: e.target.value })} /></label>
        <label>Device purpose<select value={documents[0].metadata.purpose} onChange={e => sharedMetadata({ purpose: e.target.value as InputMetadata["purpose"] })}><option value="unknown">Unknown</option><option value="production">General production</option><option value="access">Access / endpoint-facing</option><option value="core">Core / distribution</option><option value="edge">Perimeter / edge</option><option value="monitor">Monitoring / learning</option></select></label>
      </div>
      <aside className={styles.scope}><ShieldCheck size={20} aria-hidden="true" /><div><strong>{profile.os} · declared coverage</strong><p>{profile.scope}</p><a href={profile.source} target="_blank" rel="noreferrer">Official product documentation</a></div></aside>
      <div className={`${styles.documents} ${compare ? styles.paired : ""}`}>{visible.map((document, index) => <DraftFields key={`${profile.id}-${index}`} document={document} index={index} compare={compare} disabled={busy} change={next => change(index, next)} />)}</div>
      <div className={styles.limits}><span>10 MiB per input</span><span>100,000 lines</span><span>64 KiB per line</span><span>UTF-8 / BOM-identified UTF-16</span></div>
      <div className={styles.actions}><button className={styles.primary} type="button" disabled={busy || visible.some(document => !document.file && !document.input.trim())} onClick={validate}><ShieldCheck size={18} aria-hidden="true" />{busy ? "Validating locally…" : "Validate configuration"}</button>{busy && <button type="button" onClick={() => { invalidate(); setStatus("Validation cancelled. Assessment incomplete; no verdict was produced."); }}>Cancel</button>}<button type="button" onClick={clear}><Trash2 size={17} aria-hidden="true" />Clear workspace</button></div>
      {error && <p className={styles.error} role="alert">{error}</p>}<p role="status" className={styles.status}>{status}</p>
    </section>
    {validated && <section className={styles.readiness} aria-labelledby="analyzer-readiness"><span className={styles.eyebrow}>02 / EVIDENCE READINESS</span><h2 id="analyzer-readiness" tabIndex={-1} ref={readyHeading}>Review before analysis.</h2><p>Readiness describes the input. It is separate from a device security result.</p>
      {validated.comparisonIssues.map(issue => <p className={issue.level === "blocked" ? styles.error : styles.notice} key={issue.code}>{issue.message}</p>)}
      <div className={styles.readinessCards}>{validated.intakes.map((intake, index) => <article key={index} className={styles.readinessCard}><div className={styles.cardTitle}><h3>{compare ? index === 0 ? "Before" : "After" : "Configuration"}</h3><span className={styles.badge} data-state={intake.state}>{intake.state === "ready" ? <CheckCircle2 size={16} /> : intake.state === "preview" ? <FlaskConical size={16} /> : <TriangleAlert size={16} />}{stateLabels[intake.state]}</span></div><dl><div><dt>Detected vendor</dt><dd>{intake.detectedVendor}</dd></div><div><dt>Header model</dt><dd>{intake.detectedModel || "Not detected"}</dd></div><div><dt>Declared model</dt><dd>{intake.metadata.model || "Not supplied"}</dd></div><div><dt>Text</dt><dd>{intake.bytes.toLocaleString()} bytes · {intake.physicalLines.toLocaleString()} physical lines</dd></div><div><dt>Encoding</dt><dd>{intake.encoding}</dd></div><div><dt>Detected version</dt><dd>{intake.detectedVersion || "Not detected"}</dd></div><div><dt>Declared version</dt><dd>{intake.declaredVersion || "Not supplied"}</dd></div><div><dt>Release coverage</dt><dd>{intake.support}</dd></div></dl><ul>{intake.issues.map(issue => <li key={issue.code}><strong>{issue.level === "blocked" ? "Blocked" : issue.level === "limited" ? "Limitation" : "Notice"}:</strong> {issue.message}{issue.lines.length > 0 && <span> Source lines: {issue.lines.join(", ")}.</span>}</li>)}</ul>{validated.analyses[index] && <button className={styles.primary} type="button" onClick={() => explain(index)}>Explain {compare ? index === 0 ? "Before" : "After" : "configuration"}<ArrowRight size={17} aria-hidden="true" /></button>}</article>)}</div>
      <p className={styles.notice}>A complete export can omit defaults. Missing settings remain unknown unless the supported version-specific semantics establish their meaning. Explanation coverage is not a baseline security Pass.</p>
    </section>}
  </div>;
}
