import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AlertTriangle, CheckCircle2, Clock3, ExternalLink, ShieldCheck } from "lucide-react";
import { StructuredData } from "@/components/structured-data";
import { getSecurityAdvisory } from "@/lib/advisories";
import { siteConfig } from "@/lib/content";
import { createPageMetadata } from "@/lib/seo";

type AdvisoryPageProps = { params: Promise<{ slug: string }> };

export const dynamic = "force-dynamic";

function strings(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function practicalMetaTitle(title: string) {
  const suffix = " | Advisory";
  if (`${title}${suffix}`.length <= 60) return `${title}${suffix}`;
  const available = 60 - suffix.length;
  const shortened = title.slice(0, available).replace(/\s+\S*$/, "").trim();
  return `${shortened}${suffix}`;
}

export async function generateMetadata({ params }: AdvisoryPageProps): Promise<Metadata> {
  const { slug } = await params;
  const advisory = await getSecurityAdvisory(slug);
  if (!advisory) return {};
  return createPageMetadata({
    title: practicalMetaTitle(advisory.title),
    description: advisory.summary.slice(0, 160),
    path: `/security-advisories/${advisory.slug}`,
    keywords: [advisory.vendor, ...strings(advisory.cves), ...strings(advisory.products), "security advisory", "vendor patch"]
  });
}

export default async function SecurityAdvisoryPage({ params }: AdvisoryPageProps) {
  const { slug } = await params;
  const advisory = await getSecurityAdvisory(slug);
  if (!advisory) notFound();
  const cves = strings(advisory.cves);
  const products = strings(advisory.products);
  const affectedVersions = strings(advisory.affectedVersions);
  const fixedVersions = strings(advisory.fixedVersions);

  return (
    <main>
      <StructuredData
        data={[
          {
            "@context": "https://schema.org",
            "@type": "TechArticle",
            headline: advisory.title,
            description: advisory.summary,
            image: `${siteConfig.url}/security-advisories/${advisory.slug}/opengraph-image`,
            datePublished: advisory.vendorPublishedAt.toISOString(),
            dateModified: advisory.vendorUpdatedAt.toISOString(),
            mainEntityOfPage: `${siteConfig.url}/security-advisories/${advisory.slug}`,
            author: { "@type": "Organization", name: siteConfig.name, url: siteConfig.url },
            publisher: {
              "@type": "Organization",
              name: siteConfig.name,
              url: siteConfig.url,
              logo: { "@type": "ImageObject", url: `${siteConfig.url}/brand/quantumcrafters-logo.png` }
            },
            citation: advisory.sourceUrl,
            about: [...cves, ...products]
          },
          {
            "@context": "https://schema.org",
            "@type": "BreadcrumbList",
            itemListElement: [
              { "@type": "ListItem", position: 1, name: "Home", item: siteConfig.url },
              { "@type": "ListItem", position: 2, name: "Security Advisories", item: `${siteConfig.url}/security-advisories` },
              { "@type": "ListItem", position: 3, name: advisory.title, item: `${siteConfig.url}/security-advisories/${advisory.slug}` }
            ]
          }
        ]}
      />

      <article>
        <section className="page-hero advisory-article-hero">
          <div>
            <Link className="text-link" href="/security-advisories">Security Advisory Desk</Link>
            <div className="advisory-card-meta">
              <span className={`severity-pill severity-${advisory.severity}`}>{advisory.severity}</span>
              <span>QCS priority {advisory.priorityScore}/100</span>
              <span>{advisory.vendor}</span>
            </div>
            <h1>{advisory.title}</h1>
            <p>{advisory.summary}</p>
            <div className="blog-meta">
              <span>Published {advisory.vendorPublishedAt.toLocaleString("en-IN")}</span>
              <span>Verified {advisory.lastVerifiedAt.toLocaleString("en-IN")}</span>
              <span>Revision {advisory.revisions[0]?.version || 1}</span>
            </div>
          </div>
          <div className="advisory-article-media">
            <Image
              alt={`${advisory.vendor} ${advisory.severity} network security advisory visual`}
              fill
              priority
              sizes="(max-width: 900px) 100vw, 42vw"
              src={`/security-advisories/${advisory.slug}/visual`}
            />
          </div>
        </section>

        <section className="section advisory-article-layout">
          <aside className="advisory-facts" aria-label="Advisory facts">
            <div><span>Vendor</span><strong>{advisory.vendor}</strong></div>
            <div><span>Severity</span><strong>{advisory.severity}</strong></div>
            <div><span>CVSS</span><strong>{advisory.cvssScore ?? "Not supplied"}</strong></div>
            <div><span>Exploitation</span><strong>{advisory.exploitationStatus}</strong></div>
            <div><span>Products</span><strong>{products.join(", ") || "See vendor source"}</strong></div>
            <div><span>CVE identifiers</span><strong>{cves.join(", ") || "Not supplied"}</strong></div>
          </aside>

          <div className="advisory-article-body">
            <section className="answer-panel advisory-action-panel">
              <p className="eyebrow"><AlertTriangle aria-hidden="true" size={18} /> Immediate action</p>
              <h2>{advisory.remediation}</h2>
            </section>

            <section>
              <h2>Affected and fixed releases</h2>
              <div className="advisory-version-grid">
                <div><Clock3 aria-hidden="true" /><span>Affected versions</span><strong>{affectedVersions.join(", ") || "Confirm in the official vendor advisory"}</strong></div>
                <div><CheckCircle2 aria-hidden="true" /><span>Fixed versions</span><strong>{fixedVersions.join(", ") || "Confirm in the official vendor advisory"}</strong></div>
              </div>
            </section>

            <section>
              <h2>Temporary risk reduction</h2>
              <p>{advisory.workaround || "No separate workaround was supplied in the source feed. Use the official vendor advisory before changing production controls."}</p>
            </section>

            <section>
              <h2>Operational validation checklist</h2>
              <ul className="check-list">
                <li>Confirm the deployed product, release, exposure path, and accountable owner.</li>
                <li>Read the complete vendor advisory and verify every affected-version condition.</li>
                <li>Back up configuration and define rollback criteria before remediation.</li>
                <li>Apply the fixed release or documented mitigation through controlled change.</li>
                <li>Retest exposure, service health, logs, and evidence after the change.</li>
              </ul>
            </section>

            <section className="official-source-panel">
              <ShieldCheck aria-hidden="true" size={26} />
              <div>
                <p className="eyebrow">Authoritative reference</p>
                <h2>{advisory.source.name}</h2>
                <p>QCS detected and normalized this record from the official source. Vendor guidance remains authoritative.</p>
              </div>
              <a className="button secondary" href={advisory.sourceUrl} rel="noreferrer" target="_blank">
                Open source <ExternalLink aria-hidden="true" size={17} />
              </a>
            </section>
          </div>
        </section>
      </article>
    </main>
  );
}
