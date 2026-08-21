import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Activity, CalendarClock, FileCheck2, FileText, KeyRound, LogOut, ShieldCheck, Target, UserRoundCheck } from "lucide-react";
import { getVerifyGridPortalWorkspace, requireVerifyGridPortalSession } from "@/lib/verifygrid-portal-auth";
import { buildVerifyGridLifecycle, verifyGridLifecycleProgress } from "@/lib/verifygrid-operating-model";

export const metadata: Metadata = { title: "VerifyGrid Client Workspace", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

function label(value: string) {
  return value.replace(/_/g, " ");
}

function formatDate(value: Date | string | null) {
  if (!value) return "Not scheduled";
  return new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata" }).format(new Date(value));
}

function rolePurpose(role: string) {
  if (role === "client_owner") return "Accountable client owner for scope, authority, access, and remediation decisions.";
  if (role === "client_analyst") return "Client remediation collaborator with findings and retest visibility.";
  return "Read-only assurance access to approved scope, findings, and final reports.";
}

async function loadPortalSnapshot(workspaceId: string) {
  const workspace = await getVerifyGridPortalWorkspace(workspaceId);
  return { evaluatedAt: Date.now(), workspace };
}

export default async function VerifyGridPortalPage() {
  const session = await requireVerifyGridPortalSession();
  const { evaluatedAt, workspace } = await loadPortalSnapshot(session.workspaceId);
  return (
    <main className="portal-page">
      <header className="portal-header">
        <div className="portal-header-brand"><Image alt="QuantumCrafters Studio Pvt. Ltd." className="portal-brand-logo" height={72} priority src="/brand/quantumcrafters-logo.png" width={320} /><div><p className="eyebrow">QCS VerifyGrid client assurance</p><h1>{workspace.name}</h1><p>{session.email} | {label(session.role)}</p></div></div>
        <form action="/api/portal/logout" method="post"><button className="button secondary compact-button" type="submit"><LogOut aria-hidden="true" size={16} /> Sign out</button></form>
      </header>

      <section className="portal-access-context" aria-label="Portal access context">
        <div><KeyRound aria-hidden="true" size={18} /><span>Access</span><strong>Email-link session</strong></div>
        <div><ShieldCheck aria-hidden="true" size={18} /><span>Boundary</span><strong>One client workspace</strong></div>
        <div><UserRoundCheck aria-hidden="true" size={18} /><span>Your role</span><strong>{label(session.role)}</strong></div>
        <p>{rolePurpose(session.role)} Portal access provides visibility; it never authorizes QCS to test a target.</p>
      </section>

      <section className="portal-summary">
        <div><ShieldCheck aria-hidden="true" size={21} /><span>Engagements</span><strong>{workspace.engagements.length}</strong></div>
        <div><Target aria-hidden="true" size={21} /><span>In-scope targets</span><strong>{workspace.engagements.reduce((sum, item) => sum + item.scopeTargets.filter((target) => target.inScope).length, 0)}</strong></div>
        <div><Activity aria-hidden="true" size={21} /><span>Open findings</span><strong>{workspace.engagements.reduce((sum, item) => sum + item.findings.filter((finding) => !["closed", "accepted_risk"].includes(finding.status)).length, 0)}</strong></div>
        <div><FileText aria-hidden="true" size={21} /><span>Signed reports</span><strong>{workspace.engagements.reduce((sum, item) => sum + item.reports.length, 0)}</strong></div>
      </section>

      <section className="portal-engagements">
        {workspace.engagements.map((engagement) => {
          const authorization = engagement.authorizations[0] || null;
          const authorityCurrent = Boolean(authorization?.authorityConfirmed && authorization.validFrom.getTime() <= evaluatedAt && authorization.validUntil.getTime() >= evaluatedAt);
          const lifecycle = buildVerifyGridLifecycle({
            ...engagement,
            gate: {
              executable: authorityCurrent && engagement.scopeTargets.filter((target) => target.inScope).every((target) => target.ownershipConfirmed),
              blockers: authorityCurrent ? [] : [authorization ? "The recorded authorization window is not current." : "Current written authorization has not been recorded."],
              authorization: authorization ? { validUntil: authorization.validUntil.toISOString() } : null
            },
            findings: engagement.findings.map((finding) => ({ ...finding, latestRetest: finding.retests[0] || null })),
            reports: engagement.reports.map((report) => ({ ...report, status: "final" }))
          });
          const progress = verifyGridLifecycleProgress(lifecycle);
          const nextStep = lifecycle.find((step) => step.state !== "complete");
          return (
            <article key={engagement.id}>
              <header><div><span>{engagement.reference}</span><h2>{engagement.title}</h2><p>{engagement.scopeSummary}</p></div><div className="portal-engagement-state"><strong>{label(engagement.status)}</strong><em>{progress}% evidenced</em></div></header>

              <section className="portal-lifecycle" aria-label={`${engagement.reference} assurance lifecycle`}>
                {lifecycle.map((step) => <div className={`state-${step.state}`} key={step.key}><span>{step.number}</span><strong>{step.label}</strong><small>{step.owner}</small></div>)}
              </section>

              <section className="portal-next-action">
                <div><p className="eyebrow">Current coordination point</p><h3>{nextStep ? nextStep.label : "Assurance cycle complete"}</h3><p>{nextStep?.summary || "The signed assurance record is available for review."}</p></div>
                <dl>
                  <div><dt><CalendarClock aria-hidden="true" size={15} /> Window</dt><dd>{authorization ? `${formatDate(authorization.validFrom)} to ${formatDate(authorization.validUntil)}` : "Awaiting authority"}</dd></div>
                  <div><dt><UserRoundCheck aria-hidden="true" size={15} /> Emergency owner</dt><dd>{engagement.emergencyContactName}</dd></div>
                  <div><dt><FileCheck2 aria-hidden="true" size={15} /> Authority</dt><dd>{authorization ? `${authorization.approvedByName}${authorization.approvedByTitle ? `, ${authorization.approvedByTitle}` : ""}` : "Not recorded"}</dd></div>
                </dl>
              </section>

              <div className="portal-engagement-grid">
                <section><h3>Authorized boundary</h3><p>Targets outside this list remain prohibited. A scope change invalidates the existing authority record.</p>{engagement.scopeTargets.map((target) => <div className="portal-row" key={target.id}><span>{target.value}</span><small>{label(target.environment)} | {target.inScope ? `${label(target.permission)} | in scope` : "excluded"}</small></div>)}</section>
                <section><h3>Risk and remediation</h3><p>Validated findings remain open until an owner, fix evidence, and retest outcome are recorded.</p>{engagement.findings.length ? engagement.findings.map((finding) => <div className={`portal-finding severity-${finding.severity}`} key={finding.id}><div><span>{finding.severity}</span><strong>{finding.title}</strong></div><small>{label(finding.status)}{finding.ownerName ? ` | ${finding.ownerName}` : " | owner required"}</small><p>{finding.businessImpact}</p></div>) : <p>No reportable findings.</p>}</section>
                <section><h3>Released proof</h3><p>Only independently reviewed, signed final snapshots appear in this workspace.</p>{engagement.reports.length ? engagement.reports.map((report) => <Link className="portal-report-link" href={`/portal/reports/${report.id}`} key={report.id}><span>{report.title}</span><small>{label(report.reportType)} v{report.version} | {formatDate(report.generatedAt)}</small></Link>) : <p>No signed report has been released.</p>}</section>
              </div>
            </article>
          );
        })}
        {!workspace.engagements.length ? <div className="content-empty-state">No client engagements are available in this workspace.</div> : null}
      </section>
    </main>
  );
}
