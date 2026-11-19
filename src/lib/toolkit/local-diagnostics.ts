import ipaddr from "ipaddr.js";
import { z } from "zod";
import type { ToolkitResult } from "./types";

export const diagnosticOperations = ["ping", "traceroute", "dns", "tcp", "tls"] as const;
export type DiagnosticOperation = typeof diagnosticOperations[number];
export const diagnosticNames: Record<DiagnosticOperation, string> = { ping: "Ping / reachability", traceroute: "Route trace", dns: "DNS lookup", tcp: "TCP connection", tls: "TLS certificate check" };
export const diagnosticMeanings: Record<DiagnosticOperation, string> = {
  ping: "Sends a few ICMP echo requests. A missing reply can mean filtering, rate limiting or loss, not necessarily a failed device.",
  traceroute: "Looks for router replies with increasing hop limits. Routers may not reply, and the return path may differ. This is not a bandwidth test.",
  dns: "Asks this computer's configured DNS resolver for one record type. Split DNS and resolver caching can change the answer.",
  tcp: "Attempts one TCP connection to one port. A successful connection does not prove the application or login works.",
  tls: "Attempts a verified TLS handshake. Checks normal certificate trust and hostname rules; it does not audit all ciphers or vulnerabilities.",
};

export function validDiagnosticTarget(value: string): boolean {
  if (!value || value.length > 253 || /[\s/%\\\[\]@;|&$`'"<>]/.test(value) || value.startsWith("-")) return false;
  if (ipaddr.isValid(value)) {
    const address = ipaddr.parse(value);
    if (["multicast", "unspecified", "broadcast", "ipv4Mapped"].includes(address.range())) return false;
    if (address.kind() === "ipv6") return address.toString() === "::1" || !/^::(?:[a-f0-9]{1,4}:)?[a-f0-9]{1,4}$/i.test(address.toString());
    return /^\d+\.\d+\.\d+\.\d+$/.test(value) && value.split(".").every(part => String(Number(part)) === part) && Number(value.split(".")[0]) > 0 && Number(value.split(".")[0]) < 224 && !value.endsWith(".255");
  }
  if (value.includes(":") || !/[a-z]/i.test(value) || /^(?:0x[0-9a-f]+|\d+)(?:\.(?:0x[0-9a-f]+|\d+))*\.?$/i.test(value)) return false;
  const name = value.endsWith(".") ? value.slice(0, -1) : value;
  return name.split(".").every(part => part.length > 0 && part.length <= 63 && /^[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?$/.test(part));
}

const integer = (min: number, max: number) => z.number().int().min(min).max(max);
const parameters = {
  ping: z.object({ count: integer(1, 10), timeoutMs: integer(100, 5000), packetBytes: integer(0, 1400) }).strict(),
  traceroute: z.object({ timeoutMs: integer(100, 5000), maxHops: integer(1, 20) }).strict(),
  dns: z.object({ timeoutMs: integer(100, 5000), recordType: z.enum(["A", "AAAA", "MX", "TXT", "NS", "CNAME", "SOA"]) }).strict(),
  tcp: z.object({ timeoutMs: integer(100, 5000), port: integer(1, 65535) }).strict(),
  tls: z.object({ timeoutMs: integer(100, 5000), port: integer(1, 65535), serverName: z.string().max(253).optional() }).strict(),
};
export type DiagnosticRequest = { schemaVersion: 1; kind: "qcs-local-diagnostic"; operation: DiagnosticOperation; target: string; parameters: Record<string, string | number> };

export function createDiagnosticRequest(operation: DiagnosticOperation, target: string, values: Record<string, string>): DiagnosticRequest {
  if (!diagnosticOperations.includes(operation) || !validDiagnosticTarget(target)) throw new Error("Enter one valid IP address or hostname, without a URL, range, spaces or shell characters.");
  const keys = Object.keys(parameters[operation].shape);
  const submitted = Object.fromEntries(keys.filter(key => key !== "serverName" || values[key]).map(key => [key, ["serverName", "recordType"].includes(key) ? values[key] : Number(values[key] === "" ? NaN : values[key])]));
  const parsed = parameters[operation].safeParse(submitted);
  if (!parsed.success) throw new Error("Check the numeric bounds and required parameters for this test.");
  const data = parsed.data as Record<string, string | number>;
  if (data.serverName && (!validDiagnosticTarget(String(data.serverName)) || ipaddr.isValid(String(data.serverName)))) throw new Error("TLS server name must be a hostname, not an address or URL.");
  return { schemaVersion: 1, kind: "qcs-local-diagnostic", operation, target, parameters: data };
}

export function diagnosticRequestDiagram(request: DiagnosticRequest): NonNullable<ToolkitResult["visual"]> {
  return { title: "Requested test path", caption: "A plan only. The website has not contacted this target. The selected probe runs from the computer where you execute the local runner.", flow: true,
    items: [{ label: diagnosticNames[request.operation], steps: [{ label: "Source", value: "Your runner computer" }, { label: "Operation", value: request.operation.toUpperCase() }, { label: "Target", value: request.target + (request.parameters.port ? ` : ${request.parameters.port}` : "") }] }] };
}

const boundedText = z.string().max(1024).refine(value => !/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value));
const reportSchema = z.object({ schemaVersion: z.literal(1), kind: z.literal("qcs-local-diagnostic-result"), operation: z.enum(diagnosticOperations), target: z.string().refine(validDiagnosticTarget), parameters: z.record(z.string(), z.union([z.string().max(253), z.number().finite()])), startedAt: z.iso.datetime(), finishedAt: z.iso.datetime(), status: z.enum(["completed", "failed", "timeout"]), summary: boundedText, observations: z.record(z.string().max(80), z.unknown()), limitations: z.array(boundedText).max(30) }).strict();
const observationMeaning: Record<string, string> = {
  resolvedAddress: "The single IP selected for this test; other addresses were not tested.", addressFamily: "4 means IPv4; 6 means IPv6.", port: "Destination TCP service port, not a range scan.",
  connected: "Whether this runner recorded a TCP connection; not an application health check.", connectDurationMs: "TCP connection time in milliseconds, excluding DNS resolution.", connectMs: "Connection duration in milliseconds as supplied by this report.",
  authorized: "Whether the runner recorded successful certificate verification; not account authorization.", verificationName: "Hostname or address checked against the certificate identity.", handshakeDurationMs: "TLS handshake time in milliseconds, excluding DNS resolution.", protocol: "Negotiated protocol reported by the runner, not a list of all supported versions.", cipher: "Cipher negotiated for this one handshake, not a complete cipher audit.",
  recordType: "Requested DNS record type.", resolverMode: "The resolver source used by the runner; local hosts-file entries are not queried.", recordCount: "Number of returned records, not global DNS propagation.", recordsTruncated: "Whether the runner limited the displayed DNS record set.", durationMs: "Elapsed DNS query time in milliseconds.",
  exitCode: "Operating-system process exit code; raw text must be checked before interpreting reachability.", signal: "Signal associated with process termination, if reported.", outputTruncated: "Whether console output exceeded the runner's bound.", errorCode: "Reported error classification; filtering, routing, service and trust failures need different follow-up.",
};

export function parseDiagnosticReport(input: string): ToolkitResult {
  if (new TextEncoder().encode(input).byteLength > 256 * 1024) throw new Error("The local runner report must be smaller than 256 KiB.");
  const report = reportSchema.parse(JSON.parse(input));
  const confirmed = createDiagnosticRequest(report.operation, report.target, Object.fromEntries(Object.entries(report.parameters).map(([key, value]) => [key, String(value)])));
  if (Object.keys(report.parameters).some(key => !(key in confirmed.parameters)) || Date.parse(report.finishedAt) < Date.parse(report.startedAt)) throw new Error("Invalid runner report metadata.");
  // Untrusted report text is never executed. Raw console dumps and arbitrary
  // nested objects are deliberately excluded from both display and export.
  const observations: { parameter: string; value: string; meaning: string }[] = Object.entries(report.observations).slice(0, 40).flatMap(([parameter, value]) => {
    if (!Object.hasOwn(observationMeaning, parameter)) return [];
    if (typeof value === "number" && Number.isFinite(value) || typeof value === "boolean" || typeof value === "string" && value.length <= 1024 && !/[\u0000-\u001f]/.test(value)) return [{ parameter, value: String(value), meaning: observationMeaning[parameter] }];
    return [];
  });
  const appendFields = (value: unknown, prefix: string, meanings: Record<string, string>) => {
    if (!value || typeof value !== "object" || Array.isArray(value)) return;
    for (const [key, meaning] of Object.entries(meanings)) {
      const item = (value as Record<string, unknown>)[key];
      if (typeof item === "number" && Number.isFinite(item) || typeof item === "string" && item.length <= 1024 && !/[\u0000-\u001f]/.test(item)) observations.push({ parameter: `${prefix}: ${key}`, value: String(item), meaning });
    }
  };
  if (report.operation === "dns" && Array.isArray(report.observations.records)) for (const [index, value] of report.observations.records.slice(0, 128).entries()) appendFields(value, `DNS record ${index + 1}`, { address: "Returned IP address.", name: "Returned DNS name.", exchange: "Mail exchanger hostname.", priority: "MX preference: smaller values are preferred.", nsname: "SOA primary name server.", hostmaster: "SOA responsible-party DNS mailbox notation.", serial: "Zone revision serial; not a timestamp unless the operator uses that convention.", refresh: "Secondary refresh interval in seconds.", retry: "Retry interval in seconds.", expire: "Secondary expiry interval in seconds.", minttl: "SOA minimum field used for negative caching.", chunkCount: "Number of TXT chunks; sensitive text is withheld.", byteLength: "Combined TXT byte length; text is withheld." });
  if (report.operation === "tls") appendFields(report.observations.certificate, "Certificate", { subjectCN: "Certificate common name; SAN and normal name checks determine identity.", issuerCN: "Issuer common name, not proof of trust by itself.", validFrom: "Certificate not-before time.", validTo: "Certificate not-after time.", fingerprint256: "SHA-256 certificate fingerprint for comparison.", serialNumber: "Issuer-assigned certificate identifier." });
  return {
    title: `${diagnosticNames[report.operation]} report`, summary: diagnosticMeanings[report.operation], evidence: "imported",
    metrics: [{ label: "Runner status", value: report.status, meaning: "Status reported by the imported file, not a universal network health verdict." }, { label: "Target", value: report.target, meaning: "The address or hostname recorded by the runner." }, { label: "Collected", value: report.finishedAt, meaning: "Reported completion timestamp; this browser does not authenticate the file or the computer clock." }],
    rows: observations, findings: [{ level: report.status === "completed" ? "info" : "review", title: "Reported outcome", detail: report.summary }],
    caveats: ["This is a user-supplied runner report, not an independently authenticated result. Re-run if its origin or age is uncertain.", "No probe was run by this browser. The runner uses the network path of the computer where it is executed.", "Raw console output and unsupported fields remain in the original local file; they are not included in this report view. Ping/trace console output is not parsed into invented latency or hop metrics.", ...report.limitations], sourceIds: [],
    visual: { title: "Recorded diagnostic context", caption: "Context from the imported report. This does not prove reachability or describe every intermediate hop.", flow: false, items: [{ label: report.operation.toUpperCase(), steps: [{ label: "Target", value: report.target }, { label: "Runner status", value: report.status }, { label: "Time", value: report.finishedAt }] }] },
  };
}
