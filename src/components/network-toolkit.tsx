"use client";
/* eslint-disable @next/next/no-html-link-for-pages -- Native navigation creates the private document/CSP boundary before diagnostic input. */

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { Activity, ArrowRight, BookOpen, Calculator, ChevronLeft, ChevronRight, Download, FileCode2, FileUp, Gauge, GitBranch, Globe2, KeyRound, LockKeyhole, Logs, Network, Play, Radar, ScanLine, Search, ShieldCheck, Terminal, Trash2, X } from "lucide-react";
import type { ToolkitOperation, ToolkitOptions, ToolkitResult, WorkspaceId } from "@/lib/toolkit/types";
import reference from "@/lib/toolkit/reference.json";
import { ToolkitMotion } from "./toolkit-motion";
import { ToolkitEvidenceDiagram } from "./toolkit-evidence-diagram";
import { rawProfiles } from "@/lib/toolkit/raw-catalog";
import { initialParameterState, parameterForms } from "@/lib/toolkit/parameter-inputs";
import { ToolkitParameterForm, type ParameterState } from "./toolkit-parameter-form";
import { ToolkitLiveRequest } from "./toolkit-live-request";
import styles from "./network-toolkit.module.css";

const toolkitPath = "/network-tools/toolkit";
const initialFilters = { sourceIP: "", destinationIP: "", protocol: "udp", port: "53", direction: "both", ipFamily: "any" };
const parameterStateFor = (id: WorkspaceId) => parameterForms[id] ? initialParameterState(id) : { values: {}, rows: {} };
const plannerDescriptions: Partial<Record<WorkspaceId, string>> = {
  path: "Choose a target and bounded reachability or route-trace parameters. Measurements require the optional local runner; existing output can also be analyzed.",
  dns: "Choose a hostname and record type for a local DNS query. Existing resolver observations can also be imported for comparison.",
  tls: "Choose a host, port and certificate identity for a local TLS check. Existing certificate evidence remains optional.",
  exposure: "Plan one authorized TCP connection check. This is not a port scan or vulnerability assessment; existing Nmap evidence can be analyzed separately.",
  device: "Select the vendor and diagnostic context. Existing command output is optional; live device CLI collection remains under your control.",
};
const privatePath = () => `${toolkitPath}${new URLSearchParams(window.location.search).get("qcs_privacy") === "denied" ? "?qcs_privacy=denied" : ""}`;
const icons = [FileCode2, Terminal, ScanLine, Network, Gauge, Globe2, LockKeyhole, Network, GitBranch, ShieldCheck, KeyRound, Activity, Calculator, Logs, Radar];
const views = ["Workspace", "Results", "Parameters", "Learn", "Sources"] as const;
type View = typeof views[number];
type Descriptor = Omit<ToolkitOperation, "analyze">;
type Reply = { catalog?: Descriptor[]; result?: ToolkitResult; error?: string; progress?: string };
const subscribe = (notify: () => void) => { window.addEventListener("pageshow", notify); return () => window.removeEventListener("pageshow", notify); };
const documentReady = () => { const navigation = performance.getEntriesByType("navigation")[0]; return Boolean(navigation && new URL(navigation.name).pathname.replace(/\/$/, "") === toolkitPath); };

export function NetworkToolkit() {
  const ready = useSyncExternalStore(subscribe, documentReady, () => false);
  useEffect(() => { if (!documentReady() && performance.getEntriesByType("navigation").length) window.location.replace(privatePath()); }, []);
  if (!ready) return <p role="status">Opening the private workspace. <a href={toolkitPath}>Open QCS Toolkit</a></p>;
  return <LocalToolkit />;
}

function LocalToolkit() {
  const [catalog, setCatalog] = useState<Descriptor[]>([]), [workspace, setWorkspace] = useState<WorkspaceId>(() => { const id = typeof window === "undefined" ? "" : window.location.hash.slice(1); return reference.modules.some(item => item.id === id) ? id as WorkspaceId : "subnet"; }), [view, setView] = useState<View>("Workspace");
  const [navSearch, setNavSearch] = useState(""), [parameterSearch, setParameterSearch] = useState("");
  const [input, setInput] = useState(""), [file, setFile] = useState<File | null>(null), [options, setOptions] = useState<ToolkitOptions>({});
  const [result, setResult] = useState<ToolkitResult | null>(null), [example, setExample] = useState(false);
  const [busy, setBusy] = useState(false), [error, setError] = useState(""), [status, setStatus] = useState(""), [page, setPage] = useState(0);
  const [exporting, setExporting] = useState(false), [reviewed, setReviewed] = useState(false), [exportPage, setExportPage] = useState(0);
  const [filterFields, setFilterFields] = useState(initialFilters);
  const [inputMode, setInputMode] = useState<"parameters" | "output">("parameters"), [inputEpoch, setInputEpoch] = useState(0);
  const [origin, setOrigin] = useState<"parameters" | "output" | "runner">("parameters");
  const [parameterState, setParameterState] = useState<ParameterState>(() => parameterStateFor(workspace));
  const worker = useRef<Worker | null>(null), generation = useRef(0), picker = useRef<HTMLInputElement>(null), resultHeading = useRef<HTMLHeadingElement>(null);
  const workspaceDefinition = reference.modules.find(item => item.id === workspace)!;
  const operation = catalog.find(item => item.id === workspace);
  const selectedRaw = rawProfiles.find(item => item.id === options.profile) || rawProfiles[0];
  function stop() { generation.current++; worker.current?.terminate(); worker.current = null; }
  function invalidate() { stop(); setResult(null); setBusy(false); setError(""); setStatus(""); setExporting(false); setReviewed(false); setPage(0); }
  function clear() { invalidate(); setInput(""); setFile(null); setOptions(workspace === "device" ? { profile: selectedRaw.id } : {}); setFilterFields(initialFilters); setParameterState(parameterStateFor(workspace)); setExample(false); setInputEpoch(value => value + 1); if (picker.current) picker.current.value = ""; }
  function changeRawProfile(profile: string) { clear(); setOptions({ profile }); }
  useEffect(() => {
    let w: Worker | undefined;
    const failed = () => { setError("The local toolkit could not start. Reload this page or try another current browser. Your inputs have not been uploaded."); w?.terminate(); };
    try {
      w = new Worker(new URL("./network-toolkit.worker.ts", import.meta.url));
      w.onmessage = (event: MessageEvent<Reply>) => { if (event.data.catalog) { setCatalog(event.data.catalog); w?.terminate(); } };
      w.onerror = failed;
      w.postMessage({ kind: "catalog" });
    } catch { setTimeout(failed, 0); }
    const leave = () => { generation.current++; worker.current?.terminate(); };
    const restore = (event: PageTransitionEvent) => { if (event.persisted) window.location.reload(); };
    window.addEventListener("pagehide", leave); window.addEventListener("pageshow", restore);
    return () => { w?.terminate(); leave(); window.removeEventListener("pagehide", leave); window.removeEventListener("pageshow", restore); };
  }, []);
  function changeWorkspace(id: WorkspaceId) {
    clear(); setWorkspace(id); setView("Workspace"); setOptions({}); setParameterSearch(""); setInputMode("parameters"); setParameterState(parameterStateFor(id));
    // Only the public workspace identifier goes in the URL, never diagnostic input.
    history.replaceState(null, "", `${privatePath()}#${id}`);
  }
  function defaults() { return workspace === "device" ? { profile: selectedRaw.id } : Object.fromEntries((operation?.fields || []).map(field => [field.key, field.initial || ""])); }
  function analyze(filters = false, parameters?: ParameterState, runnerFile?: File) {
    if (!operation || (!filters && !parameters && !runnerFile && !file && !input.trim())) return;
    if (filters || parameters || runnerFile) setExample(false);
    setOrigin(runnerFile ? "runner" : parameters || filters ? "parameters" : "output");
    invalidate(); setBusy(true); const request = generation.current;
    try {
      const w = new Worker(new URL("./network-toolkit.worker.ts", import.meta.url)); worker.current = w;
      w.onmessage = (event: MessageEvent<Reply>) => {
        if (request !== generation.current) return;
        const reply = event.data;
        if (reply.progress) { setStatus(reply.progress); return; }
        w.terminate(); worker.current = null; setBusy(false); setStatus("");
        if (!reply.result) { setError(reply.error || "Local analysis failed. No data was uploaded."); return; }
        setResult(reply.result); setView("Results"); setStatus("Local analysis complete.");
        setTimeout(() => { resultHeading.current?.focus({ preventScroll: true }); document.getElementById("toolkit-panel")?.scrollIntoView({ block: "start", behavior: "instant" }); }, 0);
      };
      w.onerror = () => { if (request !== generation.current) return; stop(); setBusy(false); setStatus(""); setError("Analysis stopped in your browser. Check available memory and the supported input format, then try again. Your inputs have not been uploaded."); };
      if (runnerFile) w.postMessage({ kind: "runner", file: runnerFile });
      else if (parameters) w.postMessage({ kind: "parameters", id: workspace, values: parameters.values, rows: parameters.rows });
      else if (filters) {
        w.postMessage({ kind: "filters", filters: { protocol: filterFields.protocol, direction: filterFields.direction, ipFamily: filterFields.ipFamily, ...(filterFields.sourceIP.trim() ? { sourceIP: filterFields.sourceIP.trim() } : {}), ...(filterFields.destinationIP.trim() ? { destinationIP: filterFields.destinationIP.trim() } : {}), ...(filterFields.port.trim() ? { port: /^\d+$/.test(filterFields.port.trim()) ? Number(filterFields.port) : -1 } : {}) } });
      } else w.postMessage({ kind: "analyze", id: workspace, input: file ? "" : input, file: file || undefined, options: { ...defaults(), ...options } });
    } catch { stop(); setBusy(false); setStatus(""); setError("This browser could not start local analysis. Nothing was uploaded."); }
  }
  function pickFile(next?: File) {
    if (!next) return; invalidate(); setExample(false); setInput(""); setFile(null);
    if (picker.current) picker.current.value = "";
    if (!/\.(json|xml|txt|pem|crt|cer)$/i.test(next.name) || next.size > 20 * 1024 * 1024) { setError("Choose supported UTF-8 evidence up to 20 MiB (.json, .xml, .txt, .pem, .crt or .cer). Raw PCAP, archives, private keys and binary files are not accepted."); return; }
    setFile(next);
  }
  const parameters = useMemo(() => reference.parameters.filter(parameter => workspaceDefinition.parameterIds.includes(parameter.id)).filter(parameter => `${parameter.label} ${parameter.meaning}`.toLowerCase().includes(parameterSearch.toLowerCase())), [workspaceDefinition, parameterSearch]);
  const sourceIds = new Set([...workspaceDefinition.sourceIds, ...reference.parameters.filter(parameter => workspaceDefinition.parameterIds.includes(parameter.id)).flatMap(parameter => parameter.sourceIds), ...(result?.sourceIds || [])]);
  const rows = result?.rows.slice(page * 50, (page + 1) * 50) || [];
  const columns = [...new Set(rows.flatMap(row => Object.keys(row)))];
  const columnLabel = (column: string) => column.replace(/([a-z0-9])([A-Z])/g, "$1 $2").replace(/_/g, " ");
  const report = useMemo(() => result ? JSON.stringify({ application: "QCS Toolkit", referenceVersion: reference.version, workspace, inputOrigin: example ? "Synthetic teaching example" : origin === "parameters" ? "User-entered parameters; not a live measurement" : origin === "runner" ? "User-supplied local runner report; not independently authenticated" : "User-supplied evidence; not independently authenticated", result, privacy: "Known secret assignments are masked; identifiers and unrecognized secrets can remain. Review before sharing." }, null, 2) : "", [result, workspace, example, origin]);
  function download() {
    if (!reviewed || !report) return;
    const url = URL.createObjectURL(new Blob([report], { type: "application/json" }));
    const anchor = document.createElement("a"); anchor.href = url; anchor.download = `qcs-${workspace}-report.json`; anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000); setStatus("Reviewed report downloaded on this device.");
  }
  const motion = workspaceDefinition.motion as keyof typeof reference.stories | null;
  const inputLabel = workspace === "subnet" ? "CIDR ranges (one per line)" : operation?.inputLabel;
  return <div className={styles.toolkit} data-clarity-mask="true">
    <div className={styles.privacy}><LockKeyhole size={17} aria-hidden="true" /><span>Processed on your device</span><span>No input upload</span><span>No saved input history</span></div>
    <div className={styles.layout}>
      <aside className={styles.sidebar}><label className={styles.search}><Search size={17} aria-hidden="true" /><span className={styles.srOnly}>Find a workspace</span><input type="search" value={navSearch} onChange={event => setNavSearch(event.target.value)} placeholder="Find a workspace" /></label><nav aria-label="Toolkit workspaces">{reference.modules.map((item, index) => ({ ...item, Icon: icons[index] })).filter(item => item.name.toLowerCase().includes(navSearch.toLowerCase())).map(({ id, name, Icon }) => <button type="button" key={id} aria-current={id === workspace ? "page" : undefined} onClick={() => changeWorkspace(id as WorkspaceId)}><Icon size={18} aria-hidden="true" />{name}</button>)}</nav><p className={styles.small}>Technical references are available in each workspace.</p></aside>
      <div className={styles.workarea}>
        <label className={styles.mobile}>Workspace<select value={workspace} onChange={event => changeWorkspace(event.target.value as WorkspaceId)}>{reference.modules.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
        <header className={styles.workspaceHeading}><div><h2>{workspaceDefinition.name}</h2><p>{inputMode === "parameters" && (parameterForms[workspace] || plannerDescriptions[workspace]) ? parameterForms[workspace]?.description || plannerDescriptions[workspace] : operation?.description || (workspace === "config" ? "Review supported Cisco and Fortinet configuration statements, categories and references." : "Loading local analysis modules...")}</p></div>{result && <button type="button" onClick={() => { setExporting(true); setReviewed(false); setExportPage(0); }}><Download size={17} />Export report</button>}</header>
        <div className={styles.tabs} role="tablist" aria-label="Toolkit views">{views.map((name, index) => <button type="button" key={name} role="tab" id={`toolkit-tab-${index}`} aria-selected={view === name} aria-controls="toolkit-panel" tabIndex={view === name ? 0 : -1} onClick={() => setView(name)} onKeyDown={event => { let next = index; if (event.key === "ArrowRight") next = (index + 1) % views.length; else if (event.key === "ArrowLeft") next = (index + views.length - 1) % views.length; else if (event.key === "Home") next = 0; else if (event.key === "End") next = views.length - 1; else return; event.preventDefault(); setView(views[next]); document.getElementById(`toolkit-tab-${next}`)?.focus(); }}>{name}</button>)}</div>
        {error && <p className={styles.error} role="alert">{error}</p>}
        <p className={styles.status} role="status">{status}</p>
        <div id="toolkit-panel" role="tabpanel" aria-labelledby={`toolkit-tab-${views.indexOf(view)}`}>
          {view === "Workspace" && (workspace === "config" ? <section className={styles.configEntry}><FileCode2 size={42} aria-hidden="true" /><h3>Network Configuration Analyzer</h3><p>Choose the vendor, device family and OS train, then import an authorized text configuration. Known secret formats are masked locally; unsupported commands remain marked for review.</p><a className={styles.linkButton} href="/network-tools/network-configuration-explainer">Open Configuration Analyzer<ArrowRight size={17} /></a><a href="/network-tools/strong-password-generator">Local password generator</a></section> : operation ? <>
            <div className={styles.inputModes} role="group" aria-label="Input mode"><button type="button" aria-pressed={inputMode === "parameters"} onClick={() => { invalidate(); setInputMode("parameters"); }}><Calculator size={17} />Enter parameters</button><button type="button" aria-pressed={inputMode === "output"} onClick={() => { invalidate(); setInputMode("output"); }}><FileUp size={17} />Analyze output (optional)</button></div>
            {workspace === "device" && <div className={styles.rawProfile}><div className={styles.fields}>
              <label>Device family<select value={selectedRaw.vendor} onChange={event => changeRawProfile(rawProfiles.find(item => item.vendor === event.target.value)!.id)}><option value="cisco">Cisco IOS / IOS XE</option><option value="fortigate">FortiGate / FortiOS</option></select></label>
              <label>Command output<select value={selectedRaw.id} onChange={event => changeRawProfile(event.target.value)}>{rawProfiles.filter(item => item.vendor === selectedRaw.vendor).map(item => <option key={item.id} value={item.id}>{item.command}</option>)}</select></label>
            </div><p>{selectedRaw.scope}</p></div>}
            {inputMode === "parameters" ? <>
              {parameterForms[workspace] && <ToolkitParameterForm key={`${workspace}-${inputEpoch}`} form={parameterForms[workspace]!} state={parameterState} busy={busy} onChange={next => { invalidate(); setParameterState(next); }} onSubmit={state => analyze(false, state)} onCancel={invalidate} />}
              {workspace === "device" && <section className={styles.commandPlan}><h3>Device collection context</h3><pre>{selectedRaw.command}</pre><p>{selectedRaw.scope} Select the device and command above to identify the supported snapshot. No device connection, command execution or credentials are requested here.</p><p>For live CLI diagnostics, use your approved device access procedure and vendor instructions. Debug commands can affect performance or logging; obtain authorization and define cleanup before enabling them.</p><button type="button" onClick={() => { invalidate(); setInputMode("output"); }}><FileUp size={17} />Analyze a collected snapshot</button></section>}
              {!parameterForms[workspace] && workspace === "logs" && <p>Event findings require real log evidence. No events or failures are inferred from a target address. Output analysis remains optional.</p>}
              {parameterForms[workspace] || workspace === "device" || workspace === "logs" ? <details className={styles.optionalRunner}><summary>Optional live diagnostics from your computer</summary><ToolkitLiveRequest key={`${workspace}-${inputEpoch}`} initialOperation="tcp" onChange={invalidate} busy={busy} onImport={next => analyze(false, undefined, next)} /></details> : <ToolkitLiveRequest key={`${workspace}-${inputEpoch}`} initialOperation={workspace === "dns" ? "dns" : workspace === "tls" ? "tls" : workspace === "exposure" ? "tcp" : "ping"} onChange={invalidate} busy={busy} onImport={next => analyze(false, undefined, next)} />}
            </> : <>
            <div className={styles.actions}><button type="button" onClick={() => picker.current?.click()}><FileUp size={17} />Select evidence file</button><button type="button" onClick={() => { clear(); setInput(workspace === "device" ? selectedRaw.sample : workspace === "subnet" ? (JSON.parse(operation.sample) as { prefixes: string[] }).prefixes.join("\n") : operation.sample); setOptions(defaults()); setExample(true); }}><Play size={17} />Load example</button><button type="button" className={styles.icon} title="Clear input and results" aria-label="Clear input and results" onClick={clear}><Trash2 size={18} /></button><input ref={picker} type="file" aria-label="Evidence file" accept=".json,.xml,.txt,.pem,.crt,.cer" hidden onChange={event => pickFile(event.target.files?.[0])} /></div>
            <p className={styles.format}>{workspace === "subnet" ? "One IPv4 or IPv6 CIDR per line, up to 128 prefixes. JSON with a prefixes array is also accepted. Host bits are explicitly normalized; address counts are mathematical, not usable-host counts." : operation.format}</p>
            {example && <p className={styles.notice}>Synthetic example. These values are not observations of your network.</p>}
            {file ? <div className={styles.file}><FileCode2 size={22} /><span>{file.name}<small>{file.size.toLocaleString()} bytes, selected locally</small></span><button type="button" onClick={clear}><X size={17} />Remove</button></div> : <label className={styles.inputLabel}>{inputLabel}<textarea aria-label={inputLabel} value={input} onChange={event => { invalidate(); setInput(event.target.value); setExample(false); }} rows={10} spellCheck={false} autoComplete="off" autoCorrect="off" autoCapitalize="off" /></label>}
            {!!operation.fields.length && <div className={styles.fields}>{operation.fields.map(field => <label key={field.key}>{field.label}{field.type === "select" ? <select value={options[field.key] ?? field.initial ?? ""} onChange={event => { invalidate(); setOptions(current => ({ ...current, [field.key]: event.target.value })); }}>{field.options?.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select> : <input type={field.type || "text"} autoComplete="off" value={options[field.key] ?? field.initial ?? ""} onChange={event => { invalidate(); setOptions(current => ({ ...current, [field.key]: event.target.value })); }} />}<small>{field.meaning}</small></label>)}</div>}
            <div className={styles.run}><button type="button" className={styles.primary} disabled={busy || (!input.trim() && !file)} onClick={() => analyze()}><ScanLine size={18} />{busy ? "Analyzing locally..." : "Analyze locally"}</button>{busy && <button type="button" onClick={() => { invalidate(); setStatus("Analysis cancelled. Input remains on this device."); }}>Cancel analysis</button>}<p>Only import authorized evidence. Known secrets are masked in results; unknown secrets and identifiers may remain. No live probes or device changes are performed.</p></div>
            {workspace === "packet" && <section className={styles.filterBuilder}><h3>Capture filter builder</h3><p>Direction is relative to the supplied endpoints. Port matches either transport endpoint. No capture starts here.</p><div className={styles.fields}>{([['sourceIP','Source IP'],['destinationIP','Destination IP'],['port','TCP/UDP port']] as const).map(([key,label]) => <label key={key}>{label}<input autoComplete="off" value={filterFields[key]} onChange={event => { invalidate(); setFilterFields(current => ({ ...current, [key]: event.target.value })); }} /><small>{key === 'port' ? 'Optional, 0-65535. Leave blank for ICMP.' : 'Optional literal IPv4 or IPv6 address.'}</small></label>)}{([['protocol','Protocol',['any','tcp','udp','icmp','icmp6']],['direction','Endpoint direction',['forward','reverse','both']],['ipFamily','Address family',['any','ipv4','ipv6']]] as const).map(([key,label,values]) => <label key={key}>{label}<select value={filterFields[key]} onChange={event => { invalidate(); setFilterFields(current => ({ ...current, [key]: event.target.value })); }}>{values.map(value => <option key={value} value={value}>{value}</option>)}</select></label>)}</div><button type="button" disabled={busy} onClick={() => analyze(true)}><FileCode2 size={17} />Generate filters locally</button></section>}
            </>}
          </> : <p>Preparing the local workspace...</p>)}
          {view === "Results" && (result ? <>
            <div className={styles.evidence}><span>{example ? "Synthetic example" : origin === "parameters" ? "Entered parameters" : origin === "runner" ? "Imported runner report" : "Supplied evidence"}</span><span>{result.evidence === "imported" ? "Imported observation" : result.evidence === "simulated" ? "Simulation" : "Calculation"}</span><span>{origin === "runner" ? "No browser probe; report not authenticated" : "Not a live device test"}</span></div>
            <h3 ref={resultHeading} tabIndex={-1} className={styles.resultTitle}>{result.title}</h3><p>{result.summary}</p>
            {result.provenance && <p className={styles.format}><strong>Selected command:</strong> <code>{result.provenance.command}</code><br />{result.provenance.scope}</p>}
            <dl className={styles.metrics}>{result.metrics.map((metric, index) => <div key={`${metric.label}-${index}`}><dt>{metric.label}</dt><dd>{metric.value} {metric.unit && <span>{metric.unit}</span>}<p>{metric.meaning}</p></dd></div>)}</dl>
            {result.visual && <ToolkitEvidenceDiagram visual={result.visual} />}
            {!!rows.length && <><div className={styles.tableScroll} role="region" aria-label="Evidence table" tabIndex={0}><table><caption>Evidence details</caption><thead><tr>{columns.map(column => <th scope="col" key={column}>{columnLabel(column)}</th>)}</tr></thead><tbody>{rows.map((row, index) => <tr key={page * 50 + index}>{columns.map(column => <td key={column}>{row[column] ?? "Not supplied"}</td>)}</tr>)}</tbody></table></div><div className={styles.pagination}><button type="button" className={styles.icon} title="Previous evidence page" aria-label="Previous evidence page" disabled={!page} onClick={() => setPage(value => value - 1)}><ChevronLeft size={18} /></button><span>{page * 50 + 1}-{Math.min((page + 1) * 50, result.rows.length)} of {result.rows.length}</span><button type="button" className={styles.icon} title="Next evidence page" aria-label="Next evidence page" disabled={(page + 1) * 50 >= result.rows.length} onClick={() => setPage(value => value + 1)}><ChevronRight size={18} /></button></div></>}
            {result.findings.map((finding, index) => <section key={index} className={styles.finding}><span className={finding.level === "review" ? styles.review : styles.info}>{finding.level === "review" ? "Review" : "Context"}</span><h4>{finding.title}</h4><p>{finding.detail}</p></section>)}
            <section className={styles.limits}><h3>Interpretation limits</h3><ul>{result.caveats.map(caveat => <li key={caveat}>{caveat}</li>)}</ul></section>
          </> : <p className={styles.empty}>No analysis yet. Add evidence in the Workspace view.</p>)}
          {view === "Parameters" && <><label className={styles.parameterSearch}>Find a parameter<input type="search" value={parameterSearch} onChange={event => setParameterSearch(event.target.value)} placeholder="Name, meaning or acronym" /></label><dl className={styles.dictionary}>{parameters.map(parameter => <div key={parameter.id}><dt>{parameter.label}<span>{parameter.unit}</span></dt><dd><p>{parameter.meaning}</p><small>Example: {parameter.example}</small><details><summary>Interpretation limits and sources</summary><p>{parameter.caution}</p>{parameter.sourceIds.map(id => { const source = reference.sources.find(item => item.id === id); return source ? <a key={id} href={source.url} target="_blank" rel="noreferrer">{source.title}</a> : null; })}</details></dd></div>)}</dl>{!parameters.length && <p>No matching parameters.</p>}</>}
          {view === "Learn" && (motion ? <ToolkitMotion key={motion} kind={motion} /> : <section className={styles.learn}><BookOpen size={30} /><h3>Read the evidence in context</h3><ol><li>Confirm the input format, device context and collection time.</li><li>Compare each value with its unit and plain-English definition.</li><li>Separate configured settings, observed values and calculations.</li><li>Follow the interpretation limits and verify missing evidence before making changes.</li></ol><button type="button" onClick={() => setView("Parameters")}>Parameter reference<ArrowRight size={17} /></button></section>)}
          {view === "Sources" && <div className={styles.sources}><p>References explain protocol concepts. They do not certify the supplied evidence or every vendor release.</p>{reference.sources.filter(source => sourceIds.has(source.id)).map(source => <section key={source.id}><h3><a href={source.url} target="_blank" rel="noreferrer">{source.title}</a></h3><p>{source.scope}</p><small>{source.status} / checked {source.checked}</small></section>)}</div>}
        </div>
        {exporting && result && <section className={styles.export} aria-label="Review report before download"><div className={styles.workspaceHeading}><h3>Review export</h3><button type="button" className={styles.icon} title="Close export review" aria-label="Close export review" onClick={() => setExporting(false)}><X size={18} /></button></div><p>IP addresses, hostnames and unrecognized secrets can remain. Only result fields are included, not the original input.</p><pre>{report.slice(exportPage * 24000, (exportPage + 1) * 24000)}</pre><div className={styles.pagination}><button type="button" disabled={!exportPage} aria-label="Previous export page" onClick={() => setExportPage(value => value - 1)}><ChevronLeft size={18} /></button><span>Preview {exportPage + 1} of {Math.ceil(report.length / 24000)}</span><button type="button" disabled={(exportPage + 1) * 24000 >= report.length} aria-label="Next export page" onClick={() => setExportPage(value => value + 1)}><ChevronRight size={18} /></button></div><label className={styles.checkbox}><input type="checkbox" checked={reviewed} onChange={event => setReviewed(event.target.checked)} />I reviewed the complete report for sensitive values.</label><button type="button" className={styles.primary} disabled={!reviewed} onClick={download}><Download size={17} />Download reviewed report</button></section>}
      </div>
    </div>
  </div>;
}
