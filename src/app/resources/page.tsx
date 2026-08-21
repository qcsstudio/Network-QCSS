import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { BookOpen, FileCheck2, Library, Tags } from "lucide-react";
import { ResourceDownloads } from "@/components/resource-downloads";
import { DomainHeroVisual } from "@/components/domain-hero-visual";
import { SignalJourney } from "@/components/signal-journey";
import { StructuredData } from "@/components/structured-data";
import { weeklyBlogCadence, type BlogPost } from "@/lib/blog";
import { blogArchiveHref, blogArchivePage } from "@/lib/blog-presentation";
import { siteConfig } from "@/lib/content";
import { getAllPublishedBlogPosts } from "@/lib/content-posts";
import { createPageMetadata } from "@/lib/seo";

export const dynamic = "force-dynamic";

type ResourcesPageProps = {
  searchParams: Promise<{ format?: string; page?: string; q?: string; topic?: string }>;
};

export const metadata: Metadata = createPageMetadata({
  title: "Network Security Blog, Resources, Checklists and Troubleshooting Guides",
  description:
    "Read practical network security blogs and download checklists for cloud exposure, CISA KEV patching, BGP/RPKI, SASE, packet capture, firewall cleanup and troubleshooting.",
  path: "/resources",
  keywords: [
    "network security blog",
    "network administration blog",
    "network security checklist",
    "firewall cleanup checklist",
    "cloud network readiness guide",
    "CISA KEV network patching",
    "packet capture runbook"
  ]
});

function BlogCard({ featured = false, post, priority = false }: { featured?: boolean; post: BlogPost; priority?: boolean }) {
  return (
    <article className={featured ? "blog-card featured" : "blog-card"}>
      <Link aria-label={post.title} className="blog-card-media" href={`/resources/${post.slug}`}>
        <Image
          alt={post.imageAlt}
          fill
          priority={priority}
          sizes={featured ? "(max-width: 1080px) 100vw, 48vw" : "(max-width: 720px) 100vw, 44vw"}
          src={`/resources/${post.slug}/visual`}
          unoptimized
        />
      </Link>
      <div className="blog-card-body">
        <p className="eyebrow">{post.contentType === "resource" ? `Resource | ${post.category}` : post.category}</p>
        <h2>
          <Link href={`/resources/${post.slug}`}>{post.title}</Link>
        </h2>
        <p>{post.excerpt}</p>
        <div className="blog-meta">
          <span>{new Date(post.publishedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</span>
          <span>{post.readTime}</span>
        </div>
        <Link className="text-link" href={`/resources/${post.slug}`}>
          Read {post.contentType === "resource" ? "resource" : "article"}
        </Link>
      </div>
    </article>
  );
}

export default async function ResourcesPage({ searchParams }: ResourcesPageProps) {
  const posts = await getAllPublishedBlogPosts();
  const params = await searchParams;
  const query = { format: params.format, page: params.page, query: params.q, topic: params.topic };
  const archive = blogArchivePage(posts, query);
  const resourceCount = posts.filter((post) => post.contentType === "resource").length;
  const articleCount = posts.length - resourceCount;
  return (
    <main className="purpose-resource">
      <StructuredData
        data={[
          {
            "@context": "https://schema.org",
            "@type": "CollectionPage",
            name: "Network Security Resources",
            description: metadata.description,
            url: `${siteConfig.url}/resources`,
            isPartOf: {
              "@type": "WebSite",
              name: siteConfig.name,
              url: siteConfig.url
            }
          },
          {
            "@context": "https://schema.org",
            "@type": "ItemList",
            name: "Network Security Blog Posts",
            itemListElement: posts.map((post, index) => ({
              "@type": "ListItem",
              position: index + 1,
              name: post.title,
              description: post.description,
              url: `${siteConfig.url}/resources/${post.slug}`
            }))
          }
        ]}
      />
      <section className="page-hero visual-page-hero">
        <div className="page-hero-copy">
          <p className="eyebrow">Network security intelligence</p>
          <h1>Practical guidance for infrastructure decisions that cannot wait for guesswork.</h1>
          <p>
            Start with a direct answer. Run the supporting tools. Use each checklist to prepare evidence for a technical
            review, incident call, audit, or service request.
          </p>
          <div className="button-row">
            <a className="button primary" href="#blog-posts">
              Read Blog
            </a>
            <a className="button secondary" href="#download-resources">
              Download Checklists
            </a>
            <Link className="button secondary" href="/security-advisories">
              Security Advisories
            </Link>
          </div>
        </div>
        <DomainHeroVisual
          variant="intelligence"
          label="Operational intelligence"
          title="Answer, evidence, and next action"
          signals={["Source checked", "Tool supported", "Action ready"]}
        />
      </section>

      <SignalJourney variant="intelligence" />

      <section className="section blog-command-section" id="blog-posts">
        <div className="section-heading">
          <p className="eyebrow">Latest posts</p>
          <h2>Use the answer first. Keep the evidence for the decision.</h2>
          <p>
            Each post starts with a clear answer, then adds a checklist, relevant tools, and a next action.
          </p>
        </div>
        <div className="content-library-metrics" aria-label="Content library summary">
          <article><Library aria-hidden="true" /><span>Published</span><strong>{posts.length}</strong></article>
          <article><BookOpen aria-hidden="true" /><span>Articles</span><strong>{articleCount}</strong></article>
          <article><FileCheck2 aria-hidden="true" /><span>Resources</span><strong>{resourceCount}</strong></article>
          <article><Tags aria-hidden="true" /><span>Topics</span><strong>{archive.topics.length}</strong></article>
        </div>
        <div className="content-library-console">
          <nav aria-label="Content format" className="content-library-tabs">
            <Link aria-current={!params.format ? "page" : undefined} href="/resources#blog-posts">All</Link>
            <Link aria-current={params.format === "blog" ? "page" : undefined} href="/resources?format=blog#blog-posts">Articles</Link>
            <Link aria-current={params.format === "resource" ? "page" : undefined} href="/resources?format=resource#blog-posts">Resources</Link>
          </nav>
          <form action="/resources" className="blog-archive-controls" method="get">
            <label>
              <span>Search</span>
              <input defaultValue={params.q || ""} name="q" placeholder="Topic, vendor, product, or task" type="search" />
            </label>
            <label>
              <span>Topic</span>
              <select defaultValue={params.topic || ""} name="topic">
                <option value="">All topics</option>
                {archive.topics.map((topic) => (
                  <option key={topic} value={topic}>
                    {topic}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>Format</span>
              <select defaultValue={params.format || ""} name="format">
                <option value="">All formats</option>
                <option value="blog">Articles</option>
                <option value="resource">Resources</option>
              </select>
            </label>
            <button className="button primary" type="submit">
              Filter
            </button>
            <Link className="button secondary" href="/resources#blog-posts">
              Reset
            </Link>
          </form>
          <div className="blog-archive-status" aria-live="polite">
            <strong>{archive.total}</strong> {archive.total === 1 ? "result" : "results"}
            {archive.totalPages > 1 ? ` | Page ${archive.page} of ${archive.totalPages}` : ""}
          </div>
        </div>
        <div className="blog-grid">
          {archive.featured ? <BlogCard featured post={archive.featured} priority /> : null}
          {archive.items.map((post) => (
            <BlogCard key={post.slug} post={post} />
          ))}
        </div>
        {!archive.total ? (
          <div className="empty-state">
            <h3>No matching articles</h3>
            <p>Try a broader topic, vendor, product, or task.</p>
            <Link className="button secondary" href="/resources#blog-posts">
              View all posts
            </Link>
          </div>
        ) : null}
        {archive.totalPages > 1 ? (
          <nav aria-label="Blog archive pages" className="blog-pagination">
            {archive.page > 1 ? (
              <Link href={blogArchiveHref(query, archive.page - 1)} rel="prev">
                Previous
              </Link>
            ) : <span aria-hidden="true" />}
            <span>
              Page {archive.page} of {archive.totalPages}
            </span>
            {archive.page < archive.totalPages ? (
              <Link href={blogArchiveHref(query, archive.page + 1)} rel="next">
                Next
              </Link>
            ) : <span aria-hidden="true" />}
          </nav>
        ) : null}
      </section>

      <section className="section split">
        <div className="answer-panel">
          <p className="eyebrow">What to expect</p>
          <h2>Two practical network and security briefings every week.</h2>
          <p>
            QCS monitors trusted network and security sources, then turns material changes into practical guidance for
            engineers, service owners, and security teams.
          </p>
        </div>
        <div className="outcome-list">
          {weeklyBlogCadence.map((slot) => (
            <article key={slot.day}>
              <p className="eyebrow">{slot.day}</p>
              <h3>{slot.slot}</h3>
              <p>{slot.goal}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="section" id="download-resources">
        <div className="section-heading">
          <p className="eyebrow">Downloadable resources</p>
          <h2>Take a practical checklist into the next technical decision.</h2>
        </div>
        <ResourceDownloads />
      </section>
    </main>
  );
}
