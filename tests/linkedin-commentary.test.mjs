import assert from "node:assert/strict";
import test from "node:test";
import { composeAdvisoryLinkedInPost, composeEditorialLinkedInPost } from "../src/lib/linkedin-commentary.ts";

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

test("security advisory commentary carries product, CVE, remediation, and decision context", () => {
  const commentary = composeAdvisoryLinkedInPost(
    {
      affectedVersions: ["7.2 through 7.6"],
      businessImpact: "An attacker could read sensitive management data and combine the access with another weakness.",
      cves: ["CVE-2026-1234"],
      cvssScore: 5.3,
      evidenceChecklist: ["Confirm whether the management interface is reachable from an untrusted network."],
      exploitationStatus: "The vendor reports active exploitation in July 2026.",
      fixedVersions: ["7.6.2 hotfix 4"],
      products: ["Example Router OS"],
      remediation: "Upgrade to the vendor-fixed release and restrict management access until complete.",
      severity: "critical",
      summary: "A static credential permits access to a low-privileged management account.",
      technicalExplanation: "A static credential embedded in the management interface permits an unauthenticated remote actor to sign in as a low-privileged user. The vendor rates this high because it can be combined with other management vulnerabilities to elevate privileges.",
      title: "Example Router OS static credential vulnerability",
      vendor: "Example Networks",
      workaround: "No workaround is available."
    },
    "https://www.qcsstudio.com/security-advisories/example"
  );
  assert.match(commentary, /#NetworkSecurity EXAMPLE NETWORKS CVE-2026-1234: ACTIVELY EXPLOITED/);
  assert.match(commentary, /Example Router OS/);
  assert.match(commentary, /fixed release or version-specific hotfix/);
  assert.match(commentary, /actively exploited/i);
  assert.match(commentary, /static credentials in the management web interface/i);
  assert.match(commentary, /7\.6\.2 hotfix 4/i);
  assert.match(commentary, /inspect authentication logs/i);
  assert.doesNotMatch(commentary, /Can your team prove/i);
  assert.doesNotMatch(commentary, /\|/);
  assert.match(commentary, /EXAMPLE NETWORKS CRITICAL \/ CVSS 5\.3 \/ CHAINABLE PRIVILEGE RISK \/ NO WORKAROUND/);
  assert.match(commentary, /WHY EXAMPLE NETWORKS RATES IT CRITICAL/);
  assert.match(commentary, /DEFENDER ACTIONS/);
  assert.match(commentary, /QCS technical brief with the vendor source: https:\/\/www\.qcsstudio\.com\/security-advisories\/example/);
  assert.match(commentary, /#NetworkSecurity/);
  assert.doesNotMatch(commentary, /\.\.\./);
  assert.match(commentary.trimEnd(), /#VulnerabilityManagement$/);
  const preview = commentary.split("\n").slice(0, 3).join("\n");
  assert.match(preview, /ACTIVELY EXPLOITED/);
  assert.match(preview, /CVSS 5\.3/);
  assert.match(preview, /NO WORKAROUND/);
  assert.match(preview, /CHAINABLE PRIVILEGE RISK/);
  assert.match(preview, /Fixes 7\.6/);
  assert.match(preview, /inventory, restrict UI, patch, verify logs/);
  assert.ok(commentary.length < 1800);
});
