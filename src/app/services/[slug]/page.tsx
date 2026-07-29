import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, LogIn, ShieldCheck } from "lucide-react";
import { CardVisual } from "@/components/card-visual";
import { DomainHeroVisual, type DomainVisualVariant } from "@/components/domain-hero-visual";
import { LeadForm } from "@/components/lead-form";
import { SignalJourney } from "@/components/signal-journey";
import { StructuredData } from "@/components/structured-data";
import { services, siteConfig } from "@/lib/content";
import { createPageMetadata } from "@/lib/seo";

type ServicePageProps = {
  params: Promise<{ slug: string }>;
};

const outcomeNarratives = [
  "Establish the current state, accountable owner, and immediate priority.",
  "Translate the target state into controlled engineering work and clear validation criteria.",
  "Retain the decision, implementation evidence, and follow-up actions for the operating team.",
  "Confirm service health, residual risk, and the signals the team should continue to monitor."
];

const scopeNarratives = [
  "Baseline the configuration, dependencies, access path, and ownership before change.",
  "Validate the control or service against the agreed operating requirement.",
  "Document gaps, dependencies, and changes that need accountable approval.",
  "Test the resulting state and preserve evidence for future operations."
];

const deliverableNarratives = [
  "Written so engineers can act and service owners can govern the outcome.",
  "Structured so the decision, evidence, and follow-up remain traceable.",
  "Prepared for handoff into operations, audit, remediation, or retest.",
  "Organized around ownership, timing, and the next measurable checkpoint."
];

function serviceVisualVariant(slug: string): DomainVisualVariant {
  if (slug.includes("cloud")) return "cloud";
  if (slug.includes("security") || slug.includes("penetration") || slug.includes("firewall")) return "security";
  if (slug.includes("wifi")) return "network";
  return "operations";
}

export function generateStaticParams() {
  return services.map((service) => ({ slug: service.slug }));
}

export async function generateMetadata({ params }: ServicePageProps): Promise<Metadata> {
  const { slug } = await params;
  const service = services.find((item) => item.slug === slug);
  if (!service) return {};

  return createPageMetadata({
    title: service.metaTitle,
    description: service.metaDescription,
    path: `/services/${service.slug}`,
    keywords: [service.title, ...service.buyerTriggers, ...service.outcomes]
  });
}

export default async function ServicePage({ params }: ServicePageProps) {
  const { slug } = await params;
  const service = services.find((item) => item.slug === slug);
  if (!service) notFound();
  const Icon = service.icon;

  return (
    <main className="purpose-service">
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
      <section className="page-hero visual-page-hero">
        <div className="page-hero-copy">
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
        </div>
        <DomainHeroVisual
          variant={serviceVisualVariant(service.slug)}
          label={service.kicker}
          title={service.bestFor}
          signals={service.outcomes}
        />
      </section>

      <SignalJourney variant={service.slug === "penetration-testing" ? "assurance" : "service"} />

      {service.slug === "penetration-testing" ? (
        <section className="section verifygrid-service-cta" aria-labelledby="verifygrid-service-title">
          <div className="verifygrid-service-mark"><ShieldCheck aria-hidden="true" size={28} /></div>
          <div>
            <p className="eyebrow">QCS VerifyGrid client workspace</p>
            <h2 id="verifygrid-service-title">Move from testing request to controlled assurance.</h2>
            <p>Verify your organization, request QCS review, and enter an approval-gated workspace for scope, authorization, findings, remediation, reports, and retests.</p>
          </div>
          <div className="verifygrid-service-actions">
            <Link className="button primary" href="/verifygrid/onboard">Start client onboarding <ArrowRight aria-hidden="true" size={17} /></Link>
            <Link className="button secondary" href="/portal/access"><LogIn aria-hidden="true" size={17} /> Client sign in</Link>
          </div>
        </section>
      ) : null}

      <section className="section split">
        <div className="answer-panel">
          <Icon size={42} />
          <p className="eyebrow">Best fit</p>
          <h2>{service.bestFor}</h2>
          <p>{service.proof}</p>
        </div>
        <div className="outcome-list">
          {service.outcomes.map((outcome, index) => (
            <article key={outcome}>
              <CardVisual title={outcome} context={service.title} />
              <h3>{outcome}</h3>
              <p>{outcomeNarratives[index % outcomeNarratives.length]}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="section">
        <div className="section-heading">
          <p className="eyebrow">Operational triggers</p>
          <h2>Choose this service when these signals appear.</h2>
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
          <h2>What we inspect, operate, or change.</h2>
        </div>
        <div className="outcome-list">
          {service.scope.map((item, index) => (
            <article key={item}>
              <CardVisual title={item} context={service.title} />
              <h3>{item}</h3>
              <p>{scopeNarratives[index % scopeNarratives.length]}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="section">
        <div className="section-heading">
          <p className="eyebrow">Deliverables</p>
          <h2>What remains with your team after the work.</h2>
        </div>
        <div className="pillar-grid">
          {service.deliverables.map((deliverable, index) => (
            <article className="pillar-card" key={deliverable}>
              <CardVisual title={deliverable} context={service.title} />
              <h3>{deliverable}</h3>
              <p>{deliverableNarratives[index % deliverableNarratives.length]}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="section">
        <div className="section-heading">
          <p className="eyebrow">FAQ</p>
          <h2>Questions to resolve before work begins.</h2>
        </div>
        <div className="faq-grid">
          {service.faqs.map((faq) => (
            <article className="faq-card" key={faq.question}>
              <CardVisual title={faq.question} context={service.title} />
              <h3>{faq.question}</h3>
              <p>{faq.answer}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="section split" id="request-review">
        <div className="section-heading">
          <p className="eyebrow">Request review</p>
          <h2>Share the environment, pressure, and desired outcome for {service.title}.</h2>
        </div>
        <LeadForm interest={service.title} pipeline={service.title} />
      </section>
    </main>
  );
}
