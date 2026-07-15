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
  title: "QuantumCrafters Studio - Network Command, Security, Cloud and Training",
  url: process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000",
  description:
    "Evidence-first network command studio for managed network services, network security, cloud networking, SASE readiness, penetration testing, troubleshooting, and practical network security training."
};

export const positioning = {
  eyebrow: "Network command studio for India and global teams",
  headline: "Diagnose, secure, operate, and train modern networks with evidence you can act on.",
  body:
    "QuantumCrafters Studio Pvt. Ltd. helps growing companies stabilize infrastructure, harden security, modernize cloud connectivity, test exposure, and build network talent through one measurable operating system.",
  primaryCta: "Run Network Assessment",
  secondaryCta: "Explore Command System"
};

export const proofSignals = [
  { value: "6", label: "Guided network readiness checks" },
  { value: "24x7", label: "NOC and incident-response operating model" },
  { value: "30+", label: "Service, tool, and resource paths" },
  { value: "1", label: "Operate, secure, test, and train model" }
];

export const commandNavItems = [
  { label: "Solutions", href: "/solutions" },
  { label: "Services", href: "/#services" },
  { label: "Assessments", href: "/diagnose" },
  { label: "Tools", href: "/network-tools" },
  { label: "Institute", href: "/institute" },
  { label: "Resources", href: "/resources" }
];

export const commandLayers = [
  {
    title: "Diagnose",
    description:
      "Guided checks for outages, firewall drift, cloud exposure, pentest readiness, SASE maturity, and training path fit.",
    icon: Radar
  },
  {
    title: "Operate",
    description:
      "Managed network services, NOC workflows, device inventory, backups, change control, uptime review, and escalation discipline.",
    icon: Activity
  },
  {
    title: "Secure",
    description:
      "Firewall hygiene, segmentation, VPN hardening, Zero Trust/SASE readiness, logs, retesting, and audit-ready evidence.",
    icon: ShieldCheck
  },
  {
    title: "Modernize",
    description:
      "Cloud networking, SD-WAN direction, hybrid connectivity, private access, public exposure review, and AI-workload readiness.",
    icon: Cloud
  },
  {
    title: "Train",
    description:
      "Network and security institute programs for CCNA, CCNP, firewalls, cloud networking, SOC, ethical hacking, and corporate teams.",
    icon: BookOpen
  }
];

export const researchSignals = [
  {
    title: "Networks are becoming business-critical AI infrastructure",
    description:
      "NaaS, SD-WAN, SASE, cloud connectivity, and observability are becoming the foundation for distributed teams, SaaS dependency, and AI-era workloads."
  },
  {
    title: "Buyers want evidence, not vague IT support",
    description:
      "Managed network providers lead with monitoring, lifecycle services, NOC depth, security integration, and reporting. QCS should answer with visible diagnostics and actionable outputs."
  },
  {
    title: "Search and AI visibility reward useful, structured answers",
    description:
      "Modern buyers compare answers before they book calls, so every page should explain the problem, the method, and the practical next step."
  }
];

export const visualPositioningModules = [
  {
    title: "Command room, not brochure",
    description:
      "The experience should feel clear to buyers while guiding them toward the right diagnostic, service, or training path."
  },
  {
    title: "Global trust with Indian execution",
    description:
      "Position QCS for Indian businesses, GCC teams, global remote companies, institutes, and teams that need accountable network/security expertise without enterprise MSP complexity."
  },
  {
    title: "Training becomes proof of depth",
    description:
      "The institute gives QCS a talent and authority angle: the same problems handled in services become labs, roadmaps, and corporate upskilling."
  }
];

export const marketEdges = [
  {
    title: "Sharper than a generic MSP",
    description:
      "Large providers sell scale. QCS should sell diagnostic clarity, senior engineering thinking, faster decision paths, and visible operating discipline."
  },
  {
    title: "More complete than a pentest-only vendor",
    description:
      "Testing is connected to remediation, firewall governance, segmentation, retesting, training, and recurring support."
  },
  {
    title: "More practical than a course-only institute",
    description:
      "Training is anchored in real network operations, firewall hygiene, cloud exposure, incident response, and hands-on troubleshooting."
  }
];

export const buyerJourneys = [
  {
    title: "IT Head or Founder",
    description:
      "Needs uptime, documentation, firewall confidence, and a partner who can convert vague network pain into a controlled action plan.",
    route: "Managed Network Services, NOC as a Service, Troubleshooting"
  },
  {
    title: "Security or Compliance Buyer",
    description:
      "Needs penetration testing, firewall cleanup, cloud exposure visibility, access hardening, and retesting evidence.",
    route: "Network Security, Firewall Management, Pentest and Retesting"
  },
  {
    title: "Cloud or Hybrid Team",
    description:
      "Needs VPC/VNet routing clarity, site-to-site VPN, private access, SASE/Zero Trust direction, and public exposure review.",
    route: "Cloud Network Services, SASE Readiness, Managed Connectivity"
  },
  {
    title: "Student or Working Professional",
    description:
      "Needs a practical path into network engineering, cybersecurity, SOC, cloud networking, firewall administration, or ethical hacking.",
    route: "Institute, Career Path Finder, Lab-led Programs"
  }
];

export const supportModelComparison = {
  old: {
    label: "Reactive model",
    title: "What most networks suffer from",
    items: [
      "Break-fix support after users complain",
      "Firewall rules added without review",
      "VPN and routing issues fixed temporarily",
      "No clear change documentation",
      "Vendor dependency during emergencies",
      "Fragmented monitoring and ownership"
    ]
  },
  qcs: {
    label: "QCS command model",
    title: "What the QCS model creates",
    items: [
      "Assessment before configuration changes",
      "Service paths mapped to buyer problems",
      "Free tools that help validate symptoms",
      "Evidence checklists before engineering calls",
      "Clear readiness snapshots",
      "Training paths connected to real operations"
    ]
  }
};

export const vendorCoverage = [
  "Cisco",
  "Fortinet / FortiGate",
  "Palo Alto Networks",
  "Sophos",
  "SonicWall",
  "Juniper",
  "Aruba / HPE",
  "Ubiquiti",
  "MikroTik",
  "Check Point",
  "AWS",
  "Azure",
  "Google Cloud",
  "Cloudflare One",
  "Microsoft 365",
  "Google Workspace"
];

export const industryCoverage = [
  "Corporate offices",
  "IT and SaaS companies",
  "Manufacturing units",
  "Warehouses and logistics",
  "Hospitals and clinics",
  "Schools and colleges",
  "Hotels and hospitality",
  "Retail chains",
  "Multi-branch businesses",
  "Cloud-first teams",
  "Managed service partners"
];

export const deliveryWorkflow = [
  {
    title: "Discover",
    description: "Capture business impact, topology, current controls, recent changes, ownership, and urgency."
  },
  {
    title: "Diagnose",
    description: "Use assessment results, public tools, logs, configs, routes, and evidence to identify the real problem path."
  },
  {
    title: "Design",
    description: "Prepare remediation, migration, testing, rollback, and monitoring steps before production changes."
  },
  {
    title: "Deliver",
    description: "Implement controlled changes, validate results, document evidence, and set next review actions."
  },
  {
    title: "Develop",
    description: "Turn repeated issues into managed services, training labs, playbooks, and content that compounds authority."
  }
];

export const operatingModes = [
  {
    title: "Operate",
    description: "LAN/WAN, SD-WAN direction, Wi-Fi, routing, monitoring, device backups, documentation, and support governance.",
    icon: Router,
    href: "/services/managed-network-services"
  },
  {
    title: "Secure",
    description: "Firewall hygiene, segmentation, remote access, logs, SASE readiness, incident playbooks, and audit evidence.",
    icon: ShieldCheck,
    href: "/services/network-security-services"
  },
  {
    title: "Monitor",
    description: "NOC workflows, uptime and alert review, escalation paths, monthly reporting, and network ownership cadence.",
    icon: Radar,
    href: "/services/noc-as-a-service"
  },
  {
    title: "Test",
    description: "External, internal, API, web, cloud, and wireless penetration testing with remediation and retesting support.",
    icon: LockKeyhole,
    href: "/services/penetration-testing"
  },
  {
    title: "Train",
    description: "Role-based institute tracks for network engineering, firewalls, cloud networking, SOC, and ethical hacking.",
    icon: BookOpen,
    href: "/institute"
  }
];

export const services = [
  {
    slug: "managed-network-services",
    title: "Managed Network Services",
    metaTitle: "Managed Network Services for India and Global Teams",
    metaDescription:
      "Managed network services for office, branch, cloud-connected and multi-site teams: monitoring, backups, documentation, change control, RCA and support workflows.",
    kicker: "Operate",
    summary:
      "Run office, branch, campus, and remote-team networks with monitoring, change control, device backups, documentation, and monthly evidence.",
    bestFor: "Companies that rely on stable internet, VPN, Wi-Fi, firewall, branch, and cloud connectivity but lack consistent network ownership.",
    proof:
      "The engagement turns network state into an operating record: inventory, topology, alerts, changes, backups, incidents, and recurring review.",
    outcomes: ["Improved uptime", "Faster RCA", "Documented network state", "Predictable support"],
    buyerTriggers: ["Recurring outages", "No topology documentation", "Unknown firewall changes", "Multi-site growth", "Vendor dependency"],
    scope: ["Device and circuit inventory", "Monitoring and alert review", "Configuration backup plan", "Change log discipline", "Monthly health reporting"],
    deliverables: ["Network state report", "Risk and improvement backlog", "Escalation matrix", "Backup evidence", "Monthly review summary"],
    faqs: [
      {
        question: "What is included in managed network services?",
        answer:
          "Managed network services can include monitoring, device inventory, firewall and VPN review, configuration backup, incident response, change documentation, reporting, and improvement planning."
      },
      {
        question: "Can QCS support a mixed-vendor network?",
        answer:
          "Yes. The model is designed for mixed environments across Cisco, Fortinet, Palo Alto, Sophos, Aruba, Ubiquiti, MikroTik, AWS, Azure, Google Cloud, and related platforms."
      }
    ],
    cta: "Get Network Risk Score",
    icon: Activity,
    tool: "network-risk-score"
  },
  {
    slug: "network-security-services",
    title: "Network Security Services",
    metaTitle: "Network Security Services, Firewall Hygiene and SASE Readiness",
    metaDescription:
      "Network security services for firewalls, VPNs, segmentation, logs, DNS/email security, SASE readiness, and audit-ready evidence.",
    kicker: "Secure",
    summary:
      "Harden firewalls, VPNs, remote access, segmentation, logs, DNS, email pathways, and Zero Trust readiness.",
    bestFor: "IT leaders and security teams that need practical hardening without turning every finding into a large enterprise program.",
    proof:
      "Security work is framed around exposure, access, visibility, response, and remediation evidence rather than tool names alone.",
    outcomes: ["Cleaner firewall rules", "Reduced remote-access risk", "Audit-ready evidence", "Better segmentation"],
    buyerTriggers: ["Broad allow rules", "No MFA on VPN", "Missing logs", "Flat network", "Audit pressure", "Email spoofing concerns"],
    scope: ["Firewall rule review", "VPN and admin access hardening", "Segmentation design", "Log and alert review", "SASE/Zero Trust roadmap"],
    deliverables: ["Security posture summary", "Firewall cleanup list", "Remote access risk notes", "Evidence checklist", "Remediation roadmap"],
    faqs: [
      {
        question: "Do network security services replace a SOC?",
        answer:
          "Not always. QCS can help prepare the network layer for SOC/MDR by cleaning firewall rules, improving logging, hardening access, and creating incident-ready evidence."
      },
      {
        question: "What is SASE readiness?",
        answer:
          "SASE readiness checks whether SD-WAN, ZTNA, SWG, CASB, FWaaS, remote access, logging, and identity controls are mature enough for a secure cloud-delivered network model."
      }
    ],
    cta: "Check Firewall Hygiene",
    icon: ShieldCheck,
    tool: "firewall-hygiene"
  },
  {
    slug: "cloud-network-services",
    title: "Cloud Network Services",
    metaTitle: "Cloud Network Services for AWS, Azure, Google Cloud and Hybrid Teams",
    metaDescription:
      "Cloud network services for VPC, VNet, hybrid VPN, routing, security groups, public exposure, cloud logs, SASE direction and migration readiness.",
    kicker: "Cloud",
    summary:
      "Design and secure AWS VPC, Azure VNet, Google Cloud VPC, site-to-site VPN, routing, private access, and public exposure.",
    bestFor: "Teams moving workloads to cloud or connecting offices, users, vendors, and applications across hybrid environments.",
    proof:
      "The work focuses on route intent, exposure, segmentation, logs, identity-aware access, and performance instead of isolated cloud settings.",
    outcomes: ["Cloud visibility", "Safer public exposure", "Cleaner routing", "Cost-aware connectivity"],
    buyerTriggers: ["Unknown public IPs", "Flat cloud networks", "VPN instability", "Migration pressure", "Cloud app latency", "No flow logs"],
    scope: ["VPC/VNet review", "Route and subnet mapping", "Security group/NSG review", "Hybrid VPN design", "Flow log and exposure review"],
    deliverables: ["Cloud network map", "Exposure inventory", "Segmentation recommendations", "Connectivity risk notes", "Cloud readiness backlog"],
    faqs: [
      {
        question: "Can QCS review an existing cloud network?",
        answer:
          "Yes. The review can inspect VPC/VNet structure, subnets, routes, security groups, VPNs, public IPs, load balancers, flow logs, and cloud connectivity risks."
      },
      {
        question: "Does cloud network work include security?",
        answer:
          "Yes. Cloud networking and security overlap through routes, public exposure, segmentation, private access, security groups, logging, and identity-aware access."
      }
    ],
    cta: "Review Cloud Network",
    icon: Cloud,
    tool: "cloud-readiness"
  },
  {
    slug: "penetration-testing",
    title: "Penetration Testing and Retesting",
    metaTitle: "Penetration Testing, Remediation Support and Retesting",
    metaDescription:
      "Penetration testing for external networks, web apps, APIs, cloud and wireless environments with scoping, remediation support and retesting workflow.",
    kicker: "Test",
    summary:
      "Scope and perform external, internal, web, API, cloud, and wireless penetration testing with remediation guidance and retesting.",
    bestFor: "Teams that need credible security testing for client requirements, compliance, product launch, audit readiness, or internal assurance.",
    proof:
      "Pentesting is connected to remediation and retesting so findings become decisions, fixes, and proof instead of a static PDF.",
    outcomes: ["Clear scope", "Risk-ranked findings", "Retesting path", "Client-ready reports"],
    buyerTriggers: ["Client security questionnaire", "Launch deadline", "No previous testing", "Open vulnerabilities", "Compliance pressure"],
    scope: ["Rules of engagement", "External/internal testing", "Web/API testing", "Cloud/wireless testing", "Retesting and closure evidence"],
    deliverables: ["Scope sheet", "Risk-ranked report", "Remediation checklist", "Retest certificate or summary", "Executive explanation"],
    faqs: [
      {
        question: "What should be prepared before a penetration test?",
        answer:
          "Prepare asset lists, authorization contacts, testing windows, exclusions, previous reports, emergency contacts, and business context for the report audience."
      },
      {
        question: "Why is retesting important?",
        answer:
          "Retesting validates whether fixes actually reduce exposure and gives clients or auditors evidence that findings were handled."
      }
    ],
    cta: "Run Pentest Readiness",
    icon: LockKeyhole,
    tool: "pentest-readiness"
  },
  {
    slug: "network-troubleshooting",
    title: "Emergency Network Troubleshooting",
    metaTitle: "Emergency Network Troubleshooting for Outages, VPN, Firewall and Wi-Fi Issues",
    metaDescription:
      "Emergency network troubleshooting for outages, latency, VPN failures, firewall routing, Wi-Fi instability, cloud connectivity and RCA.",
    kicker: "Troubleshoot",
    summary:
      "Resolve outages, slow applications, VPN failures, firewall routing issues, Wi-Fi instability, and cloud connectivity incidents.",
    bestFor: "Teams facing business-impacting network symptoms where vendor calls, random changes, or temporary fixes are not enough.",
    proof:
      "Troubleshooting starts with impact, timeline, recent changes, logs, packet evidence, and rollback readiness before touching production.",
    outcomes: ["Issue triage", "Packet-level analysis", "Vendor-aware escalation", "Prevention plan"],
    buyerTriggers: ["Site down", "VPN users blocked", "Wi-Fi unstable", "Cloud app slow", "Recent firewall change", "No RCA"],
    scope: ["Impact triage", "Layered fault isolation", "Log and packet evidence review", "Vendor escalation", "RCA and prevention plan"],
    deliverables: ["Incident notes", "Root-cause hypothesis", "Action log", "Stabilization plan", "Post-incident recommendations"],
    faqs: [
      {
        question: "What information helps emergency troubleshooting?",
        answer:
          "Affected users, start time, recent changes, error screenshots, firewall logs, ISP ticket status, packet captures, monitoring alerts, and known rollback options."
      },
      {
        question: "Can QCS help after the incident is fixed?",
        answer:
          "Yes. After stabilization, the incident can be converted into documentation, monitoring, firewall cleanup, backup checks, and a managed support plan."
      }
    ],
    cta: "Start Triage",
    icon: Siren,
    tool: "troubleshooting-triage"
  },
  {
    slug: "noc-as-a-service",
    title: "NOC as a Service",
    metaTitle: "NOC as a Service for Monitoring, Alerts, Escalation and Reporting",
    metaDescription:
      "NOC as a Service for alert review, device health, escalation workflows, uptime monitoring, monthly evidence, and network operations reporting.",
    kicker: "Monitor",
    summary:
      "Add monitoring, alert triage, escalation, monthly reporting, and network governance around existing infrastructure.",
    bestFor: "Organizations that need network visibility and escalation discipline without building a full in-house NOC.",
    proof:
      "NOC value is created through useful alert tuning, owners, thresholds, escalation paths, review cycles, and reduction of repeat incidents.",
    outcomes: ["Central alerting", "Escalation workflows", "Monthly evidence", "Device inventory"],
    buyerTriggers: ["No central monitoring", "Alerts ignored", "No SLA path", "Repeat incidents", "No health reporting"],
    scope: ["Monitoring baseline", "Alert tuning", "Device health review", "Escalation matrix", "Monthly reporting"],
    deliverables: ["NOC readiness report", "Alert catalogue", "Escalation workflow", "Monthly health report", "Improvement backlog"],
    faqs: [
      {
        question: "What is NOC as a Service?",
        answer:
          "NOC as a Service gives organizations monitoring, alert review, escalation, reporting, and network operations support without building an internal 24x7 operations team."
      },
      {
        question: "Can NOC services work with existing tools?",
        answer:
          "Yes. QCS can work with existing monitoring tools or help define a practical monitoring baseline if no mature toolset exists."
      }
    ],
    cta: "Design NOC Workflow",
    icon: Radar,
    tool: "network-risk-score"
  },
  {
    slug: "firewall-management",
    title: "Firewall Management",
    metaTitle: "Firewall Management, Rule Cleanup, VPN and Admin Access Review",
    metaDescription:
      "Firewall management for rule cleanup, VPN users, admin access, logging, policy ownership, configuration backups, and change governance.",
    kicker: "Govern",
    summary:
      "Review, clean, document, and manage firewall policies, VPN users, admin access, logging, and config backups.",
    bestFor: "Businesses whose firewall policy has grown through years of urgent changes, vendor edits, unclear owners, or missing documentation.",
    proof:
      "Firewall work is prioritized by exposure, hit counts, owner clarity, logging, remote access, admin controls, and backup recoverability.",
    outcomes: ["Rule cleanup", "Safer admin access", "Config backups", "Change logs"],
    buyerTriggers: ["500+ rules", "Any-any rules", "No config backups", "Password-only admin", "VPN user sprawl"],
    scope: ["Policy review", "Object cleanup", "VPN user review", "Admin hardening", "Backup and logging review"],
    deliverables: ["Rule risk register", "Cleanup roadmap", "Admin access notes", "Backup evidence", "Change governance template"],
    faqs: [
      {
        question: "How often should firewall rules be reviewed?",
        answer:
          "High-change environments should review firewall policy regularly, with deeper reviews after major projects, audits, incidents, migrations, or ownership changes."
      },
      {
        question: "Can cleanup be done without breaking production?",
        answer:
          "A careful cleanup uses exports, hit counts, owner validation, staged changes, rollback plans, and maintenance windows to reduce unnecessary disruption."
      }
    ],
    cta: "Check Firewall Hygiene",
    icon: LockKeyhole,
    tool: "firewall-hygiene"
  },
  {
    slug: "managed-wifi-lan",
    title: "Managed Wi-Fi and LAN",
    metaTitle: "Managed Wi-Fi and LAN Services for Offices, Campuses and Branches",
    metaDescription:
      "Managed Wi-Fi and LAN services for offices, schools, hospitals, hotels, warehouses and branches: VLANs, roaming, access points, switching and stability.",
    kicker: "Stabilize",
    summary:
      "Plan, stabilize, secure, and monitor Wi-Fi and wired LAN for schools, offices, hospitals, hotels, and warehouses.",
    bestFor: "Sites where users complain about unstable Wi-Fi, slow LAN, poor roaming, unknown switches, or unclear VLAN/security design.",
    proof:
      "LAN/Wi-Fi work connects user experience, RF reality, switching, VLANs, authentication, monitoring, and support ownership.",
    outcomes: ["Better roaming", "VLAN design", "Device visibility", "Stable user experience"],
    buyerTriggers: ["Wi-Fi complaints", "Unknown cabling or switches", "Flat LAN", "Guest access risk", "Warehouse or campus coverage issues"],
    scope: ["Wi-Fi/LAN assessment", "VLAN and switching review", "Access point placement review", "Guest and staff separation", "Monitoring plan"],
    deliverables: ["LAN/Wi-Fi state report", "Coverage notes", "VLAN recommendations", "Access control checklist", "Improvement roadmap"],
    faqs: [
      {
        question: "Does managed Wi-Fi include security?",
        answer:
          "Yes. Managed Wi-Fi should include segmentation, guest isolation, admin access protection, firmware review, authentication, and visibility into connected devices."
      },
      {
        question: "Can QCS help with warehouses and campuses?",
        answer:
          "Yes. The approach can support offices, schools, clinics, hotels, warehouses, and campus environments with practical assessment and design recommendations."
      }
    ],
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
    recommendation: "Network Risk Review",
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

export const solutionPages = [
  {
    slug: "network-outage-response",
    title: "Network Outage Response",
    metaTitle: "Network Outage Response, RCA and Stabilization",
    metaDescription:
      "Structured network outage response for site down, VPN failure, firewall routing, ISP escalation, Wi-Fi outage and recurring instability.",
    eyebrow: "Troubleshooting solution",
    answer:
      "Network outage response should start with business impact, timeline, recent changes, logs, path testing, rollback readiness, and a written stabilization plan.",
    problem:
      "Most outages become expensive because teams jump between ISP, firewall, switch, Wi-Fi, DNS, and cloud vendors without a single triage owner.",
    outcomes: ["Faster isolation", "Cleaner escalation", "RCA notes", "Prevention backlog"],
    services: ["network-troubleshooting", "managed-network-services", "noc-as-a-service"],
    tools: ["troubleshooting-triage", "network-risk-score"],
    faqs: [
      {
        question: "What should we collect during a network outage?",
        answer: "Collect impact, start time, recent changes, monitoring alerts, firewall logs, traceroute/path tests, ISP ticket details, and affected applications."
      },
      {
        question: "Can outage response become managed support?",
        answer: "Yes. After stabilization, the incident can become monitoring, documentation, backup, firewall review, and recurring support."
      }
    ]
  },
  {
    slug: "firewall-rule-cleanup",
    title: "Firewall Rule Cleanup",
    metaTitle: "Firewall Rule Cleanup, Policy Review and VPN Hardening",
    metaDescription:
      "Firewall rule cleanup for broad allow rules, unused policies, VPN user sprawl, missing logs, weak admin access and configuration backup gaps.",
    eyebrow: "Network security solution",
    answer:
      "Firewall cleanup should be risk-ranked by exposure, ownership, hit count, service criticality, logging, VPN access, and rollback readiness.",
    problem:
      "Years of urgent changes create rule sprawl, shadowed objects, broad allow rules, unknown VPN users, and policies nobody owns.",
    outcomes: ["Reduced exposure", "Cleaner rules", "Stronger admin access", "Backup evidence"],
    services: ["firewall-management", "network-security-services", "penetration-testing"],
    tools: ["firewall-hygiene"],
    faqs: [
      {
        question: "Is firewall cleanup risky?",
        answer: "It can be risky if done blindly. A controlled cleanup uses exports, hit counts, owner confirmation, staged changes, and rollback plans."
      },
      {
        question: "What should be reviewed with firewall rules?",
        answer: "Review source, destination, service, NAT, VPN users, admin access, logs, backups, firmware, and change ownership."
      }
    ]
  },
  {
    slug: "sase-zero-trust-readiness",
    title: "SASE and Zero Trust Readiness",
    metaTitle: "SASE and Zero Trust Readiness for Hybrid Teams",
    metaDescription:
      "Assess SD-WAN, ZTNA, SWG, CASB, FWaaS, remote access, identity, device posture, logs and cloud connectivity readiness.",
    eyebrow: "Modern access solution",
    answer:
      "SASE and Zero Trust readiness connects identity, remote access, device posture, cloud connectivity, firewall policy, user experience, and monitoring.",
    problem:
      "Many teams want Zero Trust but still depend on flat networks, legacy VPNs, weak logs, unclear identities, and fragmented internet access controls.",
    outcomes: ["VPN modernization path", "Access policy clarity", "SASE roadmap", "Visibility gaps identified"],
    services: ["network-security-services", "cloud-network-services", "managed-network-services"],
    tools: ["network-risk-score", "cloud-readiness", "firewall-hygiene"],
    faqs: [
      {
        question: "Is SASE the same as Zero Trust?",
        answer: "No. Zero Trust is a security model. SASE is a cloud-delivered architecture that often combines SD-WAN, ZTNA, SWG, CASB, and FWaaS."
      },
      {
        question: "Where should SASE planning start?",
        answer: "Start with users, applications, current VPNs, identity, device posture, internet access, cloud routing, and logs."
      }
    ]
  },
  {
    slug: "cloud-network-exposure-review",
    title: "Cloud Network Exposure Review",
    metaTitle: "Cloud Network Exposure Review for AWS, Azure and Google Cloud",
    metaDescription:
      "Review public IPs, security groups, routes, subnets, VPC/VNet segmentation, VPNs, flow logs and cloud network exposure.",
    eyebrow: "Cloud security solution",
    answer:
      "Cloud exposure review should identify public entry points, route intent, security group posture, segmentation gaps, logs, and hybrid connectivity risks.",
    problem:
      "Cloud networks often grow quickly, leaving public services, unclear routes, flat subnets, missing flow logs, and risky security groups.",
    outcomes: ["Public exposure inventory", "Route clarity", "Segmentation backlog", "Cloud log visibility"],
    services: ["cloud-network-services", "network-security-services", "penetration-testing"],
    tools: ["cloud-readiness", "ssl-certificate-check", "http-header-check"],
    faqs: [
      {
        question: "What is cloud network exposure?",
        answer: "Cloud exposure includes public IPs, internet-facing load balancers, open security groups, weak routes, exposed admin services, and missing visibility."
      },
      {
        question: "Can this support migration planning?",
        answer: "Yes. Exposure review helps clean network design before or during migration so cloud connectivity does not become hidden risk."
      }
    ]
  },
  {
    slug: "pentest-remediation-retesting",
    title: "Pentest Remediation and Retesting",
    metaTitle: "Pentest Remediation, Retesting and Evidence Closure",
    metaDescription:
      "Turn penetration testing findings into remediation plans, owner actions, retesting evidence and client-ready closure summaries.",
    eyebrow: "Security assurance solution",
    answer:
      "Pentest value comes after the report: findings need owners, severity context, remediation evidence, retesting, and a client-ready closure story.",
    problem:
      "Many organizations receive a report but struggle to prioritize fixes, explain risk to owners, prove remediation, or close findings with confidence.",
    outcomes: ["Owner-ready findings", "Retest path", "Closure evidence", "Better client confidence"],
    services: ["penetration-testing", "network-security-services", "firewall-management"],
    tools: ["pentest-readiness", "firewall-hygiene"],
    faqs: [
      {
        question: "What happens after a penetration test?",
        answer: "The findings should be prioritized, assigned, fixed, documented, retested, and converted into evidence for clients or auditors."
      },
      {
        question: "Can QCS help fix findings?",
        answer: "Yes. Depending on scope, QCS can help with firewall, network, cloud, access, header, TLS, and segmentation remediation."
      }
    ]
  },
  {
    slug: "network-security-career-labs",
    title: "Network Security Career Labs",
    metaTitle: "Network Security Career Labs for CCNA, Firewalls, Cloud and SOC",
    metaDescription:
      "Hands-on network security career labs for CCNA, CCNP, firewalls, cloud networking, SOC, ethical hacking and interview readiness.",
    eyebrow: "Institute solution",
    answer:
      "Network security training should combine fundamentals, real labs, vendor exposure, troubleshooting scenarios, project evidence, and career guidance.",
    problem:
      "Learners often collect certifications without enough troubleshooting confidence, firewall practice, cloud networking context, or interview-ready evidence.",
    outcomes: ["Clear path", "Hands-on labs", "Interview readiness", "Corporate upskilling"],
    services: ["managed-network-services", "network-security-services"],
    tools: ["career-path-finder"],
    faqs: [
      {
        question: "Which career path should a beginner choose?",
        answer: "Most beginners should build networking fundamentals first, then choose network engineering, firewall/security engineering, SOC, cloud networking, or pentesting."
      },
      {
        question: "Can corporate teams use the institute model?",
        answer: "Yes. Corporate training can focus on firewalls, cloud networking, incident response, troubleshooting, and security operations workflows."
      }
    ]
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

export const authorityEngine = [
  {
    title: "Solution Pages",
    description:
      "Problem-led pages for outage response, firewall cleanup, SASE readiness, cloud exposure, pentest retesting, and career labs."
  },
  {
    title: "Service Pages",
    description:
      "Commercial pages with answer-first copy, buyer triggers, scope, deliverables, FAQs, schema, and assessment CTAs."
  },
  {
    title: "Network Tools",
    description:
      "DNS, MX, SPF/DMARC, SSL, headers, and port checks that help visitors validate symptoms before deeper support."
  },
  {
    title: "Resource Library",
    description:
      "Checklists, templates, guides, and roadmaps that help buyers prepare the right evidence before a technical discussion."
  },
  {
    title: "LLM Index",
    description:
      "A plain-language index that helps assistants understand services, tools, assessments, and positioning."
  },
  {
    title: "Structured Data",
    description:
      "Organization, WebSite, Service, SoftwareApplication, Course, CollectionPage, FAQPage, ItemList, and BreadcrumbList JSON-LD."
  }
];

export const conversionMagnets = [
  "Network Risk Score",
  "Firewall Hygiene Checker",
  "Cloud Network Readiness Review",
  "Pentest Scope Sheet",
  "Emergency Troubleshooting Triage",
  "Network Security Career Roadmap"
];

export const seoAioBlueprint = [
  {
    title: "Answer-first sections",
    description:
      "Each important page opens with a clear answer to the user's actual search intent before expanding into scope, proof, and next action."
  },
  {
    title: "Entity-rich content",
    description:
      "Pages name relevant entities such as SD-WAN, SASE, ZTNA, FWaaS, CASB, AWS VPC, Azure VNet, firewalls, VPN, NOC, SOC, and retesting."
  },
  {
    title: "Useful tools and assessments",
    description:
      "The site earns technical intent through short utilities and converts it through assessments, evidence checklists, and logical CTAs."
  },
  {
    title: "Schema plus crawl clarity",
    description:
      "JSON-LD, sitemap coverage, canonical paths, internal links, and concise FAQs make the site easier for users and discovery systems to interpret."
  }
];

export const resources = [
  {
    title: "Firewall Rule Cleanup Checklist",
    type: "Checklist",
    slug: "firewall-rule-cleanup",
    summary: "A practical checklist for rule sprawl, broad allow rules, VPN users, admin access, logs, and backups.",
    audience: "IT heads, firewall owners, compliance teams"
  },
  {
    title: "Cloud Network Readiness Guide",
    type: "Guide",
    slug: "cloud-network-readiness",
    summary: "A review guide for VPC/VNet design, hybrid VPN, routing, public exposure, flow logs, and segmentation.",
    audience: "Cloud teams, SaaS teams, migration owners"
  },
  {
    title: "Penetration Testing Scope Sheet",
    type: "Template",
    slug: "pentest-scope-sheet",
    summary: "A scope sheet for assets, test windows, authorization, exclusions, previous findings, and retest needs.",
    audience: "Founders, security teams, client-facing product teams"
  },
  {
    title: "Network Security Engineer Roadmap",
    type: "Career",
    slug: "network-security-career-roadmap",
    summary: "A practical path across networking fundamentals, firewalls, cloud networking, SOC, ethical hacking, and projects.",
    audience: "Students, working professionals, corporate learners"
  },
  {
    title: "Emergency Network Triage Sheet",
    type: "Worksheet",
    slug: "emergency-network-triage",
    summary: "A worksheet for outage impact, timeline, recent changes, logs, packet evidence, ISP/vendor escalation, and RCA.",
    audience: "IT admins, support teams, branch managers"
  },
  {
    title: "SASE and Zero Trust Readiness Map",
    type: "Map",
    slug: "sase-zero-trust-readiness",
    summary: "A readiness map for SD-WAN, ZTNA, SWG, CASB, FWaaS, identity, device posture, and monitoring.",
    audience: "Hybrid-work teams, security leaders, cloud teams"
  }
];

export const instituteTracks = [
  {
    title: "Network Engineering Foundation",
    level: "Beginner to intermediate",
    modules: ["Networking fundamentals", "CCNA concepts", "Switching and routing", "Subnetting", "Troubleshooting labs"],
    outcome: "Build the base required for network support, NOC, and junior network engineer roles."
  },
  {
    title: "Enterprise Networking and CCNP Path",
    level: "Intermediate",
    modules: ["OSPF/BGP concepts", "VLANs and campus design", "WAN and SD-WAN basics", "High availability", "Scenario labs"],
    outcome: "Prepare for enterprise network operations and advanced troubleshooting responsibilities."
  },
  {
    title: "Firewall and Network Security",
    level: "Intermediate to advanced",
    modules: ["Firewall policy", "NAT", "VPN", "Segmentation", "Logging", "Fortinet/Palo Alto/Sophos concepts"],
    outcome: "Build practical firewall administration and network security confidence."
  },
  {
    title: "Cloud Networking",
    level: "Intermediate",
    modules: ["AWS VPC", "Azure VNet", "Routes", "Security groups/NSGs", "Site-to-site VPN", "Flow logs"],
    outcome: "Understand hybrid and cloud network designs used by modern teams."
  },
  {
    title: "SOC and Incident Fundamentals",
    level: "Career switcher / fresher",
    modules: ["Logs", "Alert triage", "Firewall events", "DNS/email signals", "Incident notes", "Escalation"],
    outcome: "Build a practical bridge from networking into security operations."
  },
  {
    title: "Ethical Hacking and Pentest Readiness",
    level: "Intermediate",
    modules: ["Recon", "Web/API basics", "Network exposure", "Reporting", "Remediation", "Retesting"],
    outcome: "Learn how testing connects to real remediation and business evidence."
  }
];

export const automationFlows = [
  { title: "Share the issue", description: "Tell us what is happening across users, sites, cloud apps, security controls, or career goals.", icon: BriefcaseBusiness },
  { title: "Check readiness", description: "Use a guided diagnostic to understand urgency, missing evidence, and the likely work path.", icon: ShieldCheck },
  { title: "Review with QCS", description: "Turn the result into a practical conversation with the right network, security, cloud, or training focus.", icon: BrainCircuit },
  { title: "Move with clarity", description: "Leave with a next-step plan, evidence checklist, and service or training direction.", icon: Zap }
];
