import Image from "next/image";
import Link from "next/link";

const commandSignals = [
  {
    visual: "/brand/envato/icons/router-cloud-network.svg",
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
    visual: "/brand/envato/cyber/data-access-cloud.png",
    title: "Hybrid Connectivity",
    description: "Site-to-site VPN, branch access, cloud routes, remote teams, and SASE readiness mapped before change.",
    metric: "Connect"
  },
  {
    visual: "/brand/envato/icons/protected-cloud-network.svg",
    title: "Evidence and Closure",
    description: "Assessment outputs, pentest findings, remediation proof, retest status, and owner-ready action plans.",
    metric: "Prove"
  }
];

export function EnvatoVisualSystem() {
  return (
    <section className="asset-command-band motion-section" id="command-system" aria-labelledby="asset-command-heading">
      <div className="asset-command-inner">
        <div className="asset-command-copy">
          <p className="eyebrow">The QCS command model</p>
          <h2 id="asset-command-heading">One operating picture from first symptom to verified closure.</h2>
          <p>
            Bring topology, exposure, ownership, changes, findings, and retest evidence into a practical sequence your
            engineers and stakeholders can follow.
          </p>
          <div className="button-row">
            <Link className="button primary" href="/network-tools">
              Open Network Tools
            </Link>
            <Link className="button secondary" href="/diagnose">
              Assess the Environment
            </Link>
          </div>
        </div>

        <div className="asset-command-visual" aria-label="Network command topology illustration">
          <div className="asset-command-media">
            <Image
              src="/brand/envato/library/data-center-platform.webp"
              alt="Isometric data center platform with cloud, server, and analytics systems"
              fill
              sizes="(max-width: 900px) 100vw, 48vw"
            />
          </div>
          <div className="asset-visual-overlay">
            <span>Evidence-to-action workspace</span>
            <strong>Observe + authorize + resolve + verify</strong>
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

        <div className="command-proof-rail" aria-label="QCS delivery controls">
          <span><b>01</b><strong>Authorized scope</strong><small>Access and impact agreed before work begins.</small></span>
          <span><b>02</b><strong>Owner-ready evidence</strong><small>Signals, findings, and decisions stay traceable.</small></span>
          <span><b>03</b><strong>Remediation and retest</strong><small>Closure is demonstrated, not assumed.</small></span>
        </div>
      </div>
    </section>
  );
}
