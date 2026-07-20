import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ResourceDownloads } from "@/components/resource-downloads";
import { StructuredData } from "@/components/structured-data";
import { blogPosts, weeklyBlogCadence } from "@/lib/blog";
import { siteConfig } from "@/lib/content";
import { createPageMetadata } from "@/lib/seo";

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

export default function ResourcesPage() {
  return (
    <main>
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
            itemListElement: blogPosts.map((post, index) => ({
              "@type": "ListItem",
              position: index + 1,
              name: post.title,
              description: post.description,
              url: `${siteConfig.url}/resources/${post.slug}`
            }))
          }
        ]}
      />
      <section className="page-hero">
        <p className="eyebrow">Network security blog</p>
        <h1>Network security blog for practical infrastructure decisions.</h1>
        <p>
          Read answer-first guides, run supporting tools, and use checklists to prepare the right evidence before a
          technical review, incident call, audit, or service request.
        </p>
        <div className="button-row">
          <a className="button primary" href="#blog-posts">
            Read Blog
          </a>
          <a className="button secondary" href="#download-resources">
            Download Checklists
          </a>
        </div>
      </section>

      <section className="section blog-command-section" id="blog-posts">
        <div className="section-heading">
          <p className="eyebrow">Latest posts</p>
          <h2>Useful guides before action.</h2>
          <p>
            Each post starts with a clear answer, then adds a checklist, relevant tools, and a next action.
          </p>
        </div>
        <div className="blog-grid">
          {blogPosts.map((post, index) => (
            <article className={index === 0 ? "blog-card featured" : "blog-card"} key={post.slug}>
              <Link aria-label={post.title} className="blog-card-media" href={`/resources/${post.slug}`}>
                <Image
                  alt={post.imageAlt}
                  fill
                  priority={index === 0}
                  sizes={index === 0 ? "(max-width: 900px) 100vw, 50vw" : "(max-width: 900px) 100vw, 33vw"}
                  src={post.image}
                />
              </Link>
              <div className="blog-card-body">
                <p className="eyebrow">{post.category}</p>
                <h2>
                  <Link href={`/resources/${post.slug}`}>{post.title}</Link>
                </h2>
                <p>{post.excerpt}</p>
                <div className="blog-meta">
                  <span>{new Date(post.publishedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</span>
                  <span>{post.readTime}</span>
                </div>
                <Link className="text-link" href={`/resources/${post.slug}`}>
                  Read guide
                </Link>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="section split">
        <div className="answer-panel">
          <p className="eyebrow">Publishing cadence</p>
          <h2>Two high-intent posts every week.</h2>
          <p>
            The private content radar scans network security, cloud networking, routing, vendor, and vulnerability
            signals so the blog can stay topical without becoming generic.
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
          <h2>Checklists, templates, and roadmaps for deeper sales and support conversations.</h2>
        </div>
        <ResourceDownloads />
      </section>
    </main>
  );
}
