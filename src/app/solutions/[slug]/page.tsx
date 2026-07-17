import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CardVisual } from "@/components/card-visual";
import { StructuredData } from "@/components/structured-data";
import { networkUtilityTools } from "@/lib/network-tools";
import { services, siteConfig, solutionPages, tools } from "@/lib/content";
import { createPageMetadata } from "@/lib/seo";

type SolutionPageProps = {
  params: Promise<{ slug: string }>;
};

function toolLink(slug: string) {
  const assessment = tools.find((tool) => tool.slug === slug);
  if (assessment) return { label: assessment.title, href: `/tools/${assessment.slug}`, description: assessment.description };
  const utility = networkUtilityTools.find((tool) => tool.slug === slug);
  if (utility) return { label: utility.title, href: `/network-tools/${utility.slug}`, description: utility.description };
  return null;
}

export function generateStaticParams() {
  return solutionPages.map((solution) => ({ slug: solution.slug }));
}

export async function generateMetadata({ params }: SolutionPageProps): Promise<Metadata> {
  const { slug } = await params;
  const solution = solutionPages.find((item) => item.slug === slug);
  if (!solution) return {};

  return createPageMetadata({
    title: solution.metaTitle,
    description: solution.metaDescription,
    path: `/solutions/${solution.slug}`,
    keywords: [solution.title, solution.eyebrow, ...solution.outcomes]
  });
}

export default async function SolutionPage({ params }: SolutionPageProps) {
  const { slug } = await params;
  const solution = solutionPages.find((item) => item.slug === slug);
  if (!solution) notFound();

  const linkedServices = solution.services
    .map((serviceSlug) => services.find((service) => service.slug === serviceSlug))
    .filter((service): service is (typeof services)[number] => Boolean(service));
  const linkedTools = solution.tools.map(toolLink).filter((tool): tool is NonNullable<ReturnType<typeof toolLink>> => Boolean(tool));

  return (
    <main>
      <StructuredData
        data={[
          {
            "@context": "https://schema.org",
            "@type": "WebPage",
            name: solution.title,
            description: solution.metaDescription,
            url: `${siteConfig.url}/solutions/${solution.slug}`,
            isPartOf: {
              "@type": "WebSite",
              name: siteConfig.name,
              url: siteConfig.url
            }
          },
          {
            "@context": "https://schema.org",
            "@type": "FAQPage",
            mainEntity: solution.faqs.map((faq) => ({
              "@type": "Question",
              name: faq.question,
              acceptedAnswer: {
                "@type": "Answer",
                text: faq.answer
              }
            }))
          },
          {
            "@context": "https://schema.org",
            "@type": "BreadcrumbList",
            itemListElement: [
              { "@type": "ListItem", position: 1, name: "Home", item: siteConfig.url },
              { "@type": "ListItem", position: 2, name: "Solutions", item: `${siteConfig.url}/solutions` },
              { "@type": "ListItem", position: 3, name: solution.title, item: `${siteConfig.url}/solutions/${solution.slug}` }
            ]
          }
        ]}
      />

      <section className="page-hero">
        <p className="eyebrow">{solution.eyebrow}</p>
        <h1>{solution.title}</h1>
        <p>{solution.answer}</p>
        <div className="button-row">
          {linkedTools[0] ? (
            <Link className="button primary" href={linkedTools[0].href}>
              Start with {linkedTools[0].label}
            </Link>
          ) : null}
          <Link className="button secondary" href="/solutions">
            All Solutions
          </Link>
        </div>
      </section>

      <section className="section split">
        <div className="answer-panel">
          <p className="eyebrow">Direct answer</p>
          <h2>{solution.answer}</h2>
        </div>
        <div className="answer-panel muted">
          <p className="eyebrow">Problem pattern</p>
          <h2>{solution.problem}</h2>
        </div>
      </section>

      <section className="section">
        <div className="section-heading">
          <p className="eyebrow">Expected outcomes</p>
          <h2>What this solution should improve</h2>
        </div>
        <div className="pillar-grid">
          {solution.outcomes.map((outcome) => (
            <article className="pillar-card" key={outcome}>
              <CardVisual title={outcome} context={solution.title} />
              <h3>{outcome}</h3>
              <p>Converted into evidence, service routing, and a practical next action for the buyer.</p>
            </article>
          ))}
        </div>
      </section>

      <section className="section split">
        <div className="section-heading">
          <p className="eyebrow">Service route</p>
          <h2>Where this problem should go inside QCS</h2>
        </div>
        <div className="outcome-list">
          {linkedServices.map((service) => (
            <article key={service.slug}>
              <CardVisual title={service.title} context={service.summary} />
              <h3>{service.title}</h3>
              <p>{service.summary}</p>
              <Link className="text-link" href={`/services/${service.slug}`}>
                View service
              </Link>
            </article>
          ))}
        </div>
      </section>

      <section className="section">
        <div className="section-heading">
          <p className="eyebrow">Tools and assessments</p>
          <h2>Start with a signal before booking a call</h2>
        </div>
        <div className="utility-grid">
          {linkedTools.map((tool) => (
            <Link className="utility-card" href={tool.href} key={tool.href}>
              <CardVisual title={tool.label} context={tool.description} />
              <p className="eyebrow">Diagnostic path</p>
              <h3>{tool.label}</h3>
              <p>{tool.description}</p>
              <span className="text-link">Open tool</span>
            </Link>
          ))}
        </div>
      </section>

      <section className="section">
        <div className="section-heading">
          <p className="eyebrow">FAQ</p>
          <h2>Short answers for search and AI summaries</h2>
        </div>
        <div className="faq-grid">
          {solution.faqs.map((faq) => (
            <article className="faq-card" key={faq.question}>
              <CardVisual title={faq.question} context={solution.title} />
              <h3>{faq.question}</h3>
              <p>{faq.answer}</p>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
