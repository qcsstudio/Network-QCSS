import { NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/admin-auth";
import { jsonError, noStoreHeaders } from "@/lib/api";
import { contentAutomationSources, trendTopicSeeds, weeklyBlogCadence, type TrendSource } from "@/lib/blog";
import { requestContext } from "@/lib/security";
import { createAuditLog } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

type FeedItem = {
  title: string;
  link: string;
  source: string;
  sourceWeight: number;
  publishedAt: string;
  summary: string;
};

function cronAuthorized(request: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  const header = request.headers.get("authorization") || "";
  return Boolean(secret && header === `Bearer ${secret}`);
}

function decodeXml(value: string) {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&#x([0-9a-f]+);/gi, (_, code: string) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number.parseInt(code, 10)))
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\u00e2\u0080[\u0098\u0099\u009b\u009c\u009d]/g, "'")
    .replace(/\u00e2\u0080[\u0093\u0094]/g, "-")
    .replace(/â|â|â€™/g, "'")
    .replace(/â|â/g, '"')
    .replace(/â|â/g, "-")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tag(block: string, name: string) {
  return decodeXml(block.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)<\\/${name}>`, "i"))?.[1] || "");
}

function attrLink(block: string) {
  const href = block.match(/<link[^>]+href=["']([^"']+)["'][^>]*>/i)?.[1];
  return href ? decodeXml(href) : "";
}

function parseFeed(xml: string, source: TrendSource): FeedItem[] {
  const blocks = xml.match(/<item[\s\S]*?<\/item>/gi) || xml.match(/<entry[\s\S]*?<\/entry>/gi) || [];

  return blocks
    .map((block) => {
      const title = tag(block, "title");
      const link = tag(block, "link") || attrLink(block);
      const publishedAt = tag(block, "pubDate") || tag(block, "updated") || tag(block, "published") || new Date().toISOString();
      const summary = tag(block, "description") || tag(block, "summary") || tag(block, "content");
      return {
        title,
        link,
        source: source.name,
        sourceWeight: source.weight,
        publishedAt: new Date(publishedAt).toString() === "Invalid Date" ? new Date().toISOString() : new Date(publishedAt).toISOString(),
        summary,
        sourceFocus: source.focus
      };
    })
    .filter((item) => item.title && item.link)
    .slice(0, 12);
}

function parseCisaKev(json: string, source: TrendSource): FeedItem[] {
  try {
    const payload = JSON.parse(json) as {
      vulnerabilities?: Array<{
        cveID?: string;
        vendorProject?: string;
        product?: string;
        vulnerabilityName?: string;
        dateAdded?: string;
        shortDescription?: string;
        requiredAction?: string;
        knownRansomwareCampaignUse?: string;
      }>;
    };

    return (payload.vulnerabilities || [])
      .filter((item) => item.cveID && item.vulnerabilityName)
      .sort((a, b) => new Date(b.dateAdded || 0).getTime() - new Date(a.dateAdded || 0).getTime())
      .slice(0, 20)
      .map((item) => ({
        title: `${item.cveID}: ${item.vulnerabilityName}`,
        link: "https://www.cisa.gov/known-exploited-vulnerabilities-catalog",
        source: source.name,
        sourceWeight: source.weight,
        publishedAt: item.dateAdded ? new Date(`${item.dateAdded}T00:00:00Z`).toISOString() : new Date().toISOString(),
        summary: [
          item.vendorProject,
          item.product,
          item.shortDescription,
          item.requiredAction,
          item.knownRansomwareCampaignUse === "Known" ? "Known ransomware use" : ""
        ]
          .filter(Boolean)
          .join(". ")
      }));
  } catch {
    return [];
  }
}

function parseCertIn(html: string, source: TrendSource): FeedItem[] {
  const blocks = html.match(/<table[^>]*class=["']?content["']?[^>]*>[\s\S]*?<\/table>/gi) || [];

  return blocks
    .map((block) => {
      const code = block.match(/VLCODE=(CIAD-\d{4}-\d+)/i)?.[1] || "";
      const rawDate = block.match(/\(([A-Z][a-z]+\s+\d{1,2},\s+\d{4})\)/)?.[1] || "";
      const rawTitle = block.match(/<div[^>]*overflow:\s*hidden[^>]*>[\s\S]*?<span[^>]*>([\s\S]*?)<\/span>/i)?.[1] || "";
      const title = decodeXml(rawTitle);
      const publishedAt = rawDate && !Number.isNaN(new Date(rawDate).getTime()) ? new Date(rawDate).toISOString() : new Date().toISOString();

      return {
        title: title ? `${title} (${code})` : code,
        link: code
          ? `https://www.cert-in.org.in/s2cMainServlet?pageid=PUBVLNOTES02&VLCODE=${encodeURIComponent(code)}`
          : source.url,
        source: source.name,
        sourceWeight: source.weight,
        publishedAt,
        summary: title ? `Official CERT-In advisory for India: ${title}.` : ""
      };
    })
    .filter((item) => item.title && item.link)
    .slice(0, 20);
}

async function fetchSource(source: TrendSource) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch(source.url, {
      headers: { "user-agent": "QCS-Content-Radar/1.0" },
      signal: controller.signal,
      next: { revalidate: 3600 }
    });
    const body = await response.text();
    const items =
      source.format === "cisa-kev"
        ? parseCisaKev(body, source)
        : source.format === "cert-in"
          ? parseCertIn(body, source)
          : parseFeed(body, source);
    return {
      source: source.name,
      ok: response.ok,
      status: response.status,
      items: response.ok ? items : []
    };
  } catch (error) {
    return {
      source: source.name,
      ok: false,
      status: 0,
      items: [],
      error: error instanceof Error ? error.message : "Unable to fetch feed."
    };
  } finally {
    clearTimeout(timeout);
  }
}

function daysSince(date: string) {
  return Math.max(0, (Date.now() - new Date(date).getTime()) / 86_400_000);
}

function scoreItem(item: FeedItem) {
  const title = item.title.toLowerCase();
  const summary = item.summary.toLowerCase().slice(0, 2000);
  let titleTopicScore = 0;
  let summaryTopicScore = 0;
  let highestMatchedPriority = 0;

  for (const seed of trendTopicSeeds) {
    const titleMatches = seed.keywordCluster.filter((keyword) => title.includes(keyword.toLowerCase())).length;
    const summaryMatches = seed.keywordCluster.filter((keyword) => summary.includes(keyword.toLowerCase())).length;
    titleTopicScore += titleMatches * 18;
    summaryTopicScore += summaryMatches * 4;
    if (titleMatches || summaryMatches) highestMatchedPriority = Math.max(highestMatchedPriority, seed.priority);
  }

  const topicScore = titleTopicScore + Math.min(summaryTopicScore, 16) + highestMatchedPriority / 10;
  const intentPattern = /vulnerability|kev|firewall|vpn|bgp|rpki|route|cloud|zero trust|sase|dns|ddos|packet|security|outage/i;
  const intentBoost = intentPattern.test(title) ? 18 : intentPattern.test(summary) ? 7 : 0;
  const recencyBoost = Math.max(0, 18 - Math.floor(daysSince(item.publishedAt)));
  return Math.round(item.sourceWeight + topicScore + intentBoost + recencyBoost);
}

function isNetworkRelevant(item: FeedItem) {
  const titlePattern =
    /\b(network(?:ing)?|routing|router|switch(?:es)?|firewall|vpn|dns|dhcp|bgp|rpki|roa|ipv4|ipv6|tcp|udp|wi-?fi|wireless|lan|wan|sd-wan|sase|ztna|zero trust|vpc|vnet|subnet|gateway|load balancer|reverse proxy|cdn|ddos|tls|ssl|certificate|packet capture|netflow|sflow|telemetry|snmp|ipsec|mpls|fortigate|fortios|pan-os|globalprotect|junos|ios xe|cloudflare|network security group|security group|kubernetes networking|service mesh|catalyst|nexus|meraki|secure firewall|identity services engine|prisma access)\b/i;
  const networkVendorPattern =
    /\b(cisco|fortinet|palo alto|juniper|f5|ivanti|sonicwall|check point|netscaler|citrix adc|vmware nsx|aruba|arista|mikrotik|ubiquiti|zyxel|sophos firewall|watchguard|barracuda|pulse secure|zscaler)\b/i;
  if (titlePattern.test(item.title) || networkVendorPattern.test(item.title)) return true;

  if (/advisories|known exploited vulnerabilities/i.test(item.source)) return false;

  const summary = item.summary.toLowerCase();
  const highSignalTerms = [
    "bgp",
    "rpki",
    "dns",
    "firewall",
    "virtual private network",
    "vpn",
    "routing",
    "router",
    "switching",
    "wireless",
    "wi-fi",
    "sd-wan",
    "zero trust network",
    "network segmentation",
    "network telemetry",
    "cloud network",
    "vpc",
    "vnet",
    "subnet",
    "ipsec",
    "ddos",
    "load balancer",
    "packet capture"
  ];

  return highSignalTerms.filter((term) => summary.includes(term)).length >= 2;
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 72);
}

function normalizedTitle(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\b(the|a|an|and|or|part)\b/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function topicFromItem(item: FeedItem) {
  const seed =
    trendTopicSeeds.find((candidate) =>
      candidate.keywordCluster.some((keyword) => `${item.title} ${item.summary}`.toLowerCase().includes(keyword.toLowerCase()))
    ) || trendTopicSeeds[0];
  const score = scoreItem(item);

  return {
    topic: item.title,
    source: item.source,
    sourceUrl: item.link,
    publishedAt: item.publishedAt,
    score,
    businessAngle: seed.angle,
    servicePath: seed.servicePath,
    keywordCluster: seed.keywordCluster,
    suggestedSlug: slugify(item.title),
    reason: `Matched ${seed.topic.toLowerCase()} with ${item.source} signal and QCS service relevance.`
  };
}

function fallbackTopics() {
  return trendTopicSeeds.map((seed) => ({
    topic: seed.topic,
    source: "QCS evergreen trend model",
    sourceUrl: seed.servicePath,
    publishedAt: new Date().toISOString(),
    score: seed.priority,
    businessAngle: seed.angle,
    servicePath: seed.servicePath,
    keywordCluster: seed.keywordCluster,
    suggestedSlug: slugify(seed.topic),
    reason: "Evergreen high-intent topic for the current QCS network services niche."
  }));
}

function draftFromTopic(topic: ReturnType<typeof fallbackTopics>[number], index: number) {
  const cadence = weeklyBlogCadence[index % weeklyBlogCadence.length];
  return {
    slot: cadence.day,
    format: cadence.slot,
    title: topic.topic,
    slug: topic.suggestedSlug,
    metaTitle: topic.topic.slice(0, 58),
    metaDescription: `Practical QCS guide for ${topic.keywordCluster.slice(0, 3).join(", ")} with answer-first structure, checklist, tools, and next action.`,
    answerBlock: `The practical answer: map the issue to evidence, ownership, risk, and the next network action before changing production controls.`,
    sections: [
      "Short answer for AI/search snippets",
      "Why this topic matters now",
      "What evidence network teams should collect",
      "Step-by-step checklist",
      "Tools to run before a service request",
      "When to escalate to QCS"
    ],
    internalLinks: [topic.servicePath, "/network-tools", "/tools/network-risk-score"],
    sourceUrl: topic.sourceUrl,
    imageRecommendation:
      index % 2 === 0 ? "/brand/envato/library/security-network-shield.webp" : "/brand/envato/cyber/network-service-operator.jpg"
  };
}

export async function GET(request: Request) {
  if (!isAdminRequest(request) && !cronAuthorized(request)) {
    return jsonError("Unauthorized", 401);
  }

  const results = await Promise.all(contentAutomationSources.map(fetchSource));
  const liveTopics = results
    .flatMap((result) => result.items)
    .filter(isNetworkRelevant)
    .map(topicFromItem)
    .filter((topic) => topic.score >= 22);

  const seenTopics = new Set<string>();
  const sourceCounts = new Map<string, number>();
  const topics = (liveTopics.length ? liveTopics : fallbackTopics())
    .sort((a, b) => b.score - a.score)
    .filter((topic) => {
      const key = normalizedTitle(topic.topic);
      const sourceCount = sourceCounts.get(topic.source) || 0;
      if (seenTopics.has(key) || sourceCount >= 2) return false;
      seenTopics.add(key);
      sourceCounts.set(topic.source, sourceCount + 1);
      return true;
    })
    .slice(0, 12);

  const firstDraftTopic = topics[0];
  const secondDraftTopic = topics.find((topic, index) => index > 0 && topic.source !== firstDraftTopic?.source) || topics[1];
  const drafts = [firstDraftTopic, secondDraftTopic].filter((topic) => Boolean(topic)).map(draftFromTopic);

  await createAuditLog(
    {
      action: "content.radar_scan",
      actor: cronAuthorized(request) ? "vercel-cron" : "admin",
      target: "resources-blog",
      metadata: {
        topics: topics.slice(0, 5).map((topic) => ({ topic: topic.topic, score: topic.score, source: topic.source })),
        sourceStatus: results.map((result) => ({ source: result.source, ok: result.ok, status: result.status, items: result.items.length }))
      }
    },
    await requestContext()
  );

  return NextResponse.json(
    {
      ok: true,
      scannedAt: new Date().toISOString(),
      cadence: weeklyBlogCadence,
      sourceStatus: results.map((result) => ({
        source: result.source,
        ok: result.ok,
        status: result.status,
        items: result.items.length
      })),
      topics,
      drafts
    },
    { headers: noStoreHeaders }
  );
}
