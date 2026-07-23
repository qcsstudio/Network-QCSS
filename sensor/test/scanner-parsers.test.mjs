import test from "node:test";
import assert from "node:assert/strict";
import { parseNmapXml, parseNucleiJsonl, parseZapJson } from "../verifygrid-scanners.mjs";

const target = {
  identifier: "https://app.example.test/",
  host: "app.example.test",
  port: 443,
  type: "url",
  url: new URL("https://app.example.test/")
};

test("Nmap XML becomes bounded normalized service observations", () => {
  const xml = `<?xml version="1.0"?><nmaprun><host><address addr="192.0.2.10" addrtype="ipv4"/><ports><port protocol="tcp" portid="22"><state state="open"/><service name="ssh" product="OpenSSH" version="9.6"/><script id="ssh-hostkey" output="key evidence"/></port></ports></host></nmaprun>`;
  const observations = parseNmapXml(xml, target);
  assert.equal(observations.length, 1);
  assert.equal(observations[0].port, 22);
  assert.match(observations[0].sourceReference, /^sensor:nmap:/);
  assert.equal(observations[0].metadata.scanner, "nmap");
});

test("ZAP JSON omits raw traffic and normalizes passive alerts", () => {
  const content = JSON.stringify({ site: [{ "@name": target.url.origin, alerts: [{ pluginid: "10035", alert: "Strict-Transport-Security Header Not Set", riskcode: "2", confidence: "2", desc: "<p>Header is absent.</p>", solution: "Set HSTS.", instances: [{ uri: target.url.href, method: "GET", evidence: "" }] }] }] });
  const observations = parseZapJson(content, target);
  assert.equal(observations.length, 1);
  assert.equal(observations[0].severity, "medium");
  assert.equal(observations[0].description, "Header is absent.");
  assert.equal(observations[0].metadata.scanner, "owasp-zap");
});

test("Nuclei JSONL retains useful identifiers without raw requests", () => {
  const content = JSON.stringify({ "template-id": "CVE-2026-1234", "matched-at": target.url.href, type: "http", host: target.url.href, port: 443, timestamp: "2026-07-24T10:00:00.000Z", info: { name: "Example signed template", severity: "high", description: "A bounded template matched.", classification: { "cve-id": ["CVE-2026-1234"], "cvss-score": 8.1 }, tags: ["cve"] } });
  const observations = parseNucleiJsonl(content, target);
  assert.equal(observations.length, 1);
  assert.equal(observations[0].severity, "high");
  assert.equal(observations[0].advisoryExternalId, "CVE-2026-1234");
  assert.equal(observations[0].metadata.scanner, "nuclei");
  assert.equal("request" in observations[0].metadata, false);
});
