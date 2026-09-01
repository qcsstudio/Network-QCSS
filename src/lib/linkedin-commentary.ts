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
    audience?: string;
    category?: string;
    checklist?: string[];
    excerpt?: string;
    keywords?: string[];
    primaryKeyword?: string;
    readerOutcome?: string;
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
  sourceUrl?: string;
};

export const linkedInCommentaryPolicyVersion = 4;
export const linkedInDeliveryLimit = 2_900;

export type LinkedInProtocolDraft = {
  actions: string[];
  evidence: string;
  hashtags: string[];
  hook: string;
  interpretation: string;
  linkLabel: "Original QCS analysis" | "QCS technical brief";
  maxLength: number;
  question?: string;
  url: string;
  verification: string;
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
    [/bgp|rpki|roa|route origin/, "#RoutingSecurity"],
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
  return composeLinkedInProtocolCommentary({
    actions: plan.actions.slice(0, 3),
    evidence: `${cleanHeadline(post.title)}. ${plan.signal}`,
    hashtags: plan.hashtags,
    hook: plan.hook,
    interpretation: plan.impact,
    linkLabel: "Original QCS analysis",
    maxLength: 2_200,
    question: plan.question,
    url,
    verification: plan.actions.at(-1) || "Confirm the intended operating state with retained technical evidence before closure"
  });
}

function advisoryHashtags(advisory: LinkedInAdvisoryPost) {
  const text = `${advisory.vendor} ${advisory.title} ${advisory.products.join(" ")}`.toLowerCase();
  const vendorTag = /amazon web services|\baws\b/.test(text)
    ? "#AWSSecurity"
    : /google cloud|\bgcp\b/.test(text)
      ? "#GoogleCloud"
      : /microsoft|azure/.test(text)
        ? "#MicrosoftSecurity"
        : /cisco/.test(text)
          ? "#CiscoSecurity"
          : /fortinet|fortigate|fortios/.test(text)
            ? "#Fortinet"
            : /palo alto|pan-os/.test(text)
              ? "#PaloAltoNetworks"
              : /juniper|junos/.test(text)
                ? "#JuniperNetworks"
                : "#CyberSecurity";
  const technologyTag = /azure/.test(text)
    ? "#AzureSecurity"
    : /amazon web services|\baws\b|google cloud|\bgcp\b|cloud/.test(text)
      ? "#CloudSecurity"
      : /firewall|vpn|router|switch|network/.test(text)
        ? "#NetworkSecurity"
        : "#InfoSec";
  return [...new Set([vendorTag, technologyTag, ...(advisory.cves.length ? ["#CVE"] : []), "#VulnerabilityManagement", "#CyberSecurity"])].slice(0, 5);
}

function advisoryActions(advisory: LinkedInAdvisoryPost) {
  const products = normalize(advisory.products.slice(0, 5).join(", ") || advisory.vendor);
  const evidence = (advisory.evidenceChecklist || []).map(normalize).filter(Boolean);
  const actions = [
    `Inventory ${products}; record deployed releases, service roles, owners, and exposure.`,
    evidence[0] || "Confirm applicability against the vendor's affected conditions before changing production controls.",
    normalize(advisory.remediation),
    `Verify the running fix, relevant security logs, service health, and residual exposure before closure${evidence.at(-1) ? `; retain ${evidence.at(-1)}` : ""}.`
  ];
  return [...new Set(actions.map((item) => normalize(item).replace(/[.\s]+$/, "")))].slice(0, 4);
}

function comparable(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function wrapPresentationLine(value: string, limit: number) {
  const line = value.trim();
  if (!line || line.length <= limit || /https?:\/\//i.test(line)) return [line];
  const parts: string[] = [];
  let remaining = line;
  while (remaining.length > limit) {
    const window = remaining.slice(0, limit + 1);
    const sentenceBreak = Math.max(window.lastIndexOf(". "), window.lastIndexOf("; "), window.lastIndexOf(": "));
    const wordBreak = window.lastIndexOf(" ");
    const splitAt = sentenceBreak >= Math.floor(limit * 0.45) ? sentenceBreak + 1 : wordBreak;
    if (splitAt < Math.floor(limit * 0.45)) break;
    parts.push(remaining.slice(0, splitAt).trim());
    remaining = remaining.slice(splitAt).trim();
  }
  if (remaining) parts.push(remaining);
  return parts;
}

function collapseBlankLines(lines: string[]) {
  const collapsed: string[] = [];
  for (const line of lines) {
    if (!line && !collapsed.at(-1)) continue;
    collapsed.push(line);
  }
  while (!collapsed.at(-1)) collapsed.pop();
  return collapsed;
}

function questionCount(commentary: string) {
  const prose = commentary.replace(/https?:\/\/\S+/g, "");
  return (prose.match(/\?/g) || []).length;
}

function protocolLabels(commentary: string) {
  const lines = commentary.split("\n").map((line) => line.trim());
  return ["What Changed", "Why It Matters", "Action And Verification"].map((label) => ({
    count: lines.filter((line) => line === label).length,
    index: lines.indexOf(label),
    label
  }));
}

export function linkedInProtocolIssues(commentary: string) {
  const issues: string[] = [];
  const labels = protocolLabels(commentary);
  if (labels.some((label) => label.count !== 1) || labels.some((label, index) => index > 0 && label.index <= labels[index - 1].index)) {
    issues.push("Use the QCS LinkedIn presentation order exactly once: What Changed, Why It Matters, then Action And Verification.");
  }
  const actions = actionLines(commentary).filter((line) => /^[1-4]\.\s+/.test(line));
  if (actions.length < 3 || actions.length > 4) issues.push("Use three article actions or four advisory actions on separate numbered lines.");
  if (!/\nVerification:\s+\S/i.test(commentary)) issues.push("Add an explicit verification statement after the numbered actions.");
  if (!/(?:Original QCS analysis|QCS technical brief): https:\/\/www\.qcsstudio\.com\//i.test(commentary)) {
    issues.push("Include the labeled canonical QCS article or advisory link.");
  }
  const visibleLines = commentary.split("\n").map((line) => line.trim()).filter(Boolean);
  const hashtags = commentary.match(/#[A-Za-z0-9]+/g) || [];
  const finalLine = visibleLines.at(-1) || "";
  if (hashtags.length < 3 || hashtags.length > 5 || !hashtags.every((tag) => finalLine.includes(tag))) {
    issues.push("Finish with one line containing three to five focused hashtags.");
  }
  if (commentary.length > linkedInDeliveryLimit) issues.push(`The post exceeds the ${linkedInDeliveryLimit}-character delivery limit.`);
  if (/(?:\.\.\.|…)/.test(commentary)) issues.push("Do not deliver clipped sentences or ellipses.");
  if (commentary.split("\n").some((line) => line.trim().length > 420 && !/https?:\/\//i.test(line))) {
    issues.push("Break dense LinkedIn copy into lines of 420 characters or fewer.");
  }
  return [...new Set(issues)];
}

export function assertLinkedInProtocol(commentary: string) {
  const normalized = commentary.replace(/\r\n?/g, "\n").trim();
  const issues = linkedInProtocolIssues(normalized);
  if (issues.length) throw new Error(`LinkedIn delivery held by protocol v${linkedInCommentaryPolicyVersion}: ${issues.join(" ")}`);
  return normalized;
}

export function composeLinkedInProtocolCommentary(input: LinkedInProtocolDraft) {
  const actions = input.actions
    .map((action) => normalize(action).replace(/^[1-4][.)]\s*/, "").replace(/[.\s]+$/, ""))
    .filter(Boolean);
  const hashtags = [...new Set(input.hashtags.filter((tag) => /^#[A-Za-z0-9]+$/.test(tag)))].slice(0, 5);
  const question = normalize(input.question || "");
  const commentary = collapseBlankLines([
    normalize(input.hook),
    "",
    "What Changed",
    ...wrapPresentationLine(normalize(input.evidence), 400),
    "",
    "Why It Matters",
    ...wrapPresentationLine(normalize(input.interpretation), 400),
    "",
    "Action And Verification",
    ...actions.map((action, index) => `${index + 1}. ${action}.`),
    ...wrapPresentationLine(`Verification: ${normalize(input.verification).replace(/[.\s]+$/, "")}.`, 400),
    ...(question ? ["", question] : []),
    "",
    `${input.linkLabel}: ${input.url}`,
    "",
    hashtags.join(" ")
  ]).join("\n").trim();
  if (commentary.length > input.maxLength) {
    throw new Error(`LinkedIn protocol composition is ${commentary.length} characters; revise the content blocks below ${input.maxLength} instead of truncating them.`);
  }
  return assertLinkedInProtocol(commentary);
}

function keepOnlyFinalQuestion(lines: string[]) {
  let kept = false;
  return [...lines]
    .reverse()
    .map((line) => {
      if (/https?:\/\//i.test(line)) return line;
      const characters = [...line].reverse();
      const normalized = characters
        .map((character) => {
          if (character !== "?") return character;
          if (!kept) {
            kept = true;
            return character;
          }
          return ".";
        })
        .reverse()
        .join("");
      return normalized;
    })
    .reverse();
}

export function formatAgentLinkedInCommentary(input: {
  actions: string[];
  commentary: string;
  hashtags: string[];
  linkLabel?: string;
  maxLength?: number;
  url: string;
}) {
  const maxLength = input.maxLength || 2_700;
  const actions = input.actions
    .map((action) => normalize(action).replace(/^[1-4][.)]\s*/, "").replace(/[.\s]+$/, ""))
    .filter(Boolean)
    .slice(0, 4);
  const actionKeys = new Set(actions.map(comparable));
  const hashtags = [...new Set(input.hashtags.filter((tag) => /^#[A-Za-z0-9]+$/.test(tag)))].slice(0, 5);
  const body = input.commentary
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) => line.replace(/#[A-Za-z0-9]+/g, "").trim())
    .filter((line) => !line.includes(input.url))
    .filter((line) => (line.match(/\b[1-4][.)]\s+/g) || []).length < 2)
    .filter((line) => !/^(?:defender actions|practical next steps|recommended actions|actions|next steps|decision checks?)\s*:$/i.test(line))
    .filter((line) => !/^[1-4][.)]\s+/.test(line))
    .filter((line) => {
      const withoutMarker = line.replace(/^(?:[1-4][.)]|[-*\u2022])\s+/, "").replace(/[.\s]+$/, "");
      return !actionKeys.has(comparable(withoutMarker));
    });

  const wrapped = body.flatMap((line, index) => wrapPresentationLine(line, index === 0 ? 160 : 320));
  const footer = [
    "Practical Next Steps",
    ...actions.map((action, index) => `${index + 1}. ${action}.`),
    "",
    `${input.linkLabel || "Original QCS analysis"}: ${input.url}`,
    "",
    hashtags.join(" ")
  ];
  const bodyBudget = Math.max(420, maxLength - footer.join("\n").length - 2);
  const lines: string[] = [];
  for (const line of collapseBlankLines(keepOnlyFinalQuestion(wrapped))) {
    const candidate = collapseBlankLines([...lines, line]);
    if (candidate.join("\n").length > bodyBudget) break;
    lines.push(line);
  }
  while (lines.at(-1) && /^[A-Za-z][A-Za-z &/+-]{2,50}$/.test(lines.at(-1) || "")) lines.pop();
  return collapseBlankLines([...lines, "", ...footer]).join("\n").trim();
}

function containsFact(commentary: string, fact: string) {
  const expected = comparable(fact);
  return !expected || comparable(commentary).includes(expected);
}

function repeatedSentences(commentary: string) {
  const seen = new Set<string>();
  const repeated: string[] = [];
  for (const sentence of commentary.split(/(?<=[.!?])\s+/)) {
    const normalized = comparable(sentence);
    if (normalized.length < 45) continue;
    if (seen.has(normalized)) repeated.push(sentence.trim());
    seen.add(normalized);
  }
  return repeated;
}

function presentationIssues(commentary: string, url: string, minimumLength: number, maximumLength: number) {
  const hashtags = commentary.match(/#[A-Za-z0-9]+/g) || [];
  const lines = commentary.split("\n");
  const visibleLines = lines.map((line) => line.trim()).filter(Boolean);
  const finalLine = visibleLines.at(-1) || "";
  const issues: string[] = [];
  if (commentary.length < minimumLength) issues.push(`The post needs at least ${minimumLength} characters of decision-useful content.`);
  if (commentary.length > maximumLength) issues.push(`The post exceeds the ${maximumLength}-character editorial limit.`);
  if (!commentary.includes(url)) issues.push("The canonical technical brief is missing.");
  if (hashtags.length < 3 || hashtags.length > 5) issues.push("Use three to five focused hashtags.");
  if (hashtags.length && !hashtags.every((tag) => finalLine.includes(tag))) issues.push("Keep all hashtags together on the final line.");
  if ((visibleLines[0] || "").length > 210) issues.push("The opening line is too dense for a mobile feed.");
  if (lines.some((line) => line.trim().length > 420 && !line.includes("http"))) issues.push("Break dense lines into shorter paragraphs.");
  if (/(?:\.\.\.|…)/.test(commentary)) issues.push("Do not publish clipped sentences or ellipses.");
  if (/\b(?:in today['’]s (?:digital )?(?:world|landscape)|ever[- ]evolving|game[- ]changer|a useful (?:network )?signal|qcs translated the signal|could another engineer reproduce|what evidence would your team need)\b/i.test(commentary)) {
    issues.push("Replace stock or reusable LinkedIn phrasing with a topic-specific insight.");
  }
  const capitalLabels = visibleLines.filter((line) => /^[A-Z0-9 &/+-]{5,50}$/.test(line));
  if (capitalLabels.length > 3) issues.push("Use no more than three restrained section labels; the post currently reads like a form.");
  if (repeatedSentences(commentary).length) issues.push("Remove repeated sentences or duplicated ideas.");
  if (/\p{Extended_Pictographic}/u.test(commentary)) issues.push("Remove decorative emoji from the professional editorial post.");
  return issues;
}

function actionLines(commentary: string) {
  return commentary
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => /^(?:[1-4]\.\s+|-\s+)/.test(line));
}

export function editorialLinkedInQualityIssues(commentary: string, url: string, post?: LinkedInEditorialPost) {
  const issues = [...linkedInProtocolIssues(commentary), ...presentationIssues(commentary, url, 650, 2_200)];
  const actions = actionLines(commentary);
  if (!commentary.includes(`Original QCS analysis: ${url}`)) {
    issues.push("Label the canonical article link as the original QCS analysis.");
  }
  if (actions.length !== 3) issues.push("Include exactly three concrete actions or decision checks on separate numbered lines.");
  if (questionCount(commentary) > 1) issues.push("Use no more than one purposeful audience question.");
  if (post) {
    const distinctiveTerms = comparable(`${post.title} ${post.content.primaryKeyword || ""}`)
      .split(" ")
      .filter((term) => term.length >= 6 && !["security", "network", "service", "software", "article"].includes(term));
    if (distinctiveTerms.length && !distinctiveTerms.some((term) => comparable(commentary).includes(term))) {
      issues.push("The post does not retain a distinctive fact or technology from the article.");
    }
  }
  return [...new Set(issues)];
}

export function advisoryLinkedInQualityIssues(commentary: string, url: string, advisory?: LinkedInAdvisoryPost) {
  const issues = [...linkedInProtocolIssues(commentary), ...presentationIssues(commentary, url, 850, 2_700)];
  const actions = actionLines(commentary).filter((line) => /^[1-4]\.\s+/.test(line));
  if (actions.length !== 4) issues.push("Include exactly four numbered defender actions.");
  if (new Set(actions.map(comparable)).size !== actions.length) issues.push("Every defender action must be materially distinct.");
  if (!/exploitation status/i.test(commentary)) issues.push("State exploitation status explicitly.");
  if (!/(?:vendor|severity|rating).{0,40}(?:critical|high|medium|moderate|low|unrated)/i.test(commentary)) {
    issues.push("State the vendor severity separately from CVSS.");
  }
  if (!/(?:validate|validation|verify).{0,180}(?:version|release|fix|log|service|exposure|control)/i.test(commentary)) {
    issues.push("Add a concrete post-remediation validation step.");
  }
  if (advisory) {
    const identifier = advisory.cves[0];
    if (identifier && !containsFact(commentary, identifier)) issues.push(`Preserve advisory identifier ${identifier}.`);
    if (advisory.cvssScore !== null && advisory.cvssScore !== undefined && !new RegExp(`CVSS\\s*${advisory.cvssScore.toFixed(1).replace(".", "\\.")}`, "i").test(commentary)) {
      issues.push(`Preserve the exact CVSS ${advisory.cvssScore.toFixed(1)} score.`);
    }
    const firstProduct = advisory.products[0];
    if (firstProduct && !containsFact(commentary, firstProduct)) issues.push(`Name the affected product ${firstProduct}.`);
    for (const fixedVersion of advisory.fixedVersions || []) {
      if (!containsFact(commentary, fixedVersion)) issues.push(`Preserve the complete fixed-release path: ${fixedVersion}.`);
    }
    const noWorkaround = /no (?:available )?workarounds?|no workaround (?:is|was) available/i.test(advisory.workaround || advisory.remediation);
    if (noWorkaround && !/no workaround/i.test(commentary)) issues.push("State explicitly that no workaround is available.");
    if (advisory.sourceUrl && !commentary.includes(advisory.sourceUrl)) issues.push("Include the canonical vendor source URL.");
  }
  return [...new Set(issues)];
}

export function composeAdvisoryLinkedInPost(advisory: LinkedInAdvisoryPost, url: string) {
  const title = cleanHeadline(advisory.title);
  const identifier = advisory.cves[0] || "Vendor advisory";
  const exploitation = normalize(advisory.exploitationStatus || "The source does not state an exploitation status.");
  const severity = advisory.severity.toLowerCase() === "unrated" ? "Vendor not rated" : `Vendor ${advisory.severity.toUpperCase()}`;
  const score = advisory.cvssScore === null || advisory.cvssScore === undefined ? "CVSS not supplied" : `CVSS ${advisory.cvssScore.toFixed(1)}`;
  const affected = normalize(advisory.products.slice(0, 8).join(", ") || "See the vendor advisory");
  const affectedVersions = normalize((advisory.affectedVersions || []).slice(0, 8).join("; ") || "Confirm against the vendor's affected-release table");
  const fixedVersions = normalize((advisory.fixedVersions || []).slice(0, 8).join("; ") || "No fixed release was extracted; follow the current vendor remediation");
  const noWorkaround = /no (?:available )?workarounds?|no workaround (?:is|was) available/i.test(advisory.workaround || advisory.remediation);
  const mitigation = noWorkaround
    ? "No workaround is available. Prioritize the vendor-supported fix and temporary exposure reduction."
    : normalize(advisory.workaround || "No vendor workaround was extracted. Do not invent an unsupported mitigation.");
  const actions = advisoryActions(advisory);
  const hashtags = advisoryHashtags(advisory);
  return composeLinkedInProtocolCommentary({
    actions,
    evidence: [
      `${advisory.vendor} security advisory ${identifier}: ${title}.`,
      `Exploitation status: ${exploitation}`,
      `Rating: ${severity}; ${score}. Products: ${affected}. Affected releases: ${affectedVersions}.`
    ].join(" "),
    hashtags,
    hook: `${advisory.vendor} operators should treat ${identifier} as an evidence-led exposure and remediation decision, not a headline-only patch event.`,
    interpretation: [
      advisory.technicalExplanation || advisory.summary,
      `Business impact: ${advisory.businessImpact || advisory.summary}`,
      `Fixed path: ${fixedVersions}. Workaround status: ${mitigation}`,
      advisory.sourceUrl ? `Official vendor source: ${advisory.sourceUrl}` : ""
    ].filter(Boolean).join(" "),
    linkLabel: "QCS technical brief",
    maxLength: 2_700,
    url,
    verification: actions.at(-1) || "Verify the running release, exposure path, relevant logs, service health, and retained change evidence"
  });
}
