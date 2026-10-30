import Image from "next/image";
import { BlogArticle } from "@/components/blog-article";
import { StructuredData } from "@/components/structured-data";
import diagnostics from "@/content/website-only/fortigate-automation-reboot-diagnostics.json";
import { siteConfig } from "@/lib/content";
import { createPageMetadata } from "@/lib/seo";
import { fortigateAutomationRebootCaseStudy as post } from "@/lib/website-only-resources";
import styles from "../fortigate-ztna-connected-ems-application-access-troubleshooting/page.module.css";

// Static presentation only; the original social posts retain separate ownership.
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

export default function FortigateAutomationRebootCaseStudyPage() {
  const url = `${siteConfig.url}/resources/${post.slug}`;
  const sectionExtras = {
    "Recommended correction: preserve updates and scope the change": (
      <figure className={styles.figure}>
        <Image src="/images/editorial/fortigate-automation-reboot-dependencies.png" width={2400} height={1600}
          sizes="(max-width: 1080px) 100vw, 70vw" unoptimized
          alt="Update trigger connects to a suspect stitch and reboot action. Inspect shared uses and targets before a scoped correction; retain updates and verify services. Arrows are automation dependencies, not packet flows." />
        <figcaption>Conceptual change plan, not customer configuration. Other stitches and destinations must be inventoried on the actual device. No device execution or measured outcome is depicted.</figcaption>
        <a href="/images/editorial/fortigate-automation-reboot-dependencies.svg" target="_blank" rel="noreferrer">Open scalable dependency diagram (new tab)</a>
      </figure>
    ),
    "Technical evidence: observational commands and their limits": (
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
      <BlogArticle post={post} visualSrc={post.image} visualLinkLabel="View full-size event-chain diagram"
        showLeadForm={false} sectionExtras={sectionExtras} />
    </main>
  );
}
