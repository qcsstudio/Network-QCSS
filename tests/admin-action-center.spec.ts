import { expect, test } from "@playwright/test";

for (const viewport of [{ height: 900, width: 1440 }, { height: 760, width: 390 }]) {
  test(`admin action popup is accessible and contained at ${viewport.width}px`, async ({ page }) => {
    await page.setViewportSize(viewport);
    const response = await page.goto("/admin/login", { waitUntil: "networkidle" });
    expect(response?.ok()).toBeTruthy();
    await expect(page.getByRole("heading", { name: "Private operations console." })).toBeVisible();
    await expect(page.locator("[data-nextjs-dialog], .vite-error-overlay, #webpack-dev-server-client-overlay")).toHaveCount(0);
    await page.waitForFunction(() => document.documentElement.dataset.adminActionCenter === "ready");

    await page.evaluate(async () => {
      await fetch("/api/admin/content-posts", {
        body: JSON.stringify({ kind: "blog" }),
        headers: { "content-type": "application/json" },
        method: "POST"
      });
    });

    const toast = page.getByRole("complementary", { name: "Administration action status" }).getByRole("alert");
    await expect(toast).toBeVisible();
    await expect(toast).toContainText("Article creation");
    await expect(toast).toContainText("Unauthorized");
    const bounds = await toast.boundingBox();
    expect(bounds).not.toBeNull();
    expect(bounds!.x).toBeGreaterThanOrEqual(0);
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(viewport.width);
    expect(bounds!.y).toBeGreaterThanOrEqual(0);
    expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(viewport.height);
  });
}

test("partial advisory source failures are reported as a warning", async ({ page }) => {
  await page.route("**/api/cron/advisory-discovery", async (route) => {
    await route.fulfill({
      body: JSON.stringify({
        ok: true,
        results: [
          { error: "HTTP 503", published: 0, queued: 0, source: "Microsoft Security Response Center" },
          { published: 1, queued: 0, source: "AWS Security Bulletins" }
        ]
      }),
      contentType: "application/json",
      status: 200
    });
  });
  await page.goto("/admin/login", { waitUntil: "networkidle" });
  await page.waitForFunction(() => document.documentElement.dataset.adminActionCenter === "ready");
  await page.evaluate(() => fetch("/api/cron/advisory-discovery"));
  const warning = page.locator(".admin-action-toast.is-warning");
  await expect(warning).toBeVisible();
  await expect(warning).toContainText("2 sources checked; 1 published; 1 source warning(s).");
});
