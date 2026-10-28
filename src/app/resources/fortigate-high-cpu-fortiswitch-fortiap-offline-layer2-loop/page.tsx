import Image from "next/image";
import { BlogArticle } from "@/components/blog-article";
import { StructuredData } from "@/components/structured-data";
import diagnostics from "@/content/website-only/fortigate-layer2-loop-diagnostics.json";
import { siteConfig } from "@/lib/content";
import { createPageMetadata } from "@/lib/seo";
import { fortigateLayer2LoopCaseStudy as post } from "@/lib/website-only-resources";
import styles from "../fortigate-ztna-connected-ems-application-access-troubleshooting/page.module.css";

// No request-time database or social-publishing dependency is permitted here.
export const dynamic = "error";

export const metadata = {
  ...createPageMetadata({
    title: post.metaTitle, description: post.description, path: `/resources/${post.slug}`,
    keywords: [post.primaryKeyword, ...post.keywords],
    image: { url: post.image, width: 2400, height: 1350, alt: post.imageAlt },
    article: { publishedTime: post.publishedAt, modifiedTime: post.updatedAt }
  }),
  title: { absolute: post.metaTitle }
};

export default function FortigateLayer2LoopCaseStudyPage() {
  const url = `${siteConfig.url}/resources/${post.slug}`;
  const sectionExtras = {
    "How the mechanism works: a loop can look like a controller outage": (
      <figure className={styles.figure}>
        <Image src="/images/editorial/fortigate-loop-topology.png" width={2400} height={1600}
          sizes="(max-width: 1080px) 100vw, 70vw" unoptimized
          alt="Teaching example: Switch A, B and C form a forwarding triangle. Isolating the confirmed faulty A-to-C edge leaves A-to-B-to-C connected. This is not customer cabling." />
        <figcaption>Illustrative forwarding paths, not customer cabling or a packet capture. A designed redundant link is not automatically a fault. AP wiring, HA and aggregates are omitted; verify them in the real design before any isolation.</figcaption>
        <a href="/images/editorial/fortigate-loop-topology.svg" target="_blank" rel="noreferrer">Open scalable teaching diagram (new tab)</a>
      </figure>
    ),
    "Step 2: classify CPU load and compare interface traffic": (
      <div className={styles.diagnostics}>
        <h3>{diagnostics.heading}</h3>
        <p>{diagnostics.introduction}</p>
        <p>{diagnostics.privacyNote}</p>
        <ol>{diagnostics.checks.map((check) => (
          <li key={check.command}>
            <h4>{check.purpose}</h4>
            <pre tabIndex={0} aria-label={`Command: ${check.purpose}`}><code>{check.command}</code></pre>
            <p><strong>Look for:</strong> {check.observation}</p>
            <p><strong>Does not prove:</strong> {check.limit}</p>
            <p><strong>Finish:</strong> {check.stop}</p>
            <a href={check.sourceUrl} target="_blank" rel="noreferrer">Vendor reference for this observation</a>
          </li>
        ))}</ol>
      </div>
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
      <BlogArticle post={post} visualSrc={post.image} visualLinkLabel="View full-size incident sequence"
        showLeadForm={false} sectionExtras={sectionExtras} />
    </main>
  );
}
