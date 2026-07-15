import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AssessmentTool } from "@/components/assessment-tool";
import { LeadForm } from "@/components/lead-form";
import { StructuredData } from "@/components/structured-data";
import { siteConfig, tools } from "@/lib/content";

type ToolPageProps = {
  params: Promise<{ slug: string }>;
};

export function generateStaticParams() {
  return tools.map((tool) => ({ slug: tool.slug }));
}

export async function generateMetadata({ params }: ToolPageProps): Promise<Metadata> {
  const { slug } = await params;
  const tool = tools.find((item) => item.slug === slug);
  if (!tool) return {};

  return {
    title: tool.title,
    description: tool.description,
    alternates: { canonical: `/tools/${tool.slug}` },
    keywords: [tool.title, tool.category, tool.pipeline, tool.recommendation]
  };
}

function assessmentFaqs(tool: (typeof tools)[number]) {
  return [
    {
      question: `What does ${tool.title} qualify?`,
      answer: `${tool.title} qualifies ${tool.description.toLowerCase()} and routes the result to ${tool.pipeline}.`
    },
    {
      question: "Is this assessment a formal audit?",
      answer:
        "No. It is a structured triage and qualification signal that helps decide urgency, evidence requests, service route, and follow-up priority."
    },
    {
      question: "What happens after the assessment?",
      answer:
        "The result can guide the right evidence checklist, service route, training option, and follow-up priority."
    }
  ];
}

export default async function ToolPage({ params }: ToolPageProps) {
  const { slug } = await params;
  const tool = tools.find((item) => item.slug === slug);
  if (!tool) notFound();
  const faqs = assessmentFaqs(tool);

  return (
    <main>
      <StructuredData
        data={[
          {
            "@context": "https://schema.org",
            "@type": "WebApplication",
            name: tool.title,
            applicationCategory: "BusinessApplication",
            operatingSystem: "Web",
            url: `${siteConfig.url}/tools/${tool.slug}`,
            description: tool.description,
            provider: {
              "@type": "Organization",
              name: siteConfig.name,
              url: siteConfig.url
            },
            offers: {
              "@type": "Offer",
              price: "0",
              priceCurrency: "INR"
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
                name: "Assessment Tools",
                item: `${siteConfig.url}/#tools`
              },
              {
                "@type": "ListItem",
                position: 3,
                name: tool.title,
                item: `${siteConfig.url}/tools/${tool.slug}`
              }
            ]
          },
          {
            "@context": "https://schema.org",
            "@type": "FAQPage",
            mainEntity: faqs.map((faq) => ({
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
        <p className="eyebrow">{tool.category}</p>
        <h1>{tool.title}</h1>
        <p>{tool.description}</p>
      </section>
      <section className="section">
        <AssessmentTool slug={tool.slug} />
      </section>
      <section className="section">
        <div className="section-heading">
          <p className="eyebrow">Assessment logic</p>
          <h2>Use this assessment to create a clearer follow-up path.</h2>
        </div>
        <div className="faq-grid">
          {faqs.map((faq) => (
            <article className="faq-card" key={faq.question}>
              <h3>{faq.question}</h3>
              <p>{faq.answer}</p>
            </article>
          ))}
        </div>
      </section>
      <section className="section split">
        <div className="section-heading">
          <p className="eyebrow">Request review</p>
          <h2>Turn the assessment into an engineering follow-up.</h2>
          <p>
            Submit a contact request to connect this result with an evidence checklist and practical remediation
            conversation.
          </p>
        </div>
        <LeadForm interest={tool.pipeline} pipeline={tool.pipeline} compact />
      </section>
    </main>
  );
}
