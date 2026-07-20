import { listSecurityAdvisories } from "@/lib/advisories";
import { siteConfig } from "@/lib/content";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function xml(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}
export async function GET() {
  const advisories = await listSecurityAdvisories(100);
  const items = advisories
    .map((advisory) => {
      const url = `${siteConfig.url}/security-advisories/${advisory.slug}`;
      return `<item><title>${xml(advisory.title)}</title><link>${xml(url)}</link><guid isPermaLink="true">${xml(url)}</guid><description>${xml(advisory.summary)}</description><pubDate>${advisory.vendorPublishedAt.toUTCString()}</pubDate><category>${xml(advisory.severity)}</category></item>`;
    })
    .join("");
  const body = `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>QCS Security Advisory Desk</title><link>${xml(`${siteConfig.url}/security-advisories`)}</link><description>Source-verified network vulnerability and vendor patch intelligence.</description><language>en-in</language><lastBuildDate>${new Date().toUTCString()}</lastBuildDate>${items}</channel></rss>`;
  return new Response(body, { headers: { "Content-Type": "application/rss+xml; charset=utf-8", "Cache-Control": "public, max-age=300, stale-while-revalidate=300" } });
}
