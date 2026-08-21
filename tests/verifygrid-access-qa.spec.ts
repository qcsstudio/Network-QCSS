import { expect, test } from "@playwright/test";

async function expectNoHorizontalOverflow(page: import("@playwright/test").Page) {
  const dimensions = await page.evaluate(() => ({ clientWidth: document.documentElement.clientWidth, scrollWidth: document.documentElement.scrollWidth }));
  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth + 1);
}

for (const viewport of [
  { name: "desktop", width: 1440, height: 1000 },
  { name: "mobile", width: 390, height: 844 }
]) {
  test(`VerifyGrid access surfaces are responsive on ${viewport.name}`, async ({ page }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });

    await page.goto("/admin/login", { waitUntil: "networkidle" });
    await expect(page.getByRole("heading", { name: "Private operations console." })).toBeVisible();
    await expectNoHorizontalOverflow(page);

    await page.goto("/portal/access", { waitUntil: "networkidle" });
    await expect(page.getByRole("heading", { name: "Client assurance access" })).toBeVisible();
    await expectNoHorizontalOverflow(page);

    await page.goto("/verifygrid/onboard", { waitUntil: "networkidle" });
    await expect(page.getByRole("heading", { name: "Open a controlled security assurance workspace." })).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });
}

test("authenticated admin sees the explicit VerifyGrid assurance boundary", async ({ page }) => {
  test.skip(!process.env.ADMIN_EMAIL || !process.env.ADMIN_PASSWORD, "Local admin credentials are not configured for browser QA.");
  await page.goto("/admin/login", { waitUntil: "networkidle" });
  await page.getByLabel("Email address").fill(process.env.ADMIN_EMAIL || "");
  await page.locator("#admin-password").fill(process.env.ADMIN_PASSWORD || "");
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL("**/admin");
  await page.getByRole("tab", { name: /VerifyGrid/i }).click();
  await expect(page.getByText("Phishing-resistant operator access").or(page.getByText("Verified operator"))).toBeVisible();
  await expectNoHorizontalOverflow(page);
});
