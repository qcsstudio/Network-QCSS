import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { LeadForm } from "@/components/lead-form";
import { StructuredData } from "@/components/structured-data";
import { services, siteConfig } from "@/lib/content";

type ServicePageProps = {
  params: Promise<{ slug: string }>;
};

export function generateStaticParams() {
  return services.map((service) => ({ slug: service.slug }));
}

export async function generateMetadata({ params }: ServicePageProps): Promise<Metadata> {
  const { slug } = await params;
  const service = services.find((item) => item.slug === slug);
  if (!service) return {};

  return {
    title: service.metaTitle,
    description: service.metaDescription,
    alternates: { canonical: `/services/${service.slug}` },
    keywords: [service.title, ...service.buyerTriggers, ...service.outcomes]
  };
}

export default async function ServicePage({ params }: ServicePageProps) {
  const { slug } = await params;
  const service = services.find((item) => item.slug === slug);
  if (!service) notFound();
  const Icon = service.icon;

  return (
    <main>
      <StructuredData
        data={[
          {
            "@context": "https://schema.org",
            "@type": "Service",
            name: service.title,
            serviceType: service.title,
            description: service.metaDescription,
            url: `${siteConfig.url}/services/${service.slug}`,
            areaServed: ["India", "Global"],
            provider: {
              "@type": "Organization",
              name: siteConfig.name,
              url: siteConfig.url
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
                name: "Services",
                item: `${siteConfig.url}/#services`
              },
              {
                "@type": "ListItem",
                position: 3,
                name: service.title,
                item: `${siteConfig.url}/services/${service.slug}`
              }
            ]
          },
          {
            "@context": "https://schema.org",
            "@type": "FAQPage",
            mainEntity: service.faqs.map((faq) => ({
              "@type": "Question",
              name: faq.question,
              acceptedAnswer: {
                "@type": "Answer",
                text: faq.answer
              }
            }))
          }
        ]}
      />
      <section className="page-hero">
        <p className="eyebrow">{service.kicker}</p>
        <h1>{service.title}</h1>
        <p>{service.summary}</p>
        <div className="button-row">
          <Link className="button primary" href={`/tools/${service.tool}`}>
            {service.cta}
          </Link>
          <a className="button secondary" href="#request-review">
            Request Engineering Review
          </a>
        </div>
      </section>

      <section className="section split">
        <div className="answer-panel">
          <Icon size={42} />
          <p className="eyebrow">Best fit</p>
          <h2>{service.bestFor}</h2>
          <p>{service.proof}</p>
        </div>
        <div className="outcome-list">
          {service.outcomes.map((outcome) => (
            <article key={outcome}>
              <h3>{outcome}</h3>
              <p>Handled through assessment, implementation guidance, documentation, and follow-up review.</p>
            </article>
          ))}
        </div>
      </section>

      <section className="section">
        <div className="section-heading">
          <p className="eyebrow">Buyer triggers</p>
          <h2>When this service becomes urgent</h2>
        </div>
        <div className="pill-cloud">
          {service.buyerTriggers.map((trigger) => (
            <span key={trigger}>{trigger}</span>
          ))}
        </div>
      </section>

      <section className="section split">
        <div className="section-heading">
          <p className="eyebrow">Scope</p>
          <h2>What QCS should examine and manage</h2>
        </div>
        <div className="outcome-list">
          {service.scope.map((item) => (
            <article key={item}>
              <h3>{item}</h3>
              <p>Handled through discovery, validation, documentation, and a practical next action.</p>
            </article>
          ))}
        </div>
      </section>

      <section className="section">
        <div className="section-heading">
          <p className="eyebrow">Deliverables</p>
          <h2>What the buyer should receive</h2>
        </div>
        <div className="pillar-grid">
          {service.deliverables.map((deliverable) => (
            <article className="pillar-card" key={deliverable}>
              <h3>{deliverable}</h3>
              <p>Designed to be useful for owners, engineers, stakeholders, and future follow-up.</p>
            </article>
          ))}
        </div>
      </section>

      <section className="section">
        <div className="section-heading">
          <p className="eyebrow">FAQ</p>
          <h2>Short answers for service buyers</h2>
        </div>
        <div className="faq-grid">
          {service.faqs.map((faq) => (
            <article className="faq-card" key={faq.question}>
              <h3>{faq.question}</h3>
              <p>{faq.answer}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="section split" id="request-review">
        <div className="section-heading">
          <p className="eyebrow">Request review</p>
          <h2>Share the environment and QCS can respond around {service.title}.</h2>
        </div>
        <LeadForm interest={service.title} pipeline={service.title} />
      </section>
    </main>
  );
}
