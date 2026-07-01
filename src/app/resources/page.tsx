import type { Metadata } from "next";
import { ResourceDownloads } from "@/components/resource-downloads";

export const metadata: Metadata = {
  title: "Resources",
  description: "Network operations, security, cloud networking, penetration testing, and career resources."
};

export default function ResourcesPage() {
  return (
    <main>
      <section className="page-hero">
        <p className="eyebrow">Content engine</p>
        <h1>Resources that educate visitors and feed the growth system.</h1>
        <p>
          Checklists, templates, guides, and roadmaps should become SEO assets, sales assets, and automation triggers.
        </p>
      </section>
      <section className="section">
        <ResourceDownloads />
      </section>
    </main>
  );
}
