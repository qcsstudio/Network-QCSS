import {
  Activity,
  BookOpen,
  BrainCircuit,
  BriefcaseBusiness,
  Cloud,
  LockKeyhole,
  Radar,
  Router,
  ShieldCheck,
  Siren,
  Wifi,
  Zap
} from "lucide-react";

export const siteConfig = {
  name: "QuantumCrafters Studio Pvt. Ltd.",
  title: "QuantumCrafters Studio - Network Operations, Security, Cloud and Training",
  url: process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000",
  description:
    "Network command studio for managed network services, network security, cloud networking, penetration testing, troubleshooting, and practical network security training."
};

export const positioning = {
  eyebrow: "Network command studio for India and global teams",
  headline: "Operate, secure, test, and teach networks from one engineering-led system.",
  body:
    "QuantumCrafters Studio Pvt. Ltd. turns network chaos into a measurable operating system: monitoring, firewall hygiene, cloud connectivity, penetration testing, emergency troubleshooting, and hands-on institute programs connected to one growth and delivery layer.",
  primaryCta: "Run Network Risk Score",
  secondaryCta: "Explore Service System"
};

export const proofSignals = [
  { value: "24x7", label: "NOC-ready monitoring model" },
  { value: "5", label: "Operate, secure, monitor, test, train" },
  { value: "100%", label: "Consent-aware lead intelligence" },
  { value: "1", label: "Studio for services and institute" }
];

export const marketEdges = [
  {
    title: "Smaller than an enterprise MSP, sharper than a freelancer",
    description:
      "Large providers sell scale. We sell accountable engineering, fast triage, and visible operating discipline for growing teams."
  },
  {
    title: "Security testing connected to remediation",
    description:
      "Pentest findings should not become a PDF graveyard. Our flow connects assessment, firewall hygiene, segmentation, retesting, and owner-ready action."
  },
  {
    title: "Training powered by real service work",
    description:
      "The institute is not separated from operations. Learners and corporate teams train on the same problems networks face in production."
  }
];

export const contentPillars = [
  {
    title: "Managed Network Services India",
    description: "NOC, device monitoring, backups, uptime reporting, change discipline, and multi-site support."
  },
  {
    title: "Network Security and Firewall Hygiene",
    description: "Firewall cleanup, VPN hardening, segmentation, ZTNA/SASE readiness, logging, and audit preparation."
  },
  {
    title: "Cloud Network Services",
    description: "AWS VPC, Azure VNet, Google Cloud VPC, hybrid VPN, route design, exposure review, and cloud logs."
  },
  {
    title: "Penetration Testing and Retesting",
    description: "External, internal, web, API, cloud, and wireless testing with remediation support and retest workflow."
  },
  {
    title: "Network Security Institute",
    description: "CCNA, CCNP, firewall, cloud networking, SOC, ethical hacking, and corporate network security training."
  },
  {
    title: "Emergency Network Troubleshooting",
    description: "Outage triage, latency, packet analysis, VPN failures, firewall routing, Wi-Fi instability, and RCA."
  }
];

export const operatingModes = [
  {
    title: "Build",
    description: "LAN/WAN, SD-WAN, managed Wi-Fi, routing, cloud connectivity, and branch architecture with documentation.",
    icon: Router,
    href: "/services/managed-network-services"
  },
  {
    title: "Secure",
    description: "Firewall hygiene, segmentation, ZTNA, SASE, VPN modernization, logging, and incident readiness.",
    icon: ShieldCheck,
    href: "/services/network-security-services"
  },
  {
    title: "Monitor",
    description: "NOC workflows, uptime monitoring, change tracking, device backups, reporting, and escalation discipline.",
    icon: Radar,
    href: "/services/noc-as-a-service"
  },
  {
    title: "Test",
    description: "External, internal, API, web, wireless, and cloud penetration testing with retesting support.",
    icon: LockKeyhole,
    href: "/services/penetration-testing"
  },
  {
    title: "Train",
    description: "Institute tracks for CCNA, CCNP, firewalls, cloud networking, SOC, and ethical hacking labs.",
    icon: BookOpen,
    href: "/institute"
  }
];

export const services = [
  {
    slug: "managed-network-services",
    title: "Managed Network Services",
    kicker: "Operate",
    summary:
      "Run office, branch, campus, and remote-team networks with monitoring, change control, device backups, documentation, and monthly evidence.",
    outcomes: ["Improved uptime", "Faster RCA", "Documented network state", "Predictable support"],
    cta: "Get Network Risk Score",
    icon: Activity,
    tool: "network-risk-score"
  },
  {
    slug: "network-security-services",
    title: "Network Security Services",
    kicker: "Secure",
    summary:
      "Harden firewalls, VPNs, remote access, segmentation, logs, DNS, email pathways, and Zero Trust readiness.",
    outcomes: ["Cleaner firewall rules", "Reduced remote-access risk", "Audit-ready evidence", "Better segmentation"],
    cta: "Check Firewall Hygiene",
    icon: ShieldCheck,
    tool: "firewall-hygiene"
  },
  {
    slug: "cloud-network-services",
    title: "Cloud Network Services",
    kicker: "Cloud",
    summary:
      "Design and secure AWS VPC, Azure VNet, Google Cloud VPC, site-to-site VPN, routing, private access, and public exposure.",
    outcomes: ["Cloud visibility", "Safer public exposure", "Cleaner routing", "Cost-aware connectivity"],
    cta: "Review Cloud Network",
    icon: Cloud,
    tool: "cloud-readiness"
  },
  {
    slug: "penetration-testing",
    title: "Penetration Testing",
    kicker: "Test",
    summary:
      "Scope and perform external, internal, web, API, cloud, and wireless penetration testing with remediation guidance and retesting.",
    outcomes: ["Clear scope", "Risk-ranked findings", "Retesting path", "Client-ready reports"],
    cta: "Run Pentest Readiness",
    icon: LockKeyhole,
    tool: "pentest-readiness"
  },
  {
    slug: "network-troubleshooting",
    title: "Network Troubleshooting",
    kicker: "Troubleshoot",
    summary:
      "Resolve outages, slow applications, VPN failures, firewall routing issues, Wi-Fi instability, and cloud connectivity incidents.",
    outcomes: ["Issue triage", "Packet-level analysis", "Vendor-aware escalation", "Prevention plan"],
    cta: "Start Triage",
    icon: Siren,
    tool: "troubleshooting-triage"
  },
  {
    slug: "noc-as-a-service",
    title: "NOC as a Service",
    kicker: "Monitor",
    summary:
      "Add monitoring, alert triage, escalation, monthly reporting, and network governance around existing infrastructure.",
    outcomes: ["Central alerting", "Escalation workflows", "Monthly evidence", "Device inventory"],
    cta: "Design NOC Workflow",
    icon: Radar,
    tool: "network-risk-score"
  },
  {
    slug: "firewall-management",
    title: "Firewall Management",
    kicker: "Govern",
    summary:
      "Review, clean, document, and manage firewall policies, VPN users, admin access, logging, and config backups.",
    outcomes: ["Rule cleanup", "Safer admin access", "Config backups", "Change logs"],
    cta: "Check Firewall Hygiene",
    icon: LockKeyhole,
    tool: "firewall-hygiene"
  },
  {
    slug: "managed-wifi-lan",
    title: "Managed Wi-Fi and LAN",
    kicker: "Stabilize",
    summary:
      "Plan, stabilize, secure, and monitor Wi-Fi and wired LAN for schools, offices, hospitals, hotels, and warehouses.",
    outcomes: ["Better roaming", "VLAN design", "Device visibility", "Stable user experience"],
    cta: "Assess Wi-Fi and LAN",
    icon: Wifi,
    tool: "network-risk-score"
  }
];

export const tools = [
  {
    slug: "network-risk-score",
    title: "Network Risk Score",
    category: "Managed network services",
    pipeline: "Managed Network Services",
    recommendation: "Free Network Risk Review",
    description: "Score uptime, monitoring, firewall age, remote access, incidents, and documentation quality.",
    fields: [
      { name: "users", label: "How many users?", options: ["1-25", "26-100", "101-500", "500+"] },
      { name: "sites", label: "How many locations?", options: ["1", "2-5", "6-20", "20+"] },
      { name: "monitoring", label: "Do you have active monitoring?", options: ["Yes", "Partial", "No"] },
      { name: "firewall", label: "Firewall review status", options: ["Reviewed recently", "Not sure", "Over 12 months"] },
      { name: "mfa", label: "VPN or remote access MFA?", options: ["Enabled", "Partial", "Not enabled"] },
      { name: "incident", label: "Recent outage or incident?", options: ["No", "Minor", "Major"] }
    ]
  },
  {
    slug: "firewall-hygiene",
    title: "Firewall Hygiene Checker",
    category: "Network security",
    pipeline: "Network Security",
    recommendation: "Firewall Hygiene Sprint",
    description: "Assess rule sprawl, broad allow rules, logs, admin access, VPN users, and config backup health.",
    fields: [
      { name: "vendor", label: "Firewall vendor", options: ["Fortinet", "Palo Alto", "Cisco", "Sophos", "Other"] },
      { name: "rules", label: "Rule count", options: ["Under 50", "50-200", "200-500", "500+"] },
      { name: "anyRules", label: "Any broad allow rules?", options: ["No", "Not sure", "Yes"] },
      { name: "logging", label: "Traffic/security logs enabled?", options: ["Yes", "Partial", "No"] },
      { name: "backup", label: "Config backup process?", options: ["Automated", "Manual", "None"] },
      { name: "admin", label: "Admin access protected?", options: ["MFA and restricted", "Password only", "Not sure"] }
    ]
  },
  {
    slug: "pentest-readiness",
    title: "Pentest Readiness",
    category: "Penetration testing",
    pipeline: "Penetration Testing",
    recommendation: "Pentest Scope Call",
    description: "Qualify asset type, scope clarity, timeline, reason, previous testing, and retesting need.",
    fields: [
      { name: "asset", label: "Asset type", options: ["External network", "Web app", "API", "Cloud", "Wi-Fi", "Internal network"] },
      { name: "scope", label: "Is the scope defined?", options: ["Yes", "Partial", "No"] },
      { name: "timeline", label: "Target timeline", options: ["This week", "This month", "This quarter", "Exploring"] },
      { name: "reason", label: "Reason", options: ["Client requirement", "Compliance", "Launch", "Internal review"] },
      { name: "previous", label: "Previous test?", options: ["Within 12 months", "Older", "Never"] },
      { name: "retest", label: "Need retesting?", options: ["Yes", "Maybe", "No"] }
    ]
  },
  {
    slug: "cloud-readiness",
    title: "Cloud Network Readiness",
    category: "Cloud network services",
    pipeline: "Cloud Network Services",
    recommendation: "Cloud Network Security Review",
    description: "Check VPC/VNet structure, hybrid connectivity, exposure, logs, segmentation, and cost-performance friction.",
    fields: [
      { name: "provider", label: "Primary cloud provider", options: ["AWS", "Azure", "Google Cloud", "Multi-cloud", "Not sure"] },
      { name: "connectivity", label: "Hybrid connectivity", options: ["Direct/private", "Site-to-site VPN", "Public internet", "None"] },
      { name: "segmentation", label: "Cloud segmentation", options: ["Documented", "Partial", "Flat/unclear"] },
      { name: "exposure", label: "Public exposure reviewed?", options: ["Recently", "Not sure", "Never"] },
      { name: "logs", label: "Network/security logs", options: ["Centralized", "Partial", "No"] },
      { name: "issue", label: "Main issue", options: ["Security", "Cost", "Performance", "Migration"] }
    ]
  },
  {
    slug: "career-path-finder",
    title: "Career Path Finder",
    category: "Institute and training",
    pipeline: "Training / Institute",
    recommendation: "Demo Class and Counseling",
    description: "Route students and professionals to the right network security learning path.",
    fields: [
      { name: "level", label: "Current level", options: ["Beginner", "Basic networking", "Working professional", "Advanced"] },
      { name: "goal", label: "Career goal", options: ["Network engineer", "Security engineer", "SOC analyst", "Pentester", "Cloud network engineer"] },
      { name: "time", label: "Weekly study time", options: ["2-4 hours", "5-8 hours", "9-15 hours", "15+ hours"] },
      { name: "mode", label: "Learning mode", options: ["Online", "Classroom", "Hybrid", "Corporate batch"] },
      { name: "lab", label: "Hands-on lab experience", options: ["None", "Basic", "Intermediate", "Strong"] },
      { name: "timeline", label: "Start timeline", options: ["Immediately", "This month", "Next month", "Researching"] }
    ]
  },
  {
    slug: "troubleshooting-triage",
    title: "Troubleshooting Triage",
    category: "Emergency support",
    pipeline: "Troubleshooting / Emergency",
    recommendation: "Emergency Network Triage",
    description: "Route outage, latency, VPN, firewall, Wi-Fi, and cloud connectivity issues by urgency.",
    fields: [
      { name: "impact", label: "Business impact", options: ["Single user", "Team affected", "Site down", "Multiple sites"] },
      { name: "duration", label: "Issue duration", options: ["Under 1 hour", "Today", "2-7 days", "Recurring"] },
      { name: "area", label: "Likely area", options: ["Internet", "Firewall/VPN", "Wi-Fi/LAN", "Cloud app", "Not sure"] },
      { name: "changes", label: "Recent changes?", options: ["No", "Maybe", "Yes"] },
      { name: "vendor", label: "Vendor support available?", options: ["Yes", "No", "Not sure"] },
      { name: "logs", label: "Logs or packet capture available?", options: ["Yes", "Partial", "No"] }
    ]
  }
];

export const resources = [
  { title: "Firewall Rule Cleanup Checklist", type: "Checklist", slug: "firewall-rule-cleanup" },
  { title: "Cloud Network Readiness Guide", type: "Guide", slug: "cloud-network-readiness" },
  { title: "Penetration Testing Scope Sheet", type: "Template", slug: "pentest-scope-sheet" },
  { title: "Network Security Engineer Roadmap", type: "Career", slug: "network-security-career-roadmap" }
];

export const automationFlows = [
  { title: "Lead capture", description: "Forms, tools, WhatsApp, calls, and resource downloads become structured lead records.", icon: BriefcaseBusiness },
  { title: "Consent-aware tracking", description: "Analytics and marketing events activate only when visitor consent allows it.", icon: ShieldCheck },
  { title: "Lead scoring", description: "Intent, fit, urgency, and tool answers determine priority and follow-up timing.", icon: BrainCircuit },
  { title: "Workflow routing", description: "Managed services, pentesting, emergency support, training, and corporate leads route separately.", icon: Zap }
];
