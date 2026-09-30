import { Activity, BookOpenCheck, CloudCog, FileCheck2, Network, ShieldCheck, Terminal } from "lucide-react";
import { DomainScene, type DomainSceneVariant } from "./domain-scene";

export type DomainVisualVariant = DomainSceneVariant;

const domainVisuals = {
  resources: {
    src: "/brand/envato/objects/locked-data-folder.png",
    alt: "Technical reference documents",
    Icon: BookOpenCheck,
    status: "Reference library"
  },
  assessment: {
    src: "/brand/consulting/operations-artwork.webp",
    alt: "Network readiness review",
    Icon: FileCheck2,
    status: "Readiness review"
  },
  assurance: {
    src: "/brand/envato/cyber/security-shield-network.png",
    alt: "Authorized security assurance",
    Icon: ShieldCheck,
    status: "Authorized scope"
  },
  tools: {
    src: "/brand/consulting/operations-artwork.webp",
    alt: "Network engineering tools and infrastructure",
    Icon: Terminal,
    status: "Diagnostic workspace"
  },
  network: {
    src: "/brand/envato/library/data-center-platform.webp",
    alt: "Isometric network and data center platform",
    Icon: Network,
    status: "Topology mapped"
  },
  operations: {
    src: "/brand/envato/cyber/network-service-operator.jpg",
    alt: "Network engineer reviewing infrastructure in a server room",
    Icon: Activity,
    status: "Operations ready"
  },
  security: {
    src: "/brand/envato/cyber/security-shield-network.png",
    alt: "Network security shield protecting connected infrastructure",
    Icon: ShieldCheck,
    status: "Controls in scope"
  },
  cloud: {
    src: "/brand/envato/cyber/data-access-cloud.png",
    alt: "Protected cloud access and hybrid connectivity",
    Icon: CloudCog,
    status: "Cloud paths visible"
  },
  training: {
    src: "/brand/envato/library/server-cluster-engineer.webp",
    alt: "Engineer working with secure server and network infrastructure",
    Icon: BookOpenCheck,
    status: "Lab path prepared"
  },
  intelligence: {
    src: "/brand/envato/objects/locked-data-folder.png",
    alt: "Protected evidence folder for network security guidance",
    Icon: FileCheck2,
    status: "Evidence organized"
  }
} satisfies Record<DomainVisualVariant, { src: string; alt: string; Icon: typeof Network; status: string }>;

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
      <DomainScene variant={variant} fallback={visual.src} alt={visual.alt} />
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
