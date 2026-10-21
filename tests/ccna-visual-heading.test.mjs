import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { loadVisualExplainer } from "./ccna-visual-test-loader.mjs";
import { ccnaTopologyVisual } from "../src/lib/ccna-topology-contract.ts";

const { CcnaVisualExplainer } = await loadVisualExplainer();

for (const count of [1, 2, 5]) {
  test(`Visual heading describes the actual scene with ${count} comparisons`, () => {
    const fixture = ccnaTopologyVisual();
    const story = {
      ...fixture,
      title: "One IPv6 address. Two 64-bit halves.",
      comparisons: fixture.comparisons.slice(0, count - 1)
    };
    const html = renderToStaticMarkup(createElement(CcnaVisualExplainer, { story, artwork: null }));
    assert.match(html, /<h2[^>]*>One IPv6 address\. Two 64-bit halves\.<\/h2>/);
    assert.doesNotMatch(html, /Five topology comparisons|aria-label="Network topologies"/);
    assert.equal(html.includes('aria-label="Visual comparisons"'), count > 1);
  });
}
