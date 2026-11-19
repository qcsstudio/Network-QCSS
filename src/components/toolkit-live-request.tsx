import { useState } from "react";
import { Download, FileUp, Terminal } from "lucide-react";
import { createDiagnosticRequest, diagnosticNames, diagnosticMeanings, diagnosticOperations, diagnosticRequestDiagram, type DiagnosticOperation, type DiagnosticRequest } from "@/lib/toolkit/local-diagnostics";
import { ToolkitEvidenceDiagram } from "./toolkit-evidence-diagram";
import styles from "./network-toolkit.module.css";

const defaults = { count: "4", timeoutMs: "1000", packetBytes: "32", maxHops: "12", port: "443", recordType: "A", serverName: "" };
const numericFields: Record<string, { label: string; meaning: string; min: number; max: number }> = {
  count: { label: "Echo requests", meaning: "Number of ICMP requests, from 1 to 10. More requests take longer; this is not a load test.", min: 1, max: 10 },
  timeoutMs: { label: "Timeout (ms)", meaning: "Maximum wait per reply or connection attempt, 100-5000 milliseconds. The complete runner also has a 60-second ceiling.", min: 100, max: 5000 },
  packetBytes: { label: "ICMP payload (bytes)", meaning: "Data carried inside the ICMP request, excluding IP and ICMP headers. This does not automatically discover path MTU.", min: 0, max: 1400 },
  maxHops: { label: "Maximum hops", meaning: "Farthest hop number to try, from 1 to 20. A missing hop reply does not prove a forwarding failure.", min: 1, max: 20 },
  port: { label: "Destination TCP port", meaning: "One service port, 1-65535. No port range or scan is supported. The default 443 is commonly used for HTTPS.", min: 1, max: 65535 },
};

export function ToolkitLiveRequest({ initialOperation, onChange, onImport, busy }: { initialOperation: DiagnosticOperation; onChange: () => void; onImport: (file: File) => void; busy: boolean }) {
  const [operation, setOperation] = useState(initialOperation), [target, setTarget] = useState(""), [values, setValues] = useState<Record<string, string>>(defaults);
  const [authorized, setAuthorized] = useState(false), [request, setRequest] = useState<DiagnosticRequest | null>(null), [error, setError] = useState("");
  function changed() { onChange(); setRequest(null); setAuthorized(false); setError(""); }
  function build() { try { setRequest(createDiagnosticRequest(operation, target, values)); setError(""); } catch (error) { setError(error instanceof Error ? error.message : "Check the request parameters."); } }
  function download() {
    if (!authorized || !request) return;
    const url = URL.createObjectURL(new Blob([JSON.stringify(request, null, 2)], { type: "application/json" }));
    const anchor = document.createElement("a"); anchor.href = url; anchor.download = "qcs-diagnostic-request.json"; anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  const fields = operation === "ping" ? ["count", "timeoutMs", "packetBytes"] : operation === "traceroute" ? ["maxHops", "timeoutMs"] : operation === "dns" ? ["timeoutMs"] : ["port", "timeoutMs"];
  return <section className={styles.localRunner} aria-label="Local live diagnostics">
    <h3>Local live diagnostics</h3><p>Check one authorized host from your computer with the QCS Diagnostics Runner. You review and run each request yourself; no device password is needed. Requires Node.js 22 or later. Test traffic comes from your computer and results are saved locally.</p>
    <form onSubmit={event => { event.preventDefault(); build(); }}>
      <div className={styles.fields}>
        <label>Diagnostic<select value={operation} onChange={event => { changed(); setOperation(event.target.value as DiagnosticOperation); }} aria-describedby="diagnostic-meaning">{diagnosticOperations.map(id => <option key={id} value={id}>{diagnosticNames[id]}</option>)}</select><small id="diagnostic-meaning">{diagnosticMeanings[operation]}</small></label>
        <label>Target IP address or hostname<input autoComplete="off" autoCapitalize="off" spellCheck={false} value={target} onChange={event => { changed(); setTarget(event.target.value); }} aria-describedby="target-meaning" /><small id="target-meaning">A single authorized host, not a URL or range. Local and private addresses are allowed. Never enter a password.</small></label>
        {fields.map(key => <label key={key}>{numericFields[key].label}<input type="number" min={numericFields[key].min} max={numericFields[key].max} step="1" value={values[key]} aria-describedby={`runner-${key}-meaning`} onChange={event => { changed(); setValues(current => ({ ...current, [key]: event.target.value })); }} /><small id={`runner-${key}-meaning`}>{key === "timeoutMs" && ["dns", "tcp", "tls"].includes(operation) ? "Whole-operation budget of 100-5000 milliseconds, including DNS resolution and the query or handshake. Missing measurements are not treated as zero." : numericFields[key].meaning}</small></label>)}
        {operation === "dns" && <label>DNS record type<select value={values.recordType} onChange={event => { changed(); setValues(current => ({ ...current, recordType: event.target.value })); }}>{["A", "AAAA", "MX", "TXT", "NS", "CNAME", "SOA"].map(value => <option key={value}>{value}</option>)}</select><small>A: IPv4; AAAA: IPv6; MX: mail server; TXT: text; NS: name server; CNAME: alias; SOA: zone authority. Uses your computer&apos;s DNS resolver.</small></label>}
        {operation === "tls" && <label>TLS server name (optional)<input autoComplete="off" autoCapitalize="off" spellCheck={false} value={values.serverName} onChange={event => { changed(); setValues(current => ({ ...current, serverName: event.target.value })); }} /><small>The intended DNS name for SNI and certificate identity verification. Useful when connecting to an IP. Never disables certificate verification.</small></label>}
      </div>
      <div className={styles.run}><button type="submit"><Terminal size={18} />Review test request</button><p>Preparing a request sends no packets. Ping and route trace require Windows in this first runner; other tests use Node.js networking.</p></div>
    </form>
    {error && <p role="alert" className={styles.error}>{error}</p>}
    {request && <>
      <ToolkitEvidenceDiagram visual={diagnosticRequestDiagram(request)} />
      <dl className={styles.requestSummary}>{Object.entries(request.parameters).map(([key, value]) => <div key={key}><dt>{key}</dt><dd>{value}</dd></div>)}</dl>
      <label className={styles.checkbox}><input type="checkbox" checked={authorized} onChange={event => setAuthorized(event.target.checked)} />I am authorized to test this target and have reviewed the operation and parameters.</label>
      <div className={styles.actions}><button type="button" disabled={!authorized} onClick={download}><Download size={17} />Download test request</button><a href="/downloads/qcs-local-diagnostics.mjs" download="qcs-local-diagnostics.mjs">Download local runner</a><a href="/downloads/qcs-local-diagnostics-README.txt" target="_blank" rel="noreferrer">Runner instructions and limits</a></div>
      <pre className={styles.runnerCommand}>{`node qcs-local-diagnostics.mjs --request qcs-diagnostic-request.json --confirm-target ${request.target} --out qcs-diagnostic-result.json`}</pre>
      <p className={styles.small}>Run in a terminal from the download folder after reviewing the files. Nothing installs or runs automatically. Result files may contain internal addresses or DNS data; review before sharing.</p>
    </>}
    <label className={styles.reportImport}><span><FileUp size={18} aria-hidden="true" />Import a local runner report (optional)</span><input type="file" accept=".json" disabled={busy} onChange={event => { const file = event.target.files?.[0]; event.target.value = ""; if (file) onImport(file); }} /><small>Only QCS runner JSON, up to 256 KiB. An imported file is user-supplied evidence, not independently authenticated.</small></label>
    <details className={styles.runnerSources}><summary>Technical references</summary><a href="https://learn.microsoft.com/en-us/windows-server/administration/windows-commands/ping" target="_blank" rel="noreferrer">Microsoft: ping</a><a href="https://learn.microsoft.com/en-us/windows-server/administration/windows-commands/tracert" target="_blank" rel="noreferrer">Microsoft: tracert</a><a href="https://nodejs.org/api/dns.html" target="_blank" rel="noreferrer">Node.js: DNS</a><a href="https://nodejs.org/api/net.html" target="_blank" rel="noreferrer">Node.js: TCP connections</a><a href="https://nodejs.org/api/tls.html" target="_blank" rel="noreferrer">Node.js: TLS verification</a></details>
  </section>;
}
