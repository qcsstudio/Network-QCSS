import type { Metadata } from "next";
import Link from "next/link";
import { AssessmentTool } from "@/components/assessment-tool";
import { CardVisual } from "@/components/card-visual";
import { DomainHeroVisual } from "@/components/domain-hero-visual";
import { SignalJourney } from "@/components/signal-journey";
import { StructuredData } from "@/components/structured-data";
import { siteConfig, tools } from "@/lib/content";
import { createPageMetadata } from "@/lib/seo";

export const metadata: Metadata = createPageMetadata({
  title: "Network Assessment Tools for Risk, Firewall, Cloud, Pentest and Troubleshooting",
  description:
    "Run structured network assessments for managed services, firewall hygiene, cloud network readiness, pentest scoping, career path fit, and emergency troubleshooting.",
  path: "/diagnose",
  keywords: [
    "network assessment",
    "network risk assessment",
    "firewall assessment",
    "cloud network readiness",
    "pentest readiness",
    "network troubleshooting triage"
  ]
});

export default function DiagnosePage() {
  return (
    <main className="purpose-assessment">
      <StructuredData
        data={[
          {
            "@context": "https://schema.org",
            "@type": "CollectionPage",
            name: "Network Assessment Tools",
            description: metadata.description,
            url: `${siteConfig.url}/diagnose`,
            isPartOf: {
              "@type": "WebSite",
              name: siteConfig.name,
              url: siteConfig.url
            }
          },
          {
            "@context": "https://schema.org",
            "@type": "ItemList",
            itemListElement: tools.map((tool, index) => ({
              "@type": "ListItem",
              position: index + 1,
              name: tool.title,
              url: `${siteConfig.url}/tools/${tool.slug}`
            }))
          }
        ]}
      />
      <section className="page-hero visual-page-hero">
        <div className="page-hero-copy">
          <p className="eyebrow">Guided network assessment</p>
          <h1>Build a decision-ready network snapshot before the next change or escalation.</h1>
          <p>
            Answer practical questions about topology, controls, exposure, evidence, and ownership. Receive a risk band,
            a collection checklist, and a recommended next action.
          </p>
          <div className="button-row">
            <a className="button primary" href="#assessment">
              Run Assessment
            </a>
            <Link className="button secondary" href="/network-tools">
              Open Free Network Tools
            </Link>
          </div>
        </div>
        <DomainHeroVisual
          variant="network"
          label="Decision-ready snapshot"
          title="Questions become risk, evidence, and an accountable next move"
          signals={["Risk band", "Evidence list", "Next action"]}
        />
      </section>

      <SignalJourney variant="assessment" />

      <section className="section tool-run-section" id="assessment">
        <div className="section-heading">
          <p className="eyebrow">Live assessment</p>
          <h2>Choose the assessment that matches what is uncertain.</h2>
          <p>Use the combined assessment when several concerns overlap, or open a focused path when the domain is already clear.</p>
        </div>
        <AssessmentTool />
      </section>

      <section className="section">
        <div className="section-heading">
          <p className="eyebrow">Dedicated assessment pages</p>
          <h2>Go deeper when the problem domain is already clear.</h2>
        </div>
        <div className="service-grid">
          {tools.map((tool) => (
            <Link className="service-card" href={`/tools/${tool.slug}`} key={tool.slug}>
              <CardVisual title={tool.title} context={tool.category} />
              <p className="eyebrow">{tool.category}</p>
              <h2>{tool.title}</h2>
              <p>{tool.description}</p>
              <span className="text-link">Open dedicated page</span>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}
