import crypto from "node:crypto";
import { z } from "zod";
import {
  capabilityCatalog,
  verifyGridCapabilities,
  type VerifyGridCapability,
  type VerifyGridCapabilityLevel
} from "./verifygrid-catalog.ts";

export { capabilityCatalog, verifyGridCapabilities, type VerifyGridCapability, type VerifyGridCapabilityLevel } from "./verifygrid-catalog.ts";

export const executionJobSchema = z.object({
  capability: z.enum(verifyGridCapabilities),
  targetIds: z.array(z.string().trim().min(1)).min(1).max(50).transform((items) => [...new Set(items)]),
  rationale: z.string().trim().min(20).max(1200),
  requestedStartAt: z.coerce.date(),
  validUntil: z.coerce.date(),
  acknowledgeNonDestructive: z.literal(true, { message: "Confirm the non-destructive execution boundary." })
}).superRefine((value, context) => {
  if (value.validUntil <= value.requestedStartAt) {
    context.addIssue({ code: "custom", path: ["validUntil"], message: "The execution validity window must end after it starts." });
  }
  if (value.validUntil.getTime() - value.requestedStartAt.getTime() > 24 * 60 * 60_000) {
    context.addIssue({ code: "custom", path: ["validUntil"], message: "Execution records may cover no more than 24 hours." });
  }
});

export const executionCancelSchema = z.object({
  reason: z.string().trim().min(20).max(1000)
});

export const reportCreateSchema = z.object({
  reportType: z.enum(["executive", "technical", "retest"])
});

export type ExecutionTarget = {
  id: string;
  targetType: string;
  value: string;
  environment: string;
  criticality: string;
  permission: string;
  inScope: boolean;
  ownershipConfirmed: boolean;
};

export type ExecutionAuthorization = {
  id: string;
  status: string;
  scopeHash: string;
  validFrom: Date;
  validUntil: Date;
  authorityConfirmed: boolean;
};

function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, child]) => [key, canonical(child)]));
  }
  return value;
}

export function canonicalJson(value: unknown) {
  return JSON.stringify(canonical(value));
}

export function sha256Json(value: unknown) {
  return crypto.createHash("sha256").update(canonicalJson(value)).digest("hex");
}

function modeAllows(mode: string, level: VerifyGridCapabilityLevel) {
  if (level === "manual_only") return mode === "manual_only" || mode === "passive_review" || mode === "controlled_validation";
  if (mode === "controlled_validation") return true;
  if (mode === "safe_checks") return level === "observe" || level === "safe_checks";
  if (mode === "passive_review") return level === "observe";
  return false;
}

function permissionAllows(permission: string, level: VerifyGridCapabilityLevel) {
  if (permission === "manual_only") return level === "manual_only";
  if (level === "manual_only") return true;
  const rank: Record<string, number> = { observe: 0, safe_checks: 1, controlled_validation: 2 };
  return (rank[permission] ?? -1) >= (rank[level] ?? 99);
}

export function validateExecutionBoundary(input: {
  engagementStatus: string;
  testMode: string;
  scopeHash: string;
  capability: VerifyGridCapability;
  targets: ExecutionTarget[];
  authorization: ExecutionAuthorization | null;
  requestedStartAt: Date;
  validUntil: Date;
  now?: Date;
}) {
  const now = input.now || new Date();
  const capability = capabilityCatalog[input.capability];
  const blockers: string[] = [];
  if (!["authorized", "scheduled", "active", "paused"].includes(input.engagementStatus)) blockers.push("The engagement is not in an execution-capable state.");
  if (!input.authorization || input.authorization.status !== "active") blockers.push("An active authorization is required.");
  if (input.authorization && input.authorization.scopeHash !== input.scopeHash) blockers.push("The authorization scope hash does not match the current scope.");
  if (input.authorization && !input.authorization.authorityConfirmed) blockers.push("The authorization does not confirm approver authority.");
  if (input.authorization && (input.authorization.validFrom > now || input.authorization.validUntil < now)) blockers.push("The authorization is not active at the current time.");
  if (input.authorization && input.requestedStartAt < input.authorization.validFrom) blockers.push("The requested start is before the authorization window.");
  if (input.authorization && input.validUntil > input.authorization.validUntil) blockers.push("The requested validity extends beyond authorization.");
  if (!modeAllows(input.testMode, capability.level)) blockers.push(`The ${input.testMode} engagement mode does not permit ${capability.level} capability records.`);
  if (!input.targets.length) blockers.push("Select at least one target.");
  if (input.targets.some((target) => !target.inScope || !target.ownershipConfirmed)) blockers.push("Every selected target must be in scope with confirmed ownership.");
  if (input.targets.some((target) => !permissionAllows(target.permission, capability.level))) blockers.push("One or more target permissions do not allow this capability level.");
  return { allowed: blockers.length === 0, blockers, capability };
}

export function buildExecutionManifest(input: {
  engagementId: string;
  engagementReference: string;
  workspaceId: string;
  scopeHash: string;
  authorization: ExecutionAuthorization;
  capability: VerifyGridCapability;
  targets: ExecutionTarget[];
  rationale: string;
  requestedStartAt: Date;
  validUntil: Date;
  maxRequestsPerSecond: number;
  prohibitedActions: string[];
  stopConditions: string[];
}) {
  const capability = capabilityCatalog[input.capability];
  const manifest = {
    schema: "qcs.verifygrid.execution-manifest.v1",
    engagement: {
      id: input.engagementId,
      reference: input.engagementReference,
      workspaceId: input.workspaceId,
      scopeHash: input.scopeHash
    },
    authorization: {
      id: input.authorization.id,
      scopeHash: input.authorization.scopeHash,
      validFrom: input.authorization.validFrom.toISOString(),
      validUntil: input.authorization.validUntil.toISOString()
    },
    capability: {
      id: input.capability,
      level: capability.level,
      humanApprovalRequired: capability.humanApprovalRequired
    },
    targets: input.targets.map((target) => ({
      id: target.id,
      type: target.targetType,
      value: target.value,
      environment: target.environment,
      criticality: target.criticality,
      permission: target.permission
    })).sort((left, right) => left.id.localeCompare(right.id)),
    controls: {
      nonDestructive: true,
      persistenceAllowed: false,
      credentialHarvestingAllowed: false,
      denialOfServiceAllowed: false,
      thirdPartyTargetsAllowed: false,
      maxRequestsPerSecond: input.maxRequestsPerSecond,
      requestedStartAt: input.requestedStartAt.toISOString(),
      validUntil: input.validUntil.toISOString(),
      prohibitedActions: [...new Set(input.prohibitedActions)].sort(),
      stopConditions: [...new Set(input.stopConditions)].sort(),
      dispatchPolicy: capability.humanApprovalRequired ? "manual_review_only" : "outbound_sensor_only"
    },
    rationale: input.rationale
  };
  return { manifest, manifestSha256: sha256Json(manifest), capability };
}
