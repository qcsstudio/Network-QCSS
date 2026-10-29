import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";
import { evaluateEditorialReadiness } from "../src/lib/editorial-publication-policy.ts";
import { fortigateZtnaCaseStudy as post, websiteOnlyResources, resourceCardImage } from "../src/lib/website-only-resources.ts";
import sitemapModule from "../src/app/resources/sitemap.ts";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const diagnostics = JSON.parse(read("src/content/website-only/fortigate-ztna-diagnostics.json"));
const hash = (value) => createHash("sha256").update(value).digest("hex");
const sorted = (v) => Array.isArray(v) ? v.map(sorted) : v && typeof v === "object" ? Object.fromEntries(Object.keys(v).sort().map((key) => [key, sorted(v[key])])) : v;
const sitemap = typeof sitemapModule === "function" ? sitemapModule : sitemapModule.default;

test("ZTNA article passes unchanged editorial gates and maps every section and FAQ to sources", () => {
  assert.deepEqual(evaluateEditorialReadiness(post).issues, []);
  assert.equal(post.sources.length, 10);
  const sources = new Set(post.sources.map((item) => item.url));
  for (const section of [...post.sections, ...post.questions]) {
    assert.ok(section.sourceUrls.length > 0);
    for (const url of section.sourceUrls) assert.ok(sources.has(url), url);
  }
  assert.ok(sources.has(diagnostics.sourceUrl));
  assert.equal(post.contentType, "blog");
});

test("case boundaries and technical limitations remain explicit", () => {
  const body = post.sections.map((section) => section.body).join(" ");
  assert.match(body, /not a reconstruction of undisclosed customer settings/);
  assert.match(body, /does not identify.*exact FortiOS/);
  assert.match(body, /not a recommendation to install that release/);
  assert.match(body, /Application traffic does not pass through EMS/);
  assert.match(body, /HTTP access proxy.*TCP forwarding/s);
  assert.match(body, /full ZTNA policies.*simple ZTNA policies/s);
  assert.match(body, /login page.*not approval/s);
  assert.match(body, /No FortiGate, EMS, PAM system or networking lab was operated/);
  assert.match(body, /rollback/);
});

test("only the three reviewed observational commands are rendered", () => {
  assert.deepEqual(diagnostics.checks.map((item) => item.command), [
    "diagnose test application fcnacd 2", "diagnose firewall dynamic list", "diagnose wad worker policy list"
  ]);
  for (const item of diagnostics.checks) {
    assert.ok(item.observation.length > 70);
    assert.ok(item.limit.length > 70);
    assert.doesNotMatch(item.command, /clear|restart|reboot|config|execute|debug enable/);
  }
  assert.match(diagnostics.introduction, /correct administrative context/);
  assert.match(diagnostics.privacyNote, /sanitize/);
});

test("both contextual diagrams are high-resolution, complete and not social asset replacements", () => {
  for (const [name, height] of [["access-path", 1350], ["evidence-map", 1680]]) {
    const path = `public/images/editorial/fortigate-ztna-${name}`;
    const png = readFileSync(new URL(`../${path}.png`, import.meta.url));
    assert.equal(png.readUInt32BE(16), 2400);
    assert.equal(png.readUInt32BE(20), height);
    const svg = read(`${path}.svg`);
    assert.match(svg, /<title id="title">/);
    assert.match(svg, /<desc id="desc">/);
    assert.doesNotMatch(svg, /<script|foreignObject|https?:\/\/[^" ]+\.(png|jpg)/);
  }
  const path = read("public/images/editorial/fortigate-ztna-access-path.svg");
  for (const label of ["Endpoint", "FortiClient EMS", "FortiGate gateway", "PAM application", "EMS is not inline", "backend protocol and TLS independently"]) assert.ok(path.includes(label));
  assert.match(read("public/images/editorial/fortigate-ztna-evidence-map.svg"), /not a universal processing order/);
});

test("route is static, discoverable and does not invoke database or social publishing", () => {
  const route = read(`src/app/resources/${post.slug}/page.tsx`);
  assert.match(route, /export const dynamic = "error"/);
  assert.match(route, /showLeadForm=\{false\}/);
  assert.match(route, /TechArticle/);
  assert.match(route, /FAQPage/);
  assert.match(route, /title: \{ absolute: post.metaTitle \}/);
  assert.doesNotMatch(route, /prisma|content-posts|editorial-delivery|openai|fetch\(/i);
  assert.equal(websiteOnlyResources.filter((item) => item.slug === post.slug).length, 1);
  assert.equal(resourceCardImage(post), post.image);
  assert.equal(sitemap().filter((entry) => entry.url.endsWith(`/resources/${post.slug}`)).length, 1);
  assert.doesNotMatch(read("src/lib/blog.ts"), new RegExp(post.slug));
});

test("final publication is bound to an independent exact-content PASS", () => {
  const review = JSON.parse(read("src/content/website-only/fortigate-ztna-case-study.review.json"));
  assert.equal(review.status, "PASS");
  assert.equal(review.reviewerId, "01a13e77-9990-71d0-b15b-6295f9c59903");
  const content = { ...post };
  for (const key of ["reviewedBy", "editorialMethod", "publishedAt", "updatedAt"]) delete content[key];
  assert.equal(hash(JSON.stringify(sorted(content))), review.substantiveContentSha256);
  assert.match(post.reviewedBy.name, /independent Codex/i);
  assert.doesNotMatch(post.editorialMethod, /review is pending/i);
  for (const artifact of review.artifacts) {
    if (artifact.file === "src/content/website-only/fortigate-ztna-case-study.json") continue;
    const addendumFiles = {
      "src/lib/website-only-resources.ts": "src/content/website-only/fortigate-ztna-registry-review-2026-10-29.json",
      "tests/fortigate-ztna-case-study.test.mjs": "src/content/website-only/fortigate-ztna-test-review-2026-10-29.json"
    };
    if (Object.hasOwn(addendumFiles, artifact.file) && hash(readFileSync(new URL(`../${artifact.file}`, import.meta.url))) !== artifact.sha256) {
      const addendum = JSON.parse(read(addendumFiles[artifact.file]));
      assert.equal(addendum.status, "PASS");
      assert.equal(addendum.reviewerId, review.reviewerId);
      assert.equal(addendum.file, artifact.file);
      assert.equal(addendum.priorSha256, artifact.sha256);
      assert.equal(addendum.sha256, hash(readFileSync(new URL(`../${artifact.file}`, import.meta.url))));
      continue;
    }
    assert.equal(hash(readFileSync(new URL(`../${artifact.file}`, import.meta.url))), artifact.sha256, artifact.file);
  }
});
