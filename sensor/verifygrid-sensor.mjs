import crypto from "node:crypto";
import dns from "node:dns/promises";
import net from "node:net";
import tls from "node:tls";
import { detectScannerCapabilities, isScannerCapability, runScannerCapability } from "./verifygrid-scanners.mjs";

const VERSION = "2.0.0";
const BUILTIN_CAPABILITIES = ["asset_inventory", "dns_posture", "tls_posture", "tcp_service_validation", "http_security_headers"];
const baseUrl = String(process.env.VERIFYGRID_BASE_URL || "").replace(/\/$/, "");
const token = String(process.env.VERIFYGRID_SENSOR_TOKEN || "");
const region = String(process.env.VERIFYGRID_SENSOR_REGION || "customer-network").slice(0, 80);
const pollSeconds = Math.max(15, Math.min(300, Number(process.env.VERIFYGRID_POLL_SECONDS || 30)));
const once = process.env.VERIFYGRID_SENSOR_ONCE === "1";
let stopping = false;

function failStartup(message) {
  process.stderr.write(`${message}\n`);
  process.exit(1);
}

if (!/^https:\/\//.test(baseUrl)) failStartup("VERIFYGRID_BASE_URL must be an HTTPS origin.");
const tokenMatch = /^vg_sensor_[a-zA-Z0-9_-]{8,80}\.([a-zA-Z0-9_-]{32,})$/.exec(token);
if (!tokenMatch) failStartup("VERIFYGRID_SENSOR_TOKEN is missing or malformed.");
const tokenSecret = tokenMatch[1];
const scannerCapabilities = await detectScannerCapabilities();
const runtimeCapabilities = [...BUILTIN_CAPABILITIES, ...scannerCapabilities];
const ALLOWED_CAPABILITIES = new Set(runtimeCapabilities);

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).sort(([left], [right]) => left.localeCompare(right)).map(([key, child]) => [key, canonical(child)]));
  return value;
}

function canonicalJson(value) {
  return JSON.stringify(canonical(value));
}

function sha256(value) {
  return crypto.createHash("sha256").update(value, "utf8").digest("hex");
}

function safeEqual(left, right) {
  const first = Buffer.from(left);
  const second = Buffer.from(right);
  return first.length === second.length && crypto.timingSafeEqual(first, second);
}

function api(path, body) {
  return fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
      "x-verifygrid-sensor-version": VERSION,
      "x-verifygrid-sensor-region": region,
      "x-verifygrid-sensor-capabilities": runtimeCapabilities.join(",")
    },
    body: JSON.stringify(body || {}),
    signal: AbortSignal.timeout(30_000)
  });
}

function wait(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function targetEndpoint(target) {
  const type = String(target.type || "").toLowerCase();
  const value = String(target.value || "").trim();
  if (!value || type === "cidr") throw new Error("The safe sensor requires explicit host, IP, domain, or URL targets and never expands CIDRs.");
  if (type === "url" || /^https?:\/\//i.test(value)) {
    const url = new URL(value);
    if (!["http:", "https:"].includes(url.protocol)) throw new Error("Only HTTP and HTTPS URLs are supported by built-in probes.");
    return { identifier: value, host: url.hostname, port: Number(url.port || (url.protocol === "https:" ? 443 : 80)), url, type };
  }
  const host = value.replace(/^\[|\]$/g, "");
  if (host.includes("/") || (!net.isIP(host) && !/^(?=.{1,253}$)(?!-)[a-z0-9.-]+(?<!-)$/i.test(host))) throw new Error("Target is not an explicit host, IP, domain, or URL.");
  return { identifier: value, host, port: 443, url: new URL(`https://${net.isIPv6(host) ? `[${host}]` : host}/`), type };
}

function observation(target, input) {
  return {
    assetIdentifier: target.identifier,
    assetName: target.host,
    assetKind: input.assetKind || "host",
    title: input.title,
    description: input.description,
    severity: input.severity || "informational",
    confidence: input.confidence || "validated",
    sourceReference: input.sourceReference,
    port: input.port ?? null,
    protocol: input.protocol || "",
    service: input.service || "",
    evidenceSummary: input.evidenceSummary || "",
    remediation: input.remediation || "Retain the approved control and review this evidence during the next assurance cycle.",
    lastObservedAt: new Date().toISOString(),
    metadata: { sensorVersion: VERSION, capability: input.capability, ...input.metadata }
  };
}

async function resolveRecords(host) {
  const settled = await Promise.allSettled([dns.resolve4(host), dns.resolve6(host), dns.resolveNs(host), dns.resolveMx(host), dns.resolveTxt(host), dns.resolveCaa(host)]);
  const values = settled.map((item) => item.status === "fulfilled" ? item.value : []);
  return { ipv4: values[0], ipv6: values[1], ns: values[2], mx: values[3], txt: values[4], caa: values[5] };
}

async function assetInventory(target, capability) {
  const records = net.isIP(target.host) ? { ipv4: net.isIPv4(target.host) ? [target.host] : [], ipv6: net.isIPv6(target.host) ? [target.host] : [], ns: [], mx: [], txt: [], caa: [] } : await resolveRecords(target.host);
  return observation(target, {
    capability,
    title: "Authorized asset identity observed",
    description: "The customer sensor reconciled the explicit target without expanding the approved scope.",
    sourceReference: `sensor:asset:${target.host}`,
    protocol: "dns",
    service: "asset inventory",
    evidenceSummary: JSON.stringify({ ipv4: records.ipv4, ipv6: records.ipv6 }).slice(0, 3000),
    metadata: { addresses: [...records.ipv4, ...records.ipv6] }
  });
}

async function dnsPosture(target, capability) {
  if (net.isIP(target.host)) throw new Error("DNS posture requires a domain or host name target.");
  const records = await resolveRecords(target.host);
  const missingAuthority = !records.ns.length;
  return observation(target, {
    capability,
    title: missingAuthority ? "Authoritative DNS records were not resolved" : "DNS posture evidence collected",
    description: missingAuthority ? "The sensor could not resolve authoritative name-server records for the approved target." : "The sensor collected bounded public DNS posture evidence for the approved target.",
    severity: missingAuthority ? "medium" : "informational",
    sourceReference: `sensor:dns:${target.host}`,
    protocol: "dns",
    service: "DNS posture",
    evidenceSummary: JSON.stringify(records).slice(0, 3000),
    remediation: missingAuthority ? "Confirm domain delegation, authoritative name servers, and the intended DNS lifecycle." : "Review delegation, DNSSEC, CAA, and mail-authentication policy against the service owner’s requirements.",
    metadata: { recordCounts: Object.fromEntries(Object.entries(records).map(([key, value]) => [key, value.length])) }
  });
}

async function tlsPosture(target, capability) {
  const details = await new Promise((resolve, reject) => {
    const socket = tls.connect({ host: target.host, port: target.port, servername: net.isIP(target.host) ? undefined : target.host, rejectUnauthorized: false, timeout: 10_000 }, () => {
      const certificate = socket.getPeerCertificate();
      const authorized = socket.authorized;
      const result = { authorized, authorizationError: socket.authorizationError || "", protocol: socket.getProtocol() || "", cipher: socket.getCipher()?.name || "", subject: certificate.subject || {}, issuer: certificate.issuer || {}, validFrom: certificate.valid_from || "", validTo: certificate.valid_to || "", fingerprint256: certificate.fingerprint256 || "" };
      socket.end();
      resolve(result);
    });
    socket.once("timeout", () => socket.destroy(new Error("TLS connection timed out.")));
    socket.once("error", reject);
  });
  const expiry = new Date(details.validTo).getTime();
  const expiring = Number.isFinite(expiry) && expiry < Date.now() + 30 * 24 * 60 * 60_000;
  const severity = !details.authorized ? "high" : expiring ? "medium" : "informational";
  return observation(target, {
    capability,
    title: !details.authorized ? "TLS trust validation failed" : expiring ? "TLS certificate expires within 30 days" : "TLS posture evidence collected",
    description: "The sensor completed a bounded TLS handshake and recorded certificate and negotiated-protocol evidence.",
    severity,
    sourceReference: `sensor:tls:${target.host}:${target.port}`,
    port: target.port,
    protocol: "tcp",
    service: "tls",
    evidenceSummary: JSON.stringify(details).slice(0, 3000),
    remediation: severity === "informational" ? "Continue certificate lifecycle monitoring and retain a supported TLS policy." : "Replace or repair the certificate chain and confirm the approved hostname, validity window, and trust anchors.",
    metadata: details
  });
}

async function tcpValidation(target, capability) {
  const elapsed = Date.now();
  await new Promise((resolve, reject) => {
    const socket = net.connect({ host: target.host, port: target.port, timeout: 7000 }, () => { socket.end(); resolve(); });
    socket.once("timeout", () => socket.destroy(new Error("TCP connection timed out.")));
    socket.once("error", reject);
  });
  return observation(target, {
    capability,
    title: "Explicit TCP service responded",
    description: "The sensor validated only the port encoded by the approved URL or the default HTTPS port for the explicit host.",
    sourceReference: `sensor:tcp:${target.host}:${target.port}`,
    port: target.port,
    protocol: "tcp",
    service: "service validation",
    evidenceSummary: `Connection completed in ${Date.now() - elapsed} ms.`,
    metadata: { latencyMs: Date.now() - elapsed }
  });
}

async function httpHeaders(target, capability) {
  const response = await fetch(target.url, { method: "HEAD", redirect: "manual", cache: "no-store", signal: AbortSignal.timeout(10_000), headers: { "user-agent": `QCS-VerifyGrid-Sensor/${VERSION}` } });
  const headers = Object.fromEntries([...response.headers.entries()].filter(([name]) => ["content-security-policy", "strict-transport-security", "x-content-type-options", "referrer-policy", "permissions-policy", "x-frame-options", "location"].includes(name)));
  const required = target.url.protocol === "https:" ? ["strict-transport-security", "x-content-type-options"] : ["x-content-type-options"];
  const missing = required.filter((name) => !headers[name]);
  return observation(target, {
    capability,
    assetKind: "application",
    title: missing.length ? "Expected HTTP security headers are absent" : "HTTP security header evidence collected",
    description: "The sensor used an idempotent HEAD request with redirects disabled and retained only selected response headers.",
    severity: missing.length ? "low" : "informational",
    sourceReference: `sensor:http:${target.url.origin}${target.url.pathname}`,
    port: target.port,
    protocol: target.url.protocol.replace(":", ""),
    service: "HTTP security headers",
    evidenceSummary: JSON.stringify({ status: response.status, headers, missing }).slice(0, 3000),
    remediation: missing.length ? `Add and validate the intended ${missing.join(", ")} policy without breaking approved application flows.` : "Continue monitoring security headers and redirect behavior after application or edge changes.",
    metadata: { status: response.status, headers, missing }
  });
}

async function runTarget(capability, target, controls, signal) {
  if (isScannerCapability(capability)) {
    if (["web_passive_scan", "template_vulnerability_scan"].includes(capability) && target.type !== "url") throw new Error("Web scanner capabilities require an explicit in-scope URL target.");
    return runScannerCapability(capability, target, controls, signal);
  }
  if (capability === "asset_inventory") return assetInventory(target, capability);
  if (capability === "dns_posture") return dnsPosture(target, capability);
  if (capability === "tls_posture") return tlsPosture(target, capability);
  if (capability === "tcp_service_validation") return tcpValidation(target, capability);
  if (capability === "http_security_headers") return httpHeaders(target, capability);
  throw new Error("Capability is not available in the non-destructive sensor runtime.");
}

function validateJob(job) {
  const manifest = job?.manifest;
  const canonicalManifest = canonicalJson(manifest);
  if (!manifest || manifest.schema !== "qcs.verifygrid.execution-manifest.v1") throw new Error("Unsupported execution manifest schema.");
  if (!safeEqual(sha256(canonicalManifest), String(job.manifestSha256 || ""))) throw new Error("Execution manifest SHA-256 validation failed.");
  const expectedSignature = crypto.createHmac("sha256", tokenSecret).update(canonicalManifest, "utf8").digest("base64url");
  if (!safeEqual(expectedSignature, String(job.signature || ""))) throw new Error("Execution manifest signature validation failed.");
  if (!ALLOWED_CAPABILITIES.has(manifest.capability?.id)) throw new Error("The manifest capability is not available in this sensor runtime.");
  const controls = manifest.controls || {};
  if (!controls.nonDestructive || controls.persistenceAllowed || controls.credentialHarvestingAllowed || controls.denialOfServiceAllowed || controls.thirdPartyTargetsAllowed || controls.dispatchPolicy !== "outbound_sensor_only") throw new Error("Execution controls do not satisfy the sensor safety policy.");
  const approval = controls.approval || {};
  if (manifest.capability?.humanApprovalRequired && (!approval.required || !approval.approvedBy || !approval.approvedAt || !/^[a-f0-9]{64}$/i.test(String(approval.noteSha256 || "")))) throw new Error("Controlled validation requires a signed approval record in the manifest.");
  const now = Date.now();
  if (now < new Date(controls.requestedStartAt).getTime() || now > new Date(controls.validUntil).getTime()) throw new Error("Execution manifest is outside its authorized time window.");
  if (!Number.isInteger(controls.maxRequestsPerSecond) || controls.maxRequestsPerSecond < 1 || controls.maxRequestsPerSecond > 100) throw new Error("Execution request ceiling is invalid.");
  if (!Array.isArray(manifest.targets) || !manifest.targets.length || manifest.targets.length > 50) throw new Error("Execution target set is invalid.");
  return manifest;
}

async function handleJob(job) {
  const manifest = validateJob(job);
  const controller = new AbortController();
  const heartbeatCall = async () => {
    try {
      const response = await api("/api/verifygrid/sensor/jobs/heartbeat", { jobId: job.id, state: "running", version: VERSION, region });
      if (!response.ok) controller.abort();
      return response;
    } catch (error) {
      controller.abort();
      throw error;
    }
  };
  const heartbeat = setInterval(() => heartbeatCall().catch(() => {}), Math.max(15, Number(job.heartbeatSeconds || 60)) * 1000);
  try {
    const initialHeartbeat = await heartbeatCall();
    if (!initialHeartbeat.ok) throw new Error("The execution lease was stopped before scanner startup.");
    const observations = [];
    const delay = Math.ceil(1000 / manifest.controls.maxRequestsPerSecond);
    for (const targetValue of manifest.targets) {
      if (controller.signal.aborted) throw new Error("Scanner execution was cancelled by the control plane.");
      const target = targetEndpoint(targetValue);
      try {
        const result = await runTarget(manifest.capability.id, target, manifest.controls, controller.signal);
        observations.push(...(Array.isArray(result) ? result : [result]));
      } catch (error) {
        if (controller.signal.aborted) throw error;
        observations.push(observation(target, { capability: manifest.capability.id, title: "Authorized check could not complete", description: error instanceof Error ? error.message : "The bounded check failed.", severity: "low", confidence: "validated", sourceReference: `sensor:error:${manifest.capability.id}:${target.host}`, remediation: "Confirm reachability, target ownership, service state, and the approved execution window before retrying.", metadata: { checkError: true } }));
      }
      await wait(delay);
    }
    const content = JSON.stringify({ observations });
    const response = await api("/api/verifygrid/sensor/jobs/result", { jobId: job.id, manifestSha256: job.manifestSha256, contentSha256: sha256(content), content, summary: { observations: observations.length, capability: manifest.capability.id, sensorVersion: VERSION } });
    if (!response.ok) throw new Error(`Result submission returned ${response.status}: ${(await response.text()).slice(0, 300)}`);
    process.stdout.write(`Completed VerifyGrid job ${job.id} with ${observations.length} observation(s).\n`);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Sensor execution failed.";
    await api("/api/verifygrid/sensor/jobs/failure", { jobId: job.id, manifestSha256: job.manifestSha256, error: message, retryable: !controller.signal.aborted }).catch(() => {});
    process.stderr.write(`VerifyGrid job ${job.id} failed: ${message}\n`);
  } finally {
    clearInterval(heartbeat);
  }
}

async function poll() {
  const response = await api("/api/verifygrid/sensor/jobs/claim", {});
  if (response.status === 401) failStartup("VerifyGrid sensor authentication failed or the sensor was revoked.");
  if (!response.ok) throw new Error(`Job claim returned ${response.status}.`);
  const payload = await response.json();
  if (payload.job) await handleJob(payload.job);
  return Boolean(payload.job);
}

process.on("SIGINT", () => { stopping = true; });
process.on("SIGTERM", () => { stopping = true; });
process.stdout.write(`QCS VerifyGrid sensor ${VERSION} started in ${region} with ${runtimeCapabilities.join(", ")}.\n`);

do {
  try {
    const worked = await poll();
    if (!worked && !once) await wait(pollSeconds * 1000);
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : "Sensor poll failed."}\n`);
    if (!once) await wait(pollSeconds * 1000);
  }
} while (!once && !stopping);
