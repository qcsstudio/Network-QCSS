import type { Metadata } from "next";
import { cache } from "react";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AlertTriangle, CheckCircle2, Clock3, ExternalLink, ShieldCheck } from "lucide-react";
import { StructuredData } from "@/components/structured-data";
import { getSecurityAdvisory } from "@/lib/advisories";
import { siteConfig } from "@/lib/content";
import { createPageMetadata } from "@/lib/seo";
import { readyAdvisoryImages } from "@/lib/advisory-image-availability";
import { loadSection } from "@/lib/section-availability";

type AdvisoryPageProps = { params: Promise<{ slug: string }> };

export const dynamic = "force-dynamic";
const loadAdvisory = cache(getSecurityAdvisory);
const loadAdvisoryImage = cache(async (slug: string) => {
  const advisory = await loadAdvisory(slug);
  if (!advisory) return undefined;
  const result = await loadSection("Advisory artwork", () => readyAdvisoryImages([advisory]));
  return result.data?.get(advisory.id);
});

function strings(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

export async function generateMetadata({ params }: AdvisoryPageProps): Promise<Metadata> {
  const { slug } = await params;
  const advisory = await loadAdvisory(slug);
  if (!advisory) return {};
  const image = await loadAdvisoryImage(slug);
  const metadata = createPageMetadata({
    title: advisory.title,
    description: advisory.summary,
    path: `/security-advisories/${advisory.slug}`,
    ...(image ? { image: { url: image.url.replace("variant=hero", "variant=social"), width: 1200, height: 627, alt: image.altText } } : {}),
    article: { publishedTime: advisory.firstSeenAt.toISOString(), modifiedTime: (advisory.revisions[0]?.createdAt || advisory.updatedAt).toISOString() },
    keywords: [advisory.vendor, ...strings(advisory.cves), ...strings(advisory.products), "security advisory", "vendor patch"]
  });
  if (!image) {
    metadata.openGraph = { ...metadata.openGraph, images: [] };
    metadata.twitter = { ...metadata.twitter, card: "summary", images: [] };
  }
  return metadata;
}

export default async function SecurityAdvisoryPage({ params }: AdvisoryPageProps) {
  const { slug } = await params;
  const advisory = await loadAdvisory(slug);
  if (!advisory) notFound();
  const cves = strings(advisory.cves);
  const products = strings(advisory.products);
  const affectedVersions = strings(advisory.affectedVersions);
  const fixedVersions = strings(advisory.fixedVersions);
  const evidenceChecklist = strings(advisory.evidenceChecklist);
  const image = await loadAdvisoryImage(slug);

  return (
    <main className="purpose-intelligence">
      <StructuredData
        data={[
          {
            "@context": "https://schema.org",
            "@type": "TechArticle",
            headline: advisory.title,
            description: advisory.summary,
            ...(image ? { image: `${siteConfig.url}${image.url}` } : {}),
            datePublished: advisory.firstSeenAt.toISOString(),
            dateModified: (advisory.revisions[0]?.createdAt || advisory.updatedAt).toISOString(),
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
        <section className={`page-hero advisory-article-hero${image ? "" : " advisory-without-image"}`}>
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
              <span>QCS published {advisory.firstSeenAt.toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })} IST</span>
              <span>Vendor disclosure {advisory.vendorPublishedAt.toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })} IST</span>
              <span>Verified {advisory.lastVerifiedAt.toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })} IST</span>
              <span>Revision {advisory.revisions[0]?.version || 1}</span>
            </div>
          </div>
          {image ? <div className="advisory-article-media">
            <Image
              alt={image.altText}
              fill
              priority
              sizes="(max-width: 1080px) 100vw, 42vw"
              src={image.url}
              unoptimized
            />
          </div> : null}
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
            <section>
              <p className="eyebrow">In plain language</p>
              <h2>What this advisory means</h2>
              <p>{advisory.summary}</p>
            </section>

            <section>
              <p className="eyebrow">Technical explanation</p>
              <h2>How the issue affects the environment</h2>
              <p>{advisory.technicalExplanation || "The official source does not yet provide enough detail for a separate technical explanation."}</p>
            </section>

            <section>
              <p className="eyebrow">Operational impact</p>
              <h2>Why teams should care</h2>
              <p>{advisory.businessImpact || "Confirm the affected service, exposure path, and business dependency before assigning impact."}</p>
            </section>

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
              <h2>Evidence and validation checklist</h2>
              <ul className="check-list">
                {(evidenceChecklist.length
                  ? evidenceChecklist
                  : [
                      "Confirm the deployed product, release, exposure path, and accountable owner.",
                      "Read the complete vendor advisory and verify every affected-version condition.",
                      "Back up configuration and define rollback criteria before remediation.",
                      "Apply the fixed release or documented mitigation through controlled change.",
                      "Retest exposure, service health, logs, and evidence after the change."
                    ]
                ).map((item) => <li key={item}>{item}</li>)}
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
