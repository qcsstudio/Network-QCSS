import Link from "next/link";
import { AssessmentTool } from "@/components/assessment-tool";
import { IntentRouter } from "@/components/intent-router";
import { LeadForm } from "@/components/lead-form";
import { ResourceDownloads } from "@/components/resource-downloads";
import { automationFlows, operatingModes, services } from "@/lib/content";

export default function HomePage() {
  return (
    <main>
      <section className="hero-section">
        <div className="hero-copy">
          <p className="eyebrow">Network administration. Security. Cloud. Pentesting. Training.</p>
          <h1>Your network is already telling a story. We help you read it, secure it, and keep it running.</h1>
          <p>
            A modern website outside and a marketing, lead generation, assessment, automation, and sales intelligence
            system inside.
          </p>
          <div className="button-row">
            <Link className="button primary large" href="/tools/network-risk-score">
              Run Network Risk Score
            </Link>
            <Link className="button secondary large" href="/admin">
              View Operator Dashboard
            </Link>
          </div>
        </div>
        <div className="network-visual" aria-label="Network command dashboard preview">
          <div className="visual-panel">
            <span className="signal online">NOC</span>
            <span className="signal alert">Firewall</span>
            <span className="signal online">Cloud</span>
            <span className="signal warn">Pentest</span>
            <div className="visual-score">
              <strong>82</strong>
              <span>Lead Score</span>
            </div>
          </div>
        </div>
      </section>

      <section className="section">
        <IntentRouter />
      </section>

      <section className="section" id="services">
        <div className="section-heading">
          <p className="eyebrow">Operating modes</p>
          <h2>Build, secure, monitor, test, and train from one system.</h2>
          <p>Visitors see simple choices. You get structured intent data, pipeline routing, and follow-up triggers.</p>
        </div>
        <div className="mode-grid">
          {operatingModes.map((mode) => {
            const Icon = mode.icon;
            return (
              <Link className="mode-card" href={mode.href} key={mode.title}>
                <Icon size={28} />
                <h3>{mode.title}</h3>
                <p>{mode.description}</p>
              </Link>
            );
          })}
        </div>
      </section>

      <section className="section">
        <div className="section-heading">
          <p className="eyebrow">Service architecture</p>
          <h2>Service pages become funnels, not thin descriptions.</h2>
        </div>
        <div className="service-grid">
          {services.map((service) => {
            const Icon = service.icon;
            return (
              <article className="service-card" key={service.slug}>
                <Icon size={26} />
                <p className="eyebrow">{service.kicker}</p>
                <h3>{service.title}</h3>
                <p>{service.summary}</p>
                <Link className="text-link" href={`/services/${service.slug}`}>
                  Open service page
                </Link>
              </article>
            );
          })}
        </div>
      </section>

      <section className="section split" id="tools">
        <div className="section-heading">
          <p className="eyebrow">Diagnostic layer</p>
          <h2>The lead magnet is an assessment tool, not only a PDF.</h2>
          <p>
            Each completed tool stores the result, pipeline, recommendation, country signal, consent state, and
            attribution context.
          </p>
        </div>
        <AssessmentTool />
      </section>

      <section className="section">
        <div className="section-heading">
          <p className="eyebrow">Automation layer</p>
          <h2>Every serious interaction becomes a next step.</h2>
        </div>
        <div className="automation-grid">
          {automationFlows.map((flow) => {
            const Icon = flow.icon;
            return (
              <article className="flow-card" key={flow.title}>
                <Icon size={26} />
                <h3>{flow.title}</h3>
                <p>{flow.description}</p>
              </article>
            );
          })}
        </div>
      </section>

      <section className="section">
        <div className="section-heading">
          <p className="eyebrow">Information engine</p>
          <h2>Resources create SEO value and measurable buying signals.</h2>
        </div>
        <ResourceDownloads />
      </section>

      <section className="section split">
        <div className="section-heading">
          <p className="eyebrow">Lead capture</p>
          <h2>Collect identity only when the value exchange is clear.</h2>
          <p>
            Anonymous activity stays anonymous until the visitor submits a form, books a call, downloads a gated
            resource, or contacts you.
          </p>
        </div>
        <LeadForm interest="Managed network services" pipeline="Managed Network Services" />
      </section>
    </main>
  );
}
