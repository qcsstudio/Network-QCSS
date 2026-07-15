export type JsonRecord = Record<string, unknown>;

export type ConsentState = {
  necessary: boolean;
  analytics: boolean;
  marketing: boolean;
  personalization: boolean;
  contact?: boolean;
};

export type Attribution = {
  source?: string;
  medium?: string;
  campaign?: string;
  content?: string;
  term?: string;
  landing?: string;
  referrer?: string;
};

export type LeadInput = {
  name: string;
  email: string;
  phone: string;
  interest: string;
  challenge?: string;
  pipeline?: string;
  score?: number;
  sessionId?: string;
  attribution?: Attribution;
  consent: ConsentState;
  sourceProfile?: JsonRecord;
};

export type StoredLead = Required<Pick<LeadInput, "name" | "email" | "phone" | "interest" | "consent">> & {
  id: string;
  challenge: string;
  pipeline: string;
  score: number;
  priority: "hot" | "warm" | "nurture" | "low";
  stage: string;
  sessionId: string;
  attribution: Attribution;
  sourceProfile: JsonRecord;
  country: string;
  ipHash: string;
  createdAt: string;
  updatedAt: string;
};

export type StoredEvent = {
  id: string;
  name: string;
  sessionId: string;
  metadata: JsonRecord;
  consent: ConsentState;
  country: string;
  ipHash: string;
  createdAt: string;
};

export type AssessmentInput = {
  tool: string;
  title: string;
  pipeline: string;
  recommendation: string;
  riskLevel: string;
  score: number;
  answers?: JsonRecord;
  sessionId?: string;
  attribution?: Attribution;
  consent?: ConsentState;
};

export type StoredAssessment = Required<Pick<AssessmentInput, "tool" | "title" | "pipeline" | "recommendation" | "riskLevel" | "score">> & {
  id: string;
  answers: JsonRecord;
  sessionId: string;
  attribution: Attribution;
  consent: ConsentState;
  country: string;
  ipHash: string;
  createdAt: string;
};

export type StoredResource = {
  id: string;
  resource: string;
  sessionId: string;
  attribution: Attribution;
  consent: ConsentState;
  country: string;
  ipHash: string;
  createdAt: string;
};

export type AuditInput = {
  action: string;
  actor?: string;
  target?: string;
  metadata?: JsonRecord;
};

export type StoredAuditLog = {
  id: string;
  action: string;
  actor: string;
  target: string;
  metadata: JsonRecord;
  country: string;
  ipHash: string;
  createdAt: string;
};

export type ReadinessStatus = "ready" | "warning" | "missing";

export type ReadinessItem = {
  key: string;
  label: string;
  status: ReadinessStatus;
  detail: string;
  required: boolean;
};

export type ReadinessGroup = {
  key: string;
  label: string;
  items: ReadinessItem[];
};

export type DeploymentReadiness = {
  score: number;
  ready: number;
  total: number;
  blockers: number;
  groups: ReadinessGroup[];
  updatedAt: string;
};

export type DashboardSnapshot = {
  totals: {
    leads: number;
    hotLeads: number;
    events: number;
    assessments: number;
    resources: number;
    auditLogs: number;
    toolRuns: number;
  };
  funnel: {
    sessions: number;
    toolRuns: number;
    assessments: number;
    resources: number;
    leads: number;
    hotLeads: number;
    leadConversionRate: number;
  };
  byPipeline: Record<string, number>;
  byCountry: Record<string, number>;
  topUtilityTools: { tool: string; count: number }[];
  latestLeads: StoredLead[];
  latestEvents: StoredEvent[];
  latestAssessments: StoredAssessment[];
  latestAuditLogs: StoredAuditLog[];
  readiness: DeploymentReadiness;
  updatedAt: string;
};
