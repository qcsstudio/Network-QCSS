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

test("security advisory commentary exposes the complete decision brief before LinkedIn's 300-character cutoff", () => {
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
  assert.match(commentary, /#CiscoSecurity CVE-2026-1234: ACTIVELY EXPLOITED/);
  assert.match(commentary, /actively exploited/i);
  assert.match(commentary, /\n\nRISK: Cisco Critical; CVSS 5\.3\nLow-priv FMC access can escalate privileges\. No workaround\./);
  assert.match(commentary, /\n\nACT: Inventory; restrict UI; patch FMC; check logs\./);
  assert.doesNotMatch(commentary, /\|/);
  assert.match(commentary, /\n\nFIX: 7\.6/);
  assert.match(commentary, /\n\nREAD: https:\/\/qcsstudio\.com\/a\/1234/);
  assert.match(commentary, /#NetworkSecurity/);
  assert.equal(commentary.match(/#[A-Za-z0-9]+/g)?.length, 5);
  assert.ok(commentary.length <= 300);
});
