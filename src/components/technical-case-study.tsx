import Image from "next/image";
import { BlogArticle } from "@/components/blog-article";
import { StructuredData } from "@/components/structured-data";
import type { BlogPost } from "@/lib/blog";
import { siteConfig } from "@/lib/content";
import { createPageMetadata } from "@/lib/seo";
import styles from "@/app/resources/fortigate-ztna-connected-ems-application-access-troubleshooting/page.module.css";

type Diagnostics = {
  heading: string; introduction: string; privacyNote: string;
  checks: { command: string; purpose: string; observation: string; limit: string; stop: string; sourceUrl: string }[];
};

export function caseStudyMetadata(post: BlogPost) {
  return {
    ...createPageMetadata({ title: post.metaTitle, description: post.description, path: `/resources/${post.slug}`,
      keywords: [post.primaryKeyword, ...post.keywords], image: { url: post.image, width: 2400, height: 1350, alt: post.imageAlt },
      article: { publishedTime: post.publishedAt, modifiedTime: post.updatedAt } }),
    title: { absolute: post.metaTitle }
  };
}

// Presentation only. Publishing an article never dispatches or edits social jobs.
export function TechnicalCaseStudy({ post, diagram, diagnostics }: {
  post: BlogPost;
  diagram: { section: string; path: string; alt: string; caption: string };
  diagnostics?: Diagnostics & { section: string };
}) {
  const url = `${siteConfig.url}/resources/${post.slug}`;
  const extras = {
    [diagram.section]: <figure className={styles.figure}>
      <Image src={`${diagram.path}.png`} alt={diagram.alt} width={2400} height={1600} sizes="(max-width: 1080px) 100vw, 70vw" unoptimized />
      <figcaption>{diagram.caption}</figcaption>
      <a href={`${diagram.path}.svg`} target="_blank" rel="noreferrer">Open scalable diagram (new tab)</a>
    </figure>,
    ...(diagnostics ? { [diagnostics.section]: <div className={styles.diagnostics}>
      <h3>{diagnostics.heading}</h3><p>{diagnostics.introduction}</p><p>{diagnostics.privacyNote}</p>
      <ol>{diagnostics.checks.map(check => <li key={check.command}>
        <h4>{check.purpose}</h4>
        <pre tabIndex={0} aria-label={`Command: ${check.purpose}`}><code>{check.command}</code></pre>
        <p><strong>Look for:</strong> {check.observation}</p>
        <p><strong>Does not prove:</strong> {check.limit}</p>
        <p><strong>Finish:</strong> {check.stop}</p>
        <a href={check.sourceUrl} target="_blank" rel="noreferrer">Vendor reference for this observation</a>
      </li>)}</ol>
    </div> } : {})
  };
  return <main className={`purpose-resource ${styles.guide}`}>
    <StructuredData data={[
      { "@context": "https://schema.org", "@type": "TechArticle", headline: post.title, description: post.description, abstract: post.answer,
        image: { "@type": "ImageObject", url: `${siteConfig.url}${post.image}`, width: 2400, height: 1350, caption: post.imageAlt },
        datePublished: post.publishedAt, dateModified: post.updatedAt, inLanguage: "en", isAccessibleForFree: true, mainEntityOfPage: url,
        author: { "@type": "Organization", "@id": `${siteConfig.url}/#organization`, name: siteConfig.name },
        publisher: { "@type": "Organization", "@id": `${siteConfig.url}/#organization`, name: siteConfig.name },
        articleSection: post.category, citation: post.sources.map(s => s.url) },
      { "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: siteConfig.url },
        { "@type": "ListItem", position: 2, name: "Resources", item: `${siteConfig.url}/resources` },
        { "@type": "ListItem", position: 3, name: post.title, item: url } ] },
      { "@context": "https://schema.org", "@type": "FAQPage", mainEntity: post.questions.map(f => ({
        "@type": "Question", name: f.question, acceptedAnswer: { "@type": "Answer", text: f.answer } })) }
    ]} />
    <BlogArticle post={post} visualSrc={post.image} visualLinkLabel="View full-size evidence diagram" showLeadForm={false} sectionExtras={extras} />
  </main>;
}
