export type AssessmentBand = "critical" | "high" | "medium" | "low";

export type AssessmentCta = {
  label: string;
  href: string;
  note: string;
  owner: string;
  responseWindow: string;
};

export type AssessmentQuestionModel = {
  domain: string;
  domainLabel: string;
  technique: string;
  evidence: string;
  action: string;
  weight: number;
  risks: Record<string, number>;
};

export type AssessmentFrameworkModel = {
  method: string;
  frameworks: string[];
  evidencePack: string[];
  fields: Record<string, AssessmentQuestionModel>;
  ctas: Record<AssessmentBand, AssessmentCta>;
};

export type AssessmentToolLike = {
  slug: string;
  title: string;
  pipeline: string;
  recommendation: string;
  fields: { name: string; label: string; options: string[] }[];
};

export type AssessmentDomainScore = {
  domain: string;
  label: string;
  score: number;
  maturity: number;
  weight: number;
};

export type AssessmentFinding = {
  question: string;
  answer: string;
  domain: string;
  domainLabel: string;
  severity: string;
  risk: number;
  technique: string;
  evidence: string;
  action: string;
};

export type AssessmentResult = {
  score: number;
  maturityScore: number;
  riskBand: AssessmentBand;
  riskLevel: string;
  recommendation: string;
  pipeline: string;
  cta: AssessmentCta;
  domainScores: AssessmentDomainScore[];
  topFindings: AssessmentFinding[];
  nextActions: string[];
  evidenceRequests: string[];
  methodology: string;
  frameworks: string[];
};

const defaultCtas: Record<AssessmentBand, AssessmentCta> = {
  critical: {
    label: "Book Priority Network Assessment",
    href: "/services/managed-network-services",
    note: "High impact or low visibility signals need a controlled engineering review before more changes are made.",
    owner: "Network command desk",
    responseWindow: "Same business day"
  },
  high: {
    label: "Schedule Network Risk Review",
    href: "/services/managed-network-services",
    note: "Several controls need validation, remediation planning, or managed support.",
    owner: "Network operations lead",
    responseWindow: "1 business day"
  },
  medium: {
    label: "Get Improvement Roadmap",
    href: "/resources",
    note: "Useful signals exist, but gaps should be documented and prioritized before they become incidents.",
    owner: "Assessment team",
    responseWindow: "2 business days"
  },
  low: {
    label: "Create Baseline Health Record",
    href: "/tools/network-risk-score",
    note: "The environment looks comparatively controlled. Keep evidence, monitoring, and periodic review active.",
    owner: "Customer success",
    responseWindow: "Monthly review"
  }
};

export const assessmentFrameworks: Record<string, AssessmentFrameworkModel> = {
  "network-risk-score": {
    method:
      "Network posture assessment across asset scope, topology, remote access, observability, firewall governance, incident history, and documentation.",
    frameworks: ["NIST CSF 2.0", "NIST SP 800-115", "CISA Zero Trust Maturity Model"],
    evidencePack: [
      "Current topology or site list",
      "Device inventory and ownership map",
      "Firewall and VPN export",
      "Monitoring and alerting screenshot",
      "Recent incident notes or RCA",
      "Configuration backup process"
    ],
    fields: {
      users: {
        domain: "scope",
        domainLabel: "Asset scope and blast radius",
        technique: "Asset inventory and business impact sizing",
        evidence: "User count, device count, critical application list",
        action: "Confirm network scope and business-critical user groups before proposing a support tier.",
        weight: 0.85,
        risks: { "1-25": 1, "26-100": 2, "101-500": 3.5, "500+": 5 }
      },
      sites: {
        domain: "scope",
        domainLabel: "Asset scope and blast radius",
        technique: "Topology and dependency review",
        evidence: "Branch list, WAN links, VPN/SD-WAN topology",
        action: "Map site dependencies and single points of failure.",
        weight: 0.95,
        risks: { "1": 1, "2-5": 2.5, "6-20": 4, "20+": 5 }
      },
      monitoring: {
        domain: "detect",
        domainLabel: "Detection and observability",
        technique: "Monitoring coverage and alert workflow review",
        evidence: "NMS dashboard, alert rules, escalation matrix",
        action: "Create or tune monitoring for devices, circuits, VPN, firewall health, and cloud paths.",
        weight: 1.25,
        risks: { Yes: 0.5, Partial: 3, No: 5 }
      },
      firewall: {
        domain: "protect",
        domainLabel: "Firewall and perimeter governance",
        technique: "Firewall policy review and change history sampling",
        evidence: "Rule export, change log, object groups, NAT/VPN policy",
        action: "Run a firewall hygiene review and document risky rules.",
        weight: 1.15,
        risks: { "Reviewed recently": 1, "Not sure": 4, "Over 12 months": 5 }
      },
      mfa: {
        domain: "identity",
        domainLabel: "Identity and remote access",
        technique: "Remote access control validation",
        evidence: "VPN groups, MFA policy, admin access list",
        action: "Harden VPN and administrator access with MFA and least privilege.",
        weight: 1.2,
        risks: { Enabled: 0.5, Partial: 3, "Not enabled": 5 }
      },
      incident: {
        domain: "respond",
        domainLabel: "Resilience and incident history",
        technique: "Incident pattern and recovery review",
        evidence: "Ticket history, outage notes, last RCA, failover test result",
        action: "Convert incident symptoms into RCA, prevention actions, and managed response playbooks.",
        weight: 1.3,
        risks: { No: 0.5, Minor: 2.5, Major: 5 }
      }
    },
    ctas: {
      ...defaultCtas,
      critical: {
        label: "Start Network Stabilization Review",
        href: "/services/network-troubleshooting",
        note: "The environment shows high impact, weak visibility, or recent incident pressure.",
        owner: "Incident and operations desk",
        responseWindow: "Same business day"
      },
      high: {
        label: "Build Managed Network Support Plan",
        href: "/services/managed-network-services",
        note: "The environment is a strong fit for monitored support, documentation, and change governance.",
        owner: "Managed services lead",
        responseWindow: "1 business day"
      }
    }
  },
  "firewall-hygiene": {
    method:
      "Firewall hygiene assessment across policy sprawl, broad allow rules, logging, administrator access, VPN exposure, and backup discipline.",
    frameworks: ["NIST SP 800-41", "NIST CSF 2.0", "CISA Zero Trust Maturity Model"],
    evidencePack: [
      "Firewall rule and object export",
      "NAT and VPN policy export",
      "Administrator account list",
      "Logging and retention settings",
      "Configuration backup sample",
      "Last policy change record"
    ],
    fields: {
      vendor: {
        domain: "asset",
        domainLabel: "Firewall estate clarity",
        technique: "Platform and lifecycle identification",
        evidence: "Firewall vendor, model, firmware, support status",
        action: "Identify platform lifecycle and feature coverage before cleanup.",
        weight: 0.45,
        risks: { Fortinet: 1, "Palo Alto": 1, Cisco: 1.2, Sophos: 1.2, Other: 2.5 }
      },
      rules: {
        domain: "policy",
        domainLabel: "Policy complexity",
        technique: "Rulebase size and object hygiene review",
        evidence: "Rule count, disabled rules, duplicate objects, shadowed rules",
        action: "Prioritize rule cleanup by exposure, usage, and business owner.",
        weight: 1.1,
        risks: { "Under 50": 1, "50-200": 2.5, "200-500": 4, "500+": 5 }
      },
      anyRules: {
        domain: "exposure",
        domainLabel: "Broad access exposure",
        technique: "Any-any, internet-facing, and over-broad rule review",
        evidence: "Source, destination, service, NAT, and hit-count exports",
        action: "Replace broad allow rules with least-privilege policy and ownership notes.",
        weight: 1.35,
        risks: { No: 1, "Not sure": 4, Yes: 5 }
      },
      logging: {
        domain: "detect",
        domainLabel: "Logging and detection",
        technique: "Log coverage and alertability review",
        evidence: "Traffic logs, threat logs, syslog/SIEM forwarding",
        action: "Enable traffic/security logs and route key events to monitoring.",
        weight: 1.15,
        risks: { Yes: 0.5, Partial: 3, No: 5 }
      },
      backup: {
        domain: "recover",
        domainLabel: "Configuration recovery",
        technique: "Backup and restore process validation",
        evidence: "Automated backup job, restore test, config archive",
        action: "Create scheduled config backups and test restore steps.",
        weight: 1.05,
        risks: { Automated: 0.5, Manual: 3, None: 5 }
      },
      admin: {
        domain: "identity",
        domainLabel: "Privileged access control",
        technique: "Administrator account and MFA review",
        evidence: "Admin list, MFA policy, management interface exposure",
        action: "Restrict firewall administration and enforce MFA for privileged access.",
        weight: 1.25,
        risks: { "MFA and restricted": 0.5, "Password only": 3.5, "Not sure": 4.5 }
      }
    },
    ctas: {
      ...defaultCtas,
      critical: {
        label: "Book Firewall Hygiene Sprint",
        href: "/services/firewall-management",
        note: "The policy set likely needs urgent cleanup, logging, or admin hardening.",
        owner: "Firewall security lead",
        responseWindow: "Same business day"
      },
      high: {
        label: "Plan Firewall Governance Review",
        href: "/services/network-security-services",
        note: "The firewall can be improved through policy ownership, backup, logging, and change control.",
        owner: "Network security lead",
        responseWindow: "1 business day"
      }
    }
  },
  "pentest-readiness": {
    method:
      "Penetration testing readiness assessment across scope definition, asset type, deadline pressure, business driver, previous testing, and retest need.",
    frameworks: ["NIST SP 800-115", "NIST CSF 2.0"],
    evidencePack: [
      "Asset inventory and scope boundaries",
      "Authorization contact and test window",
      "Previous pentest or vulnerability report",
      "Compliance or client requirement",
      "Retest expectations",
      "Production change freeze dates"
    ],
    fields: {
      asset: {
        domain: "scope",
        domainLabel: "Test scope complexity",
        technique: "Target and environment classification",
        evidence: "URLs, IP ranges, API docs, cloud accounts, Wi-Fi SSIDs",
        action: "Define scope boundaries, exclusions, and rules of engagement.",
        weight: 0.8,
        risks: { "External network": 3, "Web app": 3, API: 4, Cloud: 4.2, "Wi-Fi": 3.2, "Internal network": 4.5 }
      },
      scope: {
        domain: "govern",
        domainLabel: "Rules of engagement maturity",
        technique: "Scope and authorization review",
        evidence: "Signed authorization, asset list, test window, emergency contact",
        action: "Convert vague testing requests into a signed scope and testing plan.",
        weight: 1.25,
        risks: { Yes: 1, Partial: 3, No: 5 }
      },
      timeline: {
        domain: "urgency",
        domainLabel: "Timeline pressure",
        technique: "Delivery deadline and risk acceptance review",
        evidence: "Client deadline, launch date, audit date, change calendar",
        action: "Prioritize a scoped test plan that matches deadline and production risk.",
        weight: 1.05,
        risks: { "This week": 5, "This month": 3.8, "This quarter": 2, Exploring: 1 }
      },
      reason: {
        domain: "driver",
        domainLabel: "Business driver",
        technique: "Testing objective and stakeholder review",
        evidence: "Client request, compliance clause, launch checklist, risk memo",
        action: "Align report format and remediation workflow with the business driver.",
        weight: 0.9,
        risks: { "Client requirement": 4, Compliance: 4, Launch: 4.5, "Internal review": 2.5 }
      },
      previous: {
        domain: "history",
        domainLabel: "Testing history",
        technique: "Previous findings and retest history review",
        evidence: "Last report, open findings, accepted risks, retest proof",
        action: "Use previous findings to focus validation and retesting.",
        weight: 1.1,
        risks: { "Within 12 months": 1.5, Older: 3.2, Never: 5 }
      },
      retest: {
        domain: "verify",
        domainLabel: "Retest and remediation loop",
        technique: "Remediation evidence and retest planning",
        evidence: "Fix owner list, screenshots, change tickets, retest window",
        action: "Create a retest lane so findings do not die in a report.",
        weight: 0.85,
        risks: { Yes: 4, Maybe: 2.5, No: 1 }
      }
    },
    ctas: {
      ...defaultCtas,
      critical: {
        label: "Create Pentest Scope Today",
        href: "/services/penetration-testing",
        note: "A short deadline, unclear scope, or no recent testing needs fast scoping before testing starts.",
        owner: "Pentest coordinator",
        responseWindow: "Same business day"
      },
      high: {
        label: "Book Pentest Scoping Call",
        href: "/services/penetration-testing",
        note: "The request is likely qualified and should move into scope, authorization, and scheduling.",
        owner: "Pentest coordinator",
        responseWindow: "1 business day"
      }
    }
  },
  "cloud-readiness": {
    method:
      "Cloud network readiness review across provider scope, hybrid connectivity, segmentation, public exposure, network logs, and migration or cost pressure.",
    frameworks: ["NIST CSF 2.0", "CISA Zero Trust Maturity Model"],
    evidencePack: [
      "VPC/VNet topology",
      "Subnet and route table export",
      "Security group or NSG rules",
      "VPN/direct connectivity details",
      "Public IP and load balancer inventory",
      "Flow logs and cloud audit settings"
    ],
    fields: {
      provider: {
        domain: "scope",
        domainLabel: "Cloud estate scope",
        technique: "Cloud provider and account boundary review",
        evidence: "Cloud accounts, regions, subscriptions, projects",
        action: "Map cloud accounts and regions before reviewing routes and exposure.",
        weight: 0.75,
        risks: { AWS: 2, Azure: 2, "Google Cloud": 2, "Multi-cloud": 3.8, "Not sure": 4 }
      },
      connectivity: {
        domain: "connectivity",
        domainLabel: "Hybrid connectivity",
        technique: "VPN, direct link, routing, and failover review",
        evidence: "VPN tunnels, BGP/static routes, failover config",
        action: "Validate hybrid routing, failover behavior, and private access paths.",
        weight: 1.05,
        risks: { "Direct/private": 1, "Site-to-site VPN": 2.7, "Public internet": 4.5, None: 3.5 }
      },
      segmentation: {
        domain: "protect",
        domainLabel: "Cloud segmentation",
        technique: "Subnet, route, security group, and workload zone review",
        evidence: "VPC/VNet diagram, subnets, security groups, route tables",
        action: "Separate workloads by trust zone and document route intent.",
        weight: 1.25,
        risks: { Documented: 1, Partial: 3, "Flat/unclear": 5 }
      },
      exposure: {
        domain: "exposure",
        domainLabel: "Public exposure",
        technique: "Public IP, security group, and ingress review",
        evidence: "Public IP inventory, exposed services, load balancer rules",
        action: "Reduce unnecessary public exposure and validate internet-facing services.",
        weight: 1.35,
        risks: { Recently: 1, "Not sure": 4, Never: 5 }
      },
      logs: {
        domain: "detect",
        domainLabel: "Cloud network visibility",
        technique: "Flow log, DNS log, and audit log review",
        evidence: "Flow logs, DNS logs, firewall logs, audit trails",
        action: "Enable network telemetry and route key logs to a review workflow.",
        weight: 1.2,
        risks: { Centralized: 1, Partial: 3, No: 5 }
      },
      issue: {
        domain: "driver",
        domainLabel: "Primary pressure",
        technique: "Business objective and risk driver review",
        evidence: "Security, cost, performance, or migration concern",
        action: "Translate the primary driver into a cloud network remediation plan.",
        weight: 0.75,
        risks: { Security: 4, Cost: 2.2, Performance: 3, Migration: 3.4 }
      }
    },
    ctas: {
      ...defaultCtas,
      critical: {
        label: "Run Cloud Exposure Review",
        href: "/services/cloud-network-services",
        note: "Segmentation, public exposure, or logging gaps can create fast-moving cloud risk.",
        owner: "Cloud network lead",
        responseWindow: "Same business day"
      },
      high: {
        label: "Plan Cloud Network Remediation",
        href: "/services/cloud-network-services",
        note: "The cloud estate is ready for a structured route, exposure, and logging review.",
        owner: "Cloud network lead",
        responseWindow: "1 business day"
      }
    }
  },
  "career-path-finder": {
    method:
      "Training readiness assessment across current level, career target, weekly effort, learning mode, lab exposure, and start timeline.",
    frameworks: ["Role based skills mapping", "Hands-on lab readiness", "Outcome based training design"],
    evidencePack: [
      "Current skill level",
      "Target role",
      "Weekly study capacity",
      "Preferred training mode",
      "Existing lab exposure",
      "Start timeline"
    ],
    fields: {
      level: {
        domain: "baseline",
        domainLabel: "Current baseline",
        technique: "Skill baseline interview",
        evidence: "Networking, OS, cloud, and security fundamentals",
        action: "Place the learner into the right foundation or advanced track.",
        weight: 1.1,
        risks: { Beginner: 5, "Basic networking": 3.5, "Working professional": 2, Advanced: 1 }
      },
      goal: {
        domain: "target",
        domainLabel: "Career target clarity",
        technique: "Role outcome mapping",
        evidence: "Target role, location, salary expectation, certification plan",
        action: "Map the course track to a real role outcome.",
        weight: 0.85,
        risks: { "Network engineer": 2.5, "Security engineer": 3.2, "SOC analyst": 3, Pentester: 4, "Cloud network engineer": 3.5 }
      },
      time: {
        domain: "execution",
        domainLabel: "Study execution capacity",
        technique: "Weekly commitment review",
        evidence: "Study hours, job schedule, exam timeline",
        action: "Build a realistic weekly plan instead of overselling a course.",
        weight: 1,
        risks: { "2-4 hours": 4.5, "5-8 hours": 3, "9-15 hours": 1.8, "15+ hours": 1 }
      },
      mode: {
        domain: "delivery",
        domainLabel: "Learning delivery fit",
        technique: "Batch mode and support model selection",
        evidence: "Online, classroom, hybrid, or corporate training constraints",
        action: "Route the learner to online, classroom, hybrid, or corporate batch counseling.",
        weight: 0.75,
        risks: { Online: 2.2, Classroom: 1.8, Hybrid: 1.5, "Corporate batch": 2.5 }
      },
      lab: {
        domain: "lab",
        domainLabel: "Hands-on lab readiness",
        technique: "Practical lab exposure review",
        evidence: "Cisco, firewall, packet capture, cloud, or SOC lab exposure",
        action: "Prescribe labs before advanced security or cloud modules.",
        weight: 1.25,
        risks: { None: 5, Basic: 3.5, Intermediate: 2, Strong: 1 }
      },
      timeline: {
        domain: "intent",
        domainLabel: "Enrollment intent",
        technique: "Start timeline and counseling priority",
        evidence: "Joining date, demo class preference, counseling need",
        action: "Route immediate starts to counseling and demo class scheduling.",
        weight: 0.85,
        risks: { Immediately: 4, "This month": 3, "Next month": 2, Researching: 1 }
      }
    },
    ctas: {
      ...defaultCtas,
      critical: {
        label: "Book Career Counseling",
        href: "/institute",
        note: "The learner needs a structured path before choosing tools, certifications, or labs.",
        owner: "Institute counselor",
        responseWindow: "Same business day"
      },
      high: {
        label: "Schedule Demo Class",
        href: "/institute",
        note: "The learner is close to a route decision and should see the lab model.",
        owner: "Institute counselor",
        responseWindow: "1 business day"
      },
      medium: {
        label: "Send Career Roadmap",
        href: "/resources",
        note: "The learner needs comparison content and a practical roadmap before counseling.",
        owner: "Institute nurture",
        responseWindow: "2 business days"
      }
    }
  },
  "troubleshooting-triage": {
    method:
      "Network troubleshooting triage across business impact, duration, affected layer, recent changes, vendor support, and evidence availability.",
    frameworks: ["Incident triage", "Root cause analysis", "NIST CSF Respond and Recover"],
    evidencePack: [
      "Business impact and affected users",
      "Issue timeline",
      "Recent network or firewall changes",
      "Logs, packet captures, or screenshots",
      "ISP/vendor ticket status",
      "Rollback or backup availability"
    ],
    fields: {
      impact: {
        domain: "impact",
        domainLabel: "Business impact",
        technique: "Impact and blast-radius triage",
        evidence: "Users, sites, departments, affected applications",
        action: "Prioritize response by user impact and business function.",
        weight: 1.35,
        risks: { "Single user": 1, "Team affected": 3, "Site down": 5, "Multiple sites": 5 }
      },
      duration: {
        domain: "timeline",
        domainLabel: "Incident timeline",
        technique: "Timeline reconstruction",
        evidence: "First seen time, recurrence pattern, ticket timeline",
        action: "Reconstruct timeline and correlate with changes, alerts, and provider events.",
        weight: 1.05,
        risks: { "Under 1 hour": 4, Today: 4.5, "2-7 days": 3.5, Recurring: 4.2 }
      },
      area: {
        domain: "layer",
        domainLabel: "Likely failure layer",
        technique: "Layered fault isolation",
        evidence: "WAN, firewall, VPN, Wi-Fi, DNS, cloud app, or routing clues",
        action: "Isolate the failing layer before changing production configuration.",
        weight: 1,
        risks: { Internet: 3.2, "Firewall/VPN": 4, "Wi-Fi/LAN": 3.4, "Cloud app": 3.8, "Not sure": 4.3 }
      },
      changes: {
        domain: "change",
        domainLabel: "Recent change risk",
        technique: "Change correlation and rollback readiness",
        evidence: "Change tickets, config diffs, deployment notes",
        action: "Check recent changes and prepare a controlled rollback path.",
        weight: 1.25,
        risks: { No: 2, Maybe: 4, Yes: 5 }
      },
      vendor: {
        domain: "support",
        domainLabel: "Vendor and carrier support",
        technique: "Escalation path verification",
        evidence: "ISP ticket, vendor support contract, serial numbers",
        action: "Clarify vendor escalation so troubleshooting does not stall.",
        weight: 0.85,
        risks: { Yes: 2, No: 4.5, "Not sure": 3.5 }
      },
      logs: {
        domain: "evidence",
        domainLabel: "Evidence availability",
        technique: "Logs and packet evidence review",
        evidence: "Firewall logs, interface counters, packet capture, NMS alerts",
        action: "Collect logs and packet evidence before applying speculative fixes.",
        weight: 1.2,
        risks: { Yes: 1, Partial: 3, No: 5 }
      }
    },
    ctas: {
      ...defaultCtas,
      critical: {
        label: "Start Emergency Network Triage",
        href: "/services/network-troubleshooting",
        note: "Business impact is high, evidence is limited, or recent changes may have caused instability.",
        owner: "Emergency triage desk",
        responseWindow: "As soon as available"
      },
      high: {
        label: "Book Troubleshooting Session",
        href: "/services/network-troubleshooting",
        note: "The issue should move into structured RCA and remediation planning.",
        owner: "Network troubleshooting lead",
        responseWindow: "Same business day"
      }
    }
  }
};

function normalizedKey(value: unknown) {
  return String(value ?? "").trim();
}

function fallbackRisk(answer: string) {
  const text = answer.toLowerCase();
  if (["no", "none", "never", "not enabled", "not sure", "500+", "major", "site down", "multiple sites", "this week"].some((term) => text.includes(term))) {
    return 5;
  }
  if (["partial", "manual", "older", "maybe", "today", "101-500", "200-500"].some((term) => text.includes(term))) {
    return 3;
  }
  return 1.5;
}

function bandForScore(score: number): AssessmentBand {
  if (score >= 80) return "critical";
  if (score >= 62) return "high";
  if (score >= 38) return "medium";
  return "low";
}

function labelForBand(band: AssessmentBand) {
  if (band === "critical") return "Critical priority";
  if (band === "high") return "High priority";
  if (band === "medium") return "Medium priority";
  return "Low attention";
}

function severityForRisk(risk: number) {
  if (risk >= 4.5) return "Critical";
  if (risk >= 3.4) return "High";
  if (risk >= 2.2) return "Medium";
  return "Controlled";
}

export function getAssessmentFramework(slug: string) {
  return assessmentFrameworks[slug];
}

export function scoreAssessment(tool: AssessmentToolLike, answers: Record<string, unknown>): AssessmentResult {
  const framework = getAssessmentFramework(tool.slug);
  const domainMap = new Map<string, { label: string; risk: number; max: number; weight: number }>();
  const findings: AssessmentFinding[] = [];
  let weightedRisk = 0;
  let weightedMax = 0;

  for (const field of tool.fields) {
    const fieldModel = framework?.fields[field.name];
    const answer = normalizedKey(answers[field.name]);
    const weight = fieldModel?.weight ?? 1;
    const risk = fieldModel?.risks[answer] ?? fallbackRisk(answer);
    weightedRisk += risk * weight;
    weightedMax += 5 * weight;

    const domain = fieldModel?.domain ?? field.name;
    const domainLabel = fieldModel?.domainLabel ?? field.label;
    const current = domainMap.get(domain) ?? { label: domainLabel, risk: 0, max: 0, weight: 0 };
    current.risk += risk * weight;
    current.max += 5 * weight;
    current.weight += weight;
    domainMap.set(domain, current);

    findings.push({
      question: field.label,
      answer: answer || "Not answered",
      domain,
      domainLabel,
      severity: severityForRisk(risk),
      risk,
      technique: fieldModel?.technique ?? "Technical assessment",
      evidence: fieldModel?.evidence ?? "Assessment evidence",
      action: fieldModel?.action ?? "Validate the answer through discovery and technical review."
    });
  }

  const score = weightedMax ? Math.round((weightedRisk / weightedMax) * 100) : 0;
  const riskBand = bandForScore(score);
  const cta = framework?.ctas[riskBand] ?? defaultCtas[riskBand];
  const domainScores = Array.from(domainMap.entries())
    .map(([domain, value]) => {
      const domainScore = value.max ? Math.round((value.risk / value.max) * 100) : 0;
      return {
        domain,
        label: value.label,
        score: domainScore,
        maturity: Math.max(0, 100 - domainScore),
        weight: Math.round(value.weight * 100) / 100
      };
    })
    .sort((a, b) => b.score - a.score);

  const topFindings = findings
    .sort((a, b) => b.risk - a.risk)
    .slice(0, 3);

  const nextActions = [
    cta.note,
    ...topFindings.map((finding) => finding.action)
  ].filter(Boolean);

  const evidenceRequests = Array.from(
    new Set([...(framework?.evidencePack ?? []), ...topFindings.map((finding) => finding.evidence)])
  ).slice(0, 8);

  return {
    score,
    maturityScore: Math.max(0, 100 - score),
    riskBand,
    riskLevel: labelForBand(riskBand),
    recommendation: cta.label,
    pipeline: tool.pipeline,
    cta,
    domainScores,
    topFindings,
    nextActions,
    evidenceRequests,
    methodology: framework?.method ?? "Structured network assessment",
    frameworks: framework?.frameworks ?? []
  };
}
