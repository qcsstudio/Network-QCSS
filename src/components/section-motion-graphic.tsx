import Image from "next/image";
import { Activity, CloudCog, Radar, ShieldCheck } from "lucide-react";

const graphics = {
  network: {
    src: "/brand/animated/network-pulse.gif",
    alt: "Animated network traffic map with connected nodes",
    eyebrow: "Live topology",
    title: "Signals moving across sites, cloud, and users.",
    Icon: Activity,
    signals: ["Routes", "VPN", "LAN", "Wi-Fi"]
  },
  security: {
    src: "/brand/animated/security-scan.gif",
    alt: "Animated security shield scan",
    eyebrow: "Security scan",
    title: "Exposure, controls, and evidence checked in sequence.",
    Icon: ShieldCheck,
    signals: ["Firewall", "Access", "Logs", "Audit"]
  },
  cloud: {
    src: "/brand/animated/cloud-route-flow.gif",
    alt: "Animated cloud routing and data-flow graphic",
    eyebrow: "Cloud routes",
    title: "Hybrid paths between users, services, and workloads.",
    Icon: CloudCog,
    signals: ["VPC", "VPN", "SASE", "DNS"]
  },
  assessment: {
    src: "/brand/animated/assessment-radar.gif",
    alt: "Animated assessment radar with risk signals",
    eyebrow: "Readiness radar",
    title: "A practical snapshot before the next engineering decision.",
    Icon: Radar,
    signals: ["Risk", "Evidence", "Priority", "Next step"]
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
      <div className="motion-frame">
        <Image src={graphic.src} alt={graphic.alt} width={440} height={286} unoptimized />
        <div className="motion-glass-label">
          <Icon size={22} />
          <span>{graphic.eyebrow}</span>
        </div>
      </div>
      <h3>{graphic.title}</h3>
      <div className="motion-signal-row">
        {graphic.signals.map((signal) => (
          <span key={signal}>{signal}</span>
        ))}
      </div>
    </aside>
  );
}
