import assert from "node:assert/strict";
import test from "node:test";
import { createRequire } from "node:module";
import { XMLParser, XMLValidator } from "fast-xml-parser";
import { escapeSitemapUrl } from "../src/lib/sitemap-policy.ts";
const require = createRequire(import.meta.url);
const { resolveSitemap } = require("next/dist/build/webpack/loaders/metadata/resolve-route-data.js");

test("the installed Next serializer emits valid XML for revision-pinned editorial image URLs", () => {
  const image = "https://www.qcsstudio.com/api/editorial-media/asset?variant=hero&v=2026-10-01T18%3A14%3A49.431Z";
  const xml = resolveSitemap([{ url: "https://www.qcsstudio.com/security-advisories/example", images: [escapeSitemapUrl(image)] }]);
  assert.equal(XMLValidator.validate(xml), true);
  assert.equal(new XMLParser().parse(xml).urlset.url["image:image"]["image:loc"], image);
});

test("XML escaping preserves URL meaning, including reserved characters", () => {
  const value = "https://example.test/?q=<tag>&quote=\"text\"&apostrophe='";
  const xml = `<loc>${escapeSitemapUrl(value)}</loc>`;
  assert.equal(XMLValidator.validate(xml), true);
  assert.equal(new XMLParser().parse(xml).loc, value);
});
