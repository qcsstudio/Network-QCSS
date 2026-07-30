import assert from "node:assert/strict";
import test from "node:test";
import { collectEditorialEvidence, isTrustedEditorialUrl } from "../src/lib/editorial-source-policy.ts";

test("editorial evidence accepts approved vendor and government sources", () => {
  assert.equal(isTrustedEditorialUrl("https://sec.cloudapps.cisco.com/security/center/content/example"), true);
  assert.equal(isTrustedEditorialUrl("https://www.cisa.gov/known-exploited-vulnerabilities-catalog"), true);
  assert.equal(isTrustedEditorialUrl("https://www.cert-in.org.in/s2cMainServlet?pageid=PUBADVLIST02"), true);
  assert.equal(isTrustedEditorialUrl("https://blog.cloudflare.com/example"), true);
  assert.equal(isTrustedEditorialUrl("https://docs.cloud.google.com/architecture/blueprints/security-foundations"), true);
});

test("editorial evidence rejects discovery sites, insecure URLs, and hostname lookalikes", () => {
  assert.equal(isTrustedEditorialUrl("https://news.google.com/rss/search?q=network+security"), false);
  assert.equal(isTrustedEditorialUrl("http://www.cisa.gov/example"), false);
  assert.equal(isTrustedEditorialUrl("https://cisa.gov.attacker.example/advisory"), false);
  assert.equal(isTrustedEditorialUrl("data:text/plain,advisory"), false);
});

test("unapproved sources are removed before any evidence fetch", async () => {
  const evidence = await collectEditorialEvidence([
    { label: "Unapproved discovery page", url: "https://example.com/network-news", suppliedSummary: "A headline is not evidence." }
  ]);
  assert.deepEqual(evidence, []);
});
