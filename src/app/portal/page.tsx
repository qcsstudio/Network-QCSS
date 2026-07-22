import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Activity, FileText, LogOut, ShieldCheck, Target } from "lucide-react";
import { getVerifyGridPortalWorkspace, requireVerifyGridPortalSession } from "@/lib/verifygrid-portal-auth";

export const metadata: Metadata = { title: "VerifyGrid Client Workspace", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

function label(value: string) {
  return value.replace(/_/g, " ");
}

export default async function VerifyGridPortalPage() {
  const session = await requireVerifyGridPortalSession();
  const workspace = await getVerifyGridPortalWorkspace(session.workspaceId);
  return (
    <main className="portal-page">
      <header className="portal-header">
        <div className="portal-header-brand"><Image alt="QuantumCrafters Studio Pvt. Ltd." className="portal-brand-logo" height={72} priority src="/brand/quantumcrafters-logo.png" width={320} /><div><p className="eyebrow">QCS VerifyGrid client workspace</p><h1>{workspace.name}</h1><p>{session.email} | {label(session.role)}</p></div></div>
        <form action="/api/portal/logout" method="post"><button className="button secondary compact-button" type="submit"><LogOut aria-hidden="true" size={16} /> Sign out</button></form>
      </header>
      <section className="portal-summary">
        <div><ShieldCheck aria-hidden="true" size={21} /><span>Engagements</span><strong>{workspace.engagements.length}</strong></div>
        <div><Target aria-hidden="true" size={21} /><span>In-scope targets</span><strong>{workspace.engagements.reduce((sum, item) => sum + item.scopeTargets.filter((target) => target.inScope).length, 0)}</strong></div>
        <div><Activity aria-hidden="true" size={21} /><span>Open findings</span><strong>{workspace.engagements.reduce((sum, item) => sum + item.findings.filter((finding) => !["closed", "accepted_risk"].includes(finding.status)).length, 0)}</strong></div>
        <div><FileText aria-hidden="true" size={21} /><span>Final reports</span><strong>{workspace.engagements.reduce((sum, item) => sum + item.reports.length, 0)}</strong></div>
      </section>
      <section className="portal-engagements">
        {workspace.engagements.map((engagement) => (
          <article key={engagement.id}>
            <header><div><span>{engagement.reference}</span><h2>{engagement.title}</h2><p>{engagement.scopeSummary}</p></div><strong>{label(engagement.status)}</strong></header>
            <div className="portal-engagement-grid">
              <section><h3>Scope</h3>{engagement.scopeTargets.map((target) => <div className="portal-row" key={target.id}><span>{target.value}</span><small>{label(target.environment)} | {target.inScope ? "in scope" : "excluded"}</small></div>)}</section>
              <section><h3>Findings</h3>{engagement.findings.length ? engagement.findings.map((finding) => <div className={`portal-finding severity-${finding.severity}`} key={finding.id}><div><span>{finding.severity}</span><strong>{finding.title}</strong></div><small>{label(finding.status)}{finding.ownerName ? ` | ${finding.ownerName}` : ""}</small><p>{finding.businessImpact}</p></div>) : <p>No reportable findings.</p>}</section>
              <section><h3>Reports</h3>{engagement.reports.length ? engagement.reports.map((report) => <Link className="portal-report-link" href={`/portal/reports/${report.id}`} key={report.id}><span>{report.title}</span><small>{new Date(report.generatedAt).toLocaleString()}</small></Link>) : <p>No final reports.</p>}</section>
            </div>
          </article>
        ))}
        {!workspace.engagements.length ? <div className="content-empty-state">No client engagements are available in this workspace.</div> : null}
      </section>
    </main>
  );
}
