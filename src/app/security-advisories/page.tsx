import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ShieldAlert } from "lucide-react";
import { StructuredData } from "@/components/structured-data";
import { listSecurityAdvisories } from "@/lib/advisories";
import { siteConfig } from "@/lib/content";
import { createPageMetadata } from "@/lib/seo";

export const dynamic = "force-dynamic";

export const metadata: Metadata = createPageMetadata({
  title: "Network Security Vulnerabilities and Vendor Patch Advisories",
  description: "Track source-verified Cisco, Fortinet, Palo Alto and CISA vulnerability, exploitation, mitigation and patch advisories from the QCS Security Advisory Desk.",
  path: "/security-advisories",
  keywords: ["network security advisories", "firewall vulnerabilities", "vendor security patches", "CISA KEV", "Cisco PSIRT", "Fortinet PSIRT"]
});

function strings(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

export default async function SecurityAdvisoryDeskPage() {
  const advisories = await listSecurityAdvisories(100);
  const latestVerification = advisories.map((item) => item.lastVerifiedAt).sort((a, b) => b.getTime() - a.getTime())[0];

  return (
    <main>
      <StructuredData
        data={[
          {
            "@context": "https://schema.org",
            "@type": "CollectionPage",
            name: "QCS Security Advisory Desk",
            description: metadata.description,
            url: `${siteConfig.url}/security-advisories`,
            isPartOf: { "@type": "WebSite", name: siteConfig.name, url: siteConfig.url }
          },
          {
            "@context": "https://schema.org",
            "@type": "ItemList",
            itemListElement: advisories.map((advisory, index) => ({
              "@type": "ListItem",
              position: index + 1,
              name: advisory.title,
              url: `${siteConfig.url}/security-advisories/${advisory.slug}`
            }))
          }
        ]}
      />

      <section className="page-hero advisory-desk-hero">
        <div>
          <p className="eyebrow">QCS Security Advisory Desk</p>
          <h1>Network vulnerabilities and vendor patches, verified at the source.</h1>
          <p>
            Monitor network-edge vulnerabilities, known exploitation, affected products, mitigations, and vendor patch
            guidance without waiting for a weekly editorial cycle.
          </p>
          <div className="button-row">
            <a className="button primary" href="#latest-advisories">View latest advisories</a>
            <a className="button secondary" href="/security-advisories/feed.xml">Subscribe to feed</a>
            <Link className="button secondary" href="/resources">Blog and resources</Link>
          </div>
        </div>
        <aside className="advisory-live-panel" aria-label="Advisory desk status">
          <ShieldAlert aria-hidden="true" size={36} />
          <strong>{advisories.length}</strong>
          <span>source-verified advisories</span>
          <small>{latestVerification ? `Last verified ${latestVerification.toLocaleString("en-IN")}` : "The live source scan is ready."}</small>
        </aside>
      </section>

      <section className="section" id="latest-advisories">
        <div className="section-heading">
          <p className="eyebrow">Live intelligence</p>
          <h2>Prioritized for network and security teams.</h2>
          <p>Priority combines source severity, known exploitation, remote attack conditions, recency, and network-edge relevance.</p>
        </div>

        {advisories.length ? (
          <div className="advisory-grid">
            {advisories.map((advisory, index) => {
              const products = strings(advisory.products);
              const cves = strings(advisory.cves);
              return (
                <article className="advisory-card" key={advisory.id}>
                  <Link className="advisory-card-media" href={`/security-advisories/${advisory.slug}`}>
                    <Image
                      alt={`${advisory.vendor} ${advisory.severity} security advisory`}
                      fill
                      priority={index < 2}
                      sizes="(max-width: 760px) 100vw, (max-width: 1180px) 50vw, 33vw"
                      src={`/security-advisories/${advisory.slug}/opengraph-image`}
                    />
                  </Link>
                  <div className="advisory-card-body">
                    <div className="advisory-card-meta">
                      <span className={`severity-pill severity-${advisory.severity}`}>{advisory.severity}</span>
                      <span>Priority {advisory.priorityScore}/100</span>
                    </div>
                    <p className="eyebrow">{advisory.vendor}</p>
                    <h2><Link href={`/security-advisories/${advisory.slug}`}>{advisory.title}</Link></h2>
                    <p>{advisory.summary}</p>
                    <div className="advisory-tags">
                      {[...cves, ...products].slice(0, 4).map((value) => <span key={value}>{value}</span>)}
                    </div>
                    <div className="blog-meta">
                      <span>{advisory.vendorPublishedAt.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</span>
                      <span>{advisory.exploitationStatus}</span>
                    </div>
                    <Link className="text-link" href={`/security-advisories/${advisory.slug}`}>Open advisory</Link>
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="content-empty-state">The official-source scanner is connected. New qualifying advisories will appear here automatically.</div>
        )}
      </section>
    </main>
  );
}
