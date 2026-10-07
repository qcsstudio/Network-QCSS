import type { Metadata } from "next";
import { CardVisual } from "@/components/card-visual";
import { ToolDirectory } from "@/components/tool-directory";
import { LeadForm } from "@/components/lead-form";
import { StructuredData } from "@/components/structured-data";
import { networkUtilityTools } from "@/lib/network-tools";
import { siteConfig } from "@/lib/content";
import { createPageMetadata } from "@/lib/seo";

export const metadata: Metadata = createPageMetadata({
  title: "Top 56 Free Online Network Tools and Vendor Script Generator",
  description:
    "Run prioritized network tools for vendor scripts, password generation, BGP/RPKI, cloud ranges, DNS, email security, TLS, HTTP, ports, subnet planning, and troubleshooting.",
  path: "/network-tools",
  keywords: [
    "online network tools",
    "dns lookup tool",
    "ssl certificate checker",
    "spf dmarc checker",
    "port checker",
    "subnet calculator",
    "packet capture command generator",
    "strong password generator",
    "rpki validator",
    "cloud ip range lookup",
    "cidr overlap checker",
    "top network tools",
    "network troubleshooting tools"
  ]
});

const toolHubFaqs = [
  {
    question: "Which free network tools are available here?",
    answer:
      "The toolbox includes 56 practical network tools covering vendor task scripts, strong password generation, BGP/RPKI, global path planning, cloud IP ranges, DNS record checks, email authentication, SSL/TLS, HTTP security, firewall/VPN analyzers, port reachability, subnet planning, and report parsing."
  },
  {
    question: "What should I check first during troubleshooting?",
    answer:
      "Start with the vendor script generator when an engineer needs commands. Use RPKI/ASN/BGP tools for internet routing, cloud tools for allowlists, DNS propagation for record changes, MX and DMARC tools for email, TLS and HTTP tools for web exposure, and CIDR/MTU tools for design or VPN issues."
  },
  {
    question: "When should a tool result become a service request?",
    answer:
      "Escalate when the result affects users, email delivery, certificate expiry, public exposure, firewall access, routing, VPN stability, or a client requirement that needs evidence, change control, and remediation."
  }
];

export default function NetworkToolsPage() {
  return (
    <main className="purpose-tools">
      <StructuredData
        data={[
          {
            "@context": "https://schema.org",
            "@type": "CollectionPage",
            name: "Top 56 Free Online Network Tools",
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
      <section className="page-hero tool-page-hero tool-hub-hero">
        <div className="tool-hub-copy">
          <p className="eyebrow">Network utility hub</p>
          <h1>Free network tools.</h1>
          <p>
            {networkUtilityTools.length} tools for DNS, routing, cloud and security.
            Plan vendor commands, generate passwords or investigate a connection.
          </p>
        </div>

      </section>

      <section className="section tool-run-section" id="network-tools">
        <div className="section-heading">
          <p className="eyebrow">Choose a tool</p>
          <h2>Find the right check.</h2>
        </div>
        <ToolDirectory tools={networkUtilityTools.map(({ slug, title, description, category }) => ({ slug, title, description, category }))} />
      </section>

      <section className="section split">
        <div className="answer-panel">
          <p className="eyebrow">Quick diagnosis</p>
          <h2>Use public checks to validate symptoms before a technical call.</h2>
          <p>
            BGP/RPKI, cloud range, DNS, MX, SPF/DMARC, SSL, header, redirect, CAA, reverse DNS, subnet, port, firewall,
            VPN, and command-plan tools help confirm whether the issue belongs to routing, cloud access, firewall
            policy, email delivery, website exposure, or network planning.
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
