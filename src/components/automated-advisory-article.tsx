import Image from 'next/image';
import Link from 'next/link';
import { ExternalLink } from 'lucide-react';
import { StructuredData } from './structured-data';
import { siteConfig } from '@/lib/content';
import { automatedAssetUrl, automatedCandidateHash, type ApprovedAdvisoryRelease } from '@/lib/automated-advisory-domain';
import styles from './reviewed-advisory-article.module.css';

type AutomatedAdvisoryArticleProps = {
  release: ApprovedAdvisoryRelease;
  canonical: string;
  publishedAt: string;
  modifiedAt: string;
};

function Paragraphs({ text }: { text: string }) {
  return text.split(/\n\s*\n/).map((paragraph, index) => <p key={index}>{paragraph}</p>);
}

export function AutomatedAdvisoryArticle({ release, canonical, publishedAt, modifiedAt }: AutomatedAdvisoryArticleProps) {
  const diagram = release.assets.find(asset => asset.key === 'diagram');
  if (!diagram) return null;
  const imageUrl = automatedAssetUrl(diagram);
  const organization = { '@type': 'Organization', name: siteConfig.name, url: siteConfig.url };

  return <main className={`purpose-intelligence ${styles.page}`}>
    <StructuredData data={{
      '@context': 'https://schema.org', '@type': 'TechArticle',
      headline: release.title, description: release.summary,
      datePublished: publishedAt, dateModified: modifiedAt,
      mainEntityOfPage: canonical, url: canonical, author: organization, publisher: organization,
      isAccessibleForFree: true, citation: release.sources.map(source => source.url),
      about: [...release.cves, ...release.products],
      image: { '@type': 'ImageObject', url: imageUrl, width: diagram.width, height: diagram.height, caption: diagram.alt }
    }} />
    <article data-automated-release={release.releaseId} data-automated-candidate={automatedCandidateHash(release)}>
      <header className={styles.header}>
        <Link href="/security-advisories" className="text-link">Security Advisory Desk</Link>
        <p className="eyebrow">{release.vendor} / Security advisory</p>
        <h1>{release.title}</h1>
        <p>{release.summary}</p>
        <p className={styles.meta}>Published by {siteConfig.name}</p>
        <p className={styles.meta}>
          QCS published <time dateTime={publishedAt}>{new Date(publishedAt).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' })}</time>
          {' | Updated '}<time dateTime={modifiedAt}>{new Date(modifiedAt).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' })}</time>
          {' | Vendor disclosure '}<time dateTime={release.vendorPublishedAt}>{new Date(release.vendorPublishedAt).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' })}</time>
        </p>
      </header>
      <div className={styles.layout}>
        <nav className={styles.outline} aria-label="In this advisory">
          <strong>In this advisory</strong>
          <a href="#mechanism">How the issue works</a>
          <a href="#affected">Severity and affected conditions</a>
          <a href="#actions">Remediation and workaround</a>
          <a href="#verification">Verification</a>
          <a href="#recovery">Recovery</a>
          {release.definitions.length ? <a href="#terms">Key terms</a> : null}
          {release.sections.map((section, index) => <a key={index} href={`#advisory-section-${index}`}>{section.heading}</a>)}
          <a href="#limitations">Scope and limitations</a>
          <a href="#sources">Original sources</a>
        </nav>
        <div className={styles.body}>
          <section id="mechanism">
            <h2>How the issue works</h2>
            <Paragraphs text={release.mechanism} />
            <figure className={styles.diagram}>
              <Image src={imageUrl} alt={diagram.alt} width={diagram.width} height={diagram.height}
                sizes="(max-width: 1000px) 100vw, 976px" unoptimized />
              <figcaption>{diagram.alt}</figcaption>
            </figure>
          </section>
          <section id="affected">
            <h2>Severity and affected conditions</h2>
            <dl>
              <div><dt>Severity</dt><dd>{release.severity}</dd></div>
              <div><dt>CVSS score</dt><dd>{release.cvssScore ?? 'Not supplied'}</dd></div>
              <div><dt>Exploitation status</dt><dd>{release.exploitationStatus}</dd></div>
              <div><dt>CVE identifiers</dt><dd>{release.cves.join(', ') || 'Not supplied'}</dd></div>
              <div><dt>Products</dt><dd>{release.products.join(', ')}</dd></div>
              <div><dt>Affected versions</dt><dd>{release.affectedVersions.join(', ') || 'Confirm in the original advisory'}</dd></div>
              <div><dt>Fixed versions</dt><dd>{release.fixedVersions.join(', ') || 'Confirm in the original advisory'}</dd></div>
            </dl>
            <p>Severity describes technical impact, not confirmation that every deployment is exposed. Compare your environment with the affected conditions before planning changes.</p>
            <Paragraphs text={release.affectedConditions} />
          </section>
          <section id="actions">
            <h2>Remediation and workaround</h2>
            <h3>Remediation</h3>
            <Paragraphs text={release.remediation} />
            <h3>Workaround</h3>
            {release.workaround ? <Paragraphs text={release.workaround} /> : <p>No workaround is specified in this release. Consult the original advisory before applying temporary controls.</p>}
          </section>
          <section id="verification"><h2>Verify the change</h2><Paragraphs text={release.verification} /></section>
          <section id="recovery"><h2>Recovery and rollback</h2><Paragraphs text={release.recovery} /></section>
          {release.definitions.length ? <section id="terms">
            <h2>Key terms, explained</h2>
            <dl>{release.definitions.map((definition, index) => <div key={index}><dt>{definition.term}</dt><dd>{definition.definition}</dd></div>)}</dl>
          </section> : null}
          {release.sections.map((section, index) => <section id={`advisory-section-${index}`} key={index}>
            <h2>{section.heading}</h2>
            <Paragraphs text={section.body} />
            {section.bullets?.length ? <ul>{section.bullets.map((bullet, bulletIndex) => <li key={bulletIndex}>{bullet}</li>)}</ul> : null}
            {section.sourceUrls.map(url => <a className={styles.reference} key={url} href={url} target="_blank" rel="noreferrer">
              {url} <ExternalLink size={14} aria-hidden="true" />
            </a>)}
          </section>)}
          <section id="limitations"><h2>Scope and limitations</h2><ul>{release.limitations.map((limitation, index) => <li key={index}>{limitation}</li>)}</ul></section>
          <section id="sources">
            <h2>Original sources</h2>
            <ol>{release.sources.map(source => <li key={source.url}>
              <a href={source.url} target="_blank" rel="noreferrer">{source.url} <ExternalLink size={14} aria-hidden="true" /></a>
            </li>)}</ol>
          </section>
        </div>
      </div>
    </article>
  </main>;
}
