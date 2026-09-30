import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";

const read = (path) => fs.readFile(new URL(path, import.meta.url), "utf8");
const css = await read("../src/app/qcs-theme.css");
const layout = await read("../src/app/layout.tsx");
const scene = await read("../src/components/domain-scene.tsx");

function luminance(hex) {
  const components = hex.match(/[a-f\d]{2}/gi).map((part) => {
    const value = parseInt(part, 16) / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return components[0] * 0.2126 + components[1] * 0.7152 + components[2] * 0.0722;
}

test("primary theme text and action colors meet normal-text AA contrast", () => {
  for (const [foreground, background] of [
    ["242633", "fcfcfe"], ["4a5063", "f3f3f8"], ["5e6272", "ffffff"],
    ["ffffff", "ad2058"], ["982150", "f9eaf2"], ["285f8f", "edf5fa"],
    ["d0d1dc", "242633"], ["efacc7", "242633"],
  ]) {
    const values = [luminance(foreground), luminance(background)].sort((a, b) => b - a);
    assert.ok((values[0] + 0.05) / (values[1] + 0.05) >= 4.5, `${foreground} on ${background}`);
  }
});

test("shared font files are local and theme overrides load last", () => {
  assert.match(layout, /next\/font\/local/);
  assert.doesNotMatch(layout, /next\/font\/google/);
  assert.ok(layout.indexOf('"./qcs-theme.css"') > layout.indexOf('"./experience-v2.css"'));
  assert.match(layout, /qcs-theme \$\{bodyFont.variable\}/);
});

test("domain scenes retain a fallback, lazy loading and complete lifecycle cleanup", () => {
  for (const pattern of [
    /<Image className="qcs-scene-fallback"/,
    /new IntersectionObserver/,
    /import\("\.\/consulting-home\/scene-engine"\)/,
    /prefers-reduced-motion: reduce/,
    /document\.hidden/,
    /cancelAnimationFrame\(frame\)/,
    /observer\.disconnect\(\)/,
    /controller\.current\?\.dispose\(\)/,
    /aria-pressed=\{paused\}/,
    /Pause illustration/,
  ]) assert.match(scene, pattern);
});

test("new theme retains responsive typography and reduced-motion support", () => {
  assert.match(css, /max-width: 760px/);
  assert.match(css, /max-width: 359px/);
  assert.match(css, /prefers-reduced-motion: reduce/);
  assert.match(css, /focus-visible/);
  assert.doesNotMatch(css, /font-size:\s*[^;]*(?:vw|cqw)/);
  assert.doesNotMatch(css, /letter-spacing:\s*-/);
});
