import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CheckCircle2, Download, Fingerprint, ShieldCheck, TriangleAlert, XCircle } from "lucide-react";
import { PrintReportButton } from "@/components/print-report-button";
import { requireAdmin } from "@/lib/admin-auth";
import { getVerifyGridReport } from "@/lib/verifygrid-pipeline";
import { requireVerifyGridOperator } from "@/lib/verifygrid-operator-auth";

export const metadata: Metadata = {
  title: "VerifyGrid Assurance Report",
  robots: { index: false, follow: false }
};

export const dynamic = "force-dynamic";

function record(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function list(value: unknown) {
  return Array.isArray(value) ? value.map(record) : [];
}

function text(value: unknown, fallback = "Not recorded") {
  return typeof value === "string" && value.trim() ? value : fallback;
}

function count(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function label(value: unknown) {
  return text(value).replace(/_/g, " ");
}

export default async function VerifyGridReportPage({ params }: { params: Promise<{ id: string }> }) {
  await requireVerifyGridOperator("view");
  await requireAdmin();
  const { id } = await params;
  const report = await getVerifyGridReport(id);
  if (!report) notFound();

  const snapshot = report.snapshot;
  const engagement = record(snapshot.engagement);
  const client = record(engagement.client);
  const summary = record(snapshot.summary);
  const scope = list(snapshot.scope);
  const findings = list(snapshot.findings);
  const evidenceSources = list(snapshot.evidenceSources);
  const executionRecords = list(snapshot.executionRecords);
  const methodology = list(snapshot.methodology);
  const qualityGate = record(report.qualityGate);
  const qualitySummary = record(qualityGate.summary);
  const qualityChecks = list(qualityGate.checks);

  return (
    <main className="verifygrid-report-page">
      <section className="verifygrid-report-toolbar">
        <Link className="button secondary compact-button" href="/admin#verifygrid"><ArrowLeft aria-hidden="true" size={17} /> Back to VerifyGrid</Link>
        <div className="content-action-row">
          <a className="button secondary compact-button" href={`/api/admin/verifygrid/reports/${report.id}`}><Download aria-hidden="true" size={17} /> JSON evidence</a>
          <PrintReportButton />
        </div>
      </section>

      <article className="verifygrid-report-document">
        <header className="verifygrid-report-cover">
          <div><p className="eyebrow">QCS VerifyGrid assurance</p><h1>{report.title}</h1><p>{text(client.name)} | {text(engagement.reference)} | {label(engagement.serviceType)}</p></div>
          <ShieldCheck aria-hidden="true" size={48} />
        </header>

        <section className="verifygrid-report-integrity">
          <div><span>Status</span><strong>{label(report.status)}</strong></div>
          <div><span>Generated</span><strong>{new Date(report.generatedAt).toLocaleString()}</strong></div>
          <div><span>Scope hash</span><strong>{report.scopeHash}</strong></div>
          <div><span>Snapshot SHA-256</span><strong>{report.snapshotSha256}</strong></div>
          <div><span>Report chain</span><strong>{text(report.chainHash)}</strong></div>
          <div><span>Signature</span><strong>{report.signature ? `${text(report.signatureAlgorithm)} | ${text(report.signingKeyId)}` : "Pending release"}</strong></div>
        </section>

        <section className="verifygrid-report-section">
          <div className="verifygrid-section-heading"><ShieldCheck aria-hidden="true" size={20} /><div><h2>Release quality gate</h2><p>{count(qualitySummary.passed)} passed | {count(qualitySummary.warnings)} warnings | {count(qualitySummary.failed)} failed | score {count(qualityGate.score)}</p></div></div>
          <div className="verifygrid-quality-grid">
            {qualityChecks.map((item, index) => <div className={`verifygrid-quality-check quality-${text(item.status)}`} key={`${text(item.code)}-${index}`}>{item.status === "pass" ? <CheckCircle2 aria-hidden="true" size={18} /> : item.status === "warning" ? <TriangleAlert aria-hidden="true" size={18} /> : <XCircle aria-hidden="true" size={18} />}<div><strong>{text(item.label)}</strong><span>{text(item.detail)}</span></div></div>)}
          </div>
        </section>

        <section className="verifygrid-report-section">
          <div className="verifygrid-section-heading"><Fingerprint aria-hidden="true" size={20} /><div><h2>Assurance summary</h2><p>Versioned state at report generation</p></div></div>
          <div className="verifygrid-report-metrics">
            <div><span>In-scope targets</span><strong>{count(summary.inScopeTargets)}</strong></div>
            <div><span>Findings</span><strong>{count(summary.findings)}</strong></div>
            <div><span>Critical / high</span><strong>{count(summary.critical)} / {count(summary.high)}</strong></div>
            <div><span>Known exploited</span><strong>{count(summary.knownExploited)}</strong></div>
            <div><span>Closed</span><strong>{count(summary.closed)}</strong></div>
            <div><span>Imported observations</span><strong>{count(summary.importedObservations)}</strong></div>
            <div><span>Methodology tests</span><strong>{count(summary.methodologyTests)}</strong></div>
            <div><span>Tests complete</span><strong>{count(summary.methodologyCompleted)}</strong></div>
            <div><span>Tests with findings</span><strong>{count(summary.methodologyWithFindings)}</strong></div>
          </div>
        </section>

        <section className="verifygrid-report-section">
          <h2>Scope and authority</h2>
          <p>{text(engagement.scopeSummary)}</p>
          <div className="verifygrid-report-table" role="table" aria-label="Engagement scope">
            <div className="verifygrid-report-row header" role="row"><span>Target</span><span>Environment</span><span>Permission</span><span>Disposition</span></div>
            {scope.map((target, index) => <div className="verifygrid-report-row" key={`${text(target.value)}-${index}`} role="row"><strong>{text(target.value)}</strong><span>{label(target.environment)}</span><span>{label(target.permission)}</span><span>{label(target.disposition)}</span></div>)}
          </div>
        </section>

        <section className="verifygrid-report-section">
          <h2>Methodology coverage</h2>
          <p>Service-specific test execution and analyst conclusions captured when this report was generated.</p>
          <div className="verifygrid-report-table" role="table" aria-label="Methodology coverage">
            <div className="verifygrid-report-row verifygrid-report-methodology-row header" role="row"><span>Test</span><span>Standard</span><span>Status</span><span>Result</span></div>
            {methodology.length ? methodology.map((testCase, index) => <div className="verifygrid-report-row verifygrid-report-methodology-row" key={`${text(testCase.code)}-${index}`} role="row"><strong>{text(testCase.code)}<small>{text(testCase.title)}</small></strong><span>{text(testCase.standardRef)}</span><span>{label(testCase.status)}</span><span>{text(testCase.resultSummary, "No conclusion recorded")}</span></div>) : <p className="verifygrid-report-empty">No methodology tests were present in this snapshot.</p>}
          </div>
        </section>

        <section className="verifygrid-report-section">
          <h2>Findings and remediation</h2>
          {findings.length ? findings.map((finding, index) => (
            <article className={`verifygrid-report-finding severity-${text(finding.severity, "informational")}`} key={`${text(finding.id)}-${index}`}>
              <div><span className={`severity-pill severity-${text(finding.severity, "informational")}`}>{label(finding.severity)}</span><span className="status-pill content-kind-pill">{label(finding.status)}</span>{finding.knownExploited === true ? <span className="status-pill content-status-deleted">known exploited</span> : null}</div>
              <h3>{text(finding.title)}</h3>
              <p><strong>Impact:</strong> {text(finding.businessImpact)}</p>
              <p><strong>Remediation:</strong> {text(finding.remediation)}</p>
              <p className="verifygrid-report-meta">Owner: {text(finding.ownerName, "Unassigned")} | CVE: {text(finding.advisoryExternalId, "None")} | Evidence: {count(finding.evidenceCount)}</p>
            </article>
          )) : <p>No reportable findings were present in this snapshot.</p>}
        </section>

        <section className="verifygrid-report-section verifygrid-report-columns">
          <div><h2>Evidence provenance</h2>{evidenceSources.length ? evidenceSources.map((source, index) => <div className="verifygrid-report-record" key={`${text(source.contentSha256)}-${index}`}><strong>{label(source.connector)}</strong><span>{count(source.observations)} observations | {count(source.inScope)} in scope</span><small>{text(source.contentSha256)}</small></div>) : <p>No scanner batches recorded.</p>}</div>
          <div><h2>Execution records</h2>{executionRecords.length ? executionRecords.map((job, index) => <div className="verifygrid-report-record" key={`${text(job.manifestSha256)}-${index}`}><strong>{label(job.capability)}</strong><span>{label(job.status)} | {label(job.capabilityLevel)}</span><small>{text(job.manifestSha256)}</small></div>) : <p>No governed execution records prepared.</p>}</div>
        </section>
      </article>
    </main>
  );
}
