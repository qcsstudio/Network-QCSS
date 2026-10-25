import assert from "node:assert/strict";
import test from "node:test";
import { analyzeConfiguration, reportText } from "../src/lib/config-lens/engine.ts";
import { ciscoRule, fortiRule } from "../src/lib/config-lens/rules.ts";
import { commandReferences } from "../src/lib/config-lens/references.ts";
import { ciscoReleaseCoverage, fortiReleaseCoverage } from "./fixtures/config-lens-release-coverage.ts";
import { ciscoSwitching } from "./fixtures/config-lens-networking.ts";
import { maskConfiguration } from "../src/lib/config-lens/masking.ts";
const selection = (profileId, version) => ({ profileId, version, build: "", configType: "running" });

test("BGP community enums are readable only in their exact context; all secret-like variants stay masked", () => {
  const source = [
    "config router bgp", "config neighbor", "edit 192.0.2.1",
    "set send-community both", "unset send-community",
    "set send-community SecretCanary", "set send-community both SecretCanary",
    "set send-community \"both", "SecretCanary\"", "set password SecretCanary",
    "next", "end", "end",
    "config system snmp community", "edit 1", "set name SecretCanary", "set send-community both", "next", "end",
    "config router bgp", "set send-community both", "end",
  ].join("\n");
  const result = maskConfiguration(source, "fortinet");
  assert.equal(result.lines.filter(line => line === "set send-community both").length, 1);
  assert.equal(result.lines.filter(line => line === "unset send-community").length, 1);
  assert.doesNotMatch(result.lines.join("\n"), /SecretCanary/);
});

for (const version of ["7.2", "7.4", "7.6"]) test(`FortiOS ${version}: 44 exact-source statements, no guessed packet outcomes`, () => {
  const source = fortiReleaseCoverage.replace("7.4.9", `${version}.0`);
  const result = analyzeConfiguration(source, selection("fortigate", `FortiOS ${version}`));
  assert.equal(result.lines.filter(l => l.reference).length, 44);
  assert.equal(result.coverage.unknown, 0);
  assert.equal(result.coverage.total, source.split("\n").length);
  for (const line of result.lines.filter(l => l.reference)) assert.ok(commandReferences[line.reference].title.startsWith(`FortiOS ${version}.`));
  assert.match(result.lines.find(l => l.text.includes("send-community")).explanation, /route-policy tags/);
  assert.match(result.lines.find(l => l.text.includes("next-hop-self")).explanation, /Reflected routes have a separate/);
  assert.match(result.lines.find(l => l.text.includes("route-reflector-client")).explanation, /Controls whether/);
  const keepalive = result.lines.find(l => l.text.includes("set keepalive"));
  assert.match(keepalive.explanation, /idle periods with no data traffic/);
  assert.ok(commandReferences[keepalive.reference].url.endsWith("/administration-guide/604285/phase-2-configuration"));
  assert.match(result.lines.find(l => l.text.includes("tcp-session-without-syn")).explanation, /relax normal connection tracking/);
  assert.doesNotMatch(reportText(result), /NetworkingSecretCanary/);
});

for (const version of ["16", "17"]) test(`IOS XE ${version}: OSPF and IKEv2 use the selected release source`, () => {
  const source = ciscoReleaseCoverage.replace("17.15", `${version}.12`);
  const result = analyzeConfiguration(source, selection("cisco-router", `IOS XE ${version}.x`));
  assert.equal(result.lines.filter(l => l.reference).length, 16);
  assert.equal(result.coverage.unknown, 1);
  for (const line of result.lines.filter(l => l.reference)) assert.ok(commandReferences[line.reference].title.startsWith(`Cisco IOS XE ${version}.`));
  assert.match(result.lines.find(l => l.text.includes("prf sha256")).explanation, /derive IKEv2 key material/);
  assert.doesNotMatch(JSON.stringify(result) + reportText(result), /NetworkingSecretCanary/);
  const switched = analyzeConfiguration(ciscoSwitching.replace("17.15", `${version}.12`), selection("cisco-switch", `IOS XE ${version}.x`));
  assert.equal(switched.lines.filter(l => l.reference).length, 4);
  for (const line of switched.lines.filter(l => l.reference)) assert.ok(commandReferences[line.reference].title.startsWith(`Catalyst 9200 IOS XE ${version}.`));
});

test("IOS 15 recognizes six verified OSPF rules but does not borrow IKEv2 or switch evidence", () => {
  const result = analyzeConfiguration(ciscoReleaseCoverage.replace("17.15", "15.6"), selection("cisco-router", "IOS 15.x"));
  assert.equal(result.lines.filter(l => l.reference).length, 6);
  for (const line of result.lines.filter(l => l.reference)) assert.equal(line.reference, "ciscoOspf15");
  assert.equal(analyzeConfiguration(ciscoSwitching.replace("17.15", "15.6"), selection("cisco-switch", "IOS 15.x")).lines.some(l => l.reference), false);
});

test("new Cisco syntax fails closed for wrong context, unsupported methods, products and extra tokens", () => {
  const chosen = selection("cisco-router", "IOS XE 16.x");
  for (const [text, context] of [["peer OFFICE", "crypto ikev2 keyring KEYS"], ["keyring local KEYS", "crypto ikev2 profile PEER"], ["authentication remote ecdsa-sig", "crypto ikev2 profile PEER"], ["prf sha256 sha512", "crypto ikev2 proposal PROPOSAL"]]) {
    assert.equal(ciscoRule(text, context, "ios", chosen)?.reference, "ciscoIkev216");
    assert.equal(ciscoRule(text, "Global", "ios", chosen), undefined);
    assert.equal(ciscoRule(text + " extra", context, "ios", chosen), undefined);
    for (const dialect of ["asa", "ftd", "nxos"]) assert.equal(ciscoRule(text, context, dialect, chosen), undefined);
    for (const version of ["IOS 15.x", "Other / unknown"]) assert.equal(ciscoRule(text, context, "ios", { ...chosen, version }), undefined);
    assert.equal(ciscoRule(text, context, "ios", { ...chosen, profileId: "cisco-switch" }), undefined);
  }
  for (const text of ["authentication remote invented", "authentication local pre-share key 0 SecretCanary", "keyring aaa KEYS", "prf sha1", "prf sha256 extra"]) assert.equal(ciscoRule(text, text.startsWith("prf") ? "crypto ikev2 proposal P" : "crypto ikev2 profile P", "ios", chosen), undefined);
});

test("new FortiOS options validate enums, ranges, operations and exact sections on every train", () => {
  for (const version of ["FortiOS 7.2", "FortiOS 7.4", "FortiOS 7.6"]) {
    const cmd = rawValue => ({ version, operation: "set", rawValue, entry: true });
    for (const [section, key, good, bad] of [
      ["router bgp neighbor", "next-hop-self", "enable", "yes"],
      ["router bgp neighbor", "soft-reconfiguration", "enable", "inbound"],
      ["router bgp neighbor", "route-reflector-client", "disable", "true"],
      ["router bgp neighbor", "send-community", "extended", "large"],
      ["firewall policy", "anti-replay", "enable", "true"],
      ["firewall policy", "tcp-session-without-syn", "all", "enable"],
      ["vpn ipsec phase1-interface", "keylife", "172800", "172801"],
      ["vpn ipsec phase1-interface", "ike-version", "2", "3"],
      ["vpn ipsec phase2-interface", "keepalive", "enable", "periodic"],
    ]) {
      assert.ok(fortiRule(section, key, "fortios", cmd(good))?.reference);
      for (const invalid of [bad, "", good + " extra"]) assert.equal(fortiRule(section, key, "fortios", cmd(invalid)), undefined);
      assert.equal(fortiRule(section, key, "fortios", { ...cmd(good), operation: "append" }), undefined);
      assert.equal(fortiRule(section, key, "fortios", { ...cmd(""), operation: "unset" })?.category, fortiRule(section, key, "fortios", cmd(good)).category);
      for (const dialect of ["fortiweb", "fortiswitch"]) assert.equal(fortiRule(section, key, dialect, cmd(good)), undefined);
      assert.equal(fortiRule(section, key, "fortios", { ...cmd(good), version: "Other / unknown" }), undefined);
    }
    assert.equal(fortiRule("router bgp", "send-community", "fortios", { ...cmd("both"), entry: false }), undefined);
    assert.equal(fortiRule("vpn ipsec phase2-interface", "keepalive", "fortios", { ...cmd("enable"), entry: false }), undefined);
    assert.equal(fortiRule("vpn ipsec phase1-interface", "keylife", "fortios", cmd("119")), undefined);
  }
});
