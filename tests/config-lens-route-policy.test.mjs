import assert from "node:assert/strict";
import test from "node:test";
import { analyzeConfiguration, reportText } from "../src/lib/config-lens/engine.ts";
import { ciscoRule, fortiRule } from "../src/lib/config-lens/rules.ts";
import { commandReferences } from "../src/lib/config-lens/references.ts";
import { ciscoRoutePolicy, fortiRoutePolicy } from "./fixtures/config-lens-route-policy.ts";
const selection = (profileId, version) => ({ profileId, version, build: "", configType: "running" });

for (const v of ["15", "16", "17"]) test(`IOS ${v}: route-map rules have train-specific evidence and do not assert packet verdicts`, () => {
  for (const profile of ["cisco-router", "cisco-switch"]) {
    const version = v === "15" ? "IOS 15.x" : `IOS XE ${v}.x`;
    const source = ciscoRoutePolicy.replace("17.15", `${v}.12`);
    const result = analyzeConfiguration(source, selection(profile, version));
    assert.equal(result.lines.filter(l => l.reference).length, v === "17" ? 8 : 6);
    assert.equal(result.coverage.unknown, v === "17" ? 1 : 3);
    assert.equal(result.coverage.total, source.split("\n").length);
    for (const line of result.lines.filter(l => l.reference)) {
      assert.match(commandReferences[line.reference].title, new RegExp(`Cisco IOS ${v === "15" ? "" : "XE "}${v}`));
      assert.equal(line.category, "Routing");
    }
    assert.match(result.lines.find(l => l.text.startsWith("route-map")).explanation, /normal routing, not a firewall drop/);
    assert.match(result.lines.find(l => l.text.includes("set local-preference")).explanation, /other selection steps still matter/);
    assert.doesNotMatch(JSON.stringify(result) + reportText(result), /RoutePolicySecretCanary/);
  }
});

for (const v of ["7.2", "7.4", "7.6"]) test(`FortiOS ${v}: fourteen route-filter fields stay scoped and masked`, () => {
  const source = fortiRoutePolicy.replace("7.4.9", `${v}.0`);
  const result = analyzeConfiguration(source, selection("fortigate", `FortiOS ${v}`));
  assert.equal(result.lines.filter(l => l.reference).length, 14);
  assert.equal(result.coverage.unknown, 1);
  assert.equal(result.coverage.total, source.split("\n").length);
  for (const line of result.lines.filter(l => l.reference)) {
    assert.ok(commandReferences[line.reference].title.startsWith(`FortiOS ${v}.`));
    assert.equal(line.category, "Routing");
    assert.match(line.section, /^router (?:prefix-list|route-map) rule$/);
  }
  assert.match(result.lines.find(l => l.text.includes("match-ip-nexthop")).explanation, /does not set a new next hop/);
  assert.match(result.lines.find(l => l.section === "router route-map rule" && l.text.includes("set action")).explanation, /not a firewall/);
  assert.doesNotMatch(JSON.stringify(result) + reportText(result), /RoutePolicySecretCanary/);
});

test("Cisco prefix ranges, sequences and unsupported grammar fail closed", () => {
  const s = selection("cisco-router", "IOS XE 17.x");
  for (const text of ["ip prefix-list P permit 0.0.0.0/0", "ip prefix-list P permit 10.0.0.0/8 ge 24 le 24", "ip prefix-list P seq 4294967294 deny 192.0.2.0/24", "ip prefix-list P permit 10.0.0.0/8 le 24"]) assert.equal(ciscoRule(text, "Global", "ios", s)?.reference, "ciscoPrefix");
  for (const suffix of ["seq 0 permit 10.0.0.0/8", "seq 4294967295 permit 10.0.0.0/8", "permit 999.0.0.0/8", "permit 10.0.0.0/33", "permit 10.0.0.0/8 ge 8", "permit 10.0.0.0/8 ge 25 le 24", "permit 10.0.0.0/8 le 7", "permit 10.0.0.0/8 le 24 trailing", "permit 10.0.0.0/8 ge 33", "permit 10.0.0.0/8 le 33"]) assert.equal(ciscoRule(`ip prefix-list P ${suffix}`, "Global", "ios", s), undefined, suffix);
  for (const context of ["interface Gi0/0", "router bgp 65000", "route-map P permit 10"]) assert.equal(ciscoRule("ip prefix-list P permit 10.0.0.0/8", context, "ios", s), undefined);
});

test("Cisco route-map grammar is bounded, context-specific and never borrowed by other dialects", () => {
  const s = selection("cisco-router", "IOS XE 17.x"), context = "route-map IMPORT permit 10";
  for (const text of ["set local-preference 200", "set tag 300", "match tag 100 200", "match metric 20", "match ip address prefix-list OFFICE"]) {
    assert.ok(ciscoRule(text, context, "ios", s)?.reference);
    for (const c of ["Global", "interface Gi0/0", "router bgp 65000", "route-map IMPORT invented 10", "route-map IMPORT permit 9999999999", "route-map IMPORT permit 10 extra"]) assert.equal(ciscoRule(text, c, "ios", s), undefined, c);
    for (const dialect of ["asa", "ftd", "nxos"]) assert.equal(ciscoRule(text, context, dialect, s), undefined);
    assert.equal(ciscoRule(text, context, "ios", { ...s, version: "Other / unknown" }), undefined);
  }
  for (const text of ["set local-preference 4294967296", "set tag -1", "match tag 4294967296", "match metric 20 extra", "set local-preference 200 extra"]) assert.equal(ciscoRule(text, context, "ios", s), undefined);
  const result = analyzeConfiguration("hostname LAB\nroute-map P permit 9999999999\n set local-preference 200\n!\n set tag 100", s);
  assert.equal(result.lines.some(l => l.reference), false);
});

test("Fortinet exact rules enforce numeric bounds, list-name limits, operations and products", () => {
  for (const version of ["FortiOS 7.2", "FortiOS 7.4", "FortiOS 7.6"]) {
    for (const [section, key, good, bad] of [
      ["router prefix-list rule", "action", "permit", "accept"],
      ["router prefix-list rule", "prefix", "10.0.0.0 255.0.0.0", "10.0.0.0 255.0.255.0"],
      ["router prefix-list rule", "ge", "0", "33"],
      ["router prefix-list rule", "le", "32", "-1"],
      ["router route-map rule", "action", "deny", "drop"],
      ["router route-map rule", "match-ip-address", "OFFICE", "x".repeat(36)],
      ["router route-map rule", "match-ip-nexthop", "NEXT-HOPS", "A B"],
      ...["match-tag", "match-metric", "set-local-preference", "set-weight", "set-tag", "set-metric"].map(k => ["router route-map rule", k, "4294967295", "4294967296"]),
      ["router route-map rule", "set-ip-nexthop", "192.0.2.1", "999.0.2.1"],
    ]) {
      const cmd = { version, entry: true, operation: "set", rawValue: good };
      assert.ok(fortiRule(section, key, "fortios", cmd)?.reference, key);
      for (const rawValue of [bad, "", good + " extra"]) assert.equal(fortiRule(section, key, "fortios", { ...cmd, rawValue }), undefined);
      for (const operation of ["append", "unselect", "invented"]) assert.equal(fortiRule(section, key, "fortios", { ...cmd, operation }), undefined);
      assert.ok(fortiRule(section, key, "fortios", { ...cmd, operation: "unset", rawValue: "" })?.reference);
      assert.equal(fortiRule(section, key, "fortios", { ...cmd, operation: "unset" }), undefined);
      assert.equal(fortiRule(section, key, "fortios", { ...cmd, entry: false }), undefined);
      for (const dialect of ["fortiweb", "fortiswitch"]) assert.equal(fortiRule(section, key, dialect, cmd), undefined);
      for (const wrong of ["router prefix-list", "router route-map", "system interface", "firewall policy"]) {
        const rule = fortiRule(wrong, key, "fortios", cmd);
        assert.ok(!rule?.reference?.startsWith("fortiRoutePolicy") && !rule?.reference?.startsWith("fortiPrefix"));
      }
      assert.equal(fortiRule(section, key, "fortios", { ...cmd, version: "Other / unknown" }), undefined);
    }
    assert.ok(fortiRule("router prefix-list rule", "prefix", "fortios", { version, entry: true, operation: "set", rawValue: "any" }));
  }
});

test("export-version mismatches withhold all new routing-policy references", () => {
  assert.equal(analyzeConfiguration(ciscoRoutePolicy, selection("cisco-router", "IOS 15.x")).lines.some(l => l.reference), false);
  assert.throws(() => analyzeConfiguration(fortiRoutePolicy, selection("fortigate", "FortiOS 7.6")), /No supported configuration statements/);
});
