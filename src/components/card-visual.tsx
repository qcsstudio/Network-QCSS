import type { LucideIcon } from "lucide-react";
import {
  Activity,
  AlertTriangle,
  BookOpen,
  BrainCircuit,
  BriefcaseBusiness,
  CheckCircle2,
  ClipboardCheck,
  CloudCog,
  DatabaseZap,
  FileCheck2,
  Fingerprint,
  GraduationCap,
  KeyRound,
  LockKeyhole,
  MailCheck,
  Network,
  PlugZap,
  Radar,
  Route,
  Router,
  ScanSearch,
  ServerCog,
  ShieldCheck,
  UserCheck,
  Wifi,
  Wrench
} from "lucide-react";

type CardVisualProps = {
  title: string;
  context?: string;
  icon?: LucideIcon;
  tone?: "blue" | "orange" | "magenta" | "green" | "dark";
  className?: string;
};

const visualRules: { match: RegExp; Icon: LucideIcon; tone: NonNullable<CardVisualProps["tone"]> }[] = [
  { match: /outage|emergency|incident|triage|rca|latency|troubleshoot|break/i, Icon: AlertTriangle, tone: "orange" },
  { match: /firewall|rule|vpn|sase|zero trust|ztna|access|admin|secure|security|control|hardening/i, Icon: ShieldCheck, tone: "magenta" },
  { match: /cloud|vpc|vnet|hybrid|route|aws|azure|google|sase/i, Icon: CloudCog, tone: "blue" },
  { match: /pentest|penetration|retest|exposure|scan|scope|evidence closure/i, Icon: ScanSearch, tone: "magenta" },
  { match: /dns|mx|spf|dmarc|email|mail|header|ssl|certificate|port|tcp/i, Icon: Fingerprint, tone: "blue" },
  { match: /noc|monitor|uptime|alert|operate|operations|support|managed network/i, Icon: Activity, tone: "green" },
  { match: /wi-?fi|lan|branch|campus|switch|router|network engineering/i, Icon: Router, tone: "blue" },
  { match: /training|institute|career|ccna|ccnp|soc|ethical|learner|student|professional|roadmap/i, Icon: GraduationCap, tone: "green" },
  { match: /resource|checklist|guide|template|worksheet|map|download|audit/i, Icon: FileCheck2, tone: "orange" },
  { match: /founder|buyer|team|owner|stakeholder|conversation|review/i, Icon: UserCheck, tone: "dark" },
  { match: /document|backup|report|deliverable|proof|state/i, Icon: ClipboardCheck, tone: "orange" },
  { match: /connect|hybrid connectivity|path/i, Icon: Route, tone: "blue" },
  { match: /modern|automation|decision|clarity|readiness|score/i, Icon: BrainCircuit, tone: "magenta" }
];

function resolveVisual(title: string, context = "") {
  const haystack = `${title} ${context}`;
  return visualRules.find((rule) => rule.match.test(haystack)) ?? { Icon: Network, tone: "blue" as const };
}

export function CardVisual({ title, context = "", icon, tone, className = "" }: CardVisualProps) {
  const resolved = resolveVisual(title, context);
  const Icon = icon ?? resolved.Icon;
  const visualTone = tone ?? resolved.tone;

  return (
    <span className={`card-visual ${visualTone} ${className}`} aria-hidden="true">
      <span className="card-visual-icon">
        <Icon size={24} strokeWidth={2.35} />
      </span>
      <span className="card-visual-circuit">
        <i />
        <i />
        <i />
      </span>
    </span>
  );
}

export const cardVisualIcons = {
  Activity,
  BookOpen,
  BriefcaseBusiness,
  CheckCircle2,
  CloudCog,
  DatabaseZap,
  KeyRound,
  LockKeyhole,
  MailCheck,
  PlugZap,
  Radar,
  Router,
  ServerCog,
  ShieldCheck,
  Wifi,
  Wrench
};
