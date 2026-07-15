import type { Metadata } from "next";
import { ResourceDownloads } from "@/components/resource-downloads";
import { StructuredData } from "@/components/structured-data";
import { resources, siteConfig } from "@/lib/content";

export const metadata: Metadata = {
  title: "Network Security Resources, Checklists, Templates and Career Roadmaps",
  description:
    "Download network security resources: firewall cleanup checklist, cloud network readiness guide, pentest scope sheet, emergency triage sheet, SASE readiness map and career roadmap.",
  alternates: { canonical: "/resources" },
  keywords: [
    "network security checklist",
    "firewall cleanup checklist",
    "cloud network readiness guide",
    "pentest scope sheet",
    "network security career roadmap"
  ]
};

export default function ResourcesPage() {
  return (
    <main>
      <StructuredData
        data={[
          {
            "@context": "https://schema.org",
            "@type": "CollectionPage",
            name: "Network Security Resources",
            description: metadata.description,
            url: `${siteConfig.url}/resources`,
            isPartOf: {
              "@type": "WebSite",
              name: siteConfig.name,
              url: siteConfig.url
            }
          },
          {
            "@context": "https://schema.org",
            "@type": "ItemList",
            itemListElement: resources.map((resource, index) => ({
              "@type": "ListItem",
              position: index + 1,
              name: resource.title,
              description: resource.summary
            }))
          }
        ]}
      />
      <section className="page-hero">
        <p className="eyebrow">Resource hub</p>
        <h1>Network security resources that help teams prepare before decisions, audits, and incidents.</h1>
        <p>
          Use checklists, templates, guides, and roadmaps to understand the evidence, risks, and next actions that matter
          before a deeper review.
        </p>
      </section>
      <section className="section">
        <ResourceDownloads />
      </section>
    </main>
  );
}
