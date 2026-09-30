import type { ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowDown,
  ArrowRight,
  ArrowUpRight,
  BadgeCheck,
  BookOpenText,
  Building2,
  Check,
  CheckCheck,
  ClipboardCheck,
  Cloud,
  Database,
  FileCheck2,
  FileKey2,
  FileSearch,
  Focus,
  GitPullRequest,
  Globe,
  Handshake,
  Laptop,
  ListChecks,
  MessagesSquare,
  Milestone,
  Monitor,
  Network,
  Pause,
  Play,
  Plus,
  Radar,
  RefreshCw,
  RotateCcw,
  Route,
  Router,
  ScanLine,
  ScanSearch,
  SearchCheck,
  Server,
  ShieldCheck,
  Terminal,
  Users,
  Waypoints,
  Workflow,
  Wrench,
} from "lucide-react";
import { LeadForm } from "@/components/lead-form";
import { HomeEnhancements } from "./home-enhancements";

export function HomeContent({ children }: { children: ReactNode }) {
  return (
    <main className="consulting-home" id="consulting-home">
      <HomeEnhancements />
      <span id="command-system" className="anchor-alias"></span>
      <section className="hero" aria-labelledby="hero-title">
        <div className="hero-copy">
          <p className="eyebrow">
            <span className="status-dot"></span>QCS / Connected thinking.
            Practical engineering.
          </p>
          <h1 id="hero-title">
            Network,
            <br />
            security &amp; cloud
            <br />
            <span>consulting.</span>
          </h1>
          <p className="intro">
            Complex systems.
            <br /> Clear next steps.
          </p>
          <p className="hero-description">
            Find the fault. Understand the risk. Build a better path across your
            connected business.
          </p>
          <div className="hero-actions">
            <a className="button primary" href="#contact">
              Discuss your project <ArrowUpRight aria-hidden="true" />
            </a>
            <a className="text-link" href="#services">
              Explore expertise <ArrowDown aria-hidden="true" />
            </a>
          </div>
          <p className="market">For businesses in India and internationally.</p>
        </div>
        <div
          className="hero-scene"
          id="hero-scene"
          role="img"
          aria-label="Illustrative network: a branch connects to a central network core, a security boundary and cloud workloads."
        >
          <Image
            className="scene-fallback"
            src="/brand/consulting/network-architecture-v2.webp"
            alt="Branch, network equipment and server workloads connected in an illustrative architecture."
            width={1774}
            height={887}
            priority
            sizes="(max-width: 999px) 100vw, 65vw"
          />
          <div className="scene-labels" aria-hidden="true"></div>
        </div>
        <div className="scene-toolbar">
          <span>Illustrative architecture</span>
          <button
            className="icon-button"
            id="reset-view"
            title="Reset view"
            aria-label="Reset network view"
          >
            <RotateCcw aria-hidden="true" />
          </button>
          <button
            className="icon-button"
            id="motion-toggle"
            data-motion
            title="Pause animation"
            aria-label="Pause animation"
            aria-pressed="false"
          >
            <Pause aria-hidden="true" />
          </button>
        </div>
        <div className="hero-bottom">
          <span className="micro">ONE CONNECTED ENVIRONMENT</span>
          <div
            className="lens-switch"
            role="group"
            aria-label="Architecture focus"
          >
            <button data-focus="network" aria-pressed="true">
              <span>01</span> Network
            </button>
            <button data-focus="security" aria-pressed="false">
              <span>02</span> Security
            </button>
            <button data-focus="cloud" aria-pressed="false">
              <span>03</span> Cloud
            </button>
          </div>
          <a
            href="#services"
            className="round-link"
            title="Explore services"
            aria-label="Explore services"
          >
            <ArrowDown aria-hidden="true" />
          </a>
        </div>
      </section>
      <div className="context-strip">
        <p>Engineering the whole picture.</p>
        <span>
          <Network aria-hidden="true" /> On-premises
        </span>
        <span>
          <ShieldCheck aria-hidden="true" /> Security boundaries
        </span>
        <span>
          <Cloud aria-hidden="true" /> Hybrid cloud
        </span>
        <span>
          <Workflow aria-hidden="true" /> Operational evidence
        </span>
      </div>

      <nav className="chapter-nav" aria-label="Explore this page">
        <span className="chapter-brand">QCS / EXPERTISE</span>
        <a href="#services" aria-current="location">
          Services
        </a>
        <a href="#approach">Approach</a>
        <a href="#deliverables">Deliverables</a>
        <a href="#learning">Learning</a>
        <a href="#tools">Tools</a>
        <button
          className="motion-dock"
          data-motion
          aria-label="Pause all animations"
          aria-pressed="false"
          title="Pause all animations"
        >
          <Pause aria-hidden="true" />
          <span>Motion</span>
        </button>
      </nav>
      <section
        className="section expertise"
        id="services"
        aria-labelledby="services-title"
      >
        <div className="section-heading">
          <p className="eyebrow">01 / Specialist expertise</p>
          <h2 id="services-title">
            Specialist help.
            <br />
            <span>One connected view.</span>
          </h2>
          <p>
            Tell us what is not working.
            <br />
            We’ll help you find the next step.
          </p>
        </div>
        <div className="expertise-layout">
          <div
            className="service-tabs"
            role="tablist"
            aria-label="Consulting services"
            aria-orientation="vertical"
          >
            <button
              role="tab"
              id="tab-network"
              aria-controls="service-panel"
              aria-selected="true"
              data-service="network"
            >
              <span className="service-number">01</span>
              <span>
                <strong>Network engineering</strong>
                <small>Reliable paths. Better operations.</small>
              </span>
              <ArrowUpRight aria-hidden="true" />
            </button>
            <button
              role="tab"
              id="tab-security"
              aria-controls="service-panel"
              aria-selected="false"
              tabIndex={-1}
              data-service="security"
            >
              <span className="service-number">02</span>
              <span>
                <strong>Security &amp; testing</strong>
                <small>Understand exposure. Verify fixes.</small>
              </span>
              <ArrowUpRight aria-hidden="true" />
            </button>
            <button
              role="tab"
              id="tab-cloud"
              aria-controls="service-panel"
              aria-selected="false"
              tabIndex={-1}
              data-service="cloud"
            >
              <span className="service-number">03</span>
              <span>
                <strong>Cloud connectivity</strong>
                <small>Connect environments with clarity.</small>
              </span>
              <ArrowUpRight aria-hidden="true" />
            </button>
            {/* The two progressively enhanced service links use native navigation because their targets change without a React render. */}
          </div>
          <div
            id="service-panel"
            role="tabpanel"
            aria-labelledby="tab-network"
            tabIndex={0}
          >
            <div className="service-description">
              <p className="eyebrow" id="service-kicker">
                CONNECT / OPERATE / TROUBLESHOOT
              </p>
              <h3 id="service-title">Find where the path breaks.</h3>
              <p id="service-copy">
                Slow apps? Dropped calls? Unstable links? We trace the fault,
                check the evidence and agree what to fix. For ongoing support,
                we define the work and who owns each task.
              </p>
              {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
              <a
                id="service-link"
                className="text-link"
                href="/services/managed-network-services"
              >
                Explore network services <ArrowUpRight aria-hidden="true" />
              </a>
              {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
              <a
                id="service-secondary"
                href="/services/network-troubleshooting"
              >
                Need troubleshooting?
              </a>
            </div>
            <div className="service-visual">
              <div
                id="service-scene"
                className="service-scene"
                role="img"
                aria-label="An illustrative branch connects to the network core along the highlighted path."
              >
                <Image
                  className="scene-fallback"
                  src="/brand/consulting/operations-artwork.webp"
                  alt="Illustrative network operations environment"
                  width={1536}
                  height={1024}
                  sizes="(max-width: 699px) 100vw, 55vw"
                />
                <div className="scene-labels" aria-hidden="true"></div>
              </div>
              <div className="packet-explainer" data-mode="network">
                <strong id="packet-title">Network / packet forwarding</strong>
                <div className="packet-stages" hidden>
                  <span data-tunnel-stage="encapsulate">01 / Encapsulate</span>
                  <span data-tunnel-stage="protected">02 / ESP protected</span>
                  <span data-tunnel-stage="decapsulate">03 / Decapsulate</span>
                </div>
                <p id="packet-note">
                  Packets follow the highlighted route from the branch to the
                  network core. Illustrative traffic, not live telemetry.
                </p>
              </div>
            </div>
          </div>
        </div>
        <nav
          className="service-directory"
          aria-label="Specialist service directory"
        >
          <Link href="/services/network-security-services">
            Network security
          </Link>
          <Link href="/services/penetration-testing">Penetration testing</Link>
          <Link href="/services/cloud-network-services">Cloud networking</Link>
          <Link href="/services/firewall-management">Firewall management</Link>
          <Link href="/services/noc-as-a-service">NOC support</Link>
          <Link href="/services/managed-wifi-lan">Wi-Fi and LAN</Link>
        </nav>
      </section>

      <span id="solutions" className="anchor-alias"></span>
      <section
        className="situations motion-surface"
        id="situations"
        aria-labelledby="situations-title"
      >
        <div className="section">
          <div className="section-heading">
            <p className="eyebrow">Your environment / Your priorities</p>
            <h2 id="situations-title">
              Start with the pressure
              <br />
              your team is under.
            </h2>
            <p>
              A clear problem is the start of a useful engagement. Here are
              three ways to begin.
            </p>
          </div>
          <div className="situation-grid">
            <article>
              <div className="signal-path" aria-hidden="true">
                <Building2 aria-hidden="true" />
                <span className="signal-track"></span>
                <Network aria-hidden="true" />
                <span className="signal-track"></span>
                <Monitor aria-hidden="true" />
              </div>
              <p className="micro">01 / SERVICE DISRUPTION</p>
              <h3>
                It connects.
                <br />
                Until it doesn&apos;t.
              </h3>
              <p>
                Slow applications, lost calls or unstable site links. Trace the
                affected path and separate symptoms from causes.
              </p>
              <dl>
                <dt>Bring</dt>
                <dd>A timeline, affected sites and recent changes.</dd>
                <dt>Work toward</dt>
                <dd>A tested fault hypothesis and next actions.</dd>
              </dl>
              <Link
                className="text-link"
                href="/services/network-troubleshooting"
              >
                Investigate a fault <ArrowUpRight aria-hidden="true" />
              </Link>
            </article>
            <article>
              <div className="signal-path" aria-hidden="true">
                <Users aria-hidden="true" />
                <span className="signal-track"></span>
                <ShieldCheck aria-hidden="true" />
                <span className="signal-track"></span>
                <Server aria-hidden="true" />
              </div>
              <p className="micro">02 / SECURITY EXPOSURE</p>
              <h3>
                Who can reach
                <br />
                what matters?
              </h3>
              <p>
                Review access paths, firewall rules and test scope. Understand
                which exposure needs action and why.
              </p>
              <dl>
                <dt>Bring</dt>
                <dd>An asset list and the owners who can authorize testing.</dd>
                <dt>Work toward</dt>
                <dd>Evidence-backed priorities and a retest plan.</dd>
              </dl>
              <Link className="text-link" href="/services/penetration-testing">
                Scope a security test <ArrowUpRight aria-hidden="true" />
              </Link>
            </article>
            <article>
              <div className="signal-path" aria-hidden="true">
                <Database aria-hidden="true" />
                <span className="signal-track"></span>
                <Route aria-hidden="true" />
                <span className="signal-track"></span>
                <Cloud aria-hidden="true" />
              </div>
              <p className="micro">03 / INFRASTRUCTURE CHANGE</p>
              <h3>
                Move forward.
                <br />
                Keep the path clear.
              </h3>
              <p>
                A new site, a cloud move or a network redesign. Map dependencies
                before they become change-day surprises.
              </p>
              <dl>
                <dt>Bring</dt>
                <dd>The proposed design, applications and change window.</dd>
                <dt>Work toward</dt>
                <dd>Acceptance checks and a rollback plan.</dd>
              </dl>
              <Link
                className="text-link"
                href="/services/cloud-network-services"
              >
                Plan cloud connectivity <ArrowUpRight aria-hidden="true" />
              </Link>
            </article>
          </div>
          <p className="scope-note">
            Typical engagement scenarios, not client case studies. Deliverables
            depend on the agreed scope.
          </p>
        </div>
      </section>

      <span id="process" className="anchor-alias"></span>
      <section
        className="approach motion-surface"
        id="approach"
        aria-labelledby="approach-title"
      >
        <div className="section">
          <div className="section-heading">
            <p className="eyebrow">02 / The engineering approach</p>
            <h2 id="approach-title">
              From uncertainty
              <br />
              to an agreed plan.
            </h2>
            <p>
              Evidence comes before action.
              <br />
              Verification comes after it.
            </p>
          </div>
          <div
            className="object-scene method-scene"
            id="method-scene"
            data-kind="method"
            role="img"
            aria-label="Three connected engineering stages: map the environment, inspect evidence and verify the result."
          >
            <div className="scene-labels" aria-hidden="true"></div>
          </div>
          <div className="method-grid">
            <article>
              <div className="method-graphic map-graphic" aria-hidden="true">
                <span>
                  <Laptop aria-hidden="true" />
                </span>
                <b></b>
                <span>
                  <Network aria-hidden="true" />
                </span>
                <b></b>
                <span>
                  <Cloud aria-hidden="true" />
                </span>
              </div>
              <span className="micro">01 / DISCOVER</span>
              <h3>
                <button
                  className="method-select"
                  data-method="0"
                  aria-controls="method-scene"
                  aria-pressed="false"
                >
                  See the environment.
                  <ArrowUpRight aria-hidden="true" />
                </button>
              </h3>
              <p>
                Map the affected systems, business impact and boundaries of the
                work.
              </p>
              <span className="method-output">
                Outcome <strong>Agreed scope</strong>
              </span>
            </article>
            <article>
              <div
                className="method-graphic inspect-graphic"
                aria-hidden="true"
              >
                <ScanLine aria-hidden="true" />
                <div>
                  <span></span>
                  <span></span>
                  <span></span>
                </div>
                <FileSearch aria-hidden="true" />
              </div>
              <span className="micro">02 / INVESTIGATE</span>
              <h3>
                <button
                  className="method-select"
                  data-method="1"
                  aria-controls="method-scene"
                  aria-pressed="false"
                >
                  Follow the evidence.
                  <ArrowUpRight aria-hidden="true" />
                </button>
              </h3>
              <p>
                Review configuration, logs and observations. Test a hypothesis,
                not an assumption.
              </p>
              <span className="method-output">
                Outcome <strong>Prioritized findings</strong>
              </span>
            </article>
            <article>
              <div className="method-graphic verify-graphic" aria-hidden="true">
                <span>
                  <GitPullRequest aria-hidden="true" />
                </span>
                <b></b>
                <span>
                  <CheckCheck aria-hidden="true" />
                </span>
              </div>
              <span className="micro">03 / VERIFY</span>
              <h3>
                <button
                  className="method-select"
                  data-method="2"
                  aria-controls="method-scene"
                  aria-pressed="false"
                >
                  Close the loop.
                  <ArrowUpRight aria-hidden="true" />
                </button>
              </h3>
              <p>
                Agree changes, identify owners and check the result against the
                expected behavior.
              </p>
              <span className="method-output">
                Outcome <strong>Clear next actions</strong>
              </span>
            </article>
          </div>
        </div>
      </section>

      <section
        className="section evidence"
        id="deliverables"
        aria-labelledby="evidence-title"
      >
        <div>
          <p className="eyebrow">03 / Work you can use</p>
          <h2 id="evidence-title">
            Not just a report.
            <br />
            <span>A way forward.</span>
          </h2>
          <p className="section-copy">
            Know what was reviewed, why each finding matters and what needs to
            happen next.
          </p>
          <ul className="evidence-list">
            <li>
              <button
                className="evidence-select"
                data-evidence="0"
                aria-controls="evidence-scene"
                aria-pressed="false"
              >
                <Route aria-hidden="true" />
                <span>
                  <strong>Context, not isolated alerts</strong>Findings linked
                  to your network and business impact.
                </span>
              </button>
            </li>
            <li>
              <button
                className="evidence-select"
                data-evidence="1"
                aria-controls="evidence-scene"
                aria-pressed="false"
              >
                <ListChecks aria-hidden="true" />
                <span>
                  <strong>Practical priorities</strong>Recommended actions,
                  dependencies and owners.
                </span>
              </button>
            </li>
            <li>
              <button
                className="evidence-select"
                data-evidence="2"
                aria-controls="evidence-scene"
                aria-pressed="false"
              >
                <ClipboardCheck aria-hidden="true" />
                <span>
                  <strong>A defined verification plan</strong>What to check,
                  what good looks like and what remains open.
                </span>
              </button>
            </li>
          </ul>
          <a className="text-link" href="#contact">
            Discuss the deliverables <ArrowUpRight aria-hidden="true" />
          </a>
        </div>
        <div className="evidence-visual">
          <div
            className="object-scene evidence-scene"
            id="evidence-scene"
            data-kind="evidence"
            role="img"
            aria-label="An illustrative evidence file, prioritized actions and a verification seal arranged as three distinct deliverables."
          >
            <div className="scene-labels" aria-hidden="true"></div>
          </div>
          <div
            className="evidence-specimen"
            aria-label="Illustrative assessment deliverable"
          >
            <div className="specimen-head">
              <span className="wordmark">
                QCS<span> / ENGINEERING BRIEF</span>
              </span>
              <FileCheck2 aria-hidden="true" />
            </div>
            <div className="specimen-title">
              <span className="micro">ILLUSTRATIVE EXAMPLE</span>
              <h3>Network access review</h3>
              <p>From observation to verification.</p>
            </div>
            <dl>
              <div>
                <dt>Observation</dt>
                <dd>Access rules need an ownership review.</dd>
              </div>
              <div>
                <dt>Recommendation</dt>
                <dd>Validate business need before changing access.</dd>
              </div>
              <div>
                <dt>Verification</dt>
                <dd>Retest approved and denied application paths.</dd>
              </div>
            </dl>
            <div className="specimen-foot">
              <Check aria-hidden="true" /> Scope, evidence and responsibility in
              one view.
            </div>
          </div>
        </div>
      </section>

      <section
        className="section engagements"
        id="engagements"
        aria-labelledby="engagements-title"
      >
        <div className="section-heading">
          <p className="eyebrow">A practical way to work together</p>
          <h2 id="engagements-title">
            The right depth.
            <br />
            For the work ahead.
          </h2>
          <p>
            Begin with one question or scope a larger project. Agree the work
            before committing to it.
          </p>
        </div>
        <div className="engagement-grid">
          <article>
            <ScanSearch aria-hidden="true" />
            <p className="micro">ASSESS</p>
            <h3>Get a clear starting point.</h3>
            <p>For an unclear fault, design concern or security question.</p>
            <ul>
              <li>Focused discovery and evidence review</li>
              <li>Prioritized findings and options</li>
              <li>A defined next step</li>
            </ul>
            <a className="text-link" href="#contact">
              Discuss an assessment <ArrowUpRight aria-hidden="true" />
            </a>
          </article>
          <article>
            <Milestone aria-hidden="true" />
            <p className="micro">DELIVER</p>
            <h3>Move a defined project forward.</h3>
            <p>
              For a network change, cloud connection or authorized security
              test.
            </p>
            <ul>
              <li>Scope, exclusions and milestones</li>
              <li>Change ownership and acceptance checks</li>
              <li>Documented handover</li>
            </ul>
            <a className="text-link" href="#contact">
              Scope your project <ArrowUpRight aria-hidden="true" />
            </a>
          </article>
          <article>
            <RefreshCw aria-hidden="true" />
            <p className="micro">SUPPORT</p>
            <h3>Keep ownership clear.</h3>
            <p>For teams that need recurring network operations support.</p>
            <ul>
              <li>Defined systems and responsibilities</li>
              <li>Agreed review and escalation process</li>
              <li>Support hours set in the agreement</li>
            </ul>
            <Link
              className="text-link"
              href="/services/managed-network-services"
            >
              Explore ongoing support <ArrowUpRight aria-hidden="true" />
            </Link>
          </article>
        </div>
        <p className="scope-note">
          Availability, fees, response times and any service-level commitments
          are agreed in writing. No automatic 24/7 coverage is implied.
        </p>
      </section>

      <section
        className="guardrails motion-surface"
        id="guardrails"
        aria-labelledby="guardrails-title"
      >
        <div className="section guardrails-inner">
          <div>
            <p className="eyebrow">Control belongs in the process</p>
            <h2 id="guardrails-title">
              Clear boundaries.
              <br />
              Before the first change.
            </h2>
            <p className="section-copy">
              A useful engagement protects more than the technology. It makes
              access, decisions and responsibility explicit.
            </p>
            <div
              className="approval-route"
              aria-label="Delivery sequence: authorize, review, agree, verify"
            >
              <span>
                <FileKey2 aria-hidden="true" />
                Authorize
              </span>
              <ArrowRight aria-hidden="true" />
              <span>
                <SearchCheck aria-hidden="true" />
                Review
              </span>
              <ArrowRight aria-hidden="true" />
              <span>
                <Handshake aria-hidden="true" />
                Agree
              </span>
              <ArrowRight aria-hidden="true" />
              <span>
                <BadgeCheck aria-hidden="true" />
                Verify
              </span>
            </div>
          </div>
          <ol className="guardrail-list">
            <li>
              <span>01</span>
              <div>
                <h3>Permission before testing</h3>
                <p>
                  Define authorized assets, methods, exclusions and stop
                  conditions before any security test.
                </p>
              </div>
            </li>
            <li>
              <span>02</span>
              <div>
                <h3>Access with a purpose</h3>
                <p>
                  Agree the minimum access required, who grants it and how it
                  will be removed when work ends.
                </p>
              </div>
            </li>
            <li>
              <span>03</span>
              <div>
                <h3>Changes with a way back</h3>
                <p>
                  Confirm the approver, window, baseline and rollback steps
                  before touching production.
                </p>
              </div>
            </li>
            <li>
              <span>04</span>
              <div>
                <h3>Evidence handled deliberately</h3>
                <p>
                  Agree secure transfer, redaction, retention and deletion
                  requirements for logs and reports.
                </p>
              </div>
            </li>
          </ol>
        </div>
      </section>

      <section
        className="learning motion-surface"
        id="learning"
        aria-labelledby="learning-title"
      >
        <div className="section learning-inner">
          <div>
            <p className="eyebrow">04 / Learn with QCS</p>
            <h2 id="learning-title">
              Understand the idea.
              <br />
              Then make it work.
            </h2>
            <p>
              Beginner-friendly CCNA learning, practical examples and guided
              labs. Build understanding one connection at a time.
            </p>
            <Link className="button dark" href="/courses/ccna">
              Explore the CCNA course <ArrowUpRight aria-hidden="true" />
            </Link>
            <p className="learning-note">
              Clear explanations. Practice questions. Lab guides.
            </p>
            <Link className="text-link" href="/institute">
              Explore training for your team <ArrowUpRight aria-hidden="true" />
            </Link>
          </div>
          <div className="learning-lab">
            <div className="lab-head">
              <span className="micro">A PACKET’S JOURNEY</span>
              <button
                className="icon-button"
                id="lab-motion"
                aria-label="Pause packet animation"
                title="Pause packet animation"
                aria-pressed="false"
              >
                <Pause aria-hidden="true" />
              </button>
              <button
                className="icon-button"
                id="run-packet"
                aria-label="Replay packet journey"
                title="Replay packet journey"
              >
                <Play aria-hidden="true" />
              </button>
            </div>
            <div
              className="object-scene lab-scene"
              id="lab-scene"
              data-kind="lab"
              role="img"
              aria-label="PC1 connects through Switch and Router to PC2. A packet travels to PC2, and a reply follows the reverse path to PC1."
            >
              <div className="scene-labels" aria-hidden="true"></div>
            </div>
            <div className="lab-path" aria-hidden="true">
              <div>
                <Monitor aria-hidden="true" />
                <strong>PC1</strong>
              </div>
              <b>
                <span></span>
              </b>
              <div>
                <Network aria-hidden="true" />
                <strong>Switch</strong>
              </div>
              <b>
                <span></span>
              </b>
              <div>
                <Router aria-hidden="true" />
                <strong>Router</strong>
              </div>
              <b>
                <span></span>
              </b>
              <div>
                <Monitor aria-hidden="true" />
                <strong>PC2</strong>
              </div>
            </div>
            <div className="lab-caption">
              <span id="lab-step">01 / SEND</span>
              <p id="lab-message">
                PC1 sends a packet toward PC2 on another network.
              </p>
            </div>
            <p className="lab-disclaimer">
              Conceptual path. Address resolution and other protocol details are
              omitted.
            </p>
          </div>
        </div>
      </section>

      <span id="utilities" className="anchor-alias"></span>
      <section
        className="section tools"
        id="tools"
        aria-labelledby="tools-title"
      >
        <div className="tools-intro">
          <p className="eyebrow">05 / Useful before the call</p>
          <h2 id="tools-title">
            Small tools.
            <br />
            Useful answers.
          </h2>
          <div
            className="object-scene tools-scene"
            id="tools-scene"
            data-kind="tools"
            role="img"
            aria-label="A command terminal, connected network ports and a structured diagnostic checklist."
          >
            <div className="scene-labels" aria-hidden="true"></div>
          </div>
        </div>
        <div className="tool-links">
          <Link href="/network-tools/vendor-task-script-generator">
            <Terminal aria-hidden="true" />
            <span>
              <strong>Vendor task scripts</strong>
              <small>Plan commands and cleanup steps.</small>
            </span>
            <ArrowUpRight aria-hidden="true" />
          </Link>
          <Link href="/network-tools/dns-propagation-checker">
            <Globe aria-hidden="true" />
            <span>
              <strong>DNS propagation</strong>
              <small>Check where a domain points.</small>
            </span>
            <ArrowUpRight aria-hidden="true" />
          </Link>
          <Link href="/network-tools">
            <Wrench aria-hidden="true" />
            <span>
              <strong>Explore the toolbox</strong>
              <small>Find the right check for your task.</small>
            </span>
            <ArrowUpRight aria-hidden="true" />
          </Link>
        </div>
      </section>

      <section
        className="section field-notes"
        id="insights"
        aria-labelledby="insights-title"
      >
        <div>
          <p className="eyebrow">The engineering reading room</p>
          <h2 id="insights-title">
            Stay informed.
            <br />
            Act with context.
          </h2>
          <p className="section-copy">
            Connect new information to the systems you run. Start with the
            source, then decide what applies.
          </p>
        </div>
        <div className="insight-links">
          <Link href="/security-advisories">
            <Radar aria-hidden="true" />
            <span>
              <small>SECURITY ADVISORY DESK</small>
              <strong>
                Understand the advisory.
                <br />
                Check your exposure.
              </strong>
              <span>
                Vendor context, affected systems and remediation guidance.
              </span>
            </span>
            <ArrowUpRight aria-hidden="true" />
          </Link>
          <Link href="/resources">
            <BookOpenText aria-hidden="true" />
            <span>
              <small>QCS RESOURCES</small>
              <strong>
                Go deeper on the
                <br />
                engineering behind it.
              </strong>
              <span>Explore network, security and cloud articles.</span>
            </span>
            <ArrowUpRight aria-hidden="true" />
          </Link>
        </div>
      </section>

      <section
        className="section latest-notes"
        aria-label="Recent security advisories"
      >
        {children}
      </section>
      <section className="section questions" aria-labelledby="questions-title">
        <div>
          <p className="eyebrow">Before we begin</p>
          <h2 id="questions-title">
            Clear expectations.
            <br />
            From the start.
          </h2>
        </div>
        <div>
          <details>
            <summary>
              Can we begin with a focused assessment?
              <Plus aria-hidden="true" />
            </summary>
            <p>
              Yes. Describe your issue and intended outcome. Scope, access,
              deliverables and availability are agreed before work begins.
            </p>
          </details>
          <details>
            <summary>
              Does a security review include penetration testing?
              <Plus aria-hidden="true" />
            </summary>
            <p>
              Not automatically. Penetration testing requires an explicitly
              authorized scope, agreed methods, exclusions and reporting
              requirements.
            </p>
          </details>
          <details>
            <summary>
              Are changes and retesting included?
              <Plus aria-hidden="true" />
            </summary>
            <p>
              Only when agreed in the scope. We clarify who approves changes,
              who carries them out and how the outcome will be checked.
            </p>
          </details>
          <details>
            <summary>
              What should we share in the first conversation?
              <Plus aria-hidden="true" />
            </summary>
            <p>
              Describe the business impact, affected systems, recent changes and
              the outcome you need. Do not send passwords, private keys or raw
              customer data through a public contact form.
            </p>
          </details>
        </div>
      </section>

      <section className="contact" id="contact">
        <div className="section">
          <p className="eyebrow">Your next connection</p>
          <h2>
            Let’s make your
            <br />
            next move <span>clear.</span>
          </h2>
          <div className="contact-bottom">
            <p>
              Tell us about the issue, the environment
              <br />
              and the outcome you need.
            </p>
            <a className="button primary" href="#engage">
              Discuss your project <ArrowUpRight aria-hidden="true" />
            </a>
          </div>
          <div id="engage" className="home-lead">
            <div>
              <h3>Tell us what needs to change.</h3>
              <p>
                Share your business impact, affected systems and intended
                outcome. Please do not include passwords, keys or customer data.
              </p>
              <p>
                Prefer to prepare first?{" "}
                <Link href="/diagnose">Start a guided assessment</Link>.
              </p>
            </div>
            <LeadForm
              interest="Managed network services"
              pipeline="Managed Network Services"
            />
          </div>
          <div className="contact-foot">
            <span>
              <MessagesSquare aria-hidden="true" />
              Your context
            </span>
            <ArrowRight aria-hidden="true" />
            <span>
              <Focus aria-hidden="true" />
              Agreed scope
            </span>
            <ArrowRight aria-hidden="true" />
            <span>
              <Waypoints aria-hidden="true" />
              Next step
            </span>
          </div>
        </div>
      </section>
    </main>
  );
}
