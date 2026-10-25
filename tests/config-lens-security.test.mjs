import assert from "node:assert/strict";
import test from "node:test";
import { analyzeConfiguration, reportText } from "../src/lib/config-lens/engine.ts";
import { ciscoRule, fortiRule } from "../src/lib/config-lens/rules.ts";
import { commandReferences } from "../src/lib/config-lens/references.ts";
import { ciscoPortSecurity, ciscoCertificateVpn, fortiSecurity } from "./fixtures/config-lens-security.ts";
const selection = (profileId, version) => ({ profileId, version, build: "", configType: "running" });
const switchCommands = ["switchport port-security", "switchport port-security aging time 0", "switchport port-security aging type absolute", "switchport port-security aging static", "no switchport port-security aging static", "switchport port-security mac-address sticky", "switchport port-security violation protect", "switchport port-security violation restrict", "switchport port-security violation shutdown"];

for (const v of ["16", "17"]) test(`XE ${v}: switch port security and router certificate VPN explanations are scoped and cited`, () => {
  for (const [profile, source, count] of [["cisco-switch", ciscoPortSecurity, 6], ["cisco-router", ciscoCertificateVpn, 2]]) {
    const input = source.replace("17.15", `${v}.12`);
    const result = analyzeConfiguration(input, selection(profile, `IOS XE ${v}.x`));
    assert.equal(result.lines.filter(l => l.reference).length, count);
    assert.equal(result.coverage.unknown, 1);
    assert.equal(result.coverage.total, input.split("\n").length);
    for (const line of result.lines.filter(l => l.reference)) assert.match(commandReferences[line.reference].title, new RegExp(`IOS XE ${v}`));
    assert.doesNotMatch(JSON.stringify(result) + reportText(result), /SecuritySecretCanary/);
  }
  const s = selection("cisco-switch", `IOS XE ${v}.x`);
  for (const command of switchCommands) {
    assert.ok(ciscoRule(command, "interface GigabitEthernet1/0/1", "ios", s)?.reference);
    for (const context of ["Global", "router ospf 1", "crypto ikev2 profile VPN"]) assert.equal(ciscoRule(command, context, "ios", s), undefined);
    assert.equal(ciscoRule(command, "interface Gi0/0", "ios", { ...s, profileId: "cisco-router" }), undefined);
    for (const dialect of ["asa", "ftd", "nxos"]) assert.equal(ciscoRule(command, "interface Gi0/0", dialect, s), undefined);
    for (const version of ["IOS 15.x", "Other / unknown"]) assert.equal(ciscoRule(command, "interface Gi0/0", "ios", { ...s, version }), undefined);
    assert.equal(ciscoRule(command + " trailing", "interface Gi0/0", "ios", s), undefined);
  }
});

test("port-security timers and unsupported syntax do not receive a generic successful explanation", () => {
  const s = selection("cisco-switch", "IOS XE 17.x");
  assert.ok(ciscoRule("switchport port-security aging time 1440", "interface Gi0/0", "ios", s)?.reference);
  for (const suffix of ["aging time -1", "aging time 1441", "aging time 1.5", "aging type idle", "violation shutdown vlan", "maximum 999999999999", "mac-address sticky invalid", "invented"]) assert.equal(ciscoRule(`switchport port-security ${suffix}`, "interface Gi0/0", "ios", s), undefined);
});

test("IKEv2 profile lifetime and trustpoint have exact values, roles and context", () => {
  const s = selection("cisco-router", "IOS XE 17.x"), context = "crypto ikev2 profile VPN";
  for (const text of ["lifetime 60", "lifetime 86400", "pki trustpoint LAB", "pki trustpoint LAB sign", "pki trustpoint LAB verify"]) {
    assert.ok(ciscoRule(text, context, "ios", s)?.reference);
    for (const wrong of ["Global", "interface Tunnel0", "crypto ikev2 proposal VPN", "crypto ipsec profile VPN", "crypto isakmp policy 10"]) assert.equal(ciscoRule(text, wrong, "ios", s), undefined);
    for (const dialect of ["asa", "ftd", "nxos"]) assert.equal(ciscoRule(text, context, dialect, s), undefined);
    assert.equal(ciscoRule(text, context, "ios", { ...s, profileId: "cisco-switch" }), undefined);
  }
  for (const text of ["lifetime 59", "lifetime 86401", "lifetime 1.5", "lifetime 600 extra", "pki trustpoint LAB sign verify", "pki trustpoint LAB invented"]) assert.equal(ciscoRule(text, context, "ios", s), undefined);
});

const fortiCases = [
  ["system switch-interface", "intra-switch-policy", "explicit", "allow", false],
  ["system switch-interface", "member", '"port2" "port3"', '"' + "x".repeat(80) + '"', true],
  ["system switch-interface", "span", "enable", "both", false],
  ["system switch-interface", "span-dest-port", "port4", "x".repeat(16), false],
  ["system switch-interface", "span-source-port", "port2", "x".repeat(80), true],
  ["system switch-interface", "span-direction", "rx", "forward", false],
  ["system switch-interface", "type", "hub", "bridge", false],
  ["firewall vip", "arp-reply", "enable", "yes", false],
  ["firewall vip", "nat-source-vip", "disable", "all", false],
  ["firewall vip", "portmapping-type", "m-to-n", "one-to-one", false],
  ["firewall vip", "srcintf-filter", "port1", "x".repeat(80), true],
  ["vpn ipsec phase1-interface", "passive-mode", "enable", "on", false],
  ["vpn ipsec phase1-interface", "fragmentation-mtu", "16000", "16001", false],
];
for (const v of ["7.2", "7.4", "7.6"]) test(`FortiOS ${v}: thirteen security fields validate values, products, nesting and operations`, () => {
  const version = `FortiOS ${v}`;
  const input = fortiSecurity.replace("7.4.9", `${v}.0`);
  const result = analyzeConfiguration(input, selection("fortigate", version));
  assert.equal(result.lines.filter(l => l.reference).length, 13);
  assert.equal(result.coverage.unknown, 1);
  assert.equal(result.coverage.total, input.split("\n").length);
  for (const l of result.lines.filter(l => l.reference)) assert.ok(commandReferences[l.reference].title.startsWith(`FortiOS ${v}.`));
  assert.match(result.lines.find(l => l.text.includes("set span enable")).explanation, /not spanning-tree/);
  assert.match(result.lines.find(l => l.text.includes("nat-source-vip")).explanation, /Disabled does not mean all source NAT is off/);
  assert.doesNotMatch(JSON.stringify(result) + reportText(result), /SecuritySecretCanary/);
  for (const [section, key, good, bad, list] of fortiCases) {
    const cmd = { version, entry: true, operation: "set", rawValue: good };
    assert.ok(fortiRule(section, key, "fortios", cmd)?.reference, key);
    for (const rawValue of [bad, ""]) assert.equal(fortiRule(section, key, "fortios", { ...cmd, rawValue }), undefined, key);
    if (!list) assert.equal(fortiRule(section, key, "fortios", { ...cmd, rawValue: good + " extra" }), undefined);
    for (const operation of ["append", "unselect"]) assert.equal(Boolean(fortiRule(section, key, "fortios", { ...cmd, operation })?.reference), list);
    assert.equal(fortiRule(section, key, "fortios", { ...cmd, operation: "invented" }), undefined);
    assert.ok(fortiRule(section, key, "fortios", { ...cmd, operation: "unset", rawValue: "" })?.reference);
    assert.equal(fortiRule(section, key, "fortios", { ...cmd, operation: "unset" }), undefined);
    assert.equal(fortiRule(section, key, "fortios", { ...cmd, entry: false }), undefined);
    assert.equal(fortiRule(section, key, "fortios", { ...cmd, version: "Other / unknown" }), undefined);
    for (const dialect of ["fortiweb", "fortiswitch"]) assert.equal(fortiRule(section, key, dialect, cmd), undefined);
    for (const nested of [section + " child", "system global"]) assert.ok(!fortiRule(nested, key, "fortios", cmd)?.reference);
  }
  assert.equal(fortiRule("vpn ipsec phase1-interface", "fragmentation-mtu", "fortios", { version, entry: true, operation: "set", rawValue: "499" }), undefined);
  assert.ok(fortiRule("vpn ipsec phase1-interface", "fragmentation-mtu", "fortios", { version, entry: true, operation: "set", rawValue: "500" })?.reference);
});

test("export mismatches do not borrow the selected release's new explanations", () => {
  assert.equal(analyzeConfiguration(ciscoPortSecurity, selection("cisco-switch", "IOS XE 16.x")).lines.some(l => l.reference), false);
  assert.equal(analyzeConfiguration(fortiSecurity, selection("fortigate", "FortiOS 7.2")).lines.some(l => l.reference), false);
});
