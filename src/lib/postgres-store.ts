import type { Prisma } from "@prisma/client";
import { getPrismaClient } from "@/lib/prisma";
import { priorityForScore } from "@/lib/security";
import {
  AssessmentInput,
  Attribution,
  ConsentState,
  DashboardSnapshot,
  JsonRecord,
  LeadInput,
  StoredAssessment,
  StoredEvent,
  StoredLead,
  StoredResource
} from "@/lib/types";

const defaultConsent: ConsentState = {
  necessary: true,
  analytics: false,
  marketing: false,
  personalization: false
};

function asRecord(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as JsonRecord) : {};
}

function asAttribution(value: unknown): Attribution {
  return asRecord(value) as Attribution;
}

function asConsent(value: unknown): ConsentState {
  return { ...defaultConsent, ...asRecord(value) } as ConsentState;
}

function inputJson(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

function iso(value: Date | string | null | undefined) {
  if (!value) return new Date().toISOString();
  return value instanceof Date ? value.toISOString() : value;
}

function mapLead(record: {
  id: string;
  name: string;
  email: string;
  phone: string;
  interest: string;
  challenge: string | null;
  pipeline: string;
  score: number;
  priority: string;
  stage: string;
  sessionId: string | null;
  country: string | null;
  ipHash: string | null;
  attribution: unknown;
  consent: unknown;
  sourceProfile: unknown;
  createdAt: Date;
  updatedAt: Date;
}): StoredLead {
  return {
    id: record.id,
    name: record.name,
    email: record.email,
    phone: record.phone,
    interest: record.interest,
    challenge: record.challenge || "",
    pipeline: record.pipeline,
    score: record.score,
    priority: priorityForScore(record.score),
    stage: record.stage,
    sessionId: record.sessionId || "",
    attribution: asAttribution(record.attribution),
    consent: asConsent(record.consent),
    sourceProfile: asRecord(record.sourceProfile),
    country: record.country || "Unknown",
    ipHash: record.ipHash || "",
    createdAt: iso(record.createdAt),
    updatedAt: iso(record.updatedAt)
  };
}

function mapEvent(record: {
  id: string;
  name: string;
  sessionId: string | null;
  metadata: unknown;
  consent: unknown;
  country: string | null;
  ipHash: string | null;
  createdAt: Date;
}): StoredEvent {
  return {
    id: record.id,
    name: record.name,
    sessionId: record.sessionId || "",
    metadata: asRecord(record.metadata),
    consent: asConsent(record.consent),
    country: record.country || "Unknown",
    ipHash: record.ipHash || "",
    createdAt: iso(record.createdAt)
  };
}

function mapAssessment(record: {
  id: string;
  tool: string;
  title: string;
  pipeline: string;
  recommendation: string;
  riskLevel: string;
  score: number;
  answers: unknown;
  sessionId: string | null;
  attribution: unknown;
  consent: unknown;
  country: string | null;
  ipHash: string | null;
  createdAt: Date;
}): StoredAssessment {
  return {
    id: record.id,
    tool: record.tool,
    title: record.title,
    pipeline: record.pipeline,
    recommendation: record.recommendation,
    riskLevel: record.riskLevel,
    score: record.score,
    answers: asRecord(record.answers),
    sessionId: record.sessionId || "",
    attribution: asAttribution(record.attribution),
    consent: asConsent(record.consent),
    country: record.country || "Unknown",
    ipHash: record.ipHash || "",
    createdAt: iso(record.createdAt)
  };
}

export async function createLeadPostgres(input: LeadInput, context: { country: string; ipHash: string }) {
  const prisma = getPrismaClient();
  const score = Math.max(0, Math.min(100, input.score ?? 0));
  const record = await prisma.lead.create({
    data: {
      name: input.name,
      email: input.email.toLowerCase(),
      phone: input.phone,
      interest: input.interest,
      challenge: input.challenge || "",
      pipeline: input.pipeline || input.interest || "Unassigned",
      score,
      priority: priorityForScore(score),
      stage: "new",
      sessionId: input.sessionId || "",
      attribution: inputJson(input.attribution || {}),
      consent: inputJson(input.consent),
      sourceProfile: inputJson(input.sourceProfile || {}),
      country: context.country,
      ipHash: context.ipHash
    }
  });

  return mapLead(record);
}

export async function createEventPostgres(
  input: { name: string; sessionId?: string; metadata?: Record<string, unknown>; consent: StoredEvent["consent"] },
  context: { country: string; ipHash: string }
) {
  const prisma = getPrismaClient();
  const record = await prisma.interactionEvent.create({
    data: {
      name: input.name,
      sessionId: input.sessionId || "",
      metadata: inputJson(input.metadata || {}),
      consent: inputJson(input.consent),
      country: context.country,
      ipHash: context.ipHash
    }
  });

  return mapEvent(record);
}

export async function createAssessmentPostgres(input: AssessmentInput, context: { country: string; ipHash: string }) {
  const prisma = getPrismaClient();
  const record = await prisma.assessment.create({
    data: {
      tool: input.tool,
      title: input.title,
      pipeline: input.pipeline,
      recommendation: input.recommendation,
      riskLevel: input.riskLevel,
      score: input.score,
      answers: inputJson(input.answers || {}),
      sessionId: input.sessionId || "",
      attribution: inputJson(input.attribution || {}),
      consent: inputJson(input.consent || defaultConsent),
      country: context.country,
      ipHash: context.ipHash
    }
  });

  return mapAssessment(record);
}

export async function createResourcePostgres(
  input: { resource: string; sessionId?: string; attribution?: StoredResource["attribution"]; consent?: StoredResource["consent"] },
  context: { country: string; ipHash: string }
) {
  const prisma = getPrismaClient();
  const record = await prisma.resourceDownload.create({
    data: {
      resource: input.resource,
      sessionId: input.sessionId || "",
      attribution: inputJson(input.attribution || {}),
      consent: inputJson(input.consent || defaultConsent),
      country: context.country,
      ipHash: context.ipHash
    }
  });

  return {
    id: record.id,
    resource: record.resource,
    sessionId: record.sessionId || "",
    attribution: asAttribution(record.attribution),
    consent: asConsent(record.consent),
    country: record.country || "Unknown",
    ipHash: record.ipHash || "",
    createdAt: iso(record.createdAt)
  };
}

export async function getDashboardSnapshotPostgres(): Promise<DashboardSnapshot> {
  const prisma = getPrismaClient();
  const [leadCount, hotLeadCount, eventCount, assessmentCount, resourceCount, pipelineRows, countryRows, leads, events, assessments] =
    await Promise.all([
      prisma.lead.count(),
      prisma.lead.count({ where: { priority: "hot" } }),
      prisma.interactionEvent.count(),
      prisma.assessment.count(),
      prisma.resourceDownload.count(),
      prisma.lead.findMany({ select: { pipeline: true } }),
      prisma.lead.findMany({ select: { country: true } }),
      prisma.lead.findMany({ orderBy: { createdAt: "desc" }, take: 10 }),
      prisma.interactionEvent.findMany({ orderBy: { createdAt: "desc" }, take: 15 }),
      prisma.assessment.findMany({ orderBy: { createdAt: "desc" }, take: 10 })
    ]);

  const byPipeline: Record<string, number> = {};
  for (const row of pipelineRows) byPipeline[row.pipeline] = (byPipeline[row.pipeline] || 0) + 1;

  const byCountry: Record<string, number> = {};
  for (const row of countryRows) {
    const country = row.country || "Unknown";
    byCountry[country] = (byCountry[country] || 0) + 1;
  }

  return {
    totals: {
      leads: leadCount,
      hotLeads: hotLeadCount,
      events: eventCount,
      assessments: assessmentCount,
      resources: resourceCount
    },
    byPipeline,
    byCountry,
    latestLeads: leads.map(mapLead),
    latestEvents: events.map(mapEvent),
    latestAssessments: assessments.map(mapAssessment),
    updatedAt: new Date().toISOString()
  };
}

export async function getLeadsPostgres() {
  const prisma = getPrismaClient();
  const leads = await prisma.lead.findMany({ orderBy: { createdAt: "desc" } });
  return leads.map(mapLead);
}
