import Image from "next/image";
import Link from "next/link";
import { CardVisual } from "@/components/card-visual";
import { CommandConsole } from "@/components/command-console";
import { EnvatoVisualSystem } from "@/components/envato-visual-system";
import { IntentRouter } from "@/components/intent-router";
import { LeadForm } from "@/components/lead-form";
import { ResourceDownloads } from "@/components/resource-downloads";
import { SectionMotionGraphic } from "@/components/section-motion-graphic";
import { SignalJourney } from "@/components/signal-journey";
import {
  deliveryWorkflow,
  industryCoverage,
  positioning,
  proofSignals,
  services,
  solutionPages,
  vendorCoverage
} from "@/lib/content";
import { networkUtilityTools } from "@/lib/network-tools";
import { listSecurityAdvisories } from "@/lib/advisories";

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

const assessmentPreview = [
  { step: "01", title: "Answer practical questions", detail: "Cover topology, controls, exposure, evidence, and ownership." },
  { step: "02", title: "Receive a risk band", detail: "See which operating domain needs attention first." },
  { step: "03", title: "Prepare the next action", detail: "Take an evidence checklist into the engineering review." }
];

export default async function HomePage() {
  const latestAdvisories = await listSecurityAdvisories(3);
  return (
    <main className="purpose-home">
      <section className="hero-section futuristic-hero">
        <Image
          className="hero-bg-image"
          src="/brand/network-command-hero.png"
          alt=""
          fill
          fetchPriority="high"
          priority
          quality={65}
          sizes="100vw"
        />
        <div className="hero-copy">
          <p className="eyebrow">{positioning.eyebrow}</p>
          <h1>{positioning.headline}</h1>
          <p>{positioning.body}</p>
          <div className="button-row">
            <Link className="button primary large" href="/diagnose">
              {positioning.primaryCta}
            </Link>
            <Link className="button secondary dark large" href="/network-tools">
              Open Free Tools
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

        <CommandConsole />
      </section>

      <SignalJourney variant="solution" />

      <section className="live-advisory-strip" aria-label="Latest network security advisories">
        <div>
          <p className="eyebrow">QCS Security Advisory Desk</p>
          <strong>{latestAdvisories.length ? "Official-source alerts, checked continuously." : "Official-source monitoring is active."}</strong>
        </div>
        <div className="live-advisory-items">
          {latestAdvisories.map((advisory) => (
            <Link href={`/security-advisories/${advisory.slug}`} key={advisory.id}>
              <span className={`severity-pill severity-${advisory.severity}`}>{advisory.severity}</span>
              <strong>{advisory.title}</strong>
            </Link>
          ))}
        </div>
        <Link className="button secondary" href="/security-advisories">Open desk</Link>
      </section>

      <nav className="home-command-nav" aria-label="Explore QCS network command">
        <span>Explore</span>
        <a href="#command-system">Command model</a>
        <a href="#solutions">Solutions</a>
        <a href="#services">Services</a>
        <a href="#tools">Assessment</a>
        <a href="#utilities">Free tools</a>
        <a href="#engage">Engage QCS</a>
      </nav>

      <section className="section intent-section motion-section">
        <IntentRouter />
      </section>

      <EnvatoVisualSystem />

      <section className="section media-section motion-section" id="solutions">
        <div className="section-heading">
          <p className="eyebrow">Solution paths</p>
          <h2>Name the problem. See the evidence. Choose the next move.</h2>
          <p>
            Begin with the pressure your team can see. Each path connects that signal to the proof, owner, and engineering
            action needed to move forward.
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

      <section className="section media-section motion-section" id="services">
        <div className="section-heading">
          <p className="eyebrow">Core services</p>
          <h2>Engineering support organized around the state you need to reach.</h2>
          <p>
            Choose a service when the work is clear. Use an assessment first when the risk, scope, or accountable next
            action is still uncertain.
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

      <section className="section media-section motion-section" id="tools">
        <div className="section-heading">
          <p className="eyebrow">Guided assessment</p>
          <h2>When the issue is unclear, build a decision-ready snapshot first.</h2>
          <p>
            The assessment asks a few practical questions and returns a risk band, evidence checklist, and recommended
            next action.
          </p>
        </div>
        <SectionMotionGraphic variant="assessment" />
        <div className="assessment-preview-panel" aria-label="Network assessment workflow">
          <div className="assessment-preview-intro">
            <p className="eyebrow">Three-step handoff</p>
            <h3>A useful result before the technical call.</h3>
            <Link className="button primary" href="/diagnose">
              Run guided assessment
            </Link>
          </div>
          <ol>
            {assessmentPreview.map((item) => (
              <li key={item.step}>
                <span>{item.step}</span>
                <strong>{item.title}</strong>
                <p>{item.detail}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="section media-section motion-section" id="utilities">
        <div className="section-heading">
          <p className="eyebrow">Free network utilities</p>
          <h2>Get a useful answer now. Preserve the signal for what comes next.</h2>
          <p>Run focused diagnostics or generate a controlled vendor task plan, then carry the result into deeper troubleshooting.</p>
        </div>
        <SectionMotionGraphic variant="utilities" />
        <div className="utility-grid compact">
          {networkUtilityTools.slice(0, 6).map((tool) => {
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
        <div className="section-action-row">
          <Link className="button secondary" href="/network-tools">
            Explore all {networkUtilityTools.length} network tools
          </Link>
        </div>
      </section>

      <section className="section operating-reach-section motion-section" id="process">
        <div className="section-heading">
          <p className="eyebrow">Delivery and coverage</p>
          <h2>Every engagement moves through one controlled path.</h2>
          <p>Observe the real environment, assign ownership, make the change, and verify the result across the vendors you already run.</p>
        </div>
        <div className="operating-reach-layout">
          <div className="process-timeline">
            {deliveryWorkflow.map((step, index) => (
              <article key={step.title}>
                <span>{String(index + 1).padStart(2, "0")}</span>
                <h3>{step.title}</h3>
                <p>{step.description}</p>
              </article>
            ))}
          </div>
          <div className="coverage-command-panel">
            <div className="coverage-visual-grid" aria-label="Network coverage visual signals">
              {coverageVisuals.map((visual) => (
                <span key={visual.label}>
                  <Image src={visual.src} alt="" width={42} height={42} />
                  {visual.label}
                </span>
              ))}
            </div>
            <div className="pill-cloud">
              {vendorCoverage.map((vendor) => <span key={vendor}>{vendor}</span>)}
            </div>
            <div className="pill-cloud muted" aria-label="Industries supported">
              {industryCoverage.map((industry) => <span key={industry}>{industry}</span>)}
            </div>
          </div>
        </div>
      </section>

      <section className="section motion-section">
        <div className="section-heading">
          <p className="eyebrow">Useful resources</p>
          <h2>Use the runbook before the meeting, change, or incident.</h2>
          <p>Bring a sharper question and better evidence to the technical decision in front of you.</p>
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
            <p className="eyebrow">Operational knowledge base</p>
            <h3>Make the next technical conversation sharper.</h3>
            <p>
              Checklists, tool outputs, and assessment notes help teams describe the issue clearly before they ask for
              managed support, security review, cloud guidance, or training.
            </p>
          </div>
        </div>
        <ResourceDownloads />
      </section>

      <section className="section split final-cta-band motion-section" id="engage">
        <div className="section-heading">
          <p className="eyebrow">Request review</p>
          <h2>Bring the symptom. Leave with a defined next step.</h2>
          <p>
            Share the issue, environment, or training goal. The first response will define the evidence to collect and
            the most useful action to take next.
          </p>
        </div>
        <LeadForm interest="Network command assessment" pipeline="Managed Network Services" />
      </section>
    </main>
  );
}
