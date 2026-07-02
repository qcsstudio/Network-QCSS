import Link from "next/link";
import Image from "next/image";
import { AssessmentTool } from "@/components/assessment-tool";
import { IntentRouter } from "@/components/intent-router";
import { LeadForm } from "@/components/lead-form";
import { ResourceDownloads } from "@/components/resource-downloads";
import { automationFlows, contentPillars, marketEdges, operatingModes, positioning, proofSignals, services } from "@/lib/content";

export default function HomePage() {
  return (
    <main>
      <section className="hero-section">
        <div className="hero-copy">
          <Image
            className="hero-logo"
            src="/brand/quantumcrafters-logo.png"
            alt="QuantumCrafters Studio Pvt. Ltd."
            width={328}
            height={100}
            priority
          />
          <p className="eyebrow">{positioning.eyebrow}</p>
          <h1>{positioning.headline}</h1>
          <p>{positioning.body}</p>
          <div className="button-row">
            <Link className="button primary large" href="/tools/network-risk-score">
              {positioning.primaryCta}
            </Link>
            <Link className="button secondary large" href="#services">
              {positioning.secondaryCta}
            </Link>
          </div>
          <div className="proof-strip" aria-label="QuantumCrafters proof signals">
            {proofSignals.map((signal) => (
              <span key={signal.label}>
                <strong>{signal.value}</strong>
                {signal.label}
              </span>
            ))}
          </div>
        </div>
        <div className="network-visual" aria-label="Network command dashboard preview">
          <div className="visual-panel">
            <span className="signal online">NOC 24x7</span>
            <span className="signal alert">Firewall drift</span>
            <span className="signal online">Cloud route</span>
            <span className="signal warn">Pentest scope</span>
            <div className="visual-score">
              <strong>QCS</strong>
              <span>Command Score</span>
            </div>
          </div>
        </div>
      </section>

      <section className="section">
        <IntentRouter />
      </section>

      <section className="section flush">
        <div className="section-heading">
          <p className="eyebrow">Why QuantumCrafters</p>
          <h2>Built for buyers who need action, evidence, and continuity.</h2>
          <p>
            Competitors either lead with scale, pentest specialization, or training promises. QuantumCrafters Studio
            leads with an integrated operating model: diagnose the network, secure the path, test the exposure, train
            the people, and keep every interaction measurable.
          </p>
        </div>
        <div className="edge-grid">
          {marketEdges.map((edge) => (
            <article className="edge-card" key={edge.title}>
              <h3>{edge.title}</h3>
              <p>{edge.description}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="section" id="services">
        <div className="section-heading">
          <p className="eyebrow">Command modes</p>
          <h2>Five doors into one network command system.</h2>
          <p>
            A buyer can arrive through outages, security risk, cloud change, pentest pressure, or career development.
            The site routes that intent into the right service path.
          </p>
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
          <h2>Operational services with security depth and training credibility.</h2>
          <p>
            The offer is intentionally broader than a pentest vendor and more personal than an enterprise MSP: a studio
            that can stabilize, harden, test, and teach the same network environment.
          </p>
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
          <h2>Lead magnets should behave like engineering triage.</h2>
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
          <h2>The public site stays simple. The operator layer does the heavy lifting.</h2>
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
          <p className="eyebrow">Content strategy</p>
          <h2>Own the search clusters where service buyers and learners overlap.</h2>
          <p>
            The strongest path is not one giant keyword page. It is a cluster of focused service, problem, tool, and
            training pages tied to measurable lead magnets.
          </p>
        </div>
        <div className="pillar-grid">
          {contentPillars.map((pillar) => (
            <article className="pillar-card" key={pillar.title}>
              <h3>{pillar.title}</h3>
              <p>{pillar.description}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="section">
        <div className="section-heading">
          <p className="eyebrow">Resource engine</p>
          <h2>Give visitors a useful asset before asking for a sales conversation.</h2>
        </div>
        <ResourceDownloads />
      </section>

      <section className="section split">
        <div className="section-heading">
          <p className="eyebrow">Lead capture</p>
          <h2>Convert service buyers without making the brand feel like a form factory.</h2>
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
