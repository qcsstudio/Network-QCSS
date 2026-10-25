import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { createHmac } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { profiles } from "../src/lib/config-lens/catalog";
import { samples } from "../src/lib/config-lens/samples";
import { fortinetFullBackup } from "./fixtures/config-lens-fortinet";

const path = "/network-tools/network-configuration-explainer";
const secret = "LocalCanarySecret-NotForAnyRequest";
test.use({ actionTimeout: 15000, navigationTimeout: 60000 });
test("local analysis, masking, exports, all device selectors and no config transmission", async ({ page, context }) => {
  const requests: string[] = [], errors: string[] = [];
  page.on("request", request => requests.push(`${request.method()} ${request.url()} ${request.postData() || ""}`));
  page.on("pageerror", error => errors.push(error.message));
  await page.goto(path);
  await expect(page.getByRole("button", { name: "Explain configuration" })).toBeVisible();
  for (const profile of profiles) {
    await page.getByRole("combobox", { name: "Vendor", exact: true }).selectOption(profile.vendor);
    await page.getByRole("combobox", { name: "Device family", exact: true }).selectOption(profile.id);
    await expect(page.getByLabel("Operating system / train")).toHaveValue(profile.versions[0]);
    await page.getByRole("button", { name: "Try an example" }).click();
    await page.getByLabel("Export type").selectOption("running");
    await page.getByRole("button", { name: "Explain configuration" }).click();
    await expect(page.getByRole("heading", { name: `${profile.name} analysis`, exact: true })).toBeVisible();
    if (profile.id === "cisco-ftd") {
      await page.getByRole("tab", { name: "Checks", exact: true }).click();
      await expect(page.getByText("FTD diagnostic output is partial", { exact: true })).toBeVisible();
    }
  }
  await page.getByLabel("Device family").selectOption("fortigate");
  await page.getByRole("textbox", { name: "Configuration", exact: true }).fill(`${samples.fortigate}\nconfig system admin\n edit extra\n set password ${secret}\n next\nend`);
  await page.getByRole("button", { name: "Explain configuration" }).click();
  await expect(page.getByRole("heading", { name: "FortiGate firewall analysis" })).toBeVisible();
  await expect(page.getByRole("textbox", { name: "Configuration", exact: true })).not.toHaveValue(new RegExp(secret));
  await page.getByRole("button", { name: "Report", exact: true }).click();
  await expect(page.getByRole("button", { name: "Download reviewed text" })).toBeDisabled();
  await expect(page.locator("pre")).not.toContainText(secret);
  await page.getByLabel("I reviewed this text").check();
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download reviewed text" }).click();
  expect((await download).suggestedFilename()).toBe("qcs-config-lens-report.txt");
  const stored = await page.evaluate(() => JSON.stringify({ local: { ...localStorage }, session: { ...sessionStorage }, url: location.href }));
  expect(stored).not.toContain(secret);
  expect(requests.some(request => request.includes(secret))).toBe(false);
  expect(requests.filter(request => /^POST|\/api\/network-tools|clarity\.ms|google-analytics|openai\.com/.test(request))).toEqual([]);
  expect(errors).toEqual([]);
  await page.getByRole("button", { name: "Clear configuration and results" }).click();
  await expect(page.getByRole("textbox", { name: "Configuration", exact: true })).toHaveValue("");
  await expect(page.getByRole("heading", { name: "FortiGate firewall analysis" })).toHaveCount(0);
  expect((await context.cookies()).some(cookie => /_clck|_ga|_fbp/.test(cookie.name))).toBe(false);
});

test("file upload, invalid input and changed selection cannot retain stale results", async ({ page }) => {
  await page.goto(path);
  await page.getByLabel("Configuration file").setInputFiles({ name: "router.cfg", mimeType: "text/plain", buffer: Buffer.from(samples["cisco-router"]) });
  await page.getByRole("button", { name: "Explain configuration" }).click();
  await expect(page.getByRole("heading", { name: "Router analysis", exact: true })).toBeVisible();
  await page.getByLabel("Operating system / train").selectOption("IOS 15.x");
  await expect(page.getByRole("heading", { name: "Router analysis", exact: true })).toHaveCount(0);
  await expect(page.getByRole("main").getByRole("status")).not.toContainText("Analysis complete");
  await page.getByLabel("Configuration file").setInputFiles({ name: "backup.bin", mimeType: "application/octet-stream", buffer: Buffer.from([0, 1, 2]) });
  await expect(page.getByRole("main").getByRole("alert")).toContainText("UTF-8");
  await page.getByRole("textbox", { name: "Configuration", exact: true }).fill("<script>alert('do-not-run')</script>");
  await page.getByRole("button", { name: "Explain configuration" }).click();
  await expect(page.getByRole("main").getByRole("alert")).toContainText("not supported");
});

test("Fortinet full backups parse locally and failures clear progress without leaking values", async ({ page }, testInfo) => {
  const requests: string[] = [], errors: string[] = [];
  page.on("pageerror", e => errors.push(e.message));
  await page.goto(path);
  const consentRequest = page.waitForRequest(r => r.url().endsWith("/api/events") && r.postData()?.includes("consent_updated") === true);
  await page.getByRole("button", { name: "Essential only", exact: true }).click();
  await consentRequest;
  page.on("request", r => requests.push(`${r.method()} ${r.url()} ${r.postData() || ""}`));
  await page.getByRole("combobox", { name: "Vendor", exact: true }).selectOption("fortinet");
  await page.getByLabel("Operating system / train").selectOption("FortiOS 7.4");
  const input = `${fortinetFullBackup}\n${"# synthetic padding\n".repeat(12155 - fortinetFullBackup.split("\n").length - 1)}# last line`;
  await page.getByLabel("Configuration file").setInputFiles({ name: "synthetic-full-fortigate.conf", mimeType: "text/plain", buffer: Buffer.from(input) });
  await page.getByRole("button", { name: "Explain configuration" }).click();
  await expect(page.getByRole("heading", { name: "FortiGate firewall analysis", exact: true })).toBeVisible({ timeout: 60000 });
  await expect(page.getByRole("main").getByRole("alert")).toHaveCount(0);
  await page.getByRole("tab", { name: "Diagram", exact: true }).click();
  await expect(page.getByLabel("Configuration references for 10", { exact: true })).toBeVisible();
  await expect(page.getByText(/\/ Declared in this export$/)).toHaveCount(2);
  for (const width of [1440, 320]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.getByLabel("Configuration references for 10", { exact: true }).scrollIntoViewIfNeeded();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath(`fortinet-full-backup-${width}.png`) });
  }
  await page.getByRole("button", { name: "Masked text", exact: true }).click();
  await page.getByLabel("I reviewed this text").check();
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download reviewed text" }).click();
  const exported = await readFile((await (await download).path())!, "utf8");
  expect(exported.split("\n")).toHaveLength(12155);
  expect(exported).not.toMatch(/Hidden\w*Canary/);
  await page.getByRole("button", { name: "Clear configuration and results" }).click();
  for (const broken of ["config system interface\n next\nend", 'config system interface\n edit "HiddenValueCanary']) {
    await page.getByRole("textbox", { name: "Configuration", exact: true }).fill(broken);
    await page.getByRole("button", { name: "Explain configuration" }).click();
    await expect(page.getByRole("main").getByRole("alert")).toContainText("line 2");
    await expect(page.getByRole("main").getByRole("alert")).not.toContainText("HiddenValueCanary");
    await expect(page.getByRole("main").getByRole("status")).toBeEmpty();
    await expect(page.getByRole("button", { name: "Explain configuration" })).toBeEnabled();
    await expect(page.getByRole("button", { name: "Cancel", exact: true })).toHaveCount(0);
  }
  await page.getByRole("button", { name: "Try an example" }).click();
  await page.getByRole("button", { name: "Explain configuration" }).click();
  await expect(page.getByRole("heading", { name: "FortiGate firewall analysis", exact: true })).toBeVisible();
  expect(requests.filter(r => /^POST|\/api\/network-tools|clarity\.ms|google-analytics|openai\.com/.test(r))).toEqual([]);
  expect(requests.some(r => /Hidden\w*Canary/.test(r))).toBe(false);
  expect(errors).toEqual([]);
});

test("large files retain all objects and exports while result views stay bounded", async ({ page }, testInfo) => {
  const requests: string[] = [], errors: string[] = [];
  page.on("pageerror", e => errors.push(e.message));
  await page.goto(path);
  const consentRequest = page.waitForRequest(r => r.url().endsWith("/api/events") && r.postData()?.includes("consent_updated") === true);
  await page.getByRole("button", { name: "Essential only", exact: true }).click();
  await consentRequest;
  // Observe the configuration workflow after the separate privacy-choice acknowledgement.
  page.on("request", r => requests.push(`${r.method()} ${r.url()} ${r.postData() || ""}`));
  const count = 20000;
  const input = `hostname large\nvlan 10\n${Array.from({ length: count }, (_, i) => `interface GigabitEthernet0/${i}\n switchport mode access\n switchport access vlan 10\n description ${secret}${i}`).join("\n")}\nend`;
  await page.getByLabel("Device family").selectOption("cisco-switch");
  await page.getByLabel("Configuration file").setInputFiles({ name: "large-switch.cfg", mimeType: "text/plain", buffer: Buffer.from(input) });
  await expect(page.getByText("large-switch.cfg", { exact: true })).toBeVisible();
  await expect(page.getByRole("textbox", { name: "Configuration", exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Explain configuration" }).click();
  await expect(page.getByRole("heading", { name: "Catalyst switch analysis", exact: true })).toBeVisible({ timeout: 60000 });
  await page.getByRole("tab", { name: "Diagram", exact: true }).click();
  await expect(page.getByRole("combobox", { name: "Object", exact: true }).locator("option")).toHaveCount(60);
  await page.getByRole("button", { name: "Next objects", exact: true }).click();
  await expect(page.getByRole("combobox", { name: "Object", exact: true }).locator("option")).toHaveCount(61);
  await page.getByLabel("Find object", { exact: true }).fill("GigabitEthernet0/19999");
  const option = page.getByRole("combobox", { name: "Object", exact: true }).getByRole("option", { name: /GigabitEthernet0\/19999/ });
  await page.getByRole("combobox", { name: "Object", exact: true }).selectOption((await option.getAttribute("value"))!);
  await expect(page.getByText(/\/ Declared in this export$/)).toBeVisible();
  for (const width of [1440, 320]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.getByLabel("Configuration references for GigabitEthernet0/19999", { exact: true }).evaluate(element => window.scrollTo(0, element.getBoundingClientRect().top + window.scrollY - 140));
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    await expect(page.getByRole("button", { name: "L80000", exact: true })).toHaveCSS("white-space", "nowrap");
    await page.screenshot({ path: testInfo.outputPath(`large-diagram-${width}.png`) });
  }
  await page.getByRole("button", { name: "Masked text", exact: true }).click();
  await expect(page.getByRole("button", { name: "Next export preview", exact: true })).toBeVisible();
  expect((await page.locator("pre").innerText()).length).toBeLessThanOrEqual(16000);
  await page.getByLabel("I reviewed this text").check();
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download reviewed text" }).click();
  const exported = await readFile((await (await download).path())!, "utf8");
  expect(exported.split("\n")).toHaveLength(count * 4 + 3);
  expect(exported).toContain("interface GigabitEthernet0/19999");
  expect(exported).not.toContain(secret);
  expect(requests.filter(r => /^POST|\/api\/network-tools|clarity\.ms|google-analytics|openai\.com/.test(r))).toEqual([]);
  expect(requests.some(r => r.includes(secret))).toBe(false);
  expect(errors).toEqual([]);
});

test("long lines, cancellation and invalid UTF-8 remain safe", async ({ page }) => {
  await page.goto(path);
  const big = `hostname demo\n${"ip route 192.0.2.0 255.255.255.0 198.51.100.1\n".repeat(500000)}end`;
  await page.getByLabel("Configuration file").setInputFiles({ name: "cancel.cfg", mimeType: "text/plain", buffer: Buffer.from(big) });
  await page.getByRole("button", { name: "Explain configuration" }).click();
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(page.getByRole("button", { name: "Explain configuration" })).toBeEnabled();
  await expect(page.getByRole("heading", { name: "Router analysis", exact: true })).toHaveCount(0);
  await page.getByLabel("Configuration file").setInputFiles({ name: "bad.cfg", mimeType: "text/plain", buffer: Buffer.from([0xff]) });
  await page.getByRole("button", { name: "Explain configuration" }).click();
  await expect(page.getByRole("main").getByRole("alert")).toContainText("UTF-8");
  await page.getByRole("button", { name: "Use pasted text", exact: true }).click();
  const long = `unknown-command ${"x".repeat(10000)} END_OF_LONG_LINE`;
  await page.getByRole("textbox", { name: "Configuration", exact: true }).fill(`hostname demo\n${long}\nend`);
  await page.getByRole("button", { name: "Explain configuration" }).click();
  await expect(page.getByRole("heading", { name: "Router analysis", exact: true })).toBeVisible();
  await page.getByRole("tab", { name: "Source", exact: true }).click();
  await page.getByText(/^View complete text/).click();
  await expect(page.getByText(long, { exact: true })).toBeVisible();
});

test("large FortiGate address groups have paged references and complete long settings", async ({ page }) => {
  await page.goto(path);
  await page.getByRole("combobox", { name: "Vendor", exact: true }).selectOption("fortinet");
  const names = Array.from({ length: 5000 }, (_, i) => `Host${i}`);
  const input = `config firewall address\n${names.map(n => ` edit "${n}"\n set subnet 192.0.2.1 255.255.255.255\n next`).join("\n")}\nend\nconfig firewall addrgrp\n edit "AllHosts"\n set member ${names.map(n => `"${n}"`).join(" ")}\n next\nend`;
  await page.getByLabel("Configuration file").setInputFiles({ name: "large-fortigate.conf", mimeType: "text/plain", buffer: Buffer.from(input) });
  await page.getByRole("button", { name: "Explain configuration" }).click();
  await expect(page.getByRole("heading", { name: "FortiGate firewall analysis", exact: true })).toBeVisible({ timeout: 60000 });
  await page.getByRole("tab", { name: "Diagram", exact: true }).click();
  await page.getByLabel("Find object").fill("AllHosts");
  const option = page.getByRole("combobox", { name: "Object", exact: true }).getByRole("option", { name: /AllHosts/ });
  await page.getByRole("combobox", { name: "Object", exact: true }).selectOption((await option.getAttribute("value"))!);
  await expect(page.getByText(/\/ Declared in this export$/)).toHaveCount(60);
  await page.getByRole("button", { name: "Next references", exact: true }).click();
  await expect(page.getByText("Host60", { exact: true })).toBeVisible();
  await page.getByText(/^View complete text/).click();
  await expect(page.getByText(names.join(", "), { exact: true })).toBeVisible();
});

test("diagram, keyboard navigation, accessibility and responsive viewports", async ({ page }, testInfo) => {
  await page.goto(path);
  await page.getByRole("button", { name: "Essential only", exact: true }).click();
  await page.getByRole("combobox", { name: "Vendor", exact: true }).selectOption("fortinet");
  await page.getByRole("button", { name: "Try an example" }).click();
  await page.getByRole("button", { name: "Explain configuration" }).click();
  await expect(page.getByRole("heading", { name: "FortiGate firewall analysis" })).toBeVisible();
  await page.getByRole("tab", { name: "Diagram", exact: true }).click();
  await expect(page.getByLabel("Configuration references for 10", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Configuration references for 10").getByText("OfficeSubnet", { exact: true })).toBeVisible();
  for (const width of [1440, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.getByRole("heading", { name: "FortiGate firewall analysis" }).scrollIntoViewIfNeeded();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath(`diagram-${width}.png`), fullPage: true });
    await page.getByRole("heading", { name: "Configured relationships", exact: true }).scrollIntoViewIfNeeded();
    await page.screenshot({ path: testInfo.outputPath(`diagram-viewport-${width}.png`) });
    await page.getByLabel("Configuration references for 10", { exact: true }).screenshot({ path: testInfo.outputPath(`diagram-object-${width}.png`) });
  }
  await page.getByRole("tab", { name: "Diagram", exact: true }).focus();
  await page.keyboard.press("ArrowRight");
  await expect(page.getByRole("tab", { name: "Explanations", exact: true })).toHaveAttribute("aria-selected", "true");
  const axe = await new AxeBuilder({ page }).include('main [data-clarity-mask="true"]').analyze();
  expect(axe.violations.map(v => ({ id: v.id, impact: v.impact, nodes: v.nodes.map(n => n.target) }))).toEqual([]);
});

test("categories retain unknown statements, scoped filters, source access and reverse references", async ({ page }, testInfo) => {
  const requests: string[] = [];
  await page.goto(path);
  const consentRequest = page.waitForRequest(r => r.url().endsWith("/api/events") && r.postData()?.includes("consent_updated") === true);
  await page.getByRole("button", { name: "Essential only", exact: true }).click();
  await consentRequest;
  page.on("request", r => requests.push(`${r.method()} ${r.url()} ${r.postData() || ""}`));
  await page.getByRole("combobox", { name: "Vendor", exact: true }).selectOption("fortinet");
  const extra = 'config vdom\n edit Branch\n config system interface\n edit port1\n set unusual-setting enable\n next\n end\n next\nend\nconfig system admin\n edit demo-admin\n set password ' + secret + '\n next\nend';
  await page.getByRole("textbox", { name: "Configuration", exact: true }).fill(samples.fortigate + "\n" + extra);
  await page.getByRole("button", { name: "Explain configuration" }).click();
  await expect(page.getByRole("tab", { name: "Categories", exact: true })).toHaveAttribute("aria-selected", "true");
  const categories = page.getByRole("navigation", { name: "Configuration categories", exact: true });
  await categories.getByRole("button", { name: /Interfaces & addressing/ }).click();
  await page.getByRole("combobox", { name: "Context / VDOM", exact: true }).selectOption("VDOM Branch");
  await page.getByRole("combobox", { name: "Review status", exact: true }).selectOption("unknown");
  await expect(page.getByText(/^1 matching groups/)).toBeVisible();
  await page.locator("#lens-panel details > summary").click();
  await expect(page.locator("#lens-panel code").filter({ hasText: "set unusual-setting enable" })).toBeVisible();
  await page.getByRole("button", { name: "Open all statements", exact: true }).click();
  await expect(page.getByRole("tab", { name: "Explanations", exact: true })).toHaveAttribute("aria-selected", "true");
  await expect(page.locator("#lens-panel article")).toHaveCount(3);
  await page.getByRole("combobox", { name: "Statement filter", exact: true }).selectOption("unknown");
  await expect(page.locator("#lens-panel article")).toHaveCount(1);
  await expect(page.locator("#lens-panel article")).toContainText("Needs review");
  await page.getByRole("tab", { name: "Diagram", exact: true }).click();
  await page.getByRole("button", { name: "Open object OfficeSubnet", exact: true }).click();
  await expect(page.getByLabel("Configuration references for OfficeSubnet", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: /Used by/ })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByText("Source address match", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Open object 10", exact: true }).click();
  await page.getByRole("button", { name: /^Source L/ }).click();
  await expect(page.getByRole("combobox", { name: "Statement filter", exact: true })).toHaveValue("all");
  await expect(page.getByRole("combobox", { name: "Statement context", exact: true })).toHaveValue("all");
  await expect(page.getByRole("button", { name: "Clear group selection" })).toHaveCount(0);
  await page.getByRole("tab", { name: "Categories", exact: true }).click();
  for (const width of [1440, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 1000 });
    if (width <= 700) await page.getByRole("combobox", { name: "Configuration category", exact: true }).selectOption("Firewall");
    else await categories.getByRole("button", { name: /Firewall policies & ACLs/ }).click();
    const summary = page.locator("#lens-panel details > summary").filter({ hasText: "10" });
    if ((await summary.locator("..").getAttribute("open")) === null) await summary.click();
    await page.locator("#lens-panel").evaluate(e => window.scrollTo(0, e.getBoundingClientRect().top + scrollY - 130));
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath(`categories-${width}.png`) });
    expect((await new AxeBuilder({ page }).include('#lens-panel').analyze()).violations).toEqual([]);
  }
  await page.getByLabel("Search configuration", { exact: true }).fill("does-not-exist");
  await expect(page.getByText("No groups match these filters.", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Reset category filters", exact: true }).click();
  await expect(page.locator("#lens-panel")).not.toContainText(secret);
  expect(requests.filter(r => /^POST|clarity\.ms|google-analytics|openai\.com/.test(r))).toEqual([]);
  expect(requests.some(r => r.includes(secret))).toBe(false);
});

test("full document isolation and route CSP protect entry from another page", async ({ page }) => {
  await page.goto("/network-tools");
  await page.evaluate(() => { (window as Window & { lensPreviousDocument?: boolean }).lensPreviousDocument = true; });
  await page.locator(`a[href="${path}"]`).first().click();
  await expect(page.getByRole("button", { name: "Explain configuration" })).toBeVisible();
  expect(await page.evaluate(() => Boolean((window as Window & { lensPreviousDocument?: boolean }).lensPreviousDocument))).toBe(false);
  const response = await page.request.get(path);
  const csp = response.headers()["content-security-policy"];
  expect(csp).toContain("worker-src 'self'");
  expect(csp).not.toContain("clarity.ms");
  expect(response.headers()["referrer-policy"]).toBe("no-referrer");
});

test("admin update desk is authenticated, CSRF protected and independent of the DB", async ({ page, context, request, baseURL }, testInfo) => {
  const unauthenticated = await request.post("/api/admin/config-lens/updates", { headers: { origin: baseURL! } });
  expect(unauthenticated.status()).toBe(401);
  const payload = Buffer.from(JSON.stringify({ email: "config-lens-test@localhost", expiresAt: Date.now() + 60000 })).toString("base64url");
  const signature = createHmac("sha256", "config-lens-local-test-session-not-production").update(payload).digest("base64url");
  await context.addCookies([{ name: "network_qcss_admin", value: `${payload}.${signature}`, url: baseURL!, httpOnly: true, sameSite: "Lax" }]);
  await page.goto("/admin/config-lens");
  await expect(page.getByRole("heading", { name: "Config Lens update desk", exact: true })).toBeVisible();
  expect((await context.request.post("/api/admin/config-lens/updates", { headers: { origin: "https://untrusted.example" } })).status()).toBe(403);
  expect((await context.request.post("/api/admin/config-lens/updates", { headers: { origin: baseURL! }, data: { config: "forbidden" } })).status()).toBe(400);
  const reportResponse = page.waitForResponse(response => response.url().includes("/api/admin/config-lens/updates") && response.request().method() === "POST");
  await page.getByRole("button", { name: "Check vendor updates", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Source check results", exact: true })).toBeVisible({ timeout: 40000 });
  await expect(page.getByRole("button", { name: "Download review package" })).toBeEnabled();
  const reportPath = testInfo.outputPath("official-source-report.json");
  await writeFile(reportPath, JSON.stringify(await (await reportResponse).json(), null, 2));
  await testInfo.attach("official-source-report", { path: reportPath, contentType: "application/json" });
  await page.screenshot({ path: testInfo.outputPath("admin-source-check.png") });
});
