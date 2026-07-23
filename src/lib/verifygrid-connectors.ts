import dns from "node:dns/promises";
import { XMLParser } from "fast-xml-parser";
import type { Prisma } from "@prisma/client";
import { getPrismaClient } from "@/lib/prisma";
import {
  connectorEnvironmentKeys,
  connectorProfileSchema,
  connectorProviderCatalog,
  connectorRunSchema,
  isPrivateAddress,
  randomSecret,
  retryDelayMinutes,
  sha256,
  validateConnectorBaseUrl,
  type VerifyGridConnectorProvider
} from "@/lib/verifygrid-automation-domain";
import { importVerifyGridScannerExport } from "@/lib/verifygrid-pipeline";

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@",
  textNodeName: "#text",
  parseTagValue: false,
  parseAttributeValue: false,
  trimValues: true,
  processEntities: false
});

type ConnectorRunWithProfile = Prisma.VerifyGridConnectorRunGetPayload<{ include: { connector: true } }>;

function json(value: unknown) {
  return value as Prisma.InputJsonValue;
}

function object(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function list(value: unknown): unknown[] {
  if (value === null || value === undefined) return [];
  return Array.isArray(value) ? value : [value];
}

function text(value: unknown) {
  if (typeof value === "string" || typeof value === "number") return String(value).trim();
  return String(object(value)["#text"] || "").trim();
}

function number(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function iso(value: unknown) {
  const date = new Date(text(value));
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

function connectorSecrets(provider: VerifyGridConnectorProvider, prefix: string) {
  const keys = connectorEnvironmentKeys(provider, prefix);
  const values = Object.fromEntries(keys.map((key) => [key.slice(prefix.length + 1), process.env[key]?.trim() || ""]));
  const missing = keys.filter((key) => !process.env[key]?.trim());
  return { values, missing };
}

async function assertPublicCloudOrigin(origin: string) {
  const url = new URL(origin);
  const addresses = await dns.lookup(url.hostname, { all: true, verbatim: true });
  if (!addresses.length || addresses.some((item) => isPrivateAddress(item.address))) throw new Error("Cloud connector DNS resolved to a private, loopback, or reserved address.");
}

async function guardedFetch(origin: string, path: string, init: RequestInit) {
  const url = new URL(path, `${origin}/`);
  if (url.origin !== origin) throw new Error("Connector request attempted to leave its configured origin.");
  const response = await fetch(url, { ...init, redirect: "manual", cache: "no-store", signal: AbortSignal.timeout(20_000) });
  if (response.status >= 300 && response.status < 400) throw new Error("Connector redirects are blocked; update the configured origin explicitly.");
  return response;
}

function credentialStatus(provider: VerifyGridConnectorProvider, credentialRef: string) {
  if (connectorProviderCatalog[provider].mode === "sensor_api") return "active";
  return connectorSecrets(provider, credentialRef).missing.length ? "awaiting_credentials" : "active";
}

export async function createVerifyGridConnectorProfile(workspaceId: string, value: unknown, actor: string) {
  const input = connectorProfileSchema.parse(value);
  const prisma = getPrismaClient();
  const engagement = await prisma.verifyGridEngagement.findFirst({ where: { id: input.engagementId, workspaceId }, select: { id: true } });
  if (!engagement) throw new Error("The selected engagement does not belong to this workspace.");
  const baseUrl = validateConnectorBaseUrl(input.baseUrl, input.provider);
  if (connectorProviderCatalog[input.provider].mode === "cloud_api") await assertPublicCloudOrigin(baseUrl);
  return prisma.verifyGridConnectorProfile.create({
    data: {
      workspaceId,
      engagementId: engagement.id,
      provider: input.provider,
      label: input.label,
      status: credentialStatus(input.provider, input.credentialRef),
      baseUrl,
      credentialRef: input.credentialRef,
      syncMode: input.syncMode,
      scheduleMinutes: input.scheduleMinutes,
      settings: json({ connectorMode: connectorProviderCatalog[input.provider].mode }),
      nextSyncAt: new Date(),
      createdBy: actor
    }
  });
}

export async function queueVerifyGridConnectorRun(connectorId: string, value: unknown, actor: string) {
  const input = connectorRunSchema.parse(value);
  const prisma = getPrismaClient();
  const connector = await prisma.verifyGridConnectorProfile.findUnique({ where: { id: connectorId } });
  if (!connector || !connector.engagementId) throw new Error("Connector profile or default engagement was not found.");
  if (connector.status === "paused") throw new Error("Resume the connector before queueing a synchronization.");
  const provider = connector.provider as VerifyGridConnectorProvider;
  const missing = connectorEnvironmentKeys(provider, connector.credentialRef).filter((key) => !process.env[key]?.trim());
  if (connectorProviderCatalog[provider].mode === "cloud_api" && missing.length) throw new Error(`Connector credentials are not configured: ${missing.join(", ")}.`);
  const active = await prisma.verifyGridConnectorRun.findFirst({ where: { connectorId, status: { in: ["queued", "running", "waiting_remote", "retry"] } } });
  if (active) return active;
  return prisma.verifyGridConnectorRun.create({
    data: {
      connectorId,
      engagementId: connector.engagementId,
      trigger: input.trigger,
      status: connectorProviderCatalog[provider].mode === "sensor_api" ? "awaiting_sensor" : "queued",
      cursorBefore: connector.cursor || undefined,
      createdBy: actor
    }
  });
}

function severity(value: unknown) {
  const normalized = text(value).toLowerCase();
  const numeric = Number(normalized);
  if (normalized === "critical" || numeric >= 4) return "critical";
  if (normalized === "high" || numeric === 3) return "high";
  if (normalized === "medium" || numeric === 2) return "medium";
  if (normalized === "low" || numeric === 1) return "low";
  return "informational";
}

function firstValue(value: unknown) {
  return list(value).map(text).find(Boolean) || "";
}

function tenableObservations(records: unknown[]) {
  return records.slice(0, 5000).map((value, index) => {
    const row = object(value);
    const asset = object(row.asset);
    const plugin = object(row.plugin);
    const port = object(row.port);
    const identifier = firstValue(asset.ipv4 || asset.ipv6 || asset.fqdn || asset.hostname || asset.uuid) || `tenable-asset-${index + 1}`;
    const pluginId = text(plugin.id || row.plugin_id) || `finding-${index + 1}`;
    const cves = list(plugin.cve || row.cve).map(text).filter(Boolean);
    return {
      assetIdentifier: identifier,
      assetName: firstValue(asset.fqdn || asset.hostname) || identifier,
      assetKind: "host",
      title: text(plugin.name || row.plugin_name) || `Tenable plugin ${pluginId}`,
      description: text(plugin.description || row.description || plugin.synopsis) || "Tenable reported a vulnerability observation for this asset.",
      severity: severity(row.severity || plugin.risk_factor),
      confidence: "likely",
      sourceReference: `tenable:${pluginId}:${text(asset.uuid) || identifier}:${text(port.port || row.port) || "0"}`,
      advisoryExternalId: cves[0] || "",
      cvssScore: number(plugin.cvss3_base_score || plugin.cvss_base_score || row.cvss3_base_score),
      port: number(port.port || row.port),
      protocol: text(port.protocol || row.protocol),
      service: text(port.service || row.service),
      evidenceSummary: text(row.output || row.plugin_output).slice(0, 3000),
      remediation: text(plugin.solution || row.solution) || "Validate the affected product and apply the vendor-supported remediation.",
      firstObservedAt: iso(row.first_found || row.first_seen),
      lastObservedAt: iso(row.last_found || row.last_seen),
      metadata: { provider: "tenable", pluginId, state: text(row.state), cves }
    };
  });
}

function qualysObservations(xml: string) {
  if (/<!ENTITY/i.test(xml)) throw new Error("Qualys XML entity declarations are not accepted.");
  const parsed = object(xmlParser.parse(xml));
  const root = object(parsed.HOST_LIST_VM_DETECTION_OUTPUT);
  const response = object(root.RESPONSE);
  const hosts = list(object(response.HOST_LIST).HOST);
  const observations: Array<Record<string, unknown>> = [];
  for (const hostValue of hosts) {
    const host = object(hostValue);
    const identifier = text(host.IP || host.IPV6 || object(host.DNS_DATA).FQDN || host.DNS);
    if (!identifier) continue;
    for (const detectionValue of list(object(host.DETECTION_LIST).DETECTION)) {
      const detection = object(detectionValue);
      const qid = text(detection.QID || detection.UNIQUE_VULN_ID);
      if (!qid) continue;
      observations.push({
        assetIdentifier: identifier,
        assetName: text(object(host.DNS_DATA).FQDN || host.DNS) || identifier,
        assetKind: "host",
        title: `Qualys QID ${qid}`,
        description: `Qualys reported QID ${qid} with status ${text(detection.STATUS) || "unknown"}.`,
        severity: severity(detection.SEVERITY),
        confidence: text(detection.TYPE).toLowerCase() === "confirmed" ? "validated" : "likely",
        sourceReference: `qualys:${qid}:${text(detection.UNIQUE_VULN_ID) || identifier}:${text(detection.PORT) || "0"}`,
        port: number(detection.PORT),
        protocol: text(detection.PROTOCOL),
        service: text(detection.SERVICE),
        evidenceSummary: text(detection.RESULTS).slice(0, 3000),
        remediation: "Correlate the QID with the Qualys KnowledgeBase, apply the supported remediation, and verify the host detection state.",
        firstObservedAt: iso(detection.FIRST_FOUND_DATETIME),
        lastObservedAt: iso(detection.LAST_FOUND_DATETIME),
        metadata: { provider: "qualys", qid, qds: number(detection.QDS), status: text(detection.STATUS) }
      });
      if (observations.length >= 5000) return observations;
    }
  }
  return observations;
}

function rapid7Observations(asset: Record<string, unknown>, records: unknown[]) {
  const identifier = text(asset.ip || asset.address || asset.hostName || asset.id);
  return records.slice(0, 5000).map((value, index) => {
    const row = object(value);
    const vulnerability = object(row.vulnerability);
    const id = text(vulnerability.id || row.id) || `finding-${index + 1}`;
    return {
      assetIdentifier: identifier,
      assetName: text(asset.hostName || asset.host_name) || identifier,
      assetKind: "host",
      title: text(vulnerability.title || row.title) || `Rapid7 vulnerability ${id}`,
      description: text(vulnerability.description || row.description) || "Rapid7 reported a vulnerability observation for this asset.",
      severity: severity(vulnerability.severity || row.severity),
      confidence: "likely",
      sourceReference: `rapid7:${id}:${text(asset.id) || identifier}:${text(row.port) || "0"}`,
      advisoryExternalId: list(vulnerability.cves || row.cves).map(text).find((item) => /^CVE-/i.test(item)) || "",
      cvssScore: number(vulnerability.cvssScore || row.cvssScore),
      port: number(row.port),
      protocol: text(row.protocol),
      service: text(row.service),
      evidenceSummary: text(row.proof || row.evidence).slice(0, 3000),
      remediation: text(vulnerability.solution || row.solution) || "Validate the finding and apply the vendor-supported remediation.",
      firstObservedAt: iso(row.firstFound || row.first_found),
      lastObservedAt: iso(row.lastFound || row.last_found),
      metadata: { provider: "rapid7", vulnerabilityId: id }
    };
  });
}

async function initiateTenable(connector: { baseUrl: string; credentialRef: string; syncMode: string; cursor: Prisma.JsonValue | null }) {
  const { values } = connectorSecrets("tenable", connector.credentialRef);
  const cursor = object(connector.cursor);
  const since = connector.syncMode === "differential" && cursor.lastSuccessfulAt ? Math.floor(new Date(text(cursor.lastSuccessfulAt)).getTime() / 1000) : undefined;
  const response = await guardedFetch(connector.baseUrl, "/vulns/export", {
    method: "POST",
    headers: { accept: "application/json", "content-type": "application/json", "X-ApiKeys": `accessKey=${values.ACCESS_KEY};secretKey=${values.SECRET_KEY}` },
    body: JSON.stringify({ num_assets: 500, filters: { ...(since ? { since } : {}), state: ["OPEN", "REOPENED", "FIXED"], severity: ["LOW", "MEDIUM", "HIGH", "CRITICAL"] } })
  });
  if (!response.ok) throw new Error(`Tenable export request returned ${response.status}.`);
  const payload = await response.json() as { export_uuid?: string };
  if (!payload.export_uuid) throw new Error("Tenable did not return an export UUID.");
  return payload.export_uuid;
}

async function pollTenable(connector: { baseUrl: string; credentialRef: string }, remoteJobId: string) {
  const { values } = connectorSecrets("tenable", connector.credentialRef);
  const headers = { accept: "application/json", "X-ApiKeys": `accessKey=${values.ACCESS_KEY};secretKey=${values.SECRET_KEY}` };
  const response = await guardedFetch(connector.baseUrl, `/vulns/export/${encodeURIComponent(remoteJobId)}/status`, { headers });
  if (!response.ok) throw new Error(`Tenable export status returned ${response.status}.`);
  const status = await response.json() as { status?: string; chunks_available?: number[] };
  if (String(status.status).toUpperCase() !== "FINISHED") return { ready: false, observations: [] as unknown[] };
  const observations: unknown[] = [];
  for (const chunk of (status.chunks_available || []).slice(0, 20)) {
    const chunkResponse = await guardedFetch(connector.baseUrl, `/vulns/export/${encodeURIComponent(remoteJobId)}/chunks/${chunk}`, { headers });
    if (!chunkResponse.ok) throw new Error(`Tenable chunk ${chunk} returned ${chunkResponse.status}.`);
    const payload = await chunkResponse.json();
    observations.push(...list(payload));
    if (observations.length >= 5000) break;
  }
  return { ready: true, observations: tenableObservations(observations) };
}

async function fetchQualys(connector: { baseUrl: string; credentialRef: string; syncMode: string; cursor: Prisma.JsonValue | null }) {
  const { values } = connectorSecrets("qualys", connector.credentialRef);
  const cursor = object(connector.cursor);
  const params = new URLSearchParams({ action: "list", show_results: "1", show_qds: "1", truncation_limit: "5000" });
  if (connector.syncMode === "differential" && cursor.lastSuccessfulAt) params.set("detection_updated_since", text(cursor.lastSuccessfulAt));
  const response = await guardedFetch(connector.baseUrl, `/api/2.0/fo/asset/host/vm/detection/?${params}`, {
    headers: { accept: "application/xml", authorization: `Basic ${Buffer.from(`${values.USERNAME}:${values.PASSWORD}`).toString("base64")}`, "X-Requested-With": "QCS VerifyGrid" }
  });
  if (!response.ok) throw new Error(`Qualys host detection returned ${response.status}.`);
  return qualysObservations(await response.text());
}

async function fetchRapid7(connector: { baseUrl: string; credentialRef: string }) {
  const { values } = connectorSecrets("rapid7", connector.credentialRef);
  const headers = { accept: "application/json", authorization: `Basic ${Buffer.from(`${values.USERNAME}:${values.PASSWORD}`).toString("base64")}` };
  const assetsResponse = await guardedFetch(connector.baseUrl, "/api/3/assets?size=50&page=0&sort=id,asc", { headers });
  if (!assetsResponse.ok) throw new Error(`Rapid7 asset list returned ${assetsResponse.status}.`);
  const assetsPayload = await assetsResponse.json() as { resources?: unknown[] };
  const observations: unknown[] = [];
  for (const assetValue of (assetsPayload.resources || []).slice(0, 50)) {
    const asset = object(assetValue);
    const assetId = text(asset.id);
    if (!assetId) continue;
    const findingsResponse = await guardedFetch(connector.baseUrl, `/api/3/assets/${encodeURIComponent(assetId)}/vulnerabilities?size=100&page=0`, { headers });
    if (!findingsResponse.ok) throw new Error(`Rapid7 asset vulnerabilities returned ${findingsResponse.status}.`);
    const findingsPayload = await findingsResponse.json() as { resources?: unknown[] };
    observations.push(...rapid7Observations(asset, findingsPayload.resources || []));
    if (observations.length >= 5000) break;
  }
  return observations.slice(0, 5000);
}

async function executeRun(run: ConnectorRunWithProfile) {
  const connector = run.connector as {
    id: string;
    provider: VerifyGridConnectorProvider;
    baseUrl: string;
    credentialRef: string;
    syncMode: string;
    cursor: Prisma.JsonValue | null;
    engagementId: string | null;
  };
  if (!connector.engagementId) throw new Error("Connector has no default engagement.");
  if (connectorProviderCatalog[connector.provider].mode === "sensor_api") return { status: "awaiting_sensor", remoteJobId: run.remoteJobId, summary: { mode: "sensor_api" } };
  await assertPublicCloudOrigin(connector.baseUrl);
  if (connector.provider === "tenable") {
    if (!run.remoteJobId) return { status: "waiting_remote", remoteJobId: await initiateTenable(connector), summary: { phase: "export_requested" } };
    const polled = await pollTenable(connector, run.remoteJobId);
    if (!polled.ready) return { status: "waiting_remote", remoteJobId: run.remoteJobId, summary: { phase: "export_processing" } };
    return importConnectorObservations(run, "tenable_api", polled.observations);
  }
  if (connector.provider === "qualys") return importConnectorObservations(run, "qualys_api", await fetchQualys(connector));
  if (connector.provider === "rapid7") return importConnectorObservations(run, "rapid7_api", await fetchRapid7(connector));
  throw new Error("Greenbone GMP synchronization requires the outbound sensor connector runtime.");
}

async function importConnectorObservations(run: { id: string; engagementId: string; connector: { provider: string } }, connector: "tenable_api" | "qualys_api" | "rapid7_api" | "greenbone_api", observations: unknown[]) {
  if (!observations.length) return { status: "completed", remoteJobId: null, summary: { observations: 0, message: "The connector returned no changed observations." } };
  const content = JSON.stringify({ observations: observations.slice(0, 5000) });
  const imported = await importVerifyGridScannerExport(run.engagementId, {
    connector,
    fileName: `${run.connector.provider}-api-${new Date().toISOString()}.json`,
    content,
    enrich: true
  }, `connector:${run.connector.provider}`);
  return { status: "completed", remoteJobId: null, summary: { observations: observations.length, batchId: imported.batchId } };
}

async function scheduleDueConnectorRuns(limit: number) {
  const prisma = getPrismaClient();
  const due = await prisma.verifyGridConnectorProfile.findMany({ where: { status: "active", nextSyncAt: { lte: new Date() }, engagementId: { not: null } }, orderBy: { nextSyncAt: "asc" }, take: limit });
  for (const connector of due) {
    const active = await prisma.verifyGridConnectorRun.findFirst({ where: { connectorId: connector.id, status: { in: ["queued", "running", "waiting_remote", "retry", "awaiting_sensor"] } } });
    if (!active && connector.engagementId) {
      await prisma.verifyGridConnectorRun.create({
        data: {
          connectorId: connector.id,
          engagementId: connector.engagementId,
          trigger: "scheduled",
          status: connectorProviderCatalog[connector.provider as VerifyGridConnectorProvider].mode === "sensor_api" ? "awaiting_sensor" : "queued",
          cursorBefore: connector.cursor || undefined,
          createdBy: "vercel-cron"
        }
      });
    }
    await prisma.verifyGridConnectorProfile.update({ where: { id: connector.id }, data: { nextSyncAt: new Date(Date.now() + connector.scheduleMinutes * 60_000) } });
  }
  return due.length;
}

async function claimConnectorRun() {
  const prisma = getPrismaClient();
  const now = new Date();
  const candidate = await prisma.verifyGridConnectorRun.findFirst({
    where: {
      status: { in: ["queued", "retry", "waiting_remote"] },
      nextAttemptAt: { lte: now },
      OR: [{ leaseUntil: null }, { leaseUntil: { lt: now } }]
    },
    orderBy: [{ nextAttemptAt: "asc" }, { createdAt: "asc" }]
  });
  if (!candidate) return null;
  const leaseSecret = randomSecret();
  const updated = await prisma.verifyGridConnectorRun.updateMany({
    where: { id: candidate.id, status: candidate.status, OR: [{ leaseUntil: null }, { leaseUntil: { lt: now } }] },
    data: { status: "running", attempt: { increment: 1 }, leaseTokenHash: sha256(leaseSecret), leaseUntil: new Date(Date.now() + 4 * 60_000), startedAt: candidate.startedAt || now, errorMessage: null }
  });
  if (!updated.count) return null;
  return prisma.verifyGridConnectorRun.findUnique({ where: { id: candidate.id }, include: { connector: true } });
}

export async function processVerifyGridConnectorQueue(limit = 3) {
  const prisma = getPrismaClient();
  const scheduled = await scheduleDueConnectorRuns(limit * 2);
  const processed: Array<{ id: string; status: string; error?: string }> = [];
  for (let index = 0; index < limit; index += 1) {
    const run = await claimConnectorRun();
    if (!run) break;
    try {
      const outcome = await executeRun(run);
      const now = new Date();
      if (outcome.status === "waiting_remote") {
        await prisma.verifyGridConnectorRun.update({
          where: { id: run.id },
          data: { status: "waiting_remote", remoteJobId: outcome.remoteJobId, summary: json(outcome.summary), nextAttemptAt: new Date(Date.now() + 60_000), leaseTokenHash: null, leaseUntil: null }
        });
      } else if (outcome.status === "awaiting_sensor") {
        await prisma.verifyGridConnectorRun.update({ where: { id: run.id }, data: { status: "awaiting_sensor", summary: json(outcome.summary), leaseTokenHash: null, leaseUntil: null } });
      } else {
        const cursor = { lastSuccessfulAt: now.toISOString() };
        await prisma.$transaction([
          prisma.verifyGridConnectorRun.update({ where: { id: run.id }, data: { status: "completed", summary: json(outcome.summary), cursorAfter: json(cursor), completedAt: now, leaseTokenHash: null, leaseUntil: null } }),
          prisma.verifyGridConnectorProfile.update({ where: { id: run.connectorId }, data: { cursor: json(cursor), lastSyncAt: now, lastSuccessAt: now, consecutiveFailures: 0, lastError: null, status: "active", nextSyncAt: new Date(Date.now() + run.connector.scheduleMinutes * 60_000) } })
        ]);
      }
      processed.push({ id: run.id, status: outcome.status });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Connector synchronization failed.";
      const exhausted = run.attempt >= run.maxAttempts;
      await prisma.$transaction([
        prisma.verifyGridConnectorRun.update({ where: { id: run.id }, data: { status: exhausted ? "failed" : "retry", errorMessage: message, nextAttemptAt: new Date(Date.now() + retryDelayMinutes(run.attempt) * 60_000), leaseTokenHash: null, leaseUntil: null, completedAt: exhausted ? new Date() : null } }),
        prisma.verifyGridConnectorProfile.update({ where: { id: run.connectorId }, data: { lastSyncAt: new Date(), consecutiveFailures: { increment: 1 }, lastError: message, status: exhausted ? "degraded" : run.connector.status } })
      ]);
      processed.push({ id: run.id, status: exhausted ? "failed" : "retry", error: message });
    }
  }
  return { scheduled, processed };
}

export async function getVerifyGridAutomation(workspaceId: string) {
  const prisma = getPrismaClient();
  const [connectors, sensors, memberships] = await Promise.all([
    prisma.verifyGridConnectorProfile.findMany({ where: { workspaceId }, orderBy: { createdAt: "desc" }, include: { runs: { orderBy: { createdAt: "desc" }, take: 8 } } }),
    prisma.verifyGridSensor.findMany({ where: { workspaceId }, orderBy: { createdAt: "desc" } }),
    prisma.verifyGridMembership.findMany({ where: { workspaceId }, orderBy: { invitedAt: "desc" } })
  ]);
  return {
    connectors: connectors.map((connector) => ({
      id: connector.id,
      engagementId: connector.engagementId || "",
      provider: connector.provider,
      label: connector.label,
      status: connector.status,
      baseUrl: connector.baseUrl,
      credentialRef: connector.credentialRef,
      connectorMode: connectorProviderCatalog[connector.provider as VerifyGridConnectorProvider].mode,
      syncMode: connector.syncMode,
      scheduleMinutes: connector.scheduleMinutes,
      credentialsReady: connectorProviderCatalog[connector.provider as VerifyGridConnectorProvider].mode === "sensor_api" || !connectorEnvironmentKeys(connector.provider as VerifyGridConnectorProvider, connector.credentialRef).some((key) => !process.env[key]?.trim()),
      lastSyncAt: connector.lastSyncAt?.toISOString() || "",
      nextSyncAt: connector.nextSyncAt.toISOString(),
      lastSuccessAt: connector.lastSuccessAt?.toISOString() || "",
      consecutiveFailures: connector.consecutiveFailures,
      lastError: connector.lastError || "",
      runs: connector.runs.map((run) => ({ id: run.id, status: run.status, trigger: run.trigger, attempt: run.attempt, errorMessage: run.errorMessage || "", createdAt: run.createdAt.toISOString(), completedAt: run.completedAt?.toISOString() || "" }))
    })),
    sensors: sensors.map((sensor) => ({ id: sensor.id, name: sensor.name, status: sensor.status, tokenLastFour: sensor.tokenLastFour, capabilities: Array.isArray(sensor.capabilities) ? sensor.capabilities : [], runtimeCapabilities: Array.isArray(sensor.runtimeCapabilities) ? sensor.runtimeCapabilities : [], healthStatus: sensor.healthStatus, lastError: sensor.lastError || "", version: sensor.version || "", region: sensor.region || "", lastSeenAt: sensor.lastSeenAt?.toISOString() || "", createdAt: sensor.createdAt.toISOString() })),
    memberships: memberships.map((membership) => ({ id: membership.id, email: membership.email, displayName: membership.displayName || "", role: membership.role, status: membership.status, invitedAt: membership.invitedAt.toISOString(), acceptedAt: membership.acceptedAt?.toISOString() || "", lastAccessAt: membership.lastAccessAt?.toISOString() || "" }))
  };
}
