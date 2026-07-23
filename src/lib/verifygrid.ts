import crypto from "node:crypto";
import type { Prisma } from "@prisma/client";
import { getPrismaClient } from "@/lib/prisma";
import {
  authorizationSchema,
  engagementActionSchema,
  engagementCreateSchema,
  engagementTransition,
  findingCreateSchema,
  findingFingerprint,
  findingRiskScore,
  findingUpdateSchema,
  normalizeScopeValue,
  scopeHash,
  scopeTargetSchema
} from "@/lib/verifygrid-domain";
import { seedVerifyGridTestPlan, testCaseUpdateSchema } from "@/lib/verifygrid-methodology";

const engagementInclude = {
  workspace: { select: { id: true, slug: true, name: true, primaryContactName: true, primaryContactEmail: true, countryCode: true } },
  scopeTargets: { orderBy: [{ inScope: "desc" as const }, { value: "asc" as const }] },
  authorizations: { orderBy: { authorizedAt: "desc" as const }, take: 5 },
  findings: {
    orderBy: [{ knownExploited: "desc" as const }, { updatedAt: "desc" as const }],
    take: 100,
    include: {
      asset: { select: { id: true, name: true, identifier: true, criticality: true } },
      retests: { orderBy: { requestedAt: "desc" as const }, take: 3 }
    }
  },
  importBatches: { orderBy: { createdAt: "desc" as const }, take: 12 },
  observations: {
    orderBy: [{ knownExploited: "desc" as const }, { createdAt: "desc" as const }],
    take: 60,
    select: {
      id: true,
      batchId: true,
      title: true,
      assetIdentifier: true,
      severity: true,
      confidence: true,
      advisoryExternalId: true,
      epssScore: true,
      knownExploited: true,
      scopeDisposition: true,
      dispositionReason: true,
      promotionStatus: true,
      promotedFindingId: true,
      createdAt: true
    }
  },
  executionJobs: { orderBy: { createdAt: "desc" as const }, take: 20 },
  testCases: { orderBy: [{ category: "asc" as const }, { code: "asc" as const }] },
  reports: { orderBy: { generatedAt: "desc" as const }, take: 20 },
  activities: { orderBy: { createdAt: "desc" as const }, take: 20 }
} satisfies Prisma.VerifyGridEngagementInclude;

type EngagementWithRelations = Prisma.VerifyGridEngagementGetPayload<{ include: typeof engagementInclude }>;

function json(value: unknown) {
  return value as Prisma.InputJsonValue;
}

function record(value: Prisma.JsonValue | null) {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, Prisma.JsonValue> : {};
}

function slugify(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 100) || "client";
}

function reference() {
  return `VG-${new Date().getUTCFullYear()}-${crypto.randomBytes(4).toString("hex").toUpperCase()}`;
}

function currentScopeHash(engagement: Pick<EngagementWithRelations, "scopeTargets">) {
  return scopeHash(engagement.scopeTargets);
}

function authorizationGate(engagement: EngagementWithRelations, at = new Date()) {
  const targets = engagement.scopeTargets;
  const inScope = targets.filter((target) => target.inScope);
  const exclusions = targets.filter((target) => !target.inScope);
  const rules = record(engagement.rulesOfEngagement);
  const authorization = engagement.authorizations.find((item) => item.status === "active");
  const hash = currentScopeHash(engagement);
  const blockers: string[] = [];

  if (!inScope.length) blockers.push("Add at least one in-scope target.");
  if (inScope.some((target) => !target.ownershipConfirmed)) blockers.push("Confirm ownership for every in-scope target.");
  if (!exclusions.length && rules.noExclusionsConfirmed !== true) blockers.push("Add an exclusion or record that no exclusions were provided.");
  if (!authorization) blockers.push("Record written authorization for the current scope.");
  if (authorization && authorization.scopeHash !== hash) blockers.push("The approved scope no longer matches the current target set.");
  if (authorization && authorization.validFrom > at) blockers.push("The authorization window has not started.");
  if (authorization && authorization.validUntil < at) blockers.push("The authorization window has expired.");
  if (authorization && !authorization.authorityConfirmed) blockers.push("The approver's authority has not been confirmed.");

  return {
    executable: blockers.length === 0,
    blockers,
    scopeHash: hash,
    authorization: authorization ? {
      id: authorization.id,
      status: authorization.status,
      approvedByName: authorization.approvedByName,
      approvedByEmail: authorization.approvedByEmail,
      validFrom: authorization.validFrom.toISOString(),
      validUntil: authorization.validUntil.toISOString(),
      authorizedAt: authorization.authorizedAt.toISOString()
    } : null
  };
}

function mapEngagement(engagement: EngagementWithRelations) {
  const gate = authorizationGate(engagement);
  return {
    id: engagement.id,
    reference: engagement.reference,
    title: engagement.title,
    serviceType: engagement.serviceType,
    status: engagement.status,
    testMode: engagement.testMode,
    riskTier: engagement.riskTier,
    scopeSummary: engagement.scopeSummary,
    plannedStartAt: engagement.plannedStartAt?.toISOString() || "",
    plannedEndAt: engagement.plannedEndAt?.toISOString() || "",
    emergencyContactName: engagement.emergencyContactName,
    emergencyContactEmail: engagement.emergencyContactEmail,
    emergencyContactPhone: engagement.emergencyContactPhone || "",
    createdAt: engagement.createdAt.toISOString(),
    updatedAt: engagement.updatedAt.toISOString(),
    workspace: engagement.workspace,
    rulesOfEngagement: record(engagement.rulesOfEngagement),
    gate,
    scopeTargets: engagement.scopeTargets.map((target) => ({
      id: target.id,
      targetType: target.targetType,
      value: target.value,
      environment: target.environment,
      criticality: target.criticality,
      permission: target.permission,
      inScope: target.inScope,
      ownershipConfirmed: target.ownershipConfirmed,
      notes: target.notes || ""
    })),
    findings: engagement.findings.map((finding) => ({
      id: finding.id,
      title: finding.title,
      severity: finding.severity,
      status: finding.status,
      confidence: finding.confidence,
      source: finding.source,
      knownExploited: finding.knownExploited,
      cvssScore: finding.cvssScore,
      epssScore: finding.epssScore,
      businessImpact: finding.businessImpact,
      remediation: finding.remediation,
      ownerName: finding.ownerName || "",
      ownerEmail: finding.ownerEmail || "",
      dueAt: finding.dueAt?.toISOString() || "",
      updatedAt: finding.updatedAt.toISOString(),
      asset: finding.asset,
      riskScore: findingRiskScore({
        severity: finding.severity,
        knownExploited: finding.knownExploited,
        epssScore: finding.epssScore,
        confidence: finding.confidence,
        assetCriticality: finding.asset?.criticality
      }),
      latestRetest: finding.retests[0] ? {
        id: finding.retests[0].id,
        status: finding.retests[0].status,
        requestedAt: finding.retests[0].requestedAt.toISOString(),
        completedAt: finding.retests[0].completedAt?.toISOString() || ""
      } : null
    })).sort((left, right) => right.riskScore - left.riskScore),
    importBatches: engagement.importBatches.map((batch) => ({
      id: batch.id,
      connector: batch.connector,
      format: batch.format,
      status: batch.status,
      fileName: batch.fileName || "",
      contentSha256: batch.contentSha256,
      observationCount: batch.observationCount,
      inScopeCount: batch.inScopeCount,
      outOfScopeCount: batch.outOfScopeCount,
      unmatchedCount: batch.unmatchedCount,
      promotedCount: batch.promotedCount,
      duplicateCount: batch.duplicateCount,
      rejectedCount: batch.rejectedCount,
      enrichmentStatus: batch.enrichmentStatus,
      createdAt: batch.createdAt.toISOString(),
      completedAt: batch.completedAt?.toISOString() || ""
    })),
    observations: engagement.observations.map((observation) => ({
      ...observation,
      createdAt: observation.createdAt.toISOString()
    })),
    executionJobs: engagement.executionJobs.map((job) => ({
      id: job.id,
      capability: job.capability,
      capabilityLevel: job.capabilityLevel,
      status: job.status,
      scopeHash: job.scopeHash,
      targetIds: Array.isArray(job.targetIds) ? job.targetIds.filter((item): item is string => typeof item === "string") : [],
      requestedStartAt: job.requestedStartAt.toISOString(),
      validUntil: job.validUntil.toISOString(),
      maxRequestsPerSecond: job.maxRequestsPerSecond,
      manifestSha256: job.manifestSha256,
      dispatchStatus: job.dispatchStatus,
      sensorId: job.sensorId || "",
      attempt: job.attempt,
      maxAttempts: job.maxAttempts,
      queuedAt: job.queuedAt?.toISOString() || "",
      claimedAt: job.claimedAt?.toISOString() || "",
      leaseUntil: job.leaseUntil?.toISOString() || "",
      startedAt: job.startedAt?.toISOString() || "",
      completedAt: job.completedAt?.toISOString() || "",
      resultBatchId: job.resultBatchId || "",
      approvedBy: job.approvedBy || "",
      approvedAt: job.approvedAt?.toISOString() || "",
      approvalNote: job.approvalNote || "",
      lastError: job.lastError || "",
      cancelledAt: job.cancelledAt?.toISOString() || "",
      createdAt: job.createdAt.toISOString()
    })),
    testCases: engagement.testCases.map((testCase) => ({
      id: testCase.id,
      code: testCase.code,
      standardRef: testCase.standardRef,
      category: testCase.category,
      title: testCase.title,
      objective: testCase.objective,
      executionMode: testCase.executionMode,
      capability: testCase.capability || "",
      status: testCase.status,
      resultSummary: testCase.resultSummary || "",
      assignedTo: testCase.assignedTo || "",
      startedAt: testCase.startedAt?.toISOString() || "",
      completedAt: testCase.completedAt?.toISOString() || "",
      updatedAt: testCase.updatedAt.toISOString()
    })),
    reports: engagement.reports.map((report) => ({
      id: report.id,
      version: report.version,
      reportType: report.reportType,
      status: report.status,
      title: report.title,
      scopeHash: report.scopeHash,
      snapshotSha256: report.snapshotSha256,
      generatedAt: report.generatedAt.toISOString()
    })),
    activities: engagement.activities.map((activity) => ({
      id: activity.id,
      action: activity.action,
      actor: activity.actor || "system",
      metadata: record(activity.metadata),
      createdAt: activity.createdAt.toISOString()
    }))
  };
}

async function getEngagementOrThrow(id: string) {
  const engagement = await getPrismaClient().verifyGridEngagement.findUnique({ where: { id }, include: engagementInclude });
  if (!engagement) throw new Error("VerifyGrid engagement not found.");
  return engagement;
}

export type VerifyGridEngagementRecord = ReturnType<typeof mapEngagement>;

export async function getVerifyGridPortfolio() {
  const prisma = getPrismaClient();
  const [initialEngagements, workspaceCount, openFindingCount, criticalFindingCount, knownExploitedCount, overdueFindingCount, pendingObservationCount, readyJobCount] = await Promise.all([
    prisma.verifyGridEngagement.findMany({ orderBy: { updatedAt: "desc" }, take: 60, include: engagementInclude }),
    prisma.verifyGridWorkspace.count({ where: { status: "active" } }),
    prisma.verifyGridFinding.count({ where: { status: { in: ["open", "validated", "remediation_in_progress", "resolved", "retest_requested"] } } }),
    prisma.verifyGridFinding.count({ where: { severity: "critical", status: { notIn: ["closed", "false_positive", "duplicate"] } } }),
    prisma.verifyGridFinding.count({ where: { knownExploited: true, status: { notIn: ["closed", "false_positive", "duplicate"] } } }),
    prisma.verifyGridFinding.count({ where: { dueAt: { lt: new Date() }, status: { notIn: ["closed", "accepted_risk", "false_positive", "duplicate"] } } }),
    prisma.verifyGridObservation.count({ where: { scopeDisposition: "in_scope", promotionStatus: "pending" } }),
    prisma.verifyGridExecutionJob.count({ where: { status: { in: ["validated", "queued", "claimed", "running", "retry", "manual_approval_required"] } } })
  ]);
  let engagements = initialEngagements;
  const missingTestPlans = engagements.filter((engagement) => engagement.testCases.length === 0);
  if (missingTestPlans.length) {
    await prisma.$transaction(async (tx) => {
      for (const engagement of missingTestPlans) {
        await seedVerifyGridTestPlan(tx, engagement.id, engagement.serviceType);
      }
    });
    engagements = await prisma.verifyGridEngagement.findMany({ orderBy: { updatedAt: "desc" }, take: 60, include: engagementInclude });
  }
  const records = engagements.map(mapEngagement);
  return {
    generatedAt: new Date().toISOString(),
    metrics: {
      workspaces: workspaceCount,
      engagements: records.length,
      authorizationPending: records.filter((item) => item.status === "authorization_pending" || !item.gate.authorization).length,
      executable: records.filter((item) => item.gate.executable).length,
      openFindings: openFindingCount,
      criticalFindings: criticalFindingCount,
      knownExploited: knownExploitedCount,
      overdueFindings: overdueFindingCount,
      pendingObservations: pendingObservationCount,
      preparedJobs: readyJobCount
    },
    engagements: records
  };
}

export type VerifyGridPortfolio = Awaited<ReturnType<typeof getVerifyGridPortfolio>>;

export function getEmptyVerifyGridPortfolio(): VerifyGridPortfolio {
  return {
    generatedAt: new Date().toISOString(),
    metrics: {
      workspaces: 0,
      engagements: 0,
      authorizationPending: 0,
      executable: 0,
      openFindings: 0,
      criticalFindings: 0,
      knownExploited: 0,
      overdueFindings: 0,
      pendingObservations: 0,
      preparedJobs: 0
    },
    engagements: []
  };
}

export async function getVerifyGridEngagement(id: string) {
  return mapEngagement(await getEngagementOrThrow(id));
}

export async function createVerifyGridEngagement(value: unknown, actor: string) {
  const input = engagementCreateSchema.parse(value);
  const prisma = getPrismaClient();
  const baseSlug = slugify(input.organizationName);
  const existing = await prisma.verifyGridWorkspace.findUnique({ where: { slug: baseSlug } });
  const workspaceSlug = existing && existing.name !== input.organizationName
    ? `${baseSlug}-${crypto.createHash("sha256").update(input.primaryContactEmail).digest("hex").slice(0, 6)}`
    : baseSlug;

  const engagement = await prisma.$transaction(async (tx) => {
    const workspace = await tx.verifyGridWorkspace.upsert({
      where: { slug: workspaceSlug },
      update: {
        legalName: input.legalName || null,
        primaryContactName: input.primaryContactName,
        primaryContactEmail: input.primaryContactEmail,
        countryCode: input.countryCode || null,
        timezone: input.timezone,
        status: "active"
      },
      create: {
        slug: workspaceSlug,
        name: input.organizationName,
        legalName: input.legalName || null,
        primaryContactName: input.primaryContactName,
        primaryContactEmail: input.primaryContactEmail,
        countryCode: input.countryCode || null,
        timezone: input.timezone,
        createdBy: actor
      }
    });
    const created = await tx.verifyGridEngagement.create({
      data: {
        workspaceId: workspace.id,
        reference: reference(),
        title: input.title,
        serviceType: input.serviceType,
        testMode: input.testMode,
        riskTier: input.riskTier,
        scopeSummary: input.scopeSummary,
        rulesOfEngagement: json(input.rulesOfEngagement),
        plannedStartAt: input.plannedStartAt || null,
        plannedEndAt: input.plannedEndAt || null,
        emergencyContactName: input.emergencyContactName,
        emergencyContactEmail: input.emergencyContactEmail,
        emergencyContactPhone: input.emergencyContactPhone || null,
        createdBy: actor,
        updatedBy: actor
      }
    });
    await seedVerifyGridTestPlan(tx, created.id, created.serviceType);
    await tx.verifyGridActivity.create({
      data: { workspaceId: workspace.id, engagementId: created.id, action: "engagement.created", actor, metadata: json({ reference: created.reference, serviceType: created.serviceType }) }
    });
    return created;
  });
  return getVerifyGridEngagement(engagement.id);
}

export async function updateVerifyGridTestCase(id: string, value: unknown, actor: string) {
  const input = testCaseUpdateSchema.parse(value);
  const prisma = getPrismaClient();
  const testCase = await prisma.verifyGridTestCase.findUnique({ where: { id }, include: { engagement: true } });
  if (!testCase) throw new Error("VerifyGrid methodology test case not found.");
  const now = new Date();
  await prisma.$transaction([
    prisma.verifyGridTestCase.update({
      where: { id },
      data: {
        status: input.status,
        resultSummary: input.resultSummary || null,
        assignedTo: input.assignedTo || testCase.assignedTo,
        startedAt: input.status === "running" && !testCase.startedAt ? now : testCase.startedAt,
        completedAt: ["passed", "finding", "not_applicable"].includes(input.status) ? now : null,
        updatedBy: actor
      }
    }),
    prisma.verifyGridActivity.create({
      data: {
        workspaceId: testCase.engagement.workspaceId,
        engagementId: testCase.engagementId,
        action: "methodology.test_case_updated",
        actor,
        metadata: json({ testCaseId: id, code: testCase.code, previousStatus: testCase.status, status: input.status })
      }
    })
  ]);
  return getVerifyGridEngagement(testCase.engagementId);
}

async function invalidateAuthorization(tx: Prisma.TransactionClient, engagement: { id: string; workspaceId: string; status: string }, actor: string, reason: string) {
  const mustReview = ["draft", "authorized", "scheduled", "active", "paused"].includes(engagement.status);
  await tx.verifyGridAuthorization.updateMany({
    where: { engagementId: engagement.id, status: "active" },
    data: { status: "revoked", revokedAt: new Date(), revokedBy: actor, revocationReason: reason }
  });
  if (mustReview) {
    await tx.verifyGridEngagement.update({ where: { id: engagement.id }, data: { status: "authorization_pending", updatedBy: actor } });
  }
}

export async function addVerifyGridScopeTarget(id: string, value: unknown, actor: string) {
  const parsed = scopeTargetSchema.parse(value);
  const input = { ...parsed, value: normalizeScopeValue(parsed.targetType, parsed.value) };
  const prisma = getPrismaClient();
  await prisma.$transaction(async (tx) => {
    const engagement = await tx.verifyGridEngagement.findUnique({ where: { id }, select: { id: true, workspaceId: true, status: true } });
    if (!engagement) throw new Error("VerifyGrid engagement not found.");
    if (["closed", "cancelled"].includes(engagement.status)) throw new Error("Closed or cancelled engagements cannot be rescoped.");
    await tx.verifyGridScopeTarget.upsert({
      where: { engagementId_targetType_value: { engagementId: id, targetType: input.targetType, value: input.value } },
      update: {
        environment: input.environment,
        criticality: input.criticality,
        permission: input.permission,
        inScope: input.inScope,
        ownershipConfirmed: input.ownershipConfirmed,
        notes: input.notes || null
      },
      create: { engagementId: id, ...input, notes: input.notes || null, createdBy: actor }
    });
    await invalidateAuthorization(tx, engagement, actor, "Scope target added or changed.");
    await tx.verifyGridActivity.create({
      data: { workspaceId: engagement.workspaceId, engagementId: id, action: "scope.target_upserted", actor, metadata: json({ targetType: input.targetType, value: input.value, inScope: input.inScope, permission: input.permission }) }
    });
  });
  return getVerifyGridEngagement(id);
}

export async function removeVerifyGridScopeTarget(id: string, targetId: string, actor: string) {
  const prisma = getPrismaClient();
  await prisma.$transaction(async (tx) => {
    const engagement = await tx.verifyGridEngagement.findUnique({ where: { id }, select: { id: true, workspaceId: true, status: true } });
    if (!engagement) throw new Error("VerifyGrid engagement not found.");
    if (["closed", "cancelled"].includes(engagement.status)) throw new Error("Closed or cancelled engagements cannot be rescoped.");
    const target = await tx.verifyGridScopeTarget.findFirst({ where: { id: targetId, engagementId: id } });
    if (!target) throw new Error("Scope target not found.");
    await tx.verifyGridScopeTarget.delete({ where: { id: target.id } });
    await invalidateAuthorization(tx, engagement, actor, "Scope target removed.");
    await tx.verifyGridActivity.create({
      data: { workspaceId: engagement.workspaceId, engagementId: id, action: "scope.target_removed", actor, metadata: json({ targetType: target.targetType, value: target.value }) }
    });
  });
  return getVerifyGridEngagement(id);
}

export async function authorizeVerifyGridEngagement(id: string, value: unknown, actor: string) {
  const input = authorizationSchema.parse(value);
  const prisma = getPrismaClient();
  const engagement = await getEngagementOrThrow(id);
  if (["closed", "cancelled"].includes(engagement.status)) throw new Error("Closed or cancelled engagements cannot be authorized.");
  const inScope = engagement.scopeTargets.filter((target) => target.inScope);
  const exclusions = engagement.scopeTargets.filter((target) => !target.inScope);
  const rules = record(engagement.rulesOfEngagement);
  if (!inScope.length) throw new Error("Add at least one in-scope target before authorization.");
  if (inScope.some((target) => !target.ownershipConfirmed)) throw new Error("Confirm ownership for every in-scope target before authorization.");
  if (!exclusions.length && rules.noExclusionsConfirmed !== true) throw new Error("Add an explicit exclusion or record that the client provided no exclusions.");
  const hash = currentScopeHash(engagement);

  await prisma.$transaction(async (tx) => {
    await tx.verifyGridAuthorization.updateMany({
      where: { engagementId: id, status: "active" },
      data: { status: "superseded", revokedAt: new Date(), revokedBy: actor, revocationReason: "A new authorization version was recorded." }
    });
    await tx.verifyGridAuthorization.create({
      data: {
        engagementId: id,
        scopeHash: hash,
        approvedByName: input.approvedByName,
        approvedByEmail: input.approvedByEmail,
        approvedByTitle: input.approvedByTitle || null,
        authorityConfirmed: input.authorityConfirmed,
        validFrom: input.validFrom,
        validUntil: input.validUntil,
        artifactUrl: input.artifactUrl || null,
        artifactSha256: input.artifactSha256?.toLowerCase() || null,
        notes: input.notes || null,
        authorizedBy: actor
      }
    });
    await tx.verifyGridEngagement.update({ where: { id }, data: { status: "authorized", updatedBy: actor } });
    await tx.verifyGridActivity.create({
      data: { workspaceId: engagement.workspaceId, engagementId: id, action: "authorization.recorded", actor, metadata: json({ scopeHash: hash, approvedByEmail: input.approvedByEmail, validFrom: input.validFrom.toISOString(), validUntil: input.validUntil.toISOString() }) }
    });
  });
  return getVerifyGridEngagement(id);
}

export async function transitionVerifyGridEngagement(id: string, value: unknown, actor: string) {
  const input = engagementActionSchema.parse(value);
  const engagement = await getEngagementOrThrow(id);
  const status = engagementTransition(engagement.status, input.action);
  if (!status) throw new Error(`The ${input.action} action is not allowed while this engagement is ${engagement.status}.`);
  if (["schedule", "start", "resume"].includes(input.action)) {
    const gate = authorizationGate(engagement);
    if (!gate.executable) throw new Error(`Authorization gate blocked this action: ${gate.blockers.join(" ")}`);
  }
  const prisma = getPrismaClient();
  await prisma.$transaction([
    prisma.verifyGridEngagement.update({ where: { id }, data: { status, updatedBy: actor } }),
    prisma.verifyGridActivity.create({ data: { workspaceId: engagement.workspaceId, engagementId: id, action: `engagement.${input.action}`, actor, metadata: json({ from: engagement.status, to: status, reason: input.reason || "" }) } })
  ]);
  return getVerifyGridEngagement(id);
}

export async function createVerifyGridFinding(engagementId: string, value: unknown, actor: string) {
  const input = findingCreateSchema.parse(value);
  const engagement = await getEngagementOrThrow(engagementId);
  const assetId = input.assetId || null;
  if (assetId) {
    const asset = await getPrismaClient().verifyGridAsset.findFirst({ where: { id: assetId, workspaceId: engagement.workspaceId } });
    if (!asset) throw new Error("The selected asset does not belong to this client workspace.");
  }
  const fingerprint = findingFingerprint({ workspaceId: engagement.workspaceId, assetId: assetId || undefined, title: input.title, source: input.source, sourceReference: input.sourceReference });
  const prisma = getPrismaClient();
  const finding = await prisma.$transaction(async (tx) => {
    const created = await tx.verifyGridFinding.create({
      data: {
        workspaceId: engagement.workspaceId,
        engagementId,
        assetId,
        fingerprint,
        title: input.title,
        description: input.description,
        severity: input.severity,
        confidence: input.confidence,
        source: input.source,
        sourceReference: input.sourceReference || null,
        advisoryExternalId: input.advisoryExternalId || null,
        cvssScore: input.cvssScore ?? null,
        epssScore: input.epssScore ?? null,
        knownExploited: input.knownExploited,
        attackPath: input.attackPath || null,
        businessImpact: input.businessImpact,
        evidenceSummary: input.evidenceSummary || null,
        remediation: input.remediation,
        ownerName: input.ownerName || null,
        ownerEmail: input.ownerEmail || null,
        dueAt: input.dueAt || null,
        createdBy: actor,
        updatedBy: actor
      }
    });
    await tx.verifyGridActivity.create({
      data: { workspaceId: engagement.workspaceId, engagementId, findingId: created.id, action: "finding.created", actor, metadata: json({ severity: created.severity, source: created.source, fingerprint }) }
    });
    return created;
  });
  return { findingId: finding.id, engagement: await getVerifyGridEngagement(engagementId) };
}

const allowedFindingTransitions: Record<string, string[]> = {
  open: ["validated", "false_positive", "duplicate", "accepted_risk"],
  validated: ["remediation_in_progress", "resolved", "accepted_risk", "false_positive"],
  remediation_in_progress: ["resolved", "accepted_risk"],
  resolved: ["retest_requested", "remediation_in_progress"],
  retest_requested: ["resolved", "remediation_in_progress", "closed"],
  accepted_risk: ["open"],
  false_positive: ["open"],
  duplicate: ["open"]
};

export async function updateVerifyGridFinding(id: string, value: unknown, actor: string) {
  const input = findingUpdateSchema.parse(value);
  const prisma = getPrismaClient();
  const finding = await prisma.verifyGridFinding.findUnique({ where: { id }, include: { retests: { orderBy: { requestedAt: "desc" }, take: 1 } } });
  if (!finding) throw new Error("VerifyGrid finding not found.");
  if (input.status && input.status !== finding.status && !allowedFindingTransitions[finding.status]?.includes(input.status)) {
    throw new Error(`A finding cannot move from ${finding.status} to ${input.status}.`);
  }
  if (input.status === "closed" && finding.retests[0]?.status !== "passed") {
    throw new Error("A validated technical finding can close only after a passed retest.");
  }
  const resolvedAt = input.status === "resolved" || input.status === "closed" ? new Date() : undefined;
  await prisma.$transaction([
    prisma.verifyGridFinding.update({
      where: { id },
      data: {
        status: input.status,
        confidence: input.status === "validated" ? "validated" : input.confidence,
        ownerName: input.ownerName || undefined,
        ownerEmail: input.ownerEmail || undefined,
        dueAt: input.dueAt,
        resolvedAt,
        updatedBy: actor
      }
    }),
    prisma.verifyGridActivity.create({
      data: {
        workspaceId: finding.workspaceId,
        engagementId: finding.engagementId,
        findingId: id,
        action: "finding.updated",
        actor,
        metadata: json({ from: finding.status, to: input.status || finding.status, resolutionNote: input.resolutionNote || "", exceptionReason: input.exceptionReason || "" })
      }
    })
  ]);
  return getVerifyGridEngagement(finding.engagementId);
}

export async function requestVerifyGridRetest(id: string, actor: string) {
  const prisma = getPrismaClient();
  const finding = await prisma.verifyGridFinding.findUnique({ where: { id } });
  if (!finding) throw new Error("VerifyGrid finding not found.");
  if (!["resolved", "remediation_in_progress"].includes(finding.status)) throw new Error("A retest can be requested after remediation has started or the finding is marked resolved.");
  await prisma.$transaction([
    prisma.verifyGridRetest.create({ data: { findingId: id, requestedBy: actor } }),
    prisma.verifyGridFinding.update({ where: { id }, data: { status: "retest_requested", updatedBy: actor } }),
    prisma.verifyGridActivity.create({ data: { workspaceId: finding.workspaceId, engagementId: finding.engagementId, findingId: id, action: "retest.requested", actor } })
  ]);
  return getVerifyGridEngagement(finding.engagementId);
}
