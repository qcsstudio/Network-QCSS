import crypto from "node:crypto";
import type { Prisma, SecurityAdvisory } from "@prisma/client";
import { getPrismaClient } from "@/lib/prisma";
import { queueLinkedInForAdvisory } from "@/lib/social-publications";

export type AdvisorySourceDefinition = {
  slug: string;
  name: string;
  vendor: string;
  format: "rss" | "cisa-kev";
  url: string;
  officialHost: string;
  priority: number;
};

type AdvisoryCandidate = {
  externalId: string;
  slug: string;
  title: string;
  vendor: string;
  summary: string;
  severity: string;
  cvssScore: number | null;
  priorityScore: number;
  cves: string[];
  products: string[];
  affectedVersions: string[];
  fixedVersions: string[];
  remediation: string;
  workaround: string;
  exploitationStatus: string;
  sourceUrl: string;
  vendorPublishedAt: Date;
  vendorUpdatedAt: Date;
  payload: Prisma.InputJsonValue;
  contentHash: string;
};

export const advisorySourceDefinitions: AdvisorySourceDefinition[] = [
  {
    slug: "cisco-psirt",
    name: "Cisco PSIRT Advisories",
    vendor: "Cisco",
    format: "rss",
    url: "https://sec.cloudapps.cisco.com/security/center/psirtrss20/CiscoSecurityAdvisory.xml",
    officialHost: "sec.cloudapps.cisco.com",
    priority: 100
  },
  {
    slug: "fortinet-psirt",
    name: "Fortinet PSIRT Advisories",
    vendor: "Fortinet",
    format: "rss",
    url: "https://fortiguard.fortinet.com/rss/ir.xml",
    officialHost: "fortiguard.fortinet.com",
    priority: 98
  },
  {
    slug: "palo-alto-psirt",
    name: "Palo Alto Networks Security Advisories",
    vendor: "Palo Alto Networks",
    format: "rss",
    url: "https://security.paloaltonetworks.com/rss.xml",
    officialHost: "security.paloaltonetworks.com",
    priority: 96
  },
  {
    slug: "cisa-kev",
    name: "CISA Known Exploited Vulnerabilities",
    vendor: "CISA",
    format: "cisa-kev",
    url: "https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json",
    officialHost: "www.cisa.gov",
    priority: 94
  }
];

const networkPattern =
  /\b(network|router|routing|switch|firewall|vpn|gateway|wireless|wi-?fi|sd-wan|sase|ztna|dns|dhcp|bgp|load balancer|proxy|edge|forti|pan-os|globalprotect|junos|cisco|aruba|arista|sonicwall|watchguard|netscaler|citrix adc|f5|ivanti connect|pulse secure|zscaler|cloudflare|vpc|vnet)\b/i;

function inputJson(value: unknown) {
  return value as Prisma.InputJsonValue;
}
function cleanText(value: string) {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&#x([0-9a-f]+);/gi, (_, code: string) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number.parseInt(code, 10)))
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&#x27;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function xmlTag(block: string, name: string) {
  return cleanText(block.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)<\\/${name}>`, "i"))?.[1] || "");
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 150);
}

function unique(values: string[]) {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function cvesFrom(value: string) {
  return unique(value.match(/CVE-\d{4}-\d{4,}/gi)?.map((item) => item.toUpperCase()) || []);
}

function severityFrom(value: string, cvssScore: number | null) {
  const explicit = value.match(/(?:severity|impact rating)\s*[:\-]?\s*(critical|high|medium|moderate|low)/i)?.[1]?.toLowerCase();
  if (explicit) return explicit === "moderate" ? "medium" : explicit;
  if (cvssScore !== null) {
    if (cvssScore >= 9) return "critical";
    if (cvssScore >= 7) return "high";
    if (cvssScore >= 4) return "medium";
    return "low";
  }
  return "unrated";
}

function cvssFrom(value: string) {
  const matched = value.match(/CVSS(?:v\d(?:\.\d)?)?\s*(?:base)?\s*score\s*[:\-]?\s*(10(?:\.0)?|[0-9](?:\.\d)?)/i)?.[1];
  return matched ? Number(matched) : null;
}

function productNames(vendor: string, title: string, summary: string) {
  const value = `${title} ${summary}`;
  const known = [
    "Cisco IOS XE",
    "Cisco IOS XR",
    "Cisco Identity Services Engine",
    "Cisco Secure Firewall",
    "Cisco ASA",
    "Cisco NX-OS",
    "FortiOS",
    "FortiGate",
    "FortiProxy",
    "FortiSASE",
    "FortiManager",
    "FortiAnalyzer",
    "PAN-OS",
    "GlobalProtect",
    "Prisma Access"
  ].filter((product) => value.toLowerCase().includes(product.toLowerCase()));
  return unique(known.length ? known : [vendor]);
}

function priorityScore(severity: string, exploitationStatus: string, value: string) {
  const base = { critical: 78, high: 66, medium: 48, low: 28, unrated: 42 }[severity] || 42;
  const exploited = /known exploited|active exploitation|exploited in the wild/i.test(exploitationStatus) ? 20 : 0;
  const edge = networkPattern.test(value) ? 8 : 0;
  const remote = /remote|unauthenticated|authentication bypass|code execution/i.test(value) ? 6 : 0;
  return Math.min(100, base + exploited + edge + remote);
}

function externalIdFrom(link: string, title: string) {
  return (
    link.match(/(?:cisco-sa-[a-z0-9-]+|FG-IR-\d{2,4}-\d+|CVE-\d{4}-\d{4,})/i)?.[0] ||
    title.match(/(?:cisco-sa-[a-z0-9-]+|FG-IR-\d{2,4}-\d+|CVE-\d{4}-\d{4,})/i)?.[0] ||
    `advisory-${crypto.createHash("sha256").update(`${title}|${link}`).digest("hex").slice(0, 16)}`
  ).toUpperCase();
}

function contentHash(value: Omit<AdvisoryCandidate, "contentHash">) {
  return crypto
    .createHash("sha256")
    .update(
      JSON.stringify({
        externalId: value.externalId,
        title: value.title,
        summary: value.summary,
        severity: value.severity,
        cvssScore: value.cvssScore,
        cves: value.cves,
        products: value.products,
        affectedVersions: value.affectedVersions,
        fixedVersions: value.fixedVersions,
        remediation: value.remediation,
        workaround: value.workaround,
        exploitationStatus: value.exploitationStatus,
        sourceUrl: value.sourceUrl,
        vendorUpdatedAt: value.vendorUpdatedAt.toISOString()
      })
    )
    .digest("hex");
}

function validDate(value: string, fallback = new Date()) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? fallback : date;
}

function candidate(source: AdvisorySourceDefinition, value: Omit<AdvisoryCandidate, "contentHash" | "priorityScore">) {
  const score = priorityScore(value.severity, value.exploitationStatus, `${value.title} ${value.summary} ${value.products.join(" ")}`);
  const next = { ...value, priorityScore: score };
  return { ...next, contentHash: contentHash(next) };
}

function parseRss(body: string, source: AdvisorySourceDefinition): AdvisoryCandidate[] {
  return (body.match(/<item[\s\S]*?<\/item>/gi) || []).flatMap((block) => {
    const title = xmlTag(block, "title");
    const link = xmlTag(block, "link") || xmlTag(block, "guid");
    const summary = xmlTag(block, "description") || title;
    if (!title || !link) return [];
    const parsedUrl = new URL(link);
    if (parsedUrl.hostname !== source.officialHost) return [];
    const publishedAt = validDate(xmlTag(block, "pubDate") || xmlTag(block, "published") || xmlTag(block, "updated"));
    const cvssScore = cvssFrom(`${title} ${summary}`);
    const severity = severityFrom(`${title} ${summary}`, cvssScore);
    const externalId = externalIdFrom(link, title);
    const exploitationStatus = /known exploited|active exploitation|exploited in the wild/i.test(`${title} ${summary}`)
      ? "Active exploitation reported by vendor"
      : "No active exploitation statement in the source feed";
    return [
      candidate(source, {
        externalId,
        slug: slugify(`${source.vendor}-${externalId}`),
        title,
        vendor: source.vendor,
        summary,
        severity,
        cvssScore,
        cves: cvesFrom(`${title} ${summary}`),
        products: productNames(source.vendor, title, summary),
        affectedVersions: [],
        fixedVersions: [],
        remediation: "Review the official vendor advisory, identify affected deployed versions, and apply the vendor-fixed release or documented mitigation through change control.",
        workaround: "Use only the workaround documented in the linked vendor advisory when immediate patching is not possible.",
        exploitationStatus,
        sourceUrl: link,
        vendorPublishedAt: publishedAt,
        vendorUpdatedAt: validDate(xmlTag(block, "updated"), publishedAt),
        payload: inputJson({ title, link, summary, publishedAt: publishedAt.toISOString() })
      })
    ];
  });
}

function parseCisaKev(body: string, source: AdvisorySourceDefinition): AdvisoryCandidate[] {
  const parsed = JSON.parse(body) as {
    vulnerabilities?: Array<{
      cveID?: string;
      vendorProject?: string;
      product?: string;
      vulnerabilityName?: string;
      dateAdded?: string;
      shortDescription?: string;
      requiredAction?: string;
      dueDate?: string;
      knownRansomwareCampaignUse?: string;
      notes?: string;
    }>;
  };
  return (parsed.vulnerabilities || []).flatMap((item) => {
    if (!item.cveID || !item.vendorProject || !item.product || !item.vulnerabilityName || !item.dateAdded || !item.requiredAction) return [];
    const relevanceText = `${item.vendorProject} ${item.product} ${item.vulnerabilityName} ${item.shortDescription || ""}`;
    if (!networkPattern.test(relevanceText)) return [];
    const publishedAt = validDate(`${item.dateAdded}T00:00:00Z`);
    const externalId = item.cveID.toUpperCase();
    const vendor = item.vendorProject.trim();
    return [
      candidate(source, {
        externalId,
        slug: slugify(`${vendor}-${externalId}`),
        title: `${externalId}: ${item.vulnerabilityName}`,
        vendor,
        summary: item.shortDescription || item.vulnerabilityName,
        severity: "unrated",
        cvssScore: null,
        cves: [externalId],
        products: [item.product],
        affectedVersions: [],
        fixedVersions: [],
        remediation: item.requiredAction,
        workaround: "Follow the vendor instructions linked from the official CISA KEV entry.",
        exploitationStatus: item.knownRansomwareCampaignUse === "Known" ? "Known exploited; ransomware use reported" : "Known exploited",
        sourceUrl: `https://www.cisa.gov/known-exploited-vulnerabilities-catalog?field_cve=${encodeURIComponent(externalId)}`,
        vendorPublishedAt: publishedAt,
        vendorUpdatedAt: publishedAt,
        payload: inputJson(item)
      })
    ];
  });
}

function changesBetween(previous: SecurityAdvisory, next: AdvisoryCandidate) {
  const fields: Array<keyof AdvisoryCandidate> = [
    "title",
    "summary",
    "severity",
    "cvssScore",
    "priorityScore",
    "remediation",
    "workaround",
    "exploitationStatus",
    "sourceUrl"
  ];
  return fields.filter((field) => String(previous[field as keyof SecurityAdvisory] ?? "") !== String(next[field] ?? ""));
}

async function storeCandidate(sourceId: string, item: AdvisoryCandidate) {
  const prisma = getPrismaClient();
  const existing = await prisma.securityAdvisory.findFirst({
    where: { OR: [{ sourceId, externalId: item.externalId }, { slug: item.slug }] },
    include: { revisions: { orderBy: { version: "desc" }, take: 1 } }
  });
  if (existing?.contentHash === item.contentHash) {
    await prisma.securityAdvisory.update({ where: { id: existing.id }, data: { lastVerifiedAt: new Date() } });
    return { advisory: existing, revision: existing.revisions[0]?.version || 1, changed: false };
  }

  const data = {
    externalId: item.externalId,
    slug: item.slug,
    title: item.title,
    vendor: item.vendor,
    summary: item.summary,
    severity: item.severity,
    cvssScore: item.cvssScore,
    priorityScore: item.priorityScore,
    cves: inputJson(item.cves),
    products: inputJson(item.products),
    affectedVersions: inputJson(item.affectedVersions),
    fixedVersions: inputJson(item.fixedVersions),
    remediation: item.remediation,
    workaround: item.workaround,
    exploitationStatus: item.exploitationStatus,
    sourceUrl: item.sourceUrl,
    contentHash: item.contentHash,
    status: "published",
    vendorPublishedAt: item.vendorPublishedAt,
    vendorUpdatedAt: item.vendorUpdatedAt,
    lastVerifiedAt: new Date()
  };

  if (!existing) {
    const created = await prisma.securityAdvisory.create({ data: { sourceId, ...data } });
    await prisma.securityAdvisoryRevision.create({
      data: { advisoryId: created.id, version: 1, contentHash: item.contentHash, changes: inputJson(["created"]), payload: item.payload }
    });
    return { advisory: created, revision: 1, changed: true };
  }

  const revision = (existing.revisions[0]?.version || 0) + 1;
  const changedFields = changesBetween(existing, item);
  const updated = await prisma.securityAdvisory.update({ where: { id: existing.id }, data });
  await prisma.securityAdvisoryRevision.create({
    data: { advisoryId: existing.id, version: revision, contentHash: item.contentHash, changes: inputJson(changedFields), payload: item.payload }
  });
  return { advisory: updated, revision, changed: true };
}

async function ensureSources() {
  const prisma = getPrismaClient();
  for (const source of advisorySourceDefinitions) {
    await prisma.advisorySource.upsert({
      where: { slug: source.slug },
      update: { name: source.name, vendor: source.vendor, format: source.format, url: source.url, officialHost: source.officialHost, priority: source.priority },
      create: source
    });
  }
}

export async function scanAdvisorySources() {
  await ensureSources();
  const prisma = getPrismaClient();
  const sources = await prisma.advisorySource.findMany({ where: { enabled: true }, orderBy: { priority: "desc" } });
  const results: Array<{ source: string; status: number; candidates: number; published: number; unchanged: number; error?: string }> = [];

  for (const source of sources) {
    const definition = advisorySourceDefinitions.find((item) => item.slug === source.slug);
    if (!definition) continue;
    const headers: Record<string, string> = { "user-agent": "QCS-Security-Advisory-Desk/1.0", accept: definition.format === "cisa-kev" ? "application/json" : "application/rss+xml, application/xml" };
    if (source.etag) headers["if-none-match"] = source.etag;
    if (source.lastModified) headers["if-modified-since"] = source.lastModified;

    try {
      const response = await fetch(definition.url, { headers, cache: "no-store", signal: AbortSignal.timeout(20_000) });
      if (response.status === 304) {
        await prisma.advisorySource.update({ where: { id: source.id }, data: { lastCheckedAt: new Date(), lastSuccessAt: new Date(), consecutiveFailures: 0, lastError: null } });
        results.push({ source: source.name, status: 304, candidates: 0, published: 0, unchanged: 0 });
        continue;
      }
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const body = await response.text();
      const parsed = definition.format === "cisa-kev" ? parseCisaKev(body, definition) : parseRss(body, definition);
      const since = new Date((source.lastSuccessAt?.getTime() || Date.now() - 72 * 60 * 60_000) - 15 * 60_000);
      const candidates = parsed.filter((item) => item.vendorUpdatedAt >= since || item.vendorPublishedAt >= since).slice(0, 30);
      let published = 0;
      let unchanged = 0;

      for (const item of candidates) {
        const stored = await storeCandidate(source.id, item);
        if (stored.changed) {
          published += 1;
          await queueLinkedInForAdvisory(stored.advisory, stored.revision);
        } else {
          unchanged += 1;
        }
      }

      await prisma.advisorySource.update({
        where: { id: source.id },
        data: {
          etag: response.headers.get("etag"),
          lastModified: response.headers.get("last-modified"),
          lastCheckedAt: new Date(),
          lastSuccessAt: new Date(),
          consecutiveFailures: 0,
          lastError: null
        }
      });
      results.push({ source: source.name, status: response.status, candidates: candidates.length, published, unchanged });
    } catch (error) {
      const message = error instanceof Error ? error.message.slice(0, 1200) : "Unknown advisory source error";
      await prisma.advisorySource.update({
        where: { id: source.id },
        data: { lastCheckedAt: new Date(), consecutiveFailures: { increment: 1 }, lastError: message }
      });
      results.push({ source: source.name, status: 0, candidates: 0, published: 0, unchanged: 0, error: message });
    }
  }

  return results;
}

export async function listSecurityAdvisories(limit = 100) {
  if (process.env.STORE_DRIVER !== "postgres" || !process.env.DATABASE_URL) return [];
  return getPrismaClient().securityAdvisory.findMany({
    where: { status: { in: ["published", "withdrawn"] } },
    orderBy: [{ priorityScore: "desc" }, { vendorPublishedAt: "desc" }],
    take: Math.max(1, Math.min(limit, 250)),
    include: { source: { select: { name: true, lastSuccessAt: true } }, revisions: { orderBy: { version: "desc" }, take: 8 } }
  });
}

export async function getSecurityAdvisory(slug: string) {
  if (process.env.STORE_DRIVER !== "postgres" || !process.env.DATABASE_URL) return null;
  return getPrismaClient().securityAdvisory.findUnique({
    where: { slug },
    include: { source: { select: { name: true, officialHost: true, lastSuccessAt: true } }, revisions: { orderBy: { version: "desc" }, take: 20 } }
  });
}

export async function getAdvisoryOperationsSummary() {
  const prisma = getPrismaClient();
  const [sources, total, latest] = await Promise.all([
    prisma.advisorySource.findMany({ orderBy: { priority: "desc" } }),
    prisma.securityAdvisory.count({ where: { status: "published" } }),
    prisma.securityAdvisory.findMany({ orderBy: { updatedAt: "desc" }, take: 10 })
  ]);
  return {
    total,
    sources: sources.map((source) => ({
      slug: source.slug,
      name: source.name,
      enabled: source.enabled,
      lastSuccessAt: source.lastSuccessAt?.toISOString() || "",
      lastCheckedAt: source.lastCheckedAt?.toISOString() || "",
      consecutiveFailures: source.consecutiveFailures,
      lastError: source.lastError || ""
    })),
    latest: latest.map((advisory) => ({ id: advisory.id, slug: advisory.slug, title: advisory.title, severity: advisory.severity, updatedAt: advisory.updatedAt.toISOString() }))
  };
}
