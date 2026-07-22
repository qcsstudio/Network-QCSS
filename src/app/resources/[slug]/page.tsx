import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BlogArticle } from "@/components/blog-article";
import { StructuredData } from "@/components/structured-data";
import { getPublishedBlogPost } from "@/lib/content-posts";
import { siteConfig } from "@/lib/content";
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
    keywords: [post.primaryKeyword, ...post.keywords, post.category, post.audience]
  });
}

export default async function BlogPostPage({ params }: BlogPageProps) {
  const { slug } = await params;
  const post = await getPublishedBlogPost(slug);
  if (!post) notFound();

  return (
    <main>
      <StructuredData
        data={[
          {
            "@context": "https://schema.org",
            "@type": post.contentType === "resource" ? "TechArticle" : "BlogPosting",
            headline: post.title,
            description: post.description,
            image: `${siteConfig.url}/resources/${post.slug}/opengraph-image`,
            datePublished: post.publishedAt,
            dateModified: post.updatedAt,
            mainEntityOfPage: `${siteConfig.url}/resources/${post.slug}`,
            author: {
              "@type": "Organization",
              name: siteConfig.name,
              url: siteConfig.url
            },
            publisher: {
              "@type": "Organization",
              name: siteConfig.name,
              logo: {
                "@type": "ImageObject",
                url: `${siteConfig.url}/brand/quantumcrafters-logo.png`
              }
            },
            about: post.keywords,
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
          }
        ]}
      />

      <BlogArticle post={post} />
    </main>
  );
}
