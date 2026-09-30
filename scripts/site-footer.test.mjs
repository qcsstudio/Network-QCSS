import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const footer = read("src/components/site-footer.tsx");
const theme = read("src/app/qcs-theme.css");

test("one shared footer retains public navigation and accessible branding", () => {
  const layout = read("src/app/layout.tsx");
  assert.equal(layout.match(/<SiteFooter \/>/g)?.length, 1);
  assert.match(footer, /aria-label="Footer links"/);
  assert.match(footer, /aria-label="QuantumCrafters Studio home"/);
  for (const route of ["/services/penetration-testing", "/security-advisories", "/courses/ccna", "/network-tools", "/portal/access", "/privacy"]) {
    assert.ok(footer.includes(`"${route}"`), route);
  }
  assert.match(footer, /href="#main-content"/);
  assert.match(layout, /id="main-content"/);
});

test("footer no longer uses legacy command-theme panels or chips", () => {
  assert.doesNotMatch(footer, /command-footer|footer-command-panel|footer-signal-row|footer-link-grid/);
  assert.match(theme, /\.site-footer\.qcs-footer[^}]+background: #f3f3f8/);
  assert.match(theme, /\.site-footer\.qcs-footer[^}]+font-family: var\(--font-qcs-sans\)/);
});

test("footer has responsive columns, focus indicators and touch targets", () => {
  assert.match(theme, /\.qcs-footer-links[^}]+repeat\(3, minmax\(0, 1fr\)\)/);
  assert.match(theme, /\.qcs-footer-links[^}]+repeat\(2, minmax\(0, 1fr\)\)/);
  assert.match(theme, /\.qcs-footer-links[^}]+grid-template-columns: minmax\(0, 1fr\)/);
  assert.match(theme, /\.qcs-footer-group a[^}]+min-height: 44px/);
  assert.match(theme, /\.qcs-footer :is\(a, button\):focus-visible/);
});

test("footer foreground colors meet normal-text AA on the light surface", () => {
  const luminance = (hex) => {
    const rgb = hex.match(/[a-f0-9]{2}/gi).map((v) => parseInt(v, 16) / 255).map((v) => v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
    return rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722;
  };
  for (const [foreground, background] of [["242633", "f3f3f8"], ["5e6272", "f3f3f8"], ["4a5063", "f3f3f8"], ["285f8f", "f3f3f8"], ["982150", "f3f3f8"], ["ffffff", "ad2058"]]) {
    const light = Math.max(luminance(foreground), luminance(background));
    const dark = Math.min(luminance(foreground), luminance(background));
    assert.ok((light + 0.05) / (dark + 0.05) >= 4.5, `${foreground} on ${background}`);
  }
});
