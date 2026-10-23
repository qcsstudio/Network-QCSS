import { BlogArticle } from "@/components/blog-article";
import { StructuredData } from "@/components/structured-data";
import { siteConfig } from "@/lib/content";
import { createPageMetadata } from "@/lib/seo";
import { fortinetHardeningGuide as post } from "@/lib/website-only-resources";
import styles from "./page.module.css";

// Fail the build if this database-independent publication gains request-time data.
export const dynamic = "error";

export const metadata = { ...createPageMetadata({
  title: post.metaTitle,
  description: post.description,
  path: `/resources/${post.slug}`,
  keywords: [post.primaryKeyword, ...post.keywords],
  image: { url: post.image, width: 2400, height: 1350, alt: post.imageAlt },
  article: { publishedTime: post.publishedAt, modifiedTime: post.updatedAt }
}), title: { absolute: post.metaTitle } };

export default function FortinetHardeningGuidePage() {
  const url = `${siteConfig.url}/resources/${post.slug}`;
  return (
    <main className={`purpose-resource ${styles.guide}`}>
      <StructuredData data={[
        {
          "@context": "https://schema.org",
          "@type": "TechArticle",
          headline: post.title,
          description: post.description,
          abstract: post.answer,
          image: { "@type": "ImageObject", url: `${siteConfig.url}${post.image}`, width: 2400, height: 1350, caption: post.imageAlt },
          datePublished: post.publishedAt,
          dateModified: post.updatedAt,
          inLanguage: "en",
          isAccessibleForFree: true,
          mainEntityOfPage: url,
          author: { "@type": "Organization", "@id": `${siteConfig.url}/#organization`, name: siteConfig.name },
          publisher: { "@type": "Organization", "@id": `${siteConfig.url}/#organization`, name: siteConfig.name },
          articleSection: post.category,
          citation: post.sources.map((source) => source.url)
        },
        {
          "@context": "https://schema.org",
          "@type": "BreadcrumbList",
          itemListElement: [
            { "@type": "ListItem", position: 1, name: "Home", item: siteConfig.url },
            { "@type": "ListItem", position: 2, name: "Resources", item: `${siteConfig.url}/resources` },
            { "@type": "ListItem", position: 3, name: post.title, item: url }
          ]
        },
        {
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: post.questions.map((faq) => ({
            "@type": "Question", name: faq.question,
            acceptedAnswer: { "@type": "Answer", text: faq.answer }
          }))
        }
      ]} />
      <BlogArticle post={post} visualSrc={post.image} visualLinkLabel="View full-size release map" showLeadForm={false} />
    </main>
  );
}
