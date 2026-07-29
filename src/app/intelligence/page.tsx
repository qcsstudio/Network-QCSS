import type { Metadata } from "next";
import Link from "next/link";
import { BookOpen, FileCheck2, ShieldAlert } from "lucide-react";
import { DomainHeroVisual } from "@/components/domain-hero-visual";
import { SignalJourney } from "@/components/signal-journey";
import { StructuredData } from "@/components/structured-data";
import { listSecurityAdvisories } from "@/lib/advisories";
import { siteConfig } from "@/lib/content";
import { getAllPublishedBlogPosts } from "@/lib/content-posts";
import { createPageMetadata } from "@/lib/seo";

export const dynamic = "force-dynamic";

export const metadata: Metadata = createPageMetadata({
  title: "Network Security Intelligence, Blog and Technical Resources",
  description: "Use live network security advisories, expert QCS blog posts, operational runbooks, checklists and troubleshooting resources from one intelligence workspace.",
  path: "/intelligence",
  keywords: ["network security intelligence", "network security blog", "vendor security advisories", "network runbooks", "network troubleshooting resources"]
});

export default async function IntelligencePage() {
  const [advisories, posts] = await Promise.all([listSecurityAdvisories(3), getAllPublishedBlogPosts()]);
  const lanes = [
    {
      icon: ShieldAlert,
      eyebrow: "Automatic",
      title: "Security Advisory Desk",
      description: "Source-verified network vulnerabilities, active exploitation signals, mitigations, and vendor patch guidance published as they are detected.",
      href: "/security-advisories",
      action: "Open live advisories",
      signal: `${advisories.length} current priority item(s) shown`
    },
    {
      icon: BookOpen,
      eyebrow: "Monday and Thursday",
      title: "Expert Blog",
      description: "Answer-first analysis for network operations, cloud connectivity, security controls, troubleshooting, and engineering decisions.",
      href: "/resources#blog-posts",
      action: "Read expert posts",
      signal: `${posts.length} published guide(s)`
    },
    {
      icon: FileCheck2,
      eyebrow: "Practical library",
      title: "Runbooks and Resources",
      description: "Downloadable checklists, evidence packs, readiness templates, and operational references designed for real technical work.",
      href: "/resources#download-resources",
      action: "Open resources",
      signal: "Checklists and templates"
    }
  ];

  return (
    <main className="purpose-intelligence">
      <StructuredData data={{ "@context": "https://schema.org", "@type": "CollectionPage", name: "QCS Network Security Intelligence", description: metadata.description, url: `${siteConfig.url}/intelligence` }} />
      <section className="page-hero visual-page-hero">
        <div className="page-hero-copy">
          <p className="eyebrow">QCS Network Security Intelligence</p>
          <h1>Know what changed, whether it matters, and what to do next.</h1>
          <p>Urgent vendor advisories move through an automatic official-source desk. Deeper analysis, runbooks, and resources are reviewed before publication.</p>
          <div className="button-row">
            <Link className="button primary" href="/security-advisories">Open live advisories</Link>
            <Link className="button secondary" href="/resources">Read analysis</Link>
          </div>
        </div>
        <DomainHeroVisual
          variant="intelligence"
          label="Verified signal desk"
          title="Official source, affected context, priority, and next action"
          signals={["Source verified", "Exposure checked", "Action ready"]}
        />
      </section>

      <SignalJourney variant="intelligence" />
      <section className="section intelligence-lanes">
        {lanes.map((lane) => {
          const Icon = lane.icon;
          return (
            <article className="intelligence-lane" key={lane.title}>
              <div className="intelligence-lane-icon"><Icon aria-hidden="true" size={30} /></div>
              <div>
                <p className="eyebrow">{lane.eyebrow}</p>
                <h2>{lane.title}</h2>
                <p>{lane.description}</p>
              </div>
              <div className="intelligence-lane-action">
                <span>{lane.signal}</span>
                <Link className="button secondary" href={lane.href}>{lane.action}</Link>
              </div>
            </article>
          );
        })}
      </section>
    </main>
  );
}
