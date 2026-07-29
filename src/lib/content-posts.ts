import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { blogPosts, type BlogPost } from "@/lib/blog";
import { buildRadarPublicationPost, type RadarDraftInput } from "@/lib/content-radar-domain";
import { getPrismaClient } from "@/lib/prisma";

export type { RadarDraftInput } from "@/lib/content-radar-domain";

export const contentPostStatuses = ["draft", "approved", "published", "archived", "deleted"] as const;
export type ContentPostStatus = (typeof contentPostStatuses)[number];

const internalLinkSchema = z.object({
  label: z.string().trim().min(2).max(140),
  href: z.string().trim().min(1).max(500).refine((value) => value.startsWith("/"), "Internal links must start with /.")
});

const sourceLinkSchema = z.object({
  label: z.string().trim().min(2).max(180),
  url: z.string().trim().url().max(1000)
});

export const blogPostSchema = z.object({
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
  relatedTools: z.array(internalLinkSchema).min(1).max(8),
  relatedServices: z.array(internalLinkSchema).min(1).max(8),
  takeaways: z.array(z.string().trim().min(20).max(500)).min(3).max(12),
  sections: z
    .array(
      z.object({
        heading: z.string().trim().min(5).max(180),
        body: z.string().trim().min(80).max(5000),
        bullets: z.array(z.string().trim().min(10).max(700)).min(2).max(15).optional()
      })
    )
    .min(3)
    .max(20),
  checklist: z.array(z.string().trim().min(12).max(500)).min(5).max(20),
  questions: z
    .array(
      z.object({
        question: z.string().trim().min(10).max(240),
        answer: z.string().trim().min(30).max(1200)
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

export async function createContentPost(contentValue: unknown, sourceUrl: string, actor: string) {
  const content = parsePost(contentValue);
  const prisma = getPrismaClient();
  const record = await prisma.contentPost.create({
    data: {
      slug: content.slug,
      title: content.title,
      content: inputJson(content),
      sourceUrl,
      createdBy: actor
    }
  });
  await addRevision(record.id, content, "created", actor);
  return getContentPost(record.id);
}

export async function updateContentPost(id: string, contentValue: unknown, sourceUrl: string, actor: string) {
  const content = parsePost(contentValue);
  const prisma = getPrismaClient();
  const existing = await prisma.contentPost.findUnique({ where: { id } });
  if (!existing) return null;
  await prisma.contentPost.update({
    where: { id },
    data: {
      slug: content.slug,
      title: content.title,
      content: inputJson(content),
      sourceUrl,
      status: "draft",
      approvedAt: null,
      approvedBy: null
    }
  });
  await addRevision(id, content, "updated", actor);
  return getContentPost(id);
}

export async function regenerateRadarContentPost(id: string, actor: string) {
  const existing = await getContentPost(id);
  if (!existing) return null;
  const source = existing.content.sources[0];
  const primarySourceUrl = existing.sourceUrl || source?.url || "https://www.qcsstudio.com/resources";
  const internalLinks = [
    ...existing.content.relatedServices.map((link) => link.href),
    ...existing.content.relatedTools.map((link) => link.href)
  ];
  const content = buildRadarPublicationPost({
    title: existing.content.title,
    slug: existing.content.slug,
    metaTitle: existing.content.metaTitle,
    metaDescription: existing.content.description,
    answerBlock: existing.content.answer,
    sections: existing.content.sections.map((section) => section.heading),
    internalLinks,
    sourceUrl: primarySourceUrl,
    sourceName: sourceName(primarySourceUrl, source?.label),
    sourceRole: "authority",
    sourcePublishedAt: existing.content.publishedAt,
    keywordCluster: existing.content.keywords,
    servicePath: existing.content.relatedServices[0]?.href,
    imageRecommendation: existing.content.image
  });
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
      approvedBy: null
    }
  });
  await addRevision(id, content, "radar_content_regenerated", actor);
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
    where: { createdBy: actor, publishedAt: { gte: start, lt: end }, status: "published" },
    orderBy: { publishedAt: "desc" },
    select: { id: true }
  });
  return record ? getContentPost(record.id) : null;
}

export async function publishAutomatedRadarDraft(draft: RadarDraftInput, actor = "content-radar-cron") {
  const prisma = getPrismaClient();
  const existing = await prisma.contentPost.findUnique({ where: { slug: draft.slug }, select: { id: true, status: true } });
  if (existing) {
    return { post: await getContentPost(existing.id), published: false, reason: `slug_${existing.status}` };
  }

  const content = buildRadarPublicationPost(draft);
  const created = await createContentPost(content, absoluteSource(draft.sourceUrl), actor);
  if (!created) throw new Error("The automated article could not be created.");
  await approveContentPost(created.id, actor);
  const published = await publishContentPost(created.id, actor);
  if (!published) throw new Error("The automated article could not be published.");
  return { post: published, published: true, reason: "published" };
}

function absoluteSource(value: string) {
  if (/^https?:\/\//i.test(value)) return value;
  return `https://www.qcsstudio.com${value.startsWith("/") ? value : `/${value}`}`;
}

export async function approveContentPost(id: string, actor: string) {
  const prisma = getPrismaClient();
  const existing = await getContentPost(id);
  if (!existing) return null;
  const issues = publicationIssues(existing.content);
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
  if (existing.status !== "approved") throw new Error("Approve the reviewed post before publishing it.");
  const issues = publicationIssues(existing.content);
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
  await prisma.contentPost.update({ where: { id }, data: { status: "archived" } });
  await addRevision(id, existing.content, "archived", actor);
  return getContentPost(id);
}

export async function deleteContentPost(id: string, actor: string) {
  const prisma = getPrismaClient();
  const existing = await getContentPost(id);
  if (!existing) return null;
  await prisma.contentPost.update({ where: { id }, data: { status: "deleted", approvedAt: null, approvedBy: null } });
  await addRevision(id, existing.content, "deleted", actor);
  return getContentPost(id);
}

export async function restoreContentPost(id: string, actor: string) {
  const prisma = getPrismaClient();
  const existing = await getContentPost(id);
  if (!existing) return null;
  await prisma.contentPost.update({ where: { id }, data: { status: "draft", approvedAt: null, approvedBy: null } });
  await addRevision(id, existing.content, "restored", actor);
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
