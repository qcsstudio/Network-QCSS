import type { Metadata } from "next";
import Link from "next/link";
import { CardVisual } from "@/components/card-visual";
import { LeadForm } from "@/components/lead-form";
import { StructuredData } from "@/components/structured-data";
import { instituteTracks, siteConfig } from "@/lib/content";
import { createPageMetadata } from "@/lib/seo";

export const metadata: Metadata = createPageMetadata({
  title: "Network and Network Security Institute for CCNA, Firewalls, Cloud and SOC",
  description:
    "Hands-on network and network security institute for CCNA foundation, CCNP path, firewall administration, cloud networking, SOC, ethical hacking and corporate training.",
  path: "/institute",
  keywords: [
    "network security institute",
    "CCNA training",
    "firewall training",
    "cloud networking course",
    "SOC analyst training",
    "ethical hacking labs"
  ]
});

export default function InstitutePage() {
  return (
    <main>
      <StructuredData
        data={[
          {
            "@context": "https://schema.org",
            "@type": "CollectionPage",
            name: "Network and Network Security Institute",
            description: metadata.description,
            url: `${siteConfig.url}/institute`,
            isPartOf: {
              "@type": "WebSite",
              name: siteConfig.name,
              url: siteConfig.url
            }
          },
          ...instituteTracks.map((track) => ({
            "@context": "https://schema.org",
            "@type": "Course",
            name: track.title,
            description: track.outcome,
            provider: {
              "@type": "Organization",
              name: siteConfig.name,
              url: siteConfig.url
            }
          }))
        ]}
      />
      <section className="page-hero">
        <p className="eyebrow">Institute</p>
        <h1>Network and network security training built from real operations work.</h1>
        <p>
          Build practical skills across networking, firewalls, cloud networking, SOC fundamentals, ethical hacking, and
          troubleshooting scenarios used by real infrastructure teams.
        </p>
        <div className="button-row">
          <Link className="button primary" href="/tools/career-path-finder">
            Find My Career Path
          </Link>
          <a className="button secondary" href="#enrollment">
            Request Counseling
          </a>
        </div>
      </section>

      <section className="section">
        <div className="section-heading">
          <p className="eyebrow">Training tracks</p>
          <h2>Courses should lead to roles, labs, confidence, and proof.</h2>
          <p>
            The institute side strengthens the services brand because it shows QCS can explain, teach, troubleshoot, and
            operationalize the same skills it sells.
          </p>
        </div>
        <div className="service-grid">
          {instituteTracks.map((track) => (
            <article className="service-card" key={track.title}>
              <CardVisual title={track.title} context={track.level} />
              <p className="eyebrow">{track.level}</p>
              <h3>{track.title}</h3>
              <p>{track.outcome}</p>
              <div className="mini-chip-row">
                {track.modules.slice(0, 4).map((module) => (
                  <i key={module}>{module}</i>
                ))}
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="section split">
        <div className="answer-panel">
          <p className="eyebrow">Differentiator</p>
          <h2>Teach the operational thinking behind networks, not only commands and certifications.</h2>
          <p>
            Training content should connect subnetting, switching, routing, VPN, firewall, cloud, logging, and
            troubleshooting into real-world decision making.
          </p>
        </div>
        <div className="answer-panel muted">
          <p className="eyebrow">Corporate training</p>
          <h2>Upskill support teams on firewalls, cloud networking, incident response, and troubleshooting.</h2>
          <p>
            Corporate batches can be mapped to the organization&apos;s actual environment, support workflow, and incident
            patterns.
          </p>
        </div>
      </section>

      <section className="section split" id="enrollment">
        <div className="section-heading">
          <p className="eyebrow">Enrollment path</p>
          <h2>Route students, working professionals, and corporate teams separately.</h2>
          <p>Use the career assessment first, then request counseling for the right training path.</p>
        </div>
        <LeadForm interest="Network security training" pipeline="Training / Institute" />
      </section>
    </main>
  );
}
