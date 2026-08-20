import assert from "node:assert/strict";
import test from "node:test";
import { advisorySourceDefinitions, parseAdvisoryFeed, parseMsrcAdvisories } from "../src/lib/advisories.ts";

function source(slug) {
  const definition = advisorySourceDefinitions.find((item) => item.slug === slug);
  assert.ok(definition, `Missing ${slug} source definition.`);
  return definition;
}

test("Google Cloud Atom bulletins survive redirects only on approved official hosts", () => {
  const atom = `<?xml version="1.0"?><feed xmlns="http://www.w3.org/2005/Atom"><entry><title>GCP-2026-001: Cloud Armor network security update</title><id>https://docs.cloud.google.com/support/bulletins#gcp-2026-001</id><link rel="alternate" href="https://docs.cloud.google.com/support/bulletins#gcp-2026-001"/><updated>2026-08-20T04:00:00Z</updated><summary>High severity Google Cloud Armor gateway vulnerability affecting network policy.</summary></entry></feed>`;
  const candidates = parseAdvisoryFeed(atom, source("google-cloud-security-bulletins"));
  assert.equal(candidates.length, 1);
  assert.equal(candidates[0].vendor, "Google Cloud");
  assert.match(candidates[0].sourceUrl, /^https:\/\/docs\.cloud\.google\.com\//);

  const poisoned = atom.replaceAll("https://docs.cloud.google.com", "https://attacker.example");
  assert.equal(parseAdvisoryFeed(poisoned, source("google-cloud-security-bulletins")).length, 0);
});

test("AWS RSS security bulletins are parsed as official cloud advisories", () => {
  const rss = `<?xml version="1.0"?><rss><channel><item><title>AWS WAF HTTP/2 security bulletin</title><link>https://aws.amazon.com/security/security-bulletins/AWS-2026-001/</link><pubDate>Thu, 20 Aug 2026 05:00:00 GMT</pubDate><description>AWS WAF and load balancer network controls require an update.</description></item></channel></rss>`;
  const candidates = parseAdvisoryFeed(rss, source("aws-security-bulletins"));
  assert.equal(candidates.length, 1);
  assert.equal(candidates[0].vendor, "Amazon Web Services");
  assert.deepEqual(candidates[0].products, ["AWS WAF"]);
});

test("MSRC CVRF parsing retains product, risk, exploitation, and fixed-build evidence", () => {
  const payload = JSON.stringify({
    documents: [{
      id: "2026-Aug",
      initialReleaseDate: "2026-08-11T08:00:00Z",
      currentReleaseDate: "2026-08-20T08:00:00Z",
      document: {
        ProductTree: { FullProductName: [{ ProductID: "azure-1", Value: "Microsoft Azure VPN Gateway" }] },
        Vulnerability: [{
          CVE: "CVE-2026-9999",
          Title: { Value: "Azure VPN Gateway Remote Code Execution Vulnerability" },
          Notes: [{ Value: "An unauthenticated network request can reach the Azure VPN Gateway control path." }],
          ProductStatuses: [{ ProductID: ["azure-1"], Type: 3 }],
          Threats: [
            { Description: { Value: "Critical" }, Type: 3 },
            { Description: { Value: "Publicly Disclosed:No;Exploited:Yes" }, Type: 1 }
          ],
          CVSSScoreSets: [{ BaseScore: 9.8, Vector: "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H" }],
          Remediations: [{ Description: { Value: "KB5999999" }, FixedBuild: "10.0.99999.1", Type: 2, URL: "https://support.microsoft.com/help/5999999" }],
          RevisionHistory: [{ Date: "2026-08-20T08:00:00Z", Number: "1.1" }]
        }]
      }
    }]
  });
  const candidates = parseMsrcAdvisories(payload, source("microsoft-msrc"));
  assert.equal(candidates.length, 1);
  assert.equal(candidates[0].cvssScore, 9.8);
  assert.equal(candidates[0].severity, "critical");
  assert.match(candidates[0].exploitationStatus, /active exploitation/i);
  assert.deepEqual(candidates[0].products, ["Microsoft Azure VPN Gateway"]);
  assert.deepEqual(candidates[0].fixedVersions, ["10.0.99999.1", "KB5999999"]);
  assert.match(candidates[0].sourceUrl, /msrc\.microsoft\.com\/update-guide/);
});
