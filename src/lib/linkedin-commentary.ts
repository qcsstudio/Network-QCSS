type EditorialSection = {
  heading: string;
  body: string;
  bullets?: string[];
};

type EditorialSource = {
  label: string;
  url: string;
};

export type LinkedInEditorialPost = {
  slug: string;
  title: string;
  content: {
    answer?: string;
    category?: string;
    excerpt?: string;
    keywords?: string[];
    primaryKeyword?: string;
    sections?: EditorialSection[];
    sources?: EditorialSource[];
    takeaways?: string[];
  };
};

export type LinkedInAdvisoryPost = {
  affectedVersions?: string[];
  businessImpact?: string;
  cves: string[];
  cvssScore?: number | null;
  evidenceChecklist?: string[];
  exploitationStatus?: string;
  fixedVersions?: string[];
  products: string[];
  remediation: string;
  severity: string;
  summary: string;
  technicalExplanation?: string;
  title: string;
  vendor: string;
  workaround?: string;
};

type EditorialPlan = {
  actionLabel: string;
  actions: string[];
  hashtags: string[];
  hook: string;
  impact: string;
  impactLabel: string;
  question: string;
  signal: string;
  signalLabel: string;
};

function normalize(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function clip(value: string, limit: number) {
  const normalized = normalize(value);
  if (normalized.length <= limit) return normalized;
  const shortened = normalized.slice(0, limit - 1);
  const lastSpace = shortened.lastIndexOf(" ");
  return `${shortened.slice(0, Math.max(lastSpace, Math.floor(limit * 0.72))).replace(/[,:;.!?\s]+$/, "")}...`;
}

function cleanHeadline(value: string) {
  return normalize(value).replace(/\s+-\s+[a-z0-9][a-z0-9.-]+\.(?:com|net|org|io|in)$/i, "");
}

function section(post: LinkedInEditorialPost, pattern: RegExp) {
  return post.content.sections?.find((item) => pattern.test(item.heading));
}

function topicText(post: LinkedInEditorialPost) {
  return [post.title, post.content.category, post.content.primaryKeyword, ...(post.content.keywords || [])]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function relevantHashtags(text: string, defaults: string[]) {
  const tags = [...defaults];
  const candidates: Array<[RegExp, string]> = [
    [/cisco/, "#CiscoSecurity"],
    [/fortinet|fortigate|fortios/, "#Fortinet"],
    [/juniper|junos/, "#JuniperNetworks"],
    [/sd[ -]?wan/, "#SDWAN"],
    [/sase/, "#SASE"],
    [/zero trust|ztna/, "#ZeroTrust"],
    [/bgp|rpki|roa/, "#BGP"],
    [/cloud|aws|azure|gcp|vpc|vnet/, "#CloudSecurity"],
    [/ubuntu|linux kernel|intel iotg/, "#LinuxSecurity"],
    [/vulnerab|cve|privilege escalation|hardening/, "#VulnerabilityManagement"],
    [/packet capture|tcpdump|pcap/, "#NetworkTroubleshooting"]
  ];
  for (const [pattern, tag] of candidates) {
    if (pattern.test(text)) tags.push(tag);
  }
  return [...new Set(tags)].slice(0, 4);
}

function sourceName(post: LinkedInEditorialPost) {
  return post.content.sources?.[0]?.label || "the source report";
}

function evidenceActions(post: LinkedInEditorialPost) {
  const controlled = section(post, /controlled|implementation|response|action/i)?.bullets || [];
  if (controlled.length >= 3) return controlled.slice(0, 3).map((item) => clip(item, 190));
  const checklist = section(post, /evidence|collect/i)?.bullets || [];
  if (checklist.length >= 3) return checklist.slice(0, 3).map((item) => clip(item, 190));
  return [
    "Confirm where the signal applies using current inventory, release, role, and exposure evidence.",
    "Assign an accountable owner and execute one controlled change with a tested rollback path.",
    "Validate the running state, service path, telemetry, and residual risk before closing the decision."
  ];
}

function editorialPlan(post: LinkedInEditorialPost): EditorialPlan {
  const headline = cleanHeadline(post.title);
  const text = topicText(post);
  const hashtagText = `${headline} ${post.content.category || ""} ${post.content.primaryKeyword || ""}`.toLowerCase();
  const source = sourceName(post);

  if (/authenticated privilege escalation/.test(text)) {
    const sdwan = /sd[ -]?wan/.test(text);
    return {
      hook: "Authenticated privilege escalation is not a perimeter-only problem. It is a trust-boundary problem inside the management plane.",
      signalLabel: "THE SECURITY SIGNAL",
      signal: `${source} reported ${headline}. The practical question is which authenticated role can cross into a higher-trust function, on which ${sdwan ? "SD-WAN control-plane nodes" : "managed systems"}, and in which deployed releases.`,
      impactLabel: "WHY NETWORK TEAMS SHOULD CARE",
      impact: `For ${sdwan ? "controllers, managers, and validators" : "management systems"}, administrative reachability and role design are part of the exposure. Patching without mapping those paths can leave the underlying privilege boundary poorly understood.`,
      actionLabel: "CONTROLLED RESPONSE",
      actions: [
        "Match the vendor's affected-release criteria against every management-plane node and record its role.",
        "Map who can reach each administrative interface, which roles they hold, and what compensating controls exist.",
        "Apply the supported fix through change control, then verify the running release, role boundaries, logs, and service health."
      ],
      question: `Can your team prove which ${sdwan ? "SD-WAN control-plane nodes" : "management systems"} are affected and who can reach their privileged interfaces?`,
      hashtags: relevantHashtags(hashtagText, ["#NetworkSecurity"])
    };
  }

  if (/fortigate/.test(text) && /converg|sase/.test(text)) {
    return {
      hook: "Converging firewall and SASE capabilities can reduce operational handoffs, but only when policy authority and failure domains become clearer too.",
      signalLabel: "THE ARCHITECTURE SIGNAL",
      signal: `${source} highlighted ${headline}. This is more than a platform announcement: it can change where inspection, remote-access policy, telemetry, and operational ownership sit.`,
      impactLabel: "THE DESIGN TRADE-OFF",
      impact: "Consolidation may simplify management, while also concentrating policy dependencies. The value depends on whether teams can trace an application or user path across firewall and SASE controls without creating blind spots or ambiguous rollback ownership.",
      actionLabel: "DECISION CHECK",
      actions: [
        "Define which control remains authoritative for branch, internet, private-app, and remote-user policy.",
        "Map inspection paths, identity dependencies, logging destinations, and the operational failure domain before migration.",
        "Pilot a representative path and validate policy parity, telemetry, user experience, and rollback before wider convergence."
      ],
      question: "Would convergence simplify accountability in your environment, or mainly consolidate more dependencies behind one operating surface?",
      hashtags: relevantHashtags(hashtagText, ["#NetworkArchitecture", "#NetworkSecurity"])
    };
  }

  if (/vulnerab|\bcve\b|security advisory|hardening release|remote code execution/.test(text)) {
    return {
      hook: "A vulnerability headline is a trigger to prove exposure, not a reason to change every device at the same urgency.",
      signalLabel: "THE RISK SIGNAL",
      signal: `${source} reported ${headline}. The defensible decision starts by matching the vendor's affected criteria to product, release, deployment role, reachability, and business service.`,
      impactLabel: "WHAT CHANGES THE PRIORITY",
      impact: clip(post.content.takeaways?.[1] || post.content.answer || "Confirmed exposure, privileged reachability, business impact, compensating controls, and rollback safety should determine the response order.", 340),
      actionLabel: "EVIDENCE-LED RESPONSE",
      actions: [
        "Confirm affected products and releases against owned assets instead of assigning risk from the headline alone.",
        "Prioritize internet-facing, privileged, and control-plane systems, then record temporary controls where remediation must wait.",
        "Deploy the vendor-supported action with rollback, and retain before-and-after version, exposure, telemetry, and service evidence."
      ],
      question: "Could another engineer reproduce your affected-asset decision from the evidence retained today?",
      hashtags: relevantHashtags(hashtagText, ["#NetworkSecurity"])
    };
  }

  const why = section(post, /why.*matter|impact|trade-off/i)?.body;
  const takeaway = post.content.takeaways?.find((item) => normalize(item).length > 45);
  const actions = evidenceActions(post);
  const routing = /bgp|rpki|roa|routing|route origin/.test(text);
  const cloud = /cloud|aws|azure|gcp|vpc|vnet/.test(text);
  const troubleshooting = /packet capture|tcpdump|troubleshoot|outage|latency|dns/.test(text);
  const hook = routing
    ? "Routing assurance starts where configuration intent meets externally observable path evidence."
    : cloud
      ? "Cloud network risk is rarely one setting; it is the path created by identity, routes, exposure, and ownership together."
      : troubleshooting
        ? "The fastest troubleshooting command is the one tied to a clear hypothesis, capture point, and stop condition."
        : "A useful network signal should change a decision, an owner, or the next validation step.";
  const labels = routing
    ? ["THE ROUTING SIGNAL", "WHY IT MATTERS", "VALIDATION PATH"]
    : cloud
      ? ["THE CLOUD SIGNAL", "WHY IT MATTERS", "CONTROL PATH"]
      : troubleshooting
        ? ["THE OPERATING SIGNAL", "WHY IT MATTERS", "NEXT TEST"]
        : ["THE PRACTICAL SIGNAL", "WHY IT MATTERS", "ACTION PATH"];
  return {
    hook,
    signalLabel: labels[0],
    signal: `${source} surfaced ${headline}. ${clip(post.content.excerpt || post.content.answer || "QCS translated the signal into an evidence-led network decision.", 300)}`,
    impactLabel: labels[1],
    impact: clip(why || takeaway || post.content.answer || "The signal becomes useful when it is mapped to current evidence, accountable ownership, business impact, and a measurable validation step.", 360),
    actionLabel: labels[2],
    actions,
    question: `What evidence would your team need before acting on ${clip(post.content.primaryKeyword || headline, 105)}?`,
    hashtags: relevantHashtags(hashtagText, [troubleshooting ? "#NetworkEngineering" : "#NetworkSecurity"])
  };
}

export function composeEditorialLinkedInPost(post: LinkedInEditorialPost, url: string) {
  const plan = editorialPlan(post);
  const lines = [
    plan.hook,
    "",
    cleanHeadline(post.title),
    "",
    plan.signalLabel,
    plan.signal,
    "",
    plan.impactLabel,
    plan.impact,
    "",
    plan.actionLabel,
    ...plan.actions.map((item, index) => `${index + 1}. ${item}`),
    "",
    "QUESTION FOR NETWORK TEAMS",
    plan.question,
    "",
    `Read the QCS analysis: ${url}`,
    "",
    plan.hashtags.join(" ")
  ];
  return lines.join("\n").slice(0, 2900);
}

export function composeAdvisoryLinkedInPost(advisory: LinkedInAdvisoryPost, url: string) {
  const title = cleanHeadline(advisory.title);
  const combined = `${title} ${advisory.vendor} ${advisory.summary} ${advisory.technicalExplanation || ""}`.toLowerCase();
  const products = advisory.products.slice(0, 4).join(", ") || "Use the vendor's affected-product table";
  const affected = advisory.affectedVersions?.slice(0, 4).join(", ") || "Check the affected-package table in the vendor advisory";
  const fixed = advisory.fixedVersions?.slice(0, 4).join(", ") || "Use the fixed package or release listed by the vendor";
  const cves = advisory.cves.slice(0, 3).join(", ");
  const exploitation = normalize(advisory.exploitationStatus || "The vendor did not state an exploitation status.");
  const activelyExploited =
    /active exploitation|actively exploited|exploited in the wild/i.test(exploitation) &&
    !/not specify|no evidence|not known|no active/i.test(exploitation);
  const sentenceSummary = (value: string, limit: number, count = 2) => {
    const sentences = normalize(value).split(/(?<=[.!?])\s+/).filter(Boolean).slice(0, count);
    let result = "";
    for (const sentence of sentences) {
      const candidate = result ? `${result} ${sentence}` : sentence;
      if (candidate.length > limit && result) break;
      result = candidate;
    }
    return clip(result || value, limit);
  };
  const mechanism = sentenceSummary(advisory.technicalExplanation || advisory.summary, 430, 2);
  const impact = sentenceSummary(advisory.businessImpact || advisory.summary, 320, 1);
  const leadIdentifier = advisory.cves[0] || title;
  const hook = activelyExploited
    ? `${advisory.vendor} reports active exploitation of ${leadIdentifier}. This is an immediate exposure-verification and remediation event.`
    : `${title}: the useful response starts with the affected technology and mechanism, not the headline alone.`;
  const scopeAction = /static credential|embedded credential|preset username/.test(combined)
    ? `Inventory every ${advisory.vendor} management instance, its running release, and whether its administrative interface is reachable from the internet or another untrusted path.`
    : /linux kernel|intel iotg|ntfs/.test(combined)
      ? "Map the running kernel release, package flavour, architecture, workload role, and third-party kernel modules on each potentially affected system."
      : `Match ${products} to owned assets, running releases, deployment roles, and reachable management or service paths.`;
  const validationAction = /static credential|embedded credential|preset username/.test(combined)
    ? "After remediation, verify the running hotfix or release and review authentication and access logs for unexpected low-privileged sessions."
    : /linux kernel|intel iotg|ntfs/.test(combined)
      ? "Reboot into the fixed kernel, verify the running release, rebuild required third-party modules, and confirm workload and telemetry health."
      : "Verify the running fixed state, service health, relevant telemetry, rollback outcome, and any accepted residual exposure.";
  const evidence = (advisory.evidenceChecklist || []).map((item) => sentenceSummary(item, 175, 1)).filter(Boolean).slice(0, 2);
  const severity = advisory.severity.toLowerCase() === "unrated" ? "VENDOR SEVERITY NOT ASSIGNED" : `${advisory.severity.toUpperCase()} SEVERITY`;
  const text = `${title} ${advisory.vendor} ${products} ${cves}`.toLowerCase();
  return [
    `${advisory.vendor.toUpperCase()} SECURITY UPDATE | ${severity}`,
    "",
    hook,
    "",
    "WHAT THE VENDOR DISCLOSED",
    mechanism,
    "",
    "OPERATIONAL IMPACT",
    impact,
    "",
    "SCOPE TO VERIFY",
    `Products: ${products}`,
    `Affected releases: ${affected}`,
    `Fixed releases or hotfixes: ${fixed}`,
    ...(cves ? [`Representative identifiers: ${cves}${advisory.cves.length > 3 ? "; consult the vendor notice for the complete set" : ""}`] : []),
    `Exploitation status: ${sentenceSummary(exploitation, 190, 1)}`,
    "",
    "DEFENDER ACTIONS",
    `1. ${clip(scopeAction, 210)}`,
    `2. ${sentenceSummary(advisory.remediation, 240, 2)}`,
    `3. ${clip(validationAction, 210)}`,
    "",
    ...(evidence.length ? ["EVIDENCE TO RETAIN", ...evidence.map((item) => `- ${item}`), ""] : []),
    activelyExploited
      ? "Priority: isolate unnecessary management exposure and move affected systems into emergency change control."
      : "Priority should follow confirmed applicability, exposure, privilege, service criticality, and rollback readiness.",
    "",
    `Read the source-linked QCS technical brief: ${url}`,
    "",
    relevantHashtags(text, ["#NetworkSecurity"]).join(" ")
  ].join("\n").slice(0, 2950);
}
