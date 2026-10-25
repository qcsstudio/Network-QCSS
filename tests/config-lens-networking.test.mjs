import assert from "node:assert/strict";
import test from "node:test";
import { analyzeConfiguration, reportText } from "../src/lib/config-lens/engine.ts";
import { ciscoRule, fortiRule } from "../src/lib/config-lens/rules.ts";
import { referenceRole } from "../src/lib/config-lens/results.ts";
import { ciscoNetworking, ciscoSwitching, fortiNetworking } from "./fixtures/config-lens-networking.ts";
const selection = (profileId, version) => ({ profileId, version, build: "", configType: "running" });
const router = selection("cisco-router", "IOS XE 17.x"), sw = selection("cisco-switch", "IOS XE 17.x"), forti = selection("fortigate", "FortiOS 7.4");
const command = (entry, rawValue, version = "FortiOS 7.4", operation = "set") => ({ entry, rawValue, version, operation });

test("networking exports explain new commands in their actual blocks and mask VPN keys", () => {
  for (const [input, chosen, refs] of [[ciscoNetworking, router, 9], [ciscoSwitching, sw, 4], [fortiNetworking, forti, 35]]) {
    const result = analyzeConfiguration(input, chosen);
    assert.equal(result.lines.filter(l => l.reference).length, refs);
    assert.equal(result.coverage.unknown, input === ciscoNetworking ? 1 : 0); // keyring peer remains unsupported
    assert.doesNotMatch(JSON.stringify(result) + reportText(result), /NetworkingSecretCanary/);
    assert.ok(result.coverage.total > refs);
    assert.match(reportText(result), /Vendor reference:/);
  }
});

test("routing, switching, firewall and VPN each remain a separate category", () => {
  const result = analyzeConfiguration(fortiNetworking, forti);
  for (const [text, category] of [["set lacp-mode", "Switching"], ["set ebgp-multipath", "Routing"], ["set srcaddr-negate", "Firewall"], ["set pfs", "VPN"]]) assert.equal(result.lines.find(l => l.text.includes(text)).category, category);
  assert.match(result.lines.find(l => l.text.includes("set srcaddr-negate")).explanation, /not the policy's allow\/deny/);
  assert.match(result.lines.find(l => l.text.includes("set protocol 6")).explanation, /not a TCP\/UDP port/);
});

test("new Cisco meanings require IOS XE 17, exact context, family and complete values", () => {
  const cases = [
    ["log-adjacency-changes detail", "router ospf 1", router],
    ["auto-cost reference-bandwidth 10000", "router ospf 1", router],
    ["channel-protocol lacp", "interface Gi1/0/1", sw],
    ["lacp rate fast", "interface Gi1/0/1", sw],
    ["switchport nonegotiate", "interface Gi1/0/1", sw],
    ["spanning-tree guard root", "interface Gi1/0/1", sw],
    ["zone-member security INSIDE", "interface Gi0/0", router],
    ["encryption aes-cbc-256", "crypto ikev2 proposal X", router],
    ["integrity sha256", "crypto ikev2 proposal X", router],
    ["group 14 19", "crypto ikev2 proposal X", router],
    ["proposal X", "crypto ikev2 policy P", router],
    ["set ikev2-profile X", "crypto ipsec profile P", router],
    ["tunnel protection ipsec profile P", "interface Tunnel1", router],
  ];
  for (const [text, context, chosen] of cases) {
    assert.ok(ciscoRule(text, context, "ios", chosen)?.reference, text);
    for (const dialect of ["nxos", "asa", "ftd"]) assert.equal(ciscoRule(text, context, dialect, chosen), undefined, text);
    for (const version of ["IOS 15.x", "IOS XE 16.x", "Other / unknown"]) assert.equal(ciscoRule(text, context, "ios", { ...chosen, version }), undefined, text);
    assert.equal(ciscoRule(text, "Global", "ios", chosen), undefined, text);
    assert.equal(ciscoRule(text + " trailing", context, "ios", chosen), undefined, text);
  }
  for (const [text, ctx] of [["integrity sha1", "crypto ikev2 proposal X"], ["group 2", "crypto ikev2 proposal X"], ["encryption 3des", "crypto ikev2 proposal X"], ["auto-cost reference-bandwidth 0", "router ospf 1"], ["auto-cost reference-bandwidth 4294968", "router ospf 1"], ["lacp rate invented", "interface Gi0/0"], ["spanning-tree guard magic", "interface Gi0/0"]]) assert.equal(ciscoRule(text, ctx, "ios", text.startsWith("lacp") || text.startsWith("spanning") ? sw : router), undefined, text);
  assert.equal(ciscoRule("zone-member security X", "interface Gi0/0", "ios", sw), undefined);
  assert.equal(ciscoRule("lacp rate fast", "interface Gi0/0", "ios", router), undefined);
  assert.equal(ciscoRule("tunnel protection ipsec profile X", "interface Gi0/0", "ios", router), undefined);
});

test("FortiOS nesting, bounded values and per-field sources do not bleed into other products or releases", () => {
  for (const [section, key, value, entry] of [
    ["router bgp", "ebgp-multipath", "enable", false],
    ["router bgp neighbor", "route-map-in", "IMPORT", true],
    ["firewall policy", "srcaddr-negate", "enable", true],
    ["vpn ipsec phase1-interface", "dpd", "on-demand", true],
    ["vpn ipsec phase2-interface", "replay", "enable", true],
  ]) {
    assert.ok(fortiRule(section, key, "fortios", command(entry, value))?.reference);
    for (const version of ["FortiOS 7.2", "FortiOS 7.6", "Other / unknown"]) assert.equal(fortiRule(section, key, "fortios", command(entry, value, version)), undefined);
    for (const dialect of ["fortiweb", "fortiswitch"]) assert.equal(fortiRule(section, key, dialect, command(entry, value)), undefined);
    assert.equal(fortiRule(section, key, "fortios", command(!entry, value)), undefined);
  }
  for (const [section, key, value] of [
    ["system interface", "min-links", "33"], ["router bgp neighbor", "route-map-in", "a".repeat(36)],
    ["firewall policy", "srcaddr-negate", "enable extra"],
    ["vpn ipsec phase1-interface", "dpd", "enable"], ["vpn ipsec phase1-interface", "dpd-retrycount", "11"],
    ["vpn ipsec phase1-interface", "nattraversal", "auto"], ["vpn ipsec phase1-interface", "negotiate-timeout", "301"],
    ["vpn ipsec phase2-interface", "keylifeseconds", "119"], ["vpn ipsec phase2-interface", "keylifekbs", "5119"],
    ["vpn ipsec phase2-interface", "protocol", "256"], ["vpn ipsec phase2-interface", "dst-port", "65536"],
  ]) assert.equal(fortiRule(section, key, "fortios", command(true, value)), undefined, `${section}/${key}`);
  assert.equal(fortiRule("vpn ipsec phase1-interface", "replay", "fortios", command(true, "enable")), undefined);
  assert.equal(fortiRule("vpn ipsec phase2-interface", "dpd", "fortios", command(true, "on-demand")), undefined);
});

test("aggregate settings have verified sources for three FortiOS trains, not FortiSwitchOS", () => {
  for (const version of ["FortiOS 7.2", "FortiOS 7.4", "FortiOS 7.6"]) assert.ok(fortiRule("system interface", "lacp-mode", "fortios", command(true, "active", version))?.reference);
  assert.equal(fortiRule("switch interface", "lacp-mode", "fortiswitch", command(true, "active")), undefined);
});

test("negation graph warns without pretending to calculate final policy state", () => {
  for (const operation of ["set srcaddr-negate enable", "set srcaddr-negate disable", "unset srcaddr-negate"]) {
    const result = analyzeConfiguration(fortiNetworking.replace("set srcaddr-negate enable", operation), forti);
    const source = result.relationships.find(r => r.target === "OFFICE" && r.kind === "address");
    assert.equal(referenceRole(source), "Source address reference (review negation)");
    assert.equal(result.relationships.find(r => r.role === "phase1name").kind, "VPN peer");
    assert.ok(result.relationships.find(r => r.role === "phase1name").to);
  }
  const base = fortiNetworking.replace(/.*(?:srcaddr|dstaddr|service)-negate.*\n/g, "");
  assert.equal(referenceRole(analyzeConfiguration(base, forti).relationships.find(r => r.role === "srcaddr")), "Source address match");
});

test("new version-scoped rules are withheld for contradictory export headers", () => {
  for (const [source, chosen] of [[ciscoNetworking.replace("version 17.15", "version 16.11"), router], [fortiNetworking.replace("7.4.9", "7.6.4"), forti]]) assert.equal(analyzeConfiguration(source, chosen).lines.some(l => l.reference), false);
});
