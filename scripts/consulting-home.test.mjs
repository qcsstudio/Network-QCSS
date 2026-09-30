import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import {
  pointOnPath,
  routesFor,
  shouldAnimate,
} from "../src/components/consulting-home/backgrounds.js";

const content = await fs.readFile(
  new URL(
    "../src/components/consulting-home/home-content.tsx",
    import.meta.url,
  ),
  "utf8",
);
const engine = await fs.readFile(
  new URL("../src/components/consulting-home/scene-engine.js", import.meta.url),
  "utf8",
);
const css = await fs.readFile(
  new URL("../src/components/consulting-home/home.css", import.meta.url),
  "utf8",
);

test("server content preserves core journeys and exactly one page heading", () => {
  assert.equal((content.match(/<h1\b/g) || []).length, 1);
  for (const id of [
    "services",
    "solutions",
    "command-system",
    "process",
    "utilities",
    "tools",
    "engage",
    "learning",
  ])
    assert.ok(content.includes(`id="${id}"`), id);
  for (const url of [
    "/courses/ccna",
    "/services/penetration-testing",
    "/services/network-security-services",
    "/services/cloud-network-services",
    "/network-tools",
    "/resources",
    "/security-advisories",
    "/diagnose",
  ])
    assert.ok(content.includes(`href="${url}"`), url);
  assert.ok(content.includes("<LeadForm"));
  assert.ok(!content.includes("Design Preview"));
});
test("motion gates honor pause, reduced motion, inactive tab and visibility", () => {
  const state = {
    visible: true,
    paused: false,
    reduced: false,
    hidden: false,
    labPaused: false,
    kind: "network",
  };
  assert.equal(shouldAnimate(state), true);
  for (const patch of [
    { visible: false },
    { paused: true },
    { reduced: true },
    { hidden: true },
    { kind: "evidence" },
    { kind: "learning", labPaused: true },
  ])
    assert.equal(shouldAnimate({ ...state, ...patch }), false);
});
test("packet traces use complete finite routes and clamp their endpoints", () => {
  for (const kind of [
    "network",
    "security",
    "cloud",
    "approach",
    "guardrails",
    "learning",
    "contact",
  ]) {
    for (const points of routesFor(kind)) {
      assert.deepEqual(pointOnPath(points, -1), points[0]);
      const end = pointOnPath(points, 2),
        expected = points.at(-1);
      assert.ok(end.every((v, i) => Math.abs(v - expected[i]) < 1e-9));
      assert.ok(pointOnPath(points, 0.53).every(Number.isFinite));
    }
  }
});
test("graphics cleanup releases observers and GPU resources", () => {
  for (const action of [
    "view.observer.disconnect()",
    "view.resizeObserver.disconnect()",
    "view.controls.dispose()",
    "view.renderer.dispose()",
    "view.environmentTarget.dispose()",
    "view.renderer.forceContextLoss()",
  ])
    assert.ok(engine.includes(action));
  assert.match(engine, /\["PC1", "SWITCH", "ROUTER", "PC2"\]/);
});
test("ported stylesheet stays inside the homepage", () => {
  assert.ok(!/(?:^|\})\s*(?:body|html|h1|h2|p|\.section)\s*\{/.test(css));
  assert.ok(css.includes(".consulting-home"));
});
