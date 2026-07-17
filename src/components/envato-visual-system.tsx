import Image from "next/image";
import Link from "next/link";

const commandSignals = [
  {
    visual: "/brand/envato/objects/server-tower.png",
    title: "Infrastructure Operations",
    description: "Routers, switches, Wi-Fi, circuits, backups, monitoring, inventory, and support evidence kept visible.",
    metric: "Operate"
  },
  {
    visual: "/brand/envato/library/security-network-shield.webp",
    title: "Security Controls",
    description: "Firewall policy, VPN access, segmentation, logging, admin paths, and exposure risks reviewed together.",
    metric: "Secure"
  },
  {
    visual: "/brand/envato/objects/vpn-symbol.png",
    title: "Hybrid Connectivity",
    description: "Site-to-site VPN, branch access, cloud routes, remote teams, and SASE readiness mapped before change.",
    metric: "Connect"
  },
  {
    visual: "/brand/envato/library/padlock-security.webp",
    title: "Evidence and Closure",
    description: "Assessment outputs, pentest findings, remediation proof, retest status, and owner-ready action plans.",
    metric: "Prove"
  }
];

const toolSignals = [
  "Topology clarity",
  "Firewall hygiene",
  "VPN and access review",
  "Cloud exposure map",
  "Pentest readiness",
  "Training path fit"
];

export function EnvatoVisualSystem() {
  return (
    <section className="asset-command-band" aria-labelledby="asset-command-heading">
      <div className="asset-command-inner">
        <div className="asset-command-copy">
          <p className="eyebrow">Network command workspace</p>
          <h2 id="asset-command-heading">See the network, security, cloud, and evidence path in one view.</h2>
          <p>
            QCS helps teams move from scattered symptoms to a usable operating picture: what is connected, what is
            exposed, what is breaking, what needs proof, and which next step makes sense.
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

        <div className="asset-command-visual" aria-label="Network command topology illustration">
          <Image
            src="/brand/envato/library/data-center-platform.webp"
            alt="Isometric data center platform with cloud, server, and analytics systems"
            fill
            sizes="(max-width: 900px) 100vw, 48vw"
          />
          <div className="asset-visual-overlay">
            <span>Assessment-ready operating map</span>
            <strong>Topology + controls + evidence</strong>
          </div>
        </div>

        <div className="asset-command-grid" aria-label="Network command service signals">
          {commandSignals.map((signal) => (
            <article className="asset-command-card" key={signal.title}>
              <span className="asset-command-object" aria-hidden="true">
                <Image src={signal.visual} alt="" width={132} height={132} />
              </span>
              <span className="asset-command-metric">{signal.metric}</span>
              <h3>{signal.title}</h3>
              <p>{signal.description}</p>
            </article>
          ))}
        </div>

        <div className="asset-intelligence-panel">
          <div>
            <p className="eyebrow">Guided diagnostic layer</p>
            <h3>Every useful check should end with a practical next action.</h3>
            <p>
              The website routes visitors through small tools, readiness assessments, resources, and service paths so
              each visitor can recognize their own issue before booking a deeper review.
            </p>
          </div>
          <div className="tool-signal-list">
            {toolSignals.map((signal) => (
              <span key={signal}>{signal}</span>
            ))}
          </div>
          <div className="asset-mini-visuals" aria-hidden="true">
            <Image src="/brand/envato/library/server-cluster-engineer.webp" alt="" width={220} height={220} />
            <Image src="/brand/envato/objects/locked-data-folder.png" alt="" width={220} height={220} />
          </div>
        </div>
      </div>
    </section>
  );
}
