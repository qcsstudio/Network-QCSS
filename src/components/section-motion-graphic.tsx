import Image from "next/image";
import type { LucideIcon } from "lucide-react";
import { Activity, CloudCog, Radar, Route, ShieldCheck, Wrench } from "lucide-react";

type GraphicTone = "photo" | "object" | "illustration" | "map" | "icon-cluster";

type GraphicConfig = {
  src: string;
  object?: string;
  alt: string;
  eyebrow: string;
  title: string;
  Icon: LucideIcon;
  signals: string[];
  insight: string;
  visualTone: GraphicTone;
  nodes?: {
    src: string;
    label: string;
  }[];
};

const graphics = {
  network: {
    src: "/brand/envato/cyber/network-service-operator.jpg",
    object: "/brand/envato/objects/server-tower.png",
    alt: "Network operations engineer checking infrastructure in a server room",
    eyebrow: "Live topology",
    title: "Signals moving across sites, cloud, and users.",
    Icon: Activity,
    signals: ["Routes", "VPN", "LAN", "Wi-Fi"],
    insight: "Sites, devices, and incidents organized before the technical call.",
    visualTone: "photo"
  },
  security: {
    src: "/brand/envato/library/security-network-shield.webp",
    object: "/brand/envato/objects/locked-data-folder.png",
    alt: "3D shield and lock representing network security controls",
    eyebrow: "Security scan",
    title: "Exposure, controls, and evidence checked in sequence.",
    Icon: ShieldCheck,
    signals: ["Firewall", "Access", "Logs", "Audit"],
    insight: "Firewall policy, access paths, logs, and ownership reviewed together.",
    visualTone: "object"
  },
  services: {
    src: "/brand/envato/library/server-cluster-engineer.webp",
    object: "/brand/envato/objects/vpn-symbol.png",
    alt: "Engineer validating a server cluster and network service path",
    eyebrow: "Service workspace",
    title: "Hands-on support for operations, security, cloud, and training.",
    Icon: Wrench,
    signals: ["Operate", "Troubleshoot", "Monitor", "Train"],
    insight: "A practical service map for the teams that need fixes, proof, or skill transfer.",
    visualTone: "illustration"
  },
  assessment: {
    src: "/brand/envato/library/padlock-security.webp",
    object: "/brand/envato/icons/security-cloud-network.svg",
    alt: "3D padlock representing protected assessment evidence",
    eyebrow: "Readiness radar",
    title: "A practical snapshot before the next engineering decision.",
    Icon: Radar,
    signals: ["Risk", "Evidence", "Priority", "Next step"],
    insight: "Risk score, evidence checklist, and recommended next action in one view.",
    visualTone: "object"
  },
  utilities: {
    src: "/brand/envato/icons/global-cloud-network.svg",
    alt: "Cloud network icon representing public network utilities",
    eyebrow: "Quick checks",
    title: "Small public tools that turn first symptoms into useful signals.",
    Icon: CloudCog,
    signals: ["DNS", "IP", "Headers", "Latency"],
    insight: "Fast checks help visitors self-qualify before they request deeper troubleshooting.",
    visualTone: "icon-cluster",
    nodes: [
      { src: "/brand/envato/icons/router-cloud-network.svg", label: "Router" },
      { src: "/brand/envato/icons/server-cloud-network.svg", label: "Server" },
      { src: "/brand/envato/icons/wifi-cloud-network.svg", label: "Wi-Fi" },
      { src: "/brand/envato/icons/security-cloud-network.svg", label: "Security" }
    ]
  },
  cloud: {
    src: "/brand/envato/cyber/data-access-cloud.png",
    object: "/brand/envato/objects/vpn-symbol.png",
    alt: "Cloud access illustration showing protected data access",
    eyebrow: "Cloud routes",
    title: "Hybrid paths between users, services, and workloads.",
    Icon: Route,
    signals: ["VPC", "VPN", "SASE", "DNS"],
    insight: "Hybrid access, public exposure, and cloud routes made easier to inspect.",
    visualTone: "map"
  }
} satisfies Record<string, GraphicConfig>;

type SectionMotionGraphicProps = {
  variant: keyof typeof graphics;
  className?: string;
};

export function SectionMotionGraphic({ variant, className = "" }: SectionMotionGraphicProps) {
  const graphic: GraphicConfig = graphics[variant];
  const Icon = graphic.Icon;

  return (
    <aside className={`section-motion-graphic ${variant} ${className}`} aria-label={graphic.eyebrow}>
      <div className={`motion-asset-stage ${graphic.visualTone}`}>
        <Image
          className="motion-asset-image"
          src={graphic.src}
          alt={graphic.alt}
          width={560}
          height={360}
          sizes="(max-width: 900px) 92vw, 34vw"
        />
        {graphic.object ? (
          <Image className="motion-asset-object" src={graphic.object} alt="" width={150} height={150} aria-hidden="true" />
        ) : null}
        {graphic.nodes ? (
          <div className="motion-node-cluster" aria-hidden="true">
            {graphic.nodes.map((node) => (
              <span key={node.label}>
                <Image src={node.src} alt="" width={40} height={40} />
                <small>{node.label}</small>
              </span>
            ))}
          </div>
        ) : null}
        <div className="motion-badge">
          <Icon size={22} />
          <span>{graphic.eyebrow}</span>
        </div>
      </div>
      <div className="motion-content">
        <h3>{graphic.title}</h3>
        <p>{graphic.insight}</p>
        <div className="motion-signal-row">
          {graphic.signals.map((signal) => (
            <span key={signal}>{signal}</span>
          ))}
        </div>
      </div>
    </aside>
  );
}
