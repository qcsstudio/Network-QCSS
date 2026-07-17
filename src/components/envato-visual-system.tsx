import Image from "next/image";
import Link from "next/link";
import type { CSSProperties } from "react";

const commandSignals = [
  {
    icon: "/brand/envato/icons/router-cloud-network.svg",
    title: "Managed Network Operations",
    description: "Routing, switching, Wi-Fi, VPN, SD-WAN, backups, monitoring, and incident evidence in one support rhythm.",
    metric: "Operate"
  },
  {
    icon: "/brand/envato/icons/security-cloud-network.svg",
    title: "Security Governance",
    description: "Firewall hygiene, access review, segmentation, logs, cloud exposure, and audit-ready security controls.",
    metric: "Secure"
  },
  {
    icon: "/brand/envato/icons/multicloud-network.svg",
    title: "Cloud Network Control",
    description: "AWS VPC, Azure VNet, Google Cloud VPC, hybrid VPN, public exposure, routing, and private access design.",
    metric: "Cloud"
  },
  {
    icon: "/brand/envato/icons/protected-cloud-network.svg",
    title: "Testing to Remediation",
    description: "Penetration testing, retesting, risk-ranked reporting, remediation support, and owner-ready action plans.",
    metric: "Test"
  }
];

const toolSignals = [
  "DNS and MX checks",
  "SPF and DMARC review",
  "SSL health signals",
  "Port and header checks",
  "Network risk scoring",
  "Readiness path"
];

export function EnvatoVisualSystem() {
  return (
    <section className="asset-command-band" aria-labelledby="asset-command-heading">
      <div className="asset-command-inner">
        <div className="asset-command-copy">
          <p className="eyebrow">Immersive network visual system</p>
          <h2 id="asset-command-heading">A futuristic service surface for networks that need clarity.</h2>
          <p>
            The new visual direction uses real infrastructure imagery, consistent cloud-network icons, and concise service
            proof blocks so visitors quickly understand how QCS connects operations, security, cloud, testing, and
            training.
          </p>
          <div className="button-row">
            <Link className="button primary" href="/network-tools">
              Open Network Tools
            </Link>
            <Link className="button secondary" href="/diagnose">
              Start Guided Assessment
            </Link>
          </div>
        </div>

        <div className="asset-command-visual" aria-label="QuantumCrafters network service visual">
          <Image
            src="/brand/envato/cyber/network-service-operator.jpg"
            alt="Network operator reviewing infrastructure in a server environment"
            fill
            sizes="(max-width: 900px) 100vw, 48vw"
          />
          <div className="asset-visual-overlay">
            <span>Live network service posture</span>
            <strong>Operate + Secure + Train</strong>
          </div>
        </div>

        <div className="asset-command-grid" aria-label="Network command service signals">
          {commandSignals.map((signal) => (
            <article className="asset-command-card" key={signal.title}>
              <span
                className="asset-command-icon"
                aria-hidden="true"
                style={{ "--asset-icon": `url("${signal.icon}")` } as CSSProperties}
              />
              <span className="asset-command-metric">{signal.metric}</span>
              <h3>{signal.title}</h3>
              <p>{signal.description}</p>
            </article>
          ))}
        </div>

        <div className="asset-intelligence-panel">
          <div>
            <p className="eyebrow">Guided diagnostic layer</p>
            <h3>Every useful check can become a clearer next step.</h3>
            <p>
              Quick checks and readiness tools help turn unclear symptoms into practical evidence before a deeper
              engineering conversation begins.
            </p>
          </div>
          <div className="tool-signal-list">
            {toolSignals.map((signal) => (
              <span key={signal}>{signal}</span>
            ))}
          </div>
          <div className="asset-mini-visuals" aria-hidden="true">
            <Image src="/brand/envato/cyber/security-shield-network.png" alt="" width={220} height={220} />
            <Image src="/brand/envato/cyber/data-access-cloud.png" alt="" width={220} height={220} />
          </div>
        </div>
      </div>
    </section>
  );
}
