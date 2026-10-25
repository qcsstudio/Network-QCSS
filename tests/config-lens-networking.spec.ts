import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { readFile } from "node:fs/promises";
import { ciscoNetworking, ciscoSwitching, fortiNetworking } from "./fixtures/config-lens-networking";

test.beforeEach(async ({ context, baseURL }) => {
  const url = new URL(baseURL!);
  if (url.hostname !== "127.0.0.1") {
    expect(process.env.CONFIG_LENS_LIVE_QA).toBe("1");
    expect(url.origin).toBe("https://www.qcsstudio.com");
  }
  await context.addInitScript(() => localStorage.setItem("network-qcss-consent", JSON.stringify({ necessary: true, analytics: false, marketing: false, personalization: false, sessionReplay: false })));
});

for (const width of [1440, 320]) test(`routing, switching, firewall and VPN stay private and readable at ${width}px`, async ({ page }, testInfo) => {
  test.setTimeout(90_000);
  page.setDefaultTimeout(10_000);
  await page.setViewportSize({ width, height: 1000 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  const requests: string[] = [], errors: string[] = [];
  page.on("request", r => requests.push(`${r.method()} ${r.url()} ${r.postData() || ""}`));
  page.on("pageerror", e => errors.push(e.message));
  await page.goto("/network-tools/network-configuration-explainer");
  await page.getByRole("combobox", { name: "Vendor", exact: true }).selectOption("fortinet");
  await page.getByRole("combobox", { name: "Operating system / train", exact: true }).selectOption("FortiOS 7.4");
  const source = fortiNetworking.replace("set dpd on-demand", "set dpd on-demand\n  set unsupported-vpn-setting enable");
  await page.getByLabel("Configuration file").setInputFiles({ name: "synthetic-networking.conf", mimeType: "text/plain", buffer: Buffer.from(source) });
  await page.getByRole("button", { name: "Explain configuration", exact: true }).click();
  await expect(page.getByRole("heading", { name: "FortiGate firewall analysis", exact: true })).toBeVisible();
  for (const [category, label, content] of [["Routing", "Routing & VRFs", "prefix-list-in"], ["Switching", "Switching & VLANs", "lacp-mode"], ["Firewall", "Firewall policies & ACLs", "srcaddr-negate"], ["VPN", "VPN & tunnels", "dpd"]]) {
    if (width < 700) await page.getByRole("combobox", { name: "Configuration category", exact: true }).selectOption(category);
    else await page.getByRole("navigation", { name: "Configuration categories", exact: true }).getByRole("button", { name: new RegExp(label.replaceAll("&", "\\&")) }).click();
    const closedGroups = page.locator("#lens-panel details:not([open]) > summary");
    for (let remaining = await closedGroups.count(); remaining > 0; remaining--) await closedGroups.first().click();
    await expect(page.locator("#lens-panel")).toContainText(content);
  }
  await page.getByRole("tab", { name: "Explanations", exact: true }).click();
  await page.getByRole("textbox", { name: "Search statements", exact: true }).fill("set dpd on-demand");
  await expect(page.locator("#lens-panel article")).toHaveCount(1);
  const dpd = page.locator("#lens-panel article");
  await expect(dpd).toContainText("Dead Peer Detection");
  await expect(dpd.getByRole("link")).toHaveAttribute("href", /305883427\/config-vpn-ipsec-phase1-interface/);
  await dpd.evaluate(e => scrollTo({ top: e.getBoundingClientRect().top + scrollY - 150, behavior: "instant" }));
  expect((await new AxeBuilder({ page }).include("#lens-panel").analyze()).violations).toEqual([]);
  await page.screenshot({ path: testInfo.outputPath(`forti-vpn-${width}.png`) });
  await page.getByRole("textbox", { name: "Search statements", exact: true }).fill("");
  await page.getByRole("combobox", { name: "Statement filter", exact: true }).selectOption("unknown");
  await expect(page.locator("#lens-panel article")).toHaveCount(1);
  await expect(page.locator("#lens-panel article")).toContainText("unsupported-vpn-setting");
  await expect(page.locator("#lens-panel article a")).toHaveCount(0);
  await page.getByRole("tab", { name: "Diagram", exact: true }).click();
  const object = page.getByRole("combobox", { name: "Object", exact: true });
  const policy = object.getByRole("option", { name: /policy.*10|10.*policy/i });
  await object.selectOption((await policy.getAttribute("value"))!);
  await expect(page.getByText("Source address reference (review negation)", { exact: true })).toBeVisible();
  const diagram = page.getByLabel("Configuration references for 10", { exact: true });
  await diagram.evaluate(e => scrollTo({ top: e.getBoundingClientRect().top + scrollY - 150, behavior: "instant" }));
  await page.screenshot({ path: testInfo.outputPath(`negation-diagram-${width}.png`) });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  await page.getByRole("button", { name: "Report", exact: true }).click();
  await page.getByLabel("I reviewed this text").check();
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download reviewed text" }).click();
  const report = await readFile((await (await download).path())!, "utf8");
  expect(report).toContain("QCS Config Lens 1.5.0");
  expect(report).not.toContain("NetworkingSecretCanary");
  expect(report).toContain("not a TCP/UDP port");
  await page.getByRole("button", { name: "Use pasted text", exact: true }).click();
  await page.getByRole("combobox", { name: "Vendor", exact: true }).selectOption("cisco");
  for (const [id, input, search, phrase] of [["cisco-router", ciscoNetworking, "encryption aes-cbc-256", "not proof of the data tunnel"], ["cisco-switch", ciscoSwitching, "channel-protocol lacp", "working bundle is not confirmed"]]) {
    await page.getByRole("combobox", { name: "Device family", exact: true }).selectOption(id);
    await page.getByRole("combobox", { name: "Operating system / train", exact: true }).selectOption("IOS XE 17.x");
    await page.getByRole("textbox", { name: "Configuration", exact: true }).fill(input);
    await page.getByRole("button", { name: "Explain configuration", exact: true }).click();
    await page.getByRole("tab", { name: "Explanations", exact: true }).click();
    await page.getByRole("textbox", { name: "Search statements", exact: true }).fill(search);
    const row = page.locator("#lens-panel article");
    await expect(row).toHaveCount(1);
    await expect(row).toContainText(phrase);
    await expect(row.getByRole("link")).toHaveAttribute("href", /^https:\/\/www\.cisco\.com\//);
    await row.evaluate(e => scrollTo({ top: e.getBoundingClientRect().top + scrollY - 150, behavior: "instant" }));
    expect((await new AxeBuilder({ page }).include("#lens-panel").analyze()).violations).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath(`${id}-${width}.png`) });
  }
  expect(errors).toEqual([]);
  expect(requests.filter(r => /^(?:POST|PUT|PATCH|DELETE) |\/api\/|clarity\.ms|google-analytics|openai\.com|NetworkingSecretCanary|docs.fortinet.com|www.cisco.com/.test(r))).toEqual([]);
});
