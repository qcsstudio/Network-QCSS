import Image from "next/image";
import Link from "next/link";
import { AssessmentTool } from "@/components/assessment-tool";
import { EnvatoVisualSystem } from "@/components/envato-visual-system";
import { IntentRouter } from "@/components/intent-router";
import { LeadForm } from "@/components/lead-form";
import { ResourceDownloads } from "@/components/resource-downloads";
import {
  automationFlows,
  authorityEngine,
  buyerJourneys,
  commandLayers,
  contentPillars,
  deliveryWorkflow,
  industryCoverage,
  marketEdges,
  operatingModes,
  positioning,
  proofSignals,
  researchSignals,
  seoAioBlueprint,
  services,
  solutionPages,
  supportModelComparison,
  vendorCoverage
} from "@/lib/content";
import { networkUtilityTools } from "@/lib/network-tools";

export default function HomePage() {
  return (
    <main>
      <section className="hero-section">
        <Image className="hero-bg-image" src="/brand/network-command-hero.png" alt="" fill priority sizes="100vw" />
        <div className="hero-copy">
          <Image
            className="hero-logo"
            src="/brand/quantumcrafters-logo.png"
            alt="QuantumCrafters Studio Pvt. Ltd."
            width={328}
            height={100}
            priority
            style={{ width: "min(232px, 68vw)", height: "auto" }}
          />
          <p className="eyebrow">{positioning.eyebrow}</p>
          <h1>{positioning.headline}</h1>
          <p>{positioning.body}</p>
          <div className="button-row">
            <Link className="button primary large" href="/diagnose">
              {positioning.primaryCta}
            </Link>
            <Link className="button secondary dark large" href="/solutions">
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
          <div className="visual-panel command-console">
            <div className="console-topline">
              <span>Command readiness</span>
              <strong>Live</strong>
            </div>
            <div className="visual-radar" aria-hidden="true">
              <span />
              <span />
              <span />
            </div>
            <span className="signal online">Assess</span>
            <span className="signal alert">Exposure</span>
            <span className="signal online">Operate</span>
            <span className="signal warn">Retest</span>
            <div className="visual-score">
              <strong>QCS</strong>
              <span>Network Command</span>
            </div>
            <div className="telemetry-stack" aria-hidden="true">
              <span />
              <span />
              <span />
              <span />
            </div>
          </div>
        </div>
      </section>

      <section className="section mission-band">
        <div className="mission-copy">
          <p className="eyebrow">Full site refresh</p>
          <h2>A website that works like a marketing and service qualification system.</h2>
          <p>
            The public layer educates buyers and learners. The tool layer captures high-intent technical signals. The
            private layer turns assessments, resources, attribution, and leads into a funnel you can manage.
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

      <section className="section">
        <IntentRouter />
      </section>

      <section className="section">
        <div className="section-heading">
          <p className="eyebrow">Research-backed direction</p>
          <h2>Position QCS where network operations, security, cloud, and training are converging.</h2>
          <p>
            The refreshed structure is designed around the demand shift toward managed operations, SASE/Zero Trust,
            cloud-connected networks, useful tools, and evidence-led service buying.
          </p>
        </div>
        <div className="edge-grid">
          {researchSignals.map((signal) => (
            <article className="edge-card" key={signal.title}>
              <h3>{signal.title}</h3>
              <p>{signal.description}</p>
            </article>
          ))}
        </div>
      </section>

      <EnvatoVisualSystem />

      <section className="section" id="solutions">
        <div className="section-heading">
          <p className="eyebrow">Solution architecture</p>
          <h2>Start with the buyer problem, then route to service, tool, and evidence.</h2>
          <p>
            These pages are built for answer engines and search intent: each one gives a direct answer, explains the
            problem, links to services, and sends qualified visitors into an assessment.
          </p>
        </div>
        <div className="service-grid">
          {solutionPages.map((solution) => (
            <Link className="service-card" href={`/solutions/${solution.slug}`} key={solution.slug}>
              <p className="eyebrow">{solution.eyebrow}</p>
              <h3>{solution.title}</h3>
              <p>{solution.answer}</p>
              <span className="text-link">Open solution</span>
            </Link>
          ))}
        </div>
      </section>

      <section className="section">
        <div className="section-heading">
          <p className="eyebrow">Why QCS</p>
          <h2>Built for teams that need action, evidence, and continuity.</h2>
          <p>
            The strongest positioning is not “we do IT support.” It is a command system that diagnoses, operates,
            secures, tests, and teaches networks with measurable outputs.
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
          <p className="eyebrow">Core services</p>
          <h2>Eight commercial service pages with assessment-led CTAs.</h2>
          <p>
            Each service has a clear buyer trigger, scope, deliverables, FAQ content, and a diagnostic CTA that feeds the
            owner dashboard.
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
                  View service
                </Link>
              </article>
            );
          })}
        </div>
      </section>

      <section className="section" id="support-models">
        <div className="section-heading">
          <p className="eyebrow">Operating model</p>
          <h2>Move buyers from reactive support to governed network operations.</h2>
        </div>
        <div className="comparison-grid">
          <article className="comparison-panel old">
            <p className="eyebrow">{supportModelComparison.old.label}</p>
            <h3>{supportModelComparison.old.title}</h3>
            <ul className="check-list muted">
              {supportModelComparison.old.items.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </article>
          <article className="comparison-panel qcs">
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

      <section className="section">
        <div className="section-heading">
          <p className="eyebrow">Command modes</p>
          <h2>Five doors into one network command system.</h2>
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
          <p className="eyebrow">Buyer journey routing</p>
          <h2>Different visitors should feel they found the exact door.</h2>
        </div>
        <div className="journey-grid">
          {buyerJourneys.map((journey) => (
            <article className="journey-card" key={journey.title}>
              <h3>{journey.title}</h3>
              <p>{journey.description}</p>
              <span>{journey.route}</span>
            </article>
          ))}
        </div>
      </section>

      <section className="section dark-showcase">
        <div className="section-heading">
          <p className="eyebrow">SEO and AIO engine</p>
          <h2>Helpful content, structured entities, tools, and schema instead of empty keyword pages.</h2>
          <p>
            The site is structured to help people first: answer the question, show the method, provide a tool or
            checklist, and route the next action logically.
          </p>
        </div>
        <div className="authority-grid">
          {authorityEngine.map((block) => (
            <article className="authority-card" key={block.title}>
              <h3>{block.title}</h3>
              <p>{block.description}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="section">
        <div className="section-heading">
          <p className="eyebrow">AIO copy model</p>
          <h2>Each page should be easy for humans, crawlers, and AI systems to summarize correctly.</h2>
        </div>
        <div className="pillar-grid">
          {seoAioBlueprint.map((item) => (
            <article className="pillar-card" key={item.title}>
              <h3>{item.title}</h3>
              <p>{item.description}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="section" id="tools">
        <div className="section-heading">
          <p className="eyebrow">Assessment layer</p>
          <h2>Lead magnets that behave like technical triage.</h2>
          <p>
            Assessments store risk band, service pipeline, evidence needs, CTA owner, response window, consent state,
            and attribution context.
          </p>
        </div>
        <AssessmentTool />
      </section>

      <section className="section">
        <div className="section-heading">
          <p className="eyebrow">Free network utilities</p>
          <h2>Short tools that attract high-intent troubleshooting searches.</h2>
        </div>
        <div className="utility-grid compact">
          {networkUtilityTools.map((tool) => {
            const Icon = tool.icon;
            return (
              <Link className="utility-card" href={`/network-tools/${tool.slug}`} key={tool.slug}>
                <Icon size={26} />
                <p className="eyebrow">{tool.category}</p>
                <h3>{tool.shortTitle}</h3>
                <p>{tool.description}</p>
              </Link>
            );
          })}
        </div>
      </section>

      <section className="section" id="vendors">
        <div className="section-heading">
          <p className="eyebrow">Coverage</p>
          <h2>Support across the vendors, clouds, and environments buyers actually use.</h2>
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

      <section className="section" id="process">
        <div className="section-heading">
          <p className="eyebrow">Delivery workflow</p>
          <h2>Discover. Diagnose. Design. Deliver. Develop.</h2>
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

      <section className="section">
        <div className="section-heading">
          <p className="eyebrow">Content clusters</p>
          <h2>Own the topics where service buyers and learners overlap.</h2>
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

      <section className="section split">
        <div className="section-heading">
          <p className="eyebrow">Lead capture</p>
          <h2>Convert serious visitors without making the brand feel like a form factory.</h2>
          <p>
            Anonymous activity stays anonymous until the visitor submits a form, resource request, assessment follow-up,
            WhatsApp action, or booking request.
          </p>
        </div>
        <LeadForm interest="Network command assessment" pipeline="Managed Network Services" />
      </section>
    </main>
  );
}
