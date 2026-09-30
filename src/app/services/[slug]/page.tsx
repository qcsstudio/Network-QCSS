import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, Check, ChevronDown, LogIn, ShieldCheck } from "lucide-react";
import { DomainHeroVisual, type DomainVisualVariant } from "@/components/domain-hero-visual";
import { LeadForm } from "@/components/lead-form";
import { SignalJourney } from "@/components/signal-journey";
import { StructuredData } from "@/components/structured-data";
import { services, siteConfig } from "@/lib/content";
import { createPageMetadata } from "@/lib/seo";

type ServicePageProps = {
  params: Promise<{ slug: string }>;
};

function serviceVisualVariant(slug: string): DomainVisualVariant {
  if (slug.includes("cloud")) return "cloud";
  if (slug.includes("penetration")) return "assurance";
  if (slug.includes("firewall")) return "firewall";
  if (slug.includes("security")) return "security";
  if (slug.includes("wifi")) return "wifi";
  if (slug.includes("troubleshooting")) return "troubleshooting";
  if (slug.includes("managed-network")) return "network";
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
      <nav className="service-breadcrumbs" aria-label="Breadcrumb">
        <ol>
          <li><Link href="/">Home</Link></li>
          <li><Link href="/#services">Services</Link></li>
          <li aria-current="page">{service.title}</li>
        </ol>
      </nav>
      <section className="page-hero visual-page-hero">
        <div className="page-hero-copy">
          <p className="eyebrow">{service.kicker}</p>
          <h1>{service.title}</h1>
          <p>{service.summary}</p>
          <div className="button-row">
            <a className="button primary" href="#request-review">
              Discuss your requirements <ArrowRight aria-hidden="true" size={18} />
            </a>
            <Link className="button secondary" href={`/tools/${service.tool}`}>
              {service.cta}
            </Link>
          </div>
        </div>
        <DomainHeroVisual
          variant={serviceVisualVariant(service.slug)}
          label={service.kicker}
          title={service.bestFor}
          signals={service.outcomes}
        />
      </section>

      <nav className="service-section-nav" aria-label="On this service page">
        <a href="#service-overview">Overview</a>
        <a href="#service-scope">Scope</a>
        <a href="#service-deliverables">Deliverables</a>
        <a href="#service-questions">Questions</a>
        <a href="#request-review">Request review <ArrowRight aria-hidden="true" size={16} /></a>
      </nav>

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

      <section className="section split" id="service-overview" aria-labelledby="service-overview-title">
        <div className="answer-panel">
          <Icon size={42} aria-hidden="true" />
          <p className="eyebrow">Best fit</p>
          <h2 id="service-overview-title">Who this service is for</h2>
          <p>{service.bestFor}</p>
          <p>{service.proof}</p>
        </div>
        <div>
          <h3>Outcomes to plan for</h3>
          <ul className="service-checklist">
            {service.outcomes.map((outcome) => <li key={outcome}><Check aria-hidden="true" size={20} /><span>{outcome}</span></li>)}
          </ul>
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

      <section className="section split" id="service-scope" aria-labelledby="service-scope-title">
        <div className="section-heading">
          <p className="eyebrow">Scope</p>
          <h2 id="service-scope-title">What we inspect, operate, or change.</h2>
          <p>Agree the systems, access permissions and change boundaries before work starts. The engagement scope determines which activities are included.</p>
        </div>
        <ul className="service-checklist">
          {service.scope.map((item) => <li key={item}><Check aria-hidden="true" size={20} /><span>{item}</span></li>)}
        </ul>
      </section>

      <section className="section" id="service-deliverables" aria-labelledby="service-deliverables-title">
        <div className="section-heading">
          <p className="eyebrow">Deliverables</p>
          <h2 id="service-deliverables-title">What remains with your team after the work.</h2>
        </div>
        <ul className="service-checklist service-deliverables">
          {service.deliverables.map((deliverable) => <li key={deliverable}><Check aria-hidden="true" size={20} /><span>{deliverable}</span></li>)}
        </ul>
      </section>

      <section className="section" id="service-questions" aria-labelledby="service-questions-title">
        <div className="section-heading">
          <p className="eyebrow">FAQ</p>
          <h2 id="service-questions-title">Questions to resolve before work begins.</h2>
        </div>
        <div className="service-faqs">
          {service.faqs.map((faq) => (
            <details key={faq.question}>
              <summary>{faq.question}<ChevronDown aria-hidden="true" size={20} /></summary>
              <p>{faq.answer}</p>
            </details>
          ))}
        </div>
      </section>

      <section className="section split" id="request-review">
        <div className="section-heading">
          <p className="eyebrow">Request review</p>
          <h2>Discuss {service.title.toLowerCase()}.</h2>
          <p>Tell us about your environment, the issue or project, and the outcome you need. Do not include passwords or sensitive configuration details.</p>
        </div>
        <LeadForm interest={service.title} pipeline={service.title} />
      </section>
    </main>
  );
}
