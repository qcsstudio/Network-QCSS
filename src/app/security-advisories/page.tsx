import type { Metadata } from "next";
import Link from "next/link";
import { Radio, ShieldAlert } from "lucide-react";
import { AdvisoryDeskExplorer, type PublicAdvisoryRecord } from "@/components/advisory-desk-explorer";
import { StructuredData } from "@/components/structured-data";
import { SignalJourney } from "@/components/signal-journey";
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

export default async function SecurityAdvisoryDeskPage() {
  const advisories = await listSecurityAdvisories(100);
  const latestVerification = advisories.map((item) => item.lastVerifiedAt).sort((a, b) => b.getTime() - a.getTime())[0];
  const publicAdvisories: PublicAdvisoryRecord[] = advisories.map((advisory) => ({
    id: advisory.id,
    slug: advisory.slug,
    title: advisory.title,
    vendor: advisory.vendor,
    summary: advisory.summary,
    severity: advisory.severity,
    status: advisory.status,
    priorityScore: advisory.priorityScore,
    cvssScore: advisory.cvssScore,
    cves: Array.isArray(advisory.cves) ? advisory.cves.filter((item): item is string => typeof item === "string") : [],
    products: Array.isArray(advisory.products) ? advisory.products.filter((item): item is string => typeof item === "string") : [],
    exploitationStatus: advisory.exploitationStatus,
    vendorPublishedAt: advisory.vendorPublishedAt.toISOString(),
    vendorUpdatedAt: advisory.vendorUpdatedAt.toISOString(),
    lastVerifiedAt: advisory.lastVerifiedAt.toISOString()
  }));

  return (
    <main className="purpose-intelligence">
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
          <div className="advisory-live-signal"><Radio aria-hidden="true" size={17} /><span>Source monitor active</span></div>
          <ShieldAlert aria-hidden="true" size={36} />
          <strong>{advisories.length}</strong>
          <span>source-verified records</span>
          <small>{latestVerification ? `Latest verification: ${latestVerification.toLocaleString("en-IN")}` : "The live source scan is ready."}</small>
        </aside>
      </section>

      <SignalJourney variant="intelligence" />

      <section className="section" id="latest-advisories">
        <div className="section-heading">
          <p className="eyebrow">Live intelligence</p>
          <h2>See the items that can change today&apos;s patch or mitigation plan.</h2>
          <p>Priority combines source severity, known exploitation, remote attack conditions, recency, and network-edge relevance.</p>
        </div>

        {advisories.length ? (
          <AdvisoryDeskExplorer advisories={publicAdvisories} asOf={new Date().toISOString()} />
        ) : (
          <div className="content-empty-state">The official-source scanner is connected. New qualifying advisories will appear here automatically.</div>
        )}
      </section>
    </main>
  );
}
