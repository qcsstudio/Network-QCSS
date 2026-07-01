import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AssessmentTool } from "@/components/assessment-tool";
import { LeadForm } from "@/components/lead-form";
import { tools } from "@/lib/content";

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
