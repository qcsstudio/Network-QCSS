import Image from "next/image";
import Link from "next/link";
import { CardVisual } from "@/components/card-visual";
import { LeadForm } from "@/components/lead-form";
import type { BlogPost } from "@/lib/blog";

type BlogArticleProps = {
  post: BlogPost;
  showLeadForm?: boolean;
};

export function BlogArticle({ post, showLeadForm = true }: BlogArticleProps) {
  return (
    <>
      <article>
        <section className="page-hero blog-hero">
          <div>
            <p className="eyebrow">{post.category}</p>
            <h1>{post.title}</h1>
            <p>{post.description}</p>
            <div className="blog-meta">
              <span>
                {new Date(post.publishedAt).toLocaleDateString("en-IN", {
                  day: "numeric",
                  month: "short",
                  year: "numeric"
                })}
              </span>
              <span>{post.readTime}</span>
              <span>{post.audience}</span>
            </div>
          </div>
          <div className="blog-hero-media">
            <Image alt={post.imageAlt} fill priority sizes="(max-width: 900px) 100vw, 42vw" src={`/resources/${post.slug}/visual`} />
          </div>
        </section>

        <section className="section blog-layout">
          <aside className="blog-sidebar" aria-label="Article actions">
            <div>
              <p className="eyebrow">Primary keyword</p>
              <strong>{post.primaryKeyword}</strong>
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

          <div className="blog-article">
            <section className="answer-panel blog-answer">
              <p className="eyebrow">{post.contentType === "resource" ? "Resource outcome" : "Short answer"}</p>
              <h2>{post.answer}</h2>
            </section>

            <section>
              <h2>Key Takeaways</h2>
              <ul className="check-list">
                {post.takeaways.map((takeaway) => (
                  <li key={takeaway}>{takeaway}</li>
                ))}
              </ul>
            </section>

            {post.sections.map((section) => (
              <section key={section.heading}>
                <h2>{section.heading}</h2>
                <p>{section.body}</p>
                {section.bullets ? (
                  <ul className="check-list muted">
                    {section.bullets.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                ) : null}
              </section>
            ))}

            <section>
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

            <section>
              <h2>Questions Teams Ask</h2>
              <div className="faq-grid">
                {post.questions.map((faq) => (
                  <article className="faq-card" key={faq.question}>
                    <h3>{faq.question}</h3>
                    <p>{faq.answer}</p>
                  </article>
                ))}
              </div>
            </section>

            <section>
              <h2>Sources and Further Reading</h2>
              <div className="stack-list">
                {post.sources.map((source) => (
                  <a className="stack-item compact-link" href={source.url} key={source.url} rel="noreferrer" target="_blank">
                    {source.label}
                  </a>
                ))}
              </div>
            </section>
          </div>
        </section>
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
