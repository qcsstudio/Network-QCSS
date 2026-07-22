import crypto from "node:crypto";
import type { Prisma } from "@prisma/client";
import { getPrismaClient } from "@/lib/prisma";
import {
  buildExecutionManifest,
  capabilityCatalog,
  executionCancelSchema,
  executionJobSchema,
  reportCreateSchema,
  sha256Json,
  validateExecutionBoundary
} from "@/lib/verifygrid-execution-domain";
import {
  connectorCatalog,
  observationPromotionSchema,
  parseScannerImport,
  reconcileObservationScope,
  scannerImportSchema,
  severityMeetsMinimum,
  type NormalizedObservation
} from "@/lib/verifygrid-import-domain";
import { findingFingerprint, scopeHash } from "@/lib/verifygrid-domain";
import { getVerifyGridEngagement } from "@/lib/verifygrid";
import { fetchNvdEvidence, matchObservationToCpes, type NvdEvidence } from "@/lib/verifygrid-nvd";

function json(value: unknown) {
  return value as Prisma.InputJsonValue;
}

function record(value: Prisma.JsonValue | null | undefined) {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, Prisma.JsonValue> : {};
}

function strings(value: Prisma.JsonValue | null | undefined, key: string) {
  const item = record(value)[key];
  return Array.isArray(item) ? item.filter((entry): entry is string => typeof entry === "string") : [];
}

function contentHash(content: string) {
  return crypto.createHash("sha256").update(content, "utf8").digest("hex");
}

type EnrichmentRecord = { epssScore?: number; epssPercentile?: number; knownExploited?: boolean; nvd?: NvdEvidence };

let kevCache: { expiresAt: number; cves: Set<string> } | null = null;

async function fetchKnownExploited() {
  if (kevCache && kevCache.expiresAt > Date.now()) return kevCache.cves;
  const response = await fetch("https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json", {
    headers: { accept: "application/json", "user-agent": "QCS-VerifyGrid/1.0" },
    cache: "no-store",
    signal: AbortSignal.timeout(8_000)
  });
  if (!response.ok) throw new Error(`CISA KEV returned ${response.status}.`);
  const payload = await response.json() as { vulnerabilities?: Array<{ cveID?: string }> };
  const cves = new Set((payload.vulnerabilities || []).map((item) => item.cveID?.toUpperCase()).filter((item): item is string => Boolean(item)));
  kevCache = { expiresAt: Date.now() + 60 * 60_000, cves };
  return cves;
}

async function fetchEpss(cves: string[]) {
  const results = new Map<string, EnrichmentRecord>();
  for (let index = 0; index < cves.length; index += 75) {
    const chunk = cves.slice(index, index + 75);
    const url = new URL("https://api.first.org/data/v1/epss");
    url.searchParams.set("cve", chunk.join(","));
    const response = await fetch(url, {
      headers: { accept: "application/json", "user-agent": "QCS-VerifyGrid/1.0" },
      cache: "no-store",
      signal: AbortSignal.timeout(8_000)
    });
    if (!response.ok) throw new Error(`FIRST EPSS returned ${response.status}.`);
    const payload = await response.json() as { data?: Array<{ cve?: string; epss?: string; percentile?: string }> };
    for (const item of payload.data || []) {
      if (!item.cve) continue;
      const epssScore = Number(item.epss);
      const epssPercentile = Number(item.percentile);
      results.set(item.cve.toUpperCase(), {
        epssScore: Number.isFinite(epssScore) ? epssScore : undefined,
        epssPercentile: Number.isFinite(epssPercentile) ? epssPercentile : undefined
      });
    }
  }
  return results;
}

async function enrichObservations(observations: NormalizedObservation[]) {
  const cves = [...new Set(observations.map((item) => item.advisoryExternalId).filter((item): item is string => Boolean(item)))];
  if (!cves.length) return { observations, status: "not_applicable", sources: [] as string[] };
  const records = new Map<string, EnrichmentRecord>();
  const sources: string[] = [];
  const errors: string[] = [];
  await Promise.all([
    fetchKnownExploited().then((known) => {
      sources.push("cisa_kev");
      for (const cve of cves) records.set(cve, { ...records.get(cve), knownExploited: known.has(cve) });
    }).catch((error) => errors.push(error instanceof Error ? error.message : "CISA KEV unavailable.")),
    fetchEpss(cves).then((epss) => {
      sources.push("first_epss");
      for (const [cve, value] of epss) records.set(cve, { ...records.get(cve), ...value });
    }).catch((error) => errors.push(error instanceof Error ? error.message : "FIRST EPSS unavailable.")),
    fetchNvdEvidence(cves).then((nvd) => {
      if (nvd.records.size) sources.push("nist_nvd");
      for (const [cve, value] of nvd.records) records.set(cve, { ...records.get(cve), nvd: value });
      errors.push(...nvd.errors);
      if (nvd.truncated) errors.push("NVD enrichment was bounded; remaining CVEs stay eligible for a scheduled enrichment pass.");
    }).catch((error) => errors.push(error instanceof Error ? error.message : "NVD unavailable."))
  ]);
  return {
    observations: observations.map((item) => {
      const enrichment = records.get(item.advisoryExternalId);
      const cpeMatch = enrichment?.nvd ? matchObservationToCpes(item, enrichment.nvd.cpes) : null;
      return enrichment ? {
        ...item,
        cvssScore: item.cvssScore ?? enrichment.nvd?.cvssScore,
        epssScore: enrichment.epssScore ?? item.epssScore,
        epssPercentile: enrichment.epssPercentile ?? item.epssPercentile,
        knownExploited: enrichment.knownExploited ?? item.knownExploited,
        rawMetadata: { ...item.rawMetadata, enrichmentSources: sources, nvd: enrichment.nvd, cpeMatch }
      } : item;
    }),
    status: errors.length ? sources.length ? "partial" : "unavailable" : "complete",
    sources,
    errors
  };
}

export async function importVerifyGridScannerExport(engagementId: string, value: unknown, actor: string) {
  const input = scannerImportSchema.parse(value);
  const prisma = getPrismaClient();
  const engagement = await prisma.verifyGridEngagement.findUnique({
    where: { id: engagementId },
    include: { scopeTargets: true, authorizations: { where: { status: "active" }, orderBy: { authorizedAt: "desc" }, take: 1 } }
  });
  if (!engagement) throw new Error("VerifyGrid engagement not found.");
  if (["closed", "cancelled"].includes(engagement.status)) throw new Error("Scanner evidence cannot be added to a closed or cancelled engagement.");
  const sha256 = contentHash(input.content);
  const duplicate = await prisma.verifyGridImportBatch.findUnique({
    where: { engagementId_connector_contentSha256: { engagementId, connector: input.connector, contentSha256: sha256 } }
  });
  if (duplicate) throw new Error(`This scanner export was already imported as batch ${duplicate.id}.`);

  const parsed = parseScannerImport(input.connector, input.content);
  const enrichment = input.enrich
    ? await enrichObservations(parsed)
    : { observations: parsed, status: "not_requested", sources: [] as string[], errors: [] as string[] };
  const currentHash = scopeHash(engagement.scopeTargets);
  const activeAuthorization = engagement.authorizations.find((item) => item.scopeHash === currentHash);
  const reconciled = enrichment.observations.map((observation) => {
    const scope = reconcileObservationScope(observation.assetIdentifier, engagement.scopeTargets);
    return { observation, scope };
  });
  const counts = reconciled.reduce((result, item) => {
    result[item.scope.disposition] += 1;
    return result;
  }, { in_scope: 0, out_of_scope: 0, unmatched: 0 });

  const batch = await prisma.$transaction(async (tx) => {
    const created = await tx.verifyGridImportBatch.create({
      data: {
        workspaceId: engagement.workspaceId,
        engagementId,
        connector: input.connector,
        format: connectorCatalog[input.connector].format,
        status: "completed",
        fileName: input.fileName,
        contentSha256: sha256,
        scopeHash: currentHash,
        authorizationId: activeAuthorization?.id || null,
        observationCount: reconciled.length,
        inScopeCount: counts.in_scope,
        outOfScopeCount: counts.out_of_scope,
        unmatchedCount: counts.unmatched,
        enrichmentStatus: enrichment.status,
        summary: json({ enrichmentSources: enrichment.sources, enrichmentErrors: enrichment.errors || [] }),
        importedBy: actor,
        completedAt: new Date()
      }
    });
    await tx.verifyGridObservation.createMany({
      data: reconciled.map(({ observation, scope }) => ({
        batchId: created.id,
        workspaceId: engagement.workspaceId,
        engagementId,
        fingerprint: observation.fingerprint,
        assetIdentifier: observation.assetIdentifier,
        assetName: observation.assetName,
        assetKind: observation.assetKind,
        environment: scope.target?.environment || "production",
        assetCriticality: scope.target?.criticality || "medium",
        title: observation.title,
        description: observation.description,
        severity: observation.severity,
        confidence: observation.confidence,
        sourceReference: observation.sourceReference || null,
        advisoryExternalId: observation.advisoryExternalId || null,
        cvssScore: observation.cvssScore,
        epssScore: observation.epssScore,
        epssPercentile: observation.epssPercentile,
        knownExploited: observation.knownExploited,
        port: observation.port,
        protocol: observation.protocol || null,
        service: observation.service || null,
        evidenceSummary: observation.evidenceSummary || null,
        remediation: observation.remediation,
        scopeDisposition: scope.disposition,
        scopeTargetId: scope.target?.id || null,
        dispositionReason: scope.reason,
        rawMetadata: json(observation.rawMetadata),
        firstObservedAt: observation.firstObservedAt,
        lastObservedAt: observation.lastObservedAt
      }))
    });
    await tx.verifyGridActivity.create({
      data: {
        workspaceId: engagement.workspaceId,
        engagementId,
        action: "evidence.import_completed",
        actor,
        metadata: json({ batchId: created.id, connector: input.connector, sha256, observations: reconciled.length, ...counts, enrichmentStatus: enrichment.status })
      }
    });
    return created;
  });
  return { batchId: batch.id, engagement: await getVerifyGridEngagement(engagementId) };
}

function businessImpactFor(observation: { severity: string; assetIdentifier: string; knownExploited: boolean }) {
  const urgency = observation.knownExploited ? "Active exploitation is documented for the referenced vulnerability. " : "";
  return `${urgency}The ${observation.severity} observation affects ${observation.assetIdentifier}. Validate reachability, asset purpose, and compensating controls to determine material operational impact.`;
}

export async function promoteVerifyGridObservations(batchId: string, value: unknown, actor: string) {
  const input = observationPromotionSchema.parse(value);
  const prisma = getPrismaClient();
  const batch = await prisma.verifyGridImportBatch.findUnique({ where: { id: batchId }, include: { observations: true } });
  if (!batch) throw new Error("VerifyGrid import batch not found.");
  const requested = input.observationIds ? new Set(input.observationIds) : null;
  const candidates = batch.observations.filter((observation) =>
    observation.scopeDisposition === "in_scope" &&
    observation.promotionStatus === "pending" &&
    (!requested || requested.has(observation.id)) &&
    severityMeetsMinimum(observation.severity as "critical" | "high" | "medium" | "low" | "informational", input.minimumSeverity) &&
    (input.includeInformational || observation.severity !== "informational")
  );
  if (!candidates.length) throw new Error("No pending in-scope observations match the promotion policy.");

  let promoted = 0;
  let duplicates = 0;
  await prisma.$transaction(async (tx) => {
    for (const observation of candidates) {
      const asset = await tx.verifyGridAsset.upsert({
        where: { workspaceId_identifier: { workspaceId: batch.workspaceId, identifier: observation.assetIdentifier } },
        update: {
          engagementId: batch.engagementId,
          name: observation.assetName,
          kind: observation.assetKind,
          environment: observation.environment,
          criticality: observation.assetCriticality,
          source: batch.connector,
          lastSeenAt: observation.lastObservedAt || new Date()
        },
        create: {
          workspaceId: batch.workspaceId,
          engagementId: batch.engagementId,
          identifier: observation.assetIdentifier,
          name: observation.assetName,
          kind: observation.assetKind,
          environment: observation.environment,
          criticality: observation.assetCriticality,
          exposure: "observed",
          source: batch.connector,
          firstSeenAt: observation.firstObservedAt || new Date(),
          lastSeenAt: observation.lastObservedAt || new Date()
        }
      });
      const fingerprint = findingFingerprint({
        workspaceId: batch.workspaceId,
        assetId: asset.id,
        title: observation.title,
        source: "scanner",
        sourceReference: observation.sourceReference || `${batch.connector}:${observation.fingerprint}`
      });
      const existing = await tx.verifyGridFinding.findUnique({ where: { workspaceId_fingerprint: { workspaceId: batch.workspaceId, fingerprint } } });
      if (existing) {
        await tx.verifyGridFinding.update({
          where: { id: existing.id },
          data: {
            lastObservedAt: observation.lastObservedAt || new Date(),
            knownExploited: existing.knownExploited || observation.knownExploited,
            epssScore: observation.epssScore ?? existing.epssScore,
            cvssScore: observation.cvssScore ?? existing.cvssScore,
            updatedBy: actor
          }
        });
        await tx.verifyGridObservation.update({ where: { id: observation.id }, data: { promotionStatus: "duplicate", promotedFindingId: existing.id } });
        duplicates += 1;
        continue;
      }
      const finding = await tx.verifyGridFinding.create({
        data: {
          workspaceId: batch.workspaceId,
          engagementId: batch.engagementId,
          assetId: asset.id,
          fingerprint,
          title: observation.title,
          description: observation.description,
          severity: observation.severity,
          confidence: observation.confidence,
          source: "scanner",
          sourceReference: observation.sourceReference || `${batch.connector}:${observation.fingerprint}`,
          advisoryExternalId: observation.advisoryExternalId,
          cvssScore: observation.cvssScore,
          epssScore: observation.epssScore,
          knownExploited: observation.knownExploited,
          businessImpact: businessImpactFor(observation),
          evidenceSummary: observation.evidenceSummary,
          remediation: observation.remediation,
          firstDetectedAt: observation.firstObservedAt || new Date(),
          lastObservedAt: observation.lastObservedAt || new Date(),
          createdBy: actor,
          updatedBy: actor
        }
      });
      await tx.verifyGridEvidence.create({
        data: {
          findingId: finding.id,
          evidenceType: "scanner_observation",
          title: `${connectorCatalog[batch.connector as keyof typeof connectorCatalog]?.label || batch.connector} observation`,
          summary: observation.evidenceSummary || observation.description,
          sha256: sha256Json({ batchId, observationId: observation.id, fingerprint: observation.fingerprint, evidence: observation.evidenceSummary }),
          classification: "confidential",
          metadata: json({ batchId, observationId: observation.id, connector: batch.connector, sourceReference: observation.sourceReference }),
          collectedBy: actor,
          collectedAt: observation.lastObservedAt || new Date()
        }
      });
      await tx.verifyGridObservation.update({ where: { id: observation.id }, data: { promotionStatus: "promoted", promotedFindingId: finding.id } });
      promoted += 1;
    }
    await tx.verifyGridImportBatch.update({
      where: { id: batchId },
      data: { promotedCount: { increment: promoted }, duplicateCount: { increment: duplicates } }
    });
    await tx.verifyGridActivity.create({
      data: {
        workspaceId: batch.workspaceId,
        engagementId: batch.engagementId,
        action: "evidence.observations_promoted",
        actor,
        metadata: json({ batchId, promoted, duplicates, minimumSeverity: input.minimumSeverity, includeInformational: input.includeInformational })
      }
    });
  });
  return { promoted, duplicates, engagement: await getVerifyGridEngagement(batch.engagementId) };
}

export async function createVerifyGridExecutionJob(engagementId: string, value: unknown, actor: string) {
  const input = executionJobSchema.parse(value);
  const prisma = getPrismaClient();
  const engagement = await prisma.verifyGridEngagement.findUnique({
    where: { id: engagementId },
    include: { scopeTargets: true, authorizations: { where: { status: "active" }, orderBy: { authorizedAt: "desc" }, take: 1 } }
  });
  if (!engagement) throw new Error("VerifyGrid engagement not found.");
  const currentHash = scopeHash(engagement.scopeTargets);
  const authorization = engagement.authorizations[0] || null;
  const targets = engagement.scopeTargets.filter((target) => input.targetIds.includes(target.id));
  if (targets.length !== input.targetIds.length) throw new Error("One or more execution targets do not belong to this engagement.");
  const boundary = validateExecutionBoundary({
    engagementStatus: engagement.status,
    testMode: engagement.testMode,
    scopeHash: currentHash,
    capability: input.capability,
    targets,
    authorization,
    requestedStartAt: input.requestedStartAt,
    validUntil: input.validUntil
  });
  if (!boundary.allowed || !authorization) throw new Error(`Execution boundary blocked this record: ${boundary.blockers.join(" ")}`);
  const rules = record(engagement.rulesOfEngagement);
  const configuredRate = Number(rules.maxRequestsPerSecond);
  const maxRequestsPerSecond = Number.isInteger(configuredRate) && configuredRate > 0 ? Math.min(configuredRate, 100) : 5;
  const built = buildExecutionManifest({
    engagementId,
    engagementReference: engagement.reference,
    workspaceId: engagement.workspaceId,
    scopeHash: currentHash,
    authorization,
    capability: input.capability,
    targets,
    rationale: input.rationale,
    requestedStartAt: input.requestedStartAt,
    validUntil: input.validUntil,
    maxRequestsPerSecond,
    prohibitedActions: strings(engagement.rulesOfEngagement, "prohibitedActions"),
    stopConditions: strings(engagement.rulesOfEngagement, "stopConditions")
  });
  const status = built.capability.humanApprovalRequired ? "manual_approval_required" : "validated";
  const job = await prisma.$transaction(async (tx) => {
    const created = await tx.verifyGridExecutionJob.create({
      data: {
        workspaceId: engagement.workspaceId,
        engagementId,
        authorizationId: authorization.id,
        capability: input.capability,
        capabilityLevel: built.capability.level,
        status,
        scopeHash: currentHash,
        targetIds: json(input.targetIds),
        targetSnapshot: json(built.manifest.targets),
        rationale: input.rationale,
        requestedStartAt: input.requestedStartAt,
        validUntil: input.validUntil,
        maxRequestsPerSecond,
        manifest: json(built.manifest),
        manifestSha256: built.manifestSha256,
        requestedBy: actor
      }
    });
    await tx.verifyGridActivity.create({
      data: {
        workspaceId: engagement.workspaceId,
        engagementId,
        action: "execution.manifest_created",
        actor,
        metadata: json({ jobId: created.id, capability: input.capability, level: built.capability.level, status, scopeHash: currentHash, manifestSha256: built.manifestSha256 })
      }
    });
    return created;
  });
  return { jobId: job.id, engagement: await getVerifyGridEngagement(engagementId) };
}

export async function cancelVerifyGridExecutionJob(jobId: string, value: unknown, actor: string) {
  const input = executionCancelSchema.parse(value);
  const prisma = getPrismaClient();
  const job = await prisma.verifyGridExecutionJob.findUnique({ where: { id: jobId } });
  if (!job) throw new Error("VerifyGrid execution record not found.");
  if (["cancelled", "completed", "expired"].includes(job.status)) throw new Error(`An execution record in ${job.status} state cannot be cancelled.`);
  await prisma.$transaction([
    prisma.verifyGridExecutionJob.update({
      where: { id: jobId },
      data: { status: "cancelled", dispatchStatus: "cancelled", cancelledBy: actor, cancelledAt: new Date(), cancellationReason: input.reason }
    }),
    prisma.verifyGridActivity.create({
      data: { workspaceId: job.workspaceId, engagementId: job.engagementId, action: "execution.cancelled", actor, metadata: json({ jobId, reason: input.reason }) }
    })
  ]);
  return getVerifyGridEngagement(job.engagementId);
}

export async function createVerifyGridReport(engagementId: string, value: unknown, actor: string) {
  const input = reportCreateSchema.parse(value);
  const prisma = getPrismaClient();
  const engagement = await prisma.verifyGridEngagement.findUnique({
    where: { id: engagementId },
    include: {
      workspace: true,
      scopeTargets: true,
      authorizations: { orderBy: { authorizedAt: "desc" }, take: 5 },
      findings: { orderBy: [{ knownExploited: "desc" }, { severity: "asc" }, { updatedAt: "desc" }], include: { evidence: true, retests: true } },
      importBatches: { orderBy: { createdAt: "desc" }, take: 20 },
      executionJobs: { orderBy: { createdAt: "desc" }, take: 20 },
      reports: { where: { reportType: input.reportType }, orderBy: { version: "desc" }, take: 1 }
    }
  });
  if (!engagement) throw new Error("VerifyGrid engagement not found.");
  const currentHash = scopeHash(engagement.scopeTargets);
  const activeAuthorization = engagement.authorizations.find((item) => item.status === "active" && item.scopeHash === currentHash);
  const findings = engagement.findings.filter((finding) => !["false_positive", "duplicate"].includes(finding.status));
  const snapshot = {
    schema: "qcs.verifygrid.report.v1",
    reportType: input.reportType,
    generatedAt: new Date().toISOString(),
    engagement: {
      id: engagement.id,
      reference: engagement.reference,
      title: engagement.title,
      serviceType: engagement.serviceType,
      status: engagement.status,
      testMode: engagement.testMode,
      riskTier: engagement.riskTier,
      scopeSummary: engagement.scopeSummary,
      scopeHash: currentHash,
      client: { name: engagement.workspace.name, legalName: engagement.workspace.legalName, countryCode: engagement.workspace.countryCode },
      operatingWindow: { plannedStartAt: engagement.plannedStartAt?.toISOString() || null, plannedEndAt: engagement.plannedEndAt?.toISOString() || null },
      authorization: activeAuthorization ? {
        approvedByName: activeAuthorization.approvedByName,
        approvedByTitle: activeAuthorization.approvedByTitle,
        validFrom: activeAuthorization.validFrom.toISOString(),
        validUntil: activeAuthorization.validUntil.toISOString(),
        scopeHash: activeAuthorization.scopeHash
      } : null
    },
    summary: {
      inScopeTargets: engagement.scopeTargets.filter((target) => target.inScope).length,
      exclusions: engagement.scopeTargets.filter((target) => !target.inScope).length,
      findings: findings.length,
      critical: findings.filter((finding) => finding.severity === "critical").length,
      high: findings.filter((finding) => finding.severity === "high").length,
      knownExploited: findings.filter((finding) => finding.knownExploited).length,
      closed: findings.filter((finding) => finding.status === "closed").length,
      importedObservations: engagement.importBatches.reduce((sum, batch) => sum + batch.observationCount, 0),
      preparedExecutionRecords: engagement.executionJobs.length
    },
    scope: engagement.scopeTargets.map((target) => ({
      type: target.targetType,
      value: target.value,
      environment: target.environment,
      criticality: target.criticality,
      permission: target.permission,
      disposition: target.inScope ? "in_scope" : "excluded"
    })),
    findings: findings.map((finding) => ({
      id: finding.id,
      title: finding.title,
      severity: finding.severity,
      status: finding.status,
      confidence: finding.confidence,
      knownExploited: finding.knownExploited,
      cvssScore: finding.cvssScore,
      epssScore: finding.epssScore,
      advisoryExternalId: finding.advisoryExternalId,
      businessImpact: finding.businessImpact,
      remediation: finding.remediation,
      ownerName: finding.ownerName,
      dueAt: finding.dueAt?.toISOString() || null,
      evidenceCount: finding.evidence.length,
      latestRetest: finding.retests.sort((left, right) => right.requestedAt.getTime() - left.requestedAt.getTime())[0]?.status || null
    })),
    evidenceSources: engagement.importBatches.map((batch) => ({
      connector: batch.connector,
      contentSha256: batch.contentSha256,
      observations: batch.observationCount,
      inScope: batch.inScopeCount,
      unmatched: batch.unmatchedCount,
      importedAt: batch.createdAt.toISOString()
    })),
    executionRecords: engagement.executionJobs.map((job) => ({
      capability: job.capability,
      capabilityLevel: job.capabilityLevel,
      status: job.status,
      scopeHash: job.scopeHash,
      manifestSha256: job.manifestSha256,
      requestedStartAt: job.requestedStartAt.toISOString(),
      validUntil: job.validUntil.toISOString()
    }))
  };
  const version = (engagement.reports[0]?.version || 0) + 1;
  const report = await prisma.$transaction(async (tx) => {
    const created = await tx.verifyGridReport.create({
      data: {
        workspaceId: engagement.workspaceId,
        engagementId,
        version,
        reportType: input.reportType,
        title: `${engagement.reference} ${input.reportType} assurance report v${version}`,
        scopeHash: currentHash,
        snapshot: json(snapshot),
        snapshotSha256: sha256Json(snapshot),
        generatedBy: actor
      }
    });
    await tx.verifyGridActivity.create({
      data: {
        workspaceId: engagement.workspaceId,
        engagementId,
        action: "report.snapshot_generated",
        actor,
        metadata: json({ reportId: created.id, reportType: input.reportType, version, snapshotSha256: created.snapshotSha256 })
      }
    });
    return created;
  });
  return { reportId: report.id, engagement: await getVerifyGridEngagement(engagementId) };
}

export async function getVerifyGridReport(reportId: string) {
  const report = await getPrismaClient().verifyGridReport.findUnique({
    where: { id: reportId },
    include: { workspace: { select: { name: true, legalName: true } }, engagement: { select: { reference: true, title: true } } }
  });
  if (!report) return null;
  return {
    id: report.id,
    version: report.version,
    reportType: report.reportType,
    status: report.status,
    title: report.title,
    scopeHash: report.scopeHash,
    snapshot: record(report.snapshot),
    snapshotSha256: report.snapshotSha256,
    generatedAt: report.generatedAt.toISOString(),
    workspace: report.workspace,
    engagement: report.engagement
  };
}

export { capabilityCatalog };
