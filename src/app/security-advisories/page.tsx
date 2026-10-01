import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Radio, ShieldAlert } from "lucide-react";
import { AdvisoryDeskExplorer, type PublicAdvisoryRecord } from "@/components/advisory-desk-explorer";
import { StructuredData } from "@/components/structured-data";
import { SignalJourney } from "@/components/signal-journey";
import { getPublicAdvisoryIndex } from "@/lib/public-advisory-index";
import { advisoryArchiveHref, advisoryArchivePage, normalizeAdvisoryQuery, type AdvisoryArchiveQuery } from "@/lib/advisory-archive";
import { siteConfig } from "@/lib/content";
import { createPageMetadata } from "@/lib/seo";
import { loadSection } from "@/lib/section-availability";
import { SectionUnavailable } from "@/components/section-unavailable";
import { readyAdvisoryImages } from "@/lib/advisory-image-availability";

export const dynamic = "force-dynamic";

const description = "Track source-verified vendor vulnerabilities, active exploitation, mitigations and patches for enterprise networks and cloud infrastructure with the QCS Security Advisory Desk.";
type AdvisoryPageProps = { searchParams: Promise<AdvisoryArchiveQuery> };

export async function generateMetadata({ searchParams }: AdvisoryPageProps): Promise<Metadata> {
  const query = normalizeAdvisoryQuery(await searchParams);
  const filtered = Boolean(query.q || query.severity !== "all" || query.vendor !== "all" || query.sort !== "priority");
  const metadata = createPageMetadata({
  title: "Network Security Vulnerabilities and Vendor Patch Advisories",
  description,
  path: advisoryArchiveHref(query),
  keywords: ["network security advisories", "firewall vulnerabilities", "vendor security patches", "CISA KEV", "Cisco PSIRT", "Fortinet PSIRT"]
  });
  if (query.page > 1) metadata.title = `Security Advisory Desk - Page ${query.page}`;
  if (filtered) metadata.robots = { index: false, follow: true };
  return metadata;
}

export default async function SecurityAdvisoryDeskPage({ searchParams }: AdvisoryPageProps) {
  const query = normalizeAdvisoryQuery(await searchParams);
  const result = await loadSection("Public advisory desk", getPublicAdvisoryIndex);
  const advisories = result.data ?? [];
  const imagesResult = await loadSection("Advisory artwork", () => readyAdvisoryImages(advisories));
  const latestVerification = advisories.map((item) => item.lastVerifiedAt).sort((a, b) => b.getTime() - a.getTime())[0];
  const publicAdvisories: PublicAdvisoryRecord[] = advisories.map((advisory) => ({
    id: advisory.id,
    image: imagesResult.data?.get(advisory.id) ?? null,
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
  const archive = advisoryArchivePage(publicAdvisories, query);
  if (result.available && query.page > archive.totalPages) notFound();

  return (
    <main className="purpose-intelligence">
      <StructuredData
        data={[
          {
            "@context": "https://schema.org",
            "@type": "CollectionPage",
            name: "QCS Security Advisory Desk",
            description,
            url: `${siteConfig.url}${advisoryArchiveHref(query)}`,
            isPartOf: { "@type": "WebSite", name: siteConfig.name, url: siteConfig.url }
          },
          {
            "@context": "https://schema.org",
            "@type": "ItemList",
            itemListElement: archive.items.map((advisory, index) => ({
              "@type": "ListItem",
              position: archive.start + index + 1,
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
          <div className="advisory-live-signal"><Radio aria-hidden="true" size={17} /><span>{result.available ? "Published advisory records" : "Data service unavailable"}</span></div>
          <ShieldAlert aria-hidden="true" size={36} />
          <strong>{result.available ? advisories.length : "Unavailable"}</strong>
          <span>{result.available ? "source-verified records" : "Live counts cannot be confirmed"}</span>
          <small>{latestVerification ? `Latest verification: ${latestVerification.toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })} IST` : "No current verification time available."}</small>
        </aside>
      </section>

      <SignalJourney variant="intelligence" />

      <section className="section" id="latest-advisories">
        <div className="section-heading">
          <p className="eyebrow">Live intelligence</p>
          <h2>See the items that can change today&apos;s patch or mitigation plan.</h2>
          <p>Priority combines source severity, known exploitation, remote attack conditions, recency, and network-edge relevance.</p>
        </div>

        {!result.available ? <SectionUnavailable title="Security advisory records" /> : advisories.length ? (
          <AdvisoryDeskExplorer key={advisoryArchiveHref(query)} advisories={publicAdvisories} asOf={new Date().toISOString()} initialQuery={query} />
        ) : (
          <div className="content-empty-state">No published advisories are available in this view.</div>
        )}
      </section>
    </main>
  );
}
