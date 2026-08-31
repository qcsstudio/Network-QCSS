import { Prisma, type SecurityAdvisory } from "@prisma/client";
import type { BlogPost } from "./blog.ts";
import { getPrismaClient } from "./prisma.ts";

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function numericRevision(value: string) {
  return /^\d+$/.test(value) ? Number(value) : null;
}

export function advisoryEditorialSnapshot(advisory: {
  title: string;
  vendor: string;
  summary: string;
  technicalExplanation?: string;
  businessImpact?: string;
  evidenceChecklist?: unknown;
  severity: string;
  cvssScore: number | null;
  priorityScore: number;
  cves: unknown;
  products: unknown;
  affectedVersions: unknown;
  fixedVersions: unknown;
  remediation: string;
  workaround: string | null;
  exploitationStatus: string;
  sourceUrl: string;
  editorialTrace?: unknown;
}) {
  return {
    title: advisory.title,
    vendor: advisory.vendor,
    summary: advisory.summary,
    technicalExplanation: advisory.technicalExplanation || "",
    businessImpact: advisory.businessImpact || "",
    evidenceChecklist: advisory.evidenceChecklist || [],
    severity: advisory.severity,
    cvssScore: advisory.cvssScore,
    priorityScore: advisory.priorityScore,
    cves: advisory.cves,
    products: advisory.products,
    affectedVersions: advisory.affectedVersions,
    fixedVersions: advisory.fixedVersions,
    remediation: advisory.remediation,
    workaround: advisory.workaround,
    exploitationStatus: advisory.exploitationStatus,
    sourceUrl: advisory.sourceUrl,
    editorialTrace: advisory.editorialTrace || null
  };
}

export function advisoryRevisionPayload(sourcePayload: unknown, advisory: Parameters<typeof advisoryEditorialSnapshot>[0]) {
  return {
    sourcePayload,
    editorialSnapshot: advisoryEditorialSnapshot(advisory)
  } as Prisma.InputJsonValue;
}

function snapshotFromPayload(value: unknown) {
  const payload = record(value);
  if (!payload) return null;
  return record(payload.editorialSnapshot) || record(payload.content);
}

export async function resolveContentPostRevision(contentId: string, contentRevision: string) {
  const prisma = getPrismaClient();
  const source = await prisma.contentPost.findUnique({ where: { id: contentId } });
  if (!source) throw new Error("The source article no longer exists.");
  const version = numericRevision(contentRevision);
  const revision = version === null
    ? null
    : await prisma.contentRevision.findUnique({ where: { postId_version: { postId: contentId, version } } });
  const content = (revision?.content || source.content) as unknown as BlogPost;
  return {
    content,
    frozen: Boolean(revision),
    slug: content.slug || source.slug,
    source,
    title: content.title || source.title
  };
}

export async function resolveSecurityAdvisoryRevision(contentId: string, contentRevision: string) {
  const prisma = getPrismaClient();
  const source = await prisma.securityAdvisory.findUnique({ where: { id: contentId } });
  if (!source) throw new Error("The source security advisory no longer exists.");
  const version = numericRevision(contentRevision);
  const revision = version === null
    ? null
    : await prisma.securityAdvisoryRevision.findUnique({ where: { advisoryId_version: { advisoryId: contentId, version } } });
  const snapshot = snapshotFromPayload(revision?.payload);
  if (!snapshot) return { advisory: source, frozen: false, source };
  return {
    advisory: {
      ...source,
      ...snapshot,
      editorialTrace: (snapshot.editorialTrace ?? source.editorialTrace) as Prisma.JsonValue | null
    } as SecurityAdvisory,
    frozen: true,
    source
  };
}
