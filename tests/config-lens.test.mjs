import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { analyzeConfiguration, reportText } from "../src/lib/config-lens/engine.ts";
import { maskConfiguration, MAX_BYTES } from "../src/lib/config-lens/masking.ts";
import { profiles } from "../src/lib/config-lens/catalog.ts";
import { samples } from "../src/lib/config-lens/samples.ts";
import { allowedSourceUrl, checkSource, parseUpdateFeed, readBounded } from "../src/lib/config-lens/vendor-updates.ts";

const select = id => ({ profileId: id, version: profiles.find(p => p.id === id).versions[0], build: "", configType: "running" });
for (const profile of profiles) test(`${profile.id}: synthetic fixture has explanations and complete accounting`, () => {
  const r = analyzeConfiguration(samples[profile.id], select(profile.id));
  assert.ok(r.coverage.explained > 0);
  assert.equal(r.coverage.total, r.coverage.explained + r.coverage.context + r.coverage.unknown + r.coverage.masked);
  assert.equal(r.lines.length, samples[profile.id].split("\n").filter(s => s.trim()).length);
  assert.ok(r.entities.length > 0);
  assert.ok(r.findings.some(f => f.title === "Configuration, not live state"));
  assert.equal(JSON.stringify(r).includes("DEMO-NOT-A-REAL-SECRET"), false);
});
test("FortiGate policy relationships resolve declared interfaces and addresses only", () => {
  const r = analyzeConfiguration(samples.fortigate, select("fortigate"));
  const p = r.entities.find(e => e.kind === "policy");
  assert.equal(r.relationships.filter(e => e.from === p.id && e.to).length, 3);
  assert.equal(r.relationships.find(e => e.target === "all").to, undefined);
  assert.ok(r.lines.find(l => l.text.includes("set action accept")).explanation.includes("Configured policy action: accept"));
});
test("VLAN diagram has an explicit reference, not invented physical links", () => {
  const r = analyzeConfiguration(samples["cisco-switch"], select("cisco-switch"));
  assert.equal(r.relationships.length, 1);
  assert.equal(r.relationships[0].target, "10");
  assert.ok(r.relationships[0].to);
});
test("FTD always warns that manager policy is not fully represented", () => {
  const r = analyzeConfiguration(samples["cisco-ftd"], select("cisco-ftd"));
  assert.ok(r.findings.some(f => f.title === "FTD diagnostic output is partial"));
});

test("VRF membership is an interface reference, not a new VRF declaration", () => {
  for (const [id, declaration, membership] of [
    ["cisco-router", "vrf definition BLUE", "vrf forwarding BLUE"],
    ["cisco-router", "ip vrf BLUE", "ip vrf forwarding BLUE"],
    ["cisco-nexus", "vrf context BLUE", "vrf member BLUE"]
  ]) {
    const r = analyzeConfiguration(`hostname demo\n${declaration}\ninterface GigabitEthernet0/0\n ${membership}\n ip address 192.0.2.1 255.255.255.0\nend`, select(id));
    assert.deepEqual(r.entities.filter(e => e.kind === "VRF").map(e => e.name), ["BLUE"]);
    assert.equal(r.relationships[0].target, "BLUE");
    assert.ok(r.relationships[0].to);
    assert.equal(r.entities.find(e => e.kind === "interface").settings.length, 2);
  }
});

test("masked exports can be analyzed again without losing masking or coverage", () => {
  for (const profile of profiles) {
    const first = analyzeConfiguration(samples[profile.id], select(profile.id));
    const second = analyzeConfiguration(first.maskedSource, select(profile.id));
    assert.deepEqual(second.coverage, first.coverage);
    assert.deepEqual(second.entities, first.entities);
    assert.equal(second.maskedCount, first.maskedCount);
  }
});
test("FortiWeb is not interpreted as a FortiGate firewall", () => {
  assert.throws(() => analyzeConfiguration(samples.fortiweb, select("fortigate")), /FortiWeb/);
  assert.throws(() => analyzeConfiguration(samples.fortigate, select("fortiweb")), /FortiOS/);
});
test("vendor and ASA/FTD dialect mismatches fail closed", () => {
  assert.throws(() => analyzeConfiguration(samples.fortigate, select("cisco-router")), /vendor/);
  assert.throws(() => analyzeConfiguration(samples["cisco-router"], select("fortigate")), /vendor/);
  assert.throws(() => analyzeConfiguration(samples["cisco-asa"], select("cisco-router")), /firewall/);
  assert.throws(() => analyzeConfiguration(samples["cisco-ftd"], select("cisco-asa")), /FTD/);
});
test("unknown commands are not silently treated as understood", () => {
  const r = analyzeConfiguration(samples["cisco-router"].replace(/\nend$/, "\nmystery-setting enabled\nend"), select("cisco-router"));
  assert.equal(r.lines.find(l => l.text.includes("mystery-setting")).status, "unknown");
});
test("unsupported context is not interpreted using same-name command in another context", () => {
  const r = analyzeConfiguration(`${samples.fortigate}\nconfig unknown-feature\n edit X\n set action accept\n next\nend`, select("fortigate"));
  assert.equal(r.lines.filter(l => l.text.includes("set action accept")).at(-1).status, "unknown");
});
test("VDOM references are isolated even with duplicate object names", () => {
  const body = `config vdom\n edit BLUE\n config system interface\n edit port1\n set ip 192.0.2.1 255.255.255.0\n next\n end\n next\n edit RED\n config firewall policy\n edit 1\n set srcintf port1\n next\n end\n next\nend`;
  const r = analyzeConfiguration(body, select("fortigate"));
  assert.equal(r.relationships[0].scope, "VDOM RED");
  assert.equal(r.relationships[0].to, undefined);
});
test("incomplete Fortinet blocks and arbitrary text are rejected", () => {
  assert.throws(() => analyzeConfiguration("config system interface\n edit port1\n set ip 192.0.2.1 255.255.255.0", select("fortigate")), /closing/);
  assert.throws(() => analyzeConfiguration("config system interface\n next\nend", select("fortigate")), /Unbalanced/);
  assert.throws(() => analyzeConfiguration("hello world", select("cisco-router")), /No supported/);
});
test("candidate and unknown OS retain caveats", () => {
  const r = analyzeConfiguration(samples["cisco-router"], { ...select("cisco-router"), configType: "candidate", version: "Other / unknown" });
  assert.ok(r.findings.some(f => /Not confirmed/.test(f.title)));
  assert.ok(r.findings.some(f => /OS version/.test(f.title)));
});
test("known Fortinet train mismatch is visible", () => {
  const r = analyzeConfiguration(samples.fortigate, { ...select("fortigate"), version: "FortiOS 7.4" });
  assert.ok(r.findings.some(f => /differs/.test(f.title)));
});
test("passwords, hashes, SNMP, PSKs, PEM and comments are absent from all output", () => {
  const secrets = ["VeryPrivate01", "VeryPrivate02", "VeryPrivate03", "VeryPrivate04", "VeryPrivate05", "VeryPrivate06", "VeryPrivate07", "VeryPrivate08", "VeryPrivate09"];
  const raw = `${samples["cisco-router"]}\nusername demo secret 9 ${secrets[0]}\nsnmp-server community ${secrets[1]} RO\nkey-string ${secrets[2]}\nset psksecret ${secrets[3]}\n-----BEGIN PRIVATE KEY-----\n${secrets[4]}\n-----END PRIVATE KEY-----\ndescription ${secrets[5]}\n! ${secrets[6]}\nset auth-pwd ${secrets[7]}\nset priv-pwd ${secrets[8]}`;
  const r = analyzeConfiguration(raw, select("cisco-router"));
  for (const secret of secrets) { assert.ok(!JSON.stringify(r).includes(secret)); assert.ok(!reportText(r).includes(secret)); }
  assert.equal(r.maskedSource.split("\n").length, raw.split("\n").length);
});
test("multiline Cisco banners and certificate chains are masked", () => {
  const r = maskConfiguration("hostname demo\nbanner motd ^C\nHiddenBannerSecret\n^C\ncrypto pki certificate chain local\n certificate self-signed 01\n  HiddenCertificateValue\n quit\ninterface Gi0/0");
  assert.ok(!r.lines.join("\n").includes("Hidden"));
  assert.ok(r.lines.join("\n").includes("interface Gi0/0"));
});
test("Cisco legacy IKE keys and SNMP destination communities are masked", () => {
  const r = maskConfiguration("hostname demo\ncrypto isakmp key HiddenIkeKey address 192.0.2.1\nsnmp-server host 192.0.2.10 version 2c HiddenTrapCommunity");
  assert.ok(!r.lines.join("\n").includes("Hidden"));
});
test("unsafe formats, large inputs and invalid selections are rejected", () => {
  for (const input of ["<xml>value</xml>", '{"config":1}', "---\nkey: x", "host\x00name", "x".repeat(MAX_BYTES + 1), `hostname demo\n${"x".repeat(2049)}`]) assert.throws(() => analyzeConfiguration(input, select("cisco-router")));
  assert.throws(() => analyzeConfiguration(samples.fortigate, { ...select("fortigate"), profileId: "__proto__" }), /valid/);
  assert.throws(() => analyzeConfiguration(samples.fortigate, { ...select("fortigate"), build: "<script>" }), /valid/);
});
test("forbidden server and storage dependencies are absent from browser analysis", () => {
  for (const file of ["src/lib/config-lens/engine.ts", "src/lib/config-lens/masking.ts", "src/lib/config-lens/rules.ts", "src/components/config-lens.tsx", "src/components/config-lens.worker.ts"]) {
    const source = readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
    assert.doesNotMatch(source, /\b(?:fetch|XMLHttpRequest|WebSocket|sendBeacon|localStorage|sessionStorage|indexedDB|trackBrowserEvent|openai|prisma)\b/, file);
    assert.doesNotMatch(source, /dangerouslySetInnerHTML|\beval\s*\(/, file);
  }
});
test("update source URLs cannot address arbitrary hosts, credentials or ports", () => {
  for (const url of ["http://www.cisco.com", "https://localhost/", "https://www.cisco.com.evil.test", "https://user:pass@www.cisco.com", "https://www.cisco.com:444/"]) assert.equal(allowedSourceUrl(url), false);
  assert.equal(allowedSourceUrl("https://www.cisco.com/"), true);
});
test("vendor RSS parser rejects entities and non-feeds, drops unsafe links", () => {
  assert.throws(() => parseUpdateFeed('<!DOCTYPE a [<!ENTITY e SYSTEM "file:///etc/passwd">]><rss/>'));
  assert.throws(() => parseUpdateFeed("<html><body>Login</body></html>"));
  const items = parseUpdateFeed('<rss><channel><item><title>Official notice</title><link>https://www.fortiguard.com/psirt/FG-IR-XX</link><pubDate>2026-10-24</pubDate></item><item><title>Bad</title><link>javascript:alert(1)</link></item></channel></rss>');
  assert.equal(items.length, 1); assert.equal(items[0].title, "Official notice");
});
test("vendor redirects are validated before fetch and failures remain unavailable", async () => {
  let calls = 0;
  const r = await checkSource({ id: "test", vendor: "Cisco", kind: "advisories", url: "https://www.cisco.com/test" }, async () => { calls++; return new Response(null, { status: 302, headers: { location: "http://127.0.0.1/private" } }); });
  assert.equal(calls, 1); assert.equal(r.status, "unavailable"); assert.equal(r.fingerprint, undefined);
});
test("vendor response bounds apply to actual decoded bytes", async () => {
  await assert.rejects(readBounded(new Response("x".repeat(2 * 1024 * 1024 + 1))));
});

test("vendor feeds negotiate text/xml without relaxing XML validation", async () => {
  const source = { id: "firmware-test", vendor: "Fortinet", kind: "firmware", url: "https://pub.kb.fortinet.com/rss/firmware.xml" };
  const report = await checkSource(source, async (_url, init) => {
    assert.match(init.headers.Accept, /text\/xml/);
    return new Response('<rss><channel><item><title>Firmware notice</title><link>https://docs.fortinet.com/product/fortigate</link></item></channel></rss>', { headers: { "content-type": "text/xml" } });
  });
  assert.equal(report.status, "checked");
  assert.equal(report.items.length, 1);
});
test("admin updater requires auth, same origin, no request body and no database", () => {
  const source = readFileSync(new URL("../src/app/api/admin/config-lens/updates/route.ts", import.meta.url), "utf8");
  assert.match(source, /isAdminRequest\(request\)/); assert.match(source, /status: 401/); assert.match(source, /status: 403/); assert.match(source, /request.body !== null/); assert.doesNotMatch(source, /prisma|openai|request\.json|request\.text/);
});
