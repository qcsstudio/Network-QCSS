import assert from "node:assert/strict";
import test from "node:test";
import { filterDirectoryTools } from "../src/lib/tool-directory.ts";
import { isWorkspacePath, navigationIsActive, siteNavigation } from "../src/lib/site-navigation.ts";

const tools = [
  { slug: "vendor-scripts", title: "Vendor scripts", category: "Automation", description: "Plan Cisco packet capture commands" },
  { slug: "dns-lookup", title: "DNS lookup", category: "DNS", description: "Inspect domain records" },
  { slug: "subnet-calculator", title: "Subnet calculator", category: "Planning", description: "Plan IP addresses" },
];

test("recommended order preserves priority and all crawlable entries", () => {
  assert.deepEqual(filterDirectoryTools(tools, "", "", "priority"), tools);
});
test("query matches all words without case sensitivity", () => {
  assert.deepEqual(filterDirectoryTools(tools, " CISCO capture ", "", "priority").map((tool) => tool.slug), ["vendor-scripts"]);
});
test("search and category compose rather than overriding one another", () => {
  assert.equal(filterDirectoryTools(tools, "plan", "Planning", "priority").length, 1);
  assert.equal(filterDirectoryTools(tools, "dns", "Planning", "priority").length, 0);
});
test("alphabetical ordering never mutates the source catalog", () => {
  assert.equal(filterDirectoryTools(tools, "", "", "name")[0].slug, "dns-lookup");
  assert.equal(tools[0].slug, "vendor-scripts");
});
test("unmatched input has an explicit empty result", () => {
  assert.equal(filterDirectoryTools(tools, "<script>", "", "priority").length, 0);
});
test("nested courses and editorial pages activate their parent navigation", () => {
  assert.equal(navigationIsActive("/institute", "/courses/ccna/lessons/day-1"), true);
  assert.equal(navigationIsActive("/intelligence", "/security-advisories/example"), true);
  assert.equal(navigationIsActive("/#services", "/services/penetration-testing"), true);
  assert.equal(navigationIsActive("/network-tools", "/network-tools/dns-lookup"), true);
  assert.equal(navigationIsActive("/solutions", "/solutions-other"), false);
});
test("workspace chrome exclusion uses path boundaries", () => {
  for (const path of ["/admin", "/admin/login", "/portal/access", "/verifygrid/onboard"]) assert.equal(isWorkspacePath(path), true);
  for (const path of ["/", "/services/penetration-testing", "/administrator", "/portal-info"]) assert.equal(isWorkspacePath(path), false);
});
test("navigation exposes distinct internal destinations without empty labels", () => {
  for (const group of siteNavigation) {
    assert.ok(group.label && group.href.startsWith("/"));
    assert.equal(new Set(group.links.map((link) => link.href)).size, group.links.length);
    for (const link of group.links) assert.ok(link.title && link.description && link.href.startsWith("/"));
  }
});
