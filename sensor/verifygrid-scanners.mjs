import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { XMLParser } from "fast-xml-parser";

const MAX_OUTPUT_BYTES = 2_000_000;
const scannerCommands = {
  network_service_scan: { command: "nmap", versionArgs: ["--version"] },
  web_passive_scan: { command: "zap-baseline.py", versionArgs: ["-h"] },
  template_vulnerability_scan: { command: "nuclei", versionArgs: ["-version"] }
};

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@",
  textNodeName: "#text",
  parseTagValue: false,
  parseAttributeValue: false,
  trimValues: true,
  processEntities: false
});

function values(value) {
  if (value === null || value === undefined) return [];
  return Array.isArray(value) ? value : [value];
}

function object(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function text(value) {
  if (value === null || value === undefined) return "";
  return String(value).replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

function bounded(value, max = 3000) {
  return text(value).slice(0, max);
}

function severity(value) {
  const normalized = text(value).toLowerCase();
  if (normalized.includes("critical") || normalized === "4") return "critical";
  if (normalized.includes("high") || normalized === "3") return "high";
  if (normalized.includes("medium") || normalized === "2") return "medium";
  if (normalized.includes("low") || normalized === "1") return "low";
  return "informational";
}

function runCommand(command, args, options = {}) {
  const allowedExitCodes = options.allowedExitCodes || [0];
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd,
      env: { ...process.env, ...(options.env || {}) },
      detached: process.platform !== "win32",
      shell: false,
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"]
    });
    let stdout = "";
    let stderr = "";
    let settled = false;
    let stopError = null;
    let hardStop;
    const finish = (error, result) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      clearTimeout(hardStop);
      options.signal?.removeEventListener("abort", onAbort);
      if (error) reject(error);
      else resolve(result);
    };
    const terminate = (signal) => {
      try {
        if (process.platform !== "win32" && child.pid) process.kill(-child.pid, signal);
        else child.kill(signal);
      } catch {
        child.kill(signal);
      }
    };
    const stop = (reason) => {
      if (settled || stopError) return;
      stopError = new Error(reason);
      terminate("SIGTERM");
      hardStop = setTimeout(() => terminate("SIGKILL"), 5000);
      hardStop.unref();
    };
    const onAbort = () => stop("Scanner execution was cancelled by the control plane.");
    const timeout = setTimeout(() => stop(`Scanner ${command} exceeded its execution timeout.`), options.timeoutMs || 10 * 60_000);
    timeout.unref();
    options.signal?.addEventListener("abort", onAbort, { once: true });
    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString("utf8");
      if (Buffer.byteLength(stdout) > MAX_OUTPUT_BYTES) stop(`Scanner ${command} exceeded the stdout limit.`);
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString("utf8");
      if (Buffer.byteLength(stderr) > MAX_OUTPUT_BYTES) stop(`Scanner ${command} exceeded the stderr limit.`);
    });
    child.once("error", (error) => finish(error));
    child.once("close", (code) => {
      if (stopError) return finish(stopError);
      if (!allowedExitCodes.includes(code ?? -1)) return finish(new Error(`${command} exited with ${code}: ${bounded(stderr || stdout, 800)}`));
      finish(null, { code, stdout, stderr });
    });
  });
}

async function commandAvailable(command, versionArgs) {
  try {
    await runCommand(command, versionArgs, { timeoutMs: 15_000, allowedExitCodes: [0, 1, 2] });
    return true;
  } catch {
    return false;
  }
}

export async function detectScannerCapabilities() {
  const entries = await Promise.all(Object.entries(scannerCommands).map(async ([capability, scanner]) => [capability, await commandAvailable(scanner.command, scanner.versionArgs)]));
  return entries.filter(([, available]) => available).map(([capability]) => capability);
}

export function isScannerCapability(value) {
  return Object.hasOwn(scannerCommands, value);
}

function nmapRisk(service, port) {
  const clearText = new Set([21, 23, 110, 143, 512, 513, 514]);
  const sensitive = new Set([111, 135, 139, 445, 1433, 1521, 2049, 2375, 3306, 3389, 5432, 5900, 6379, 9200, 11211, 27017]);
  if (clearText.has(port) || ["telnet", "rlogin", "rexec"].includes(service)) return "high";
  if (sensitive.has(port)) return "medium";
  return "informational";
}

export function parseNmapXml(content, target) {
  if (/<!ENTITY/i.test(content)) throw new Error("Nmap XML entity declarations are not accepted.");
  const parsed = object(xmlParser.parse(content));
  const hosts = values(object(parsed.nmaprun).host);
  const observations = [];
  for (const hostValue of hosts) {
    const host = object(hostValue);
    const address = values(host.address).map(object).find((item) => item["@addrtype"] === "ipv4" || item["@addrtype"] === "ipv6");
    const identifier = text(address?.["@addr"] || target.identifier);
    for (const portValue of values(object(host.ports).port)) {
      const port = object(portValue);
      const state = text(object(port.state)["@state"]);
      if (state !== "open") continue;
      const service = object(port.service);
      const portNumber = Number(port["@portid"] || 0);
      const serviceName = text(service["@name"] || "unknown");
      const product = [service["@product"], service["@version"], service["@extrainfo"]].map(text).filter(Boolean).join(" ");
      const scripts = values(port.script).map((entry) => ({ id: text(object(entry)["@id"]), output: bounded(object(entry)["@output"], 1000) })).filter((entry) => entry.id);
      observations.push({
        assetIdentifier: identifier,
        assetName: target.host,
        assetKind: "host",
        title: `${serviceName.toUpperCase()} service exposed on TCP ${portNumber}`,
        description: `Nmap completed bounded TCP connect and light service detection for the explicitly authorized host. ${product ? `The service identified itself as ${product}.` : "No reliable product version was returned."}`,
        severity: nmapRisk(serviceName, portNumber),
        confidence: "validated",
        sourceReference: `sensor:nmap:${identifier}:tcp:${portNumber}:${serviceName}`,
        port: portNumber,
        protocol: "tcp",
        service: serviceName,
        evidenceSummary: JSON.stringify({ state, service: serviceName, product, scripts }).slice(0, 3000),
        remediation: "Confirm that the exposed service is required, restricted to approved source networks, securely configured, patched, monitored, and owned.",
        lastObservedAt: new Date().toISOString(),
        metadata: { scanner: "nmap", product, scripts }
      });
    }
  }
  return observations;
}

export function parseZapJson(content, target) {
  const payload = object(JSON.parse(content));
  const observations = [];
  for (const siteValue of values(payload.site)) {
    const site = object(siteValue);
    for (const alertValue of values(site.alerts)) {
      const alert = object(alertValue);
      const pluginId = text(alert.pluginid || alert.alertRef || alert.cweid || "unknown");
      const instance = object(values(alert.instances)[0]);
      const location = text(instance.uri || site["@name"] || target.url.href);
      observations.push({
        assetIdentifier: target.identifier,
        assetName: target.host,
        assetKind: "application",
        title: bounded(alert.alert || alert.name || `ZAP passive alert ${pluginId}`, 220),
        description: bounded(alert.desc || "OWASP ZAP reported a passive web-security observation.", 4000),
        severity: severity(alert.riskdesc || alert.riskcode),
        confidence: text(alert.confidence).toLowerCase().includes("false") ? "unverified" : "likely",
        sourceReference: `sensor:zap:${pluginId}:${location}`,
        port: target.port,
        protocol: target.url.protocol.replace(":", ""),
        service: "web application",
        evidenceSummary: JSON.stringify({ location, method: instance.method || "", parameter: instance.param || "", evidence: bounded(instance.evidence, 800), cweId: alert.cweid || "", wascId: alert.wascid || "" }).slice(0, 3000),
        remediation: bounded(alert.solution || "Review the affected response and implement the control recommended by OWASP ZAP.", 3000),
        lastObservedAt: new Date().toISOString(),
        metadata: { scanner: "owasp-zap", pluginId, location, reference: bounded(alert.reference, 1000) }
      });
    }
  }
  return observations;
}

export function parseNucleiJsonl(content, target) {
  const observations = [];
  for (const line of content.split(/\r?\n/).filter(Boolean).slice(0, 5000)) {
    const row = object(JSON.parse(line));
    const info = object(row.info);
    const classification = object(info.classification);
    const templateId = text(row["template-id"] || row.templateID || "unknown");
    const matchedAt = text(row["matched-at"] || row.matched || row.host || target.url.href);
    const cves = values(classification["cve-id"] || classification.cveId).map(text).filter(Boolean);
    observations.push({
      assetIdentifier: target.identifier,
      assetName: target.host,
      assetKind: "application",
      title: bounded(info.name || templateId, 220),
      description: bounded(info.description || `The signed Nuclei template ${templateId} matched the authorized target.`, 4000),
      severity: severity(info.severity),
      confidence: "likely",
      sourceReference: `sensor:nuclei:${templateId}:${matchedAt}`,
      advisoryExternalId: cves.find((item) => /^CVE-/i.test(item)) || "",
      cvssScore: Number(classification["cvss-score"] || classification.cvssScore) || undefined,
      port: Number(row.port) || target.port,
      protocol: text(row.type || target.url.protocol.replace(":", "")),
      service: "template validation",
      evidenceSummary: JSON.stringify({ matchedAt, matcher: row["matcher-name"] || "", extracted: values(row["extracted-results"]).map(text).slice(0, 10), cves }).slice(0, 3000),
      remediation: bounded(info.remediation || info["remediation-summary"] || "Validate the affected component and apply the vendor-supported remediation before retesting.", 3000),
      lastObservedAt: text(row.timestamp) || new Date().toISOString(),
      metadata: { scanner: "nuclei", templateId, matchedAt, tags: values(info.tags).map(text).slice(0, 30), references: values(info.reference).map(text).slice(0, 20) }
    });
  }
  return observations;
}

async function withWorkspace(prefix, callback) {
  const directory = await mkdtemp(path.join(os.tmpdir(), prefix));
  try {
    return await callback(directory);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

async function runNmap(target, controls, signal) {
  return withWorkspace("verifygrid-nmap-", async (directory) => {
    const output = path.join(directory, "result.xml");
    await runCommand("nmap", ["-sT", "-Pn", "--top-ports", "100", "-sV", "--version-light", "--script", "safe and not (external or broadcast)", "-T3", "--max-rate", String(controls.maxRequestsPerSecond), "--max-retries", "2", "--host-timeout", "10m", "-oX", output, target.host], { signal, timeoutMs: 12 * 60_000 });
    return parseNmapXml(await readFile(output, "utf8"), target);
  });
}

async function runZap(target, signal) {
  return withWorkspace("verifygrid-zap-", async (directory) => {
    const output = path.join(directory, "result.json");
    await runCommand("zap-baseline.py", ["-t", target.url.href, "-m", "1", "-J", output, "-I", "-T", "5", "-s", "--auto"], { cwd: directory, signal, timeoutMs: 8 * 60_000, allowedExitCodes: [0, 1, 2] });
    return parseZapJson(await readFile(output, "utf8"), target);
  });
}

async function runNuclei(target, controls, signal) {
  return withWorkspace("verifygrid-nuclei-", async (directory) => {
    const output = path.join(directory, "result.jsonl");
    await runCommand("nuclei", ["-u", target.url.href, "-t", "/opt/verifygrid/nuclei-templates", "-tags", "cve,misconfig,exposure,ssl,tech", "-etags", "dos,fuzz,brute,headless,code,file,intrusive", "-ept", "headless,code,file,javascript", "-dut", "-ni", "-rl", String(controls.maxRequestsPerSecond), "-bs", "1", "-c", "2", "-timeout", "10", "-retries", "1", "-mhe", "3", "-jle", output, "-omit-raw", "-ot", "-nm", "-nc", "-duc"], { cwd: directory, signal, timeoutMs: 15 * 60_000 });
    return parseNucleiJsonl(await readFile(output, "utf8"), target);
  });
}

export async function runScannerCapability(capability, target, controls, signal) {
  let observations;
  if (capability === "network_service_scan") observations = await runNmap(target, controls, signal);
  else if (capability === "web_passive_scan") observations = await runZap(target, signal);
  else if (capability === "template_vulnerability_scan") observations = await runNuclei(target, controls, signal);
  else throw new Error("The requested scanner capability is not installed in this runtime.");
  if (observations.length) return observations;
  return [{
    assetIdentifier: target.identifier,
    assetName: target.host,
    assetKind: capability === "network_service_scan" ? "host" : "application",
    title: "Authorized scanner completed without reportable matches",
    description: "The bounded scanner profile completed for the explicit authorized target and returned no reportable observations. This result is not proof that the target is vulnerability-free.",
    severity: "informational",
    confidence: "validated",
    sourceReference: `sensor:${capability}:complete:${target.identifier}`,
    port: target.port,
    protocol: capability === "network_service_scan" ? "tcp" : target.url.protocol.replace(":", ""),
    service: capability.replace(/_/g, " "),
    evidenceSummary: JSON.stringify({ capability, completedAt: new Date().toISOString(), reportableMatches: 0 }),
    remediation: "Retain this evidence with the assessment record and continue analyst-led testing against the agreed methodology.",
    lastObservedAt: new Date().toISOString(),
    metadata: { scanner: capability, reportableMatches: 0 }
  }];
}
