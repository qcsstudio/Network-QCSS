import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { readFile, writeFile } from "node:fs/promises";
import { profiles } from "../src/lib/config-lens/catalog";
import { samples } from "../src/lib/config-lens/samples";
import { fortinetFullBackup } from "./fixtures/config-lens-fortinet";

const path = "/network-tools/network-configuration-explainer";
const canary = "SyntheticProductionPrivacyCanary-NOT-A-CREDENTIAL";
test.use({ actionTimeout: 15000, navigationTimeout: 60000 });
test.beforeEach(async ({ context, baseURL }) => {
  test.skip(process.env.CONFIG_LENS_LIVE_QA !== "1", "Explicit read-only live verification only");
  expect(baseURL).toBe("https://www.qcsstudio.com");
  // This isolated test profile declines optional tracking before entering any configuration.
  // It avoids the separate consent-write endpoint while the database is suspended.
  await context.addInitScript(() => localStorage.setItem("network-qcss-consent", JSON.stringify({ necessary: true, analytics: false, marketing: false, personalization: false, sessionReplay: false })));
});
async function observe(page: Page) {
  const requests: string[] = [], errors: string[] = [];
  page.on("request", r => requests.push(`${r.method()} ${r.url()} ${r.postData() || ""}`));
  page.on("pageerror", e => errors.push(e.message));
  await page.goto(path);
  await expect(page.getByRole("button", { name: "Explain configuration", exact: true })).toBeVisible();
  return { requests, errors };
}
function privateChecks(observation: { requests: string[]; errors: string[] }) {
  expect(observation.errors).toEqual([]);
  expect(observation.requests.filter(r => /^(?:POST|PUT|PATCH|DELETE) |\/api\/|clarity\.ms|google-analytics|openai\.com/.test(r))).toEqual([]);
  expect(observation.requests.some(r => r.includes(canary) || /Hidden\w*Canary/.test(r))).toBe(false);
}
async function exportMasked(page: Page) {
  await page.getByRole("button", { name: "Masked text", exact: true }).click();
  await expect(page.getByRole("button", { name: "Download reviewed text" })).toBeDisabled();
  await page.getByLabel("I reviewed this text").check();
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download reviewed text" }).click();
  return readFile((await (await download).path())!, "utf8");
}

test("production page headers and all eight profiles use the local worker", async ({ page }, testInfo) => {
  const observation = await observe(page);
  const response = await page.request.get(path);
  expect(response.status()).toBe(200);
  expect(response.headers()["content-security-policy"]).toContain("worker-src 'self'");
  expect(response.headers()["content-security-policy"]).not.toContain("clarity.ms");
  expect(response.headers()["referrer-policy"]).toBe("no-referrer");
  for (const profile of profiles) {
    await page.getByRole("combobox", { name: "Vendor", exact: true }).selectOption(profile.vendor);
    await page.getByRole("combobox", { name: "Device family", exact: true }).selectOption(profile.id);
    await page.getByRole("button", { name: "Try an example", exact: true }).click();
    await page.getByRole("button", { name: "Explain configuration", exact: true }).click();
    await expect(page.getByRole("heading", { name: `${profile.name} analysis`, exact: true })).toBeVisible();
    await expect(page.getByRole("tab", { name: "Categories", exact: true })).toHaveAttribute("aria-selected", "true");
  }
  privateChecks(observation);
  await writeFile(testInfo.outputPath("public-headers.json"), JSON.stringify({ status: response.status(), headers: response.headers(), profiles: profiles.map(p => p.id), requests: observation.requests, errors: observation.errors }, null, 2));
});

test("production categories, reverse references, source filters and mobile layout", async ({ page }, testInfo) => {
  const observation = await observe(page);
  await page.getByRole("combobox", { name: "Vendor", exact: true }).selectOption("fortinet");
  const extra = `config vdom\n edit Branch\n config system interface\n edit port1\n set unusual-setting enable\n next\n end\n next\nend\nconfig system admin\n edit demo\n set password ${canary}\n next\nend`;
  await page.getByRole("textbox", { name: "Configuration", exact: true }).fill(samples.fortigate + "\n" + extra);
  await page.getByRole("button", { name: "Explain configuration", exact: true }).click();
  await expect(page.getByRole("heading", { name: "FortiGate firewall analysis", exact: true })).toBeVisible();
  const nav = page.getByRole("navigation", { name: "Configuration categories", exact: true });
  await nav.getByRole("button", { name: /Interfaces & addressing/ }).click();
  await page.getByRole("combobox", { name: "Context / VDOM", exact: true }).selectOption("VDOM Branch");
  await page.getByRole("combobox", { name: "Review status", exact: true }).selectOption("unknown");
  await expect(page.getByText(/^1 matching groups/)).toBeVisible();
  await page.locator("#lens-panel details > summary").click();
  await page.getByRole("button", { name: "Open all statements", exact: true }).click();
  await expect(page.locator("#lens-panel article")).toHaveCount(3);
  await page.getByRole("combobox", { name: "Statement filter", exact: true }).selectOption("unknown");
  await expect(page.locator("#lens-panel article")).toHaveCount(1);
  await expect(page.locator("#lens-panel article")).toContainText("Needs review");
  await page.getByRole("tab", { name: "Diagram", exact: true }).click();
  await page.getByRole("button", { name: "Open object OfficeSubnet", exact: true }).click();
  await expect(page.getByRole("button", { name: /Used by/ })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByText("Source address match", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Open object 10", exact: true }).click();
  for (const width of [1440, 320]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.getByLabel("Configuration references for 10", { exact: true }).screenshot({ path: testInfo.outputPath(`live-diagram-${width}.png`) });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  }
  await page.getByRole("button", { name: /^Source L/ }).click();
  await expect(page.getByRole("combobox", { name: "Statement filter", exact: true })).toHaveValue("all");
  await expect(page.getByRole("button", { name: "Clear group selection" })).toHaveCount(0);
  await page.getByRole("tab", { name: "Categories", exact: true }).click();
  for (const width of [1440, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 1000 });
    if (width <= 700) await page.getByRole("combobox", { name: "Configuration category", exact: true }).selectOption("Firewall");
    else await nav.getByRole("button", { name: /Firewall policies & ACLs/ }).click();
    const summary = page.locator("#lens-panel details > summary").filter({ hasText: "10" });
    if ((await summary.locator("..").getAttribute("open")) === null) await summary.click();
    await page.locator("#lens-panel").evaluate(e => scrollTo(0, e.getBoundingClientRect().top + scrollY - 130));
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    expect((await new AxeBuilder({ page }).include("#lens-panel").analyze()).violations).toEqual([]);
    await page.screenshot({ path: testInfo.outputPath(`live-categories-${width}.png`) });
  }
  await page.getByRole("textbox", { name: "Search configuration", exact: true }).fill("does-not-exist");
  await expect(page.getByText("No groups match these filters.", { exact: true })).toBeVisible();
  const exported = await exportMasked(page);
  expect(exported).not.toContain(canary);
  expect(exported).toContain("set unusual-setting enable");
  privateChecks(observation);
});

test("production Fortinet 12155-line full backup preserves syntax and masks secrets", async ({ page }, testInfo) => {
  const observation = await observe(page);
  await page.getByRole("combobox", { name: "Vendor", exact: true }).selectOption("fortinet");
  await page.getByRole("combobox", { name: "Operating system / train", exact: true }).selectOption("FortiOS 7.4");
  const input = `${fortinetFullBackup}\n${"# synthetic padding\n".repeat(12155 - fortinetFullBackup.split("\n").length - 1)}# last line`;
  await page.getByLabel("Configuration file").setInputFiles({ name: "synthetic-fortigate.conf", mimeType: "text/plain", buffer: Buffer.from(input) });
  await page.getByRole("button", { name: "Explain configuration", exact: true }).click();
  await expect(page.getByRole("heading", { name: "FortiGate firewall analysis", exact: true })).toBeVisible({ timeout: 60000 });
  await expect(page.getByRole("main").getByRole("alert")).toHaveCount(0);
  await page.getByRole("tab", { name: "Diagram", exact: true }).click();
  await expect(page.getByText(/\/ Declared in this export$/)).toHaveCount(2);
  const exported = await exportMasked(page);
  expect(exported.split("\n")).toHaveLength(12155);
  expect(exported).not.toMatch(/Hidden\w*Canary/);
  await page.getByRole("heading", { name: "Configured relationships", exact: true }).scrollIntoViewIfNeeded();
  await page.screenshot({ path: testInfo.outputPath("live-fortinet-full-backup.png") });
  privateChecks(observation);
});

test("production 20000-interface Cisco config keeps every object and complete export", async ({ page }, testInfo) => {
  const observation = await observe(page);
  const count = 20000;
  const input = `hostname large\nvlan 10\n${Array.from({ length: count }, (_, i) => `interface GigabitEthernet0/${i}\n switchport mode access\n switchport access vlan 10\n description ${canary}${i}`).join("\n")}\nend`;
  await page.getByRole("combobox", { name: "Device family", exact: true }).selectOption("cisco-switch");
  await page.getByLabel("Configuration file").setInputFiles({ name: "synthetic-large-switch.cfg", mimeType: "text/plain", buffer: Buffer.from(input) });
  await page.getByRole("button", { name: "Explain configuration", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Catalyst switch analysis", exact: true })).toBeVisible({ timeout: 60000 });
  await expect(page.locator("#lens-panel details > summary")).toHaveCount(24);
  await page.getByRole("tab", { name: "Diagram", exact: true }).click();
  await expect(page.getByRole("combobox", { name: "Object", exact: true }).locator("option")).toHaveCount(60);
  await page.getByRole("textbox", { name: "Find object", exact: true }).fill("GigabitEthernet0/19999");
  const option = page.getByRole("combobox", { name: "Object", exact: true }).getByRole("option", { name: /GigabitEthernet0\/19999/ });
  await page.getByRole("combobox", { name: "Object", exact: true }).selectOption((await option.getAttribute("value"))!);
  await expect(page.getByText(/\/ Declared in this export$/)).toBeVisible();
  const exported = await exportMasked(page);
  expect(exported.split("\n")).toHaveLength(80003);
  expect(exported).toContain("interface GigabitEthernet0/19999");
  expect(exported).not.toContain(canary);
  await page.getByLabel("Configuration references for GigabitEthernet0/19999", { exact: true }).screenshot({ path: testInfo.outputPath("live-large-cisco.png") });
  privateChecks(observation);
});
