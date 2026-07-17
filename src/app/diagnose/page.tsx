import type { Metadata } from "next";
import Link from "next/link";
import { AssessmentTool } from "@/components/assessment-tool";
import { CardVisual } from "@/components/card-visual";
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
    <main>
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
      <section className="page-hero">
        <p className="eyebrow">Diagnostic command layer</p>
        <h1>Network assessments that route visitors to the right service, evidence, and response path.</h1>
        <p>
          Use this hub to score managed network risk, firewall hygiene, cloud network readiness, pentest scope,
          troubleshooting urgency, or network security career path fit.
        </p>
        <div className="button-row">
          <a className="button primary" href="#assessment">
            Run Assessment
          </a>
          <Link className="button secondary" href="/network-tools">
            Open Free Network Tools
          </Link>
        </div>
      </section>

      <section className="section">
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

      <section className="section" id="assessment">
        <div className="section-heading">
          <p className="eyebrow">Live assessment</p>
          <h2>Start with the assessment that best matches the visitor intent.</h2>
        </div>
        <AssessmentTool />
      </section>
    </main>
  );
}
