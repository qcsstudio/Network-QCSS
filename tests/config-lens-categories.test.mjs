import assert from "node:assert/strict";
import test from "node:test";
import { analyzeConfiguration, reportText } from "../src/lib/config-lens/engine.ts";
import { buildResultsIndex, matchesStatement, referenceRole } from "../src/lib/config-lens/results.ts";
import { categoryCatalog, classifyCategory } from "../src/lib/config-lens/categories.ts";
import { samples } from "../src/lib/config-lens/samples.ts";
import { profiles } from "../src/lib/config-lens/catalog.ts";
const select = id => ({ profileId: id, version: profiles.find(p => p.id === id).versions[0], build: "", configType: "running" });

test("every statement in every profile belongs to exactly one indexed category and group", () => {
  for (const profile of profiles) {
    const result = analyzeConfiguration(samples[profile.id], select(profile.id)), index = buildResultsIndex(result);
    assert.equal(index.lines.size, result.lines.length);
    assert.equal([...index.stats.values()].reduce((n, s) => n + s.total, 0), result.coverage.total);
    const grouped = index.groups.flatMap(g => g.lines.map(l => l.line));
    assert.equal(new Set(grouped).size, result.lines.length);
    assert.deepEqual(grouped.sort((a,b) => a-b), result.lines.map(l => l.line));
    for (const [category, stat] of index.stats) {
      assert.ok(categoryCatalog[category]);
      assert.equal(stat.total, stat.explained + stat.context + stat.unknown + stat.masked);
    }
  }
});
test("Fortinet unsupported sections are categorized without upgrading their semantic status", () => {
  const sections = { "system sdwan": "SD-WAN", "ips sensor": "Security profiles", "wireless-controller vap": "Wireless", "log syslogd setting": "Logging", "system dhcp server": "Network services", "system ha": "High availability", "system global": "System", "firewall vip": "NAT", "system admin": "Management", "firewall address": "Objects", "vpn ipsec phase1-interface": "VPN", "router static": "Routing", "system interface": "Interfaces", "system switch-interface": "Switching", "custom-test table": "Other" };
  const input = Object.keys(sections).map(section => `config ${section}\n edit demo\n set unsupported-example enable\n next\nend`).join("\n");
  const result = analyzeConfiguration(input, select("fortigate"));
  for (const line of result.lines.filter(l => l.text.includes("unsupported-example"))) {
    assert.equal(line.category, sections[line.section]); assert.equal(line.status, "unknown");
  }
  assert.equal(result.coverage.explained, 0);
});
test("categories retain exact VDOM identity and matching duplicated entry names", () => {
  const block = name => ` edit ${name}\n config system interface\n edit shared\n set ip 192.0.2.1 255.255.255.0\n set unusual-setting enable\n next\n end\n next`;
  const result = analyzeConfiguration(`config vdom\n${block("one")}\n${block("two")}\nend`, select("fortigate"));
  const index = buildResultsIndex(result), groups = index.groups.filter(g => g.entry === "shared");
  assert.equal(groups.length, 2); assert.notEqual(groups[0].id, groups[1].id);
  assert.deepEqual(groups.map(g => g.scope), ["VDOM one", "VDOM two"]);
  assert.equal(index.groups.find(g => g.section === "system interface" && g.lines[0].text.trim() === "config system interface").entry, "");
  assert.equal(groups[0].lines.at(-1).text.trim(), "next");
  assert.equal(result.lines.filter(l => matchesStatement(l, { category: "Interfaces", scope: "VDOM two", status: "unknown", query: "UNUSUAL" })).length, 1);
  assert.equal(result.lines.filter(l => matchesStatement(l, { groupId: groups[0].id })).length, groups[0].lines.length);
});
test("reverse references preserve ownership, scope and configured role", () => {
  const result = analyzeConfiguration(samples.fortigate, select("fortigate")), index = buildResultsIndex(result);
  const policy = result.entities.find(e => e.kind === "policy");
  const reference = index.outgoing.get(policy.id).find(r => r.role === "srcaddr");
  assert.equal(referenceRole(reference), "Source address match");
  assert.equal(index.incoming.get(reference.to)[0], reference);
  assert.equal(index.entities.get(reference.to).name, "OfficeSubnet");
  assert.equal(index.incoming.has(undefined), false);
  assert.equal(index.outgoing.get(policy.id).length, result.relationships.filter(r => r.from === policy.id).length);
  assert.equal([...index.outgoing.values()].reduce((n, refs) => n + refs.length, 0), result.relationships.length);
});
test("all category metadata and reports derive from masked input only", () => {
  const input = 'config system interface\n edit port1\n next\nend\nconfig system snmp community\n edit 1\n set name SecretCommunityCanary\n next\nend\nconfig system admin\n edit operator\n set password SensitivePasswordCanary\n next\nend';
  const result = analyzeConfiguration(input, select("fortigate")), index = buildResultsIndex(result);
  assert.doesNotMatch(JSON.stringify([...index.groups]) + reportText(result), /SecretCommunityCanary|SensitivePasswordCanary/);
  assert.match(reportText(result), /Administration & access/);
  assert.equal(index.stats.get("Management").masked, 2);
});
test("literal search does not execute patterns and status never changes", () => {
  const result = analyzeConfiguration(samples.fortigate, select("fortigate"));
  assert.equal(result.lines.some(l => matchesStatement(l, { query: "[.*]" })), false);
  assert.equal(result.lines.filter(l => matchesStatement(l, { status: "unknown" })).length, result.coverage.unknown);
});
test("Cisco functional classification separates NAT, services, monitoring and address objects", () => {
  for (const [text, section, expected] of [["ip nat inside", "interface Gi0/0", "NAT"], ["logging host 192.0.2.1", "Global", "Logging"], ["standby 1 priority 110", "interface Gi0/0", "High availability"], ["ip helper-address 192.0.2.2", "interface Gi0/0", "Network services"], ["subnet 192.0.2.0 255.255.255.0", "object network TEST", "Objects"]]) {
    assert.equal(classifyCategory("cisco", text, section, "Structure"), expected);
  }
});
test("new FortiOS field explanations are specific and do not spill into other contexts", () => {
  const result = analyzeConfiguration('config system interface\n edit port1\n set snmp-index 11\n set ip-managed-by-fortiipam disable\n set role lan\n next\nend\nconfig system global\n set snmp-index 11\nend', select("fortigate"));
  const snmp = result.lines.filter(l => l.text.includes("snmp-index"));
  assert.equal(snmp[0].status, "explained"); assert.match(snmp[0].explanation, /SNMP/);
  assert.equal(snmp[1].status, "unknown");
  assert.match(result.lines.find(l => l.text.includes("set role")).explanation, /does not by itself allow traffic/);
});
