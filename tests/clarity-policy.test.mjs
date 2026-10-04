import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { defaultConsent, parseConsent } from "../src/lib/browser-consent.ts";
import { hasReplayConsent, isClarityPage, isClarityReferrerSafe } from "../src/lib/clarity-policy.ts";
import nextConfig from "../next.config.mjs";

const origin = "https://www.qcsstudio.com";

test("recording requires separate explicit analytics and replay choices", () => {
  for (const saved of [null, "null", "false", "[]", "invalid", '{"analytics":true}', '{"analytics":"true","sessionReplay":true}', '{"sessionReplay":true}']) {
    assert.equal(hasReplayConsent(parseConsent(saved)), false, saved);
  }
  assert.equal(hasReplayConsent(parseConsent('{"analytics":true,"sessionReplay":true}')), true);
  assert.equal(hasReplayConsent(defaultConsent), false);
});

test("allow only public business and editorial routes", () => {
  for (const path of ["/", "/#contact", "/services", "/services/network-security-services", "/solutions/sase-readiness/", "/resources", "/resources/network-guide", "/security-advisories/cisco-fix", "/intelligence"]) {
    assert.equal(isClarityPage(path, origin), true, path);
  }
});

test("private workflows, student pages, tools, parameters and unknown URLs fail closed", () => {
  for (const path of ["/admin", "/admin/login", "/portal/access#token=secret", "/verifygrid/onboard", "/api/health", "/network-tools", "/network-tools/strong-password-generator", "/tools/network-risk-score", "/diagnose", "/courses/ccna", "/institute", "/services/network-security-training", "/privacy", "/new-private-area", "/?email=test@example.com", "/?utm_source=linkedin", "/#token", "/resources?preview=true", "/services/a/b", "/resources/a%40b.com", "https://other.example/services"]) {
    assert.equal(isClarityPage(path, origin), false, path);
  }
});

test("sensitive referrers cannot enter a recording", () => {
  assert.equal(isClarityReferrerSafe("", origin), true);
  assert.equal(isClarityReferrerSafe("https://www.google.com/", origin), true);
  assert.equal(isClarityReferrerSafe(`${origin}/services`, origin), true);
  for (const referrer of [`${origin}/admin`, `${origin}/portal`, `${origin}/courses/ccna`, `${origin}/?email=private`, "https://example.com/?token=secret", "invalid"]) {
    assert.equal(isClarityReferrerSafe(referrer, origin), false, referrer);
  }
});

test("Clarity CSP is limited to scripts, collection and image hosts", async () => {
  const rules = await nextConfig.headers();
  const csp = rules.find(rule => rule.source === "/(.*)").headers.find(header => header.key === "Content-Security-Policy").value;
  const directives = Object.fromEntries(csp.split("; ").map(value => { const [name, ...hosts] = value.split(" "); return [name, hosts]; }));
  assert.deepEqual(directives["default-src"], ["'self'"]);
  assert.ok(directives["script-src"].includes("https://www.clarity.ms"));
  assert.ok(directives["script-src"].includes("https://scripts.clarity.ms"));
  assert.ok(directives["connect-src"].includes("https://*.clarity.ms"));
  assert.ok(!directives["script-src"].includes("https://*.clarity.ms"));
});

test("lead form is masked and a successful lead passes only the event name", () => {
  const form = readFileSync(new URL("../src/components/lead-form.tsx", import.meta.url), "utf8");
  const client = readFileSync(new URL("../src/lib/clarity-client.ts", import.meta.url), "utf8");
  assert.match(form, /data-clarity-mask="true"/);
  assert.match(client, /callClarity\("event", "generate_lead"\)/);
  assert.doesNotMatch(client, /callClarity\("identify"/);
  assert.match(client, /ad_Storage: "denied"/);
});
