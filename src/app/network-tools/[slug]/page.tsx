import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { LeadForm } from "@/components/lead-form";
import { NetworkToolRunner } from "@/components/network-tool-runner";
import { StructuredData } from "@/components/structured-data";
import { getNetworkUtilityTool, networkUtilityTools } from "@/lib/network-tools";
import { siteConfig } from "@/lib/content";

type NetworkToolPageProps = {
  params: Promise<{ slug: string }>;
};

export function generateStaticParams() {
  return networkUtilityTools.map((tool) => ({ slug: tool.slug }));
}

export async function generateMetadata({ params }: NetworkToolPageProps): Promise<Metadata> {
  const { slug } = await params;
  const tool = getNetworkUtilityTool(slug);
  if (!tool) return {};

  return {
    title: tool.title,
    description: tool.description,
    alternates: { canonical: `/network-tools/${tool.slug}` },
    keywords: tool.searchIntent
  };
}

export default async function NetworkToolPage({ params }: NetworkToolPageProps) {
  const { slug } = await params;
  const tool = getNetworkUtilityTool(slug);
  if (!tool) notFound();
  const Icon = tool.icon;

  return (
    <main>
      <StructuredData
        data={[
          {
            "@context": "https://schema.org",
            "@type": "WebApplication",
            name: tool.title,
            applicationCategory: "NetworkApplication",
            operatingSystem: "Web",
            url: `${siteConfig.url}/network-tools/${tool.slug}`,
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
                name: "Network Tools",
                item: `${siteConfig.url}/network-tools`
              },
              {
                "@type": "ListItem",
                position: 3,
                name: tool.title,
                item: `${siteConfig.url}/network-tools/${tool.slug}`
              }
            ]
          }
        ]}
      />
      <section className="page-hero">
        <p className="eyebrow">{tool.category}</p>
        <h1>{tool.title}</h1>
        <p>{tool.description}</p>
        <div className="button-row">
          <a className="button primary" href="#run-tool">
            Run Tool
          </a>
          <Link className="button secondary" href="/network-tools">
            All Network Tools
          </Link>
        </div>
      </section>

      <section className="section split tool-intro">
        <div>
          <Icon size={44} />
          <h2>What this tool checks</h2>
          <p>{tool.outputPromise}</p>
        </div>
        <div className="search-intent-panel">
          <p className="eyebrow">Built for search intent</p>
          <h2>Use it when someone asks:</h2>
          <div className="pill-cloud">
            {tool.searchIntent.map((intent) => (
              <span key={intent}>{intent}</span>
            ))}
          </div>
        </div>
      </section>

      <section className="section" id="run-tool">
        <NetworkToolRunner slug={tool.slug} />
      </section>

      <section className="section split">
        <div className="section-heading">
          <p className="eyebrow">From tool result to fix</p>
          <h2>{tool.cta}</h2>
          <p>
            A public tool can show the symptom. QuantumCrafters Studio can help validate the root cause, document the
            change, and turn it into a managed service, network security, cloud, or penetration testing workflow.
          </p>
        </div>
        <LeadForm interest={tool.serviceIntent} pipeline={tool.serviceIntent} compact />
      </section>
    </main>
  );
}
