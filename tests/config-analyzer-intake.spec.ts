import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const path = "/network-tools/network-configuration-explainer";
const router = "version 17.15\nhostname synthetic-edge\ninterface GigabitEthernet0/0\n ip address 192.0.2.1 255.255.255.0\nend";

test.beforeEach(async ({ context }) => {
  await context.addInitScript(() => localStorage.setItem("network-qcss-consent", JSON.stringify({ necessary: true, analytics: false, marketing: false, personalization: false, sessionReplay: false })));
});

async function open(page: Page) {
  await page.goto(path);
  const consent = page.getByRole("button", { name: "Essential only", exact: true });
  if (await consent.isVisible()) await consent.click();
  await expect(page.getByRole("heading", { name: "Start with reliable evidence." })).toBeVisible();
}

async function completeMetadata(page: Page) {
  await page.getByLabel("Device alias", { exact: true }).fill("synthetic-edge");
  await page.getByLabel("Model", { exact: true }).fill("ISR synthetic");
  await page.getByLabel("Exact version / build", { exact: true }).fill("17.15.4");
  await page.getByRole("combobox", { name: "Configuration state", exact: true }).selectOption("running");
  await page.getByRole("combobox", { name: "Capture completeness", exact: true }).selectOption("entire");
  await page.getByRole("combobox", { name: "Administrative scope", exact: true }).selectOption("device");
  await page.getByRole("combobox", { name: "Default visibility", exact: true }).selectOption("omitted");
}

test("validated input is reviewed before explanation; editing invalidates results and exports", async ({ page }) => {
  const requests: string[] = [], errors: string[] = [];
  page.on("request", request => requests.push(request.url() + (request.postData() || "")));
  page.on("pageerror", error => errors.push(error.message));
  await open(page);
  await completeMetadata(page);
  await page.getByRole("textbox", { name: "Configuration", exact: true }).fill(router + "\nusername admin secret BrowserInputSecretCanary");
  await page.getByRole("button", { name: "Validate configuration", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Review before analysis." })).toBeVisible();
  await expect(page.locator('[data-analyzer-intake] [data-state="ready"]')).toBeVisible();
  await expect(page.getByRole("heading", { name: "Router analysis", exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Explain configuration", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Router analysis", exact: true })).toBeVisible();
  await expect(page.getByRole("textbox", { name: "Configuration", exact: true })).not.toHaveValue(/BrowserInputSecretCanary/);
  await page.getByRole("tab", { name: "Source", exact: true }).click();
  await expect(page.getByRole("tabpanel")).not.toContainText("BrowserInputSecretCanary");
  await page.getByRole("combobox", { name: "Capture completeness", exact: true }).selectOption("fragment");
  await expect(page.getByRole("heading", { name: "Router analysis", exact: true })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Review before analysis." })).toHaveCount(0);
  expect(requests.some(request => request.includes("BrowserInputSecretCanary"))).toBe(false);
  expect(errors).toEqual([]);
});

test("partial exports remain limited and conflicting versions are blocked", async ({ page }) => {
  await open(page);
  await page.getByRole("textbox", { name: "Configuration", exact: true }).fill(router);
  await page.getByRole("button", { name: "Validate configuration", exact: true }).click();
  await expect(page.locator('[data-state="limited"]')).toHaveText(/Ready with limitations/);
  await page.getByLabel("Exact version / build", { exact: true }).fill("17.18.4");
  await page.getByRole("button", { name: "Validate configuration", exact: true }).click();
  await expect(page.locator('[data-state="blocked"]')).toBeVisible();
  await expect(page.getByRole("button", { name: "Explain configuration", exact: true })).toHaveCount(0);
});

test("banner and description text cannot masquerade as device syntax", async ({ page }) => {
  await open(page);
  await page.getByRole("textbox", { name: "Configuration", exact: true }).fill(router + '\n description NX-OS --More--\nbanner motd ^C\nconfig system interface\n! NXOS: version 9.3(1)\nversion 1.0\nBannerSecretCanary\n^C');
  await page.getByRole("button", { name: "Validate configuration", exact: true }).click();
  await page.getByRole("button", { name: "Explain configuration", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Router analysis", exact: true })).toBeVisible();
  await page.getByRole("tab", { name: "Source", exact: true }).click();
  await expect(page.getByRole("tabpanel")).not.toContainText("BannerSecretCanary");
});

test("UTF-16 file import reports conversion and oversized files fail before processing", async ({ page }) => {
  await open(page);
  const file = Buffer.concat([Buffer.from([255, 254]), Buffer.from(router, "utf16le")]);
  await page.getByLabel("Configuration file", { exact: true }).setInputFiles({ name: "synthetic.cfg", mimeType: "text/plain", buffer: file });
  await page.getByRole("button", { name: "Validate configuration", exact: true }).click();
  await expect(page.locator('[aria-labelledby="analyzer-readiness"]')).toContainText("UTF-16 LE");
  await expect(page.locator('[aria-labelledby="analyzer-readiness"]')).toContainText("decoded locally");
  await page.getByLabel("Configuration file", { exact: true }).setInputFiles({ name: "oversized.cfg", mimeType: "text/plain", buffer: Buffer.alloc(10 * 1024 * 1024 + 1, 65) });
  await expect(page.locator("[data-analyzer-intake]").getByRole("alert")).toContainText("10 MiB");
  await expect(page.getByRole("heading", { name: "Review before analysis." })).toHaveCount(0);
});

test("Before/After validates each side and flags state and scope differences", async ({ page }) => {
  await open(page);
  await page.getByRole("button", { name: "Before / After", exact: true }).click();
  await page.getByLabel("Device alias (same device on both sides)", { exact: true }).fill("synthetic-edge");
  for (const name of ["Before", "After"]) {
    const group = page.getByRole("group", { name, exact: true });
    await group.getByRole("textbox", { name: "Configuration", exact: true }).fill(router);
    await group.getByRole("combobox", { name: "Administrative scope", exact: true }).selectOption("device");
  }
  await page.getByRole("group", { name: "Before", exact: true }).getByRole("combobox", { name: "Configuration state", exact: true }).selectOption("running");
  await page.getByRole("group", { name: "After", exact: true }).getByRole("combobox", { name: "Configuration state", exact: true }).selectOption("candidate");
  await page.getByRole("button", { name: "Validate configuration", exact: true }).click();
  await expect(page.getByRole("button", { name: "Explain Before", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Explain After", exact: true })).toBeVisible();
  await expect(page.locator('[aria-labelledby="analyzer-readiness"]')).toContainText("different configuration states");
  await page.getByRole("button", { name: "Explain After", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Router analysis", exact: true })).toBeVisible();
  await page.getByRole("group", { name: "After", exact: true }).getByRole("combobox", { name: "Administrative scope", exact: true }).selectOption("global");
  await page.getByRole("button", { name: "Validate configuration", exact: true }).click();
  await expect(page.locator('[aria-labelledby="analyzer-readiness"]')).toContainText("same administrative scope");
  await expect(page.getByRole("button", { name: "Explain Before", exact: true })).toHaveCount(0);
});

test("Fortinet 8.0 is visibly preview-only", async ({ page }) => {
  await open(page);
  await page.getByRole("combobox", { name: "Vendor", exact: true }).selectOption("fortinet");
  await page.getByRole("combobox", { name: "Operating system / train", exact: true }).selectOption("FortiOS 8.0 (preview)");
  await page.getByRole("textbox", { name: "Configuration", exact: true }).fill('#config-version=FGT-8.0.0-FW-build\nconfig system interface\n edit port1\n set ip 192.0.2.1 255.255.255.0\n next\nend');
  await page.getByRole("button", { name: "Validate configuration", exact: true }).click();
  await expect(page.locator('[data-state="preview"]')).toBeVisible();
  await expect(page.locator('[aria-labelledby="analyzer-readiness"]')).toContainText("No overall security baseline verdict");
});

test("cancellation and execution deadlines discard pending work", async ({ page }) => {
  await page.addInitScript(() => { window.Worker = class { onmessage = null; onerror = null; postMessage() {} terminate() {} } as unknown as typeof Worker; });
  await open(page);
  await page.getByRole("textbox", { name: "Configuration", exact: true }).fill(router);
  await page.getByRole("button", { name: "Validate configuration", exact: true }).click();
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(page.getByRole("main")).toContainText("Validation cancelled");
  await page.getByRole("button", { name: "Validate configuration", exact: true }).click();
  await expect(page.locator("[data-analyzer-intake]").getByRole("alert")).toContainText("30-second processing limit", { timeout: 40_000 });
  await expect(page.getByRole("heading", { name: "Router analysis", exact: true })).toHaveCount(0);
});

test("directory search finds the named analyzer by legacy and vendor aliases", async ({ page }) => {
  await page.goto("/network-tools");
  for (const query of ["Config Lens", "FortiSwitch", "Nexus", "configuration analyzer"]) {
    await page.getByRole("searchbox", { name: "Search tools", exact: true }).fill(query);
    await expect(page.getByRole("heading", { name: "Network Configuration Analyzer", exact: true })).toBeVisible();
  }
});

for (const width of [1440, 390, 320]) test(`intake layout, accessibility and reduced motion at ${width}px`, async ({ page }, testInfo) => {
  await page.setViewportSize({ width, height: 1000 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await open(page);
  await page.getByRole("button", { name: "Try an example", exact: true }).click();
  await page.getByRole("button", { name: "Validate configuration", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Review before analysis." })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  const results = await new AxeBuilder({ page }).include("[data-analyzer-intake]").analyze();
  expect(results.violations.filter(violation => ["critical", "serious"].includes(violation.impact || ""))).toEqual([]);
  await expect(page.locator('[aria-labelledby="analyzer-readiness"]')).toHaveCSS("animation-name", "none");
  await page.evaluate(() => { (document.activeElement as HTMLElement)?.blur(); window.scrollTo(0, 0); });
  await page.screenshot({ path: testInfo.outputPath(`config-analyzer-${width}.png`), fullPage: true });
});
