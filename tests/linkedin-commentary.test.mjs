import assert from "node:assert/strict";
import test from "node:test";
import {
  advisoryLinkedInQualityIssues,
  composeAdvisoryLinkedInPost,
  composeEditorialLinkedInPost,
  editorialLinkedInQualityIssues,
  formatAgentLinkedInCommentary
} from "../src/lib/linkedin-commentary.ts";

const articleUrl = "https://www.qcsstudio.com/resources/example?utm_source=linkedin";

function article(title, overrides = {}) {
  return {
    slug: "example",
    title,
    content: {
      answer: "Confirm applicability, collect evidence, use a controlled change, and validate the result.",
      category: "Network Security",
      excerpt: "A source signal translated into a practical decision for network and security teams.",
      keywords: [],
      primaryKeyword: title,
      sections: [],
      sources: [{ label: "Official vendor advisory", url: "https://example.com/advisory" }],
      takeaways: ["Verify applicability.", "Connect the affected release and exposure to accountable ownership."],
      ...overrides
    }
  };
}

test("SD-WAN privilege escalation commentary explains the trust boundary", () => {
  const commentary = composeEditorialLinkedInPost(
    article("Cisco Catalyst SD-WAN Controller, Manager, and Validator Authenticated Privilege Escalation Vulnerability"),
    articleUrl
  );
  assert.match(commentary, /trust-boundary problem inside the management plane/i);
  assert.match(commentary, /which authenticated role can cross/i);
  assert.match(commentary, /SD-WAN control-plane nodes/i);
  assert.match(commentary, /#CiscoSecurity/);
  assert.match(commentary, /#SDWAN/);
  assert.doesNotMatch(commentary, /Practical takeaways:/);
  assert.ok(commentary.length < 2900);
});

test("FortiGate convergence commentary frames the architecture trade-off", () => {
  const commentary = composeEditorialLinkedInPost(
    article("Fortinet's new FortiGate platform converges firewall, SASE technologies - csoonline.com"),
    articleUrl
  );
  assert.match(commentary, /policy authority and failure domains/i);
  assert.match(commentary, /branch, internet, private-app, and remote-user policy/i);
  assert.match(commentary, /simplify accountability/i);
  assert.match(commentary, /#Fortinet/);
  assert.match(commentary, /#SASE/);
  assert.doesNotMatch(commentary, /#CiscoSecurity/);
  assert.doesNotMatch(commentary, /csoonline\.com/);
});

test("different editorial topics do not collapse into one caption", () => {
  const routing = composeEditorialLinkedInPost(article("RPKI and ROA checks for BGP route security"), articleUrl);
  const capture = composeEditorialLinkedInPost(article("Packet capture runbook for Cisco, FortiGate, and Juniper"), articleUrl);
  assert.match(routing, /THE ROUTING SIGNAL/);
  assert.match(capture, /THE OPERATING SIGNAL/);
  assert.notEqual(routing, capture);
});

test("security advisory commentary preserves evidence, actions, fixes, and presentation structure", () => {
  const commentary = composeAdvisoryLinkedInPost(
    {
      affectedVersions: ["7.2 through 7.6"],
      businessImpact: "An attacker could read sensitive management data and combine the access with another weakness.",
      cves: ["CVE-2026-1234"],
      cvssScore: 5.3,
      evidenceChecklist: ["Confirm whether the management interface is reachable from an untrusted network."],
      exploitationStatus: "The vendor reports active exploitation in July 2026.",
      fixedVersions: ["7.6.2 hotfix 4"],
      products: ["Cisco Secure Firewall Management Center"],
      remediation: "Upgrade to the vendor-fixed release and restrict management access until complete.",
      severity: "critical",
      summary: "A static credential permits access to a low-privileged management account.",
      technicalExplanation: "A static credential embedded in the management interface permits an unauthenticated remote actor to sign in as a low-privileged user. The vendor rates this high because it can be combined with other management vulnerabilities to elevate privileges.",
      title: "Cisco Secure Firewall Management Center static credential vulnerability",
      vendor: "Cisco",
      workaround: "No workaround is available."
    },
    "https://www.qcsstudio.com/security-advisories/example"
  );
  assert.match(commentary, /CISCO SECURITY ADVISORY \| CVE-2026-1234/);
  assert.match(commentary, /EXPLOITATION STATUS\nThe vendor reports active exploitation/i);
  assert.match(commentary, /RISK AND SCOPE\n• Rating: Vendor CRITICAL; CVSS 5\.3/);
  assert.match(commentary, /WHAT IT MEANS/);
  assert.match(commentary, /DEFENDER ACTIONS\n1\./);
  assert.match(commentary, /No workaround is available/i);
  assert.match(commentary, /7\.6\.2 hotfix 4/);
  assert.match(commentary, /QCS technical brief: https:\/\/www\.qcsstudio\.com\/security-advisories\/example/);
  assert.match(commentary, /#NetworkSecurity/);
  assert.equal(commentary.match(/#[A-Za-z0-9]+/g)?.length, 5);
  assert.ok(commentary.length >= 700);
  assert.ok(commentary.length <= 2900);
});

test("FortiGate CAPWAP advisory commentary preserves the trust path and exact fixed releases", () => {
  const commentary = composeAdvisoryLinkedInPost(
    {
      affectedVersions: ["FortiOS 7.6.0 through 7.6.3", "FortiOS 7.4.0 through 7.4.8", "FortiOS 7.2.0 through 7.2.11"],
      businessImpact: "A compromised managed extension device could execute unauthorized code or commands on the FortiGate.",
      cves: ["CVE-2025-53844"],
      cvssScore: 8.3,
      evidenceChecklist: ["Inventory every managed extension device authenticated to each FortiGate."],
      exploitationStatus: "Fortinet reports Known Exploited: No.",
      fixedVersions: ["FortiOS 7.6.4 or later", "FortiOS 7.4.9 or later", "FortiOS 7.2.12 or later"],
      products: ["FortiGate", "FortiOS", "FortiAP", "FortiExtender", "FortiSwitch"],
      remediation: "Upgrade each affected FortiGate to the fixed FortiOS release for its train.",
      severity: "high",
      summary: "An out-of-bounds write in the FortiOS CAPWAP daemon crosses a trusted managed-device boundary.",
      technicalExplanation: "An attacker controlling an authenticated FortiAP, FortiExtender, or FortiSwitch can reach execution privileges on FortiGate through CAPWAP.",
      title: "Fortinet FortiOS CAPWAP Out-of-Bounds Write Vulnerability",
      vendor: "Fortinet",
      workaround: "Fortinet documents disabling the CAPWAP daemon when immediate patching is not possible."
    },
    "https://www.qcsstudio.com/security-advisories/fortinet-fortios-capwap-out-of-bounds-cve-2025-53844"
  );
  assert.match(commentary, /FORTINET SECURITY ADVISORY \| CVE-2025-53844/);
  assert.match(commentary, /authenticated FortiAP, FortiExtender, or FortiSwitch can reach execution privileges on FortiGate/i);
  assert.match(commentary, /DEFENDER ACTIONS/);
  assert.match(commentary, /4\. Verify the running fix/i);
  assert.match(commentary, /Upgrade each affected FortiGate to the fixed FortiOS release/i);
  assert.match(commentary, /FortiOS 7\.6\.4 or later; FortiOS 7\.4\.9 or later; FortiOS 7\.2\.12 or later/);
  assert.match(commentary, /#Fortinet #NetworkSecurity #CVE #VulnerabilityManagement #CyberSecurity/);
  assert.equal(commentary.match(/#[A-Za-z0-9]+/g)?.length, 5);
  assert.ok(commentary.length >= 700);
  assert.ok(commentary.length <= 2900);
});

test("LinkedIn publication gate rejects generic, clipped, form-like editorial captions", () => {
  const commentary = [
    "A useful network signal should change a decision...",
    "",
    "THE PRACTICAL SIGNAL",
    "A source surfaced a security topic.",
    "",
    "WHY IT MATTERS",
    "In today's ever-evolving landscape, teams need to act.",
    "",
    "ACTION PATH",
    "1. Review the issue.",
    "2. Take action.",
    "3. Validate it.",
    "",
    articleUrl,
    "",
    "#NetworkSecurity #CyberSecurity #InfoSec"
  ].join("\n");
  const issues = editorialLinkedInQualityIssues(commentary, articleUrl, article("RPKI and ROA checks for BGP route security"));
  assert.ok(issues.some((issue) => /decision-useful content/i.test(issue)));
  assert.ok(issues.some((issue) => /clipped sentences|ellipses/i.test(issue)));
  assert.ok(issues.some((issue) => /stock or reusable/i.test(issue)));
});

test("agent presentation pass repairs mobile structure without losing the draft analysis", () => {
  const trackedUrl = "https://www.qcsstudio.com/resources/dns-bgp?utm_source=linkedin";
  const commentary = [
    "DNS cold starts and BGP route-origin mistakes often appear as separate incidents, but both expose the same operational weakness: teams cannot prove which dependency or route decision changed first when cloud connectivity fails across regions and providers.",
    "Which telemetry should the team inspect first? Which owner can validate the external route?",
    "Validate recursive DNS timing against route-origin and cloud path evidence before changing production policy.",
    "Confirm the DNS resolver path and its cold-cache timing",
    "Validate route-origin authorization for the affected prefixes",
    "Assign one owner to correlate cloud flow logs with BGP evidence",
    trackedUrl,
    "#BGP"
  ].join("\n\n");
  const formatted = formatAgentLinkedInCommentary({
    actions: [
      "Confirm the DNS resolver path and its cold-cache timing",
      "Validate route-origin authorization for the affected prefixes",
      "Assign one owner to correlate cloud flow logs with BGP evidence"
    ],
    commentary,
    hashtags: ["#NetworkEngineering", "#BGP", "#CloudNetworking", "#DNS"],
    url: trackedUrl
  });
  assert.match(formatted, /DNS cold starts and BGP route-origin mistakes/);
  assert.match(formatted, /Practical Next Steps\n1\. Confirm the DNS resolver path/);
  assert.equal(formatted.match(/\?/g)?.length, 2, "one prose question plus the tracked URL query should remain");
  assert.equal(formatted.match(new RegExp(trackedUrl.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g"))?.length, 1);
  assert.match(formatted, /#NetworkEngineering #BGP #CloudNetworking #DNS$/);
  assert.deepEqual(editorialLinkedInQualityIssues(formatted, trackedUrl, article("DNS cold start and BGP route-origin validation")), []);
});

test("evidence-led Fortinet advisory passes exact-fact and presentation gates", () => {
  const qcsUrl = "https://www.qcsstudio.com/security-advisories/fortinet-capwap?utm_source=linkedin";
  const vendorUrl = "https://www.fortiguard.com/psirt/FG-IR-25-999";
  const advisory = {
    affectedVersions: ["FortiOS 7.6.0 through 7.6.3"],
    businessImpact: "A compromised managed extension device could execute unauthorized code or commands on the FortiGate.",
    cves: ["CVE-2025-53844"],
    cvssScore: 8.3,
    evidenceChecklist: ["Verify the running release, CAPWAP peer inventory, event logs, and service health after remediation."],
    exploitationStatus: "Fortinet reports Known Exploited: No.",
    fixedVersions: ["FortiOS 7.6.4 or later", "FortiOS 7.4.9 or later", "FortiOS 7.2.12 or later"],
    products: ["FortiGate", "FortiOS", "FortiAP", "FortiExtender", "FortiSwitch"],
    remediation: "Upgrade each affected FortiGate to the fixed FortiOS release for its train.",
    severity: "high",
    sourceUrl: vendorUrl,
    summary: "An out-of-bounds write in the FortiOS CAPWAP daemon crosses a trusted managed-device boundary.",
    technicalExplanation: "An attacker controlling an authenticated extension device can reach execution privileges on FortiGate through CAPWAP.",
    title: "Fortinet FortiOS CAPWAP Out-of-Bounds Write Vulnerability",
    vendor: "Fortinet",
    workaround: "Fortinet documents disabling the CAPWAP daemon when immediate patching is not possible."
  };
  const commentary = [
    "A trusted FortiGate extension device can become the path into the firewall itself.",
    "That makes CVE-2025-53844 a managed-device trust decision, not simply another perimeter patch.",
    "",
    "Evidence",
    "Exploitation status: Fortinet reports Known Exploited: No.",
    "Vendor severity: High. CVSS 8.3.",
    "The affected scope includes FortiGate running FortiOS 7.6.0 through 7.6.3 with authenticated FortiAP, FortiExtender, or FortiSwitch relationships.",
    "",
    "Why It Matters",
    "The out-of-bounds write sits in the CAPWAP control path. If an extension device is compromised, that established trust may permit unauthorized code or command execution on the FortiGate, concentrating branch and security-policy risk at the firewall.",
    "",
    "Defender Actions",
    "1. Inventory every FortiGate and its authenticated extension peers; record release, owner, and business role.",
    "2. Match each appliance to Fortinet's affected conditions and isolate suspicious or unmanaged extension devices.",
    "3. Upgrade to FortiOS 7.6.4 or later; FortiOS 7.4.9 or later; FortiOS 7.2.12 or later. Where patching must wait, evaluate Fortinet's documented CAPWAP-daemon control against service requirements.",
    "4. Verify the running release, CAPWAP peer inventory, relevant logs, policy service health, and residual exposure before closure.",
    "",
    `Official source: ${vendorUrl}`,
    `QCS technical brief: ${qcsUrl}`,
    "",
    "#Fortinet #FortiOS #CVE #NetworkSecurity #VulnerabilityManagement"
  ].join("\n");
  assert.deepEqual(advisoryLinkedInQualityIssues(commentary, qcsUrl, advisory), []);
});

test("advisory gate blocks incomplete fixes, source evidence, and defender actions", () => {
  const qcsUrl = "https://www.qcsstudio.com/security-advisories/example";
  const advisory = {
    cves: ["CVE-2026-1234"],
    cvssScore: 5.3,
    fixedVersions: ["7.6.2 hotfix 4", "7.7.1 hotfix 2"],
    products: ["Cisco Secure Firewall Management Center"],
    remediation: "Apply the vendor hotfix.",
    severity: "high",
    sourceUrl: "https://sec.cloudapps.cisco.com/security/center/content/CiscoSecurityAdvisory/example",
    summary: "A credential issue affects the management interface.",
    title: "Cisco management credential vulnerability",
    vendor: "Cisco",
    workaround: "No workaround is available."
  };
  const commentary = `${"Cisco published a management security update. ".repeat(20)}\n\n1. Patch the system.\n2. Review logs.\n3. Close the issue.\n\n${qcsUrl}\n\n#CiscoSecurity #CVE #NetworkSecurity`;
  const issues = advisoryLinkedInQualityIssues(commentary, qcsUrl, advisory);
  assert.ok(issues.some((issue) => /exactly four/i.test(issue)));
  assert.ok(issues.some((issue) => /exploitation status/i.test(issue)));
  assert.ok(issues.some((issue) => /CVSS 5\.3/i.test(issue)));
  assert.ok(issues.some((issue) => /7\.7\.1 hotfix 2/i.test(issue)));
  assert.ok(issues.some((issue) => /vendor source/i.test(issue)));
  assert.ok(issues.some((issue) => /no workaround/i.test(issue)));
});
