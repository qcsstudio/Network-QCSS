import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { isAdminRequest } from "@/lib/admin-auth";
import { jsonError, noStoreHeaders } from "@/lib/api";
import { contentAutomationSources, trendTopicSeeds, weeklyBlogCadence, type TrendSource } from "@/lib/blog";
import { getAutomatedPostForUtcDate, publishAutomatedRadarDraft } from "@/lib/content-posts";
import { requestContext } from "@/lib/security";
import { processLinkedInQueue, queueLinkedInForContentPost } from "@/lib/social-publications";
import { createAuditLog } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

type FeedItem = {
  title: string;
  link: string;
  source: string;
  sourceWeight: number;
  sourceRole: "authority" | "demand" | "discovery";
  sourceFocus: string[];
  publishedAt: string;
  summary: string;
};

type RankedTopic = {
  topic: string;
  source: string;
  sourceUrl: string;
  sourceRole: "authority" | "demand" | "discovery";
  sourcePublishedAt: string;
  sourceSummary: string;
  score: number;
  cluster: string;
  supportingSignals: number;
  businessAngle: string;
  servicePath: string;
  keywordCluster: string[];
  suggestedSlug: string;
  reason: string;
};

type AutomationResult = {
  mode: "scan-only" | "scheduled-publish";
  status: "not-requested" | "already-published" | "published" | "no-new-topic" | "failed";
  postId?: string;
  slug?: string;
  title?: string;
  social?: "queued" | "failed";
  reason?: string;
  attempts?: { slug: string; result: string }[];
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
        sourceRole: source.role || "authority",
        sourceFocus: source.focus,
        publishedAt: new Date(publishedAt).toString() === "Invalid Date" ? new Date().toISOString() : new Date(publishedAt).toISOString(),
        summary
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
        sourceRole: source.role || "authority",
        sourceFocus: source.focus,
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
        sourceRole: source.role || "authority",
        sourceFocus: source.focus,
        publishedAt,
        summary: title ? `Official CERT-In advisory for India: ${title}.` : ""
      };
    })
    .filter((item) => item.title && item.link)
    .slice(0, 20);
}

async function fetchSource(source: TrendSource) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12_000);
  try {
    const response = await fetch(source.url, {
      cache: "no-store",
      headers: { "user-agent": "QCS-Content-Radar/2.0 (+https://www.qcsstudio.com/resources)" },
      signal: controller.signal,
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
      role: source.role || "authority",
      ok: response.ok,
      status: response.status,
      items: response.ok ? items : []
    };
  } catch (error) {
    return {
      source: source.name,
      role: source.role || "authority",
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
  const evidenceBoost = item.sourceRole === "authority" ? 8 : item.sourceRole === "demand" ? 3 : 0;
  return Math.round(item.sourceWeight + topicScore + intentBoost + recencyBoost + evidenceBoost);
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

function seedForItem(item: FeedItem) {
  const context = `${item.title} ${item.summary} ${item.sourceFocus.join(" ")}`.toLowerCase();
  const ranked = trendTopicSeeds
    .map((candidate) => ({
      candidate,
      matches: candidate.keywordCluster.filter((keyword) => context.includes(keyword.toLowerCase())).length
    }))
    .sort((left, right) => right.matches - left.matches || right.candidate.priority - left.candidate.priority);
  if (ranked[0]?.matches) return ranked[0].candidate;
  if (/\b(cloud|aws|azure|google cloud|vpc|vnet|subnet|kubernetes)\b/.test(context)) return trendTopicSeeds[1];
  if (/\b(bgp|rpki|roa|routing|route|asn|dns|ipv6)\b/.test(context)) return trendTopicSeeds[2];
  if (/\b(packet|capture|pcap|troubleshoot|latency|outage)\b/.test(context)) return trendTopicSeeds[3];
  if (/\b(sase|zero trust|ztna|hybrid work)\b/.test(context)) return trendTopicSeeds[4];
  if (/\b(password|credential|authentication|identity)\b/.test(context)) return trendTopicSeeds[5];
  return trendTopicSeeds[0];
}

function topicFromItem(item: FeedItem): RankedTopic {
  const seed = seedForItem(item);
  const score = scoreItem(item);

  return {
    topic: item.title,
    source: item.source,
    sourceUrl: item.link,
    sourceRole: item.sourceRole,
    sourcePublishedAt: item.publishedAt,
    sourceSummary: item.summary,
    score,
    cluster: seed.topic,
    supportingSignals: 0,
    businessAngle: seed.angle,
    servicePath: seed.servicePath,
    keywordCluster: seed.keywordCluster,
    suggestedSlug: slugify(item.title),
    reason: `Matched ${seed.topic.toLowerCase()} with ${item.source} signal and QCS service relevance.`
  };
}

function fallbackTopics(): RankedTopic[] {
  return trendTopicSeeds.map((seed) => ({
    topic: seed.topic,
    source: "QCS evergreen trend model",
    sourceUrl: `https://www.qcsstudio.com${seed.servicePath}`,
    sourceRole: "authority" as const,
    sourcePublishedAt: new Date().toISOString(),
    sourceSummary: "Evergreen QCS editorial model based on recurring network operations and security demand.",
    score: seed.priority,
    cluster: seed.topic,
    supportingSignals: 0,
    businessAngle: seed.angle,
    servicePath: seed.servicePath,
    keywordCluster: seed.keywordCluster,
    suggestedSlug: slugify(seed.topic),
    reason: "Evergreen high-intent topic for the current QCS network services niche."
  }));
}

function draftFromTopic(topic: RankedTopic, index: number) {
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
    sourceName: topic.source,
    sourceRole: topic.sourceRole,
    sourcePublishedAt: topic.sourcePublishedAt,
    sourceSummary: topic.sourceSummary,
    businessAngle: topic.businessAngle,
    servicePath: topic.servicePath,
    keywordCluster: topic.keywordCluster,
    imageRecommendation: `/resources/${topic.suggestedSlug}/visual`
  };
}

export async function GET(request: Request) {
  const scheduledRequest = cronAuthorized(request);
  if (!isAdminRequest(request) && !scheduledRequest) {
    return jsonError("Unauthorized", 401);
  }

  const results = await Promise.all(contentAutomationSources.map(fetchSource));
  const rawTopics = results
    .flatMap((result) => result.items)
    .filter(isNetworkRelevant)
    .map(topicFromItem)
    .filter((topic) => topic.score >= 22);
  const supportingSignals = new Map<string, number>();
  for (const topic of rawTopics) {
    if (topic.sourceRole === "authority") continue;
    supportingSignals.set(topic.cluster, (supportingSignals.get(topic.cluster) || 0) + 1);
  }
  const liveTopics = rawTopics.map((topic) => {
    const support = supportingSignals.get(topic.cluster) || 0;
    if (topic.sourceRole !== "authority" || !support) return topic;
    return {
      ...topic,
      score: topic.score + Math.min(14, support * 2),
      supportingSignals: support,
      reason: `${topic.reason} Corroborated by ${support} current demand or news signal(s).`
    };
  });

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

  const candidateKeys = new Set<string>();
  const publicationCandidates = [...topics.filter((topic) => topic.sourceRole === "authority"), ...fallbackTopics()].filter((topic) => {
    const key = normalizedTitle(topic.topic);
    if (candidateKeys.has(key)) return false;
    candidateKeys.add(key);
    return true;
  });
  const firstDraftTopic = publicationCandidates[0];
  const secondDraftTopic =
    publicationCandidates.find((topic, index) => index > 0 && topic.source !== firstDraftTopic?.source) || publicationCandidates[1];
  const drafts = [firstDraftTopic, secondDraftTopic]
    .filter((topic): topic is RankedTopic => Boolean(topic))
    .map(draftFromTopic);
  const rankedTopics = topics.map((topic, index) => ({
    ...topic,
    draft: draftFromTopic(topic, index)
  }));

  const today = new Date().toISOString().slice(0, 10);
  let automation: AutomationResult = { mode: scheduledRequest ? "scheduled-publish" : "scan-only", status: "not-requested" };
  if (scheduledRequest) {
    const existingToday = await getAutomatedPostForUtcDate(today);
    if (existingToday) {
      automation = {
        mode: "scheduled-publish",
        status: "already-published",
        postId: existingToday.id,
        slug: existingToday.slug,
        title: existingToday.title
      };
    } else {
      const cadenceIndex = new Date().getUTCDay() === 4 ? 1 : 0;
      const attempts: { slug: string; result: string }[] = [];
      for (const topic of publicationCandidates) {
        const draft = draftFromTopic(topic, cadenceIndex);
        try {
          const outcome = await publishAutomatedRadarDraft(draft);
          attempts.push({ slug: draft.slug, result: outcome.reason });
          if (!outcome.published || !outcome.post) continue;

          let social: "queued" | "failed" = "queued";
          try {
            await queueLinkedInForContentPost(outcome.post);
            await processLinkedInQueue(1);
          } catch (error) {
            social = "failed";
            console.error("The scheduled article was published, but LinkedIn delivery failed.", error);
          }
          revalidatePath("/resources");
          revalidatePath(`/resources/${outcome.post.slug}`);
          revalidatePath("/intelligence");
          revalidatePath("/sitemap.xml");
          automation = {
            mode: "scheduled-publish",
            status: "published",
            postId: outcome.post.id,
            slug: outcome.post.slug,
            title: outcome.post.title,
            social,
            attempts
          };
          break;
        } catch (error) {
          const message = error instanceof Error ? error.message : "Publication failed.";
          attempts.push({ slug: draft.slug, result: message });
          console.error("Scheduled content publication failed for a radar candidate.", { slug: draft.slug, error });
        }
      }
      if (automation.status === "not-requested") {
        const lastAttempt = attempts.at(-1)?.result || "No publication-ready authoritative topic was available.";
        const failed = attempts.some((attempt) => !attempt.result.startsWith("slug_"));
        automation = {
          mode: "scheduled-publish",
          status: failed ? "failed" : "no-new-topic",
          reason: lastAttempt,
          attempts
        };
      }
    }
  }

  await createAuditLog(
    {
      action: "content.radar_scan",
      actor: scheduledRequest ? "content-radar-cron" : "admin",
      target: "resources-blog",
      metadata: {
        automation,
        topics: topics.slice(0, 5).map((topic) => ({
          topic: topic.topic,
          score: topic.score,
          source: topic.source,
          sourceRole: topic.sourceRole,
          supportingSignals: topic.supportingSignals
        })),
        sourceStatus: results.map((result) => ({
          source: result.source,
          role: result.role,
          ok: result.ok,
          status: result.status,
          items: result.items.length
        }))
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
        role: result.role,
        ok: result.ok,
        status: result.status,
        items: result.items.length
      })),
      topics: rankedTopics,
      drafts,
      automation
    },
    { status: automation.status === "failed" ? 500 : 200, headers: noStoreHeaders }
  );
}
