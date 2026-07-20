import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import {
  AssessmentInput,
  AuditInput,
  DashboardSnapshot,
  LeadInput,
  StoredAssessment,
  StoredAuditLog,
  StoredEvent,
  StoredLead,
  StoredResource
} from "@/lib/types";
import { getDeploymentReadiness } from "@/lib/readiness";
import { priorityForScore } from "@/lib/security";

type StoreFile = {
  leads: StoredLead[];
  events: StoredEvent[];
  assessments: StoredAssessment[];
  resources: StoredResource[];
  auditLogs: StoredAuditLog[];
  createdAt: string;
  updatedAt: string;
};

const dataDir = path.join(process.cwd(), "data");
const storePath = path.join(dataDir, "store.json");

function isPostgresStore() {
  return process.env.STORE_DRIVER === "postgres";
}

function createId(prefix: string) {
  return `${prefix}_${crypto.randomUUID()}`;
}

function blankStore(): StoreFile {
  const now = new Date().toISOString();
  return {
    leads: [],
    events: [],
    assessments: [],
    resources: [],
    auditLogs: [],
    createdAt: now,
    updatedAt: now
  };
}

async function ensureStore() {
  await fs.mkdir(dataDir, { recursive: true });
  try {
    await fs.access(storePath);
  } catch {
    await fs.writeFile(storePath, JSON.stringify(blankStore(), null, 2));
  }
}

async function readStore(): Promise<StoreFile> {
  await ensureStore();
  const file = await fs.readFile(storePath, "utf8");
  return JSON.parse(file) as StoreFile;
}

async function writeStore(store: StoreFile) {
  store.updatedAt = new Date().toISOString();
  await fs.writeFile(storePath, JSON.stringify(store, null, 2));
}

export async function createLead(input: LeadInput, context: { country: string; ipHash: string }) {
  if (isPostgresStore()) {
    const { createLeadPostgres } = await import("@/lib/postgres-store");
    return createLeadPostgres(input, context);
  }

  const now = new Date().toISOString();
  const score = Math.max(0, Math.min(100, input.score ?? 0));
  const lead: StoredLead = {
    id: createId("lead"),
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
    attribution: input.attribution || {},
    consent: input.consent,
    sourceProfile: input.sourceProfile || {},
    country: context.country,
    ipHash: context.ipHash,
    createdAt: now,
    updatedAt: now
  };

  const store = await readStore();
  store.leads.push(lead);
  await writeStore(store);
  return lead;
}

export async function createEvent(
  input: { name: string; sessionId?: string; metadata?: Record<string, unknown>; consent: StoredEvent["consent"] },
  context: { country: string; ipHash: string }
) {
  if (isPostgresStore()) {
    const { createEventPostgres } = await import("@/lib/postgres-store");
    return createEventPostgres(input, context);
  }

  const event: StoredEvent = {
    id: createId("evt"),
    name: input.name,
    sessionId: input.sessionId || "",
    metadata: input.metadata || {},
    consent: input.consent,
    country: context.country,
    ipHash: context.ipHash,
    createdAt: new Date().toISOString()
  };

  const store = await readStore();
  store.events.push(event);
  await writeStore(store);
  return event;
}

export async function createAssessment(input: AssessmentInput, context: { country: string; ipHash: string }) {
  if (isPostgresStore()) {
    const { createAssessmentPostgres } = await import("@/lib/postgres-store");
    return createAssessmentPostgres(input, context);
  }

  const assessment: StoredAssessment = {
    id: createId("asm"),
    tool: input.tool,
    title: input.title,
    pipeline: input.pipeline,
    recommendation: input.recommendation,
    riskLevel: input.riskLevel,
    score: input.score,
    answers: input.answers || {},
    sessionId: input.sessionId || "",
    attribution: input.attribution || {},
    consent:
      input.consent || {
        necessary: true,
        analytics: false,
        marketing: false,
        personalization: false
      },
    country: context.country,
    ipHash: context.ipHash,
    createdAt: new Date().toISOString()
  };

  const store = await readStore();
  store.assessments.push(assessment);
  await writeStore(store);
  return assessment;
}

export async function createResource(
  input: { resource: string; sessionId?: string; attribution?: StoredResource["attribution"]; consent?: StoredResource["consent"] },
  context: { country: string; ipHash: string }
) {
  if (isPostgresStore()) {
    const { createResourcePostgres } = await import("@/lib/postgres-store");
    return createResourcePostgres(input, context);
  }

  const resource: StoredResource = {
    id: createId("res"),
    resource: input.resource,
    sessionId: input.sessionId || "",
    attribution: input.attribution || {},
    consent:
      input.consent || {
        necessary: true,
        analytics: false,
        marketing: false,
        personalization: false
      },
    country: context.country,
    ipHash: context.ipHash,
    createdAt: new Date().toISOString()
  };

  const store = await readStore();
  store.resources.push(resource);
  await writeStore(store);
  return resource;
}

export async function createAuditLog(input: AuditInput, context: { country: string; ipHash: string }) {
  const auditLog: StoredAuditLog = {
    id: createId("audit"),
    action: input.action,
    actor: input.actor || "anonymous",
    target: input.target || "",
    metadata: input.metadata || {},
    country: context.country,
    ipHash: context.ipHash,
    createdAt: new Date().toISOString()
  };

  try {
    if (isPostgresStore()) {
      const { createAuditLogPostgres } = await import("@/lib/postgres-store");
      return await createAuditLogPostgres(input, context);
    }

    const store = await readStore();
    store.auditLogs ||= [];
    store.auditLogs.push(auditLog);
    await writeStore(store);
    return auditLog;
  } catch (error) {
    console.error("Audit log persistence failed.", error);
    return auditLog;
  }
}

export function getEmptyDashboardSnapshot(): DashboardSnapshot {
  const now = new Date().toISOString();
  return {
    totals: { leads: 0, hotLeads: 0, events: 0, assessments: 0, resources: 0, auditLogs: 0, toolRuns: 0 },
    funnel: { sessions: 0, toolRuns: 0, assessments: 0, resources: 0, leads: 0, hotLeads: 0, leadConversionRate: 0 },
    byPipeline: {},
    byCountry: {},
    topUtilityTools: [],
    latestLeads: [],
    latestEvents: [],
    latestAssessments: [],
    latestAuditLogs: [],
    readiness: getDeploymentReadiness(),
    updatedAt: now
  };
}

export async function getDashboardSnapshot(): Promise<DashboardSnapshot> {
  if (isPostgresStore()) {
    const { getDashboardSnapshotPostgres } = await import("@/lib/postgres-store");
    return getDashboardSnapshotPostgres();
  }

  const store = await readStore();
  const byPipeline: Record<string, number> = {};
  const byCountry: Record<string, number> = {};
  const sessions = new Set<string>();
  const utilityToolCounts: Record<string, number> = {};
  const toolRuns = store.events.filter((event) => event.name === "network_tool_run");

  for (const lead of store.leads) {
    byPipeline[lead.pipeline] = (byPipeline[lead.pipeline] || 0) + 1;
    byCountry[lead.country] = (byCountry[lead.country] || 0) + 1;
    if (lead.sessionId) sessions.add(lead.sessionId);
  }

  for (const event of store.events) {
    if (event.sessionId) sessions.add(event.sessionId);
    if (event.name === "network_tool_run") {
      const tool = typeof event.metadata.tool === "string" ? event.metadata.tool : "unknown";
      utilityToolCounts[tool] = (utilityToolCounts[tool] || 0) + 1;
    }
  }

  for (const assessment of store.assessments) {
    if (assessment.sessionId) sessions.add(assessment.sessionId);
  }

  for (const resource of store.resources) {
    if (resource.sessionId) sessions.add(resource.sessionId);
  }

  const sessionCount = sessions.size;
  const leadConversionRate = sessionCount ? Math.round((store.leads.length / sessionCount) * 1000) / 10 : 0;

  return {
    totals: {
      leads: store.leads.length,
      hotLeads: store.leads.filter((lead) => lead.priority === "hot").length,
      events: store.events.length,
      assessments: store.assessments.length,
      resources: store.resources.length,
      auditLogs: (store.auditLogs || []).length,
      toolRuns: toolRuns.length
    },
    funnel: {
      sessions: sessionCount,
      toolRuns: toolRuns.length,
      assessments: store.assessments.length,
      resources: store.resources.length,
      leads: store.leads.length,
      hotLeads: store.leads.filter((lead) => lead.priority === "hot").length,
      leadConversionRate
    },
    byPipeline,
    byCountry,
    topUtilityTools: Object.entries(utilityToolCounts)
      .map(([tool, count]) => ({ tool, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8),
    latestLeads: store.leads.slice(-10).reverse(),
    latestEvents: store.events.slice(-15).reverse(),
    latestAssessments: store.assessments.slice(-10).reverse(),
    latestAuditLogs: (store.auditLogs || []).slice(-10).reverse(),
    readiness: getDeploymentReadiness(),
    updatedAt: store.updatedAt
  };
}

export async function getLeads() {
  if (isPostgresStore()) {
    const { getLeadsPostgres } = await import("@/lib/postgres-store");
    return getLeadsPostgres();
  }

  const store = await readStore();
  return store.leads.slice().reverse();
}

export function leadsToCsv(leads: StoredLead[]) {
  const headers = ["createdAt", "name", "email", "phone", "interest", "pipeline", "score", "priority", "country", "source"];
  const escape = (value: unknown) => {
    const text = String(value ?? "");
    const safeText = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
    return `"${safeText.replace(/"/g, '""')}"`;
  };
  const lines = [headers.join(",")];

  for (const lead of leads) {
    lines.push(
      [
        lead.createdAt,
        lead.name,
        lead.email,
        lead.phone,
        lead.interest,
        lead.pipeline,
        lead.score,
        lead.priority,
        lead.country,
        lead.attribution.source || "direct"
      ]
        .map(escape)
        .join(",")
    );
  }

  return lines.join("\n");
}
