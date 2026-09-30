import { Activity, BookOpenCheck, CloudCog, FileCheck2, Network, ShieldCheck, Terminal, Wifi, Wrench } from "lucide-react";
import { DomainScene, type DomainSceneVariant } from "./domain-scene";

export type DomainVisualVariant = DomainSceneVariant;

const domainVisuals = {
  wifi: {
    alt: "A wired switch, wireless access point and client",
    Icon: Wifi,
    status: "Wireless path"
  },
  firewall: {
    alt: "A firewall allows a service request and blocks an unapproved path",
    Icon: ShieldCheck,
    status: "Policy review"
  },
  troubleshooting: {
    alt: "A network device, suspect link and diagnostic workstation",
    Icon: Wrench,
    status: "Fault isolation"
  },
  resources: {
    alt: "A technical guide alongside a checklist and network appliance",
    Icon: BookOpenCheck,
    status: "Reference library"
  },
  assessment: {
    alt: "Environment questions paired with an evidence checklist",
    Icon: FileCheck2,
    status: "Readiness review"
  },
  assurance: {
    alt: "An authorized testing workstation, scoped target and finding record",
    Icon: ShieldCheck,
    status: "Authorized scope"
  },
  tools: {
    alt: "An example DNS query and its illustrative structured answer",
    Icon: Terminal,
    status: "Diagnostic workspace"
  },
  network: {
    alt: "A branch workstation connects through a WAN router to a server",
    Icon: Network,
    status: "Topology mapped"
  },
  operations: {
    alt: "Network devices send signals to a monitoring workstation",
    Icon: Activity,
    status: "Operations ready"
  },
  security: {
    alt: "Permitted and denied traffic at a firewall policy boundary",
    Icon: ShieldCheck,
    status: "Controls in scope"
  },
  cloud: {
    alt: "On-premises and cloud gateways joined by an illustrative IPsec VPN",
    Icon: CloudCog,
    status: "Cloud paths visible"
  },
  training: {
    alt: "A complete wired path from PC1 through a switch and router to PC2",
    Icon: BookOpenCheck,
    status: "Lab path prepared"
  },
  intelligence: {
    alt: "Vendor bulletin, evidence review and technical brief workstations",
    Icon: FileCheck2,
    status: "Evidence organized"
  }
} satisfies Record<DomainVisualVariant, { alt: string; Icon: typeof Network; status: string }>;

type DomainHeroVisualProps = {
  variant: DomainVisualVariant;
  label: string;
  title: string;
  signals: string[];
};

export function DomainHeroVisual({ variant, label, title, signals }: DomainHeroVisualProps) {
  const visual = domainVisuals[variant];
  const Icon = visual.Icon;

  return (
    <figure className={`domain-hero-visual domain-${variant}`}>
      <DomainScene variant={variant} fallback={`/brand/engineering/${variant}.png`} alt={visual.alt} />
      <figcaption>
        <span><Icon aria-hidden="true" size={16} /> {label}</span>
        <strong>{title}</strong>
        <div>
          {signals.slice(0, 3).map((signal) => <small key={signal}>{signal}</small>)}
        </div>
      </figcaption>
    </figure>
  );
}
