import Image from "next/image";
import Link from "next/link";
import { AssessmentTool } from "@/components/assessment-tool";
import { CardVisual } from "@/components/card-visual";
import { EnvatoVisualSystem } from "@/components/envato-visual-system";
import { IntentRouter } from "@/components/intent-router";
import { LeadForm } from "@/components/lead-form";
import { ResourceDownloads } from "@/components/resource-downloads";
import { SectionMotionGraphic } from "@/components/section-motion-graphic";
import {
  automationFlows,
  buyerJourneys,
  commandLayers,
  deliveryWorkflow,
  industryCoverage,
  marketEdges,
  operatingModes,
  positioning,
  proofSignals,
  services,
  solutionPages,
  supportModelComparison,
  vendorCoverage
} from "@/lib/content";
import { networkUtilityTools } from "@/lib/network-tools";

const coverageVisuals = [
  { src: "/brand/envato/icons/global-cloud-network.svg", label: "Global routing" },
  { src: "/brand/envato/icons/multicloud-network.svg", label: "Multicloud" },
  { src: "/brand/envato/icons/router-cloud-network.svg", label: "Branch edge" },
  { src: "/brand/envato/icons/security-cloud-network.svg", label: "Secure access" }
];

const resourceVisuals = [
  { src: "/brand/envato/objects/locked-data-folder.png", label: "Evidence pack" },
  { src: "/brand/envato/icons/server-cloud-network.svg", label: "Tool output" },
  { src: "/brand/envato/library/padlock-security.webp", label: "Security checklist" }
];

export default function HomePage() {
  return (
    <main>
      <section className="hero-section futuristic-hero">
        <Image className="hero-bg-image" src="/brand/network-command-hero.png" alt="" fill priority sizes="100vw" />
        <div className="hero-copy">
          <Image
            className="hero-logo"
            src="/brand/quantumcrafters-logo.png"
            alt="QuantumCrafters Studio Pvt. Ltd."
            width={328}
            height={100}
            priority
            style={{ width: "min(188px, 54vw)", height: "auto" }}
          />
          <p className="eyebrow">{positioning.eyebrow}</p>
          <h1>{positioning.headline}</h1>
          <p>{positioning.body}</p>
          <div className="button-row">
            <Link className="button primary large" href="/diagnose">
              {positioning.primaryCta}
            </Link>
            <Link className="button secondary dark large" href="/solutions">
              See Solutions
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

        <div className="network-visual" aria-label="QuantumCrafters secure network operations illustration">
          <div className="hero-illustration-shell">
            <Image
              className="hero-network-illustration"
              src="/brand/envato/illustrations/isometric-data-center-network.svg"
              alt="Isometric secure data center network with connected cloud and security systems"
              width={520}
              height={530}
              priority
            />

            <div className="hero-readiness-card" aria-label="Network readiness assessment preview">
              <span>Readiness score</span>
              <strong>82</strong>
              <small>Fix-first view before a technical call</small>
              <Link className="mini-cta" href="/diagnose">
                Run assessment
              </Link>
            </div>

            <div className="hero-signal-grid" aria-label="What QuantumCrafters maps first">
              <span>
                <Image src="/brand/envato/icons/router-cloud-network.svg" alt="" width={32} height={32} />
                Firewall
              </span>
              <span>
                <Image src="/brand/envato/icons/security-cloud-network.svg" alt="" width={32} height={32} />
                Security
              </span>
              <span>
                <Image src="/brand/envato/icons/multicloud-network.svg" alt="" width={32} height={32} />
                Cloud
              </span>
            </div>
          </div>
        </div>
      </section>

      <section className="section mission-band motion-section">
        <div className="mission-copy">
          <p className="eyebrow">Why this exists</p>
          <h2>Your network should not feel like a mystery every time something breaks.</h2>
          <p>
            QCS helps teams understand what is happening, what is exposed, what should be fixed first, and which support
            or training path makes sense before production changes begin.
          </p>
        </div>
        <div className="mission-grid">
          {commandLayers.slice(0, 3).map((layer) => {
            const Icon = layer.icon;
            return (
              <article className="mission-card" key={layer.title}>
                <Icon size={26} />
                <h3>{layer.title}</h3>
                <p>{layer.description}</p>
              </article>
            );
          })}
        </div>
      </section>

      <section className="section motion-section">
        <IntentRouter />
      </section>

      <EnvatoVisualSystem />

      <section className="section media-section motion-section">
        <div className="section-heading">
          <p className="eyebrow">Built for your situation</p>
          <h2>Choose the path that matches the pressure you are under.</h2>
          <p>
            Outage, firewall drift, cloud exposure, pentest pressure, monitoring gaps, or career development: every path
            starts with a clear first step.
          </p>
        </div>
        <SectionMotionGraphic variant="network" />
        <div className="journey-grid">
          {buyerJourneys.map((journey) => (
            <article className="journey-card" key={journey.title}>
              <CardVisual title={journey.title} context={journey.route} />
              <h3>{journey.title}</h3>
              <p>{journey.description}</p>
              <span>{journey.route}</span>
            </article>
          ))}
        </div>
      </section>

      <section className="section media-section motion-section" id="solutions">
        <div className="section-heading">
          <p className="eyebrow">Solution paths</p>
          <h2>Simple pages for the problems people actually search for.</h2>
          <p>
            Each path explains the issue, what evidence helps, and which QCS service or diagnostic should come next.
          </p>
        </div>
        <SectionMotionGraphic variant="security" />
        <div className="service-grid">
          {solutionPages.map((solution) => (
            <Link className="service-card" href={`/solutions/${solution.slug}`} key={solution.slug}>
              <CardVisual title={solution.title} context={solution.eyebrow} />
              <p className="eyebrow">{solution.eyebrow}</p>
              <h3>{solution.title}</h3>
              <p>{solution.answer}</p>
              <span className="text-link">Open solution</span>
            </Link>
          ))}
        </div>
      </section>

      <section className="section dark-showcase outcome-showcase motion-section">
        <div className="section-heading">
          <p className="eyebrow">What makes QCS different</p>
          <h2>Practical network expertise, security discipline, and training depth in one place.</h2>
        </div>
        <div className="showcase-illustration-panel" aria-label="Network operating model illustration">
          <Image
            className="showcase-illustration-image"
            src="/brand/envato/cyber/security-shield-network.png"
            alt="Network security shield illustration showing protected cloud and infrastructure controls"
            width={620}
            height={390}
            sizes="(max-width: 900px) 92vw, 34vw"
          />
          <div className="showcase-signal-stack" aria-hidden="true">
            <span>
              <Image src="/brand/envato/icons/router-cloud-network.svg" alt="" width={26} height={26} />
              Topology
            </span>
            <span>
              <Image src="/brand/envato/icons/security-cloud-network.svg" alt="" width={26} height={26} />
              Controls
            </span>
            <span>
              <Image src="/brand/envato/icons/server-cloud-network.svg" alt="" width={26} height={26} />
              Evidence
            </span>
          </div>
          <div className="showcase-illustration-overlay">
            <span>QCS operating map</span>
            <strong>Topology, controls, and proof in one practical view.</strong>
          </div>
        </div>
        <div className="edge-grid">
          {marketEdges.map((edge) => (
            <article className="authority-card" key={edge.title}>
              <CardVisual title={edge.title} context={edge.description} />
              <h3>{edge.title}</h3>
              <p>{edge.description}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="section media-section motion-section" id="services">
        <div className="section-heading">
          <p className="eyebrow">Core services</p>
          <h2>Operate, secure, monitor, test, troubleshoot, and train.</h2>
          <p>
            Pick a service when you already know the need. Start with an assessment when the problem is still unclear.
          </p>
        </div>
        <SectionMotionGraphic variant="services" />
        <div className="service-grid">
          {services.map((service) => {
            const Icon = service.icon;
            return (
              <article className="service-card" key={service.slug}>
                <CardVisual title={service.title} context={service.summary} icon={Icon} />
                <p className="eyebrow">{service.kicker}</p>
                <h3>{service.title}</h3>
                <p>{service.summary}</p>
                <Link className="text-link" href={`/services/${service.slug}`}>
                  View service
                </Link>
              </article>
            );
          })}
        </div>
      </section>

      <section className="section motion-section" id="support-models">
        <div className="section-heading">
          <p className="eyebrow">Support model</p>
          <h2>Move from reactive fixes to controlled network decisions.</h2>
        </div>
        <div className="comparison-grid">
          <article className="comparison-panel old">
            <CardVisual title={supportModelComparison.old.title} context={supportModelComparison.old.label} tone="dark" />
            <p className="eyebrow">{supportModelComparison.old.label}</p>
            <h3>{supportModelComparison.old.title}</h3>
            <ul className="check-list muted">
              {supportModelComparison.old.items.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </article>
          <article className="comparison-panel qcs">
            <CardVisual title={supportModelComparison.qcs.title} context={supportModelComparison.qcs.label} tone="green" />
            <p className="eyebrow">{supportModelComparison.qcs.label}</p>
            <h3>{supportModelComparison.qcs.title}</h3>
            <ul className="check-list">
              {supportModelComparison.qcs.items.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </article>
        </div>
      </section>

      <section className="section motion-section">
        <div className="section-heading">
          <p className="eyebrow">Command modes</p>
          <h2>Five clear ways QCS can help.</h2>
        </div>
        <div className="mode-grid">
          {operatingModes.map((mode) => {
            const Icon = mode.icon;
            return (
              <Link className="mode-card" href={mode.href} key={mode.title}>
                <CardVisual title={mode.title} context={mode.description} icon={Icon} />
                <h3>{mode.title}</h3>
                <p>{mode.description}</p>
              </Link>
            );
          })}
        </div>
      </section>

      <section className="section media-section motion-section" id="tools">
        <div className="section-heading">
          <p className="eyebrow">Guided assessment</p>
          <h2>Start with a readiness snapshot when the next step is not obvious.</h2>
          <p>
            The assessment asks a few practical questions and returns a risk band, evidence checklist, and recommended
            next action.
          </p>
        </div>
        <SectionMotionGraphic variant="assessment" />
        <AssessmentTool />
      </section>

      <section className="section media-section motion-section">
        <div className="section-heading">
          <p className="eyebrow">Free network utilities</p>
          <h2>Run quick checks and generate controlled vendor task plans before deeper troubleshooting.</h2>
        </div>
        <SectionMotionGraphic variant="utilities" />
        <div className="utility-grid compact">
          {networkUtilityTools.map((tool) => {
            const Icon = tool.icon;
            return (
              <Link className="utility-card" href={`/network-tools/${tool.slug}`} key={tool.slug}>
                <CardVisual title={tool.title} context={tool.category} icon={Icon} />
                <p className="eyebrow">{tool.category}</p>
                <h3>{tool.shortTitle}</h3>
                <p>{tool.description}</p>
              </Link>
            );
          })}
        </div>
      </section>

      <section className="section process-motion-section motion-section" id="process">
        <div className="section-heading">
          <p className="eyebrow">How the work moves</p>
          <h2>A simpler path from symptom to decision.</h2>
        </div>
        <div className="process-signal-rail" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
        <div className="process-timeline">
          {deliveryWorkflow.map((step, index) => (
            <article key={step.title}>
              <span>{String(index + 1).padStart(2, "0")}</span>
              <h3>{step.title}</h3>
              <p>{step.description}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="section motion-section">
        <div className="section-heading">
          <p className="eyebrow">First conversation</p>
          <h2>What you can expect after sharing a request.</h2>
        </div>
        <div className="automation-grid">
          {automationFlows.map((flow) => {
            const Icon = flow.icon;
            return (
              <article className="flow-card" key={flow.title}>
                <CardVisual title={flow.title} context={flow.description} icon={Icon} />
                <h3>{flow.title}</h3>
                <p>{flow.description}</p>
              </article>
            );
          })}
        </div>
      </section>

      <section className="section motion-section" id="vendors">
        <div className="section-heading">
          <p className="eyebrow">Coverage</p>
          <h2>Support across the vendors, clouds, and environments buyers actually use.</h2>
        </div>
        <div className="coverage-visual-grid" aria-label="Network coverage visual signals">
          {coverageVisuals.map((visual) => (
            <span key={visual.label}>
              <Image src={visual.src} alt="" width={42} height={42} />
              {visual.label}
            </span>
          ))}
        </div>
        <div className="pill-cloud">
          {vendorCoverage.map((vendor) => (
            <span key={vendor}>{vendor}</span>
          ))}
        </div>
        <div className="pill-cloud muted" aria-label="Industries supported">
          {industryCoverage.map((industry) => (
            <span key={industry}>{industry}</span>
          ))}
        </div>
      </section>

      <section className="section motion-section">
        <div className="section-heading">
          <p className="eyebrow">Useful resources</p>
          <h2>Prepare better before a call, audit, incident review, or career decision.</h2>
        </div>
        <div className="resource-command-panel" aria-label="Resource library visual preview">
          <div className="resource-visual-stack" aria-hidden="true">
            {resourceVisuals.map((visual) => (
              <span key={visual.label}>
                <Image src={visual.src} alt="" width={86} height={86} />
              </span>
            ))}
          </div>
          <div>
            <p className="eyebrow">Lead-ready knowledge base</p>
            <h3>Resources should make the next technical conversation sharper.</h3>
            <p>
              Checklists, tool outputs, and assessment notes help buyers describe the issue clearly before they ask for
              managed support, security review, cloud guidance, or training.
            </p>
          </div>
        </div>
        <ResourceDownloads />
      </section>

      <section className="section split final-cta-band motion-section">
        <div className="section-heading">
          <p className="eyebrow">Request review</p>
          <h2>Tell QCS what is happening. We will help you choose the right next step.</h2>
          <p>
            Share the issue, the environment, or the training goal. Keep it simple; the first response should help you
            move with more clarity.
          </p>
        </div>
        <LeadForm interest="Network command assessment" pipeline="Managed Network Services" />
      </section>
    </main>
  );
}
