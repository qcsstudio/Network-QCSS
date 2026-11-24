import Image from "next/image";
import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { StructuredData } from "@/components/structured-data";
import styles from "@/components/reviewed-advisory-article.module.css";
import { siteConfig } from "@/lib/content";
import { createPageMetadata } from "@/lib/seo";
import {
  vmwareGuide as guide, vmwareResource, vmwareGuidePath, vmwareGuideContentSha256,
  vmwareDiagram, vmwareCardImage, vmwareSourceLabels
} from "@/lib/vmware-vmsa-2026-0011-resource";

export const dynamic = "error";

export const metadata = {
  ...createPageMetadata({
    title: vmwareResource.metaTitle, description: guide.summary, path: vmwareGuidePath,
    keywords: vmwareResource.keywords,
    image: { url: vmwareCardImage.src, width: vmwareCardImage.width, height: vmwareCardImage.height, alt: vmwareCardImage.alt },
    article: { publishedTime: vmwareResource.publishedAt, modifiedTime: vmwareResource.updatedAt }
  }),
  title: { absolute: vmwareResource.metaTitle }
};

function Paragraphs({ text }: { text: string }) {
  return text.split(/\n\s*\n/).map((paragraph, i) => <p key={i}>{paragraph}</p>);
}
function TextList({ items }: { items: readonly string[] }) {
  return <ul>{items.map((item, i) => <li key={i}>{item}</li>)}</ul>;
}

export default function VMwarePatchingGuidePage() {
  const canonical = new URL(vmwareGuidePath, siteConfig.url).href;
  const organization = { "@type": "Organization", name: siteConfig.name, url: siteConfig.url };
  const dateLabel = new Date(vmwareResource.publishedAt).toLocaleDateString("en-IN", {
    timeZone: "Asia/Kolkata", day: "numeric", month: "long", year: "numeric"
  });
  return <main className={`purpose-intelligence ${styles.page}`}>
    <StructuredData data={[
      {
        "@context": "https://schema.org", "@type": "TechArticle",
        headline: guide.title, description: guide.summary, abstract: guide.mechanism,
        datePublished: vmwareResource.publishedAt, dateModified: vmwareResource.updatedAt,
        mainEntityOfPage: canonical, url: canonical, inLanguage: "en", isAccessibleForFree: true,
        author: organization, publisher: organization,
        citation: guide.sources.map(source => source.url), about: [...guide.cves, ...guide.products],
        image: { "@type": "ImageObject", url: `${siteConfig.url}${vmwareDiagram.src}`,
          width: vmwareDiagram.width, height: vmwareDiagram.height, caption: vmwareDiagram.alt }
      },
      { "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: siteConfig.url },
        { "@type": "ListItem", position: 2, name: "Resources", item: `${siteConfig.url}/resources` },
        { "@type": "ListItem", position: 3, name: guide.title, item: canonical }
      ] }
    ]} />
    <article data-vmware-guide={guide.externalId} data-guide-content-sha256={vmwareGuideContentSha256}>
      <header className={styles.header}>
        <Link className="text-link" href="/resources">Blog and resources</Link>
        <p className="eyebrow">VMware / Security guidance</p>
        <h1>{guide.title}</h1>
        <p>{guide.summary}</p>
        <p className={styles.meta}>Published by {siteConfig.name}</p>
        <p className={styles.meta}>QCS published <time dateTime={vmwareResource.publishedAt}>{dateLabel}</time>
          {" | Vendor disclosure "}<time dateTime="2026-11-24">24 November 2026</time></p>
      </header>
      <div className={styles.layout}>
        <nav className={styles.outline} aria-label="In this guide">
          <strong>In this guide</strong>
          <a href="#overview">How the issues differ</a>
          <a href="#affected">Scope and patch targets</a>
          <a href="#actions">Remediation</a>
          <a href="#workarounds">Scoped workarounds</a>
          <a href="#verification">Activation and verification</a>
          <a href="#recovery">Recovery</a>
          <a href="#terms">Key terms</a>
          {guide.sections.map((section, i) => <a key={i} href={`#vmware-section-${i}`}>{section.heading}</a>)}
          <a href="#limitations">Scope and limitations</a>
          <a href="#sources">Original sources</a>
        </nav>
        <div className={styles.body}>
          <section id="overview">
            <h2>How the issues differ</h2>
            <Paragraphs text={guide.mechanism} />
            <figure className={styles.diagram} style={{ maxWidth: 540 }}>
              <Image src={vmwareDiagram.src} width={vmwareDiagram.width} height={vmwareDiagram.height}
                alt={vmwareDiagram.alt} sizes="(max-width: 640px) 100vw, 540px" unoptimized />
              <figcaption>{vmwareDiagram.alt}</figcaption>
              <a className={styles.reference} href={vmwareDiagram.src} target="_blank" rel="noreferrer">
                Open full-size patch-lane diagram <ExternalLink size={14} aria-hidden="true" />
              </a>
            </figure>
          </section>
          <section id="affected">
            <h2>Scope and patch targets</h2>
            <dl>
              <div><dt>Vendor advisory severity</dt><dd>{guide.severity} overall; individual severity varies</dd></div>
              <div><dt>Maximum published CVSS 3.1 score</dt><dd>{guide.cvssScore}; individual CVEs range from 3.4 to 9.8</dd></div>
              <div><dt>Exploitation evidence</dt><dd><Paragraphs text={guide.exploitationStatus} /></dd></div>
              <div><dt>CVE identifiers ({guide.cves.length})</dt><dd>{guide.cves.join(", ")}</dd></div>
              <div><dt>Products</dt><dd><TextList items={guide.products} /></dd></div>
              <div><dt>Affected branches</dt><dd><TextList items={guide.affectedVersions} /></dd></div>
              <div><dt>Fixed and pending targets</dt><dd><TextList items={guide.fixedVersions} /></dd></div>
            </dl>
            <Paragraphs text={guide.affectedConditions} />
          </section>
          <section id="actions"><h2>Remediation and change plan</h2><Paragraphs text={guide.remediation} /></section>
          <section id="workarounds"><h2>Scoped workarounds</h2><Paragraphs text={guide.workaround} /></section>
          <section id="verification"><h2>Activation and application verification</h2><Paragraphs text={guide.verification} /></section>
          <section id="recovery"><h2>Recovery and stop conditions</h2><Paragraphs text={guide.recovery} /></section>
          <section id="terms"><h2>Key terms, explained</h2><dl>
            {guide.definitions.map(item => <div key={item.term}><dt>{item.term}</dt><dd>{item.definition}</dd></div>)}
          </dl></section>
          {guide.sections.map((section, i) => <section key={i} id={`vmware-section-${i}`}>
            <h2>{section.heading}</h2><Paragraphs text={section.body} />
            {section.bullets ? <TextList items={section.bullets} /> : null}
            {section.sourceUrls.map(url => <a className={styles.reference} key={url} href={url} target="_blank" rel="noreferrer">
              {vmwareSourceLabels[guide.sources.findIndex(source => source.url === url)] || url}
              <ExternalLink size={14} aria-hidden="true" />
            </a>)}
          </section>)}
          <section id="limitations"><h2>Scope and limitations</h2><TextList items={guide.limitations} /></section>
          <section id="sources"><h2>Original sources</h2><ol>
            {guide.sources.map((source, i) => <li key={source.url}>
              <a href={source.url} target="_blank" rel="noreferrer">{vmwareSourceLabels[i]} <ExternalLink size={14} aria-hidden="true" /></a>
            </li>)}
          </ol></section>
        </div>
      </div>
    </article>
  </main>;
}
