import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Browser, type Page } from "@playwright/test";

const representativeRoutes = [
  "/",
  "/solutions",
  "/services/penetration-testing",
  "/diagnose",
  "/network-tools",
  "/network-tools/vendor-task-script-generator",
  "/institute",
  "/intelligence",
  "/resources",
  "/security-advisories",
  "/portal/access",
  "/admin/login"
];

const consent = JSON.stringify({
  necessary: true,
  analytics: false,
  marketing: false,
  personalization: false
});

async function preparePage(page: Page) {
  await page.addInitScript((value) => {
    window.localStorage.setItem("network-qcss-consent", value);
  }, consent);
}

async function sitemapRoutes(page: Page) {
  const response = await page.request.get("/sitemap.xml");
  expect(response.ok()).toBeTruthy();
  const xml = await response.text();
  return [...new Set([...xml.matchAll(/<loc>(.*?)<\/loc>/g)].map((match) => new URL(match[1]).pathname))];
}

async function auditRoute(page: Page, path: string, width: number) {
  const response = await page.goto(path, { waitUntil: "domcontentloaded", timeout: 30_000 });
  await page.waitForTimeout(350);

  const result = await page.evaluate(() => {
    const root = document.documentElement;
    const images = [...document.images]
      .filter((image) => {
        const rect = image.getBoundingClientRect();
        return (
          rect.width >= 80 &&
          rect.top < window.innerHeight * 1.25 &&
          rect.bottom > -window.innerHeight * 0.25 &&
          !image.classList.contains("hero-bg-image")
        );
      })
      .map((image) => {
        const rect = image.getBoundingClientRect();
        const source = image.currentSrc || image.src;
        const isVector = /\.svg(?:\?|$)/i.test(source);
        const requestedWidth = Number(new URL(source, window.location.href).searchParams.get("w")) || 0;
        return {
          source,
          complete: image.complete,
          naturalWidth: image.naturalWidth,
          renderedWidth: Math.round(rect.width),
          retinaReady: isVector || requestedWidth >= rect.width * 1.45 || image.naturalWidth >= rect.width * 1.45
        };
      });

    const clippedControls = [...document.querySelectorAll<HTMLElement>("button, a.button")]
      .filter((element) => {
        const style = getComputedStyle(element);
        const rect = element.getBoundingClientRect();
        return (
          rect.width > 0 &&
          rect.height > 0 &&
          style.overflowX !== "auto" &&
          element.scrollWidth > element.clientWidth + 2
        );
      })
      .map((element) => element.textContent?.trim().slice(0, 80) || element.getAttribute("aria-label") || element.tagName);

    return {
      documentWidth: root.scrollWidth,
      viewportWidth: window.innerWidth,
      h1Count: document.querySelectorAll("h1").length,
      hasContent: (document.body.innerText || "").trim().length > 100,
      hasErrorOverlay: Boolean(document.querySelector("[data-nextjs-dialog], .vite-error-overlay, #webpack-dev-server-client-overlay")),
      failedImages: images.filter((image) => !image.complete || image.naturalWidth === 0),
      lowResolutionImages: images.filter((image) => image.complete && image.naturalWidth > 0 && !image.retinaReady),
      clippedControls
    };
  });

  const failures: string[] = [];
  if (!response || response.status() >= 400) failures.push(`HTTP ${response?.status() ?? "no response"}`);
  if (!result.hasContent) failures.push("page has no meaningful visible content");
  if (result.hasErrorOverlay) failures.push("framework error overlay is visible");
  if (result.h1Count !== 1) failures.push(`expected one H1, found ${result.h1Count}`);
  if (result.documentWidth > width + 1) failures.push(`horizontal overflow ${result.documentWidth}px > ${width}px`);
  if (result.failedImages.length) failures.push(`${result.failedImages.length} image(s) failed to load`);
  if (result.lowResolutionImages.length) {
    failures.push(
      `non-retina image(s): ${result.lowResolutionImages
        .slice(0, 3)
        .map((image) => `${image.renderedWidth}px/${image.naturalWidth}px ${image.source.split("/").pop()}`)
        .join(", ")}`
    );
  }
  if (result.clippedControls.length) failures.push(`clipped control(s): ${result.clippedControls.slice(0, 3).join(", ")}`);

  return failures;
}

async function runSitemapAudit(browser: Browser, width: number, height: number) {
  const context = await browser.newContext({
    viewport: { width, height },
    deviceScaleFactor: 2,
    colorScheme: "light",
    locale: "en-IN"
  });
  const sitemapPage = await context.newPage();
  await preparePage(sitemapPage);
  const routes = await sitemapRoutes(sitemapPage);
  await sitemapPage.close();
  const failures: string[] = [];

  for (let index = 0; index < routes.length; index += 6) {
    const batch = routes.slice(index, index + 6);
    console.log(`[frontend-qa ${width}px] ${index + 1}-${Math.min(index + batch.length, routes.length)} of ${routes.length}`);
    const results = await Promise.all(
      batch.map(async (path) => {
        const page = await context.newPage();
        await preparePage(page);
        try {
          return { path, failures: await auditRoute(page, path, width) };
        } catch (error) {
          return { path, failures: [error instanceof Error ? error.message : "unknown browser failure"] };
        } finally {
          await page.close();
        }
      })
    );

    for (const result of results) {
      failures.push(...result.failures.map((failure) => `${result.path}: ${failure}`));
    }
  }

  await context.close();
  expect(failures, failures.join("\n")).toEqual([]);
}

test("all public sitemap routes pass desktop visual QA", async ({ browser }) => {
  await runSitemapAudit(browser, 1440, 1000);
});

test("all public sitemap routes pass mobile visual QA", async ({ browser }) => {
  await runSitemapAudit(browser, 390, 844);
});

test("representative page families have no serious accessibility violations", async ({ page }) => {
  await preparePage(page);

  for (const path of representativeRoutes) {
    const response = await page.goto(path, { waitUntil: "domcontentloaded" });
    expect(response?.status(), path).toBeLessThan(400);
    const results = await new AxeBuilder({ page }).analyze();
    const serious = results.violations.filter((violation) => violation.impact === "serious" || violation.impact === "critical");
    expect(serious, `${path}\n${serious.map((item) => `${item.id}: ${item.help}`).join("\n")}`).toEqual([]);
  }
});

test("consent panel is compact and contained on a small mobile viewport", async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 360, height: 740 }, deviceScaleFactor: 2 });
  const page = await context.newPage();
  await page.goto("/", { waitUntil: "domcontentloaded" });
  const panel = page.locator(".cookie-panel");
  await expect(panel).toBeVisible();
  const box = await panel.boundingBox();
  expect(box).not.toBeNull();
  expect(box!.x).toBeGreaterThanOrEqual(0);
  expect(box!.x + box!.width).toBeLessThanOrEqual(360);
  expect(box!.y).toBeGreaterThanOrEqual(0);
  expect(box!.y + box!.height).toBeLessThanOrEqual(740);
  await context.close();
});

test("representative pages render at four responsive breakpoints", async ({ browser }, testInfo) => {
  const viewports = [
    { name: "mobile", width: 390, height: 844 },
    { name: "tablet", width: 768, height: 1024 },
    { name: "desktop", width: 1440, height: 1000 },
    { name: "wide", width: 1920, height: 1080 }
  ];

  for (const viewport of viewports) {
    const context = await browser.newContext({
      viewport: { width: viewport.width, height: viewport.height },
      deviceScaleFactor: 2
    });
    const page = await context.newPage();
    await preparePage(page);

    for (const path of ["/", "/network-tools", "/services/penetration-testing", "/resources"]) {
      const failures = await auditRoute(page, path, viewport.width);
      expect(failures, `${path} at ${viewport.name}: ${failures.join("; ")}`).toEqual([]);
      const name = `${path === "/" ? "home" : path.split("/").filter(Boolean).join("-")}-${viewport.name}.png`;
      await page.screenshot({ path: testInfo.outputPath(name), fullPage: false });
    }

    await context.close();
  }
});
