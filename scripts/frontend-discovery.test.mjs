import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("service navigation resolves to uniquely named sections", () => {
  const page = source("src/app/services/[slug]/page.tsx");
  const targets = [...page.matchAll(/href="#([^"]+)"/g)].map((match) => match[1]);
  for (const id of targets) {
    assert.equal([...page.matchAll(new RegExp(`id="${id}"`, "g"))].length, 1, id);
  }
  assert.match(page, /aria-label="Breadcrumb"/);
  assert.match(page, /<details key={faq.question}>/);
  assert.match(page, /text: faq.answer/);
  assert.match(page, /<p>{faq.answer}<\/p>/);
  assert.doesNotMatch(page, /outcomeNarratives|scopeNarratives|deliverableNarratives/);
});

test("mobile navigation contains focus, restores Escape focus, and releases scroll lock", () => {
  const header = source("src/components/site-header.tsx");
  assert.match(header, /inert={!menuOpen}/);
  assert.match(header, /event.key === "Escape"/);
  assert.match(header, /event.key === "Tab"/);
  assert.match(header, /menuToggle.current\?\.focus\(\)/);
  assert.match(header, /removeEventListener\("change", handleResize\)/);
  assert.match(header, /classList.remove\("mobile-menu-locked"\)/);
  assert.doesNotMatch(header, /mobileLabel/);
});

test("sitemap uses content dates instead of claiming every URL changed now", () => {
  const sitemap = source("src/app/sitemap.ts");
  assert.doesNotMatch(sitemap, /lastModified: now|const now = new Date/);
  assert.match(sitemap, /new Date\(post.updatedAt\)/);
  assert.match(sitemap, /new Date\(lesson.updatedAt\)/);
  assert.equal([...sitemap.matchAll(/loadSection\("Sitemap /g)].length, 3);
});

test("homepage title is branded without repeating the layout title template", () => {
  const page = source("src/app/page.tsx");
  assert.match(page, /title: { absolute: "Network, Security & Cloud Consulting \| QCS" }/);
});

test("service inquiry retains the supplied interest and links the privacy policy", () => {
  const form = source("src/components/lead-form.tsx");
  assert.match(form, /defaultValue={initialInterest}/);
  assert.match(form, /\[initialInterest, \.\.\.standardInterests\]/);
  assert.match(form, /option.toLowerCase\(\) === interest.toLowerCase\(\)/);
  assert.match(form, /href="\/privacy">privacy policy/);
});
