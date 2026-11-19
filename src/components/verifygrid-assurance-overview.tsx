"use client";

import { useId } from "react";
import { ArrowUpRight, CircleCheck, Clock3, Layers3, LockKeyhole, ShieldCheck, Target, TriangleAlert } from "lucide-react";
import type { VerifyGridEngagementRecord } from "@/lib/verifygrid";
import { buildVerifyGridReadiness } from "@/lib/verifygrid-readiness";
import styles from "./verifygrid-assurance-overview.module.css";

type OverviewView = "scope" | "methodology" | "evidence" | "execution";

const zoneNames: Record<string, string> = { production: "Production", staging: "Staging", development: "Development", corporate: "Corporate", ot: "Operational tech", lab: "Lab", other: "Other" };
const positions = [{ x: 102, y: 72 }, { x: 408, y: 72 }, { x: 102, y: 254 }, { x: 408, y: 254 }];
const dateTime = new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata" });

function windowLabel(value: string | undefined) {
  const time = value ? Date.parse(value) : NaN;
  return Number.isFinite(time) ? dateTime.format(time) + " IST" : "Not recorded";
}

export function VerifyGridAssuranceOverview({ engagement, evaluatedAt, onNavigate }: {
  engagement: VerifyGridEngagementRecord;
  evaluatedAt: number;
  onNavigate: (view: OverviewView) => void;
}) {
  const graphicId = useId().replaceAll(":", "");
  const readiness = buildVerifyGridReadiness(engagement, evaluatedAt);
  const paused = engagement.status === "paused";
  const posture = paused ? "Paused" : readiness.executable ? "Authority current" : "Execution blocked";
  const StateIcon = readiness.executable ? ShieldCheck : paused ? Clock3 : LockKeyhole;
  const coverage = readiness.coverage;
  const widthFor = (count: number) => `${coverage.total ? count / coverage.total * 100 : 0}%`;
  const visibleZones = readiness.zones.slice(0, 4);

  return (
    <section className={styles.overview} aria-label="Engagement assurance overview">
      <div className={styles.posture}>
        <div className={styles.postureHeading}>
          <span className={styles.kicker}>QCS VERIFYGRID <span>/</span> CONTROL OVERVIEW</span>
          <span className={`${styles.status} ${readiness.executable ? styles.ready : styles.held}`}><StateIcon size={14} aria-hidden="true" />{posture}</span>
        </div>
        <div className={styles.hero}>
          <div className={styles.heroCopy}>
            <p className={styles.eyebrow}>Scope and execution</p>
            <h4>{paused ? "Execution is on hold." : readiness.executable ? "Authority is current." : "Authority needs attention."}</h4>
            <p>{readiness.blockers[0] || "Scope, ownership and the authorization window are current. Each job still requires its own approved manifest and available sensor."}</p>
            <div className={styles.scopeFacts}>
              <span><Target size={15} aria-hidden="true" /><b>{readiness.owned}/{readiness.targets}</b> ownership confirmed</span>
              <span><LockKeyhole size={15} aria-hidden="true" /><b>{readiness.exclusions}</b> explicit exclusions</span>
            </div>
            <button className={styles.lightButton} type="button" onClick={() => onNavigate("scope")}>Inspect scope and authority <ArrowUpRight size={16} aria-hidden="true" /></button>
          </div>
          <div className={styles.diagram}>
            <svg viewBox="0 0 510 330" aria-hidden="true" focusable="false" className={readiness.executable && readiness.activeJobs ? styles.running : undefined}>
              <defs>
                <pattern id={`${graphicId}-grid`} width="24" height="24" patternUnits="userSpaceOnUse"><circle cx="1" cy="1" r=".7" fill="#7191a9" opacity=".3" /></pattern>
                <radialGradient id={`${graphicId}-glow`}><stop offset="0" stopColor={readiness.executable ? "#4abda7" : "#c99762"} stopOpacity=".18" /><stop offset="1" stopColor="#0c1d2b" stopOpacity="0" /></radialGradient>
              </defs>
              <rect width="510" height="330" fill={`url(#${graphicId}-grid)`} />
              <circle cx="255" cy="165" r="150" fill={`url(#${graphicId}-glow)`} />
              <circle cx="255" cy="165" r="110" className={styles.boundary} />
              <circle cx="255" cy="165" r="84" className={styles.innerBoundary} />
              {visibleZones.map(([zone, count], index) => {
                const position = positions[index];
                return <g key={zone}>
                  <path d={`M ${position.x} ${position.y} Q 255 ${position.y} 255 165`} className={styles.connector} />
                  <rect x={position.x - 66} y={position.y - 29} width="132" height="64" rx="10" className={styles.zone} />
                  <circle cx={position.x - 49} cy={position.y - 10} r="3" fill="#8ba6bd" />
                  <text x={position.x - 39} y={position.y - 6} className={styles.zoneLabel}>{zoneNames[zone] || "Other"}</text>
                  <text x={position.x - 49} y={position.y + 19} className={styles.zoneCount}>{count} scoped {count === 1 ? "target" : "targets"}</text>
                </g>;
              })}
              <rect x="196" y="112" width="118" height="106" rx="22" className={styles.core} />
              <path d="M255 128l15 6v10c0 10-8 17-15 20-7-3-15-10-15-20v-10z" className={readiness.executable ? styles.shieldReady : styles.shieldHeld} />
              <path d={readiness.executable ? "m249 145 4 4 8-9" : "M250 145v-3a5 5 0 0110 0v3m-10 0h10v8h-10z"} className={styles.checkmark} />
              <text x="255" y="185" textAnchor="middle" className={styles.coreLabel}>{readiness.executable ? "AUTHORIZED" : "GATE HELD"}</text>
              <text x="255" y="201" textAnchor="middle" className={styles.coreDetail}>{readiness.targets} scoped targets</text>
              {!readiness.targets ? <text x="255" y="290" textAnchor="middle" className={styles.zoneCount}>Define the first authorized target</text> : null}
            </svg>
            <p>Scope inventory by environment{readiness.zones.length > 4 ? ` · ${readiness.zones.length - 4} more environments` : ""}. Connections show grouping, not measured network paths.</p>
          </div>
        </div>
        <div className={styles.window}>
          <Clock3 size={16} aria-hidden="true" />
          <span>Authorization ends <strong>{windowLabel(engagement.gate.authorization?.validUntil)}</strong></span>
          <span className={styles.digest}>Scope <code title={engagement.gate.scopeHash}>{engagement.gate.scopeHash.slice(0, 12) || "Not recorded"}</code></span>
        </div>
      </div>

      <div className={styles.coverage}>
        <div className={styles.coverageHeading}>
          <div><p className={styles.eyebrow}>Assessment coverage</p><h4>Recorded work. Visible gaps.</h4></div>
          <button type="button" onClick={() => onNavigate("methodology")} className={styles.textButton}>Test plan <ArrowUpRight size={15} aria-hidden="true" /></button>
        </div>
        <div className={styles.coverageNumber}><strong>{coverage.concluded}<span>/{coverage.total}</span></strong><span>test cases concluded</span><b>{coverage.total ? `${coverage.percent}%` : "No plan"}</b></div>
        <div className={styles.coverageBar} role="img" aria-label={`${coverage.passed} passed, ${coverage.findings} with findings, ${coverage.notApplicable} not applicable, ${coverage.incomplete} incomplete`}>
          <span className={styles.passed} style={{ width: widthFor(coverage.passed) }} /><span className={styles.finding} style={{ width: widthFor(coverage.findings) }} /><span className={styles.notApplicable} style={{ width: widthFor(coverage.notApplicable) }} />
        </div>
        <ul className={styles.legend}>
          <li><i className={styles.passed} /><span>Passed</span><b>{coverage.passed}</b></li>
          <li><i className={styles.finding} /><span>With findings</span><b>{coverage.findings}</b></li>
          <li><i className={styles.notApplicable} /><span>Not applicable</span><b>{coverage.notApplicable}</b></li>
          <li><i className={styles.incomplete} /><span>Incomplete</span><b>{coverage.incomplete}</b></li>
        </ul>
        <p className={styles.coverageNote}>Completion measures the test plan. It does not establish that the environment is secure.</p>
        <div className={styles.outcomes}>
          <button type="button" onClick={() => onNavigate("execution")}><Layers3 size={17} aria-hidden="true" /><strong>{readiness.activeJobs}<small>active {readiness.activeJobs === 1 ? "job" : "jobs"}</small></strong><ArrowUpRight size={14} aria-hidden="true" /></button>
          <button type="button" onClick={() => onNavigate("execution")} data-attention={readiness.jobExceptions > 0}><TriangleAlert size={17} aria-hidden="true" /><strong>{readiness.jobExceptions}<small>recent job exceptions</small></strong><ArrowUpRight size={14} aria-hidden="true" /></button>
          <button type="button" onClick={() => onNavigate("evidence")}><CircleCheck size={17} aria-hidden="true" /><strong>{readiness.pendingObservations}<small>observations awaiting review</small></strong><ArrowUpRight size={14} aria-hidden="true" /></button>
        </div>
        {readiness.missingJobEvidence ? <p className={styles.evidenceWarning}>{readiness.missingJobEvidence} completed {readiness.missingJobEvidence === 1 ? "job needs" : "jobs need"} linked result evidence.</p> : null}
        <div className={styles.nextStep}><div><span>Next action</span><p>{readiness.next.detail}</p></div><button type="button" onClick={() => onNavigate(readiness.next.view)}>{readiness.next.label}<ArrowUpRight size={16} aria-hidden="true" /></button></div>
      </div>
    </section>
  );
}
