const baseUrl = new URL(process.argv[2] || process.env.SITE_QA_BASE || "http://localhost:3000");

function toLocalUrl(url) {
  const parsed = new URL(url);
  return new URL(`${parsed.pathname}${parsed.search}`, baseUrl).toString();
}

function decodeHtml(value) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, "\"")
    .replace(/&#x27;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

function textContent(html) {
  return decodeHtml(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
      .replace(/<[^>]+>/g, " ")
  );
}

function attr(tag, name) {
  const pattern = new RegExp(`${name}=["']([^"']*)["']`, "i");
  return tag.match(pattern)?.[1] ?? "";
}

function metaContent(html, selector) {
  const tag = html.match(new RegExp(`<meta(?=[^>]*${selector})[^>]*>`, "i"))?.[0];
  return tag ? decodeHtml(attr(tag, "content")) : "";
}

function linkHref(html, rel) {
  const tag = html.match(new RegExp(`<link(?=[^>]*rel=["']${rel}["'])[^>]*>`, "i"))?.[0];
  return tag ? decodeHtml(attr(tag, "href")) : "";
}

function words(sentence) {
  return sentence.split(/\s+/).filter(Boolean);
}

async function fetchText(url) {
  const response = await fetch(url, {
    headers: { "user-agent": "QCS-Site-QA/1.0" }
  });
  return {
    ok: response.ok,
    status: response.status,
    text: await response.text()
  };
}

const issues = [];
const checked = [];

function issue(route, message) {
  issues.push({ route, message });
}

const sitemapUrl = new URL("/sitemap.xml", baseUrl).toString();
const robotsUrl = new URL("/robots.txt", baseUrl).toString();
const llmsUrl = new URL("/llms.txt", baseUrl).toString();

const [sitemap, robots, llms] = await Promise.all([fetchText(sitemapUrl), fetchText(robotsUrl), fetchText(llmsUrl)]);

if (!sitemap.ok) issue("/sitemap.xml", `Sitemap returned ${sitemap.status}`);
if (!robots.ok) issue("/robots.txt", `Robots returned ${robots.status}`);
if (!llms.ok) issue("/llms.txt", `LLMS returned ${llms.status}`);

if (!robots.text.includes("Disallow: /admin")) issue("/robots.txt", "Admin pages must be disallowed.");
if (!robots.text.includes("Disallow: /api")) issue("/robots.txt", "API routes must be disallowed.");
if (!robots.text.includes("Sitemap:")) issue("/robots.txt", "Sitemap reference is missing.");
if (!llms.text.includes("## Core Service Pages")) issue("/llms.txt", "Core service section is missing.");
if (!llms.text.includes("## Free Online Network Utility Tools")) issue("/llms.txt", "Network utility section is missing.");

const locs = [...sitemap.text.matchAll(/<loc>(.*?)<\/loc>/g)].map((match) => decodeHtml(match[1]));
const routes = [...new Set(locs.map(toLocalUrl))];

if (routes.length < 20) issue("/sitemap.xml", `Expected at least 20 public URLs, found ${routes.length}.`);

for (const route of routes) {
  const url = new URL(route);
  const path = url.pathname;
  const page = await fetchText(route);
  checked.push(path);

  if (!page.ok) {
    issue(path, `Page returned ${page.status}.`);
    continue;
  }

  const html = page.text;
  const title = decodeHtml(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? "");
  const description = metaContent(html, "name=[\"']description[\"']");
  const canonical = linkHref(html, "canonical");
  const ogTitle = metaContent(html, "property=[\"']og:title[\"']");
  const ogDescription = metaContent(html, "property=[\"']og:description[\"']");
  const twitterCard = metaContent(html, "name=[\"']twitter:card[\"']");
  const htmlShell = html.replace(/<script[\s\S]*?<\/script>/gi, " ");
  const h1Count = (html.match(/<h1(\s|>)/gi) ?? []).length;
  const h2Count = (html.match(/<h2(\s|>)/gi) ?? []).length;
  const bodyText = textContent(html);
  const sentences = bodyText
    .split(/[.!?]\s+/)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length > 16);
  const averageSentenceWords =
    sentences.length > 0 ? sentences.reduce((total, sentence) => total + words(sentence).length, 0) / sentences.length : 0;
  const imgTags = htmlShell.match(/<img\b[^>]*>/gi) ?? [];
  const missingAlt = imgTags.filter((tag) => !/\salt=/i.test(tag));
  const unstableImages = imgTags.filter((tag) => {
    const hasExplicitSize = /\swidth=/i.test(tag) && /\sheight=/i.test(tag);
    const usesFillLayout = /\sdata-nimg=["']fill["']/i.test(tag);
    return !hasExplicitSize && !usesFillLayout;
  });
  const jsonLd = [...html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];

  if (title.length < 20 || title.length > 90) issue(path, `Title length should be practical for search (${title.length} chars).`);
  if (description.length < 80 || description.length > 180) {
    issue(path, `Meta description should be useful and concise (${description.length} chars).`);
  }
  if (!canonical) issue(path, "Canonical link is missing.");
  if (canonical && new URL(canonical, baseUrl).pathname !== path) issue(path, `Canonical points to ${canonical}.`);
  if (!ogTitle || !ogDescription) issue(path, "Open Graph title/description are missing.");
  if (twitterCard !== "summary_large_image") issue(path, "Twitter large-image card is missing.");
  if (h1Count !== 1) issue(path, `Expected exactly one H1, found ${h1Count}.`);
  if (h2Count < 1) issue(path, "Expected at least one H2 section heading.");
  if (bodyText.length < 850 && path !== "/privacy") issue(path, `Visible content is thin (${bodyText.length} chars).`);
  if (averageSentenceWords > 24) issue(path, `Average sentence length is too high (${averageSentenceWords.toFixed(1)} words).`);
  if (missingAlt.length > 0) issue(path, `${missingAlt.length} image(s) are missing alt attributes.`);
  if (unstableImages.length > 0) issue(path, `${unstableImages.length} image(s) are missing stable dimensions or fill metadata.`);
  if (jsonLd.length === 0) issue(path, "JSON-LD structured data is missing.");

  for (const script of jsonLd) {
    try {
      JSON.parse(decodeHtml(script[1]).replace(/\\u003c/g, "<"));
    } catch (error) {
      issue(path, `JSON-LD failed to parse: ${error instanceof Error ? error.message : "unknown error"}`);
    }
  }

  if (/lorem ipsum|placeholder text|TODO/i.test(bodyText)) issue(path, "Placeholder copy is still visible.");
}

const score = Math.max(0, 100 - issues.length * 6);
const result = {
  score,
  routesChecked: checked.length,
  issues
};

console.log(JSON.stringify(result, null, 2));

if (issues.length > 0) {
  process.exitCode = 1;
}
