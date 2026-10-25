import assert from "node:assert/strict";
import test from "node:test";
import { analyzeConfiguration, reportText } from "../src/lib/config-lens/engine.ts";
import { ciscoRule, fortiRule } from "../src/lib/config-lens/rules.ts";
import { documentedCiscoRules, fortiosSections } from "../src/lib/config-lens/documented-rules.ts";
import { commandReferences, referenceForTrain } from "../src/lib/config-lens/references.ts";
import { ciscoExpanded, fortiExpanded } from "./fixtures/config-lens-multiversion.ts";
const selection = (profileId, version) => ({ profileId, version, build: "", configType: "running" });
const command = (version, rawValue, entry = true, operation = "set") => ({ version, rawValue, entry, operation });

for (const version of ["FortiOS 7.2", "FortiOS 7.4", "FortiOS 7.6"]) test(`${version}: new families have same meaning and release-specific evidence`, () => {
  const source = `#config-version=FGT-TEST-${version.slice(8)}.0-FW-build0000-000000:opmode=0\n${fortiExpanded}`;
  const result = analyzeConfiguration(source, selection("fortigate", version));
  assert.equal(result.coverage.unknown, 1);
  assert.equal(result.lines.filter(l => l.reference).length, 32);
  assert.equal(result.coverage.total, source.split("\n").length);
  assert.doesNotMatch(JSON.stringify(result) + reportText(result), /ExpandedSecretCanary/);
  for (const line of result.lines.filter(l => l.reference)) assert.match(commandReferences[line.reference].title, new RegExp(version.replace(".", "\\.")));
  assert.match(result.lines.find(l => /set action block/.test(l.text)).explanation, /not a firewall traffic-deny/);
  assert.match(result.lines.find(l => /set estimated-upstream/.test(l.text)).explanation, /neither a speed test nor a traffic limit/);
  assert.match(result.lines.find(l => /set ip 192.0.2.2/.test(l.text)).section, /system interface secondaryip/);
  assert.equal(result.relationships.some(r => ["192.0.2.50", "192.0.2.51"].includes(r.target)), false);
});

for (const version of ["IOS 15.x", "IOS XE 16.x", "IOS XE 17.x"]) test(`${version}: DHCP is version-mapped, interface IP services remain 17-only`, () => {
  const source = `version ${version.match(/\d+/)[0]}.1\n${ciscoExpanded}`;
  const result = analyzeConfiguration(source, selection("cisco-router", version));
  assert.equal(result.lines.filter(l => l.reference).length, version === "IOS XE 17.x" ? 13 : 10);
  assert.equal(result.coverage.unknown, version === "IOS XE 17.x" ? 1 : 4);
  assert.match(result.lines.find(l => l.text.includes("next-server")).explanation, /not default gateways/);
  assert.match(result.lines.find(l => l.text.includes("network ")).explanation, /slash prefix/);
  assert.doesNotMatch(reportText(result), /ExpandedSecretCanary/);
  assert.equal(result.lines.find(l => l.text.includes("bootfile")).reference, referenceForTrain("ciscoDhcp", version));
});

test("unknown versions, mismatched headers and other products never receive new evidence", () => {
  for (const [input, profileId, version] of [
    [`version 17.1\n${ciscoExpanded}`, "cisco-router", "IOS XE 16.x"],
    [`#config-version=FGT-7.6.4-FW-build0000-000000:opmode=0\n${fortiExpanded}`, "fortigate", "FortiOS 7.2"],
    [fortiExpanded, "fortigate", "Other / unknown"],
    [ciscoExpanded, "cisco-router", "Other / unknown"],
    [fortiExpanded, "fortiweb", "FortiWeb 7.4"],
    [fortiExpanded, "fortiswitch", "FortiSwitchOS 7.4"],
  ]) assert.equal(analyzeConfiguration(input, selection(profileId, version)).lines.some(l => l.reference), false);
  for (const dialect of ["asa", "ftd", "nxos"]) for (const line of ["service dhcp", "next-server 192.0.2.1", "no ip redirects"]) {
    assert.equal(ciscoRule(line, line.startsWith("next") ? "ip dhcp pool X" : line.startsWith("no") ? "interface E1" : "Global", dialect, selection("cisco-switch", "IOS XE 17.x")), undefined);
  }
});

test("new rules reject malformed values, invalid masks, wrong blocks and excessive Cisco server lists", () => {
  const invalid = [
    ["system interface", "defaultgw", "true"], ["system interface", "dhcp-relay-ip", "999.2.3.4"],
    ["system interface", "distance", "256"], ["system interface", "lldp-reception", "global"],
    ["system interface", "estimated-upstream-bandwidth", "10Mbps"], ["system interface", "secondary-IP", "enable extra"],
    ["system interface secondaryip", "ip", "192.0.2.2 255.0.255.0"],
    ["system interface secondaryip", "allowaccess", "https invented"],
    ["system dhcp server", "netmask", "255.0.255.0"], ["system dhcp server", "conflicted-ip-timeout", "59"],
    ["system dhcp server", "ntp-service", "enable"], ["system dhcp server reserved-address", "action", "deny"],
    ["system dns", "timeout", "11"], ["system dns", "retry", "6"], ["system dns", "dns-cache-ttl", "59"],
    ["system dns", "fqdn-min-refresh", "9"], ["system dns", "fqdn-cache-ttl", "86401"],
  ];
  for (const version of ["FortiOS 7.2", "FortiOS 7.4", "FortiOS 7.6"]) for (const [section, key, value] of invalid) assert.equal(fortiRule(section, key, "fortios", command(version, value, fortiosSections[section].entry)), undefined, `${version}/${section}/${key}`);
  for (const version of ["IOS 15.x", "IOS XE 16.x", "IOS XE 17.x"]) for (const text of ["network 192.0.2.0 255.0.255.0", "network 192.0.2.0 /33", "network 192.0.2.0 /24 invented", "netbios-node-type invented", "next-server 999.2.3.4", `next-server ${Array(9).fill("192.0.2.1").join(" ")}`, "utilization mark high 101", "bootfile file extra"]) assert.equal(ciscoRule(text, "ip dhcp pool X", "ios", selection("cisco-router", version)), undefined, text);
  for (const text of ["next-server 192.0.2.1", "import all", "bootfile client.img", "utilization mark high 80 log"]) assert.equal(ciscoRule(text, "router ospf 1", "ios", selection("cisco-router", "IOS XE 17.x")), undefined);
  assert.equal(fortiRule("system interface secondaryip", "distance", "fortios", command("FortiOS 7.4", "10")), undefined);
});

test("version expansion remains family-scoped and every selected reference is primary documentation", () => {
  for (const ref of ["ciscoDns", "ciscoOspf", "ciscoStp", "ciscoIpServices"]) for (const version of ["IOS 15.x", "IOS XE 16.x"]) assert.equal(referenceForTrain(ref, version), undefined);
  for (const ref of ["fortiNtp", "fortiPolicy", "fortiPickup", "fortiSdwan", "fortiHealth", "fortiLogs"]) for (const version of ["FortiOS 7.2", "FortiOS 7.6"]) assert.equal(referenceForTrain(ref, version), undefined);
  for (const rule of [...documentedCiscoRules, ...Object.values(fortiosSections)]) for (const version of ["IOS 15.x", "IOS XE 16.x", "IOS XE 17.x", "FortiOS 7.2", "FortiOS 7.4", "FortiOS 7.6"]) {
    const key = referenceForTrain(rule.reference, version);
    if (key) assert.ok(["www.cisco.com", "docs.fortinet.com"].includes(new URL(commandReferences[key].url).hostname));
  }
  assert.equal(referenceForTrain("fortiDns", "__proto__"), undefined);
});
