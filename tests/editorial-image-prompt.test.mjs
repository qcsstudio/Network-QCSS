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
  const prompt = buildEditorialImagePrompt({ contentType: "content_post", context, title: article().title });

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

test("version-three article images follow the locked establish-explain-resolve chronology", () => {
  const context = buildArticleImageContext(
    article({
      storySpine: {
        primarySubject: "BGP route-origin authorization during an ISP cutover",
        trigger: "The planned cutover changes the ASN that originates the production prefix.",
        mechanism: "RPKI validators compare the observed BGP origin with the published ROA authorization.",
        consequence: "A missing ROA update can make the intended route RPKI Invalid and reduce reachability.",
        operatorDecision: "Publish the authorized origin change before moving the BGP announcement.",
        verification: "Confirm validator propagation, observed origin state, and regional reachability after cutover.",
        secondaryContext: ["Cisco software patching is a separate workstream."],
        visualSequence: [
          "Establish the planned origin-ASN change.",
          "Explain the BGP announcement crossing the RPKI authorization check.",
          "Resolve with a Valid route and retained reachability evidence."
        ]
      },
      sections: [{ heading: "Unrelated long section", body: "This body must not become the visual subject." }]
    })
  );
  assert.match(context, /LOCKED SINGLE-STORY CHRONOLOGY/);
  assert.match(context, /Visual frame 1 - establish/);
  assert.match(context, /Visual frame 3 - resolve/);
  assert.match(context, /must remain visually subordinate/);
  assert.match(context, /This body must not become the visual subject/);
  assert.match(context, /must not override the locked focal subject/);
});

test("security advisory context preserves product, exploit, fix, and action evidence", () => {
  const context = buildAdvisoryImageContext({
    affectedVersions: ["FortiOS 7.2.0 through 7.2.7"],
    businessImpact: "An exposed remote access gateway could put private application access at risk.",
    cves: ["CVE-2026-12345"],
    cvssScore: 9.8,
    evidenceChecklist: ["Confirm the installed FortiOS build", "Record whether SSL VPN is exposed"],
    exploitationStatus: "Known exploited",
    fixedVersions: ["FortiOS 7.2.8"],
    products: ["FortiGate", "FortiOS SSL VPN"],
    remediation: "Upgrade the exposed gateway and restrict SSL VPN access until validation is complete.",
    severity: "critical",
    sourceUrl: "https://fortiguard.fortinet.com/psirt/example",
    summary: "A crafted request can cross the remote-access boundary before authentication.",
    technicalExplanation: "The flaw affects request handling before authentication at the SSL VPN boundary.",
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
  const prompt = buildEditorialImagePrompt({ contentType: "content_post", context: "A specific network operations event.", title: "Example" });
  assert.match(prompt, /full bleed/i);
  assert.match(prompt, /1\.91:1 LinkedIn crop remains complete/i);
  assert.match(prompt, /central 84%/i);
  assert.match(prompt, /Retina and resize quality are mandatory/i);
  assert.match(prompt, /1200 x 627 LinkedIn derivative/i);
  assert.match(prompt, /4\.5:1 effective contrast/i);
  assert.match(prompt, /at least 18 px source type/i);
  assert.match(prompt, /no more than 32 characters or six words/i);
});

test("large advisory identifier sets are compacted before visual generation", () => {
  const context = buildAdvisoryImageContext({
    affectedVersions: ["Ubuntu 22.04 LTS"],
    businessImpact: "A local issue can expose kernel memory on affected systems.",
    cves: Array.from({ length: 500 }, (_, index) => `CVE-2026-${String(index + 1).padStart(4, "0")}`),
    cvssScore: null,
    evidenceChecklist: Array.from({ length: 20 }, (_, index) => `Evidence item ${index + 1}`),
    exploitationStatus: "Not stated by the vendor",
    fixedVersions: ["5.15.0-fixed"],
    products: ["Ubuntu", "linux-azure-fips"],
    remediation: "Install the fixed package and reboot.",
    severity: "unrated",
    sourceUrl: "https://ubuntu.com/security/notices/example",
    summary: "A vendor kernel update addresses multiple vulnerabilities.",
    technicalExplanation: "A crafted filesystem image can cause an out-of-bounds read.",
    title: "Linux kernel advisory",
    vendor: "Ubuntu",
    workaround: null
  });

  assert.match(context, /CVE scope: 500 listed; representative identifiers:/);
  assert.match(context, /497 additional|Do not attempt to visualize the remaining identifiers/);
  assert.doesNotMatch(context, /CVE-2026-0500/);
  assert.ok(context.length < 3_000);
});
