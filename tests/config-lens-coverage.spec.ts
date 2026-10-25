import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { readFile } from "node:fs/promises";
import { ciscoServices, fortiServices } from "./fixtures/config-lens-coverage";
import { ciscoExpanded, fortiExpanded } from "./fixtures/config-lens-multiversion";

test.beforeEach(async ({ context, baseURL }) => {
  const target = new URL(baseURL!);
  if (target.hostname !== "127.0.0.1") {
    expect(process.env.CONFIG_LENS_LIVE_QA).toBe("1");
    expect(target.origin).toBe("https://www.qcsstudio.com");
  }
  await context.addInitScript(() => localStorage.setItem("network-qcss-consent", JSON.stringify({ necessary: true, analytics: false, marketing: false, personalization: false, sessionReplay: false })));
});

for (const width of [1440, 320]) test(`expanded OS families stay private and version-scoped at ${width}px`, async ({ page }, testInfo) => {
  await page.setViewportSize({ width, height: 1000 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  const requests: string[] = [], errors: string[] = [];
  page.on("request", r => requests.push(`${r.method()} ${r.url()} ${r.postData() || ""}`));
  page.on("pageerror", e => errors.push(e.message));
  await page.goto("/network-tools/network-configuration-explainer");
  await page.getByRole("combobox", { name: "Vendor", exact: true }).selectOption("fortinet");
  for (const version of ["FortiOS 7.2", "FortiOS 7.4", "FortiOS 7.6"]) {
    await page.getByRole("combobox", { name: "Operating system / train", exact: true }).selectOption(version);
    await page.getByRole("textbox", { name: "Configuration", exact: true }).fill(fortiExpanded);
    await page.getByRole("button", { name: "Explain configuration", exact: true }).click();
    await expect(page.getByRole("heading", { name: "FortiGate firewall analysis", exact: true })).toBeVisible();
    await page.getByRole("tab", { name: "Explanations", exact: true }).click();
    const relay = page.locator("#lens-panel article").filter({ has: page.locator("[class*='code']", { hasText: "set dhcp-relay-service enable" }) });
    await expect(relay).toContainText("does not allocate addresses itself");
    await expect(relay.getByRole("link")).toContainText(version);
    await relay.evaluate(e => scrollTo({ top: e.getBoundingClientRect().top + scrollY - 150, behavior: "instant" }));
    await page.screenshot({ path: testInfo.outputPath(`expanded-${version.replaceAll(" ", "-")}-${width}.png`) });
    expect((await new AxeBuilder({ page }).include("#lens-panel").analyze()).violations).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    await page.getByRole("combobox", { name: "Statement filter", exact: true }).selectOption("unknown");
    await expect(page.locator("#lens-panel article")).toHaveCount(1);
    await expect(page.locator("#lens-panel article")).toContainText("unknown-interface-option");
    await expect(page.locator("#lens-panel article a")).toHaveCount(0);
  }
  await page.getByRole("combobox", { name: "Vendor", exact: true }).selectOption("cisco");
  await page.getByRole("combobox", { name: "Device family", exact: true }).selectOption("cisco-router");
  for (const version of ["IOS 15.x", "IOS XE 16.x", "IOS XE 17.x"]) {
    await page.getByRole("combobox", { name: "Operating system / train", exact: true }).selectOption(version);
    await page.getByRole("textbox", { name: "Configuration", exact: true }).fill(ciscoExpanded);
    await page.getByRole("button", { name: "Explain configuration", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Router analysis", exact: true })).toBeVisible();
    await page.getByRole("tab", { name: "Explanations", exact: true }).click();
    const boot = page.locator("#lens-panel article").filter({ hasText: "bootfile client.img" });
    await expect(boot).toContainText("not a firmware upgrade");
    await expect(boot.getByRole("link")).toContainText(version === "IOS 15.x" ? "Cisco IOS 15M&T" : version === "IOS XE 16.x" ? "Cisco IOS XE 16.11" : "Cisco IOS XE 17.x");
    await boot.evaluate(e => scrollTo({ top: e.getBoundingClientRect().top + scrollY - 150, behavior: "instant" }));
    await page.screenshot({ path: testInfo.outputPath(`expanded-${version.replaceAll(" ", "-")}-${width}.png`) });
    expect((await new AxeBuilder({ page }).include("#lens-panel").analyze()).violations).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    await page.getByRole("combobox", { name: "Statement filter", exact: true }).selectOption("unknown");
    await expect(page.locator("#lens-panel article")).toHaveCount(version === "IOS XE 17.x" ? 1 : 4);
    await expect(page.locator("#lens-panel article a")).toHaveCount(0);
  }
  expect(errors).toEqual([]);
  expect(requests.filter(r => /^(?:POST|PUT|PATCH|DELETE) |\/api\/|clarity\.ms|google-analytics|openai\.com|ExpandedSecretCanary|docs.fortinet.com|www.cisco.com/.test(r))).toEqual([]);
});

for (const width of [1440, 320]) test(`documented command coverage and private exports at ${width}px`, async ({ page }, testInfo) => {
  await page.setViewportSize({ width, height: 1000 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  const requests: string[] = [], errors: string[] = [];
  page.on("request", r => requests.push(`${r.method()} ${r.url()} ${r.postData() || ""}`));
  page.on("pageerror", e => errors.push(e.message));
  await page.goto("/network-tools/network-configuration-explainer");
  await page.getByRole("combobox", { name: "Vendor", exact: true }).selectOption("fortinet");
  await page.getByRole("combobox", { name: "Operating system / train", exact: true }).selectOption("FortiOS 7.4");
  await page.getByRole("textbox", { name: "Configuration", exact: true }).fill(fortiServices);
  await page.getByRole("button", { name: "Explain configuration", exact: true }).click();
  await expect(page.getByRole("heading", { name: "FortiGate firewall analysis", exact: true })).toBeVisible();
  const nav = page.getByRole("navigation", { name: "Configuration categories", exact: true });
  if (width < 700) await page.getByRole("combobox", { name: "Configuration category", exact: true }).selectOption("Network services");
  else await nav.getByRole("button", { name: /DHCP, DNS & time/ }).click();
  const dns = page.locator("#lens-panel details").filter({ has: page.locator("summary strong", { hasText: /^system dns$/ }) });
  await dns.locator("summary").click();
  await expect(dns.getByRole("link", { name: /Vendor reference: FortiOS 7.4.9/ }).first()).toHaveAttribute("rel", "noopener noreferrer");
  await expect(dns).toContainText("not a DHCP client assignment");
  await expect(dns).toContainText("Needs review");
  await page.locator("#lens-panel").evaluate(e => scrollTo({ top: e.getBoundingClientRect().top + scrollY - 130, behavior: "instant" }));
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  expect((await new AxeBuilder({ page }).include("#lens-panel").analyze()).violations).toEqual([]);
  await page.screenshot({ path: testInfo.outputPath(`coverage-categories-${width}.png`) });
  await dns.locator("code").filter({ hasText: "set primary" }).evaluate(e => scrollTo({ top: e.getBoundingClientRect().top + scrollY - 150, behavior: "instant" }));
  await expect(dns.getByRole("link", { name: /Vendor reference:/ }).first()).toBeInViewport();
  await page.screenshot({ path: testInfo.outputPath(`coverage-reference-${width}.png`) });
  await dns.getByRole("button", { name: "Open all statements", exact: true }).click();
  await expect(page.locator("#lens-panel article").filter({ hasText: "set protocol dot" })).toContainText("TLS");
  await expect(page.locator("#lens-panel article").filter({ hasText: "set unsupported-option" })).toContainText("Needs review");
  await page.getByRole("combobox", { name: "Statement filter", exact: true }).selectOption("unknown");
  await expect(page.locator("#lens-panel article")).toHaveCount(1);
  await expect(page.locator("#lens-panel article a")).toHaveCount(0);

  await page.getByRole("button", { name: "Report", exact: true }).click();
  await page.getByLabel("I reviewed this text").check();
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download reviewed text" }).click();
  const report = await readFile((await (await download).path())!, "utf8");
  expect(report).toContain("QCS Config Lens 1.3.0");
  expect(report).toContain("Vendor reference:");
  expect(report).toContain("system dhcp server ip-range");
  expect(report).not.toContain("CoverageSecretCanary");

  await page.getByRole("combobox", { name: "Vendor", exact: true }).selectOption("cisco");
  await page.getByRole("combobox", { name: "Device family", exact: true }).selectOption("cisco-switch");
  await page.getByRole("textbox", { name: "Configuration", exact: true }).fill(ciscoServices);
  await page.getByRole("button", { name: "Explain configuration", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Catalyst switch analysis", exact: true })).toBeVisible();
  await page.getByRole("tab", { name: "Explanations", exact: true }).click();
  await expect(page.locator("#lens-panel article").filter({ hasText: "network 192.0.2.0" })).toContainText("not a routing-protocol advertisement");
  await expect(page.locator("#lens-panel article").filter({ hasText: "bpdufilter" })).toContainText("can permit switching loops");
  await page.locator("#lens-panel").evaluate(e => scrollTo({ top: e.getBoundingClientRect().top + scrollY - 130, behavior: "instant" }));
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  expect((await new AxeBuilder({ page }).include("#lens-panel").analyze()).violations).toEqual([]);
  await page.screenshot({ path: testInfo.outputPath(`coverage-cisco-${width}.png`) });
  await page.locator("#lens-panel article").filter({ hasText: "network 192.0.2.0" }).evaluate(e => scrollTo({ top: e.getBoundingClientRect().top + scrollY - 150, behavior: "instant" }));
  await page.screenshot({ path: testInfo.outputPath(`coverage-cisco-reference-${width}.png`) });
  expect(errors).toEqual([]);
  expect(requests.filter(r => /^(?:POST|PUT|PATCH|DELETE) |\/api\/|clarity\.ms|google-analytics|openai\.com|CoverageSecretCanary/.test(r))).toEqual([]);
  // Vendor citations are ordinary links: no documentation server is contacted during analysis.
  expect(requests.some(r => /docs.fortinet.com|www.cisco.com/.test(r))).toBe(false);
});
