import assert from "node:assert/strict";
import test from "node:test";
import { networkUtilityTools } from "../src/lib/network-tools.ts";
import { filterDirectoryTools } from "../src/lib/tool-directory.ts";

test("the analyzer has one existing canonical card and is discoverable by legacy/vendor aliases", () => {
  const tools = networkUtilityTools.map(({ slug, title, description, category, searchIntent }) => ({ slug, title, description, category, keywords: searchIntent }));
  const cards = tools.filter(tool => tool.slug === "network-configuration-explainer");
  assert.equal(cards.length, 1);
  assert.equal(cards[0].title, "Network Configuration Analyzer");
  for (const query of ["QCS Config Lens", "configuration analyzer", "Router", "Catalyst", "IOS XE", "NEXUS", "FortiSwitch", "ASA", "FTD", "VDOM", "before after"]) assert.ok(filterDirectoryTools(tools, query, "", "name").some(tool => tool.slug === cards[0].slug), query);
  assert.equal(filterDirectoryTools(cards, "Nexus", "DNS tools", "name").length, 0);
  assert.equal(filterDirectoryTools(cards, "nonexistent [.*]", "", "name").length, 0);
});
