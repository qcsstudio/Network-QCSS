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
      cves: ["CVE-2026-1234"],
      products: ["Example Router OS"],
      remediation: "Upgrade to the vendor-fixed release and restrict management access until complete.",
      severity: "critical",
      summary: "A vulnerability could permit an authenticated administrator to gain elevated privileges.",
      title: "Example Router OS privilege escalation vulnerability",
      vendor: "Example Networks"
    },
    "https://www.qcsstudio.com/security-advisories/example"
  );
  assert.match(commentary, /CVE-2026-1234/);
  assert.match(commentary, /Example Router OS/);
  assert.match(commentary, /vendor-fixed release/);
  assert.match(commentary, /which Example Networks assets are affected/i);
});
