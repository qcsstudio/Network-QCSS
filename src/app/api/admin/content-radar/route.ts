import { NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/admin-auth";
import { jsonError, noStoreHeaders } from "@/lib/api";
import { contentAutomationSources, trendTopicSeeds, weeklyBlogCadence, type TrendSource } from "@/lib/blog";
import { requestContext } from "@/lib/security";
import { createAuditLog } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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

async function fetchSource(source: TrendSource) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch(source.url, {
      headers: { "user-agent": "QCS-Content-Radar/1.0" },
      signal: controller.signal,
      next: { revalidate: 3600 }
    });
    const text = await response.text();
    return {
      source: source.name,
      ok: response.ok,
      status: response.status,
      items: response.ok ? parseFeed(text, source) : []
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
  const text = `${item.title} ${item.summary}`.toLowerCase();
  const topicScore = trendTopicSeeds.reduce((total, seed) => {
    const matches = seed.keywordCluster.filter((keyword) => text.includes(keyword.toLowerCase())).length;
    return total + matches * 14 + (matches ? seed.priority / 10 : 0);
  }, 0);
  const intentBoost = /vulnerability|kev|firewall|vpn|bgp|rpki|route|cloud|zero trust|sase|dns|ddos|packet|security|outage/i.test(text)
    ? 18
    : 0;
  const recencyBoost = Math.max(0, 18 - Math.floor(daysSince(item.publishedAt)));
  return Math.round(item.sourceWeight + topicScore + intentBoost + recencyBoost);
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
    .map(topicFromItem)
    .filter((topic) => topic.score >= 22);

  const seenTopics = new Set<string>();
  const topics = (liveTopics.length ? liveTopics : fallbackTopics())
    .sort((a, b) => b.score - a.score)
    .filter((topic) => {
      const key = normalizedTitle(topic.topic);
      if (seenTopics.has(key)) return false;
      seenTopics.add(key);
      return true;
    })
    .slice(0, 12);

  const drafts = topics.slice(0, 2).map(draftFromTopic);

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
