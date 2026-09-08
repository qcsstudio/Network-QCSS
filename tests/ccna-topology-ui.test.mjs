import assert from "node:assert/strict";
import test from "node:test";
import { readFile, readdir, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { build } from "esbuild";
import { chromium } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import postcss from "postcss";
import { ccnaTopologyPrelude, ccnaTopologyVisual } from "../src/lib/ccna-topology-contract.ts";

test("five interactive comparisons have complete, unclipped diagrams at desktop and mobile sizes", async () => {
  const story = ccnaTopologyVisual();
  const scenes = [story, ...story.comparisons];
  const bundle = await build({ stdin: {
    contents: `import React from 'react'; import {createRoot} from 'react-dom/client'; import {CcnaTeachingPrelude} from './src/components/ccna-teaching-prelude'; import {CcnaVisualExplainer} from './src/components/ccna-visual-explainer'; createRoot(document.getElementById('root')).render(<><CcnaTeachingPrelude prelude={${JSON.stringify(ccnaTopologyPrelude)}} /><CcnaVisualExplainer story={${JSON.stringify(story)}} artwork={null} /></>);`,
    resolveDir: process.cwd(), loader: "jsx"
  }, bundle: true, write: false, platform: "browser", format: "iife", jsx: "automatic", define: { "process.env.NODE_ENV": '"production"', "process.env": "{}" } });
  let css = "";
  for (const file of ["globals.css", "visual-refresh.css", "visual-evolution.css", "experience-v2.css"]) css += await readFile(`src/app/${file}`, "utf8");
  const fontVariables = new Map();
  const fontFaces = [];
  const chunks = ".next/static/chunks";
  for (const file of await readdir(chunks)) if (file.endsWith(".css")) {
    const sheet = postcss.parse(await readFile(path.join(chunks, file), "utf8"));
    sheet.walkDecls(/^--font-(?:display|body|tech)$/, (declaration) => fontVariables.set(declaration.prop, declaration.value));
    sheet.walkAtRules("font-face", (rule) => { fontFaces.push(rule.toString()); });
  }
  assert.equal(fontVariables.size, 3, "Run the production build first to verify with the actual site fonts.");
  for (let face of fontFaces) {
    for (const match of face.matchAll(/url\((?:["']?)([^)'" ]+)(?:["']?)\)/g)) {
      if (match[1].startsWith("data:")) continue;
      const asset = path.join(".next/static/media", path.basename(match[1]));
      face = face.replace(match[0], `url(data:font/woff2;base64,${(await readFile(asset)).toString("base64")})`);
    }
    css += face;
  }
  css += `:root{${[...fontVariables].map(([key, value]) => `${key}:${value}`).join(";")}}`;
  const directory = path.join(tmpdir(), "qcs-ccna-day3-qa");
  await mkdir(directory, { recursive: true });
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>QCS CCNA Day 3 topology preview</title><style>${css}\nbody{margin:0;background:#fafbfc}main{max-width:1120px;margin:auto;padding:16px}h1{font-size:24px}</style></head><body><main><h1>CCNA Day 3: topology comparison preview</h1><article class="ccna-lesson-article" id="root"></article></main><script>${bundle.outputFiles[0].text.replaceAll("</script", "<\\/script")}</script></body></html>`;
  await writeFile(path.join(directory, "preview.html"), html);
  const browser = await chromium.launch({ headless: true });
  try {
    for (const width of [320, 390, 768, 1440]) {
      const context = await browser.newContext({ viewport: { width, height: 1000 }, deviceScaleFactor: 2, reducedMotion: "reduce" });
      const page = await context.newPage();
      const errors = [];
      page.on("pageerror", (error) => errors.push(error.message));
      await page.route("**/*", (route) => route.request().url() === "http://ccna-topology.test/" ? route.fulfill({ contentType: "text/html", body: html }) : route.abort());
      await page.goto("http://ccna-topology.test/");
      await page.getByRole("group", { name: "Network topologies", exact: true }).waitFor();
      await page.evaluate(() => document.fonts.ready);
      assert.equal(await page.locator("#first-concepts dt").count(), ccnaTopologyPrelude.terms.length);
      assert.deepEqual(await page.locator("#first-concepts dd").allTextContents(), ccnaTopologyPrelude.terms.map((term) => term.meaning));
      assert.equal(await page.evaluate(() => Boolean(document.querySelector("#first-concepts").compareDocumentPosition(document.querySelector("#visual-walkthrough")) & Node.DOCUMENT_POSITION_FOLLOWING)), true);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false, `Prelude overflow at ${width}px`);
      await page.locator("#first-concepts").screenshot({ path: path.join(directory, `First-concepts-${width}.png`) });
      for (const scene of scenes) {
        const select = page.getByRole("group", { name: "Network topologies", exact: true }).getByRole("button", { name: scene.title, exact: true });
        await select.click();
        assert.equal(await select.getAttribute("aria-pressed"), "true");
        for (let stage = 0; stage < 3; stage++) {
          await page.getByRole("group", { name: "Visual explanation steps", exact: true }).getByRole("button").nth(stage).click();
          assert.equal(await page.locator(".ccna-visual-stage-copy p").innerText(), scene.stages[stage].explanation);
          const svg = page.locator("svg[role=img]:visible");
          assert.equal(await svg.getAttribute("aria-label"), scene.altText);
          assert.equal(await svg.locator("path[data-connection]").count(), scene.connections.length);
          const labels = await svg.locator("text").allTextContents();
          for (const node of scene.nodes) assert.ok(labels.join(" ").includes(node.label), `${width}: missing ${node.label}`);
          const clipping = await svg.evaluate((svg) => {
            const view = svg.viewBox.baseVal;
            return [...svg.querySelectorAll("text")].filter((text) => { const box = text.getBBox(); return box.x < 0 || box.y < 0 || box.x + box.width > view.width || box.y + box.height > view.height; }).map((text) => text.textContent);
          });
          assert.deepEqual(clipping, [], `${width}: clipped SVG text`);
          assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false, `Overflow at ${width}px`);
        }
        await page.locator("#visual-walkthrough").screenshot({ path: path.join(directory, `${scene.title.replaceAll(" ", "-")}-${width}.png`) });
      }
      await page.getByText("Full visual explanation and references", { exact: true }).click();
      const transcript = await page.locator(".ccna-visual-transcript").innerText();
      for (const scene of scenes) { assert.ok(transcript.includes(scene.altText)); assert.ok(transcript.includes(scene.boundary)); }
      await page.getByText("Full visual explanation and references", { exact: true }).click();
      const analysis = await new AxeBuilder({ page }).include("#first-concepts").include("#visual-walkthrough").withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
      assert.deepEqual(analysis.violations.map((violation) => ({ id: violation.id, description: violation.description })), []);
      assert.deepEqual(errors, []);
      await context.close();
    }
  } finally { await browser.close(); }
  console.log(`Day 3 component QA and preview: ${directory}`);
});
