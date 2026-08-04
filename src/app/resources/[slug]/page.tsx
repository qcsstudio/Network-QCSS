import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BlogArticle } from "@/components/blog-article";
import { StructuredData } from "@/components/structured-data";
import { getAllPublishedBlogPosts, getPublishedBlogPost } from "@/lib/content-posts";
import { siteConfig } from "@/lib/content";
import { relatedBlogPosts } from "@/lib/blog-presentation";
import { createPageMetadata } from "@/lib/seo";

type BlogPageProps = {
  params: Promise<{ slug: string }>;
};

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: BlogPageProps): Promise<Metadata> {
  const { slug } = await params;
  const post = await getPublishedBlogPost(slug);
  if (!post) return {};

  return createPageMetadata({
    title: post.metaTitle,
    description: post.description,
    path: `/resources/${post.slug}`,
    keywords: [post.primaryKeyword, ...post.keywords, post.category, post.audience],
    image: {
      url: `/resources/${post.slug}/opengraph-image`,
      width: 1200,
      height: 627,
      alt: post.imageAlt
    },
    article: {
      publishedTime: post.publishedAt,
      modifiedTime: post.updatedAt
    }
  });
}

export default async function BlogPostPage({ params }: BlogPageProps) {
  const { slug } = await params;
  const posts = await getAllPublishedBlogPosts();
  const post = posts.find((item) => item.slug === slug);
  if (!post) notFound();
  const relatedPosts = relatedBlogPosts(posts, post);
  const wordCount = [
    post.answer,
    ...post.takeaways,
    ...post.sections.flatMap((section) => [section.body, ...(section.bullets || [])]),
    ...post.checklist,
    ...post.questions.map((question) => question.answer)
  ]
    .join(" ")
    .split(/\s+/)
    .filter(Boolean).length;

  return (
    <main className="purpose-resource">
      <StructuredData
        data={[
          {
            "@context": "https://schema.org",
            "@type": post.contentType === "resource" ? "TechArticle" : "BlogPosting",
            headline: post.title,
            description: post.description,
            image: {
              "@type": "ImageObject",
              url: `${siteConfig.url}/resources/${post.slug}/opengraph-image`,
              width: 1200,
              height: 627,
              caption: post.imageAlt
            },
            datePublished: post.publishedAt,
            dateModified: post.updatedAt,
            inLanguage: "en",
            isAccessibleForFree: true,
            mainEntityOfPage: `${siteConfig.url}/resources/${post.slug}`,
            author: {
              "@type": "Organization",
              "@id": `${siteConfig.url}/#organization`,
              name: siteConfig.name,
              url: siteConfig.url
            },
            reviewedBy: {
              "@type": "Organization",
              "@id": `${siteConfig.url}/#organization`,
              name: post.reviewedBy?.name || "QCS Network & Security Engineering",
              url: siteConfig.url
            },
            publisher: {
              "@type": "Organization",
              "@id": `${siteConfig.url}/#organization`,
              name: siteConfig.name,
              logo: {
                "@type": "ImageObject",
                url: `${siteConfig.url}/brand/quantumcrafters-logo.png`
              }
            },
            articleSection: post.category,
            about: post.keywords.map((keyword) => ({ "@type": "Thing", name: keyword })),
            keywords: post.keywords.join(", "),
            wordCount,
            abstract: post.answer,
            citation: post.sources.map((source) => source.url),
            isBasedOn: post.sources.map((source) => source.url),
            audience: {
              "@type": "Audience",
              audienceType: post.audience
            }
          },
          {
            "@context": "https://schema.org",
            "@type": "BreadcrumbList",
            itemListElement: [
              {
                "@type": "ListItem",
                position: 1,
                name: "Home",
                item: siteConfig.url
              },
              {
                "@type": "ListItem",
                position: 2,
                name: "Resources",
                item: `${siteConfig.url}/resources`
              },
              {
                "@type": "ListItem",
                position: 3,
                name: post.title,
                item: `${siteConfig.url}/resources/${post.slug}`
              }
            ]
          },
          {
            "@context": "https://schema.org",
            "@type": "FAQPage",
            mainEntity: post.questions.map((question) => ({
              "@type": "Question",
              name: question.question,
              acceptedAnswer: {
                "@type": "Answer",
                text: question.answer
              }
            }))
          }
        ]}
      />

      <BlogArticle post={post} relatedPosts={relatedPosts} />
    </main>
  );
}
