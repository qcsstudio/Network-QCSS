import crypto from "node:crypto";
import { isIP } from "node:net";
import { parse as parseCsv } from "csv-parse/sync";
import { XMLParser } from "fast-xml-parser";
import { z } from "zod";
import { connectorCatalog, verifyGridConnectors, type VerifyGridConnector } from "./verifygrid-catalog.ts";

export { connectorCatalog, verifyGridConnectors, type VerifyGridConnector } from "./verifygrid-catalog.ts";

export const scannerImportSchema = z.object({
  connector: z.enum(verifyGridConnectors),
  fileName: z.string().trim().min(1).max(260),
  content: z.string().min(1).max(2_000_000),
  enrich: z.boolean().default(true)
});

export const observationPromotionSchema = z.object({
  observationIds: z.array(z.string().trim().min(1)).max(500).optional(),
  minimumSeverity: z.enum(["critical", "high", "medium", "low", "informational"]).default("low"),
  includeInformational: z.boolean().default(false)
});

export type NormalizedObservation = {
  fingerprint: string;
  assetIdentifier: string;
  assetName: string;
  assetKind: string;
  title: string;
  description: string;
  severity: "critical" | "high" | "medium" | "low" | "informational";
  confidence: "unverified" | "likely" | "validated";
  sourceReference: string;
  advisoryExternalId: string;
  cvssScore: number | null;
  epssScore: number | null;
  epssPercentile: number | null;
  knownExploited: boolean;
  port: number | null;
  protocol: string;
  service: string;
  evidenceSummary: string;
  remediation: string;
  rawMetadata: Record<string, unknown>;
  firstObservedAt: Date | null;
  lastObservedAt: Date | null;
};

export type ScopeCandidate = {
  id: string;
  targetType: string;
  value: string;
  environment: string;
  criticality: string;
  permission: string;
  inScope: boolean;
  ownershipConfirmed: boolean;
};

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@",
  textNodeName: "#text",
  parseTagValue: false,
  parseAttributeValue: false,
  trimValues: true,
  processEntities: false,
  allowBooleanAttributes: true
});

const severityRank = { informational: 0, low: 1, medium: 2, high: 3, critical: 4 } as const;

function list<T>(value: T | T[] | null | undefined): T[] {
  if (value === null || value === undefined) return [];
  return Array.isArray(value) ? value : [value];
}

function object(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function plain(value: unknown, max = 5000): string {
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return String(value).replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim().slice(0, max);
  }
  if (Array.isArray(value)) return value.map((item) => plain(item, max)).filter(Boolean).join(" ").slice(0, max);
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    if (record["#text"] !== undefined) return plain(record["#text"], max);
    return Object.entries(record)
      .filter(([key]) => !key.startsWith("@") && !["request", "response"].includes(key))
      .map(([, item]) => plain(item, max))
      .filter(Boolean)
      .join(" ")
      .slice(0, max);
  }
  return "";
}

function boundedText(value: unknown, fallback: string, min = 30, max = 5000) {
  const text = plain(value, max);
  const candidate = text || fallback;
  return candidate.length >= min ? candidate.slice(0, max) : `${candidate} Review the imported scanner evidence and validate this observation in the authorized scope.`.slice(0, max);
}

function numberOrNull(value: unknown, maximum = Number.POSITIVE_INFINITY) {
  const parsed = Number.parseFloat(plain(value, 40));
  return Number.isFinite(parsed) && parsed >= 0 && parsed <= maximum ? parsed : null;
}

function dateOrNull(value: unknown) {
  const text = plain(value, 100);
  if (!text) return null;
  const date = new Date(text);
  return Number.isNaN(date.getTime()) ? null : date;
}

function cveFrom(value: unknown) {
  return plain(value, 1000).match(/CVE-\d{4}-\d{4,}/i)?.[0]?.toUpperCase() || "";
}

function normalizeSeverity(value: unknown): NormalizedObservation["severity"] {
  const normalized = plain(value, 50).toLowerCase().replace(/[^a-z0-9.]/g, "");
  if (["4", "critical", "urgent", "veryhigh"].includes(normalized)) return "critical";
  if (["3", "high", "severe"].includes(normalized)) return "high";
  if (["2", "medium", "moderate"].includes(normalized)) return "medium";
  if (["1", "low"].includes(normalized)) return "low";
  return "informational";
}

function normalizeConfidence(value: unknown): NormalizedObservation["confidence"] {
  const normalized = plain(value, 60).toLowerCase();
  if (["certain", "confirmed", "firm", "validated"].some((token) => normalized.includes(token))) return "validated";
  if (["likely", "tentative", "probable", "high"].some((token) => normalized.includes(token))) return "likely";
  return "unverified";
}

function normalizeAssetIdentifier(value: string) {
  const trimmed = value.trim();
  try {
    const url = new URL(trimmed);
    url.hash = "";
    return url.toString().replace(/\/$/, "");
  } catch {
    return trimmed.toLowerCase().replace(/\.$/, "");
  }
}

function observationFingerprint(connector: VerifyGridConnector, input: Pick<NormalizedObservation, "assetIdentifier" | "title" | "sourceReference" | "port" | "protocol">) {
  return crypto.createHash("sha256").update([
    connector,
    input.assetIdentifier.toLowerCase(),
    input.sourceReference,
    input.title.toLowerCase().replace(/\s+/g, " ").trim(),
    input.port ?? "",
    input.protocol
  ].join("|")).digest("hex");
}

function finishObservation(connector: VerifyGridConnector, input: Omit<NormalizedObservation, "fingerprint">): NormalizedObservation {
  const normalized = {
    ...input,
    assetIdentifier: normalizeAssetIdentifier(input.assetIdentifier),
    assetName: input.assetName.trim().slice(0, 220) || input.assetIdentifier,
    title: input.title.trim().slice(0, 220),
    description: boundedText(input.description, `Scanner observation for ${input.assetIdentifier}.`),
    evidenceSummary: plain(input.evidenceSummary, 3000),
    remediation: boundedText(input.remediation, "Validate the observation, confirm exposure, and apply the vendor-supported least-risk remediation.", 20),
    sourceReference: input.sourceReference.trim().slice(0, 300),
    advisoryExternalId: input.advisoryExternalId.trim().slice(0, 80),
    protocol: input.protocol.trim().toLowerCase().slice(0, 30),
    service: input.service.trim().slice(0, 160)
  };
  return { ...normalized, fingerprint: observationFingerprint(connector, normalized) };
}

function rejectUnsafeXml(content: string) {
  if (/<!ENTITY\s/i.test(content)) throw new Error("XML entity declarations are not accepted in scanner imports.");
}

function parseNmapXml(content: string): NormalizedObservation[] {
  rejectUnsafeXml(content);
  const root = object(xmlParser.parse(content)).nmaprun;
  const nmap = object(root);
  if (!Object.keys(nmap).length) throw new Error("The file is not a valid Nmap XML export.");
  const observations: NormalizedObservation[] = [];
  for (const hostValue of list(nmap.host)) {
    const host = object(hostValue);
    if (plain(object(host.status)["@state"], 30).toLowerCase() === "down") continue;
    const addresses = list(host.address).map(object);
    const address = plain(addresses.find((item) => ["ipv4", "ipv6"].includes(plain(item["@addrtype"], 20)))?.["@addr"], 200);
    const hostname = plain(list(object(host.hostnames).hostname).map(object)[0]?.["@name"], 253);
    const identifier = address || hostname;
    if (!identifier) continue;
    for (const portValue of list(object(host.ports).port)) {
      const port = object(portValue);
      const state = object(port.state);
      const stateName = plain(state["@state"], 40).toLowerCase();
      if (!["open", "open|filtered", "unfiltered"].includes(stateName)) continue;
      const service = object(port.service);
      const portNumber = numberOrNull(port["@portid"], 65535);
      const protocol = plain(port["@protocol"], 20) || "tcp";
      const serviceName = plain(service["@name"], 100) || "unknown";
      const productName = plain(service["@product"], 120);
      const version = plain(service["@version"], 80);
      const product = [productName, version, plain(service["@extrainfo"], 160)].filter(Boolean).join(" ");
      const scripts = list(port.script).map((script) => {
        const item = object(script);
        return `${plain(item["@id"], 100)}: ${plain(item["@output"], 1000)}`;
      }).filter((value) => value !== ": ");
      const title = `Open ${serviceName} service on ${portNumber ?? "unknown"}/${protocol}`;
      observations.push(finishObservation("nmap_xml", {
        assetIdentifier: identifier,
        assetName: hostname || identifier,
        assetKind: "host",
        title,
        description: `${title} was observed in Nmap XML with state ${stateName}. ${product ? `Service fingerprint: ${product}.` : "The service fingerprint was not conclusive."}`,
        severity: "informational",
        confidence: plain(service["@method"], 30) === "probed" ? "likely" : "unverified",
        sourceReference: `nmap:${identifier}:${portNumber ?? "unknown"}/${protocol}`,
        advisoryExternalId: cveFrom(scripts),
        cvssScore: null,
        epssScore: null,
        epssPercentile: null,
        knownExploited: false,
        port: portNumber,
        protocol,
        service: [serviceName, product].filter(Boolean).join(" "),
        evidenceSummary: [`State reason: ${plain(state["@reason"], 100) || "not supplied"}.`, ...scripts].join(" "),
        remediation: "Confirm that the exposed service is required, access-controlled, patched, monitored, and restricted to the smallest necessary source range.",
        rawMetadata: {
          state: stateName,
          reason: plain(state["@reason"], 100),
          serviceConfidence: plain(service["@conf"], 20),
          product: productName,
          version,
          cpe: list(service.cpe).map((item) => plain(item, 300)).filter(Boolean)
        },
        firstObservedAt: dateOrNull(nmap["@startstr"]),
        lastObservedAt: dateOrNull(nmap["@startstr"])
      }));
    }
  }
  return observations;
}

function parseNessusXml(content: string): NormalizedObservation[] {
  rejectUnsafeXml(content);
  const parsed = object(xmlParser.parse(content));
  const report = object(object(parsed.NessusClientData_v2).Report);
  if (!Object.keys(report).length) throw new Error("The file is not a valid Tenable Nessus XML export.");
  const observations: NormalizedObservation[] = [];
  for (const hostValue of list(report.ReportHost)) {
    const host = object(hostValue);
    const properties = new Map(list(object(host.HostProperties).tag).map((value) => {
      const item = object(value);
      return [plain(item["@name"], 100), plain(item["#text"], 500)] as const;
    }));
    const identifier = properties.get("host-ip") || properties.get("host-fqdn") || plain(host["@name"], 253);
    if (!identifier) continue;
    const assetName = properties.get("host-fqdn") || properties.get("netbios-name") || identifier;
    for (const itemValue of list(host.ReportItem)) {
      const item = object(itemValue);
      const pluginId = plain(item["@pluginID"], 80);
      const title = plain(item["@pluginName"], 220) || `Tenable plugin ${pluginId || "observation"}`;
      const cve = cveFrom(item.cve);
      const port = numberOrNull(item["@port"], 65535);
      observations.push(finishObservation("nessus_xml", {
        assetIdentifier: identifier,
        assetName,
        assetKind: "host",
        title,
        description: boundedText([item.synopsis, item.description], `${title} was reported by Tenable Nessus.`),
        severity: normalizeSeverity(item.risk_factor || item["@severity"]),
        confidence: "likely",
        sourceReference: `nessus:${pluginId || title}:${identifier}:${port ?? 0}`,
        advisoryExternalId: cve,
        cvssScore: numberOrNull(item.cvss4_base_score || item.cvss3_base_score || item.cvss_base_score, 10),
        epssScore: null,
        epssPercentile: null,
        knownExploited: false,
        port,
        protocol: plain(item["@protocol"], 30),
        service: plain(item["@svc_name"], 100),
        evidenceSummary: plain(item.plugin_output, 3000),
        remediation: plain(item.solution, 5000) || "Validate the affected version and apply the vendor-supported patch or compensating control.",
        rawMetadata: { pluginId, pluginFamily: plain(item["@pluginFamily"], 120), cve },
        firstObservedAt: dateOrNull(properties.get("HOST_START")),
        lastObservedAt: dateOrNull(properties.get("HOST_END"))
      }));
    }
  }
  return observations;
}

function parseBurpXml(content: string): NormalizedObservation[] {
  rejectUnsafeXml(content);
  const parsed = object(xmlParser.parse(content));
  const issues = object(parsed.issues);
  if (!Object.keys(issues).length) throw new Error("The file is not a valid Burp issue XML export.");
  return list(issues.issue).map((value) => {
    const issue = object(value);
    const hostValue = issue.host;
    const host = plain(hostValue, 500);
    const path = plain(issue.path, 1000);
    const location = plain(issue.location, 1200);
    const identifier = location.match(/https?:\/\/[^\s]+/i)?.[0] || (host && path ? `${host.replace(/\/$/, "")}/${path.replace(/^\//, "")}` : host);
    const title = plain(issue.name, 220) || "Burp scanner observation";
    const detail = [issue.issueDetail, issue.issueBackground].map((item) => plain(item, 2500)).filter(Boolean).join(" ");
    return finishObservation("burp_xml", {
      assetIdentifier: identifier || "unknown-burp-target",
      assetName: host || identifier || "Burp target",
      assetKind: "application",
      title,
      description: boundedText(detail, `${title} was reported by Burp Scanner.`),
      severity: normalizeSeverity(issue.severity),
      confidence: normalizeConfidence(issue.confidence),
      sourceReference: `burp:${plain(issue.serialNumber, 100) || plain(issue.type, 100) || title}`,
      advisoryExternalId: cveFrom([issue.vulnerabilityClassifications, detail]),
      cvssScore: null,
      epssScore: null,
      epssPercentile: null,
      knownExploited: false,
      port: null,
      protocol: identifier?.startsWith("https:") ? "https" : identifier?.startsWith("http:") ? "http" : "",
      service: "web application",
      evidenceSummary: plain(issue.issueDetail, 3000),
      remediation: plain([issue.remediationDetail, issue.remediationBackground], 5000) || "Validate the issue and apply the application-specific remediation recommended by the service owner.",
      rawMetadata: { issueType: plain(issue.type, 100), path, location },
      firstObservedAt: null,
      lastObservedAt: null
    });
  });
}

function normalizedColumns(row: Record<string, unknown>) {
  return new Map(Object.entries(row).map(([key, value]) => [key.toLowerCase().replace(/[^a-z0-9]/g, ""), value]));
}

function firstColumn(columns: Map<string, unknown>, aliases: string[]) {
  for (const alias of aliases) {
    const value = columns.get(alias);
    if (value !== undefined && plain(value, 10_000)) return value;
  }
  return "";
}

function parseScannerCsv(connector: Extract<VerifyGridConnector, "qualys_csv" | "rapid7_csv" | "greenbone_csv">, content: string): NormalizedObservation[] {
  const rows = parseCsv(content, { columns: true, skip_empty_lines: true, bom: true, relax_column_count: true, max_record_size: 1_000_000 }) as Record<string, unknown>[];
  if (!rows.length) throw new Error("The CSV export contains no observation rows.");
  return rows.slice(0, 5000).map((row, index) => {
    const columns = normalizedColumns(row);
    const identifier = plain(firstColumn(columns, ["ip", "ipaddress", "assetip", "hostname", "dnsname", "fqdn", "asset", "host", "url"]), 1000);
    const title = plain(firstColumn(columns, ["title", "name", "vulnerability", "vulnerabilitytitle", "finding", "qtitle", "qidtitle", "resultname"]), 220);
    if (!identifier || !title) throw new Error(`CSV row ${index + 2} must include an asset/IP/host and vulnerability title.`);
    const cve = cveFrom(firstColumn(columns, ["cve", "cves", "cveid", "cveids", "vulnerabilityid"]));
    const sourceId = plain(firstColumn(columns, ["qid", "pluginid", "vulnerabilityid", "id", "nvtid", "resultid"]), 120) || String(index + 1);
    const description = firstColumn(columns, ["description", "threat", "synopsis", "proof", "findingdescription", "vulnerabilitydescription"]);
    const evidence = firstColumn(columns, ["evidence", "result", "proof", "output", "pluginoutput", "findingoutput"]);
    const remediation = firstColumn(columns, ["solution", "remediation", "fix", "resolution", "recommendation"]);
    const port = numberOrNull(firstColumn(columns, ["port", "portnumber", "serviceport"]), 65535);
    return finishObservation(connector, {
      assetIdentifier: identifier,
      assetName: plain(firstColumn(columns, ["hostname", "dnsname", "fqdn", "assetname", "host"]), 220) || identifier,
      assetKind: identifier.startsWith("http") ? "application" : "host",
      title,
      description: boundedText(description, `${title} was reported in the ${connectorCatalog[connector].label} export.`),
      severity: normalizeSeverity(firstColumn(columns, ["severity", "risk", "riskfactor", "severitylevel", "cvssseverity", "threatseverity"])),
      confidence: normalizeConfidence(firstColumn(columns, ["confidence", "status", "validationstatus"])),
      sourceReference: `${connector}:${sourceId}:${identifier}:${port ?? 0}`,
      advisoryExternalId: cve,
      cvssScore: numberOrNull(firstColumn(columns, ["cvss", "cvssscore", "cvssbasescore", "cvssv3basescore", "cvss3basescore"]), 10),
      epssScore: numberOrNull(firstColumn(columns, ["epss", "epssscore"]), 1),
      epssPercentile: numberOrNull(firstColumn(columns, ["epsspercentile"]), 1),
      knownExploited: /^(true|yes|1|known)$/i.test(plain(firstColumn(columns, ["knownexploited", "kev", "cisakev"]), 30)),
      port,
      protocol: plain(firstColumn(columns, ["protocol", "transport"]), 30),
      service: plain(firstColumn(columns, ["service", "servicename", "product"]), 160),
      evidenceSummary: plain(evidence, 3000),
      remediation: plain(remediation, 5000) || "Validate the vulnerable product and apply the vendor-supported patch, configuration correction, or compensating control.",
      rawMetadata: {
        sourceId,
        cve,
        vendor: plain(firstColumn(columns, ["vendor", "publisher", "manufacturer"]), 160),
        product: plain(firstColumn(columns, ["product", "productname", "software"]), 160),
        version: plain(firstColumn(columns, ["version", "productversion", "softwareversion"]), 120)
      },
      firstObservedAt: dateOrNull(firstColumn(columns, ["firstfound", "firstseen", "firstdiscovered"])),
      lastObservedAt: dateOrNull(firstColumn(columns, ["lastfound", "lastseen", "lastobserved", "scandate"]))
    });
  });
}

function parseNormalizedJson(connector: VerifyGridConnector, content: string): NormalizedObservation[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    throw new Error("The normalized import is not valid JSON.");
  }
  const rows = Array.isArray(parsed) ? parsed : object(parsed).observations;
  if (!Array.isArray(rows) || !rows.length || rows.length > 5000) throw new Error("Normalized JSON must contain between 1 and 5,000 observations.");
  return rows.map((value, index) => {
    const row = object(value);
    const identifier = plain(row.assetIdentifier, 1000);
    const title = plain(row.title, 220);
    if (!identifier || !title) throw new Error(`Observation ${index + 1} requires assetIdentifier and title.`);
    return finishObservation(connector, {
      assetIdentifier: identifier,
      assetName: plain(row.assetName, 220) || identifier,
      assetKind: plain(row.assetKind, 80) || "host",
      title,
      description: boundedText(row.description, `${title} was supplied through the VerifyGrid normalized connector.`),
      severity: normalizeSeverity(row.severity),
      confidence: normalizeConfidence(row.confidence),
      sourceReference: plain(row.sourceReference, 300) || `normalized:${index + 1}`,
      advisoryExternalId: cveFrom(row.advisoryExternalId || row.cve),
      cvssScore: numberOrNull(row.cvssScore, 10),
      epssScore: numberOrNull(row.epssScore, 1),
      epssPercentile: numberOrNull(row.epssPercentile, 1),
      knownExploited: row.knownExploited === true,
      port: numberOrNull(row.port, 65535),
      protocol: plain(row.protocol, 30),
      service: plain(row.service, 160),
      evidenceSummary: plain(row.evidenceSummary, 3000),
      remediation: plain(row.remediation, 5000) || "Validate the observation and apply the vendor-supported least-risk remediation.",
      rawMetadata: object(row.metadata),
      firstObservedAt: dateOrNull(row.firstObservedAt),
      lastObservedAt: dateOrNull(row.lastObservedAt)
    });
  });
}

export function parseScannerImport(connector: VerifyGridConnector, content: string) {
  const observations = connector === "nmap_xml"
    ? parseNmapXml(content)
    : connector === "nessus_xml"
      ? parseNessusXml(content)
      : connector === "burp_xml"
        ? parseBurpXml(content)
        : connector === "normalized_json" || connector.endsWith("_api")
          ? parseNormalizedJson(connector, content)
          : parseScannerCsv(connector as Extract<VerifyGridConnector, "qualys_csv" | "rapid7_csv" | "greenbone_csv">, content);
  if (!observations.length) throw new Error("No usable observations were found in the scanner export.");
  const unique = new Map(observations.map((item) => [item.fingerprint, item]));
  return [...unique.values()].slice(0, 5000);
}

function ipv4ToBigInt(value: string) {
  return value.split(".").reduce((result, part) => (result << 8n) + BigInt(Number(part)), 0n);
}

function ipv6ToBigInt(value: string) {
  let normalized = value.toLowerCase().split("%")[0];
  const ipv4 = normalized.match(/(?:^|:)(\d+\.\d+\.\d+\.\d+)$/)?.[1];
  if (ipv4) {
    const integer = ipv4ToBigInt(ipv4);
    normalized = normalized.replace(ipv4, `${Number((integer >> 16n) & 0xffffn).toString(16)}:${Number(integer & 0xffffn).toString(16)}`);
  }
  const [leftText, rightText = ""] = normalized.split("::");
  const left = leftText ? leftText.split(":") : [];
  const right = rightText ? rightText.split(":") : [];
  const fill = Array(Math.max(0, 8 - left.length - right.length)).fill("0");
  const groups = normalized.includes("::") ? [...left, ...fill, ...right] : left;
  if (groups.length !== 8) throw new Error("Invalid IPv6 address.");
  return groups.reduce((result, group) => (result << 16n) + BigInt(Number.parseInt(group || "0", 16)), 0n);
}

function cidrContains(cidr: string, candidate: string) {
  const [network, prefixText] = cidr.split("/");
  const version = isIP(network);
  if (!version || isIP(candidate) !== version) return false;
  const bits = version === 4 ? 32 : 128;
  const prefix = Number(prefixText);
  if (!Number.isInteger(prefix) || prefix < 0 || prefix > bits) return false;
  const networkValue = version === 4 ? ipv4ToBigInt(network) : ipv6ToBigInt(network);
  const candidateValue = version === 4 ? ipv4ToBigInt(candidate) : ipv6ToBigInt(candidate);
  const shift = BigInt(bits - prefix);
  return (networkValue >> shift) === (candidateValue >> shift);
}

function candidateParts(identifier: string) {
  try {
    const url = new URL(identifier);
    return { raw: identifier, hostname: url.hostname.toLowerCase(), url };
  } catch {
    return { raw: identifier.toLowerCase().replace(/\.$/, ""), hostname: identifier.toLowerCase().replace(/\.$/, ""), url: null };
  }
}

function targetMatches(target: ScopeCandidate, identifier: string) {
  const candidate = candidateParts(identifier);
  const targetValue = target.value.toLowerCase().replace(/\.$/, "");
  if (target.targetType === "cidr") return cidrContains(target.value, candidate.hostname);
  if (["ip", "domain", "hostname"].includes(target.targetType)) return candidate.hostname === targetValue || candidate.raw === targetValue;
  if (target.targetType === "url") {
    try {
      const scopeUrl = new URL(target.value);
      if (!candidate.url || candidate.url.origin !== scopeUrl.origin) return false;
      const path = scopeUrl.pathname.replace(/\/$/, "");
      return candidate.url.pathname === path || candidate.url.pathname.startsWith(`${path}/`);
    } catch {
      return false;
    }
  }
  return candidate.raw === targetValue;
}

export function reconcileObservationScope(identifier: string, targets: ScopeCandidate[]) {
  const exclusion = targets.find((target) => !target.inScope && targetMatches(target, identifier));
  if (exclusion) return { disposition: "out_of_scope" as const, target: exclusion, reason: "Matched an explicit exclusion." };
  const included = targets.find((target) => target.inScope && targetMatches(target, identifier));
  if (included) {
    return included.ownershipConfirmed
      ? { disposition: "in_scope" as const, target: included, reason: "Matched an owned in-scope target." }
      : { disposition: "unmatched" as const, target: included, reason: "The matching target does not have confirmed ownership." };
  }
  return { disposition: "unmatched" as const, target: null, reason: "No exact URL, host, IP, CIDR, or named scope target matched." };
}

export function severityMeetsMinimum(severity: keyof typeof severityRank, minimum: keyof typeof severityRank) {
  return severityRank[severity] >= severityRank[minimum];
}
