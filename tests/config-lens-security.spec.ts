import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { ciscoPortSecurity, ciscoCertificateVpn, fortiSecurity } from "./fixtures/config-lens-security";

test.beforeEach(async ({ context, baseURL }) => {
  if (new URL(baseURL!).hostname !== "127.0.0.1") {
    expect(process.env.CONFIG_LENS_LIVE_QA).toBe("1");
    expect(new URL(baseURL!).origin).toBe("https://www.qcsstudio.com");
  }
  await context.addInitScript(() => localStorage.setItem("network-qcss-consent", JSON.stringify({ necessary: true, analytics: false, marketing: false, personalization: false, sessionReplay: false })));
});

for (const width of [1440, 320]) test(`security command coverage is cited, readable and browser-local at ${width}px`, async ({ page }, testInfo) => {
  test.setTimeout(120_000);
  page.setDefaultTimeout(10_000);
  await page.setViewportSize({ width, height: 1000 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  const requests: string[] = [], errors: string[] = [];
  page.on("request", r => requests.push(`${r.method()} ${r.url()} ${r.postData() || ""}`));
  page.on("pageerror", e => errors.push(e.message));
  await page.goto("/network-tools/network-configuration-explainer");
  const cases = [
    ...["7.2", "7.4", "7.6"].map(v => ({ vendor: "fortinet", profile: "fortigate", version: `FortiOS ${v}`, source: fortiSecurity.replace("7.4.9", `${v}.0`), checks: [["set span enable", "not spanning-tree"], ["nat-source-vip", "Disabled does not mean all source NAT is off"], ["fragmentation-mtu", "IKE negotiation"]], href: `/fortigate/${v}.` })),
    ...["16", "17"].flatMap(v => [
      { vendor: "cisco", profile: "cisco-switch", version: `IOS XE ${v}.x`, source: ciscoPortSecurity.replace("17.15", `${v}.12`), checks: [["port-security violation", "selects a response"], ["switchport port-security aging time", "minutes"]], href: `/release/${v}-` },
      { vendor: "cisco", profile: "cisco-router", version: `IOS XE ${v}.x`, source: ciscoCertificateVpn.replace("17.15", `${v}.12`), checks: [["pki trustpoint", "does not prove a certificate is valid"]], href: v === "16" ? "/xe-16-12/" : "/17-x/" },
    ]),
  ];
  for (const item of cases) {
    await page.getByRole("combobox", { name: "Vendor", exact: true }).selectOption(item.vendor);
    await page.getByRole("combobox", { name: "Device family", exact: true }).selectOption(item.profile);
    await page.getByRole("combobox", { name: "Operating system / train", exact: true }).selectOption(item.version);
    await page.getByRole("textbox", { name: "Configuration", exact: true }).fill(item.source);
    await page.getByRole("button", { name: "Explain configuration", exact: true }).click();
    await page.getByRole("tab", { name: "Explanations", exact: true }).click();
    const search = page.getByRole("textbox", { name: "Search statements", exact: true });
    const row = page.locator("#lens-panel article");
    for (const [command, meaning] of item.checks) {
      await search.fill(command);
      await expect(row).toHaveCount(1);
      await expect(row).toContainText(meaning);
      expect(await row.getByRole("link").getAttribute("href")).toContain(item.href);
      await expect(page.locator("#lens-panel")).not.toContainText("SecuritySecretCanary");
      await row.evaluate(e => scrollTo({ top: e.getBoundingClientRect().top + scrollY - 150, behavior: "instant" }));
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    }
    if (item.version === "FortiOS 7.2" || item.profile === "cisco-switch" && item.version === "IOS XE 17.x") {
      expect((await new AxeBuilder({ page }).include("#lens-panel").analyze()).violations).toEqual([]);
      await page.screenshot({ path: testInfo.outputPath(`${item.profile}-${width}.png`) });
    }
    await search.fill("unsupported-security-option");
    await expect(row).toHaveCount(1);
    await expect(row).toContainText("Needs review");
    await expect(row.getByRole("link")).toHaveCount(0);
  }
  expect(errors).toEqual([]);
  expect(requests.filter(r => /^(?:POST|PUT|PATCH|DELETE) |\/api\/|clarity\.ms|google-analytics|openai\.com|SecuritySecretCanary|docs.fortinet.com|www.cisco.com/.test(r))).toEqual([]);
});
