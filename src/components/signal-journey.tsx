import type { LucideIcon } from "lucide-react";
import {
  Activity,
  BookOpenCheck,
  CheckCircle2,
  Crosshair,
  FileCheck2,
  Gauge,
  KeyRound,
  ListChecks,
  Network,
  Radar,
  ScanSearch,
  ShieldCheck,
  Sparkles,
  Waypoints,
  Wrench
} from "lucide-react";

export type SignalJourneyVariant =
  | "solution"
  | "service"
  | "assessment"
  | "tools"
  | "learning"
  | "intelligence"
  | "assurance";

type JourneyStep = {
  label: string;
  detail: string;
  Icon: LucideIcon;
};

const journeys: Record<SignalJourneyVariant, { label: string; steps: JourneyStep[] }> = {
  solution: {
    label: "Problem-to-resolution path",
    steps: [
      { label: "Name the signal", detail: "Start with the symptom or exposure.", Icon: Radar },
      { label: "Collect evidence", detail: "Confirm what is affected and why.", Icon: ScanSearch },
      { label: "Choose the move", detail: "Match risk to an accountable action.", Icon: Waypoints },
      { label: "Verify closure", detail: "Retest the outcome and retain proof.", Icon: CheckCircle2 }
    ]
  },
  service: {
    label: "Controlled engineering path",
    steps: [
      { label: "Current state", detail: "Map the environment and pressure.", Icon: Network },
      { label: "Authorized scope", detail: "Agree access, impact, and owners.", Icon: KeyRound },
      { label: "Engineering work", detail: "Operate, change, or remediate.", Icon: Wrench },
      { label: "Verified handoff", detail: "Document evidence and next controls.", Icon: FileCheck2 }
    ]
  },
  assessment: {
    label: "Assessment output path",
    steps: [
      { label: "Practical questions", detail: "Describe topology, control, and ownership.", Icon: ListChecks },
      { label: "Risk band", detail: "See where attention is needed first.", Icon: Gauge },
      { label: "Evidence list", detail: "Know what to collect before review.", Icon: FileCheck2 },
      { label: "Next action", detail: "Move into the right tool or service.", Icon: Crosshair }
    ]
  },
  tools: {
    label: "Signal-to-decision path",
    steps: [
      { label: "Enter context", detail: "Use the domain, IP, route, or vendor.", Icon: KeyRound },
      { label: "Run the check", detail: "Execute a focused public diagnostic.", Icon: Activity },
      { label: "Read the signal", detail: "Separate evidence from assumption.", Icon: Radar },
      { label: "Take action", detail: "Save, repeat, or escalate the result.", Icon: Waypoints }
    ]
  },
  learning: {
    label: "Skill-to-role path",
    steps: [
      { label: "Build foundations", detail: "Understand the systems behind commands.", Icon: BookOpenCheck },
      { label: "Work the lab", detail: "Configure, observe, and troubleshoot.", Icon: Wrench },
      { label: "Demonstrate skill", detail: "Explain decisions and retain evidence.", Icon: Sparkles },
      { label: "Apply on the job", detail: "Transfer practice into real operations.", Icon: CheckCircle2 }
    ]
  },
  intelligence: {
    label: "Source-to-action path",
    steps: [
      { label: "Official source", detail: "Monitor vendors and trusted authorities.", Icon: Radar },
      { label: "Verify context", detail: "Check products, exposure, and evidence.", Icon: ShieldCheck },
      { label: "Set priority", detail: "Separate urgent action from useful reading.", Icon: Gauge },
      { label: "Act or learn", detail: "Patch, mitigate, investigate, or prepare.", Icon: Crosshair }
    ]
  },
  assurance: {
    label: "Governed assurance path",
    steps: [
      { label: "Verify identity", detail: "Confirm the client and responsible owner.", Icon: KeyRound },
      { label: "Authorize scope", detail: "Record targets, limits, and timing.", Icon: ShieldCheck },
      { label: "Execute safely", detail: "Test with controls and audit evidence.", Icon: Crosshair },
      { label: "Report and retest", detail: "Track findings through verified closure.", Icon: FileCheck2 }
    ]
  }
};

type SignalJourneyProps = {
  variant: SignalJourneyVariant;
  compact?: boolean;
};

export function SignalJourney({ variant, compact = false }: SignalJourneyProps) {
  const journey = journeys[variant];

  return (
    <section className={`signal-journey signal-journey-${variant}${compact ? " is-compact" : ""}`} aria-label={journey.label}>
      <div className="signal-journey-heading">
        <span>QCS path</span>
        <strong>{journey.label}</strong>
      </div>
      <ol>
        {journey.steps.map(({ label, detail, Icon }, index) => (
          <li key={label}>
            <span className="signal-journey-index">{String(index + 1).padStart(2, "0")}</span>
            <span className="signal-journey-icon"><Icon aria-hidden="true" size={19} /></span>
            <span className="signal-journey-copy">
              <strong>{label}</strong>
              <small>{detail}</small>
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}
