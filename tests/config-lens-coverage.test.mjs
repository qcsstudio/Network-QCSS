import assert from "node:assert/strict";
import test from "node:test";
import { analyzeConfiguration, reportText } from "../src/lib/config-lens/engine.ts";
import { documentedFortiRule, fortiosSections, documentedCiscoRules } from "../src/lib/config-lens/documented-rules.ts";
import { fortiRule, ciscoRule } from "../src/lib/config-lens/rules.ts";
import { commandReferences, referenceForTrain } from "../src/lib/config-lens/references.ts";
import { ciscoServices, fortiServices } from "./fixtures/config-lens-coverage.ts";
const cisco = { profileId: "cisco-switch", version: "IOS XE 17.x", build: "", configType: "running" };
const forti = { profileId: "fortigate", version: "FortiOS 7.4", build: "", configType: "running" };
const command = (entry, rawValue, operation = "set") => ({ version: "FortiOS 7.4", entry, rawValue, operation });

test("Cisco services have specific meanings, references and complete line accounting", () => {
  const result = analyzeConfiguration(ciscoServices, cisco);
  assert.equal(result.lines.filter(l => l.reference).length, 13);
  assert.equal(result.lines.find(l => l.text.includes("unsupported-option")).status, "unknown");
  assert.match(result.lines.find(l => l.text.trim().startsWith("network ")).explanation, /not a routing-protocol/);
  assert.match(result.lines.find(l => l.text.includes("bpdufilter")).explanation, /can permit switching loops/);
  assert.equal(result.coverage.total, ciscoServices.split("\n").length);
  assert.match(reportText(result), /Vendor reference: Cisco IOS XE 17.x: DHCP server/);
});

test("FortiOS nested DHCP, services, SD-WAN, logs and HA retain exact scope and masking", () => {
  const result = analyzeConfiguration(fortiServices, forti);
  assert.ok(result.lines.filter(l => l.reference).length >= 30);
  assert.equal(result.lines.filter(l => l.status === "unknown").length, 1);
  assert.match(result.lines.find(l => l.text.includes("set start-ip")).section, /system dhcp server ip-range/);
  assert.match(result.lines.find(l => l.text.includes("set source-ip")).explanation, /Local source IPv4/);
  assert.match(result.lines.find(l => l.text.includes("set lease-time")).explanation, /seconds/);
  assert.match(result.lines.find(l => l.text.includes("set syncinterval")).explanation, /minutes/);
  assert.match(result.lines.find(l => l.text.includes("set interval")).explanation, /milliseconds/);
  assert.equal(result.coverage.total, fortiServices.split("\n").length);
  assert.doesNotMatch(JSON.stringify(result) + reportText(result), /CoverageSecretCanary/);
  assert.match(reportText(result), /docs.fortinet.com/);
});

const candidates = ["enable", "local", "specify", "192.0.2.1", "255.255.255.0", "192.0.2.1 255.255.255.0", "reserved", "86400", "300", "1", "cleartext", "auto", "failover", "custom", "60", "ping", "default", "warning", "02:00:00:00:00:01", "port1", "active", "fast", "operational", "on-demand", "seconds", "both", "data-only", "permit"];
for (const [section, def] of Object.entries(fortiosSections)) {
  test(`${section}: all documented fields enforce product, train, entry, operation and complete values`, () => {
    for (const [key, field] of Object.entries(def.fields)) {
      const value = candidates.find(v => field.check(v.split(" ")));
      assert.ok(value, `Missing positive fixture for ${section}/${key}`);
      const good = command(def.entry, value);
      const reference = field.reference || def.reference;
      assert.equal(documentedFortiRule(section, key, "fortios", good)?.reference, reference);
      for (const dialect of ["fortiweb", "fortiswitch", "ios", "nxos"]) assert.equal(documentedFortiRule(section, key, dialect, good), null);
      for (const version of ["FortiOS 7.2", "FortiOS 7.6", "Other / unknown"]) assert.equal(fortiRule(section, key, "fortios", { ...good, version })?.reference, referenceForTrain(reference, version));
      assert.equal(fortiRule(section, key, "fortios", { ...good, entry: !def.entry }), undefined);
      assert.equal(fortiRule(section, key, "fortios", { ...good, operation: "invented" }), undefined);
      assert.equal(fortiRule(section, key, "fortios", command(def.entry, "", "unset"))?.reference, reference);
      assert.equal(fortiRule(section, key, "fortios", command(def.entry, value, "unset")), undefined);
      assert.equal(fortiRule(section, key, "fortios", command(def.entry, "")), undefined);
      if (!field.list) assert.equal(fortiRule(section, key, "fortios", command(def.entry, value, "append")), undefined);
    }
  });
}

test("invalid and unsupported values remain Needs review, never falling through broad rules", () => {
  const invalid = [
    ["system dns", "primary", "999.0.2.1"], ["system dns", "protocol", "magic"],
    ["system ntp", "ntpsync", "maybe"], ["system ntp", "syncinterval", "0"],
    ["system dhcp server", "lease-time", "99"], ["system sdwan health-check", "interval", "10"],
    ["system ha", "session-pickup", "enable trailing"], ["log syslogd setting", "format", "xml"],
  ];
  for (const [section, key, value] of invalid) assert.equal(fortiRule(section, key, "fortios", command(fortiosSections[section].entry, value)), undefined);
  for (const [section, key] of [["system dns", "priority"], ["system ha", "primary"], ["system global", "server"], ["system dhcp server ip-range", "default-gateway"], ["system ntp ntpserver", "syncinterval"]]) assert.equal(fortiRule(section, key, "fortios", command(true, "1")), undefined);
  for (const name of ["__proto__", "constructor", "toString"]) {
    assert.equal(documentedFortiRule(name, "status", "fortios", command(false, "enable")), undefined);
    assert.equal(documentedFortiRule("system dns", name, "fortios", command(false, "enable")), undefined);
  }
});

test("Cisco exact grammar and context prevent misleading DHCP and switch interpretations", () => {
  for (const [text, context] of [["network 192.0.2.0 255.255.255.0", "Global"], ["dns-server 192.0.2.53", "interface Gi0/0"], ["default-router 192.0.2.1", "router ospf 1"], ["ip address 192.0.2.1 255.255.255.0", "Global"], ["spanning-tree portfast", "Global"], ["ip name-server 999.0.2.1", "Global"], ["dns-server 192.0.2.1 trailing", "ip dhcp pool OFFICE"]]) assert.equal(ciscoRule(text, context, "ios", cisco), undefined, text);
  for (const dialect of ["asa", "ftd", "nxos"]) assert.equal(ciscoRule("lease 2", "ip dhcp pool OFFICE", dialect, cisco), undefined);
  for (const version of ["IOS 15.x", "IOS XE 16.x", "Other / unknown"]) assert.equal(ciscoRule("lease 2", "ip dhcp pool OFFICE", "ios", { ...cisco, version })?.reference, referenceForTrain("ciscoDhcp", version));
  assert.equal(ciscoRule("spanning-tree portfast", "interface Gi0/0", "ios", { ...cisco, profileId: "cisco-router" }), undefined);
  assert.match(ciscoRule("network 192.0.2.0 0.0.0.255 area 0", "router ospf 1", "ios", cisco).explanation, /routing-process/);
});

test("export version mismatch withholds new version-scoped explanations", () => {
  const a = analyzeConfiguration(ciscoServices.replace("version 17.15", "version 15.2"), cisco);
  const b = analyzeConfiguration(fortiServices.replace("7.4.9", "7.6.4"), forti);
  assert.equal(a.lines.some(l => l.reference), false);
  assert.equal(b.lines.some(l => l.reference), false);
  assert.ok(a.findings.some(f => /differs/.test(f.title)));
  assert.ok(b.findings.some(f => /differs/.test(f.title)));
});

test("OSPF timers are interface-only, exact, unit-specific and not routing outcomes", () => {
  for (const [text, phrase] of [["ip ospf cost 10", "route cost"], ["ip ospf hello-interval 10", "Seconds"], ["ip ospf dead-interval 40", "Seconds"], ["ip ospf priority 0", "designated-router"]]) {
    assert.match(ciscoRule(text, "interface Gi0/0", "ios", cisco).explanation, new RegExp(phrase));
    assert.equal(ciscoRule(text, "router ospf 1", "ios", cisco), undefined);
    assert.equal(ciscoRule(text + " trailing", "interface Gi0/0", "ios", cisco), undefined);
    assert.equal(ciscoRule(text, "interface Ethernet1/1", "nxos", cisco), undefined);
  }
});

test("unset and list modifications do not pretend to compute effective settings", () => {
  const result = analyzeConfiguration("config system interface\n edit port1\n next\nend\nconfig system dns\n unset protocol\n append protocol dot\n unselect protocol cleartext\nend", forti);
  assert.match(result.lines.find(l => l.text.includes("unset")).explanation, /default is not inferred/);
  for (const line of result.lines.filter(l => /append|unselect/.test(l.text))) assert.match(line.explanation, /final list is not calculated/);
});

test("every documented explanation has an HTTPS primary-vendor reference", () => {
  for (const item of [...documentedCiscoRules, ...Object.values(fortiosSections)]) {
    const source = commandReferences[item.reference];
    assert.ok(source);
    const url = new URL(source.url);
    assert.equal(url.protocol, "https:");
    assert.ok(["www.cisco.com", "docs.fortinet.com"].includes(url.hostname));
    assert.equal(url.search, "");
  }
});
