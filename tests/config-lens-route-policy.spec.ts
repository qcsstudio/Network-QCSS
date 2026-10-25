import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { ciscoRoutePolicy, fortiRoutePolicy } from "./fixtures/config-lens-route-policy";

test.beforeEach(async ({ context, baseURL }) => {
  if (new URL(baseURL!).hostname !== "127.0.0.1") {
    expect(process.env.CONFIG_LENS_LIVE_QA).toBe("1");
    expect(new URL(baseURL!).origin).toBe("https://www.qcsstudio.com");
  }
  await context.addInitScript(() => localStorage.setItem("network-qcss-consent", JSON.stringify({ necessary: true, analytics: false, marketing: false, personalization: false, sessionReplay: false })));
});

for (const width of [1440, 320]) test(`routing-policy explanations remain local and readable at ${width}px`, async ({ page }, testInfo) => {
  test.setTimeout(120_000);
  page.setDefaultTimeout(10_000);
  await page.setViewportSize({ width, height: 1000 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  const requests: string[] = [], errors: string[] = [];
  page.on("request", r => requests.push(`${r.method()} ${r.url()} ${r.postData() || ""}`));
  page.on("pageerror", e => errors.push(e.message));
  await page.goto("/network-tools/network-configuration-explainer");
  const cases = [
    ...["7.2", "7.4", "7.6"].map(v => ({ vendor: "fortinet", profile: "fortigate", version: `FortiOS ${v}`, source: fortiRoutePolicy.replace("7.4.9", `${v}.0`), search: "set match-ip-nexthop", phrase: "does not set a new next hop", href: `/fortigate/${v}.` })),
    ...["15", "16", "17"].map(v => ({ vendor: "cisco", profile: "cisco-router", version: v === "15" ? "IOS 15.x" : `IOS XE ${v}.x`, source: ciscoRoutePolicy.replace("17.15", `${v}.12`), search: "set local-preference", phrase: "other selection steps still matter", href: v === "15" ? "/15-mt/" : v === "16" ? "/release/16-12/" : "/17-x/" })),
    { vendor: "cisco", profile: "cisco-switch", version: "IOS XE 17.x", source: ciscoRoutePolicy, search: "ip prefix-list SUMMARY", phrase: "does not attach the filter", href: "/release/17-13/" },
  ];
  for (const item of cases) {
    await page.getByRole("combobox", { name: "Vendor", exact: true }).selectOption(item.vendor);
    await page.getByRole("combobox", { name: "Device family", exact: true }).selectOption(item.profile);
    await page.getByRole("combobox", { name: "Operating system / train", exact: true }).selectOption(item.version);
    await page.getByRole("textbox", { name: "Configuration", exact: true }).fill(item.source);
    await page.getByRole("button", { name: "Explain configuration", exact: true }).click();
    await page.getByRole("tab", { name: "Explanations", exact: true }).click();
    await page.getByRole("textbox", { name: "Search statements", exact: true }).fill(item.search);
    const row = page.locator("#lens-panel article");
    await expect(row).toHaveCount(1);
    await expect(row).toContainText(item.phrase);
    expect(await row.getByRole("link").getAttribute("href")).toContain(item.href);
    await expect(page.locator("#lens-panel")).not.toContainText("RoutePolicySecretCanary");
    await row.evaluate(e => scrollTo({ top: e.getBoundingClientRect().top + scrollY - 150, behavior: "instant" }));
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    if (item.version === "FortiOS 7.2" || item.profile === "cisco-switch") {
      expect((await new AxeBuilder({ page }).include("#lens-panel").analyze()).violations).toEqual([]);
      await page.screenshot({ path: testInfo.outputPath(`${item.profile}-${width}.png`) });
    }
    await page.getByRole("textbox", { name: "Search statements", exact: true }).fill("unsupported-policy-option");
    await expect(row).toHaveCount(1);
    await expect(row).toContainText("Needs review");
    await expect(row.getByRole("link")).toHaveCount(0);
  }
  expect(errors).toEqual([]);
  expect(requests.filter(r => /^(?:POST|PUT|PATCH|DELETE) |\/api\/|clarity\.ms|google-analytics|openai\.com|RoutePolicySecretCanary|docs.fortinet.com|www.cisco.com/.test(r))).toEqual([]);
});
