import Image from "next/image";
import Link from "next/link";
import { AssessmentTool } from "@/components/assessment-tool";
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

        <div className="network-visual" aria-label="QuantumCrafters network readiness snapshot">
          <div className="visual-panel network-workspace compact-command">
            <div className="workspace-scorecard">
              <div>
                <span>Network readiness snapshot</span>
                <strong>82</strong>
                <small>Score before a technical call</small>
              </div>
              <Link className="mini-cta" href="/diagnose">
                Run assessment
              </Link>
            </div>

            <div className="workspace-priority-grid" aria-label="What the readiness snapshot gives visitors">
              <article>
                <Image src="/brand/envato/icons/router-cloud-network.svg" alt="" width={32} height={32} />
                <span>Fix first</span>
                <strong>Firewall, VPN, DNS or route issue</strong>
              </article>
              <article>
                <Image src="/brand/envato/icons/security-cloud-network.svg" alt="" width={32} height={32} />
                <span>Evidence</span>
                <strong>Logs, rules, exposure and ownership</strong>
              </article>
              <article>
                <Image src="/brand/envato/icons/multicloud-network.svg" alt="" width={32} height={32} />
                <span>Cloud path</span>
                <strong>VPC/VNet, public IPs and hybrid VPN</strong>
              </article>
              <article>
                <Image src="/brand/envato/icons/protected-cloud-network.svg" alt="" width={32} height={32} />
                <span>Next action</span>
                <strong>Support, pentest, cleanup or training</strong>
              </article>
            </div>

            <div className="workspace-outcome-rail" aria-label="QCS response flow">
              <span>Assess</span>
              <span>Prioritize</span>
              <span>Resolve</span>
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
        <div className="edge-grid">
          {marketEdges.map((edge) => (
            <article className="authority-card" key={edge.title}>
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
        <SectionMotionGraphic variant="cloud" />
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

      <section className="section motion-section" id="support-models">
        <div className="section-heading">
          <p className="eyebrow">Support model</p>
          <h2>Move from reactive fixes to controlled network decisions.</h2>
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
                <Icon size={28} />
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
          <h2>Run quick public checks before deeper troubleshooting.</h2>
        </div>
        <SectionMotionGraphic variant="cloud" />
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
                <Icon size={26} />
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
