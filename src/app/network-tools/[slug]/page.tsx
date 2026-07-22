import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CardVisual } from "@/components/card-visual";
import { LeadForm } from "@/components/lead-form";
import { NetworkToolRunner } from "@/components/network-tool-runner";
import { StructuredData } from "@/components/structured-data";
import { getNetworkUtilityTool, networkUtilityTools } from "@/lib/network-tools";
import { siteConfig } from "@/lib/content";
import { createPageMetadata } from "@/lib/seo";

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

  return createPageMetadata({
    title: tool.title,
    description: tool.description,
    path: `/network-tools/${tool.slug}`,
    keywords: tool.searchIntent
  });
}

function toolFaqs(tool: NonNullable<ReturnType<typeof getNetworkUtilityTool>>) {
  if (tool.slug === "strong-password-generator") {
    return [
      {
        question: "Are generated passwords sent to QCS or stored anywhere?",
        answer:
          "No. The generator uses the Web Crypto API inside your browser. Generated passwords, passphrases, recovery codes, PINs, and tokens are not sent to the QCS server, analytics, logs, local storage, or a database."
      },
      {
        question: "How long should a strong password be?",
        answer:
          "For a randomly generated password stored in a password manager, 20 to 24 characters is a practical default. NIST requires at least 15 characters for single-factor passwords and recommends allowing at least 64 characters so users can use long passphrases."
      },
      {
        question: "Should I use a random password or a passphrase?",
        answer:
          "Use a long random password when a password manager can store and fill it. Use a randomly generated passphrase when a person must type or remember the secret. Every account should still receive a unique value and MFA wherever available."
      },
      {
        question: "Can I use these values for routers, firewalls, Wi-Fi, and API integrations?",
        answer:
          "Yes, after checking the vendor's accepted length and character rules. Store administrative and service secrets in an approved password or secrets manager, avoid chat and email handovers, and rotate temporary credentials after use."
      }
    ];
  }

  return [
    {
      question: `What does the ${tool.shortTitle} tool check?`,
      answer: tool.outputPromise
    },
    {
      question: `When should I use the ${tool.shortTitle} tool?`,
      answer: `Use it when you need a quick public signal for ${tool.searchIntent.join(", ")} before deeper troubleshooting.`
    },
    {
      question: "When should this become a service request?",
      answer: `If the result affects users, email delivery, security exposure, firewall access, or a client requirement, route it to ${tool.serviceIntent}.`
    }
  ];
}

export default async function NetworkToolPage({ params }: NetworkToolPageProps) {
  const { slug } = await params;
  const tool = getNetworkUtilityTool(slug);
  if (!tool) notFound();
  const Icon = tool.icon;
  const faqs = toolFaqs(tool);
  const isPasswordGenerator = tool.slug === "strong-password-generator";

  return (
    <main>
      <StructuredData
        data={[
          {
            "@context": "https://schema.org",
            "@type": "WebApplication",
            name: tool.title,
            applicationCategory: isPasswordGenerator ? "SecurityApplication" : "NetworkApplication",
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
            },
            ...(isPasswordGenerator
              ? {
                  featureList: [
                    "Browser-only cryptographic generation",
                    "Random passwords and passphrases",
                    "Wi-Fi keys and device PINs",
                    "Recovery codes and API tokens"
                  ]
                }
              : {})
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
      <section className="page-hero tool-page-hero">
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

      <section className="section tool-run-section" id="run-tool">
        <NetworkToolRunner slug={tool.slug} />
      </section>

      <section className="section split tool-intro">
        <div>
          <Icon size={44} />
          <h2>{isPasswordGenerator ? "What this tool generates" : "What this tool checks"}</h2>
          <p>{tool.outputPromise}</p>
        </div>
        <div className="search-intent-panel">
          <p className="eyebrow">{isPasswordGenerator ? "Credential scenarios" : "Built for practical checks"}</p>
          <h2>{isPasswordGenerator ? "Built for real access workflows" : "Use it when someone asks:"}</h2>
          <div className="pill-cloud">
            {tool.searchIntent.map((intent) => (
              <span key={intent}>{intent}</span>
            ))}
          </div>
        </div>
      </section>

      <section className="section">
        <div className="section-heading">
          <p className="eyebrow">Answer block</p>
          <h2>{isPasswordGenerator ? "Password generation, handling, and policy answers" : "What this tool tells you and when to escalate"}</h2>
        </div>
        <div className="faq-grid">
          {faqs.map((faq) => (
            <article className="faq-card" key={faq.question}>
              <CardVisual title={faq.question} context={tool.title} />
              <h3>{faq.question}</h3>
              <p>{faq.answer}</p>
            </article>
          ))}
        </div>
      </section>

      {isPasswordGenerator && (
        <section className="section">
          <div className="section-heading">
            <p className="eyebrow">Security baseline</p>
            <h2>Modern password security prioritizes length, randomness, uniqueness, and MFA.</h2>
            <p>
              The presets favour cryptographic randomness and real operating context. They are starting points, not a
              replacement for vendor limits, a password manager, secrets management, or multifactor authentication.
            </p>
          </div>
          <div className="pillar-grid password-guidance-grid">
            <article className="pillar-card">
              <span>01</span>
              <h3>NIST-aligned length</h3>
              <p>
                Single-factor passwords should be at least 15 characters. Systems should permit at least 64 characters,
                accept spaces, and avoid arbitrary composition rules.
              </p>
              <a className="text-link" href="https://pages.nist.gov/800-63-4/sp800-63b.html#passwords">
                NIST SP 800-63B guidance
              </a>
            </article>
            <article className="pillar-card">
              <span>02</span>
              <h3>Password-manager first</h3>
              <p>
                Use a unique generated value for every account. Enable MFA, allow password-manager autofill, and screen
                user-chosen passwords against common and breached-password blocklists.
              </p>
              <a className="text-link" href="https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html">
                OWASP authentication guidance
              </a>
            </article>
            <article className="pillar-card">
              <span>03</span>
              <h3>Controlled secret handling</h3>
              <p>
                Put privileged passwords and service tokens in an approved vault. Keep recovery codes offline, avoid
                email or chat handovers, and rotate credentials when exposure or compromise is suspected.
              </p>
              <a className="text-link" href="https://www.cisa.gov/secure-our-world">
                CISA Secure Our World
              </a>
            </article>
          </div>
        </section>
      )}

      <section className="section split">
        <div className="section-heading">
          <p className="eyebrow">From tool result to fix</p>
          <h2>{tool.cta}</h2>
          <p>
            {isPasswordGenerator
              ? "Use generated credentials inside an approved password manager or secrets vault. QCS can help review administrative access, MFA coverage, shared credentials, service-account ownership, and credential handover controls."
              : "A public tool can show the symptom. QuantumCrafters Studio can help validate the root cause, document the change, and turn it into a managed service, network security, cloud, or penetration testing workflow."}
          </p>
        </div>
        <LeadForm interest={tool.serviceIntent} pipeline={tool.serviceIntent} compact />
      </section>
    </main>
  );
}
