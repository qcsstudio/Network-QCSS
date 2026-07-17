import type { Metadata } from "next";
import Link from "next/link";
import { CardVisual } from "@/components/card-visual";
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
    <main>
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
      <section className="page-hero">
        <p className="eyebrow">Solution hub</p>
        <h1>Network and security solutions organized by the problem buyers actually search for.</h1>
        <p>
          Each solution gives a direct answer, explains the risk, links to the right service path, and routes visitors
          into an assessment or technical tool.
        </p>
      </section>

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
