import assert from "node:assert/strict";
import test from "node:test";
import {
  buildAdvisoryImageContext,
  buildArticleImageContext,
  buildEditorialImagePrompt
} from "../src/lib/editorial-image-prompt.ts";

function article(overrides = {}) {
  return {
    answer: "Validate the route origin against the authorized ROA before accepting the BGP announcement.",
    audience: "Network operators and ISP engineering teams",
    category: "Internet Routing",
    description: "A practical RPKI validation workflow for BGP operations.",
    excerpt: "Connect route announcements to ROA evidence and an accountable change decision.",
    keywords: ["BGP", "RPKI", "ROA", "route origin"],
    primaryKeyword: "RPKI route validation",
    sections: [
      {
        heading: "Map the announcement to authorization",
        body: "Compare the observed origin ASN and prefix length with the published ROA before changing route policy.",
        bullets: ["Capture the prefix and origin ASN", "Record the validator state"]
      }
    ],
    sources: [{ label: "APNIC routing operations guidance", url: "https://example.com/rpki" }],
    takeaways: ["A valid ROA links a prefix to an authorized origin ASN."],
    title: "RPKI and ROA checks before a BGP provider change",
    ...overrides
  };
}

test("article prompt is derived from the complete editorial brief", () => {
  const context = buildArticleImageContext(article());
  const prompt = buildEditorialImagePrompt({ context, title: article().title });

  assert.match(prompt, /origin ASN and prefix length/i);
  assert.match(prompt, /APNIC routing operations guidance/i);
  assert.match(prompt, /Invent this article's visual concept from those facts/i);
  assert.match(prompt, /Do not select or reuse a standard cybersecurity theme/i);
  assert.match(prompt, /No text, letters, numbers, vendor logos/i);
  assert.match(prompt, /Exact QCS branding is applied separately/i);
});

test("different article facts produce materially different visual briefs", () => {
  const routing = buildArticleImageContext(article());
  const packetCapture = buildArticleImageContext(
    article({
      answer: "Capture traffic on the FortiGate ingress and egress interfaces with a narrow host and port filter.",
      category: "Troubleshooting",
      keywords: ["FortiGate", "packet capture", "ingress", "egress"],
      primaryKeyword: "FortiGate packet capture",
      sections: [{ heading: "Choose the capture points", body: "Observe both sides of the policy boundary and preserve timestamps for correlation." }],
      title: "FortiGate packet capture for intermittent VPN failures"
    })
  );

  assert.notEqual(routing, packetCapture);
  assert.match(routing, /ROA/i);
  assert.match(packetCapture, /both sides of the policy boundary/i);
});

test("security advisory context preserves product, exploit, fix, and action evidence", () => {
  const context = buildAdvisoryImageContext({
    affectedVersions: ["FortiOS 7.2.0 through 7.2.7"],
    cves: ["CVE-2026-12345"],
    cvssScore: 9.8,
    exploitationStatus: "Known exploited",
    fixedVersions: ["FortiOS 7.2.8"],
    products: ["FortiGate", "FortiOS SSL VPN"],
    remediation: "Upgrade the exposed gateway and restrict SSL VPN access until validation is complete.",
    severity: "critical",
    summary: "A crafted request can cross the remote-access boundary before authentication.",
    title: "FortiOS SSL VPN vulnerability",
    vendor: "Fortinet",
    workaround: "Restrict the service to trusted source networks."
  });

  assert.match(context, /Known exploited/i);
  assert.match(context, /FortiOS 7\.2\.8/);
  assert.match(context, /CVE-2026-12345/);
  assert.match(context, /before authentication/i);
});

test("prompt explicitly protects full-bleed LinkedIn composition", () => {
  const prompt = buildEditorialImagePrompt({ context: "A specific network operations event.", title: "Example" });
  assert.match(prompt, /full bleed/i);
  assert.match(prompt, /1\.91:1 LinkedIn crop remains complete/i);
  assert.match(prompt, /central 84%/i);
});
