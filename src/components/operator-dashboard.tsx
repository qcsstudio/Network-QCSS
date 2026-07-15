import type { DashboardSnapshot } from "@/lib/types";

export function OperatorDashboard({ snapshot }: { snapshot: DashboardSnapshot }) {
  const pipelineEntries = Object.entries(snapshot.byPipeline).sort((a, b) => b[1] - a[1]);
  const readiness = snapshot.readiness;
  const funnelSteps = [
    { label: "Known sessions", value: snapshot.funnel.sessions, note: "Consent and conversion sessions" },
    { label: "Utility runs", value: snapshot.funnel.toolRuns, note: "DNS, SSL, header, email, port" },
    { label: "Assessments", value: snapshot.funnel.assessments, note: "Risk and readiness tools" },
    { label: "Resources", value: snapshot.funnel.resources, note: "Lead magnet downloads" },
    { label: "Leads", value: snapshot.funnel.leads, note: `${snapshot.funnel.leadConversionRate}% session-to-lead` },
    { label: "Hot leads", value: snapshot.funnel.hotLeads, note: "Highest sales priority" }
  ];

  return (
    <div className="admin-stack">
      <div className="metric-grid">
        <article className="metric-card">
          <p>Total leads</p>
          <strong>{snapshot.totals.leads}</strong>
          <span>Captured inquiries</span>
        </article>
        <article className="metric-card">
          <p>Hot leads</p>
          <strong>{snapshot.totals.hotLeads}</strong>
          <span>Score 80+</span>
        </article>
        <article className="metric-card">
          <p>Assessments</p>
          <strong>{snapshot.totals.assessments}</strong>
          <span>Tool completions</span>
        </article>
        <article className="metric-card">
          <p>Utility runs</p>
          <strong>{snapshot.totals.toolRuns}</strong>
          <span>SEO tool usage</span>
        </article>
        <article className="metric-card">
          <p>Events</p>
          <strong>{snapshot.totals.events}</strong>
          <span>Consent-aware events</span>
        </article>
        <article className="metric-card">
          <p>Audit logs</p>
          <strong>{snapshot.totals.auditLogs}</strong>
          <span>Admin and system actions</span>
        </article>
      </div>

      <section className="admin-panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Marketing funnel</p>
            <h2>From utility intent to qualified lead.</h2>
          </div>
          <span className="status-pill ready">{snapshot.funnel.leadConversionRate}% conversion</span>
        </div>
        <div className="funnel-grid">
          {funnelSteps.map((step, index) => (
            <article className="funnel-step" key={step.label}>
              <span>{String(index + 1).padStart(2, "0")}</span>
              <strong>{step.value}</strong>
              <h3>{step.label}</h3>
              <p>{step.note}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="admin-panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Deployment readiness</p>
            <h2>{readiness.score}% configured</h2>
          </div>
          <span className={readiness.blockers ? "status-pill missing" : "status-pill ready"}>
            {readiness.blockers ? `${readiness.blockers} blocker(s)` : "Production ready"}
          </span>
        </div>
        <div className="readiness-grid">
          {readiness.groups.map((group) => (
            <div className="readiness-group" key={group.key}>
              <h3>{group.label}</h3>
              <div className="stack-list">
                {group.items.map((item) => (
                  <div className={`readiness-item ${item.status}`} key={item.key}>
                    <div>
                      <strong>{item.label}</strong>
                      <span>{item.detail}</span>
                    </div>
                    <em>{item.status}</em>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      <div className="admin-grid">
        <section className="admin-panel wide">
          <div className="panel-heading">
            <h2>Latest Leads</h2>
            <a className="button secondary" href="/api/export/leads.csv">
              Export CSV
            </a>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Interest</th>
                  <th>Score</th>
                  <th>Country</th>
                  <th>Source</th>
                </tr>
              </thead>
              <tbody>
                {snapshot.latestLeads.length === 0 ? (
                  <tr>
                    <td colSpan={5}>No leads captured yet.</td>
                  </tr>
                ) : (
                  snapshot.latestLeads.map((lead) => (
                    <tr key={lead.id}>
                      <td>
                        <strong>{lead.name}</strong>
                        <span>{lead.email}</span>
                      </td>
                      <td>
                        {lead.interest}
                        <span>{lead.pipeline}</span>
                      </td>
                      <td>
                        <strong>{lead.score}</strong>
                        <span>{lead.priority}</span>
                      </td>
                      <td>{lead.country}</td>
                      <td>{lead.attribution.source || "direct"}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="admin-panel">
          <h2>Pipeline Mix</h2>
          <div className="stack-list">
            {pipelineEntries.length === 0 ? (
              <p>No pipeline data yet.</p>
            ) : (
              pipelineEntries.map(([pipeline, count]) => (
                <div className="stack-item" key={pipeline}>
                  <strong>{pipeline}</strong>
                  <span>{count} lead(s)</span>
                </div>
              ))
            )}
          </div>
        </section>

        <section className="admin-panel">
          <h2>Top Utility Tools</h2>
          <div className="stack-list">
            {snapshot.topUtilityTools.length === 0 ? (
              <p>No utility tool usage yet.</p>
            ) : (
              snapshot.topUtilityTools.map((tool) => (
                <div className="stack-item" key={tool.tool}>
                  <strong>{tool.tool.replace(/-/g, " ")}</strong>
                  <span>{tool.count} run(s)</span>
                </div>
              ))
            )}
          </div>
        </section>

        <section className="admin-panel">
          <h2>Latest Assessments</h2>
          <div className="stack-list">
            {snapshot.latestAssessments.length === 0 ? (
              <p>No assessments yet.</p>
            ) : (
              snapshot.latestAssessments.map((assessment) => (
                <div className="stack-item" key={assessment.id}>
                  <strong>{assessment.title}</strong>
                  <span>
                    {assessment.score} - {assessment.riskLevel}
                  </span>
                </div>
              ))
            )}
          </div>
        </section>

        <section className="admin-panel">
          <h2>Recent Events</h2>
          <div className="stack-list">
            {snapshot.latestEvents.length === 0 ? (
              <p>No events yet.</p>
            ) : (
              snapshot.latestEvents.map((event) => (
                <div className="stack-item" key={event.id}>
                  <strong>{event.name}</strong>
                  <span>{new Date(event.createdAt).toLocaleString()}</span>
                </div>
              ))
            )}
          </div>
        </section>

        <section className="admin-panel">
          <h2>Audit Log</h2>
          <div className="stack-list">
            {snapshot.latestAuditLogs.length === 0 ? (
              <p>No audit logs yet.</p>
            ) : (
              snapshot.latestAuditLogs.map((auditLog) => (
                <div className="stack-item" key={auditLog.id}>
                  <strong>{auditLog.action}</strong>
                  <span>
                    {auditLog.actor} {auditLog.target ? `- ${auditLog.target}` : ""} | {new Date(auditLog.createdAt).toLocaleString()}
                  </span>
                </div>
              ))
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
