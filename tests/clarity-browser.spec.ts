import { expect, test, type Page, type Route, type APIResponse } from "@playwright/test";
import { gunzipSync } from "node:zlib";

const site = "https://www.qcsstudio.com";
const consentKey = "network-qcss-consent";
const accepted = { necessary: true, analytics: true, marketing: false, personalization: false, sessionReplay: true };
const local = process.env.FRONTEND_QA_BASE || "http://127.0.0.1:3100";
const fakeClarity = `
  const queued = window.clarity?.q || [];
  window.clarityCalls = [];
  window.clarity = (...args) => {
    window.clarityCalls.push({ args, path: location.pathname });
    if (args[0] === 'consentv2' && args[1].analytics_Storage === 'granted') {
      document.cookie = '_clck=test-only; path=/';
      document.cookie = '_clsk=test-only; path=/';
    }
  };
  window.clarity.v = 'test-sdk';
  queued.forEach(args => window.clarity(...args));
`;

test.afterEach(async ({ page }) => {
  await page.unrouteAll({ behavior: "ignoreErrors" });
});

async function deliver(route: Route, response: APIResponse) {
  try {
    await route.fulfill({ response });
  } catch (error) {
    // Next prefetches and responsive images may be cancelled while their local proxy response is in flight.
    if (!/Route is already handled|Fetch response has been disposed|Target page, context or browser has been closed/.test(String(error))) throw error;
  }
}

async function prepare(page: Page, saved?: unknown, delay = 0, liveSdk = false) {
  const tagRequests: string[] = [];
  const uploads: string[] = [];
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  if (saved !== undefined) {
    await page.addInitScript(({ key, value }) => localStorage.setItem(key, JSON.stringify(value)), { key: consentKey, value: saved });
  }
  await page.route("**/*", async route => {
    const url = new URL(route.request().url());
    if (url.hostname.endsWith("clarity.ms")) {
      if (url.pathname.startsWith("/tag/")) tagRequests.push(url.href);
      if (liveSdk) {
        if (route.request().resourceType() === "script") {
          const response = await route.fetch({ maxRetries: 2, timeout: 20_000 });
          await deliver(route, response);
        } else {
          const data = route.request().postDataBuffer();
          if (data) uploads.push(data[0] === 31 && data[1] === 139 ? gunzipSync(data).toString() : data.toString());
          await route.fulfill({ status: 204, body: "" });
        }
        return;
      }
      if (delay) await new Promise(resolve => setTimeout(resolve, delay));
      try { await route.fulfill({ contentType: "application/javascript", body: fakeClarity }); } catch { /* Navigation can cancel a deliberately delayed tag. */ }
      return;
    }
    if (url.origin === site) {
      if (route.request().method() === "POST") {
        await route.fulfill({ status: 201, contentType: "application/json", body: '{"ok":true,"stored":true}' });
        return;
      }
      const response = await route.fetch({ url: `${local}${url.pathname}${url.search}`, maxRetries: 2, timeout: 20_000 });
      await deliver(route, response);
      return;
    }
    await route.abort();
  });
  return { tagRequests, errors, uploads };
}

async function calls(page: Page) {
  return page.evaluate(() => (window as unknown as { clarityCalls?: { args: unknown[]; path: string }[] }).clarityCalls || []);
}

test("no tag before opt-in or after Essential only", async ({ page }) => {
  const { tagRequests, errors } = await prepare(page);
  await page.goto(site, { waitUntil: "load" });
  await expect(page.getByRole("dialog", { name: "Your privacy choices" })).toBeVisible();
  expect(tagRequests).toHaveLength(0);
  await page.getByRole("button", { name: "Essential only" }).click();
  await page.waitForTimeout(300);
  expect(tagRequests).toHaveLength(0);
  expect(errors).toEqual([]);
});

test("legacy analytics consent cannot silently enable replay", async ({ page }) => {
  const { tagRequests } = await prepare(page, { analytics: true, marketing: true });
  await page.goto(site, { waitUntil: "load" });
  await page.waitForTimeout(300);
  expect(tagRequests).toHaveLength(0);
});

test("explicit opt-in loads once; footer withdrawal stops and clears cookies", async ({ page, context }) => {
  const { tagRequests, errors } = await prepare(page);
  await page.goto(site, { waitUntil: "load" });
  await page.getByRole("button", { name: "Customize", exact: true }).click();
  const analytics = page.getByRole("checkbox", { name: /^Analytics/ });
  const replay = page.getByRole("checkbox", { name: /^Session recordings/ });
  await expect(replay).toBeDisabled();
  await analytics.check();
  await replay.check();
  await page.getByRole("button", { name: "Save preferences" }).click();
  await expect.poll(() => tagRequests.length).toBe(1);
  await expect.poll(async () => (await calls(page)).length).toBeGreaterThan(0);
  expect((await calls(page))[0].args).toEqual(["consentv2", { analytics_Storage: "granted", ad_Storage: "denied" }]);
  expect((await context.cookies()).some(cookie => cookie.name === "_clck")).toBeTruthy();
  await page.getByRole("button", { name: "Cookie settings" }).click();
  await page.getByRole("button", { name: "Essential only" }).click();
  expect((await calls(page)).at(-1)?.args).toEqual(["stop"]);
  expect((await context.cookies()).filter(cookie => /^_cl[cs]k$/.test(cookie.name))).toHaveLength(0);
  expect(tagRequests).toHaveLength(1);
  expect(errors).toEqual([]);
});

test("private navigation stops recording before the private page renders", async ({ page }) => {
  const { tagRequests } = await prepare(page, accepted);
  await page.goto(site, { waitUntil: "load" });
  await expect.poll(async () => (await calls(page)).length).toBeGreaterThan(0);
  await page.getByRole("link", { name: "Admin sign in", exact: true }).click();
  await expect(page).toHaveURL(`${site}/admin/login`);
  const stop = (await calls(page)).find(call => call.args[0] === "stop");
  expect(stop?.path).toBe("/");
  expect(tagRequests).toHaveLength(1);
});

for (const path of ["/admin/login", "/portal/access", "/network-tools/strong-password-generator", "/courses/ccna", "/diagnose", "/?email=private@example.com"]) {
  test(`no recording on direct excluded visit ${path}`, async ({ page }) => {
    const { tagRequests } = await prepare(page, accepted);
    await page.goto(`${site}${path}`, { waitUntil: "load" });
    await page.waitForTimeout(200);
    expect(tagRequests).toHaveLength(0);
  });
}

test("successful lead emits only a fixed event name and form is masked", async ({ page }) => {
  await prepare(page, accepted);
  await page.goto(site, { waitUntil: "load" });
  await expect.poll(async () => (await calls(page)).length).toBeGreaterThan(0);
  const form = page.locator("form.lead-form").first();
  await expect(form).toHaveAttribute("data-clarity-mask", "true");
  await form.locator('[name="name"]').fill("QA Private Name");
  await form.locator('[name="email"]').fill("private@example.com");
  await form.locator('[name="phone"]').fill("+910000000000");
  await form.locator('[name="interest"]').selectOption({ label: "Network security services" });
  await form.locator('[name="contactConsent"]').check();
  await form.getByRole("button", { name: "Request Review" }).click();
  await expect(form.locator(".form-note")).toContainText("Request received");
  expect((await calls(page)).filter(call => call.args[0] === "event").map(call => call.args)).toEqual([["event", "generate_lead"]]);
  expect(JSON.stringify(await calls(page))).not.toContain("private@example.com");
});

test("pending tag cannot load into a private navigation", async ({ page }) => {
  const { tagRequests } = await prepare(page, accepted, 2500);
  await page.goto(site, { waitUntil: "domcontentloaded" });
  await expect.poll(() => tagRequests.length).toBe(1);
  await page.getByRole("link", { name: "Admin sign in", exact: true }).click();
  await expect(page).toHaveURL(`${site}/admin/login`);
  await page.waitForTimeout(2800);
  expect(await calls(page)).toEqual([]);
  expect(tagRequests).toHaveLength(1);
});

test("withdrawal while a tag is pending unloads it without recording", async ({ page }) => {
  const { tagRequests } = await prepare(page, undefined, 3500);
  await page.goto(site, { waitUntil: "load" });
  await page.getByRole("button", { name: "Allow all", exact: true }).click();
  await expect.poll(() => tagRequests.length).toBe(1);
  await page.getByRole("button", { name: "Cookie settings" }).click();
  await page.getByRole("button", { name: "Essential only" }).click();
  await page.waitForTimeout(4000);
  expect(await calls(page)).toEqual([]);
  expect(tagRequests).toHaveLength(1);
  expect(await page.evaluate(key => JSON.parse(localStorage.getItem(key) || "{}").sessionReplay, consentKey)).toBe(false);
});

for (const viewport of [{ width: 320, height: 568 }, { width: 390, height: 844 }, { width: 1440, height: 900 }]) {
test(`preferences fit and remain usable at ${viewport.width}px`, async ({ page }) => {
  await page.setViewportSize(viewport);
  await prepare(page);
  await page.goto(site, { waitUntil: "load" });
  await page.getByRole("button", { name: "Customize", exact: true }).click();
  await expect(page.getByRole("button", { name: "Save preferences" })).toBeVisible();
  const box = await page.getByRole("dialog", { name: "Your privacy choices" }).boundingBox();
  expect(box).toBeTruthy();
  expect(box!.x).toBeGreaterThanOrEqual(0);
  expect(box!.x + box!.width).toBeLessThanOrEqual(viewport.width + 1);
  expect(box!.y).toBeGreaterThanOrEqual(0);
  expect(box!.y + box!.height).toBeLessThanOrEqual(viewport.height + 1);
  const heading = page.getByRole("heading", { name: "Your privacy choices" });
  expect(await heading.evaluate(element => {
    const rect = element.getBoundingClientRect();
    return Boolean(document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2)?.closest(".cookie-panel"));
  })).toBe(true);
  await page.screenshot({ path: `test-results/frontend/clarity-${viewport.width}.png`, fullPage: false });
  await page.getByRole("button", { name: "Save preferences" }).click();
  await expect(page.getByRole("dialog", { name: "Your privacy choices" })).toHaveCount(0);
});
}

test("real hosted SDK honors masking and stops at the private route boundary", async ({ page }) => {
  test.skip(process.env.CLARITY_LIVE_SDK_QA !== "1", "Explicit network-enabled SDK verification only; collection is intercepted.");
  const { uploads, errors } = await prepare(page, accepted, 0, true);
  await page.goto(site, { waitUntil: "load" });
  await expect.poll(() => page.evaluate(() => Boolean((window as unknown as { clarity?: { v?: string } }).clarity?.v))).toBe(true);
  await page.locator('form.lead-form [name="name"]').first().fill("CLARITY_PRIVATE_SENTINEL_8205");
  await page.locator('form.lead-form [name="email"]').first().fill("clarity-private-sentinel@example.com");
  await expect.poll(() => uploads.length, { timeout: 15_000 }).toBeGreaterThan(0);
  await page.getByRole("link", { name: "Admin sign in", exact: true }).click();
  await expect(page).toHaveURL(`${site}/admin/login`);
  await expect.poll(() => page.evaluate(() => Boolean((window as unknown as { clarity?: { v?: string } }).clarity?.v))).toBe(false);
  await page.waitForTimeout(1000);
  const count = uploads.length;
  await page.waitForTimeout(3000);
  expect(uploads).toHaveLength(count);
  expect(uploads.join("\n")).not.toContain("CLARITY_PRIVATE_SENTINEL_8205");
  expect(uploads.join("\n")).not.toContain("clarity-private-sentinel@example.com");
  expect(errors).toEqual([]);
});

test("real hosted SDK stops collection and deletes cookies after withdrawal", async ({ page, context }) => {
  test.skip(process.env.CLARITY_LIVE_SDK_QA !== "1", "Explicit network-enabled SDK verification only; collection is intercepted.");
  const { uploads, errors } = await prepare(page, accepted, 0, true);
  await page.goto(site, { waitUntil: "load" });
  await expect.poll(() => page.evaluate(() => Boolean((window as unknown as { clarity?: { v?: string } }).clarity?.v))).toBe(true);
  await page.getByRole("button", { name: "Cookie settings" }).click();
  await page.getByRole("button", { name: "Essential only" }).click();
  await expect.poll(() => page.evaluate(() => Boolean((window as unknown as { clarity?: { v?: string } }).clarity?.v))).toBe(false);
  expect((await context.cookies()).filter(cookie => /^_cl[cs]k$/.test(cookie.name))).toHaveLength(0);
  await page.waitForTimeout(1000);
  const count = uploads.length;
  await page.waitForTimeout(3000);
  expect(uploads).toHaveLength(count);
  expect(errors).toEqual([]);
});
