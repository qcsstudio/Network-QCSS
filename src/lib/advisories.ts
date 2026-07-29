import crypto from "node:crypto";
import type { Prisma, SecurityAdvisory } from "@prisma/client";
import { z } from "zod";
import { enrichSecurityAdvisory } from "@/lib/editorial-content-agents";
import { getPrismaClient } from "@/lib/prisma";
import { queueLinkedInForAdvisory } from "@/lib/social-publications";

export type AdvisorySourceDefinition = {
  slug: string;
  name: string;
  vendor: string;
  format: "rss" | "cisa-kev" | "cert-in";
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
  technicalExplanation?: string;
  businessImpact?: string;
  evidenceChecklist?: string[];
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
  editorialTrace?: Prisma.InputJsonValue;
  qualityScore?: number;
};

const advisoryEditorSchema = z.object({
  slug: z.string().trim().min(3).max(180).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  title: z.string().trim().min(10).max(220),
  vendor: z.string().trim().min(2).max(120),
  summary: z.string().trim().min(50).max(1600),
  technicalExplanation: z.string().trim().min(80).max(2400).default("Technical analysis is pending editorial review."),
  businessImpact: z.string().trim().min(50).max(1200).default("Confirm the affected service and business dependency before assigning impact."),
  evidenceChecklist: z.array(z.string().trim().min(15).max(500)).min(4).max(10).default([
    "Confirm the deployed product, software release, role, and accountable owner.",
    "Compare the environment with every applicability condition in the official advisory.",
    "Record current exposure, configuration, logs, and compensating controls.",
    "Retain before-and-after remediation and service-validation evidence."
  ]),
  severity: z.enum(["critical", "high", "medium", "low", "unrated"]),
  cvssScore: z.number().min(0).max(10).nullable(),
  priorityScore: z.number().int().min(0).max(100),
  cves: z.array(z.string().trim().min(3).max(40)).max(30),
  products: z.array(z.string().trim().min(2).max(180)).min(1).max(40),
  affectedVersions: z.array(z.string().trim().min(1).max(180)).max(40),
  fixedVersions: z.array(z.string().trim().min(1).max(180)).max(40),
  remediation: z.string().trim().min(30).max(2400),
  workaround: z.string().trim().max(2400),
  exploitationStatus: z.string().trim().min(10).max(500),
  sourceUrl: z.string().trim().url().max(1200).refine((value) => value.startsWith("https://"), "The source URL must use HTTPS."),
  status: z.enum(["draft", "published", "withdrawn"]).default("draft"),
  vendorPublishedAt: z.coerce.date(),
  vendorUpdatedAt: z.coerce.date()
});

export type AdvisoryEditorInput = z.input<typeof advisoryEditorSchema>;

export type AdminAdvisoryRecord = {
  id: string;
  sourceName: string;
  sourceSlug: string;
  externalId: string;
  slug: string;
  title: string;
  vendor: string;
  summary: string;
  technicalExplanation: string;
  businessImpact: string;
  evidenceChecklist: string[];
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
  status: string;
  editorialOverride: boolean;
  createdBy: string;
  updatedBy: string;
  vendorPublishedAt: string;
  vendorUpdatedAt: string;
  lastVerifiedAt: string;
  updatedAt: string;
  revision: number;
  qualityScore: number | null;
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
  },
  {
    slug: "juniper-mist-security",
    name: "Juniper Mist Security Alerts",
    vendor: "Juniper Networks",
    format: "rss",
    url: "https://www.mist.com/documentation/category/security-alerts/feed/",
    officialHost: "www.mist.com",
    priority: 93
  },
  {
    slug: "ubuntu-security-notices",
    name: "Ubuntu Security Notices",
    vendor: "Ubuntu",
    format: "rss",
    url: "https://ubuntu.com/security/notices/rss.xml",
    officialHost: "ubuntu.com",
    priority: 90
  },
  {
    slug: "cert-in-advisories",
    name: "CERT-In Advisories",
    vendor: "CERT-In",
    format: "cert-in",
    url: "https://www.cert-in.org.in/s2cMainServlet?pageid=PUBADVLIST02",
    officialHost: "www.cert-in.org.in",
    priority: 92
  }
];

const networkPattern =
  /\b(network|router|routing|switch|firewall|vpn|gateway|wireless|wi-?fi|sd-wan|sase|ztna|dns|dhcp|bgp|load balancer|proxy|edge|forti|pan-os|globalprotect|junos|cisco|aruba|arista|sonicwall|watchguard|netscaler|citrix adc|f5|ivanti connect|pulse secure|zscaler|cloudflare|vpc|vnet)\b/i;

function inputJson(value: unknown) {
  return value as Prisma.InputJsonValue;
}

function jsonStrings(value: Prisma.JsonValue) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function adminContentHash(value: z.output<typeof advisoryEditorSchema>) {
  return crypto.createHash("sha256").update(JSON.stringify(value)).digest("hex");
}
function cleanText(value: string) {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&nbsp;|&#160;|&#xA0;/gi, " ")
    .replace(/&#x([0-9a-f]+);/gi, (_, code: string) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number.parseInt(code, 10)))
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&#x27;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
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
    "Prisma Access",
    "Junos OS",
    "Juniper Mist",
    "Ubuntu"
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
    link.match(/(?:cisco-sa-[a-z0-9-]+|FG-IR-\d{2,4}-\d+|CVE-\d{4}-\d{4,}|CIAD-\d{4}-\d+)/i)?.[0] ||
    title.match(/(?:cisco-sa-[a-z0-9-]+|FG-IR-\d{2,4}-\d+|CVE-\d{4}-\d{4,}|CIAD-\d{4}-\d+)/i)?.[0] ||
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
        technicalExplanation: value.technicalExplanation,
        businessImpact: value.businessImpact,
        evidenceChecklist: value.evidenceChecklist,
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
    if (!networkPattern.test(`${title} ${summary} ${source.vendor}`)) return [];
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

function parseCertIn(body: string, source: AdvisorySourceDefinition): AdvisoryCandidate[] {
  const blocks = body.match(/<table[^>]*class=["']?content["']?[^>]*>[\s\S]*?<\/table>/gi) || [];
  return blocks.flatMap((block) => {
    const externalId = block.match(/VLCODE=(CIAD-\d{4}-\d+)/i)?.[1]?.toUpperCase() || "";
    const rawTitle = block.match(/<div[^>]*overflow:\s*hidden[^>]*>[\s\S]*?<span[^>]*>([\s\S]*?)<\/span>/i)?.[1] || "";
    const title = cleanText(rawTitle);
    const rawDate = block.match(/\(([A-Z][a-z]+\s+\d{1,2},\s+\d{4})\)/)?.[1] || "";
    if (!externalId || !title || !networkPattern.test(title)) return [];
    const sourceUrl = `https://www.cert-in.org.in/s2cMainServlet?pageid=PUBVLNOTES02&VLCODE=${encodeURIComponent(externalId)}`;
    const publishedAt = validDate(rawDate);
    return [
      candidate(source, {
        externalId,
        slug: slugify(`cert-in-${externalId}`),
        title,
        vendor: source.vendor,
        summary: `CERT-In published ${externalId} for ${title}. Review the official advisory to confirm affected products, releases, impact, and remediation.`,
        severity: severityFrom(title, null),
        cvssScore: null,
        cves: cvesFrom(title),
        products: productNames(source.vendor, title, ""),
        affectedVersions: [],
        fixedVersions: [],
        remediation: "Review the official CERT-In advisory and the referenced vendor guidance before applying a controlled remediation.",
        workaround: "Use only mitigations documented by CERT-In or the affected vendor.",
        exploitationStatus: "No exploitation statement was extracted from the CERT-In advisory index.",
        sourceUrl,
        vendorPublishedAt: publishedAt,
        vendorUpdatedAt: publishedAt,
        payload: inputJson({ externalId, title, sourceUrl, publishedAt: publishedAt.toISOString() })
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

async function enrichCandidate(source: AdvisorySourceDefinition, item: AdvisoryCandidate) {
  const enriched = await enrichSecurityAdvisory({
    title: item.title,
    vendor: item.vendor,
    summary: item.summary,
    severity: item.severity,
    cvssScore: item.cvssScore,
    cves: item.cves,
    products: item.products,
    source: { label: source.name, url: item.sourceUrl, suppliedSummary: item.summary },
    sourcePayload: item.payload
  });
  const next = {
    ...item,
    summary: enriched.content.plainLanguageSummary,
    technicalExplanation: enriched.content.technicalExplanation,
    businessImpact: enriched.content.businessImpact,
    evidenceChecklist: enriched.content.evidenceChecklist,
    products: unique([...item.products, ...enriched.content.products]),
    cves: unique([...item.cves, ...enriched.content.cves.map((value) => value.toUpperCase())]),
    affectedVersions: enriched.content.affectedVersions,
    fixedVersions: enriched.content.fixedVersions,
    remediation: enriched.content.remediation,
    workaround: enriched.content.workaround,
    exploitationStatus: enriched.content.exploitationStatus,
    editorialTrace: inputJson({ ...enriched.trace, sourceFingerprint: item.contentHash }),
    qualityScore: enriched.qualityScore
  };
  return { ...next, contentHash: contentHash(next) };
}

async function previouslyProcessedCandidate(sourceId: string, item: AdvisoryCandidate) {
  const existing = await getPrismaClient().securityAdvisory.findFirst({
    where: { OR: [{ sourceId, externalId: item.externalId }, { slug: item.slug }] },
    select: { id: true, editorialOverride: true, editorialTrace: true }
  });
  if (!existing) return false;
  if (existing.editorialOverride) {
    await getPrismaClient().securityAdvisory.update({ where: { id: existing.id }, data: { lastVerifiedAt: new Date() } });
    return true;
  }
  const trace = existing.editorialTrace;
  if (!trace || typeof trace !== "object" || Array.isArray(trace)) return false;
  if ((trace as Record<string, unknown>).sourceFingerprint !== item.contentHash) return false;
  await getPrismaClient().securityAdvisory.update({ where: { id: existing.id }, data: { lastVerifiedAt: new Date() } });
  return true;
}

function changesBetween(previous: SecurityAdvisory, next: AdvisoryCandidate) {
  const fields: Array<keyof AdvisoryCandidate> = [
    "title",
    "summary",
    "technicalExplanation",
    "businessImpact",
    "evidenceChecklist",
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
  if (existing?.editorialOverride) {
    await prisma.securityAdvisory.update({ where: { id: existing.id }, data: { lastVerifiedAt: new Date() } });
    return { advisory: existing, revision: existing.revisions[0]?.version || 1, changed: false };
  }
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
    technicalExplanation: item.technicalExplanation || "",
    businessImpact: item.businessImpact || "",
    evidenceChecklist: inputJson(item.evidenceChecklist || []),
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
    editorialTrace: item.editorialTrace,
    qualityScore: item.qualityScore,
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

export async function backfillLegacyAdvisoryEditorialContent() {
  const prisma = getPrismaClient();
  const existing = await prisma.securityAdvisory.findFirst({
    where: { status: "published", qualityScore: null, editorialOverride: false, source: { enabled: true } },
    orderBy: [{ updatedAt: "desc" }],
    include: {
      source: { select: { name: true } },
      revisions: { orderBy: { version: "desc" }, take: 1 }
    }
  });
  if (!existing) return null;

  const products = jsonStrings(existing.products);
  const cves = jsonStrings(existing.cves);
  const enriched = await enrichSecurityAdvisory({
    title: existing.title,
    vendor: existing.vendor,
    summary: existing.summary,
    severity: existing.severity,
    cvssScore: existing.cvssScore,
    cves,
    products,
    source: { label: existing.source.name, url: existing.sourceUrl, suppliedSummary: existing.summary },
    sourcePayload: existing.revisions[0]?.payload || {}
  });
  const previousVersion = existing.revisions[0]?.version || 1;
  const version = previousVersion + 1;
  const next: Omit<AdvisoryCandidate, "contentHash"> = {
    externalId: existing.externalId,
    slug: existing.slug,
    title: existing.title,
    vendor: existing.vendor,
    summary: enriched.content.plainLanguageSummary,
    technicalExplanation: enriched.content.technicalExplanation,
    businessImpact: enriched.content.businessImpact,
    evidenceChecklist: enriched.content.evidenceChecklist,
    severity: existing.severity,
    cvssScore: existing.cvssScore,
    priorityScore: existing.priorityScore,
    cves: unique([...cves, ...enriched.content.cves.map((value) => value.toUpperCase())]),
    products: unique([...products, ...enriched.content.products]),
    affectedVersions: unique([...jsonStrings(existing.affectedVersions), ...enriched.content.affectedVersions]),
    fixedVersions: unique([...jsonStrings(existing.fixedVersions), ...enriched.content.fixedVersions]),
    remediation: enriched.content.remediation,
    workaround: enriched.content.workaround,
    exploitationStatus: enriched.content.exploitationStatus,
    sourceUrl: existing.sourceUrl,
    vendorPublishedAt: existing.vendorPublishedAt,
    vendorUpdatedAt: existing.vendorUpdatedAt,
    payload: existing.revisions[0]?.payload || inputJson({ origin: "legacy_editorial_backfill" }),
    editorialTrace: inputJson({ ...enriched.trace, sourceFingerprint: existing.contentHash, backfilledAt: new Date().toISOString() }),
    qualityScore: enriched.qualityScore
  };
  const hash = contentHash(next);
  const updated = await prisma.securityAdvisory.update({
    where: { id: existing.id },
    data: {
      summary: next.summary,
      technicalExplanation: next.technicalExplanation,
      businessImpact: next.businessImpact,
      evidenceChecklist: inputJson(next.evidenceChecklist),
      cves: inputJson(next.cves),
      products: inputJson(next.products),
      affectedVersions: inputJson(next.affectedVersions),
      fixedVersions: inputJson(next.fixedVersions),
      remediation: next.remediation,
      workaround: next.workaround,
      exploitationStatus: next.exploitationStatus,
      contentHash: hash,
      editorialTrace: next.editorialTrace,
      qualityScore: next.qualityScore,
      lastVerifiedAt: new Date(),
      revisions: {
        create: {
          version,
          contentHash: hash,
          changes: inputJson(["editorial_backfill"]),
          payload: next.payload
        }
      }
    }
  });
  const existingPublication = await prisma.socialPublication.findFirst({
    where: { channel: "linkedin", contentType: "security_advisory", contentId: existing.id },
    select: { contentRevision: true }
  });
  await queueLinkedInForAdvisory(updated, existingPublication?.contentRevision || version);
  return { id: updated.id, title: updated.title, qualityScore: updated.qualityScore, revision: version };
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

export async function scanAdvisorySources(options: { backfillOnly?: boolean } = {}) {
  await ensureSources();
  const prisma = getPrismaClient();
  const sources = options.backfillOnly
    ? []
    : await prisma.advisorySource.findMany({ where: { enabled: true }, orderBy: { priority: "desc" } });
  const configuredLimit = Number.parseInt(process.env.ADVISORY_ENRICHMENTS_PER_RUN || "1", 10);
  let remainingEditorialBudget = Number.isFinite(configuredLimit) ? Math.max(1, Math.min(configuredLimit, 2)) : 1;
  const results: Array<{ source: string; status: number; candidates: number; published: number; unchanged: number; queued: number; error?: string }> = [];

  for (const source of sources) {
    const definition = advisorySourceDefinitions.find((item) => item.slug === source.slug);
    if (!definition) continue;
    const headers: Record<string, string> = {
      "user-agent": "QCS-Security-Advisory-Desk/2.0",
      accept: definition.format === "cisa-kev" ? "application/json" : definition.format === "cert-in" ? "text/html" : "application/rss+xml, application/xml"
    };
    if (source.etag) headers["if-none-match"] = source.etag;
    if (source.lastModified) headers["if-modified-since"] = source.lastModified;

    try {
      const response = await fetch(definition.url, { headers, cache: "no-store", signal: AbortSignal.timeout(20_000) });
      if (response.status === 304) {
        await prisma.advisorySource.update({ where: { id: source.id }, data: { lastCheckedAt: new Date(), lastSuccessAt: new Date(), consecutiveFailures: 0, lastError: null } });
        results.push({ source: source.name, status: 304, candidates: 0, published: 0, unchanged: 0, queued: 0 });
        continue;
      }
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const body = await response.text();
      const parsed = definition.format === "cisa-kev" ? parseCisaKev(body, definition) : definition.format === "cert-in" ? parseCertIn(body, definition) : parseRss(body, definition);
      const since = new Date((source.lastSuccessAt?.getTime() || Date.now() - 72 * 60 * 60_000) - 15 * 60_000);
      const candidates = parsed
        .filter((item) => item.vendorUpdatedAt >= since || item.vendorPublishedAt >= since)
        .sort((left, right) => right.vendorUpdatedAt.getTime() - left.vendorUpdatedAt.getTime())
        .slice(0, 8);
      let published = 0;
      let unchanged = 0;
      let queued = 0;
      let editorialHold = "";

      for (const item of candidates) {
        if (await previouslyProcessedCandidate(source.id, item)) {
          unchanged += 1;
          continue;
        }
        if (remainingEditorialBudget <= 0) {
          queued += 1;
          continue;
        }
        remainingEditorialBudget -= 1;
        try {
          const editorialCandidate = await enrichCandidate(definition, item);
          const stored = await storeCandidate(source.id, editorialCandidate);
          if (stored.changed) {
            published += 1;
            await queueLinkedInForAdvisory(stored.advisory, stored.revision);
          } else {
            unchanged += 1;
          }
        } catch (error) {
          editorialHold = error instanceof Error ? error.message.slice(0, 1200) : "Unknown editorial review error";
          queued += 1;
          console.warn(`Editorial review held ${definition.slug}:${item.externalId}.`, error);
        }
      }

      await prisma.advisorySource.update({
        where: { id: source.id },
        data: queued
          ? { lastCheckedAt: new Date(), consecutiveFailures: 0, lastError: null }
          : {
              etag: response.headers.get("etag"),
              lastModified: response.headers.get("last-modified"),
              lastCheckedAt: new Date(),
              lastSuccessAt: new Date(),
              consecutiveFailures: 0,
              lastError: null
            }
      });
      results.push({
        source: source.name,
        status: response.status,
        candidates: candidates.length,
        published,
        unchanged,
        queued,
        error: editorialHold || undefined
      });
    } catch (error) {
      const message = error instanceof Error ? error.message.slice(0, 1200) : "Unknown advisory source error";
      await prisma.advisorySource.update({
        where: { id: source.id },
        data: { lastCheckedAt: new Date(), consecutiveFailures: { increment: 1 }, lastError: message }
      });
      results.push({ source: source.name, status: 0, candidates: 0, published: 0, unchanged: 0, queued: 0, error: message });
    }
  }

  while (remainingEditorialBudget > 0) {
    remainingEditorialBudget -= 1;
    try {
      const backfilled = await backfillLegacyAdvisoryEditorialContent();
      if (!backfilled) break;
      results.push({ source: "QCS editorial backfill", status: 200, candidates: 1, published: 0, unchanged: 0, queued: 0 });
    } catch (error) {
      const message = error instanceof Error ? error.message.slice(0, 1200) : "Unknown editorial backfill error";
      results.push({ source: "QCS editorial backfill", status: 0, candidates: 1, published: 0, unchanged: 0, queued: 0, error: message });
      break;
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
  return getPrismaClient().securityAdvisory.findFirst({
    where: { slug, status: { in: ["published", "withdrawn"] } },
    include: { source: { select: { name: true, officialHost: true, lastSuccessAt: true } }, revisions: { orderBy: { version: "desc" }, take: 20 } }
  });
}

function mapAdminAdvisory(record: SecurityAdvisory & {
  source: { name: string; slug: string };
  revisions: { version: number }[];
}): AdminAdvisoryRecord {
  return {
    id: record.id,
    sourceName: record.source.name,
    sourceSlug: record.source.slug,
    externalId: record.externalId,
    slug: record.slug,
    title: record.title,
    vendor: record.vendor,
    summary: record.summary,
    technicalExplanation: record.technicalExplanation,
    businessImpact: record.businessImpact,
    evidenceChecklist: jsonStrings(record.evidenceChecklist),
    severity: record.severity,
    cvssScore: record.cvssScore,
    priorityScore: record.priorityScore,
    cves: jsonStrings(record.cves),
    products: jsonStrings(record.products),
    affectedVersions: jsonStrings(record.affectedVersions),
    fixedVersions: jsonStrings(record.fixedVersions),
    remediation: record.remediation,
    workaround: record.workaround || "",
    exploitationStatus: record.exploitationStatus,
    sourceUrl: record.sourceUrl,
    status: record.status,
    editorialOverride: record.editorialOverride,
    createdBy: record.createdBy || "",
    updatedBy: record.updatedBy || "",
    vendorPublishedAt: record.vendorPublishedAt.toISOString(),
    vendorUpdatedAt: record.vendorUpdatedAt.toISOString(),
    lastVerifiedAt: record.lastVerifiedAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
    revision: record.revisions[0]?.version || 1,
    qualityScore: record.qualityScore
  };
}

const adminAdvisoryInclude = {
  source: { select: { name: true, slug: true } },
  revisions: { orderBy: { version: "desc" as const }, take: 1, select: { version: true } }
};

export async function listAdminSecurityAdvisories() {
  const records = await getPrismaClient().securityAdvisory.findMany({
    orderBy: [{ updatedAt: "desc" }],
    include: adminAdvisoryInclude
  });
  return records.map(mapAdminAdvisory);
}

export async function getAdminSecurityAdvisory(id: string) {
  const record = await getPrismaClient().securityAdvisory.findUnique({ where: { id }, include: adminAdvisoryInclude });
  return record ? mapAdminAdvisory(record) : null;
}

async function ensureManualAdvisorySource() {
  return getPrismaClient().advisorySource.upsert({
    where: { slug: "qcs-editorial" },
    update: { name: "QCS Editorial Advisory Desk", enabled: false },
    create: {
      slug: "qcs-editorial",
      name: "QCS Editorial Advisory Desk",
      vendor: "QCS",
      format: "manual",
      url: "https://www.qcsstudio.com/security-advisories",
      officialHost: "www.qcsstudio.com",
      enabled: false,
      priority: 10
    }
  });
}

function revisionPayload(content: z.output<typeof advisoryEditorSchema>, actor: string, action: string) {
  return inputJson({ origin: "admin", actor, action, content: { ...content, vendorPublishedAt: content.vendorPublishedAt.toISOString(), vendorUpdatedAt: content.vendorUpdatedAt.toISOString() } });
}

export async function createAdminSecurityAdvisory(value: unknown, actor: string) {
  const content = advisoryEditorSchema.parse(value);
  const prisma = getPrismaClient();
  const source = await ensureManualAdvisorySource();
  const externalId = `QCS-${crypto.createHash("sha256").update(`${content.slug}|${Date.now()}`).digest("hex").slice(0, 12).toUpperCase()}`;
  const hash = adminContentHash(content);
  const record = await prisma.securityAdvisory.create({
    data: {
      sourceId: source.id,
      externalId,
      slug: content.slug,
      title: content.title,
      vendor: content.vendor,
      summary: content.summary,
      technicalExplanation: content.technicalExplanation,
      businessImpact: content.businessImpact,
      evidenceChecklist: inputJson(content.evidenceChecklist),
      severity: content.severity,
      cvssScore: content.cvssScore,
      priorityScore: content.priorityScore,
      cves: inputJson(content.cves),
      products: inputJson(content.products),
      affectedVersions: inputJson(content.affectedVersions),
      fixedVersions: inputJson(content.fixedVersions),
      remediation: content.remediation,
      workaround: content.workaround,
      exploitationStatus: content.exploitationStatus,
      sourceUrl: content.sourceUrl,
      contentHash: hash,
      status: content.status,
      editorialOverride: true,
      createdBy: actor,
      updatedBy: actor,
      vendorPublishedAt: content.vendorPublishedAt,
      vendorUpdatedAt: content.vendorUpdatedAt,
      revisions: { create: { version: 1, contentHash: hash, changes: inputJson(["created_by_admin"]), payload: revisionPayload(content, actor, "created") } }
    },
    include: adminAdvisoryInclude
  });
  return mapAdminAdvisory(record);
}

export async function updateAdminSecurityAdvisory(id: string, value: unknown, actor: string) {
  const content = advisoryEditorSchema.parse(value);
  const prisma = getPrismaClient();
  const existing = await prisma.securityAdvisory.findUnique({
    where: { id },
    include: { revisions: { orderBy: { version: "desc" }, take: 1, select: { version: true } } }
  });
  if (!existing) return null;
  const version = (existing.revisions[0]?.version || 0) + 1;
  const hash = adminContentHash(content);
  const record = await prisma.securityAdvisory.update({
    where: { id },
    data: {
      slug: content.slug,
      title: content.title,
      vendor: content.vendor,
      summary: content.summary,
      technicalExplanation: content.technicalExplanation,
      businessImpact: content.businessImpact,
      evidenceChecklist: inputJson(content.evidenceChecklist),
      severity: content.severity,
      cvssScore: content.cvssScore,
      priorityScore: content.priorityScore,
      cves: inputJson(content.cves),
      products: inputJson(content.products),
      affectedVersions: inputJson(content.affectedVersions),
      fixedVersions: inputJson(content.fixedVersions),
      remediation: content.remediation,
      workaround: content.workaround,
      exploitationStatus: content.exploitationStatus,
      sourceUrl: content.sourceUrl,
      contentHash: hash,
      status: content.status,
      editorialOverride: true,
      editorialTrace: inputJson({ origin: "admin", actor, invalidatedAt: new Date().toISOString() }),
      qualityScore: null,
      updatedBy: actor,
      deletedAt: null,
      vendorPublishedAt: content.vendorPublishedAt,
      vendorUpdatedAt: content.vendorUpdatedAt,
      revisions: { create: { version, contentHash: hash, changes: inputJson(["edited_by_admin"]), payload: revisionPayload(content, actor, "updated") } }
    },
    include: adminAdvisoryInclude
  });
  return mapAdminAdvisory(record);
}

export async function setAdminAdvisoryState(id: string, action: "publish" | "withdraw" | "restore" | "resume_sync", actor: string) {
  const prisma = getPrismaClient();
  const existing = await prisma.securityAdvisory.findUnique({
    where: { id },
    include: { source: { select: { slug: true } }, revisions: { orderBy: { version: "desc" }, take: 1, select: { version: true } } }
  });
  if (!existing) return null;
  if (action === "resume_sync" && existing.source.slug === "qcs-editorial") throw new Error("Manually created advisories do not have a vendor feed to resume.");
  if (action === "publish") {
    const publishText = `${existing.title} ${existing.summary} ${existing.remediation} ${existing.workaround || ""} ${existing.exploitationStatus}`;
    if (/draft required|placeholder|vendor name|affected network product/i.test(publishText)) {
      throw new Error("Replace every draft placeholder before publishing the advisory.");
    }
    if (existing.source.slug === "qcs-editorial" && existing.sourceUrl === "https://www.qcsstudio.com/security-advisories") {
      throw new Error("Add the authoritative external source URL before publishing the advisory.");
    }
  }
  const status = action === "withdraw" ? "withdrawn" : action === "restore" ? "draft" : "published";
  const version = (existing.revisions[0]?.version || 0) + 1;
  const record = await prisma.securityAdvisory.update({
    where: { id },
    data: {
      status,
      editorialOverride: action === "resume_sync" ? false : true,
      ...(action === "resume_sync" ? { editorialTrace: inputJson({ origin: "source_sync_resumed", actor }), qualityScore: null } : {}),
      deletedAt: null,
      updatedBy: actor,
      revisions: {
        create: {
          version,
          contentHash: existing.contentHash,
          changes: inputJson([action]),
          payload: inputJson({ origin: "admin", actor, action })
        }
      }
    },
    include: adminAdvisoryInclude
  });
  return mapAdminAdvisory(record);
}

export async function deleteAdminSecurityAdvisory(id: string, actor: string) {
  const prisma = getPrismaClient();
  const existing = await prisma.securityAdvisory.findUnique({
    where: { id },
    include: { revisions: { orderBy: { version: "desc" }, take: 1, select: { version: true } } }
  });
  if (!existing) return null;
  const version = (existing.revisions[0]?.version || 0) + 1;
  const record = await prisma.securityAdvisory.update({
    where: { id },
    data: {
      status: "deleted",
      editorialOverride: true,
      deletedAt: new Date(),
      updatedBy: actor,
      revisions: {
        create: {
          version,
          contentHash: existing.contentHash,
          changes: inputJson(["deleted"]),
          payload: inputJson({ origin: "admin", actor, action: "deleted" })
        }
      }
    },
    include: adminAdvisoryInclude
  });
  return mapAdminAdvisory(record);
}

export async function getSecurityAdvisoryForDistribution(id: string) {
  return getPrismaClient().securityAdvisory.findUnique({ where: { id } });
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
