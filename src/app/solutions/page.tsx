import type { Metadata } from "next";
import Link from "next/link";
import { CardVisual } from "@/components/card-visual";
import { DomainHeroVisual } from "@/components/domain-hero-visual";
import { SignalJourney } from "@/components/signal-journey";
import { StructuredData } from "@/components/structured-data";
import { siteConfig, solutionPages } from "@/lib/content";
import { createPageMetadata } from "@/lib/seo";

export const metadata: Metadata = createPageMetadata({
  title: "Network Solutions for Outages, Firewall Cleanup, SASE, Cloud and Pentest Remediation",
  description:
    "Problem-led network and security solution pages for outage response, firewall rule cleanup, SASE readiness, cloud exposure review, pentest remediation, and career labs.",
  path: "/solutions",
  keywords: [
    "network solutions",
    "network outage response",
    "firewall rule cleanup",
    "SASE readiness",
    "cloud network exposure",
    "pentest remediation"
  ]
});

export default function SolutionsPage() {
  return (
    <main className="purpose-solution">
      <StructuredData
        data={[
          {
            "@context": "https://schema.org",
            "@type": "CollectionPage",
            name: "Network and Security Solutions",
            description: metadata.description,
            url: `${siteConfig.url}/solutions`,
            isPartOf: {
              "@type": "WebSite",
              name: siteConfig.name,
              url: siteConfig.url
            }
          },
          {
            "@context": "https://schema.org",
            "@type": "ItemList",
            itemListElement: solutionPages.map((solution, index) => ({
              "@type": "ListItem",
              position: index + 1,
              name: solution.title,
              url: `${siteConfig.url}/solutions/${solution.slug}`
            }))
          }
        ]}
      />
      <section className="page-hero visual-page-hero">
        <div className="page-hero-copy">
          <p className="eyebrow">Solution hub</p>
          <h1>Start with the network or security problem blocking your team.</h1>
          <p>
            Get a direct answer and understand the risk. Move into the right assessment, technical tool, or engineering
            service without sorting through a generic catalogue.
          </p>
        </div>
        <DomainHeroVisual
          variant="network"
          label="Problem-led navigation"
          title="Signal to service path"
          signals={["Diagnose", "Prioritize", "Resolve"]}
        />
      </section>

      <SignalJourney variant="solution" />

      <section className="section">
        <div className="service-grid">
          {solutionPages.map((solution) => (
            <Link className="service-card" href={`/solutions/${solution.slug}`} key={solution.slug}>
              <CardVisual title={solution.title} context={solution.eyebrow} />
              <p className="eyebrow">{solution.eyebrow}</p>
              <h2>{solution.title}</h2>
              <p>{solution.answer}</p>
              <span className="text-link">Open solution</span>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}
