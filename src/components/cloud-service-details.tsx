import { Cloud, Container, GitPullRequest, KeyRound, Network, Bot } from "lucide-react";
import "./cloud-service-details.css";

const workstreams = [
  {
    title: "Cloud security and configuration audits",
    Icon: Cloud,
    description: "Review GCP, AWS and Azure configurations, IAM permissions, public exposure and audit logging. Map application and data-service dependencies before recommending changes.",
    output: "A findings register with evidence, severity, affected assets and recommended actions."
  },
  {
    title: "DevSecOps and application security",
    Icon: GitPullRequest,
    description: "Review code and API risks, dependency and secret scanning, pull-request checks, container image scanning and security gates in CI/CD. Select controls that fit the existing delivery workflow.",
    output: "A pipeline control plan, remediation priorities and agreed release checks."
  },
  {
    title: "Kubernetes and container security",
    Icon: Container,
    description: "Assess GKE and other Kubernetes environments, RBAC, service accounts, workload permissions, image provenance, pod security, network policies and ingress or egress exposure.",
    output: "A hardening backlog that considers workload isolation and potential compromise paths."
  },
  {
    title: "Identity and cross-cloud access",
    Icon: KeyRound,
    description: "Review centralized SSO, application roles, service-to-service authentication, workload identity federation and short-lived credentials. Check permissions and credential lifecycle across cloud boundaries.",
    output: "An access model with least-privilege recommendations and identity ownership."
  },
  {
    title: "AI agent and MCP security",
    Icon: Bot,
    description: "Distinguish human users from agents. Assess delegated identity, tool permissions, API and database access, action guardrails and audit trails, including controls for sensitive write and delete operations.",
    output: "An agent-to-service permission map and scoped tests for unintended access or actions."
  },
  {
    title: "Hybrid networks and ongoing hardening",
    Icon: Network,
    description: "Design and review VPCs, VNets, routes, VPNs, firewalls, private connectivity and segmentation. Agree monitoring, alert ownership, incident escalation and remediation reviews across cloud and on-premises systems.",
    output: "A connectivity and exposure map, change plan and operational handover."
  }
];

const phases = [
  { title: "Discover and scope", description: "Review the architecture, priorities and existing findings. Confirm application, cloud and network assets, authorized access and testing boundaries.", output: "Agreed scope and required client inputs" },
  { title: "Plan the assessment", description: "Define the approach for each audit layer, estimated effort, elapsed timeline, specialists, client contacts and coordination with ongoing releases.", output: "Audit plan, resource allocation and proposal" },
  { title: "Assess and prioritize", description: "Collect evidence, validate findings within the agreed scope, and review risks with the relevant owners. Escalate urgent findings through the agreed contacts.", output: "Executive summary and technical remediation backlog" },
  { title: "Remediate and verify", description: "Agree fixes, change windows, validation and rollback steps. Retest the agreed changes and hand over evidence, remaining risks and an optional ongoing support plan.", output: "Retest results and an owned improvement plan" }
];

export function CloudServiceDetails() {
  return (
    <>
      <section className="section cloud-service-details" id="cloud-capabilities" aria-labelledby="cloud-capabilities-title">
        <div className="section-heading">
          <p className="eyebrow">Specialist workstreams</p>
          <h2 id="cloud-capabilities-title">Security from code to cloud operations.</h2>
          <p>Choose a focused review or combine these workstreams into an assessment across the application, cloud and network layers.</p>
        </div>
        <div className="cloud-workstream-grid">
          {workstreams.map(({ title, Icon, description, output }) => (
            <article className="cloud-workstream" key={title}>
              <Icon size={28} aria-hidden="true" />
              <h3>{title}</h3>
              <p>{description}</p>
              <p className="cloud-workstream-output"><strong>What you receive</strong>{output}</p>
            </article>
          ))}
        </div>
      </section>
      <section className="section cloud-service-details" id="cloud-audit-process" aria-labelledby="cloud-audit-process-title">
        <div className="section-heading">
          <p className="eyebrow">Engagement process</p>
          <h2 id="cloud-audit-process-title">A clear plan for each audit layer.</h2>
          <p>Effort and timelines depend on your environment, access readiness and testing scope. We define the application, cloud and network work separately so you can see the people, inputs and outcomes required.</p>
        </div>
        <ol className="cloud-audit-phases">
          {phases.map(({ title, description, output }) => (
            <li key={title}>
              <h3>{title}</h3>
              <p>{description}</p>
              <p className="cloud-phase-output"><strong>Output:</strong> {output}</p>
            </li>
          ))}
        </ol>
        <aside className="cloud-intake" aria-labelledby="cloud-intake-title">
          <h3 id="cloud-intake-title">What helps us scope your review</h3>
          <ul>
            <li>A high-level architecture and in-scope application, cloud and network inventory.</li>
            <li>Your priorities, delivery constraints and existing audit findings you are permitted to share.</li>
            <li>Application, cloud, network and identity contacts, with agreed access and test windows.</li>
          </ul>
          <p>Start with a brief description in the request form. We can arrange an approved channel for architecture documents and assessment access during scoping.</p>
          <a className="button secondary" href="#request-review">Discuss a cloud security review</a>
        </aside>
      </section>
    </>
  );
}
