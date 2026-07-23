import crypto from "node:crypto";
import type { Prisma } from "@prisma/client";
import { getPrismaClient } from "@/lib/prisma";
import {
  executionQueueSchema,
  parseSensorToken,
  retryDelayMinutes,
  safeEqual,
  sensorCreateSchema,
  sensorFailureSchema,
  sensorHeartbeatSchema,
  sensorResultSchema,
  sensorToken,
  sha256,
  signSensorManifest
} from "@/lib/verifygrid-automation-domain";
import { canonicalJson, validateExecutionBoundary } from "@/lib/verifygrid-execution-domain";
import { importVerifyGridScannerExport } from "@/lib/verifygrid-pipeline";
import { scopeHash } from "@/lib/verifygrid-domain";
import { getVerifyGridEngagement } from "@/lib/verifygrid";
import { capabilityCatalog, verifyGridCapabilities } from "@/lib/verifygrid-catalog";

function json(value: unknown) {
  return value as Prisma.InputJsonValue;
}

function capabilities(value: Prisma.JsonValue) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function bearer(request: Request) {
  const authorization = request.headers.get("authorization") || "";
  return authorization.startsWith("Bearer ") ? authorization.slice(7).trim() : "";
}

function reportedRuntimeCapabilities(request: Request) {
  const supplied = request.headers.get("x-verifygrid-sensor-capabilities");
  if (supplied === null) return null;
  const allowed = new Set<string>(verifyGridCapabilities);
  return [...new Set(supplied.split(",").map((item) => item.trim()).filter((item) => allowed.has(item)))].slice(0, 20);
}

function manifestApproval(job: { approvedAt: Date | null; approvedBy: string | null; manifest: Prisma.JsonValue }, required: boolean) {
  if (!required) return true;
  if (!job.approvedAt || !job.approvedBy) return false;
  const manifest = job.manifest && typeof job.manifest === "object" && !Array.isArray(job.manifest) ? job.manifest as Record<string, Prisma.JsonValue> : {};
  const controls = manifest.controls && typeof manifest.controls === "object" && !Array.isArray(manifest.controls) ? manifest.controls as Record<string, Prisma.JsonValue> : {};
  const approval = controls.approval && typeof controls.approval === "object" && !Array.isArray(controls.approval) ? controls.approval as Record<string, Prisma.JsonValue> : {};
  return approval.required === true && approval.approvedBy === job.approvedBy && approval.approvedAt === job.approvedAt.toISOString() && typeof approval.noteSha256 === "string";
}

export async function createVerifyGridSensor(workspaceId: string, value: unknown, actor: string) {
  const input = sensorCreateSchema.parse(value);
  const prisma = getPrismaClient();
  const workspace = await prisma.verifyGridWorkspace.findUnique({ where: { id: workspaceId }, select: { id: true } });
  if (!workspace) throw new Error("VerifyGrid workspace not found.");
  const id = crypto.randomUUID();
  const enrollment = sensorToken(id);
  const sensor = await prisma.verifyGridSensor.create({
    data: {
      id,
      workspaceId,
      name: input.name,
      tokenHash: enrollment.tokenHash,
      tokenLastFour: enrollment.tokenLastFour,
      capabilities: json(input.capabilities),
      createdBy: actor
    }
  });
  await prisma.verifyGridActivity.create({ data: { workspaceId, action: "sensor.enrolled", actor, metadata: json({ sensorId: id, name: sensor.name, capabilities: input.capabilities }) } });
  return { sensor: { id: sensor.id, name: sensor.name, capabilities: input.capabilities, status: sensor.status }, token: enrollment.token };
}

export async function revokeVerifyGridSensor(sensorId: string, actor: string, reason: string) {
  if (reason.trim().length < 10) throw new Error("Provide a revocation reason of at least 10 characters.");
  const prisma = getPrismaClient();
  const sensor = await prisma.verifyGridSensor.findUnique({ where: { id: sensorId } });
  if (!sensor) throw new Error("VerifyGrid sensor not found.");
  await prisma.$transaction([
    prisma.verifyGridSensor.update({ where: { id: sensorId }, data: { status: "revoked", revokedAt: new Date(), revokedBy: actor } }),
    prisma.verifyGridExecutionJob.updateMany({ where: { sensorId, status: { in: ["queued", "claimed", "running", "processing_result", "retry"] } }, data: { status: "cancelled", dispatchStatus: "cancelled", cancelledAt: new Date(), cancelledBy: actor, cancellationReason: reason } }),
    prisma.verifyGridActivity.create({ data: { workspaceId: sensor.workspaceId, action: "sensor.revoked", actor, metadata: json({ sensorId, reason }) } })
  ]);
}

export async function authenticateVerifyGridSensor(request: Request) {
  const parsed = parseSensorToken(bearer(request));
  if (!parsed) return null;
  const prisma = getPrismaClient();
  const sensor = await prisma.verifyGridSensor.findUnique({ where: { id: parsed.sensorId } });
  if (!sensor || sensor.status !== "active" || !safeEqual(sensor.tokenHash, parsed.tokenHash)) return null;
  const reported = reportedRuntimeCapabilities(request);
  const enrolled = capabilities(sensor.capabilities);
  const runtime = reported === null ? capabilities(sensor.runtimeCapabilities || []) : reported.filter((item) => enrolled.includes(item));
  await prisma.verifyGridSensor.update({
    where: { id: sensor.id },
    data: {
      lastSeenAt: new Date(),
      runtimeCapabilities: reported === null ? undefined : json(runtime),
      healthStatus: "connected",
      lastError: null,
      version: request.headers.get("x-verifygrid-sensor-version")?.slice(0, 80) || sensor.version,
      region: request.headers.get("x-verifygrid-sensor-region")?.slice(0, 80) || sensor.region
    }
  });
  return { ...sensor, secret: parsed.secret, capabilityList: enrolled, runtimeCapabilityList: runtime };
}

export async function queueVerifyGridExecutionJob(jobId: string, value: unknown, actor: string) {
  const input = executionQueueSchema.parse(value);
  const prisma = getPrismaClient();
  const job = await prisma.verifyGridExecutionJob.findUnique({
    where: { id: jobId },
    include: { engagement: { include: { scopeTargets: true } }, authorization: true }
  });
  if (!job) throw new Error("VerifyGrid execution record not found.");
  if (job.status !== "validated") throw new Error("Only validated non-destructive execution records can be queued.");
  const capability = capabilityCatalog[job.capability as keyof typeof capabilityCatalog];
  if (!capability?.sensorDispatch) throw new Error("This capability is a supervised manual record and cannot be queued to a sensor.");
  if (!manifestApproval(job, capability.humanApprovalRequired)) throw new Error("Controlled validation requires a current recorded approval before queueing.");
  const sensor = await prisma.verifyGridSensor.findFirst({ where: { id: input.sensorId, workspaceId: job.workspaceId, status: "active" } });
  if (!sensor) throw new Error("Select an active sensor from the same workspace.");
  if (!capabilities(sensor.capabilities).includes(job.capability)) throw new Error("The selected sensor does not advertise this capability.");
  if (!sensor.lastSeenAt || sensor.lastSeenAt < new Date(Date.now() - 10 * 60_000)) throw new Error("The selected sensor is offline or stale. Confirm its runtime before queueing.");
  if (!capabilities(sensor.runtimeCapabilities || []).includes(job.capability)) throw new Error("The connected sensor runtime does not have the required scanner installed.");
  const targets = job.engagement.scopeTargets.filter((target) => Array.isArray(job.targetIds) && job.targetIds.includes(target.id));
  const currentHash = scopeHash(job.engagement.scopeTargets);
  const boundary = validateExecutionBoundary({
    engagementStatus: job.engagement.status,
    testMode: job.engagement.testMode,
    scopeHash: currentHash,
    capability: job.capability as Parameters<typeof validateExecutionBoundary>[0]["capability"],
    targets,
    authorization: job.authorization,
    requestedStartAt: job.requestedStartAt,
    validUntil: job.validUntil
  });
  if (!boundary.allowed || job.manifestSha256 !== sha256(canonicalJson(job.manifest))) throw new Error(`Dispatch blocked: ${[...boundary.blockers, ...(job.manifestSha256 !== sha256(canonicalJson(job.manifest)) ? ["Manifest integrity check failed."] : [])].join(" ")}`);
  await prisma.$transaction([
    prisma.verifyGridExecutionJob.update({ where: { id: jobId }, data: { sensorId: sensor.id, status: "queued", dispatchStatus: "queued", queuedAt: new Date(), lastError: null } }),
    prisma.verifyGridActivity.create({ data: { workspaceId: job.workspaceId, engagementId: job.engagementId, action: "execution.queued", actor, metadata: json({ jobId, sensorId: sensor.id, capability: job.capability, manifestSha256: job.manifestSha256 }) } })
  ]);
  return getVerifyGridEngagement(job.engagementId);
}

async function blockJob(job: { id: string; workspaceId: string; engagementId: string }, reason: string) {
  const prisma = getPrismaClient();
  await prisma.$transaction([
    prisma.verifyGridExecutionJob.update({ where: { id: job.id }, data: { status: "failed", dispatchStatus: "blocked", completedAt: new Date(), lastError: reason, leaseUntil: null } }),
    prisma.verifyGridActivity.create({ data: { workspaceId: job.workspaceId, engagementId: job.engagementId, action: "execution.dispatch_blocked", actor: "verifygrid-safety-gate", metadata: json({ jobId: job.id, reason }) } })
  ]);
}

export async function claimVerifyGridSensorJob(request: Request) {
  const sensor = await authenticateVerifyGridSensor(request);
  if (!sensor) return null;
  await reconcileVerifyGridExecutionLeases();
  const prisma = getPrismaClient();
  const now = new Date();
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const candidate = await prisma.verifyGridExecutionJob.findFirst({
      where: {
        sensorId: sensor.id,
        status: { in: ["queued", "retry"] },
        requestedStartAt: { lte: now },
        validUntil: { gt: now },
        OR: [{ leaseUntil: null }, { leaseUntil: { lt: now } }]
      },
      orderBy: [{ requestedStartAt: "asc" }, { createdAt: "asc" }]
    });
    if (!candidate) return { sensor, job: null };
    const claimed = await prisma.verifyGridExecutionJob.updateMany({
      where: { id: candidate.id, status: candidate.status, OR: [{ leaseUntil: null }, { leaseUntil: { lt: now } }] },
      data: { status: "claimed", dispatchStatus: "claimed", claimedAt: now, leaseUntil: new Date(Date.now() + 3 * 60_000), attempt: { increment: 1 }, lastError: null }
    });
    if (!claimed.count) continue;
    const job = await prisma.verifyGridExecutionJob.findUnique({
      where: { id: candidate.id },
      include: { engagement: { include: { scopeTargets: true } }, authorization: true }
    });
    if (!job) continue;
    const targets = job.engagement.scopeTargets.filter((target) => Array.isArray(job.targetIds) && job.targetIds.includes(target.id));
    const currentHash = scopeHash(job.engagement.scopeTargets);
    const boundary = validateExecutionBoundary({
      engagementStatus: job.engagement.status,
      testMode: job.engagement.testMode,
      scopeHash: currentHash,
      capability: job.capability as Parameters<typeof validateExecutionBoundary>[0]["capability"],
      targets,
      authorization: job.authorization,
      requestedStartAt: job.requestedStartAt,
      validUntil: job.validUntil,
      now
    });
    const canonical = canonicalJson(job.manifest);
    const blockers = [...boundary.blockers];
    if (job.scopeHash !== currentHash) blockers.push("Execution scope changed after manifest creation.");
    if (job.manifestSha256 !== sha256(canonical)) blockers.push("Execution manifest integrity failed.");
    if (!sensor.capabilityList.includes(job.capability)) blockers.push("Sensor capability changed after queueing.");
    if (!sensor.runtimeCapabilityList.includes(job.capability)) blockers.push("The sensor runtime no longer advertises the required scanner.");
    const capability = capabilityCatalog[job.capability as keyof typeof capabilityCatalog];
    if (!capability?.sensorDispatch) blockers.push("The capability cannot be dispatched to a sensor.");
    if (capability && !manifestApproval(job, capability.humanApprovalRequired)) blockers.push("The controlled-validation approval is missing or no longer matches the manifest.");
    if (blockers.length) {
      await blockJob(job, blockers.join(" "));
      continue;
    }
    return {
      sensor,
      job: {
        id: job.id,
        manifest: job.manifest,
        manifestSha256: job.manifestSha256,
        signature: signSensorManifest(sensor.secret, canonical),
        signatureAlgorithm: "HMAC-SHA256",
        leaseUntil: new Date(Date.now() + 3 * 60_000).toISOString(),
        heartbeatSeconds: 60
      }
    };
  }
  return { sensor, job: null };
}

export async function heartbeatVerifyGridSensorJob(request: Request, value: unknown) {
  const sensor = await authenticateVerifyGridSensor(request);
  if (!sensor) return null;
  const input = sensorHeartbeatSchema.parse(value);
  const now = new Date();
  const result = await getPrismaClient().verifyGridExecutionJob.updateMany({
    where: { id: input.jobId, sensorId: sensor.id, status: { in: ["claimed", "running"] }, validUntil: { gt: now }, cancelledAt: null },
    data: { status: input.state, dispatchStatus: input.state, startedAt: input.state === "running" ? now : undefined, leaseUntil: new Date(Date.now() + 3 * 60_000) }
  });
  if (!result.count) throw new Error("The job lease is no longer active.");
  if (input.version || input.region) await getPrismaClient().verifyGridSensor.update({ where: { id: sensor.id }, data: { version: input.version, region: input.region } });
  return { ok: true, leaseUntil: new Date(Date.now() + 3 * 60_000).toISOString() };
}

export async function completeVerifyGridSensorJob(request: Request, value: unknown) {
  const sensor = await authenticateVerifyGridSensor(request);
  if (!sensor) return null;
  const input = sensorResultSchema.parse(value);
  if (sha256(input.content) !== input.contentSha256.toLowerCase()) throw new Error("Sensor result integrity hash does not match the submitted content.");
  const prisma = getPrismaClient();
  const now = new Date();
  const job = await prisma.verifyGridExecutionJob.findFirst({ where: { id: input.jobId, sensorId: sensor.id }, include: { engagement: true } });
  if (!job || !["claimed", "running"].includes(job.status)) throw new Error("The sensor job is not active.");
  if (job.validUntil <= now || !job.leaseUntil || job.leaseUntil <= now) throw new Error("The sensor result arrived outside its active execution lease.");
  if (job.manifestSha256 !== input.manifestSha256.toLowerCase()) throw new Error("The sensor result references a different manifest.");
  const reserved = await prisma.verifyGridExecutionJob.updateMany({
    where: {
      id: job.id,
      sensorId: sensor.id,
      status: { in: ["claimed", "running"] },
      manifestSha256: input.manifestSha256.toLowerCase(),
      validUntil: { gt: now },
      leaseUntil: { gt: now },
      cancelledAt: null
    },
    data: { status: "processing_result", dispatchStatus: "processing_result", leaseUntil: new Date(Date.now() + 3 * 60_000) }
  });
  if (reserved.count !== 1) throw new Error("The sensor result lease was already consumed or stopped.");
  try {
    const imported = await importVerifyGridScannerExport(job.engagementId, {
      connector: "normalized_json",
      fileName: `verifygrid-sensor-${sensor.id}-${job.id}.json`,
      content: input.content,
      enrich: true
    }, `sensor:${sensor.name}`);
    await prisma.$transaction(async (tx) => {
      const completed = await tx.verifyGridExecutionJob.updateMany({
        where: { id: job.id, sensorId: sensor.id, status: "processing_result", cancelledAt: null },
        data: { status: "completed", dispatchStatus: "completed", completedAt: new Date(), leaseUntil: null, resultBatchId: imported.batchId, resultSummary: json({ ...input.summary, contentSha256: input.contentSha256 }), lastError: null }
      });
      if (completed.count !== 1) throw new Error("The sensor job was stopped before its result could be finalized.");
      await tx.verifyGridActivity.create({ data: { workspaceId: job.workspaceId, engagementId: job.engagementId, action: "execution.completed", actor: `sensor:${sensor.name}`, metadata: json({ jobId: job.id, batchId: imported.batchId, manifestSha256: job.manifestSha256, contentSha256: input.contentSha256 }) } });
      await tx.verifyGridSensor.update({ where: { id: sensor.id }, data: { healthStatus: "connected", lastError: null } });
    });
    return { ok: true, batchId: imported.batchId };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Sensor result processing failed.";
    await prisma.verifyGridExecutionJob.updateMany({
      where: { id: job.id, sensorId: sensor.id, status: "processing_result", cancelledAt: null },
      data: { status: "running", dispatchStatus: "running", leaseUntil: new Date(Date.now() + 3 * 60_000), lastError: message }
    });
    throw error;
  }
}

export async function failVerifyGridSensorJob(request: Request, value: unknown) {
  const sensor = await authenticateVerifyGridSensor(request);
  if (!sensor) return null;
  const input = sensorFailureSchema.parse(value);
  const prisma = getPrismaClient();
  const job = await prisma.verifyGridExecutionJob.findFirst({ where: { id: input.jobId, sensorId: sensor.id } });
  if (!job || !["claimed", "running"].includes(job.status)) throw new Error("The sensor job is not active.");
  if (!job.leaseUntil || job.leaseUntil <= new Date()) throw new Error("The sensor job lease is no longer active.");
  if (job.manifestSha256 !== input.manifestSha256.toLowerCase()) throw new Error("The failure references a different manifest.");
  const canRetry = input.retryable && job.attempt < job.maxAttempts && job.validUntil > new Date(Date.now() + 60_000);
  await prisma.$transaction([
    prisma.verifyGridExecutionJob.update({
      where: { id: job.id },
      data: {
        status: canRetry ? "retry" : "failed",
        dispatchStatus: canRetry ? "retry" : "failed",
        requestedStartAt: canRetry ? new Date(Date.now() + retryDelayMinutes(job.attempt) * 60_000) : job.requestedStartAt,
        completedAt: canRetry ? null : new Date(),
        leaseUntil: null,
        lastError: input.error
      }
    }),
    prisma.verifyGridActivity.create({ data: { workspaceId: job.workspaceId, engagementId: job.engagementId, action: canRetry ? "execution.retry_scheduled" : "execution.failed", actor: `sensor:${sensor.name}`, metadata: json({ jobId: job.id, error: input.error, attempt: job.attempt }) } }),
    prisma.verifyGridSensor.update({ where: { id: sensor.id }, data: { healthStatus: canRetry ? "degraded" : "error", lastError: input.error } })
  ]);
  return { ok: true, status: canRetry ? "retry" : "failed" };
}

export async function emergencyStopVerifyGridEngagement(engagementId: string, actor: string, reason: string) {
  if (reason.trim().length < 20) throw new Error("Emergency stop requires a reason of at least 20 characters.");
  const prisma = getPrismaClient();
  const engagement = await prisma.verifyGridEngagement.findUnique({ where: { id: engagementId } });
  if (!engagement) throw new Error("VerifyGrid engagement not found.");
  const now = new Date();
  const result = await prisma.$transaction(async (tx) => {
    const jobs = await tx.verifyGridExecutionJob.updateMany({ where: { engagementId, status: { in: ["queued", "claimed", "running", "processing_result", "retry"] } }, data: { status: "cancelled", dispatchStatus: "emergency_stopped", cancelledAt: now, cancelledBy: actor, cancellationReason: reason, leaseUntil: null } });
    await tx.verifyGridEngagement.update({ where: { id: engagementId }, data: { status: "paused", updatedBy: actor } });
    await tx.verifyGridActivity.create({ data: { workspaceId: engagement.workspaceId, engagementId, action: "execution.emergency_stop", actor, metadata: json({ reason, cancelledJobs: jobs.count }) } });
    return jobs.count;
  });
  return { cancelledJobs: result, engagement: await getVerifyGridEngagement(engagementId) };
}

export async function reconcileVerifyGridExecutionLeases() {
  const prisma = getPrismaClient();
  const now = new Date();
  const expired = await prisma.verifyGridExecutionJob.updateMany({
    where: { status: { in: ["queued", "retry", "claimed", "running", "processing_result"] }, validUntil: { lte: now } },
    data: { status: "expired", dispatchStatus: "expired", completedAt: now, leaseUntil: null, lastError: "The execution authorization window expired before completion." }
  });
  const stale = await prisma.verifyGridExecutionJob.findMany({ where: { status: { in: ["claimed", "running", "processing_result"] }, leaseUntil: { lt: now }, validUntil: { gt: now } }, take: 100 });
  let retried = 0;
  let failed = 0;
  for (const job of stale) {
    const canRetry = job.attempt < job.maxAttempts && job.validUntil > new Date(Date.now() + 60_000);
    await prisma.verifyGridExecutionJob.update({ where: { id: job.id }, data: { status: canRetry ? "retry" : "failed", dispatchStatus: canRetry ? "retry" : "failed", requestedStartAt: canRetry ? new Date(Date.now() + retryDelayMinutes(job.attempt) * 60_000) : job.requestedStartAt, leaseUntil: null, completedAt: canRetry ? null : now, lastError: "Sensor lease expired before a final result was received." } });
    if (canRetry) retried += 1;
    else failed += 1;
  }
  const offline = await prisma.verifyGridSensor.updateMany({
    where: { status: "active", lastSeenAt: { lt: new Date(Date.now() - 10 * 60_000) }, healthStatus: { not: "offline" } },
    data: { healthStatus: "offline", lastError: "No sensor heartbeat was received within ten minutes." }
  });
  return { expired: expired.count, retried, failed, offlineSensors: offline.count };
}
