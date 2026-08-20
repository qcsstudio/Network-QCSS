import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { blogPosts, type BlogPost } from "@/lib/blog";
import {
  assertContentPostAction,
  contentPostStatuses,
  emptyContentPostStatusCounts,
  type ContentPostListQuery,
  type ContentPostStatus
} from "@/lib/content-admin-domain";
import { buildRadarPublicationPost, type RadarDraftInput } from "@/lib/content-radar-domain";
import { createResearchedBlog } from "@/lib/editorial-content-agents";
import { isTrustedEditorialUrl } from "@/lib/editorial-source-policy";
import { getPrismaClient } from "@/lib/prisma";

export type { RadarDraftInput } from "@/lib/content-radar-domain";
export { contentPostStatuses } from "@/lib/content-admin-domain";
export type { ContentPostListQuery, ContentPostStatus } from "@/lib/content-admin-domain";

const internalLinkSchema = z.object({
  label: z.string().trim().min(2).max(140),
  href: z.string().trim().min(1).max(500).refine((value) => value.startsWith("/"), "Internal links must start with /.")
});

const sourceLinkSchema = z.object({
  label: z.string().trim().min(2).max(180),
  url: z.string().trim().url().max(1000)
});

export const blogPostSchema = z.object({
  contentVersion: z.literal(2).optional(),
  contentType: z.enum(["blog", "resource"]).default("blog"),
  slug: z.string().trim().min(3).max(180).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  title: z.string().trim().min(10).max(180),
  metaTitle: z.string().trim().min(10).max(70),
  description: z.string().trim().min(50).max(180),
  excerpt: z.string().trim().min(60).max(400),
  answer: z.string().trim().min(60).max(900),
  category: z.string().trim().min(2).max(100),
  audience: z.string().trim().min(2).max(240),
  primaryKeyword: z.string().trim().min(2).max(140),
  keywords: z.array(z.string().trim().min(2).max(140)).min(3).max(20),
  publishedAt: z.string().date(),
  updatedAt: z.string().date(),
  readTime: z.string().trim().min(3).max(40),
  image: z.string().trim().min(2).max(500).refine((value) => value.startsWith("/"), "Image paths must start with /."),
  imageAlt: z.string().trim().min(20).max(240),
  readerOutcome: z.string().trim().min(40).max(360).optional(),
  reviewedBy: z
    .object({
      name: z.string().trim().min(3).max(140),
      role: z.string().trim().min(3).max(140)
    })
    .optional(),
  editorialMethod: z.string().trim().min(40).max(700).optional(),
  definitions: z
    .array(z.object({ term: z.string().trim().min(2).max(100), definition: z.string().trim().min(30).max(500) }))
    .max(8)
    .optional(),
  visualBrief: z
    .object({
      storyThesis: z.string().trim().min(30).max(500),
      sceneConcept: z.string().trim().min(50).max(1000),
      factualAnchors: z.array(z.string().trim().min(15).max(320)).min(2).max(6),
      avoid: z.array(z.string().trim().min(10).max(240)).min(3).max(8)
    })
    .optional(),
  relatedTools: z.array(internalLinkSchema).min(1).max(8),
  relatedServices: z.array(internalLinkSchema).min(1).max(8),
  takeaways: z.array(z.string().trim().min(20).max(500)).min(3).max(12),
  sections: z
    .array(
      z.object({
        heading: z.string().trim().min(5).max(180),
        body: z.string().trim().min(80).max(5000),
        bullets: z.array(z.string().trim().min(10).max(700)).min(2).max(15).optional(),
        sourceUrls: z.array(z.string().trim().url().max(1000)).max(4).optional()
      })
    )
    .min(3)
    .max(20),
  checklist: z.array(z.string().trim().min(12).max(500)).min(5).max(20),
  questions: z
    .array(
      z.object({
        question: z.string().trim().min(10).max(240),
        answer: z.string().trim().min(30).max(1200),
        sourceUrls: z.array(z.string().trim().url().max(1000)).max(4).optional()
      })
    )
    .min(3)
    .max(15),
  sources: z.array(sourceLinkSchema).min(1).max(15)
});

export type ContentPostRecord = {
  id: string;
  slug: string;
  title: string;
  status: ContentPostStatus;
  content: BlogPost;
  sourceUrl: string;
  createdBy: string;
  approvedBy: string;
  approvedAt: string;
  publishedAt: string;
  qualityScore: number | null;
  createdAt: string;
  updatedAt: string;
  revisions: {
    id: string;
    version: number;
    action: string;
    actor: string;
    createdAt: string;
  }[];
};

export type ContentPostListResult = {
  counts: Record<ContentPostStatus, number>;
  page: number;
  pageSize: number;
  posts: ContentPostRecord[];
  total: number;
  totalPages: number;
};

function inputJson(value: unknown) {
  return value as Prisma.InputJsonValue;
}

function parseStatus(value: string): ContentPostStatus {
  return contentPostStatuses.includes(value as ContentPostStatus) ? (value as ContentPostStatus) : "draft";
}

function parsePost(value: unknown) {
  return blogPostSchema.parse(value) as BlogPost;
}

function mapContentPost(record: {
  id: string;
  slug: string;
  title: string;
  status: string;
  content: unknown;
  sourceUrl: string | null;
  createdBy: string | null;
  approvedBy: string | null;
  approvedAt: Date | null;
  publishedAt: Date | null;
  qualityScore?: number | null;
  createdAt: Date;
  updatedAt: Date;
  revisions?: { id: string; version: number; action: string; actor: string | null; createdAt: Date }[];
}): ContentPostRecord {
  return {
    id: record.id,
    slug: record.slug,
    title: record.title,
    status: parseStatus(record.status),
    content: parsePost(record.content),
    sourceUrl: record.sourceUrl || "",
    createdBy: record.createdBy || "",
    approvedBy: record.approvedBy || "",
    approvedAt: record.approvedAt?.toISOString() || "",
    publishedAt: record.publishedAt?.toISOString() || "",
    qualityScore: record.qualityScore ?? null,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
    revisions: (record.revisions || []).map((revision) => ({
      id: revision.id,
      version: revision.version,
      action: revision.action,
      actor: revision.actor || "",
      createdAt: revision.createdAt.toISOString()
    }))
  };
}

async function addRevision(postId: string, content: BlogPost, action: string, actor: string) {
  const prisma = getPrismaClient();
  const latest = await prisma.contentRevision.findFirst({ where: { postId }, orderBy: { version: "desc" }, select: { version: true } });
  await prisma.contentRevision.create({
    data: {
      postId,
      version: (latest?.version || 0) + 1,
      action,
      actor,
      content: inputJson(content)
    }
  });
}

export function publicationIssues(post: BlogPost) {
  const issues: string[] = [];
  const allText = [post.description, post.excerpt, post.answer, ...post.sections.flatMap((section) => [section.heading, section.body, ...(section.bullets || [])])].join(" ");
  if (/draft required|replace this|todo|placeholder/i.test(allText)) issues.push("Replace all draft placeholders.");
  if (post.metaTitle.length > 60) issues.push("Keep the meta title at 60 characters or fewer.");
  if (post.description.length > 160) issues.push("Keep the meta description at 160 characters or fewer.");
  if (post.sections.length < 3) issues.push("Add at least three substantive sections.");
  if (post.sources.length < 1) issues.push("Add at least one authoritative source.");
  if (!post.sources.some((source) => isTrustedEditorialUrl(source.url))) issues.push("Add at least one approved authoritative source.");
  if (post.sources.some((source) => !isTrustedEditorialUrl(source.url))) issues.push("Remove research sources outside the approved authority list.");
  const headings = post.sections.map((section) => section.heading.trim().toLowerCase());
  if (new Set(headings).size !== headings.length) issues.push("Use a unique, decision-focused heading for every section.");
  if (post.contentVersion === 2) {
    const articleWords = allText.split(/\s+/).filter(Boolean).length;
    const minimumWords = post.contentType === "resource" ? 700 : 900;
    if (articleWords < minimumWords) issues.push(`Add original technical analysis; this format requires at least ${minimumWords} useful words.`);
    if (post.sections.length < 5) issues.push("Add at least five substantive sections covering the decision from answer to validation.");
    if (post.answer.length < 100) issues.push("Make the answer-first block specific enough to stand alone in search and AI results.");
    if (!post.readerOutcome) issues.push("State the practical reader outcome.");
    if (!post.reviewedBy) issues.push("Name the technical review team.");
    if (!post.editorialMethod) issues.push("Disclose the editorial research and review method.");
    if (!post.definitions || post.definitions.length < 2) issues.push("Define at least two important entities or technical terms.");
    if (!post.visualBrief) issues.push("Add a factual, topic-specific visual brief.");
    if ((post.visualBrief?.factualAnchors.length || 0) < 3) issues.push("Anchor the contextual image to at least three verified facts.");
    if (post.takeaways.length < 3) issues.push("Add at least three decision-useful takeaways.");
    if (post.checklist.length < 6) issues.push("Add at least six actionable checklist steps.");
    if (post.questions.length < 4) issues.push("Answer at least four practical follow-up questions.");
    const sourceSet = new Set(post.sources.map((source) => source.url));
    const citations = [...post.sections, ...post.questions].flatMap((item) => item.sourceUrls || []);
    if (new Set(citations).size < 1) issues.push("Attach primary-source citations to the claims they support.");
    if (citations.some((url) => !sourceSet.has(url))) issues.push("Use only listed research sources for claim-level citations.");
  }
  return issues;
}

function recordPublicationIssues(post: ContentPostRecord) {
  const issues = publicationIssues(post.content);
  if (post.qualityScore !== null && post.qualityScore < 84) {
    issues.push("Regenerate or manually review this article because its editorial quality score is below 84.");
  }
  return issues;
}

export function starterPostFromRadar(draft: RadarDraftInput): BlogPost {
  return buildRadarPublicationPost(draft);
}

export function starterContentPost(kind: "blog" | "resource"): BlogPost {
  const today = new Date().toISOString().slice(0, 10);
  const unique = Date.now().toString(36);
  const label = kind === "resource" ? "Network Operations Resource" : "Network Engineering Article";
  const slug = `new-${kind}-${unique}`;
  return {
    contentType: kind,
    slug,
    title: `New ${label}`,
    metaTitle: `New ${label} | QCS`,
    description: `Draft required: add a concise search description explaining the practical network outcome delivered by this ${kind}.`,
    excerpt: `Draft required: summarize the operational question, the evidence readers need, and the useful next action this ${kind} provides.`,
    answer: `Draft required: give readers a direct, evidence-based answer before expanding into technical context, validation, and next steps.`,
    category: kind === "resource" ? "Network Resource" : "Network Engineering",
    audience: "IT leaders, network engineers, security teams, cloud teams, and managed service providers",
    primaryKeyword: kind === "resource" ? "network operations resource" : "network engineering guide",
    keywords: ["network engineering", "network security", kind === "resource" ? "network resource" : "network guide"],
    publishedAt: today,
    updatedAt: today,
    readTime: "7 min read",
    image: `/resources/${slug}/visual`,
    imageAlt: `Topic-specific QCS ${label.toLowerCase()} visual for practical network and security teams`,
    relatedTools: [{ label: "Network Tools", href: "/network-tools" }],
    relatedServices: [{ label: "Managed Network Services", href: "/services/managed-network-services" }],
    takeaways: [
      "Draft required: state the primary technical or operational finding for the reader.",
      "Draft required: identify the evidence, ownership, and risk that shape the decision.",
      "Draft required: provide a specific next action that can be validated and recorded."
    ],
    sections: ["Short answer", "Why this matters", "Evidence to collect", "Recommended next action"].map((heading) => ({
      heading,
      body: `Draft required: develop ${heading.toLowerCase()} with verified facts, practical network context, accountable ownership, and a clear validation step before publication.`
    })),
    checklist: [
      "Draft required: confirm the scope, affected assets, and accountable owner.",
      "Draft required: collect current configuration, version, and topology evidence.",
      "Draft required: validate the authoritative technical source and publication date.",
      "Draft required: document the controlled change or troubleshooting sequence.",
      "Draft required: record validation results, exceptions, and the next review date."
    ],
    questions: [
      { question: "Draft required: who should use this guidance?", answer: "Draft required: define the intended team, environment, and decision context clearly." },
      { question: "Draft required: what evidence is needed?", answer: "Draft required: list the minimum technical evidence required before action." },
      { question: "Draft required: when should QCS be engaged?", answer: "Draft required: identify the risk, complexity, or ownership conditions that justify escalation." }
    ],
    sources: [{ label: "QCS editorial source placeholder", url: "https://www.qcsstudio.com" }]
  };
}

export async function listContentPosts() {
  const prisma = getPrismaClient();
  const records = await prisma.contentPost.findMany({
    orderBy: { updatedAt: "desc" },
    include: { revisions: { orderBy: { version: "desc" }, take: 8 } }
  });
  return records.map(mapContentPost);
}

export async function searchContentPosts(query: ContentPostListQuery): Promise<ContentPostListResult> {
  const prisma = getPrismaClient();
  const filters: Prisma.ContentPostWhereInput[] = [];
  if (query.status !== "all") filters.push({ status: query.status });
  if (query.format !== "all") {
    filters.push({ content: { path: ["contentType"], equals: query.format } });
  }
  if (query.query) {
    filters.push({
      OR: [
        { title: { contains: query.query, mode: "insensitive" } },
        { slug: { contains: query.query, mode: "insensitive" } },
        { sourceUrl: { contains: query.query, mode: "insensitive" } }
      ]
    });
  }
  const where: Prisma.ContentPostWhereInput = filters.length ? { AND: filters } : {};
  const orderBy: Prisma.ContentPostOrderByWithRelationInput[] =
    query.sort === "updated-asc"
      ? [{ updatedAt: "asc" }]
      : query.sort === "published-desc"
        ? [{ publishedAt: "desc" }, { updatedAt: "desc" }]
        : query.sort === "title-asc"
          ? [{ title: "asc" }]
          : [{ updatedAt: "desc" }];
  const [total, groupedCounts] = await Promise.all([
    prisma.contentPost.count({ where }),
    prisma.contentPost.groupBy({ by: ["status"], _count: { _all: true } })
  ]);
  const totalPages = Math.max(1, Math.ceil(total / query.pageSize));
  const page = Math.min(query.page, totalPages);
  const records = await prisma.contentPost.findMany({
    where,
    orderBy,
    skip: (page - 1) * query.pageSize,
    take: query.pageSize,
    include: { revisions: { orderBy: { version: "desc" }, take: 8 } }
  });
  const counts = emptyContentPostStatusCounts();
  for (const group of groupedCounts) {
    if (contentPostStatuses.includes(group.status as ContentPostStatus)) {
      counts[group.status as ContentPostStatus] = group._count._all;
    }
  }
  return {
    counts,
    page,
    pageSize: query.pageSize,
    posts: records.map(mapContentPost),
    total,
    totalPages
  };
}

export async function importBuiltInContentPosts(actor: string) {
  const prisma = getPrismaClient();
  const existing = await prisma.contentPost.findMany({
    where: { slug: { in: blogPosts.map((post) => post.slug) } },
    select: { slug: true }
  });
  const existingSlugs = new Set(existing.map((post) => post.slug));
  const missing = blogPosts.filter((post) => !existingSlugs.has(post.slug));

  for (const builtInPost of missing) {
    const content = parsePost(builtInPost);
    await prisma.contentPost.create({
      data: {
        slug: content.slug,
        title: content.title,
        status: "published",
        content: inputJson(content),
        sourceUrl: content.sources[0]?.url || "",
        createdBy: "site-library-import",
        approvedBy: actor,
        approvedAt: new Date(),
        publishedAt: new Date(`${content.publishedAt}T00:00:00.000Z`),
        revisions: {
          create: {
            version: 1,
            action: "site_library_imported",
            actor,
            content: inputJson(content)
          }
        }
      }
    });
  }

  return { imported: missing.length, posts: await listContentPosts() };
}

export async function getContentPost(id: string) {
  const prisma = getPrismaClient();
  const record = await prisma.contentPost.findUnique({
    where: { id },
    include: { revisions: { orderBy: { version: "desc" }, take: 20 } }
  });
  return record ? mapContentPost(record) : null;
}

export async function createContentPost(
  contentValue: unknown,
  sourceUrl: string,
  actor: string,
  editorial?: { qualityScore: number; researchTrace: unknown }
) {
  const content = parsePost(contentValue);
  const prisma = getPrismaClient();
  const record = await prisma.contentPost.create({
    data: {
      slug: content.slug,
      title: content.title,
      content: inputJson(content),
      sourceUrl,
      createdBy: actor,
      qualityScore: editorial?.qualityScore,
      researchTrace: editorial ? inputJson(editorial.researchTrace) : undefined
    }
  });
  await addRevision(record.id, content, "created", actor);
  return getContentPost(record.id);
}

function researchSourcesForDraft(draft: RadarDraftInput) {
  const candidates = [
    ...(draft.sourceRole === "authority"
      ? [{ label: draft.sourceName || "Primary technical source", url: draft.sourceUrl, suppliedSummary: draft.sourceSummary }]
      : []),
    ...(draft.supportingSources || []).map((source) => ({
      label: source.label,
      url: source.url,
      suppliedSummary: source.summary
    }))
  ];
  const unique = new Map(candidates.filter((source) => isTrustedEditorialUrl(source.url)).map((source) => [source.url, source]));
  return [...unique.values()].slice(0, 4);
}

export async function createResearchedContentPostFromRadar(draft: RadarDraftInput, actor: string) {
  const sources = researchSourcesForDraft(draft);
  if (!sources.length) throw new Error("This trend needs an approved primary source before it can become an article draft.");
  const researched = await createResearchedBlog({
    slug: draft.slug,
    topic: draft.title,
    businessAngle: draft.businessAngle || draft.answerBlock,
    keywordCluster: draft.keywordCluster || [draft.title],
    internalLinks: draft.internalLinks,
    servicePath: draft.servicePath,
    sources
  });
  return createContentPost(researched.content, sources[0].url, actor, {
    qualityScore: researched.qualityScore,
    researchTrace: researched.trace
  });
}

export async function updateContentPost(id: string, contentValue: unknown, sourceUrl: string, actor: string) {
  const content = parsePost(contentValue);
  const prisma = getPrismaClient();
  const existing = await prisma.contentPost.findUnique({ where: { id } });
  if (!existing) return null;
  assertContentPostAction(parseStatus(existing.status), "save");
  await prisma.contentPost.update({
    where: { id },
    data: {
      slug: content.slug,
      title: content.title,
      content: inputJson(content),
      sourceUrl,
      status: "draft",
      approvedAt: null,
      approvedBy: null,
      publishedAt: null,
      qualityScore: null
    }
  });
  await addRevision(id, content, "updated", actor);
  return getContentPost(id);
}

export async function regenerateRadarContentPost(id: string, actor: string) {
  const existing = await getContentPost(id);
  if (!existing) return null;
  assertContentPostAction(existing.status, "regenerate");
  const source = existing.content.sources[0];
  const primarySourceUrl = existing.sourceUrl || source?.url || "https://www.qcsstudio.com/resources";
  const internalLinks = [
    ...existing.content.relatedServices.map((link) => link.href),
    ...existing.content.relatedTools.map((link) => link.href)
  ];
  const sources = existing.content.sources
    .filter((item) => isTrustedEditorialUrl(item.url))
    .map((item) => ({ label: sourceName(item.url, item.label), url: item.url }));
  if (!sources.length && isTrustedEditorialUrl(primarySourceUrl)) {
    sources.push({ label: sourceName(primarySourceUrl, source?.label), url: primarySourceUrl });
  }
  const researched = await createResearchedBlog({
    slug: existing.content.slug,
    topic: existing.content.title,
    businessAngle: existing.content.answer,
    keywordCluster: existing.content.keywords,
    internalLinks,
    servicePath: existing.content.relatedServices[0]?.href,
    sources
  });
  const content = researched.content;
  const prisma = getPrismaClient();
  await prisma.contentPost.update({
    where: { id },
    data: {
      slug: content.slug,
      title: content.title,
      content: inputJson(content),
      sourceUrl: primarySourceUrl,
      status: "draft",
      approvedAt: null,
      approvedBy: null,
      publishedAt: null,
      qualityScore: researched.qualityScore,
      researchTrace: inputJson(researched.trace)
    }
  });
  await addRevision(id, content, "radar_content_regenerated", actor);
  return getContentPost(id);
}

export async function upgradePublishedContentPost(id: string, actor: string) {
  const existing = await getContentPost(id);
  if (!existing) return null;
  if (existing.status !== "published") throw new Error("Only a published article can be upgraded in place.");
  const sources = existing.content.sources
    .filter((item) => isTrustedEditorialUrl(item.url))
    .map((item) => ({ label: sourceName(item.url, item.label), url: item.url }));
  if (!sources.length) throw new Error("Add an approved primary source before upgrading this article.");
  const internalLinks = [
    ...existing.content.relatedServices.map((link) => link.href),
    ...existing.content.relatedTools.map((link) => link.href)
  ];
  const researched = await createResearchedBlog({
    slug: existing.content.slug,
    topic: existing.content.title,
    businessAngle: existing.content.answer,
    keywordCluster: existing.content.keywords,
    internalLinks,
    servicePath: existing.content.relatedServices[0]?.href,
    sources
  });
  const today = new Date().toISOString().slice(0, 10);
  const content = {
    ...researched.content,
    publishedAt: existing.content.publishedAt,
    updatedAt: today
  };
  const prisma = getPrismaClient();
  await prisma.contentPost.update({
    where: { id },
    data: {
      content: inputJson(content),
      qualityScore: researched.qualityScore,
      researchTrace: inputJson(researched.trace),
      sourceUrl: sources[0].url,
      title: content.title
    }
  });
  await addRevision(id, content, "seo_aeo_content_upgraded", actor);
  return getContentPost(id);
}

function sourceName(url: string, current?: string) {
  if (current && !/^primary (source|technical source)$/i.test(current)) return current;
  if (/sec\.cloudapps\.cisco\.com/i.test(url)) return "Cisco PSIRT Security Advisory";
  if (/fortiguard\.fortinet\.com/i.test(url)) return "Fortinet PSIRT Advisory";
  if (/security\.paloaltonetworks\.com/i.test(url)) return "Palo Alto Networks Security Advisory";
  if (/supportportal\.juniper\.net|mist\.com/i.test(url)) return "Juniper Security Advisory";
  if (/cisa\.gov/i.test(url)) return "CISA Cybersecurity Guidance";
  if (/cert-in\.org\.in/i.test(url)) return "CERT-In Advisory";
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "Primary technical source";
  }
}

export async function getAutomatedPostForUtcDate(date: string, actor = "content-radar-cron") {
  const start = new Date(`${date}T00:00:00.000Z`);
  const end = new Date(start.getTime() + 86_400_000);
  const record = await getPrismaClient().contentPost.findFirst({
    where: { createdBy: actor, createdAt: { gte: start, lt: end }, status: { notIn: ["deleted", "archived"] } },
    orderBy: { createdAt: "desc" },
    select: { id: true }
  });
  return record ? getContentPost(record.id) : null;
}

export async function createAutomatedRadarDraft(draft: RadarDraftInput, actor = "content-radar-cron") {
  const prisma = getPrismaClient();
  const existing = await prisma.contentPost.findUnique({ where: { slug: draft.slug }, select: { id: true, status: true } });
  if (existing) {
    return { post: await getContentPost(existing.id), created: false, reason: `slug_${existing.status}` };
  }

  const created = await createResearchedContentPostFromRadar(draft, actor);
  if (!created) throw new Error("The researched article draft could not be created.");
  return { post: created, created: true, reason: "drafted" };
}

export async function approveContentPost(id: string, actor: string) {
  const prisma = getPrismaClient();
  const existing = await getContentPost(id);
  if (!existing) return null;
  assertContentPostAction(existing.status, "approve");
  const issues = recordPublicationIssues(existing);
  if (issues.length) throw new Error(issues.join(" "));
  await prisma.contentPost.update({
    where: { id },
    data: { status: "approved", approvedAt: new Date(), approvedBy: actor }
  });
  await addRevision(id, existing.content, "approved", actor);
  return getContentPost(id);
}

export async function publishContentPost(id: string, actor: string) {
  const prisma = getPrismaClient();
  const existing = await getContentPost(id);
  if (!existing) return null;
  assertContentPostAction(existing.status, "publish");
  const issues = recordPublicationIssues(existing);
  if (issues.length) throw new Error(issues.join(" "));
  const today = new Date().toISOString().slice(0, 10);
  const content = { ...existing.content, publishedAt: existing.content.publishedAt || today, updatedAt: today };
  await prisma.contentPost.update({
    where: { id },
    data: { status: "published", content: inputJson(content), publishedAt: new Date(`${content.publishedAt}T00:00:00Z`) }
  });
  await addRevision(id, content, "published", actor);
  return getContentPost(id);
}

export async function archiveContentPost(id: string, actor: string) {
  const prisma = getPrismaClient();
  const existing = await getContentPost(id);
  if (!existing) return null;
  assertContentPostAction(existing.status, "archive");
  await prisma.contentPost.update({ where: { id }, data: { status: "archived" } });
  await addRevision(id, existing.content, "archived", actor);
  return getContentPost(id);
}

export async function deleteContentPost(id: string, actor: string) {
  const prisma = getPrismaClient();
  const existing = await getContentPost(id);
  if (!existing) return null;
  assertContentPostAction(existing.status, "delete");
  await prisma.contentPost.update({ where: { id }, data: { status: "deleted", approvedAt: null, approvedBy: null, publishedAt: null } });
  await addRevision(id, existing.content, "deleted", actor);
  return getContentPost(id);
}

export async function restoreContentPost(id: string, actor: string) {
  const prisma = getPrismaClient();
  const existing = await getContentPost(id);
  if (!existing) return null;
  assertContentPostAction(existing.status, "restore");
  await prisma.contentPost.update({ where: { id }, data: { status: "draft", approvedAt: null, approvedBy: null, publishedAt: null } });
  await addRevision(id, existing.content, "restored", actor);
  return getContentPost(id);
}

export async function moveContentPostToDraft(id: string, actor: string) {
  const prisma = getPrismaClient();
  const existing = await getContentPost(id);
  if (!existing) return null;
  assertContentPostAction(existing.status, "draft");
  await prisma.contentPost.update({
    where: { id },
    data: { status: "draft", approvedAt: null, approvedBy: null, publishedAt: null }
  });
  await addRevision(id, existing.content, "moved_to_draft", actor);
  return getContentPost(id);
}

export async function getPublishedDatabasePosts() {
  if (process.env.STORE_DRIVER !== "postgres" || !process.env.DATABASE_URL) return [];
  try {
    const records = await getPrismaClient().contentPost.findMany({ where: { status: "published" }, orderBy: { publishedAt: "desc" } });
    return records.flatMap((record) => {
      const parsed = blogPostSchema.safeParse(record.content);
      if (!parsed.success) {
        console.error(`Published content post ${record.id} is invalid.`, parsed.error.flatten());
        return [];
      }
      return [parsed.data as BlogPost];
    });
  } catch (error) {
    console.error("Published database posts are unavailable.", error);
    return [];
  }
}

export async function getAllPublishedBlogPosts() {
  const merged = new Map(blogPosts.map((post) => [post.slug, post]));
  if (process.env.STORE_DRIVER === "postgres" && process.env.DATABASE_URL) {
    try {
      const records = await getPrismaClient().contentPost.findMany({ orderBy: { publishedAt: "desc" } });
      for (const record of records) {
        if (record.status === "archived" || record.status === "deleted") {
          merged.delete(record.slug);
          continue;
        }
        if (record.status !== "published") continue;
        const parsed = blogPostSchema.safeParse(record.content);
        if (parsed.success) merged.set(record.slug, parsed.data as BlogPost);
        else console.error(`Published content post ${record.id} is invalid.`, parsed.error.flatten());
      }
    } catch (error) {
      console.error("Published database posts are unavailable.", error);
    }
  }
  return [...merged.values()].sort((left, right) => right.publishedAt.localeCompare(left.publishedAt));
}

export async function getPublishedBlogPost(slug: string) {
  const posts = await getAllPublishedBlogPosts();
  return posts.find((post) => post.slug === slug);
}
