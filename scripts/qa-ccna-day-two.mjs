import assert from "node:assert/strict";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { chromium } from "@playwright/test";
import postcss from "postcss";
import { ccnaCurriculum } from "../src/lib/ccna-curriculum.ts";
import { ccnaLessonContentSchema } from "../src/lib/ccna-lesson-schema.ts";
import { applyCcnaTopicContract, evaluateCcnaLessonForTopic } from "../src/lib/ccna-content-agent.ts";
import { ccnaComparisonBoundary, ccnaSectionBoundary } from "../src/lib/ccna-lesson-presentation.ts";
import { CcnaTeachingPrelude } from "../src/components/ccna-teaching-prelude.tsx";
import { CcnaBeginnerGuide } from "../src/components/ccna-beginner-guide.tsx";
import { CcnaVisualDiagram } from "../src/components/ccna-visual-diagram.tsx";
import { CcnaLabBoundary } from "../src/components/ccna-lab-boundary.tsx";

// Read-only audit: no generation, publication or database update is performed.
const directory = path.resolve(".tmp-ccna-day-two-qa");
await mkdir(directory, { recursive: true });
let original;
if (process.argv.includes("--live-draft")) {
  const { getPrismaClient } = await import("../src/lib/prisma.ts");
  const db = getPrismaClient();
  try {
    const row = await db.ccnaLesson.findUniqueOrThrow({ where: { sequence: 2 }, select: { content: true } });
    original = row.content;
  } finally { await db.$disconnect(); }
} else {
  const input = process.argv[process.argv.indexOf("--input") + 1];
  if (!process.argv.includes("--input") || !input) throw new Error("Use --input <lesson-json> or --live-draft for a read-only database audit.");
  original = JSON.parse(await readFile(input, "utf8"));
}
const content = applyCcnaTopicContract(ccnaCurriculum[1], ccnaLessonContentSchema.parse(original));
await writeFile(path.join(directory, "normalized-draft.json"), JSON.stringify(content, null, 2));
const quality = evaluateCcnaLessonForTopic(ccnaCurriculum[1], content);
console.log(JSON.stringify({ deterministicChecks: quality, liveGenerationRun: false, independentReviewRun: false, published: false }));

globalThis.React = React;
const h = React.createElement;
const markup = renderToStaticMarkup(h("main", { className: "ccna-lesson-page" },
  h("h1", null, "Day 2 teaching review"),
  h("article", { className: "ccna-lesson-article" },
    h(CcnaTeachingPrelude, { prelude: content.teachingPrelude }),
    h("section", { id: "visual-walkthrough", className: "ccna-visual-explainer" },
      h("h2", null, content.visualStory.title),
      ...content.visualStory.stages.map((stage, stageIndex) => h("div", { key: stage.title, className: "qa-stage" },
        h("h3", null, stage.title),
        h("div", { className: "ccna-diagram-desktop", "data-layout": "sequence" }, h(CcnaVisualDiagram, { story: content.visualStory, stageIndex })),
        h("div", { className: "ccna-diagram-mobile" }, h(CcnaVisualDiagram, { story: content.visualStory, stageIndex, compact: true })),
        h("p", null, stage.explanation))),
      h(CcnaLabBoundary, { boundary: content.visualStory.boundary })),
    h(CcnaBeginnerGuide, { guide: content.beginnerGuide, labBoundary: ccnaComparisonBoundary(content, Object.values(content.beginnerGuide.everydayComparison)) }),
    ...content.sections.map((section) => h("section", { key: section.heading, className: "ccna-teaching-section" },
      h("h2", null, section.heading),
      h(CcnaLabBoundary, { boundary: ccnaSectionBoundary(content, section) }),
      h("p", null, section.explanation))))));
const css = await readFile("src/app/globals.css", "utf8");
const fonts = [];
const fontVariables = new Map();
for (const file of (await readdir(".next/static/chunks")).filter((name) => name.endsWith(".css"))) {
  const root = postcss.parse(await readFile(path.join(".next/static/chunks", file), "utf8"));
  root.walkDecls(/^--font-(?:body|display|tech)$/, (decl) => { fontVariables.set(decl.prop, decl.value); });
  const faces = [];
  root.walkAtRules("font-face", (face) => { faces.push(face.clone()); });
  for (const face of faces) {
    const src = face.nodes.find((node) => node.type === "decl" && node.prop === "src");
    const url = src?.value.match(/url\(["']?([^"')]+)["']?\)/)?.[1];
    if (!url || !url.includes(".woff2")) continue;
    const bytes = await readFile(path.join(".next/static/media", path.basename(new URL(url, "http://localhost").pathname)));
    src.value = `url(data:font/woff2;base64,${bytes.toString("base64")}) format('woff2')`;
    fonts.push(face.toString());
  }
}
assert.equal(fontVariables.size, 3, "Run the production build first to supply the site's real font definitions.");
const fontCss = `${fonts.join("\n")}\n:root{${[...fontVariables].map(([name, value]) => `${name}:${value}`).join(";")}}`;
const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Day 2 local QA</title><style>${fontCss}\n${css}</style></head><body>${markup}</body></html>`;
await writeFile(path.join(directory, "preview.html"), html);
const browser = await chromium.launch({ headless: true });
try {
  for (const width of [320, 390, 768, 1440]) {
    const page = await browser.newPage({ viewport: { width, height: 950 }, deviceScaleFactor: 2, reducedMotion: "reduce" });
    await page.route("https://**", (route) => route.abort());
    await page.setContent(html, { waitUntil: "load" });
    await page.evaluate(() => document.fonts.ready);
    const expectedGuideBoundary = !!ccnaComparisonBoundary(content, Object.values(content.beginnerGuide.everydayComparison));
    assert.equal(await page.locator(".ccna-beginner-comparison .ccna-lab-boundary-note").count(), expectedGuideBoundary ? 1 : 0);
    if (expectedGuideBoundary) {
      assert.equal(await page.locator(".ccna-beginner-comparison").evaluate((comparison) => comparison.querySelector(".ccna-lab-boundary-note").getBoundingClientRect().bottom <= comparison.querySelector(":scope > p").getBoundingClientRect().top), true, "The boundary must precede the beginner comparison.");
    }
    const metrics = await page.evaluate(() => {
      const prelude = document.querySelector("#first-concepts");
      const visual = document.querySelector("#visual-walkthrough");
      const guide = document.querySelector("#start-with-an-example");
      return {
        overflow: document.documentElement.scrollWidth > window.innerWidth + 1,
        terms: prelude.querySelectorAll("dt").length,
        definitionsFirst: prelude.getBoundingClientRect().bottom <= visual.getBoundingClientRect().top && visual.getBoundingClientRect().bottom <= guide.getBoundingClientRect().top,
        clipped: [...prelude.querySelectorAll("dt,dd"), ...document.querySelectorAll(".ccna-lab-boundary-note p")].some((element) => element.scrollWidth > element.clientWidth + 1)
      };
    });
    assert.equal(metrics.overflow, false, `Horizontal overflow at ${width}px`);
    assert.equal(metrics.clipped, false, `Clipped definitions at ${width}px`);
    assert.equal(metrics.definitionsFirst, true);
    assert.equal(metrics.terms, 10);
    await page.locator("#first-concepts").screenshot({ path: path.join(directory, `definitions-${width}.png`) });
    await page.locator(".qa-stage").nth(1).screenshot({ path: path.join(directory, `routing-${width}.png`) });
    await page.locator(".ccna-beginner-comparison").screenshot({ path: path.join(directory, `comparison-${width}.png`) });
    console.log(JSON.stringify({ width, deviceScaleFactor: 2, ...metrics }));
    await page.close();
  }
} finally { await browser.close(); }
