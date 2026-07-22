import crypto from "node:crypto";
import { isIP } from "node:net";
import { z } from "zod";

export const engagementStatuses = [
  "draft",
  "authorization_pending",
  "authorized",
  "scheduled",
  "active",
  "paused",
  "remediation",
  "closed",
  "cancelled"
] as const;

export const findingStatuses = [
  "open",
  "validated",
  "remediation_in_progress",
  "resolved",
  "retest_requested",
  "closed",
  "accepted_risk",
  "false_positive",
  "duplicate"
] as const;

export const severityLevels = ["critical", "high", "medium", "low", "informational"] as const;

const targetTypes = ["ip", "cidr", "domain", "hostname", "url", "cloud_account", "site", "wireless_ssid", "application"] as const;
const permissionLevels = ["observe", "safe_checks", "controlled_validation", "manual_only"] as const;

const optionalDate = z.preprocess(
  (value) => value === "" || value === null || value === undefined ? undefined : value,
  z.coerce.date().optional()
);

const optionalText = (max: number) => z.string().trim().max(max).optional().default("");

export const engagementCreateSchema = z.object({
  organizationName: z.string().trim().min(2).max(160),
  legalName: optionalText(200),
  primaryContactName: z.string().trim().min(2).max(120),
  primaryContactEmail: z.string().trim().email().max(254),
  countryCode: z.string().trim().toUpperCase().regex(/^[A-Z]{2}$/).optional().or(z.literal("")),
  timezone: z.string().trim().min(3).max(80).default("Asia/Kolkata"),
  title: z.string().trim().min(5).max(180),
  serviceType: z.enum([
    "external_network_vapt",
    "internal_network_vapt",
    "firewall_assurance",
    "cloud_network_assurance",
    "wireless_assessment",
    "configuration_assurance",
    "continuous_validation",
    "web_and_api_vapt"
  ]),
  testMode: z.enum(["passive_review", "safe_checks", "controlled_validation", "manual_only"]).default("safe_checks"),
  riskTier: z.enum(["standard", "elevated", "critical"]).default("standard"),
  scopeSummary: z.string().trim().min(30).max(2000),
  plannedStartAt: optionalDate,
  plannedEndAt: optionalDate,
  emergencyContactName: z.string().trim().min(2).max(120),
  emergencyContactEmail: z.string().trim().email().max(254),
  emergencyContactPhone: optionalText(40),
  rulesOfEngagement: z.object({
    businessHoursOnly: z.boolean().default(false),
    maxRequestsPerSecond: z.number().int().min(1).max(100).default(5),
    sourceIps: z.array(z.string().trim().min(2).max(100)).max(40).default([]),
    prohibitedActions: z.array(z.string().trim().min(3).max(180)).min(1).max(30),
    stopConditions: z.array(z.string().trim().min(3).max(240)).min(1).max(30),
    noExclusionsConfirmed: z.boolean().default(false),
    notes: optionalText(2000)
  })
}).superRefine((value, context) => {
  if (value.plannedStartAt && value.plannedEndAt && value.plannedEndAt <= value.plannedStartAt) {
    context.addIssue({ code: "custom", path: ["plannedEndAt"], message: "The planned end must be after the planned start." });
  }
});

export const scopeTargetSchema = z.object({
  targetType: z.enum(targetTypes),
  value: z.string().trim().min(1).max(500),
  environment: z.enum(["production", "staging", "development", "corporate", "ot", "lab", "other"]).default("production"),
  criticality: z.enum(["critical", "high", "medium", "low"]).default("medium"),
  permission: z.enum(permissionLevels).default("safe_checks"),
  inScope: z.boolean().default(true),
  ownershipConfirmed: z.boolean().default(false),
  notes: optionalText(1000)
}).superRefine((value, context) => {
  if (value.inScope && !value.ownershipConfirmed) {
    context.addIssue({ code: "custom", path: ["ownershipConfirmed"], message: "Ownership must be confirmed for every in-scope target." });
  }
  if (value.targetType === "ip" && !isIP(value.value)) {
    context.addIssue({ code: "custom", path: ["value"], message: "Enter a valid IPv4 or IPv6 address." });
  }
  if (value.targetType === "cidr" && !validCidr(value.value)) {
    context.addIssue({ code: "custom", path: ["value"], message: "Enter a valid IPv4 or IPv6 CIDR block." });
  }
  if (["domain", "hostname"].includes(value.targetType) && !validHostname(value.value)) {
    context.addIssue({ code: "custom", path: ["value"], message: "Enter a valid domain or hostname." });
  }
  if (value.targetType === "url") {
    try {
      const url = new URL(value.value);
      if (!['http:', 'https:'].includes(url.protocol)) throw new Error("protocol");
    } catch {
      context.addIssue({ code: "custom", path: ["value"], message: "Enter a valid HTTP or HTTPS URL." });
    }
  }
});

export const authorizationSchema = z.object({
  approvedByName: z.string().trim().min(2).max(120),
  approvedByEmail: z.string().trim().email().max(254),
  approvedByTitle: optionalText(120),
  authorityConfirmed: z.literal(true, { message: "Confirm that the approver is authorized to permit testing." }),
  validFrom: z.coerce.date(),
  validUntil: z.coerce.date(),
  artifactUrl: z.string().trim().url().max(1200).refine((value) => value.startsWith("https://"), "The authorization artifact must use HTTPS.").optional().or(z.literal("")),
  artifactSha256: z.string().trim().regex(/^[a-fA-F0-9]{64}$/, "Use a 64-character SHA-256 value.").optional().or(z.literal("")),
  notes: optionalText(2000)
}).superRefine((value, context) => {
  if (value.validUntil <= value.validFrom) {
    context.addIssue({ code: "custom", path: ["validUntil"], message: "Authorization must end after it begins." });
  }
  if (value.validUntil.getTime() - value.validFrom.getTime() > 1000 * 60 * 60 * 24 * 90) {
    context.addIssue({ code: "custom", path: ["validUntil"], message: "Authorization windows may not exceed 90 days." });
  }
});

export const findingCreateSchema = z.object({
  assetId: z.string().trim().optional().or(z.literal("")),
  title: z.string().trim().min(8).max(220),
  description: z.string().trim().min(30).max(5000),
  severity: z.enum(severityLevels),
  confidence: z.enum(["unverified", "likely", "validated"]).default("unverified"),
  source: z.enum(["manual", "scanner", "advisory", "configuration", "attack_path", "retest"]).default("manual"),
  sourceReference: optionalText(300),
  advisoryExternalId: optionalText(80),
  cvssScore: z.number().min(0).max(10).nullable().optional(),
  epssScore: z.number().min(0).max(1).nullable().optional(),
  knownExploited: z.boolean().default(false),
  attackPath: optionalText(3000),
  businessImpact: z.string().trim().min(20).max(3000),
  evidenceSummary: optionalText(3000),
  remediation: z.string().trim().min(20).max(5000),
  ownerName: optionalText(120),
  ownerEmail: z.string().trim().email().max(254).optional().or(z.literal("")),
  dueAt: optionalDate
});

export const findingUpdateSchema = z.object({
  status: z.enum(findingStatuses).optional(),
  confidence: z.enum(["unverified", "likely", "validated"]).optional(),
  ownerName: optionalText(120).optional(),
  ownerEmail: z.string().trim().email().max(254).optional().or(z.literal("")),
  dueAt: optionalDate,
  resolutionNote: optionalText(2000),
  exceptionReason: optionalText(2000)
}).superRefine((value, context) => {
  if (["accepted_risk", "false_positive", "duplicate"].includes(value.status || "") && (value.exceptionReason || "").length < 20) {
    context.addIssue({ code: "custom", path: ["exceptionReason"], message: "Exception states require a reason of at least 20 characters." });
  }
  if (["resolved", "closed"].includes(value.status || "") && (value.resolutionNote || "").length < 20) {
    context.addIssue({ code: "custom", path: ["resolutionNote"], message: "Resolved findings require a resolution note of at least 20 characters." });
  }
});

export const engagementActionSchema = z.object({
  action: z.enum(["schedule", "start", "pause", "resume", "remediation", "close", "cancel"]),
  reason: optionalText(1000)
});

export type ScopeHashTarget = {
  targetType: string;
  value: string;
  environment: string;
  criticality: string;
  permission: string;
  inScope: boolean;
  ownershipConfirmed: boolean;
};

function validHostname(value: string) {
  const hostname = value.toLowerCase().replace(/\.$/, "");
  if (hostname.length > 253 || !hostname.includes(".")) return false;
  return hostname.split(".").every((label) => /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i.test(label));
}

function validCidr(value: string) {
  const [address, prefix, ...rest] = value.split("/");
  if (rest.length || prefix === undefined) return false;
  const version = isIP(address);
  if (!version || !/^\d+$/.test(prefix)) return false;
  const size = Number(prefix);
  return size >= 0 && size <= (version === 4 ? 32 : 128);
}

export function normalizeScopeValue(targetType: typeof targetTypes[number], value: string) {
  const trimmed = value.trim();
  if (targetType === "url") {
    const url = new URL(trimmed);
    url.hash = "";
    return url.toString().replace(/\/$/, "");
  }
  if (["domain", "hostname"].includes(targetType)) return trimmed.toLowerCase().replace(/\.$/, "");
  return trimmed;
}

export function scopeHash(targets: ScopeHashTarget[]) {
  const canonical = targets
    .map((target) => ({
      targetType: target.targetType,
      value: target.value,
      environment: target.environment,
      criticality: target.criticality,
      permission: target.permission,
      inScope: target.inScope,
      ownershipConfirmed: target.ownershipConfirmed
    }))
    .sort((left, right) => `${left.targetType}:${left.value}`.localeCompare(`${right.targetType}:${right.value}`));
  return crypto.createHash("sha256").update(JSON.stringify(canonical)).digest("hex");
}

export function findingFingerprint(input: { workspaceId: string; assetId?: string; title: string; source: string; sourceReference?: string }) {
  return crypto
    .createHash("sha256")
    .update([input.workspaceId, input.assetId || "unassigned", input.source, input.sourceReference || "", input.title.toLowerCase().replace(/\s+/g, " ").trim()].join("|"))
    .digest("hex");
}

export function findingRiskScore(input: { severity: string; knownExploited: boolean; epssScore?: number | null; confidence: string; assetCriticality?: string }) {
  const severity = { critical: 70, high: 55, medium: 35, low: 18, informational: 5 }[input.severity] || 0;
  const exploited = input.knownExploited ? 18 : 0;
  const epss = Math.round((input.epssScore || 0) * 10);
  const confidence = { validated: 8, likely: 4, unverified: 0 }[input.confidence] || 0;
  const criticality = { critical: 8, high: 5, medium: 2, low: 0 }[input.assetCriticality || "medium"] || 0;
  return Math.min(100, severity + exploited + epss + confidence + criticality);
}

export function engagementTransition(current: string, action: z.output<typeof engagementActionSchema>["action"]) {
  const transitions: Record<string, Partial<Record<typeof action, string>>> = {
    authorized: { schedule: "scheduled", start: "active", cancel: "cancelled" },
    scheduled: { start: "active", pause: "paused", cancel: "cancelled" },
    active: { pause: "paused", remediation: "remediation", cancel: "cancelled" },
    paused: { resume: "active", remediation: "remediation", cancel: "cancelled" },
    remediation: { close: "closed", cancel: "cancelled" }
  };
  return transitions[current]?.[action] || null;
}
