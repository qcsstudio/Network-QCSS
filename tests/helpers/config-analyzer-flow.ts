import { expect, type Page } from "@playwright/test";

export async function validateAndExplain(page: Page) {
  await page.getByRole("button", { name: "Validate configuration", exact: true }).click();
  const explain = page.getByRole("button", { name: "Explain configuration", exact: true });
  await expect(explain).toBeVisible({ timeout: 65_000 });
  await explain.click();
}
