import Image from "next/image";
import { BlogArticle } from "@/components/blog-article";
import { StructuredData } from "@/components/structured-data";
import diagnostics from "@/content/website-only/fortigate-ztna-diagnostics.json";
import { siteConfig } from "@/lib/content";
import { createPageMetadata } from "@/lib/seo";
import { fortigateZtnaCaseStudy as post } from "@/lib/website-only-resources";
import styles from "./page.module.css";

// Website-only publication: request-time data or a social publishing dependency must fail the build.
export const dynamic = "error";

export const metadata = { ...createPageMetadata({
  title: post.metaTitle, description: post.description,
  path: `/resources/${post.slug}`, keywords: [post.primaryKeyword, ...post.keywords],
  image: { url: post.image, width: 2400, height: 1350, alt: post.imageAlt },
  article: { publishedTime: post.publishedAt, modifiedTime: post.updatedAt }
}), title: { absolute: post.metaTitle } };

export default function FortigateZtnaCaseStudyPage() {
  const url = `${siteConfig.url}/resources/${post.slug}`;
  const sectionExtras = {
    "Step 3: check device trust and user authentication separately": (
      <div className={styles.diagnostics}>
        <h3>{diagnostics.heading}</h3>
        <p>{diagnostics.introduction}</p>
        <p>{diagnostics.privacyNote}</p>
        <ol>
          {diagnostics.checks.map((check) => (
            <li key={check.command}>
              <h4>{check.purpose}</h4>
              <pre tabIndex={0} aria-label={`Command: ${check.purpose}`}><code>{check.command}</code></pre>
              <p><strong>Look for:</strong> {check.observation}</p>
              <p><strong>Does not prove:</strong> {check.limit}</p>
            </li>
          ))}
        </ol>
        <a href={diagnostics.sourceUrl} target="_blank" rel="noreferrer">Fortinet command reference (FortiOS 7.4.7)</a>
      </div>
    ),
    "Response options: choose a scoped correction": (
      <figure className={styles.figure}>
        <Image src="/images/editorial/fortigate-ztna-evidence-map.png" width={2400} height={1680}
          sizes="(max-width: 1080px) 100vw, 70vw" unoptimized
          alt="Six diagnostic checks: request and listener, device and user context, policy and mapping, backend connection, authorized application workflow and continued denial of unauthorized access." />
        <figcaption>A diagnostic checklist, not a universal packet-processing order or a record of customer tests. Investigate the first unproven boundary. Keep trust controls enabled.</figcaption>
        <a href="/images/editorial/fortigate-ztna-evidence-map.svg" target="_blank" rel="noreferrer">Open scalable troubleshooting map (new tab)</a>
      </figure>
    )
  };
  return (
    <main className={`purpose-resource ${styles.guide}`}>
      <StructuredData data={[
        {
          "@context": "https://schema.org", "@type": "TechArticle",
          headline: post.title, description: post.description, abstract: post.answer,
          image: { "@type": "ImageObject", url: `${siteConfig.url}${post.image}`, width: 2400, height: 1350, caption: post.imageAlt },
          datePublished: post.publishedAt, dateModified: post.updatedAt,
          inLanguage: "en", isAccessibleForFree: true, mainEntityOfPage: url,
          author: { "@type": "Organization", "@id": `${siteConfig.url}/#organization`, name: siteConfig.name },
          publisher: { "@type": "Organization", "@id": `${siteConfig.url}/#organization`, name: siteConfig.name },
          articleSection: post.category, citation: post.sources.map((source) => source.url)
        },
        { "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: [
          { "@type": "ListItem", position: 1, name: "Home", item: siteConfig.url },
          { "@type": "ListItem", position: 2, name: "Resources", item: `${siteConfig.url}/resources` },
          { "@type": "ListItem", position: 3, name: post.title, item: url }
        ] },
        { "@context": "https://schema.org", "@type": "FAQPage", mainEntity: post.questions.map((faq) => ({
          "@type": "Question", name: faq.question, acceptedAnswer: { "@type": "Answer", text: faq.answer }
        })) }
      ]} />
      <BlogArticle post={post} visualSrc={post.image} visualLinkLabel="View full-size application path"
        showLeadForm={false} sectionExtras={sectionExtras} />
    </main>
  );
}
