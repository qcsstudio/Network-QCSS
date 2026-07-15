import Link from "next/link";
import Image from "next/image";
import { AssessmentTool } from "@/components/assessment-tool";
import { EnvatoVisualSystem } from "@/components/envato-visual-system";
import { IntentRouter } from "@/components/intent-router";
import { LeadForm } from "@/components/lead-form";
import { ResourceDownloads } from "@/components/resource-downloads";
import {
  automationFlows,
  authorityEngine,
  buyerJourneys,
  commandNavItems,
  commandLayers,
  contentPillars,
  conversionMagnets,
  deliveryWorkflow,
  industryCoverage,
  marketEdges,
  operatingModes,
  positioning,
  proofSignals,
  services,
  supportModelComparison,
  vendorCoverage,
  visualPositioningModules
} from "@/lib/content";
import { networkUtilityTools } from "@/lib/network-tools";

export default function HomePage() {
  return (
    <main>
      <section className="hero-section">
        <Image
          className="hero-bg-image"
          src="/brand/network-command-hero.png"
          alt=""
          fill
          priority
          sizes="100vw"
        />
        <div className="hero-copy">
          <Image
            className="hero-logo"
            src="/brand/quantumcrafters-logo.png"
            alt="QuantumCrafters Studio Pvt. Ltd."
            width={328}
            height={100}
            priority
            style={{ width: "min(222px, 68vw)", height: "auto" }}
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
          <div className="visual-panel command-console">
            <div className="console-topline">
              <span>Live signal map</span>
              <strong>98%</strong>
            </div>
            <div className="visual-radar" aria-hidden="true">
              <span />
              <span />
              <span />
            </div>
            <span className="signal online">NOC 24x7</span>
            <span className="signal alert">Firewall drift</span>
            <span className="signal online">Cloud route</span>
            <span className="signal warn">Pentest scope</span>
            <div className="visual-score">
              <strong>QCS</strong>
              <span>Command Score</span>
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
          <p className="eyebrow">Out-of-box website architecture</p>
          <h2>A simple public website on the surface. A network growth operating system underneath.</h2>
          <p>
            The design now positions QuantumCrafters as a modern command studio: one place for network operations,
            security assurance, cloud connectivity, penetration testing, troubleshooting, institute programs, and
            measurable lead intelligence.
          </p>
        </div>
        <div className="mission-grid">
          {commandLayers.map((layer) => {
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

      <EnvatoVisualSystem />

      <nav className="command-nav" aria-label="QuantumCrafters command sections">
        {commandNavItems.map((item) => (
          <Link href={item.href} key={item.href}>
            {item.label}
          </Link>
        ))}
      </nav>

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

      <section className="section visual-split">
        <div className="section-heading">
          <p className="eyebrow">Positioning system</p>
          <h2>Futuristic does not mean decorative. Every visual should explain trust, speed, and control.</h2>
          <p>
            The website should feel premium and direct while quietly proving that QuantumCrafters understands networks,
            security, cloud, training, and marketing automation as one connected system.
          </p>
          <div className="module-list">
            {visualPositioningModules.map((module) => (
              <article key={module.title}>
                <h3>{module.title}</h3>
                <p>{module.description}</p>
              </article>
            ))}
          </div>
        </div>
        <div className="holo-diagram" aria-label="QuantumCrafters website and marketing intelligence layers">
          <div className="diagram-ring">
            <span className="diagram-node node-a">SEO</span>
            <span className="diagram-node node-b">Tools</span>
            <span className="diagram-node node-c">Leads</span>
            <span className="diagram-node node-d">CRM</span>
            <strong>QCS</strong>
          </div>
          <div className="diagram-rail">
            {conversionMagnets.map((magnet) => (
              <span key={magnet}>{magnet}</span>
            ))}
          </div>
        </div>
      </section>

      <section className="section">
        <div className="section-heading">
          <p className="eyebrow">Buyer journey routing</p>
          <h2>Different visitors should feel they found the exact door, not a generic IT vendor.</h2>
          <p>
            The site separates urgent support, strategic security, cloud network, pentest, and institute audiences
            while still keeping them connected to one QuantumCrafters command system.
          </p>
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

      <section className="section" id="support-models">
        <div className="section-heading">
          <p className="eyebrow">Support model</p>
          <h2>The old support model is not built for modern network infrastructure.</h2>
          <p>
            Reactive support creates drift. The QuantumCrafters model turns network help into governed operations with
            diagnosis, controlled change, evidence, and continuity.
          </p>
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

      <section className="section dark-showcase">
        <div className="section-heading">
          <p className="eyebrow">Authority engine</p>
          <h2>Content-rich enough to rank, useful enough to convert, structured enough for AI answers.</h2>
          <p>
            The content system should win search demand from buyers, learners, IT teams, and urgent troubleshooting
            visitors. Each page has a job: educate, diagnose, route, or qualify.
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

      <section className="section" id="vendors">
        <div className="section-heading">
          <p className="eyebrow">Multi-vendor coverage</p>
          <h2>Support across the platforms real networks actually use.</h2>
          <p>
            Real environments are mixed. We support the vendors, clouds, and business scenarios that show up in
            multi-site networks, firewall estates, and cloud-connected teams.
          </p>
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
          <h2>Diagnose. Stabilise. Secure. Support.</h2>
          <p>
            Every serious request should move through a clear operating rhythm so fixes are controlled, validated,
            documented, and ready for follow-up support.
          </p>
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

      <section className="section split" id="tools">
        <div className="section-heading">
          <p className="eyebrow">Diagnostic layer</p>
          <h2>Lead magnets should behave like engineering triage, not a shallow quiz.</h2>
          <p>
            Each completed assessment maps answers to risk domains, evidence requests, response urgency, service
            pipeline, recommended CTA, country signal, consent state, and attribution context. The browser shows a
            result instantly while the API recalculates a trusted server score for the dashboard.
          </p>
        </div>
        <AssessmentTool />
      </section>

      <section className="section">
        <div className="section-heading">
          <p className="eyebrow">Free network utilities</p>
          <h2>Short public tools that attract high-intent troubleshooting searches.</h2>
          <p>
            DNS, SSL, email security, header, and port checks bring useful traffic into the site. The visitor sees a
            simple utility; your dashboard sees a service-intent signal when consent allows analytics.
          </p>
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
