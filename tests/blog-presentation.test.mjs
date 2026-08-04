import assert from "node:assert/strict";
import test from "node:test";
import {
  articleParagraphs,
  blogArchiveHref,
  blogArchivePage,
  relatedBlogPosts
} from "../src/lib/blog-presentation.ts";

function post(index, overrides = {}) {
  return {
    slug: `post-${index}`,
    title: `Network security article ${index}`,
    metaTitle: `Network security article ${index}`,
    description: `A practical description for network security article ${index} and its operational decision path.`,
    excerpt: `A practical excerpt for network security article ${index}, including evidence, ownership, and the next useful action.`,
    answer: "Collect the current evidence, confirm ownership, and validate the change before production use.",
    category: index % 2 ? "Network Security" : "Cloud Networking",
    audience: "Network and security teams",
    primaryKeyword: `network topic ${index}`,
    keywords: index % 2 ? ["firewall", "network security", "evidence"] : ["cloud", "routing", "evidence"],
    publishedAt: `2026-07-${String(Math.max(1, 28 - index)).padStart(2, "0")}`,
    updatedAt: `2026-07-${String(Math.max(1, 28 - index)).padStart(2, "0")}`,
    readTime: "7 min read",
    image: `/resources/post-${index}/visual`,
    imageAlt: `Contextual network security visual for article ${index}`,
    relatedTools: [{ label: "Network Tools", href: "/network-tools" }],
    relatedServices: [{ label: "Managed Network Services", href: "/services/managed-network-services" }],
    takeaways: ["Collect current evidence before changing production controls."],
    sections: [{ heading: "Collect evidence", body: "Collect current topology, configuration, ownership, and validation evidence before making the change." }],
    checklist: ["Confirm scope and ownership before starting the change."],
    questions: [{ question: "What should teams collect first?", answer: "Collect current topology and configuration evidence." }],
    sources: [{ label: "Official source", url: "https://example.com/source" }],
    ...overrides
  };
}

test("blog archive keeps the first page featured and paginates later posts without duplication", () => {
  const posts = Array.from({ length: 18 }, (_, index) => post(index + 1));
  const first = blogArchivePage(posts, { page: 1 });
  const second = blogArchivePage(posts, { page: 2 });
  const third = blogArchivePage(posts, { page: 3 });

  assert.equal(first.featured?.slug, "post-1");
  assert.equal(first.items.length, 8);
  assert.equal(second.featured, null);
  assert.equal(second.items.length, 8);
  assert.equal(third.items.length, 1);
  assert.equal(new Set([first.featured, ...first.items, ...second.items, ...third.items].filter(Boolean).map((item) => item.slug)).size, 18);
});

test("archive filters and pagination links preserve reader intent", () => {
  const posts = [post(1), post(2), post(3, { contentType: "resource" })];
  const archive = blogArchivePage(posts, { format: "resource", query: "security", topic: "Network Security" });
  assert.equal(archive.total, 1);
  assert.equal(archive.featured?.slug, "post-3");
  assert.equal(
    blogArchiveHref({ format: "resource", query: "packet capture", topic: "Network Security" }, 2),
    "/resources?q=packet+capture&topic=Network+Security&format=resource&page=2#blog-posts"
  );
});

test("long editorial bodies are grouped into readable paragraphs", () => {
  const sentence = "Network teams should collect topology, configuration, ownership, exposure, and validation evidence before changing production controls.";
  const paragraphs = articleParagraphs(`${sentence} ${sentence} ${sentence} ${sentence}`, 36);
  assert.ok(paragraphs.length >= 2);
  assert.ok(paragraphs.every((paragraph) => paragraph.split(/\s+/).length <= 40));
});

test("related articles prioritize matching categories and keyword evidence", () => {
  const current = post(1);
  const unrelated = post(2, { category: "Training", keywords: ["certification", "career", "lab"] });
  const related = post(3, { keywords: ["firewall", "network security", "evidence"] });
  assert.equal(relatedBlogPosts([current, unrelated, related], current, 1)[0].slug, related.slug);
});
