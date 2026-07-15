import type { Metadata } from "next";
import Link from "next/link";
import { StructuredData } from "@/components/structured-data";
import { networkUtilityTools } from "@/lib/network-tools";
import { siteConfig } from "@/lib/content";

export const metadata: Metadata = {
  title: "Free Online Network Tools for DNS, SSL, Email and Port Checks",
  description:
    "Run focused online network tools from QuantumCrafters Studio: DNS lookup, MX lookup, SPF and DMARC check, SSL certificate check, HTTP security header check, and port reachability check.",
  alternates: { canonical: "/network-tools" },
  keywords: [
    "online network tools",
    "dns lookup tool",
    "ssl certificate checker",
    "spf dmarc checker",
    "port checker",
    "network troubleshooting tools"
  ]
};

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
        <p className="eyebrow">Network utility layer</p>
        <h1>Free online network tools for fast DNS, SSL, email, and firewall triage.</h1>
        <p>
          Use these focused tools to check public network signals quickly. Every tool is built for useful troubleshooting
          first, then connected to QuantumCrafters Studio service workflows when a deeper fix is needed.
        </p>
      </section>

      <section className="section">
        <div className="utility-grid">
          {networkUtilityTools.map((tool) => {
            const Icon = tool.icon;
            return (
              <Link className="utility-card" href={`/network-tools/${tool.slug}`} key={tool.slug}>
                <Icon size={28} />
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
