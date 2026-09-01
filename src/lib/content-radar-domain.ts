import type { BlogPost } from "./blog.ts";

export type RadarDraftInput = {
  slot?: string;
  format?: string;
  title: string;
  slug: string;
  metaTitle: string;
  metaDescription: string;
  answerBlock: string;
  sections: string[];
  internalLinks: string[];
  sourceUrl: string;
  sourceName?: string;
  sourceRole?: "authority" | "demand" | "discovery";
  sourcePublishedAt?: string;
  sourceSummary?: string;
  supportingSources?: Array<{
    label: string;
    url: string;
    summary?: string;
  }>;
  businessAngle?: string;
  servicePath?: string;
  keywordCluster?: string[];
  imageRecommendation: string;
};

export function normalizeRadarSlug(value: string, maxLength = 180) {
  const normalized = value
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+/, "")
    .slice(0, Math.max(3, maxLength))
    .replace(/-+$/, "");
  return normalized.length >= 3 ? normalized : "network-intelligence-brief";
}

type OperatingGuidance = {
  category: string;
  evidence: string[];
  actions: string[];
  mistakes: string[];
  decision: string;
};

function compact(value: string, max: number) {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (normalized.length <= max) return normalized;
  const candidate = normalized.slice(0, max + 1).replace(/\s+\S*$/, "").replace(/[,:;\s]+$/, "");
  return candidate || normalized.slice(0, max).trim();
}

function labelFromPath(path: string) {
  return (
    path
      .split("/")
      .filter(Boolean)
      .pop()
      ?.split("-")
      .map((word) => `${word.charAt(0).toUpperCase()}${word.slice(1)}`)
      .join(" ") || "QCS Service"
  );
}

function absoluteSourceUrl(value: string) {
  if (/^https?:\/\//i.test(value)) return value;
  return `https://www.qcsstudio.com${value.startsWith("/") ? value : `/${value}`}`;
}

function sourceDate(value?: string) {
  if (!value) return "the current monitoring cycle";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "the current monitoring cycle";
  return date.toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
}

function operatingGuidance(context: string): OperatingGuidance {
  if (/\b(cve|vulnerab|exploit|patch|kev|firewall|vpn|security advisory|zero[- ]day)\b/i.test(context)) {
    return {
      category: "Network Security",
      evidence: [
        "Affected vendor, product family, software release, deployment role, and externally reachable interfaces",
        "Current configuration, compensating controls, authentication path, relevant logs, and exposure evidence",
        "Approved maintenance owner, backup or recovery state, change window, and post-change validation record"
      ],
      actions: [
        "Read the primary advisory and map its affected-version criteria to the asset inventory before assigning urgency.",
        "Prioritize internet-facing, privileged, and control-plane systems, then confirm temporary controls where remediation cannot be immediate.",
        "Test the vendor-supported fix in a representative scope, deploy through change control, and retain version and validation evidence."
      ],
      mistakes: [
        "Treating a headline or severity score as proof that every device is affected",
        "Changing a production control before recording access, backup, rollback, and accountable ownership",
        "Closing the task after installation without validating exposure, service health, logs, and the running version"
      ],
      decision: "patch priority, exposure reduction, validation, and accountable remediation"
    };
  }

  if (/\b(bgp|rpki|roa|routing|route|asn|ipv6|dns|internet)\b/i.test(context)) {
    return {
      category: "Routing and Internet Operations",
      evidence: [
        "Prefixes, origin ASNs, BGP neighbors, route policy, RPKI state, DNS dependencies, and provider ownership",
        "Before-and-after route tables, looking-glass observations, alerts, timestamps, and path measurements",
        "Approved rollback criteria, provider escalation contacts, maintenance window, and validation checkpoints"
      ],
      actions: [
        "Confirm the intended prefixes, origin, policy, and external dependencies before changing advertisements or filters.",
        "Compare internal state with independent routing, RPKI, DNS, and reachability evidence from more than one vantage point.",
        "Apply the smallest controlled change, monitor propagation, and retain before-and-after evidence for review."
      ],
      mistakes: [
        "Relying on one route table or monitoring vantage point",
        "Changing policy without checking ROAs, provider filters, DNS dependencies, and rollback conditions",
        "Assuming propagation is complete without external path and reachability validation"
      ],
      decision: "routing integrity, reachability, change safety, and provider coordination"
    };
  }

  if (/\b(cloud|aws|azure|google cloud|vpc|vnet|subnet|security group|load balancer|kubernetes)\b/i.test(context)) {
    return {
      category: "Cloud Network Security",
      evidence: [
        "Accounts and subscriptions, VPC or VNet topology, routes, gateways, public IPs, security rules, DNS, and private endpoints",
        "Flow logs, load-balancer listeners, identity ownership, hybrid paths, peering, and current exposure evidence",
        "Change owner, application dependency map, rollback method, maintenance window, and validation queries"
      ],
      actions: [
        "Map the complete public, private, and hybrid path before changing routes, security rules, gateways, or name resolution.",
        "Correlate configuration with flow evidence and application ownership so unused exposure can be separated from required access.",
        "Apply least-privilege changes in a controlled sequence and validate connectivity, logging, and recovery from each required path."
      ],
      mistakes: [
        "Reviewing one security group without tracing the complete route and identity path",
        "Removing exposure before confirming application, partner, and operational dependencies",
        "Leaving temporary public access, broad rules, or test gateways without an owner and expiry date"
      ],
      decision: "cloud exposure, hybrid connectivity, least privilege, and observable change"
    };
  }

  return {
    category: "Network Operations",
    evidence: [
      "Topology, affected sites and users, device roles, current configuration, timestamps, and a precise symptom statement",
      "Interface state, routing and policy evidence, DNS results, logs, telemetry, packet captures, and recent change history",
      "Business impact, accountable owner, maintenance constraints, rollback criteria, and validation results"
    ],
    actions: [
      "Define the symptom, scope, start time, and last known good state before selecting a command or making a change.",
      "Collect evidence at each decision point and compare the expected path with observed routing, policy, name resolution, and traffic.",
      "Make one controlled correction at a time, validate the result from the user and network perspectives, and record the outcome."
    ],
    mistakes: [
      "Starting with a configuration change before proving where the path fails",
      "Collecting commands without timestamps, topology context, or a clear test hypothesis",
      "Declaring resolution before user-path, monitoring, and recurrence checks are complete"
    ],
    decision: "fault isolation, evidence quality, service restoration, and recurrence prevention"
  };
}

export function buildRadarPublicationPost(draft: RadarDraftInput): BlogPost {
  const today = new Date().toISOString().slice(0, 10);
  const title = compact(draft.title, 180);
  const slug = normalizeRadarSlug(draft.slug || title);
  const sourceName = compact(draft.sourceName || "Primary technical source", 180);
  const sourceUrl = absoluteSourceUrl(draft.sourceUrl);
  const sourcePublished = sourceDate(draft.sourcePublishedAt);
  const keywords = Array.from(
    new Set(
      [...(draft.keywordCluster || []), title, "network operations", "network security"]
        .map((keyword) => compact(keyword, 140))
        .filter((keyword) => keyword.length >= 2)
    )
  ).slice(0, 12);
  const context = `${title} ${keywords.join(" ")} ${draft.sourceSummary || ""}`;
  const guidance = operatingGuidance(context);
  const internalLinks = Array.from(new Set([...(draft.internalLinks || []), draft.servicePath || "", "/network-tools", "/tools/network-risk-score"]))
    .filter((href) => href.startsWith("/"));
  const serviceLinks = internalLinks.filter((href) => href.startsWith("/services/") || href.startsWith("/solutions/"));
  const toolLinks = internalLinks.filter((href) => href === "/network-tools" || href.startsWith("/tools/"));
  const businessAngle = compact(
    draft.businessAngle || `Translate this signal into a controlled decision about ${guidance.decision}.`,
    300
  );
  const description = compact(
    draft.metaDescription || `Practical guidance for ${title}, including evidence, ownership, validation, and the next network action.`,
    160
  );
  const answer = compact(
    `Verify that the source applies to your environment, identify the affected path and owner, collect current-state evidence, and use a controlled change with rollback and validation. This turns ${title} into an accountable network decision instead of a headline-driven reaction.`,
    900
  );

  return {
    contentType: "blog",
    slug,
    title,
    metaTitle: compact(draft.metaTitle || title, 60),
    description,
    excerpt: compact(
      `${sourceName} surfaced this signal on ${sourcePublished}. This QCS briefing converts it into evidence to collect, decisions to record, and a safe validation sequence for network and security teams.`,
      400
    ),
    answer,
    category: guidance.category,
    audience: "IT leaders, network engineers, security teams, cloud teams, and managed service providers",
    primaryKeyword: compact(keywords[0] || title.toLowerCase(), 140),
    keywords,
    publishedAt: today,
    updatedAt: today,
    readTime: "8 min read",
    image: `/resources/${slug}/visual`,
    imageAlt: compact(`Topic-specific QCS network intelligence visual for ${title}`, 240),
    relatedTools: (toolLinks.length ? toolLinks : ["/network-tools"]).slice(0, 4).map((href) => ({ label: labelFromPath(href), href })),
    relatedServices: (serviceLinks.length ? serviceLinks : ["/services/network-security-services"])
      .slice(0, 4)
      .map((href) => ({ label: labelFromPath(href), href })),
    takeaways: [
      `The source signal is a reason to verify applicability; it is not proof that every environment is affected.`,
      `A defensible response connects ${guidance.evidence[0].toLowerCase()} to an accountable owner and business impact.`,
      `The work is complete only after the controlled action, rollback readiness, and post-change evidence are recorded.`
    ],
    sections: [
      {
        heading: "Short answer",
        body: `${answer} Start with the primary source, not a syndicated headline, and preserve enough evidence for another engineer or auditor to reproduce the decision.`
      },
      {
        heading: "What the source signal means",
        body: `On ${sourcePublished}, ${sourceName} published "${title}". ${businessAngle} QCS treats this as a monitoring and verification trigger. Teams should read the linked source for product-specific facts, fixed releases, exceptions, and updates before changing production controls.`
      },
      {
        heading: "Why this matters to network teams",
        body: `The operational risk is rarely confined to one device or setting. Dependencies can include identity, routes, DNS, cloud paths, remote access, monitoring, support ownership, and recovery procedures. A fast response is useful only when it preserves service continuity and produces evidence that the intended risk was actually reduced.`
      },
      {
        heading: "Evidence to collect before action",
        body: `Build a small evidence packet before assigning or changing anything. It should establish scope, current state, accountable ownership, business impact, and the test that will prove the outcome. This prevents duplicate work and gives reviewers a reliable basis for prioritization.`,
        bullets: guidance.evidence
      },
      {
        heading: "Controlled implementation sequence",
        body: `Use a staged sequence that separates verification, decision, implementation, and validation. Record timestamps and owners at each stage, keep the source URL with the change record, and stop when observed evidence no longer matches the approved scope.`,
        bullets: guidance.actions
      },
      {
        heading: "Common failure patterns",
        body: `Teams lose time when urgency replaces diagnosis or when a technically correct change lacks ownership and validation. The following patterns should be challenged during review because they make the final result difficult to trust or reproduce.`,
        bullets: guidance.mistakes
      },
      {
        heading: "When to escalate to QCS",
        body: `Escalate when scope is uncertain, the affected path crosses multiple vendors or clouds, production access is constrained, rollback is unclear, or independent validation is required. QCS can help map the path, collect evidence, plan the controlled change, validate the result, and retain an auditable next-action record.`
      }
    ],
    checklist: [
      "Open the primary source and confirm its publication date, affected scope, and latest revision.",
      "Map the source criteria to owned assets, software releases, exposure, and business services.",
      "Capture current configuration, topology, logs, monitoring state, and recent change evidence.",
      "Assign an accountable technical owner, business owner, maintenance window, and rollback decision.",
      "Test the supported action in a representative scope before broad production implementation.",
      "Validate service health, observed exposure, monitoring, and the running state after the change.",
      "Record exceptions, residual risk, evidence links, and the next review or retest date."
    ],
    questions: [
      {
        question: "Does this source signal prove that our environment is affected?",
        answer: "No. Confirm the vendor, product, release, role, configuration, and exposure criteria against current asset and network evidence before assigning remediation."
      },
      {
        question: "Should the team act immediately or wait for a maintenance window?",
        answer: "Base urgency on confirmed exposure, exploitation or outage evidence, business criticality, compensating controls, vendor guidance, and the safety of the available rollback plan."
      },
      {
        question: "What evidence should be retained after the work?",
        answer: "Keep the authoritative source, affected-asset decision, approvals, before-and-after configuration or version evidence, validation results, exceptions, owner, and next review date."
      },
      {
        question: "When is independent validation useful?",
        answer: "Use independent validation when the path spans teams or providers, the control protects a critical service, the change is difficult to observe internally, or assurance evidence is required."
      }
    ],
    sources: [{ label: sourceName, url: sourceUrl }]
  };
}
