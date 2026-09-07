import assert from "node:assert/strict";
import test from "node:test";
import { readFile, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { build } from "esbuild";
import { chromium } from "@playwright/test";

test("admin capacity status updates on 429 and Resume waits for cooldown at desktop and mobile widths", async () => {
  const lesson = { id: "fixture-day-3", sequence: 3, week: 1, day: 3, slug: "network-topologies", title: "Network topologies", moduleTitle: "Network fundamentals", status: "scheduled", attempts: 0, qualityScore: 0, content: null, lastError: "", v11Blueprint: "1.2", v20Blueprint: "1.2" };
  const bundle = await build({ stdin: {
    contents: `import React from 'react'; import {createRoot} from 'react-dom/client'; import {CcnaLearningDesk} from './src/components/ccna-learning-desk'; createRoot(document.getElementById('root')).render(<CcnaLearningDesk initialLessons={${JSON.stringify([lesson])}} />);`,
    resolveDir: process.cwd(), loader: "jsx"
  }, bundle: true, write: false, platform: "browser", format: "iife", jsx: "automatic", define: { "process.env.NODE_ENV": '"production"', "process.env": "{}" } });
  const css = await readFile("src/app/globals.css", "utf8");
  const directory = path.join(tmpdir(), "qcs-ccna-capacity-qa");
  await mkdir(directory, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  try {
    for (const width of [320, 390, 768, 1440]) {
      const page = await browser.newPage({ viewport: { width, height: 950 }, deviceScaleFactor: 2 });
      const errors = [];
      page.on("pageerror", (error) => errors.push(error.message));
      let requests = 0;
      await page.route("**/*", async (route) => {
        const request = route.request();
        if (request.url() === "http://ccna-qa.test/") return route.fulfill({ contentType: "text/html", body: `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}</style></head><body><div id="root"></div></body></html>` });
        if (request.url() === "http://ccna-qa.test/api/admin/ccna-lessons") {
          requests += 1;
          assert.equal(request.postDataJSON().action, "generate");
          const retry = { ...lesson, status: "retry", attempts: 1, lastError: "Provider capacity pause. Completed stages are saved.", generationProgress: { completedSteps: 7, stage: "independent technical review", retryAt: new Date(Date.now() + 2000).toISOString() } };
          return route.fulfill({ status: 429, contentType: "application/json", headers: { "Retry-After": "2" }, body: JSON.stringify({ ok: false, error: "Provider capacity pause.", lessons: [retry] }) });
        }
        return route.abort();
      });
      await page.goto("http://ccna-qa.test/");
      await page.addScriptTag({ content: bundle.outputFiles[0].text });
      await page.waitForFunction(() => document.getElementById("root").childElementCount > 0, null, { timeout: 5000 }).catch(() => { throw new Error(`The fixture did not render: ${errors.join("; ")}`); });
      await page.getByRole("button", { name: "Generate lesson", exact: true }).click();
      const resume = page.getByRole("button", { name: "Resume generation", exact: true });
      await resume.waitFor();
      assert.equal(await resume.isDisabled(), true);
      assert.match(await page.getByRole("status").innerText(), /7 completed stages saved.*independent technical review/);
      await page.waitForFunction(() => [...document.querySelectorAll("button")].some((button) => button.textContent.includes("Resume generation") && !button.disabled));
      assert.equal(requests, 1, "The UI must not silently start another paid generation.");
      assert.match(await page.getByRole("status").innerText(), /Ready to resume/);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false, `Overflow at ${width}px`);
      assert.deepEqual(errors, []);
      await page.locator(".ccna-admin-detail").screenshot({ path: path.join(directory, `resume-${width}.png`) });
      await page.close();
    }
  } finally { await browser.close(); }
  console.log(`CCNA admin QA screenshots: ${directory}`);
});
