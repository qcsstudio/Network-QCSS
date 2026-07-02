import type { ReactNode } from "react";
import Link from "next/link";
import Wrapper from "@/layouts/Wrapper";
import HeaderOne from "@/layouts/headers/HeaderOne";
import FooterOne from "@/layouts/footers/FooterOne";
import Testimonial from "@/components/testimonial/Testimonial";
import BlogHomeOne from "@/components/blog/BlogHomeOne";
import FaqAccordion from "@/components/faq/FaqAccordion";
import {
  architecturePillars,
  differentiators,
  faqs,
  freelanceItems,
  heroStats,
  industries,
  managedSupportItems,
  networkServices,
  oldModelItems,
  painCards,
  processSteps,
  qcsModelItems,
  topologyNodes,
  trustBadges,
  useCases,
  vendors,
  whyPrinciples,
} from "@/data/networkSupportPage";

type CardItem = {
  title: string;
  description: string;
};

type SectionShellProps = {
  eyebrow?: string;
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
  headerClassName?: string;
  id?: string;
  effect?: "radar" | "mesh" | "pulse" | "orbit" | "grid" | "wave" | "beam" | "matrix" | "spark" | "halo" | "rings";
};

const pageNavItems = [
  { label: "Services", href: "#network-services" },
  { label: "Support Models", href: "#support-models" },
  { label: "Vendors", href: "#vendors" },
  { label: "Process", href: "#process" },
  { label: "FAQ", href: "#faq" },
] as const;

const heroProofPoints = [
  "SLA triage",
  "Controlled changes",
  "Documented handover",
] as const;

const liveSupportSignals = [
  "SLA clock active",
  "Policies backed up",
  "Change log open",
] as const;

const Spacer = ({ size = "sm" }: { size?: "sm" | "md" | "lg" }) => {
  const spacingClass = {
    sm: "cs_height_80 cs_height_lg_40",
    md: "cs_height_100 cs_height_lg_60",
    lg: "cs_height_150 cs_height_lg_80",
  }[size];

  return <div className={spacingClass} />;
};

const ArrowIcon = () => (
  <svg width="19" height="13" viewBox="0 0 19 13" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <path
      d="M18.5303 7.03033C18.8232 6.73744 18.8232 6.26256 18.5303 5.96967L13.7574 1.1967C13.4645 0.903806 12.9896 0.903806 12.6967 1.1967C12.4038 1.48959 12.4038 1.96447 12.6967 2.25736L16.9393 6.5L12.6967 10.7426C12.4038 11.0355 12.4038 11.5104 12.6967 11.8033C12.9896 12.0962 13.4645 12.0962 13.7574 11.8033L18.5303 7.03033ZM0 7.25H18V5.75H0V7.25Z"
      fill="currentColor"
    />
  </svg>
);

const SectionShell = ({
  eyebrow,
  title,
  description,
  children,
  className = "",
  headerClassName = "",
  id,
  effect = "mesh",
}: SectionShellProps) => (
  <section
    id={id}
    className={`network-support-section network-support-section--effect-${effect} cs_card cs_style_1 anim_div_ShowDowns ${className}`.trim()}
  >
    <div className={`network-support-section__header cs_section_heading cs_style_1 ${headerClassName}`.trim()}>
      <div className="cs_section_heading_text">
        {eyebrow ? <p className="network-support-eyebrow cs_section_subtitle anim_div_ShowZoom">{eyebrow}</p> : null}
        <h2 className="network-support-section__title cs_section_title anim_heading_title">{title}</h2>
        {description ? <p className="network-support-section__description anim_text">{description}</p> : null}
      </div>
    </div>
    {children}
  </section>
);

const CheckList = ({ items, muted = false }: { items: readonly string[]; muted?: boolean }) => (
  <ul className={`network-support-checklist ${muted ? "network-support-checklist--muted" : ""}`.trim()}>
    {items.map((item) => (
      <li key={item}>
        <span aria-hidden="true">✓</span>
        <strong>{item}</strong>
      </li>
    ))}
  </ul>
);

const InsightGrid = ({
  items,
  columns = "network-support-grid--3",
  tone = "light",
}: {
  items: readonly CardItem[];
  columns?: string;
  tone?: "light" | "warning";
}) => (
  <div className={`network-support-grid ${columns}`.trim()}>
    {items.map((item, index) => (
      <article key={item.title} className={`network-support-card network-support-card--${tone} anim_div_ShowDowns`}>
        <span className="network-support-card__index">{String(index + 1).padStart(2, "0")}</span>
        <h3>{item.title}</h3>
        <p>{item.description}</p>
      </article>
    ))}
  </div>
);

const PageNav = () => (
  <nav className="network-support-nav anim_div_ShowDowns" aria-label="Network support page sections">
    {pageNavItems.map((item) => (
      <a key={item.href} href={item.href}>
        {item.label}
      </a>
    ))}
  </nav>
);

const HeroTopology = () => (
  <div className="network-support-topology anim_div_ShowDowns" aria-label="Network layers covered by QCS support">
    <div className="network-support-topology__header">
      <div>
        <span>Live support model</span>
        <h2>Diagnose → Stabilise → Secure</h2>
      </div>
      <span className="network-support-topology__pulse" aria-hidden="true" />
    </div>
    <div className="network-support-topology__map">
      <span className="network-support-topology__ring network-support-topology__ring--outer" aria-hidden="true" />
      <span className="network-support-topology__ring network-support-topology__ring--inner" aria-hidden="true" />
      <span className="network-support-topology__packet network-support-topology__packet--one" aria-hidden="true" />
      <span className="network-support-topology__packet network-support-topology__packet--two" aria-hidden="true" />
      <span className="network-support-topology__packet network-support-topology__packet--three" aria-hidden="true" />
      {topologyNodes.map((node, index) => (
        <span
          key={node.label}
          className={`network-support-topology__node network-support-topology__node--${node.modifier} anim_div_ShowZoom`}
        >
          <small>{String(index + 1).padStart(2, "0")}</small>
          {node.label}
        </span>
      ))}
    </div>
    <div className="network-support-topology__signal" aria-hidden="true">
      <span />
      <span />
      <span />
    </div>
    <ul className="network-support-topology__status" aria-label="Live support activity">
      {liveSupportSignals.map((signal) => (
        <li key={signal}>{signal}</li>
      ))}
    </ul>
    <div className="network-support-topology__badges">
      {trustBadges.map((badge) => (
        <span key={badge}>{badge}</span>
      ))}
    </div>
  </div>
);

const HeroSection = () => (
  <section className="network-support-hero anim_div_ShowDowns" aria-labelledby="network-support-hero-title">
    <div className="network-support-hero__content">
      <p className="network-support-eyebrow cs_section_subtitle anim_div_ShowZoom">Network Infrastructure Support</p>
      <h1 id="network-support-hero-title" className="anim_heading_title">24x7 Network Support for Secure, Always-On Operations</h1>
      <p className="network-support-hero__lead">
        Keep users, branches, apps, cloud workloads, and customers connected with SLA-led engineering support.
      </p>
      <p>
        QCS stabilises firewalls, routers, switches, SD-WAN, VPN, Wi-Fi, and cloud networks for urgent fixes or ongoing managed operations.
      </p>
      <div className="network-support-hero__proof" aria-label="Network support delivery standards">
        {heroProofPoints.map((point) => (
          <span key={point}>{point}</span>
        ))}
      </div>
      <div className="network-support-hero__actions">
        <Link href="/contact" className="cs_btn cs_style_1">
          <span>Get Network Support</span>
          <ArrowIcon />
        </Link>
        <Link href="/contact?intent=network-support" className="network-support-link-button">
          Talk to a Network Engineer
        </Link>
      </div>
      <div className="network-support-hero__stats anim_div_ShowDowns" aria-label="Network support highlights">
        {heroStats.map((stat) => (
          <div key={stat.label}>
            <strong>{stat.value}</strong>
            <span>{stat.label}</span>
          </div>
        ))}
      </div>
    </div>
    <HeroTopology />
  </section>
);

const ComparisonSection = () => (
  <SectionShell
    eyebrow="Support model"
    title="The Old Support Model Is Not Built for Modern Infrastructure"
    description="Modern environments need documented ownership, controlled changes, and a support path that connects firewall, VPN, SD-WAN, cloud, and LAN operations."
    className="network-support-section--comparison"
    id="support-models"
    effect="orbit"
  >
    <div className="network-support-comparison">
      <article className="network-support-comparison__panel network-support-comparison__panel--old anim_div_ShowLeftSide">
        <span>Reactive</span>
        <h3>Old model</h3>
        <CheckList items={oldModelItems} muted />
      </article>
      <article className="network-support-comparison__panel network-support-comparison__panel--new anim_div_ShowRightSide">
        <span>Governed</span>
        <h3>QCS model</h3>
        <CheckList items={qcsModelItems} />
      </article>
    </div>
  </SectionShell>
);

const ServicesSection = () => (
  <SectionShell
    eyebrow="Our network support services"
    title="Complete Network Configuration, Troubleshooting & Managed Support"
    description="We support businesses across the full network lifecycle: installation, configuration, migration, optimisation, troubleshooting, documentation, and continuous support."
    id="network-services"
    effect="grid"
  >
    <div className="network-support-services-grid">
      {networkServices.map((service, index) => (
        <article key={service.title} className="network-support-service-card anim_div_ShowDowns">
          <div className="network-support-service-card__header">
            <span>{String(index + 1).padStart(2, "0")}</span>
            <h3>{service.title}</h3>
          </div>
          <p>{service.description}</p>
          <CheckList items={service.bullets} />
        </article>
      ))}
    </div>
  </SectionShell>
);

const EngagementSection = () => (
  <SectionShell
    eyebrow="Engagement options"
    effect="mesh"
    title="Use QCS for a One-Time Network Task or Continuous SLA Support"
    description="Choose the support format that fits the urgency and ownership model of your infrastructure."
  >
    <div className="network-support-engagement">
      <article className="anim_div_ShowLeftSide">
        <span>Project / freelance</span>
        <h3>Need a Freelance Network Engineer for a Specific Task?</h3>
        <CheckList items={freelanceItems} />
      </article>
      <article className="anim_div_ShowRightSide">
        <span>Managed operations</span>
        <h3>24x7 Network Support for Critical Business Infrastructure</h3>
        <CheckList items={managedSupportItems} />
      </article>
    </div>
  </SectionShell>
);

const VendorSection = () => (
  <SectionShell
    eyebrow="Multi-vendor coverage"
    title="Support Across Leading Network & Security Vendors"
    description="QCS can coordinate troubleshooting and configuration across the platforms commonly found in multi-branch and cloud-connected businesses."
    id="vendors"
    effect="spark"
  >
    <div className="network-support-pill-cloud">
      {vendors.map((vendor) => (
        <span key={vendor} className="anim_div_ShowZoom">{vendor}</span>
      ))}
    </div>
  </SectionShell>
);

const ProcessSection = () => (
  <SectionShell
    eyebrow="Delivery workflow"
    title="Diagnose. Stabilise. Secure. Support."
    description="Every support request follows a clear operating rhythm so fixes are controlled, validated, and documented."
    id="process"
    effect="wave"
  >
    <div className="network-support-timeline">
      {processSteps.map((step, index) => (
        <article key={step.title} className="anim_div_ShowDowns">
          <span>{String(index + 1).padStart(2, "0")}</span>
          <h3>{step.title}</h3>
          <p>{step.description}</p>
        </article>
      ))}
    </div>
  </SectionShell>
);

const WhySection = () => (
  <SectionShell
    eyebrow="Why QCS"
    title="Engineering Discipline for Your Network Operations"
    description="Practical troubleshooting, clear handover, and support for urgent incidents and planned projects."
    className="network-support-section--dark"
    effect="halo"
  >
    <div className="network-support-why">
      <div>
        <h3>What you get</h3>
        <CheckList items={differentiators} />
      </div>
      <div className="network-support-why__principles">
        {whyPrinciples.map((principle, index) => (
          <article key={principle.title} className="anim_div_ShowDowns">
            <span>{String(index + 1).padStart(2, "0")}</span>
            <h3>{principle.title}</h3>
            <p>{principle.description}</p>
          </article>
        ))}
      </div>
    </div>
  </SectionShell>
);

const CtaSection = () => (
  <section className="network-support-cta anim_div_ShowDowns">
    <p className="network-support-eyebrow">Ready for stable operations?</p>
    <h2>Need Reliable Network Support Today?</h2>
    <p>
      Need a freelance network engineer, firewall specialist, FortiGate or Cisco support, SD-WAN troubleshooting,
      cloud networking assistance, or 24x7 managed support? QCS can help.
    </p>
    <div className="network-support-hero__actions network-support-cta__actions">
      <Link href="/contact?intent=network-support" className="cs_btn cs_style_1">
        <span>Talk to a Network Engineer</span>
        <ArrowIcon />
      </Link>
      <Link href="/contact?intent=remote-troubleshooting" className="network-support-link-button">
        Request Remote Troubleshooting
      </Link>
    </div>
  </section>
);

export default function NetworkSupportServicesPage({ children }: { children?: ReactNode }) {
  return (
    <Wrapper>
      <HeaderOne />
      <div id="smooth-wrapper">
        <div id="smooth-content">
          <main className="network-support-page">
            {children}
            <Spacer size="lg" />
            <div className="container">
              <HeroSection />
              <PageNav />

              <Spacer />

              <SectionShell
                eyebrow="Reliable infrastructure for predictable operations"
                effect="radar"
                title="A Governed Network Support System, Not Just Break-Fix Assistance"
                description="QCS brings a structured model to your network. We diagnose the issue, stabilise service, harden the configuration, document the change, and support the environment through SLA-led operations."
              >
                <InsightGrid items={architecturePillars} />
              </SectionShell>

              <Spacer />

              <SectionShell effect="pulse" title="Your Network Should Not Become a Business Risk" headerClassName="network-support-section__header--compact">
                <InsightGrid items={painCards} tone="warning" />
              </SectionShell>

              <Spacer />

              <ComparisonSection />

              <Spacer size="md" />

              <ServicesSection />

              <Spacer />

              <EngagementSection />

              <Spacer />

              <VendorSection />

              <Spacer />

              <SectionShell effect="beam" title="Network Support for Real Business Scenarios" headerClassName="network-support-section__header--compact">
                <InsightGrid items={useCases} columns="network-support-grid--3" />
              </SectionShell>

              <Spacer />

              <SectionShell effect="matrix" title="Network Support for Offices, Branches, Plants & Cloud-First Teams" headerClassName="network-support-section__header--compact">
                <div className="network-support-pill-cloud network-support-pill-cloud--muted">
                  {industries.map((industry) => (
                    <span key={industry} className="anim_div_ShowZoom">{industry}</span>
                  ))}
                </div>
              </SectionShell>

              <Spacer />

              <ProcessSection />

              <Spacer />

              <WhySection />

              <Spacer />

              <SectionShell id="faq"
                effect="rings"
                title="Frequently Asked Questions" headerClassName="network-support-section__header--compact">
                <FaqAccordion faqs={faqs} />
              </SectionShell>

              <Spacer />

              <CtaSection />
            </div>

            <Spacer />
            <Testimonial />
            <BlogHomeOne />
            <Spacer />
          </main>
          <FooterOne />
        </div>
      </div>
    </Wrapper>
  );
}
