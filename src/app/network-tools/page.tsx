import type { Metadata } from "next";
import Link from "next/link";
import { CardVisual } from "@/components/card-visual";
import { StructuredData } from "@/components/structured-data";
import { networkUtilityTools } from "@/lib/network-tools";
import { siteConfig } from "@/lib/content";
import { createPageMetadata } from "@/lib/seo";

export const metadata: Metadata = createPageMetadata({
  title: "Free Online Network Tools and Vendor Script Generator",
  description:
    "Run DNS, SSL, email, redirect, subnet, reverse DNS, CAA, port checks, and generate Cisco, FortiGate, and Juniper troubleshooting command plans.",
  path: "/network-tools",
  keywords: [
    "online network tools",
    "dns lookup tool",
    "ssl certificate checker",
    "spf dmarc checker",
    "port checker",
    "subnet calculator",
    "packet capture command generator",
    "network troubleshooting tools"
  ]
});

export default function NetworkToolsPage() {
  return (
    <main>
      <StructuredData
        data={[
          {
            "@context": "https://schema.org",
            "@type": "CollectionPage",
            name: "Free Online Network Tools",
            description: metadata.description,
            url: `${siteConfig.url}/network-tools`,
            isPartOf: {
              "@type": "WebSite",
              name: siteConfig.name,
              url: siteConfig.url
            }
          },
          {
            "@context": "https://schema.org",
            "@type": "ItemList",
            itemListElement: networkUtilityTools.map((tool, index) => ({
              "@type": "ListItem",
              position: index + 1,
              url: `${siteConfig.url}/network-tools/${tool.slug}`,
              name: tool.title
            }))
          }
        ]}
      />
      <section className="page-hero">
        <p className="eyebrow">Network utility hub</p>
        <h1>Free online network tools for checks, subnet planning, and vendor task scripts.</h1>
        <p>
          Use focused tools to check public network signals, calculate practical IPv4 ranges, and generate
          operator-ready Cisco, FortiGate, and Juniper troubleshooting plans before deeper work begins.
        </p>
      </section>

      <section className="section split">
        <div className="answer-panel">
          <p className="eyebrow">Quick diagnosis</p>
          <h2>Short tools help technical teams validate symptoms before booking a call.</h2>
          <p>
            DNS, MX, SPF/DMARC, SSL, header, redirect, CAA, reverse DNS, subnet, port, and command-plan tools reveal
            intent around outages, email delivery, public exposure, routing, firewall access, and website security.
          </p>
        </div>
        <div className="answer-panel muted">
          <p className="eyebrow">Next-step path</p>
          <h2>The result becomes a practical decision point, not a dead end.</h2>
          <p>
            If a check shows risk or uncertainty, the next step can move into assessment, remediation, managed support,
            or a focused engineering review.
          </p>
        </div>
      </section>

      <section className="section">
        <div className="utility-grid">
          {networkUtilityTools.map((tool) => {
            const Icon = tool.icon;
            return (
              <Link className="utility-card" href={`/network-tools/${tool.slug}`} key={tool.slug}>
                <CardVisual title={tool.title} context={tool.category} icon={Icon} />
                <p className="eyebrow">{tool.category}</p>
                <h2>{tool.title}</h2>
                <p>{tool.description}</p>
                <span className="text-link">Open tool</span>
              </Link>
            );
          })}
        </div>
      </section>
    </main>
  );
}
