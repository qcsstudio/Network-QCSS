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
  "/courses/ccna",
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
  const response = await page.goto(path, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await page.waitForTimeout(350);
  await page
    .waitForFunction(
      () =>
        [...document.images]
          .filter((image) => {
            const rect = image.getBoundingClientRect();
            return rect.width >= 80 && rect.top < window.innerHeight * 1.25 && rect.bottom > -window.innerHeight * 0.25;
          })
          .every((image) => image.complete),
      undefined,
      { timeout: 15_000 }
    )
    .catch(() => undefined);

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

    const cardSelector = [
      ".journey-card",
      ".service-card",
      ".mode-card",
      ".utility-card",
      ".flow-card",
      ".resource-card",
      ".authority-card",
      ".pillar-card",
      ".faq-card",
      ".edge-card",
      ".outcome-list > article"
    ].join(",");

    const misalignedCardVisuals = [...document.querySelectorAll<HTMLElement>(".card-visual")]
      .filter((visual) => visual.getBoundingClientRect().width > 0)
      .flatMap((visual) => {
        const icon = visual.querySelector<SVGElement>("svg");
        if (!icon) return [];
        const visualRect = visual.getBoundingClientRect();
        const iconRect = icon.getBoundingClientRect();
        const horizontalDelta = Math.abs(iconRect.left + iconRect.width / 2 - (visualRect.left + visualRect.width / 2));
        const verticalDelta = Math.abs(iconRect.top + iconRect.height / 2 - (visualRect.top + visualRect.height / 2));
        return horizontalDelta > 2 || verticalDelta > 2
          ? [`${visual.parentElement?.className || "card"} (${horizontalDelta.toFixed(1)}px/${verticalDelta.toFixed(1)}px)`]
          : [];
      });

    const misalignedCardContent = [...document.querySelectorAll<HTMLElement>(cardSelector)]
      .filter((card) => card.getBoundingClientRect().width > 0)
      .flatMap((card) => {
        const alignedChildren = [...card.children].filter(
          (child): child is HTMLElement =>
            child instanceof HTMLElement &&
            child.matches(".card-visual, .eyebrow, h2, h3, p:not(.eyebrow), .text-link, .mini-chip-row, .resource-audience")
        );
        if (alignedChildren.length < 2) return [];
        const leftEdges = alignedChildren.map((child) => child.getBoundingClientRect().left);
        const spread = Math.max(...leftEdges) - Math.min(...leftEdges);
        return spread > 2 ? [`${card.className || card.tagName} (${spread.toFixed(1)}px)`] : [];
      });

    const rowGrids = [
      ".journey-grid",
      ".service-grid",
      ".mode-grid",
      ".utility-grid",
      ".automation-grid",
      ".resource-grid",
      ".authority-grid",
      ".pillar-grid",
      ".faq-grid",
      ".outcome-list"
    ];
    const misalignedCardRows: string[] = [];

    for (const grid of document.querySelectorAll<HTMLElement>(rowGrids.join(","))) {
      const cards = [...grid.children].filter(
        (child): child is HTMLElement => child instanceof HTMLElement && child.matches(cardSelector) && child.getBoundingClientRect().width > 0
      );
      const rows: { top: number; cards: HTMLElement[] }[] = [];

      for (const card of cards) {
        const top = card.getBoundingClientRect().top;
        const row = rows.find((candidate) => Math.abs(candidate.top - top) <= 3);
        if (row) row.cards.push(card);
        else rows.push({ top, cards: [card] });
      }

      for (const row of rows.filter((candidate) => candidate.cards.length > 1)) {
        const heights = row.cards.map((card) => card.getBoundingClientRect().height);
        const heightSpread = Math.max(...heights) - Math.min(...heights);
        if (heightSpread > 2) misalignedCardRows.push(`${grid.className} card heights (${heightSpread.toFixed(1)}px)`);

        const actions = row.cards.map((card) =>
          [...card.children]
            .reverse()
            .find(
              (child): child is HTMLElement =>
                child instanceof HTMLElement && child.matches(".text-link, .mini-chip-row, button.button")
            )
        );
        if (actions.every((action): action is HTMLElement => Boolean(action))) {
          const bottoms = actions.map((action) => action.getBoundingClientRect().bottom);
          const actionSpread = Math.max(...bottoms) - Math.min(...bottoms);
          if (actionSpread > 3) misalignedCardRows.push(`${grid.className} action baselines (${actionSpread.toFixed(1)}px)`);
        }
      }
    }

    const insufficientSectionGutters = [...document.querySelectorAll<HTMLElement>(".section")]
      .filter((section) => section.getBoundingClientRect().width > 0)
      .flatMap((section) => {
        const sectionRect = section.getBoundingClientRect();
        const edgeChildren = [...section.children].filter((child): child is HTMLElement => {
          if (!(child instanceof HTMLElement) || child.getAttribute("aria-hidden") === "true") return false;
          const rect = child.getBoundingClientRect();
          const style = getComputedStyle(child);
          return rect.width > 0 && rect.height > 0 && style.position !== "absolute" && style.position !== "fixed";
        });
        const offenders = edgeChildren.filter((child) => {
          const rect = child.getBoundingClientRect();
          return rect.left - sectionRect.left < 16 || sectionRect.right - rect.right < 16;
        });
        return offenders.length
          ? [`${section.className || "section"} (${offenders.map((child) => child.className || child.tagName).slice(0, 3).join(", ")})`]
          : [];
      });

    return {
      documentWidth: root.scrollWidth,
      viewportWidth: window.innerWidth,
      h1Count: document.querySelectorAll("h1").length,
      hasContent: (document.body.innerText || "").trim().length > 100,
      hasErrorOverlay: Boolean(document.querySelector("[data-nextjs-dialog], .vite-error-overlay, #webpack-dev-server-client-overlay")),
      failedImages: images.filter((image) => !image.complete || image.naturalWidth === 0),
      lowResolutionImages: images.filter((image) => image.complete && image.naturalWidth > 0 && !image.retinaReady),
      optimizedDynamicVisuals: images.filter(
        (image) => image.source.includes("/_next/image?") && decodeURIComponent(image.source).includes("/visual")
      ),
      clippedControls,
      misalignedCardVisuals,
      misalignedCardContent,
      misalignedCardRows,
      insufficientSectionGutters
    };
  });

  const failures: string[] = [];
  if (!response || response.status() >= 400) failures.push(`HTTP ${response?.status() ?? "no response"}`);
  if (!result.hasContent) failures.push("page has no meaningful visible content");
  if (result.hasErrorOverlay) failures.push("framework error overlay is visible");
  if (result.h1Count !== 1) failures.push(`expected one H1, found ${result.h1Count}`);
  if (result.documentWidth > width + 1) failures.push(`horizontal overflow ${result.documentWidth}px > ${width}px`);
  if (result.failedImages.length) failures.push(`${result.failedImages.length} image(s) failed to load`);
  if (result.optimizedDynamicVisuals.length) {
    failures.push(`${result.optimizedDynamicVisuals.length} generated visual(s) use the redundant image optimizer`);
  }
  if (result.lowResolutionImages.length) {
    failures.push(
      `non-retina image(s): ${result.lowResolutionImages
        .slice(0, 3)
        .map((image) => `${image.renderedWidth}px/${image.naturalWidth}px ${image.source.split("/").pop()}`)
        .join(", ")}`
    );
  }
  if (result.clippedControls.length) failures.push(`clipped control(s): ${result.clippedControls.slice(0, 3).join(", ")}`);
  if (result.misalignedCardVisuals.length) {
    failures.push(`off-center card icon(s): ${result.misalignedCardVisuals.slice(0, 3).join(", ")}`);
  }
  if (result.misalignedCardContent.length) {
    failures.push(`misaligned card content: ${result.misalignedCardContent.slice(0, 3).join(", ")}`);
  }
  if (result.misalignedCardRows.length) {
    failures.push(`inconsistent card row(s): ${result.misalignedCardRows.slice(0, 3).join(", ")}`);
  }
  if (result.insufficientSectionGutters.length) {
    failures.push(`section content lacks edge clearance: ${result.insufficientSectionGutters.slice(0, 3).join(", ")}`);
  }

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

  const batchSize = 3;
  for (let index = 0; index < routes.length; index += batchSize) {
    const batch = routes.slice(index, index + batchSize);
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

test("all public sitemap routes pass compact desktop visual QA", async ({ browser }) => {
  await runSitemapAudit(browser, 1024, 900);
});

test("all public sitemap routes pass tablet visual QA", async ({ browser }) => {
  await runSitemapAudit(browser, 768, 1024);
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
    const issues = serious.flatMap((item) => item.nodes.map((node) => `${item.id}: ${node.target.join(" ")}`));
    expect(issues, `${path}\n${issues.join("\n")}`).toEqual([]);
  }
});

test("CCNA syllabus stays aligned and readable at every supported breakpoint", async ({ browser }, testInfo) => {
  for (const width of [360, 390, 768, 1024, 1440, 1920]) {
    const context = await browser.newContext({ viewport: { width, height: 900 }, deviceScaleFactor: 2 });
    const page = await context.newPage();
    await preparePage(page);
    const failures = await auditRoute(page, "/courses/ccna", width);
    expect(failures, `${width}px: ${failures.join("; ")}`).toEqual([]);
    await expect(page.locator(".ccna-module li")).toHaveCount(60);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("CCNA 200-301 Networking Course");
    await page.screenshot({ path: testInfo.outputPath(`ccna-${width}.png`), fullPage: false });
    await context.close();
  }
});

test("published CCNA lesson headings and quiz controls fit every breakpoint", async ({ page }) => {
  await preparePage(page);
  await page.goto("/courses/ccna", { waitUntil: "domcontentloaded" });
  const firstLesson = page.locator(".ccna-module li a").first();
  test.skip(await firstLesson.count() === 0, "Publish a CCNA lesson before running lesson-content QA.");
  const path = await firstLesson.getAttribute("href");
  expect(path).toBeTruthy();
  for (const width of [360, 390, 768, 1024, 1440, 1920]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(path!, { waitUntil: "domcontentloaded" });
    await page.evaluate(() => document.fonts.ready);
    const clipped = await page.locator(".ccna-lesson-page").evaluate((root) => [...root.querySelectorAll<HTMLElement>("h1, h2, h3, button, legend")]
      .filter((element) => element.clientWidth > 0 && element.scrollWidth > element.clientWidth + 2)
      .map((element) => element.textContent?.slice(0, 100)));
    expect(clipped, `Clipped headings or controls at ${width}px`).toEqual([]);
    expect(await page.getByRole("radio").count()).toBeGreaterThanOrEqual(20);
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

test("optional Google tags do not load before consent", async ({ page }) => {
  await preparePage(page);
  await page.goto("/", { waitUntil: "networkidle" });

  const optionalGoogleScripts = await page.locator(
    'script[src*="googletagmanager.com/gtm.js"], script[src*="googletagmanager.com/gtag/js"]'
  ).count();

  expect(optionalGoogleScripts).toBe(0);
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
