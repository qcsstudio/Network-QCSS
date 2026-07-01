import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { LeadForm } from "@/components/lead-form";
import { services } from "@/lib/content";

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
    title: service.title,
    description: service.summary
  };
}

export default async function ServicePage({ params }: ServicePageProps) {
  const { slug } = await params;
  const service = services.find((item) => item.slug === slug);
  if (!service) notFound();
  const Icon = service.icon;

  return (
    <main>
      <section className="page-hero">
        <p className="eyebrow">{service.kicker}</p>
        <h1>{service.title}</h1>
        <p>{service.summary}</p>
        <div className="button-row">
          <Link className="button primary" href={`/tools/${service.tool}`}>
            {service.cta}
          </Link>
          <a className="button secondary" href="#lead">
            Book Assessment
          </a>
        </div>
      </section>

      <section className="section split">
        <div>
          <Icon size={42} />
          <h2>Outcomes this page is built to sell</h2>
          <p>
            This service page is structured as a conversion funnel: problem context, outcomes, diagnostic CTA, proof
            areas, and lead capture.
          </p>
        </div>
        <div className="outcome-list">
          {service.outcomes.map((outcome) => (
            <article key={outcome}>
              <h3>{outcome}</h3>
              <p>Track this as a buyer outcome, not just a technical feature.</p>
            </article>
          ))}
        </div>
      </section>

      <section className="section split" id="lead">
        <div className="section-heading">
          <p className="eyebrow">Pipeline routing</p>
          <h2>Qualified inquiries from this page route to {service.title}.</h2>
        </div>
        <LeadForm interest={service.title} pipeline={service.title} />
      </section>
    </main>
  );
}
