import Image from "next/image";
import { Activity, BookOpenCheck, CloudCog, FileCheck2, Network, ShieldCheck } from "lucide-react";

export type DomainVisualVariant = "network" | "operations" | "security" | "cloud" | "training" | "intelligence";

const domainVisuals = {
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
      <div className="domain-hero-media">
        <Image
          src={visual.src}
          alt={visual.alt}
          fill
          priority
          sizes="(max-width: 900px) 92vw, 42vw"
        />
        <span className="domain-hero-grid" aria-hidden="true" />
        <span className="domain-hero-status"><Icon aria-hidden="true" size={18} /> {visual.status}</span>
      </div>
      <figcaption>
        <span>{label}</span>
        <strong>{title}</strong>
        <div>
          {signals.slice(0, 3).map((signal) => <small key={signal}>{signal}</small>)}
        </div>
      </figcaption>
    </figure>
  );
}
