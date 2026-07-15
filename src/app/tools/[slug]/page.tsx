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
    description: tool.description
  };
}

export default async function ToolPage({ params }: ToolPageProps) {
  const { slug } = await params;
  const tool = tools.find((item) => item.slug === slug);
  if (!tool) notFound();

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
      <section className="section split">
        <div className="section-heading">
          <p className="eyebrow">Lead conversion</p>
          <h2>Need help interpreting the score?</h2>
          <p>Submit a contact request to turn the tool result into a real follow-up workflow.</p>
        </div>
        <LeadForm interest={tool.pipeline} pipeline={tool.pipeline} compact />
      </section>
    </main>
  );
}
