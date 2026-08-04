import { ChevronDown } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { CardVisual } from "@/components/card-visual";
import { LeadForm } from "@/components/lead-form";
import type { BlogPost } from "@/lib/blog";
import { articleParagraphs } from "@/lib/blog-presentation";

type BlogArticleProps = {
  post: BlogPost;
  relatedPosts?: BlogPost[];
  showLeadForm?: boolean;
  visualSrc?: string;
};

function sectionId(heading: string, index: number) {
  const slug = heading
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return `${slug || "section"}-${index + 1}`;
}

export function BlogArticle({ post, relatedPosts = [], showLeadForm = true, visualSrc }: BlogArticleProps) {
  const published = new Date(post.publishedAt).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric"
  });
  const updated = new Date(post.updatedAt).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric"
  });
  const hasMeaningfulUpdate = new Date(post.updatedAt).getTime() > new Date(post.publishedAt).getTime();
  const sourceNumbers = new Map(post.sources.map((source, index) => [source.url, index + 1]));
  const citations = (urls: string[] | undefined) => {
    const cited = [...new Set(urls || [])].filter((url) => sourceNumbers.has(url));
    if (!cited.length) return null;
    return (
      <span className="article-citations" aria-label="Supporting sources">
        {cited.map((url) => (
          <a href={url} key={url} rel="noreferrer" target="_blank" title={post.sources[(sourceNumbers.get(url) || 1) - 1]?.label}>
            [{sourceNumbers.get(url)}]
          </a>
        ))}
      </span>
    );
  };

  return (
    <>
      <article>
        <section className="page-hero blog-hero">
          <div>
            <nav aria-label="Breadcrumb" className="article-breadcrumb">
              <Link href="/resources">Blog and resources</Link>
              <span aria-hidden="true">/</span>
              <span>{post.category}</span>
            </nav>
            <p className="eyebrow">{post.category}</p>
            <h1>{post.title}</h1>
            <p>{post.description}</p>
            <div className="blog-meta">
              <span>Published {published}</span>
              {hasMeaningfulUpdate ? <span>Updated {updated}</span> : null}
              <span>{post.readTime}</span>
            </div>
            <p className="article-review-line">
              Reviewed by <strong>{post.reviewedBy?.name || "QCS Network & Security Engineering"}</strong>
            </p>
          </div>
          <div className="blog-hero-media">
            <Image
              alt={post.imageAlt}
              fill
              priority
              sizes="(max-width: 1080px) 100vw, 42vw"
              src={visualSrc || `/resources/${post.slug}/visual`}
              unoptimized
            />
          </div>
        </section>

        <section className="section blog-layout">
          <div className="blog-article">
            <section className="answer-panel blog-answer" id="direct-answer">
              <h2>{post.contentType === "resource" ? "Resource outcome" : "Direct answer"}</h2>
              <div className="article-prose">
                {articleParagraphs(post.answer).map((paragraph) => (
                  <p key={paragraph}>{paragraph}</p>
                ))}
              </div>
            </section>

            <section id="key-takeaways">
              <h2>Key Takeaways</h2>
              <ul className="check-list">
                {post.takeaways.map((takeaway) => (
                  <li key={takeaway}>{takeaway}</li>
                ))}
              </ul>
            </section>

            {post.definitions?.length ? (
              <section id="definitions">
                <h2>Terms Used in This Guide</h2>
                <dl className="article-definitions">
                  {post.definitions.map((item) => (
                    <div key={item.term}>
                      <dt>{item.term}</dt>
                      <dd>{item.definition}</dd>
                    </div>
                  ))}
                </dl>
              </section>
            ) : null}

            {post.sections.map((section, index) => (
              <section id={sectionId(section.heading, index)} key={section.heading}>
                <h2>{section.heading}</h2>
                <div className="article-prose">
                  {articleParagraphs(section.body).map((paragraph, paragraphIndex, paragraphs) => (
                    <p key={paragraph}>
                      {paragraph} {paragraphIndex === paragraphs.length - 1 ? citations(section.sourceUrls) : null}
                    </p>
                  ))}
                </div>
                {section.bullets ? (
                  <ul className="check-list muted">
                    {section.bullets.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                ) : null}
              </section>
            ))}

            <section id="practical-checklist">
              <h2>Practical Checklist</h2>
              <div className="article-check-grid">
                {post.checklist.map((item) => (
                  <article key={item}>
                    <CardVisual title={item} context={post.category} />
                    <p>{item}</p>
                  </article>
                ))}
              </div>
            </section>

            <section id="questions">
              <h2>Questions Teams Ask</h2>
              <div className="article-faq-list">
                {post.questions.map((faq, index) => (
                  <details key={faq.question} open={index === 0}>
                    <summary>
                      <span>{faq.question}</span>
                      <ChevronDown aria-hidden="true" size={20} />
                    </summary>
                    <p>
                      {faq.answer} {citations(faq.sourceUrls)}
                    </p>
                  </details>
                ))}
              </div>
            </section>

            <section id="sources">
              <h2>Sources and Further Reading</h2>
              <div className="stack-list">
                {post.sources.map((source, index) => (
                  <a className="stack-item compact-link" href={source.url} key={source.url} rel="noreferrer" target="_blank">
                    <span>[{index + 1}]</span> {source.label}
                  </a>
                ))}
              </div>
            </section>

            <section className="article-method" id="editorial-method">
              <h2>How This Guide Was Prepared</h2>
              <p>
                {post.editorialMethod ||
                  "QCS reviewed the listed sources and organized the findings around practical network and security decisions."}
              </p>
              <p>
                <strong>Technical review:</strong> {post.reviewedBy?.name || "QCS Network & Security Engineering"}
                {post.reviewedBy?.role ? `, ${post.reviewedBy.role}` : ""}.
              </p>
            </section>
          </div>

          <aside className="blog-sidebar" aria-label="Article navigation and actions">
            <div>
              <p className="eyebrow">What you will leave with</p>
              <strong>{post.readerOutcome || post.excerpt}</strong>
            </div>
            <nav aria-label="Article contents">
              <p className="eyebrow">In this guide</p>
              <ol className="article-toc">
                <li><a href="#direct-answer">Direct answer</a></li>
                <li><a href="#key-takeaways">Key takeaways</a></li>
                {post.sections.map((section, index) => (
                  <li key={section.heading}>
                    <a href={`#${sectionId(section.heading, index)}`}>{section.heading}</a>
                  </li>
                ))}
                <li><a href="#practical-checklist">Practical checklist</a></li>
                <li><a href="#questions">Questions teams ask</a></li>
                <li><a href="#sources">Sources</a></li>
              </ol>
            </nav>
            <div>
              <p className="eyebrow">Written for</p>
              <p>{post.audience}</p>
            </div>
            <div>
              <p className="eyebrow">Related tools</p>
              <div className="stack-list">
                {post.relatedTools.map((tool) => (
                  <Link className="stack-item compact-link" href={tool.href} key={tool.href}>
                    {tool.label}
                  </Link>
                ))}
              </div>
            </div>
            <div>
              <p className="eyebrow">Service path</p>
              <div className="stack-list">
                {post.relatedServices.map((service) => (
                  <Link className="stack-item compact-link" href={service.href} key={service.href}>
                    {service.label}
                  </Link>
                ))}
              </div>
            </div>
          </aside>
        </section>

        {relatedPosts.length ? (
          <section className="section article-related-reading">
            <div className="section-heading">
              <p className="eyebrow">Continue the decision</p>
              <h2>Related network and security guidance</h2>
            </div>
            <div className="article-related-grid">
              {relatedPosts.map((related) => (
                <article key={related.slug}>
                  <Link aria-label={related.title} className="article-related-media" href={`/resources/${related.slug}`}>
                    <Image
                      alt={related.imageAlt}
                      fill
                      sizes="(max-width: 720px) 100vw, 30vw"
                      src={`/resources/${related.slug}/visual`}
                      unoptimized
                    />
                  </Link>
                  <div>
                    <p className="eyebrow">{related.category}</p>
                    <h3><Link href={`/resources/${related.slug}`}>{related.title}</Link></h3>
                    <p>{related.excerpt}</p>
                    <Link className="text-link" href={`/resources/${related.slug}`}>Read article</Link>
                  </div>
                </article>
              ))}
            </div>
          </section>
        ) : null}
      </article>

      {showLeadForm ? (
        <section className="section split">
          <div className="section-heading">
            <p className="eyebrow">Turn this into action</p>
            <h2>Share your network context and QCS can help validate the next step.</h2>
            <p>
              Use the article as preparation. If the issue affects users, exposure, audit evidence, or client delivery, a
              focused review can turn it into a clear fix path.
            </p>
          </div>
          <LeadForm interest={post.category} pipeline="Blog assisted lead" />
        </section>
      ) : null}
    </>
  );
}
