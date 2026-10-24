"use client";
import { useState } from "react";
import { Download, RefreshCw } from "lucide-react";
import { CATALOG_REVIEWED, LENS_VERSION, profiles } from "@/lib/config-lens/catalog";
import type { VendorUpdateReport } from "@/lib/config-lens/vendor-updates";
import styles from "./config-lens.module.css";

export function ConfigLensAdmin() {
  const [report, setReport] = useState<VendorUpdateReport | null>(null), [busy, setBusy] = useState(false), [message, setMessage] = useState("");
  const [changes, setChanges] = useState<string[]>([]);
  async function check() {
    setBusy(true); setMessage("");
    try {
      const response = await fetch("/api/admin/config-lens/updates", { method: "POST", credentials: "same-origin" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Vendor check failed.");
      const next = data.report as VendorUpdateReport;
      try {
        const saved = localStorage.getItem("qcs-config-lens-vendor-baseline-v1");
        const previous = saved ? JSON.parse(saved) as VendorUpdateReport : null;
        setChanges(next.sources.filter(s => s.fingerprint && previous?.sources.some(p => p.id === s.id && p.fingerprint && p.fingerprint !== s.fingerprint)).map(s => s.id));
        localStorage.setItem("qcs-config-lens-vendor-baseline-v1", JSON.stringify(next));
      } catch { setChanges([]); }
      setReport(next);
      setMessage(`${data.cached ? "Recent cached check" : "Check complete"}: ${next.sources.filter(s => s.status === "checked").length}/${next.sources.length} sources retrieved. Checked ${new Date(next.checkedAt).toLocaleString()}. Parser activation still requires review.`);
    } catch (error) { setMessage(error instanceof Error ? error.message : "Update check failed."); }
    finally { setBusy(false); }
  }
  function download() {
    if (!report) return;
    const url = URL.createObjectURL(new Blob([JSON.stringify(report, null, 2)], { type: "application/json" }));
    const a = document.createElement("a"); a.href = url; a.download = `qcs-config-lens-vendor-review-${report.checkedAt.slice(0, 10)}.json`; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return <div className={styles.admin}>
    <h1>Config Lens update desk</h1><p>Parser {LENS_VERSION}. Catalog reviewed {CATALOG_REVIEWED}. Public vendor documentation, firmware notices and security advisories only. No customer configuration, paid API or database is used here.</p>
    <div className={styles.toolbar}><button type="button" className={styles.primary} disabled={busy} onClick={() => void check()}><RefreshCw size={18} aria-hidden="true" />{busy ? "Checking official sources..." : "Check vendor updates"}</button><button type="button" disabled={!report} onClick={download}><Download size={18} aria-hidden="true" />Download review package</button></div>
    <p role="status">{message}</p>
    <section className={styles.notice}><h2>Review before activation</h2><p>A vendor update does not automatically change command meaning. Review release notes, affected-version tables and syntax; update the versioned catalog/parser locally, add regression fixtures, then test and deploy the reviewed change. Downloaded packages are evidence, not executable updates. This desk never downloads firmware or modifies devices.</p><p>Checks are deduplicated for 30 minutes per running server instance. The previous public-source report is saved in this admin browser only for comparison. No background polling is enabled.</p></section>
    <h2>Device-family repositories</h2><div className={styles.sources}>{profiles.map(p => <article key={p.id}><h3>{p.name} / {p.os}</h3><p>{p.scope}</p><p>{p.versions.join("; ")}</p><a href={p.source} target="_blank" rel="noreferrer">Official documentation</a></article>)}</div>
    {report && <section className={styles.sources} aria-label="Vendor source results"><h2>Source check results</h2>{report.sources.map(s => <article key={s.id}><span className={s.status === "checked" ? styles.badge : styles.reviewBadge}>{s.status}{changes.includes(s.id) ? " / changed since this browser's previous check" : ""}</span><h3>{s.vendor}: {s.kind}</h3><a href={s.url} target="_blank" rel="noreferrer">Open official source</a><p>{s.message}</p>{s.fingerprint && <small>SHA-256: {s.fingerprint}</small>}<ul>{s.items.map((item, i) => <li key={`${item.url}-${i}`}><a href={item.url} target="_blank" rel="noreferrer">{item.title}</a>{item.date && <span> / {item.date}</span>}</li>)}</ul></article>)}</section>}
  </div>;
}
