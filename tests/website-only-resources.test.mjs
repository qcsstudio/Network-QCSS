import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import test from "node:test";
import { evaluateEditorialReadiness } from "../src/lib/editorial-publication-policy.ts";
import { fortinetHardeningGuide as post, resourceCardImage, websiteOnlyResources, withWebsiteOnlyResources } from "../src/lib/website-only-resources.ts";
import sitemapModule from "../src/app/resources/sitemap.ts";
import { siteConfig } from "../src/lib/content.ts";

const sitemap = typeof sitemapModule === "function" ? sitemapModule : sitemapModule.default;

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const hash = (value) => createHash("sha256").update(value).digest("hex");
const review = JSON.parse(read("src/content/website-only/fortinet-october-2026-hardening.review.json"));
function sorted(value) {
  if (Array.isArray(value)) return value.map(sorted);
  if (value && typeof value === "object") return Object.fromEntries(Object.keys(value).sort().map((key) => [key, sorted(value[key])]));
  return value;
}

test("publication matches the exact independent PASS apart from permitted review/date metadata", () => {
  assert.equal(review.status, "PASS");
  assert.equal(review.reviewer, "Harvey (Codex independent reviewer)");
  const content = { ...post };
  for (const key of ["reviewedBy", "editorialMethod", "publishedAt", "updatedAt"]) delete content[key];
  assert.equal(hash(JSON.stringify(sorted(content))), review.metadataFinalization.substantiveContentSha256);
  assert.match(post.reviewedBy.name, /independent Codex/);
  assert.match(post.editorialMethod, /source-based AI review/);
  assert.match(post.editorialMethod, /No paid generation API, appliance upgrade, exploitation test or networking-lab runtime was used/);
  assert.deepEqual(review.requiredSubstantiveCorrections, []);
});

test("all editorial readiness gates pass and citations resolve to the bibliography", () => {
  assert.deepEqual(evaluateEditorialReadiness(post).issues, []);
  const sources = new Set(post.sources.map((item) => item.url));
  for (const section of [...post.sections, ...post.questions]) {
    assert.ok(section.sourceUrls.length > 0);
    for (const url of section.sourceUrls) assert.ok(sources.has(url));
  }
});

test("the high-resolution image is the exact independently reviewed master", () => {
  const image = readFileSync(new URL(`../public${post.image}`, import.meta.url));
  assert.equal(hash(image), review.artifacts.masterImage.sha256);
  assert.equal(image.readUInt32BE(16), 2400);
  assert.equal(image.readUInt32BE(20), 1350);
});

test("presentation merge is non-mutating, deduplicated and uses the static image only for website-only content", () => {
  const other = { ...post, slug: "other", publishedAt: "2026-10-01" };
  const existing = [other, { ...post, title: "Older record" }];
  const merged = withWebsiteOnlyResources(existing);
  assert.equal(merged.length, 2);
  assert.equal(merged[0].title, post.title);
  assert.equal(existing[1].title, "Older record");
  assert.equal(resourceCardImage(post), post.image);
  assert.equal(resourceCardImage(other), "/resources/other/visual");
  assert.equal(websiteOnlyResources.length, 1);
});

test("exact route and additive sitemap are static and contain no database or publishing imports", () => {
  for (const path of [`src/app/resources/${post.slug}/page.tsx`, "src/app/resources/sitemap.ts"]) {
    const source = read(path);
    assert.match(source, /export const dynamic = "error"/);
    assert.doesNotMatch(source, /content-posts|prisma|editorial-delivery|openai|fetch\(/i);
  }
  const page = read(`src/app/resources/${post.slug}/page.tsx`);
  assert.match(page, /showLeadForm=\{false\}/);
  assert.match(page, /TechArticle/);
  assert.match(page, /visualSrc=\{post.image\}/);
  assert.match(page, /title: \{ absolute: post.metaTitle \}/);
  assert.match(page, /visualLinkLabel="View full-size release map"/);
  const robots = read("src/app/robots.ts");
  assert.match(robots, /\$\{siteConfig.url\}\/sitemap.xml/);
  assert.match(robots, /resources\/sitemap.xml/);
});

test("additive sitemap location covers every listed URL and image inventory is preserved", () => {
  const location = new URL("/resources/sitemap.xml", siteConfig.url);
  const directory = new URL(".", location).pathname;
  for (const entry of sitemap()) {
    const url = new URL(entry.url);
    assert.equal(url.origin, location.origin);
    assert.ok(url.pathname.startsWith(directory), `${url.pathname} is outside ${directory}`);
    assert.ok(entry.images.length > 0);
  }
});

test("website-only registry is absent from seed, publishing, automation and social modules", () => {
  for (const file of readdirSync(new URL("../src/lib/", import.meta.url))) {
    if (!/content-posts|editorial|advisori|linkedin|meta-|ccna-learning/.test(file) || !file.endsWith(".ts")) continue;
    assert.doesNotMatch(read(`src/lib/${file}`), /website-only-resources/, file);
  }
  assert.doesNotMatch(read("src/lib/blog.ts"), new RegExp(post.slug));
  assert.match(read("src/app/resources/page.tsx"), /withWebsiteOnlyResources\(await getAllPublishedBlogPosts\(\)\)/);
  assert.match(read("src/app/security-advisories/page.tsx"), /fortinetHardeningGuide.slug/);
});
