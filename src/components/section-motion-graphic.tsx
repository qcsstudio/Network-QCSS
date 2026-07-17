import Image from "next/image";
import { Activity, CloudCog, Radar, ShieldCheck } from "lucide-react";

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
    src: "/brand/envato/objects/security-shield-3d.png",
    object: "/brand/envato/objects/locked-data-folder.png",
    alt: "3D shield representing network security controls",
    eyebrow: "Security scan",
    title: "Exposure, controls, and evidence checked in sequence.",
    Icon: ShieldCheck,
    signals: ["Firewall", "Access", "Logs", "Audit"],
    insight: "Firewall policy, access paths, logs, and ownership reviewed together.",
    visualTone: "object"
  },
  cloud: {
    src: "/brand/envato/cyber/data-access-cloud.png",
    object: "/brand/envato/objects/vpn-symbol.png",
    alt: "Cloud access illustration showing protected data access",
    eyebrow: "Cloud routes",
    title: "Hybrid paths between users, services, and workloads.",
    Icon: CloudCog,
    signals: ["VPC", "VPN", "SASE", "DNS"],
    insight: "Hybrid access, public exposure, and cloud routes made easier to inspect.",
    visualTone: "illustration"
  },
  assessment: {
    src: "/brand/envato/illustrations/isometric-data-center-network.svg",
    object: "/brand/envato/objects/locked-data-folder.png",
    alt: "Isometric data center network with analytics and connected infrastructure",
    eyebrow: "Readiness radar",
    title: "A practical snapshot before the next engineering decision.",
    Icon: Radar,
    signals: ["Risk", "Evidence", "Priority", "Next step"],
    insight: "Risk score, evidence checklist, and recommended next action in one view.",
    visualTone: "map"
  }
};

type SectionMotionGraphicProps = {
  variant: keyof typeof graphics;
  className?: string;
};

export function SectionMotionGraphic({ variant, className = "" }: SectionMotionGraphicProps) {
  const graphic = graphics[variant];
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
        <Image className="motion-asset-object" src={graphic.object} alt="" width={150} height={150} aria-hidden="true" />
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
