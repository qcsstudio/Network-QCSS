import type { Metadata } from "next";
import Link from "next/link";
import { CardVisual } from "@/components/card-visual";
import { LeadForm } from "@/components/lead-form";
import { StructuredData } from "@/components/structured-data";
import { networkUtilityTools } from "@/lib/network-tools";
import { siteConfig } from "@/lib/content";
import { createPageMetadata } from "@/lib/seo";

export const metadata: Metadata = createPageMetadata({
  title: "Free Online Network Tools and Vendor Script Generator",
  description:
    "Run DNS, SSL, email, redirect, subnet, reverse DNS, CAA, port checks, and generate Cisco, FortiGate, and Juniper troubleshooting command plans.",
  path: "/network-tools",
  keywords: [
    "online network tools",
    "dns lookup tool",
    "ssl certificate checker",
    "spf dmarc checker",
    "port checker",
    "subnet calculator",
    "packet capture command generator",
    "network troubleshooting tools"
  ]
});

const toolHubFaqs = [
  {
    question: "Which free network tools are available here?",
    answer:
      "The toolbox includes DNS lookup, MX lookup, SPF and DMARC checks, SSL certificate checks, HTTP security header checks, redirect chain checks, CAA lookup, reverse DNS lookup, port reachability, IPv4 subnet calculation, and vendor task script generation."
  },
  {
    question: "What should I check first during troubleshooting?",
    answer:
      "Start with the tool that matches the visible symptom: DNS for resolution, MX and SPF/DMARC for email, SSL and headers for website exposure, port reachability for firewall access, subnet calculation for planning, and vendor scripts when an engineer needs controlled command evidence."
  },
  {
    question: "When should a tool result become a service request?",
    answer:
      "Escalate when the result affects users, email delivery, certificate expiry, public exposure, firewall access, routing, VPN stability, or a client requirement that needs evidence, change control, and remediation."
  }
];

export default function NetworkToolsPage() {
  return (
    <main>
      <StructuredData
        data={[
          {
            "@context": "https://schema.org",
            "@type": "CollectionPage",
            name: "Free Online Network Tools",
            description: metadata.description,
            url: `${siteConfig.url}/network-tools`,
            isPartOf: {
              "@type": "WebSite",
              name: siteConfig.name,
              url: siteConfig.url
            }
          },
          {
            "@context": "https://schema.org",
            "@type": "ItemList",
            itemListElement: networkUtilityTools.map((tool, index) => ({
              "@type": "ListItem",
              position: index + 1,
              url: `${siteConfig.url}/network-tools/${tool.slug}`,
              name: tool.title
            }))
          },
          {
            "@context": "https://schema.org",
            "@type": "FAQPage",
            mainEntity: toolHubFaqs.map((faq) => ({
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
      <section className="page-hero tool-page-hero">
        <p className="eyebrow">Network utility hub</p>
        <h1>Free online network tools for checks, subnet planning, and vendor task scripts.</h1>
        <p>
          Use focused tools to check public network signals, calculate practical IPv4 ranges, and generate
          operator-ready Cisco, FortiGate, and Juniper troubleshooting plans before deeper work begins.
        </p>
        <div className="button-row">
          <a className="button primary" href="#network-tools">
            Open Tools
          </a>
          <a className="button secondary" href="#tool-review">
            Request Review
          </a>
        </div>
      </section>

      <section className="section tool-run-section" id="network-tools">
        <div className="section-heading">
          <p className="eyebrow">Choose a tool</p>
          <h2>Run the check that matches the symptom first.</h2>
          <p>
            Each tool is built as a focused starting point: enter the domain, IP, URL, CIDR, port, or vendor context and
            use the result to decide the next engineering action.
          </p>
        </div>
        <div className="utility-grid">
          {networkUtilityTools.map((tool) => {
            const Icon = tool.icon;
            return (
              <Link className="utility-card" href={`/network-tools/${tool.slug}`} key={tool.slug}>
                <CardVisual title={tool.title} context={tool.category} icon={Icon} />
                <p className="eyebrow">{tool.category}</p>
                <h2>{tool.title}</h2>
                <p>{tool.description}</p>
                <span className="text-link">Open tool</span>
              </Link>
            );
          })}
        </div>
      </section>

      <section className="section split">
        <div className="answer-panel">
          <p className="eyebrow">Quick diagnosis</p>
          <h2>Use public checks to validate symptoms before a technical call.</h2>
          <p>
            DNS, MX, SPF/DMARC, SSL, header, redirect, CAA, reverse DNS, subnet, port, and command-plan tools help
            confirm whether the issue belongs to routing, firewall access, email delivery, website exposure, or network
            planning.
          </p>
        </div>
        <div className="answer-panel muted">
          <p className="eyebrow">Next-step path</p>
          <h2>Turn a result into evidence, priority, and a practical fix path.</h2>
          <p>
            If a check shows risk or uncertainty, the next step can move into assessment, remediation, managed support,
            penetration testing, cloud network review, or a focused engineering handoff.
          </p>
        </div>
      </section>

      <section className="section">
        <div className="section-heading">
          <p className="eyebrow">How to use the toolbox</p>
          <h2>Pick the tool by symptom, then use the result as a decision point.</h2>
        </div>
        <div className="faq-grid">
          {toolHubFaqs.map((faq) => (
            <article className="faq-card" key={faq.question}>
              <CardVisual title={faq.question} context="Network tools" />
              <h3>{faq.question}</h3>
              <p>{faq.answer}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="section split" id="tool-review">
        <div className="section-heading">
          <p className="eyebrow">From tool result to fix</p>
          <h2>Need help interpreting a result or converting it into a change plan?</h2>
          <p>
            Share the symptom, affected service, and tool output. QCS can help validate the root cause, collect the right
            evidence, and route the work into network troubleshooting, security hardening, managed services, or cloud
            network support.
          </p>
        </div>
        <LeadForm interest="Network Tools Review" pipeline="Network Troubleshooting" compact />
      </section>
    </main>
  );
}
