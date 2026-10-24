import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { createHmac } from "node:crypto";
import { writeFile } from "node:fs/promises";
import { profiles } from "../src/lib/config-lens/catalog";
import { samples } from "../src/lib/config-lens/samples";

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
    if (profile.id === "cisco-ftd") await expect(page.getByText("FTD diagnostic output is partial", { exact: true })).toBeVisible();
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
