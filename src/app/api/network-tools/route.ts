import { randomInt } from "node:crypto";
import dns from "node:dns/promises";
import net from "node:net";
import tls from "node:tls";
import { domainToASCII } from "node:url";
import { NextResponse } from "next/server";
import { z } from "zod";
import { jsonError, readJsonBody } from "@/lib/api";
import { getNetworkUtilityTool } from "@/lib/network-tools";
import { rateLimit } from "@/lib/rate-limit";
import { requestContext } from "@/lib/security";
import { createEvent } from "@/lib/store";
import { generateVendorTaskScript } from "@/lib/vendor-task-scripts";

export const runtime = "nodejs";

type DetailValue = string | number | boolean | string[] | Record<string, string | number | boolean>[];

type ToolDetail = {
  label: string;
  value: DetailValue;
};

type ToolResult = {
  tool: string;
  title: string;
  target: string;
  status: "ok" | "warning" | "error";
  summary: string;
  details: ToolDetail[];
  generatedAt: string;
};

const networkToolSchema = z.object({
  tool: z.string().trim().min(2).max(80),
  target: z.string().trim().max(500).default(""),
  port: z.number().int().min(1).max(65535).optional(),
  params: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])).default({}),
  sessionId: z.string().trim().max(200).optional().default(""),
  consent: z
    .object({
      necessary: z.boolean().default(true),
      analytics: z.boolean().default(false),
      marketing: z.boolean().default(false),
      personalization: z.boolean().default(false),
      contact: z.boolean().optional()
    })
    .default({
      necessary: true,
      analytics: false,
      marketing: false,
      personalization: false
    })
});

function result(input: Omit<ToolResult, "generatedAt">): ToolResult {
  return { ...input, generatedAt: new Date().toISOString() };
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Unable to run this network tool.";
}

function ipv4Parts(ip: string) {
  const parts = ip.split(".").map((part) => Number(part));
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) {
    return null;
  }
  return parts;
}

function isPrivateIpv4(ip: string) {
  const parts = ipv4Parts(ip);
  if (!parts) return true;
  const [a, b] = parts;
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    a >= 224 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 192 && b === 0) ||
    (a === 192 && b === 2) ||
    (a === 198 && (b === 18 || b === 19 || b === 51)) ||
    (a === 203 && b === 0)
  );
}

function isPrivateIpv6(ip: string) {
  const value = ip.toLowerCase();
  if (value === "::" || value === "::1" || value === "0:0:0:0:0:0:0:1") return true;
  if (value.startsWith("fc") || value.startsWith("fd") || /^fe[89ab]/.test(value)) return true;
  if (value.startsWith("::ffff:")) {
    return isPrivateIpv4(value.replace("::ffff:", ""));
  }
  return false;
}

function isPrivateIp(ip: string) {
  const family = net.isIP(ip);
  if (family === 4) return isPrivateIpv4(ip);
  if (family === 6) return isPrivateIpv6(ip);
  return true;
}

function normalizeHostname(input: string, options: { allowUrl?: boolean } = {}) {
  const trimmed = input.trim();
  if (!trimmed) throw new Error("Enter a public domain, hostname, IP address, or URL.");

  let hostname = "";
  if (options.allowUrl || /^https?:\/\//i.test(trimmed)) {
    const url = new URL(/^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`);
    if (!["http:", "https:"].includes(url.protocol)) throw new Error("Only HTTP and HTTPS URLs are supported.");
    hostname = url.hostname;
  } else {
    hostname = new URL(`http://${trimmed}`).hostname;
  }

  const ascii = domainToASCII(hostname.replace(/\.$/, "").toLowerCase());
  if (!ascii) throw new Error("Enter a valid public hostname.");
  if (ascii === "localhost" || ascii.endsWith(".localhost") || ascii.endsWith(".local") || ascii.endsWith(".internal")) {
    throw new Error("Internal and localhost targets are not supported.");
  }

  if (net.isIP(ascii)) {
    if (isPrivateIp(ascii)) throw new Error("Private, loopback, multicast, and reserved IP targets are blocked.");
    return ascii;
  }

  const labels = ascii.split(".");
  const valid = labels.length >= 2 && labels.every((label) => /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(label));
  if (!valid || ascii.length > 253) throw new Error("Enter a valid public domain name.");
  return ascii;
}

async function assertPublicResolvedHost(hostname: string) {
  if (net.isIP(hostname)) return;
  const records = await dns.lookup(hostname, { all: true, verbatim: false });
  if (!records.length) throw new Error("The hostname did not resolve to an IP address.");
  if (records.some((record) => isPrivateIp(record.address))) {
    throw new Error("This hostname resolves to a private or reserved IP range and is blocked.");
  }
}

function settledValues<T>(records: PromiseSettledResult<T>) {
  return records.status === "fulfilled" ? records.value : [];
}

function flattenTxt(records: string[][]) {
  return records.map((record) => record.join(""));
}

function intToIpv4(value: number) {
  return [value >>> 24, (value >>> 16) & 255, (value >>> 8) & 255, value & 255].join(".");
}

function ipv4ToInt(parts: number[]) {
  return (((parts[0] * 256 + parts[1]) * 256 + parts[2]) * 256 + parts[3]) >>> 0;
}

function textParam(params: Record<string, string | number | boolean>, key: string, fallback = "") {
  const value = params[key];
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return typeof value === "string" ? value.trim() : fallback;
}

function validateDnsPrefix(value: string, label: string) {
  const trimmed = value.trim().toLowerCase().replace(/\.$/, "");
  if (!trimmed || trimmed.length > 190) throw new Error(`Enter a valid ${label}.`);
  const valid = trimmed.split(".").every((part) => /^_?[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(part));
  if (!valid) throw new Error(`Enter a valid ${label}.`);
  return trimmed;
}

function parseTagRecord(record = "") {
  return Object.fromEntries(
    record
      .split(";")
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        const [key, ...value] = part.split("=");
        return [key.toLowerCase(), value.join("=").trim()];
      })
  );
}

function toDetailRows(records: unknown[]): Record<string, string | number | boolean>[] {
  return records.map((record) => {
    if (!record || typeof record !== "object") return { value: String(record) };
    return Object.fromEntries(
      Object.entries(record as Record<string, unknown>).map(([key, value]) => [
        key,
        typeof value === "string" || typeof value === "number" || typeof value === "boolean" ? value : String(value)
      ])
    );
  });
}

function normalizeHttpUrl(input: string, defaultPath?: string) {
  const trimmed = input.trim();
  if (!trimmed) throw new Error("Enter a public HTTP or HTTPS URL.");
  const parsed = new URL(/^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`);
  if (!["http:", "https:"].includes(parsed.protocol)) throw new Error("Only HTTP and HTTPS URLs are supported.");
  const host = normalizeHostname(parsed.href, { allowUrl: true });
  return new URL(defaultPath ?? `${parsed.pathname}${parsed.search}`, `${parsed.protocol}//${host}`);
}

async function fetchWithTimeout(url: URL, init: RequestInit = {}, timeoutMs = 8000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      ...init,
      signal: controller.signal,
      headers: {
        "user-agent": "QuantumCrafters-Network-Tool/1.0",
        ...init.headers
      }
    });
  } finally {
    clearTimeout(timer);
  }
}

async function checkTcpPort(host: string, checkedPort: number, timeoutMs = 5000) {
  return new Promise<boolean>((resolve) => {
    const socket = net.connect({ host, port: checkedPort, timeout: timeoutMs });
    socket.once("connect", () => {
      socket.end();
      resolve(true);
    });
    socket.once("timeout", () => {
      socket.destroy();
      resolve(false);
    });
    socket.once("error", () => resolve(false));
  });
}

async function fetchJson(url: string, timeoutMs = 9000) {
  const response = await fetchWithTimeout(new URL(url), { method: "GET" }, timeoutMs);
  if (!response.ok) throw new Error(`Remote data source returned HTTP ${response.status}.`);
  return response.json() as Promise<unknown>;
}

function normalizeAsn(input: string) {
  const match = input.trim().toUpperCase().match(/^(?:AS)?(\d{1,10})$/);
  if (!match) throw new Error("Enter an ASN such as AS15169 or 15169.");
  return `AS${Number(match[1])}`;
}

function parseIpv4Cidr(input: string) {
  const [ipRaw, prefixRaw] = input.trim().split("/");
  const parts = ipv4Parts(ipRaw || "");
  const prefix = Number(prefixRaw);
  if (!parts || !Number.isInteger(prefix) || prefix < 0 || prefix > 32) {
    throw new Error("Enter IPv4 CIDR notation such as 192.168.10.0/24.");
  }
  const ip = ipv4ToInt(parts);
  const mask = prefix === 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0;
  const wildcard = (~mask) >>> 0;
  const start = (ip & mask) >>> 0;
  const end = (start | wildcard) >>> 0;
  return { input: input.trim(), prefix, start, end, network: intToIpv4(start), broadcast: intToIpv4(end), mask: intToIpv4(mask), wildcard: intToIpv4(wildcard) };
}

function parseCidrList(input: string) {
  const cidrs = input
    .split(/[\s,;]+/)
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 200);
  if (!cidrs.length) throw new Error("Enter at least one IPv4 CIDR range.");
  return cidrs.map(parseIpv4Cidr);
}

function ipv4InRange(ip: string, cidr: string) {
  const parts = ipv4Parts(ip);
  if (!parts) throw new Error("Enter a valid IPv4 address.");
  const value = ipv4ToInt(parts);
  const range = parseIpv4Cidr(cidr);
  return value >= range.start && value <= range.end;
}

function rangeToCidrs(start: number, end: number) {
  const output: string[] = [];
  let current = start;
  while (current <= end) {
    let prefix = 32;
    while (prefix > 0) {
      const candidatePrefix = prefix - 1;
      const size = 2 ** (32 - candidatePrefix);
      if (current % size !== 0 || current + size - 1 > end) break;
      prefix = candidatePrefix;
    }
    output.push(`${intToIpv4(current)}/${prefix}`);
    current += 2 ** (32 - prefix);
  }
  return output;
}

function parseIpv6Address(input: string) {
  const value = input.trim().toLowerCase();
  if (!value || value.includes(".")) throw new Error("Enter a valid IPv6 address without embedded IPv4 notation.");
  const halves = value.split("::");
  if (halves.length > 2) throw new Error("Enter a valid IPv6 address.");
  const left = halves[0] ? halves[0].split(":").filter(Boolean) : [];
  const right = halves[1] ? halves[1].split(":").filter(Boolean) : [];
  const missing = 8 - left.length - right.length;
  if (missing < 0 || (halves.length === 1 && missing !== 0)) throw new Error("Enter a valid IPv6 address.");
  const groups = [...left, ...Array(Math.max(missing, 0)).fill("0"), ...right];
  if (groups.length !== 8 || groups.some((part) => !/^[0-9a-f]{1,4}$/.test(part))) throw new Error("Enter a valid IPv6 address.");
  return groups.reduce((acc, part) => (acc << 16n) + BigInt(parseInt(part, 16)), 0n);
}

function formatIpv6(value: bigint) {
  const groups: string[] = [];
  for (let shift = 112n; shift >= 0n; shift -= 16n) {
    groups.push(((value >> shift) & 0xffffn).toString(16));
  }
  return groups.join(":");
}

function parseIpv6Cidr(input: string) {
  const [addressRaw, prefixRaw] = input.trim().split("/");
  const prefix = Number(prefixRaw);
  if (!Number.isInteger(prefix) || prefix < 0 || prefix > 128) throw new Error("Enter IPv6 CIDR notation such as 2001:db8:100::/48.");
  const value = parseIpv6Address(addressRaw || "");
  const full = (1n << 128n) - 1n;
  const hostBits = BigInt(128 - prefix);
  const mask = prefix === 0 ? 0n : (full << hostBits) & full;
  const network = value & mask;
  const last = network | (full ^ mask);
  return { prefix, network, last, hostBits };
}

function textLines(input: string) {
  return input
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"))
    .slice(0, 500);
}

async function runDnsLookup(tool: string, title: string, input: string): Promise<ToolResult> {
  const host = normalizeHostname(input);
  const [a, aaaa, mx, ns, txt] = await Promise.allSettled([
    dns.resolve4(host),
    dns.resolve6(host),
    dns.resolveMx(host),
    dns.resolveNs(host),
    dns.resolveTxt(host)
  ]);

  const aRecords = settledValues(a);
  const aaaaRecords = settledValues(aaaa);
  const mxRecords = settledValues(mx)
    .sort((left, right) => left.priority - right.priority)
    .map((record) => `${record.priority} ${record.exchange}`);
  const nsRecords = settledValues(ns);
  const txtRecords = flattenTxt(settledValues(txt)).slice(0, 10);
  const total = aRecords.length + aaaaRecords.length + mxRecords.length + nsRecords.length + txtRecords.length;

  return result({
    tool,
    title,
    target: host,
    status: total ? "ok" : "warning",
    summary: total ? `Found ${total} public DNS record signal(s) for ${host}.` : `No common public DNS records were found for ${host}.`,
    details: [
      { label: "A records", value: aRecords.length ? aRecords : "None found" },
      { label: "AAAA records", value: aaaaRecords.length ? aaaaRecords : "None found" },
      { label: "MX records", value: mxRecords.length ? mxRecords : "None found" },
      { label: "NS records", value: nsRecords.length ? nsRecords : "None found" },
      { label: "TXT records", value: txtRecords.length ? txtRecords : "None found" }
    ]
  });
}

async function runDnsRecordLookup(tool: string, title: string, input: string, recordType: "A" | "AAAA" | "CNAME" | "NS" | "TXT"): Promise<ToolResult> {
  const host = normalizeHostname(input);
  const records =
    recordType === "A"
      ? await dns.resolve4(host).catch(() => [])
      : recordType === "AAAA"
        ? await dns.resolve6(host).catch(() => [])
        : recordType === "CNAME"
          ? await dns.resolveCname(host).catch(() => [])
          : recordType === "NS"
            ? await dns.resolveNs(host).catch(() => [])
            : flattenTxt(await dns.resolveTxt(host).catch(() => []));

  return result({
    tool,
    title,
    target: host,
    status: records.length ? "ok" : "warning",
    summary: records.length ? `${host} publishes ${records.length} ${recordType} record(s).` : `${host} does not publish ${recordType} records.`,
    details: [
      { label: `${recordType} records`, value: records.length ? records.slice(0, 20) : "No records found" },
      {
        label: "Operational note",
        value:
          recordType === "CNAME"
            ? "Confirm the canonical target is expected for your CDN, SaaS, cloud, or migration path."
            : recordType === "TXT"
              ? "Review TXT records for email security, domain verification, and stale ownership proofs."
              : "Compare the result with the intended service, provider, and change record."
      }
    ]
  });
}

async function runSoaLookup(tool: string, title: string, input: string): Promise<ToolResult> {
  const host = normalizeHostname(input);
  const record = await dns.resolveSoa(host).catch(() => null);

  return result({
    tool,
    title,
    target: host,
    status: record ? "ok" : "warning",
    summary: record ? `${host} publishes an SOA record with serial ${record.serial}.` : `${host} does not return an SOA record.`,
    details: [
      {
        label: "SOA record",
        value: record
          ? [
              {
                nsname: record.nsname,
                hostmaster: record.hostmaster,
                serial: record.serial,
                refresh: record.refresh,
                retry: record.retry,
                expire: record.expire,
                minttl: record.minttl
              }
            ]
          : "No SOA record found"
      },
      { label: "Operational note", value: "Check serial and timers during DNS migrations, delegation changes, and zone transfer troubleshooting." }
    ]
  });
}

async function runSrvLookup(tool: string, title: string, params: Record<string, string | number | boolean>): Promise<ToolResult> {
  const service = validateDnsPrefix(textParam(params, "service", "_sip"), "service name");
  const protocol = textParam(params, "protocol", "_tcp") === "_udp" ? "_udp" : "_tcp";
  const domain = normalizeHostname(textParam(params, "domain"));
  const lookupName = `${service}.${protocol}.${domain}`;
  const records = await dns.resolveSrv(lookupName).catch(() => []);

  return result({
    tool,
    title,
    target: lookupName,
    status: records.length ? "ok" : "warning",
    summary: records.length ? `${lookupName} has ${records.length} SRV record(s).` : `${lookupName} does not publish SRV records.`,
    details: [
      {
        label: "SRV records",
        value: records.length
          ? records
              .sort((left, right) => left.priority - right.priority || left.weight - right.weight)
              .map((record) => ({
                priority: record.priority,
                weight: record.weight,
                port: record.port,
                name: record.name
              }))
          : "No SRV records found"
      }
    ]
  });
}

async function runDnssecDsCheck(tool: string, title: string, input: string): Promise<ToolResult> {
  const host = normalizeHostname(input);
  const records = (await dns.resolve(host, "DS").catch(() => [])) as unknown[];
  const rows = toDetailRows(records);

  return result({
    tool,
    title,
    target: host,
    status: rows.length ? "ok" : "warning",
    summary: rows.length ? `${host} publishes ${rows.length} DNSSEC DS record(s).` : `${host} does not publish DS records at the parent zone.`,
    details: [
      { label: "DS records", value: rows.length ? rows : "No DS records found" },
      {
        label: "Recommendation",
        value: rows.length
          ? "Confirm DS records match the active DNSKEY material and registrar/DNS provider process."
          : "If DNSSEC is required, validate signing status and publish DS records through the registrar or parent zone."
      }
    ]
  });
}

async function runMxLookup(tool: string, title: string, input: string): Promise<ToolResult> {
  const host = normalizeHostname(input);
  const records = await dns
    .resolveMx(host)
    .then((items) => items.sort((left, right) => left.priority - right.priority))
    .catch(() => []);

  return result({
    tool,
    title,
    target: host,
    status: records.length ? "ok" : "warning",
    summary: records.length ? `${host} has ${records.length} MX record(s).` : `${host} does not publish MX records.`,
    details: [
      {
        label: "Mail exchangers",
        value: records.length
          ? records.map((record) => ({ priority: record.priority, exchange: record.exchange }))
          : "No MX records found"
      }
    ]
  });
}

async function runSpfDmarc(tool: string, title: string, input: string): Promise<ToolResult> {
  const host = normalizeHostname(input);
  const [txt, dmarcTxt] = await Promise.allSettled([dns.resolveTxt(host), dns.resolveTxt(`_dmarc.${host}`)]);
  const txtRecords = flattenTxt(settledValues(txt));
  const dmarcRecords = flattenTxt(settledValues(dmarcTxt));
  const spf = txtRecords.find((record) => record.toLowerCase().startsWith("v=spf1"));
  const dmarc = dmarcRecords.find((record) => record.toLowerCase().startsWith("v=dmarc1"));
  const dmarcPolicy = dmarc?.match(/p=([^;\s]+)/i)?.[1]?.toLowerCase() || "missing";
  const strongPolicy = ["quarantine", "reject"].includes(dmarcPolicy);
  const status = spf && dmarc && strongPolicy ? "ok" : spf || dmarc ? "warning" : "error";

  return result({
    tool,
    title,
    target: host,
    status,
    summary:
      spf && dmarc
        ? `${host} publishes SPF and DMARC. DMARC policy is ${dmarcPolicy}.`
        : `${host} is missing ${!spf && !dmarc ? "SPF and DMARC" : !spf ? "SPF" : "DMARC"} records.`,
    details: [
      { label: "SPF record", value: spf || "Missing" },
      { label: "DMARC record", value: dmarc || "Missing" },
      { label: "DMARC policy", value: dmarcPolicy },
      { label: "Recommendation", value: strongPolicy ? "Policy is enforcement-ready." : "Move toward quarantine or reject after monitoring." }
    ]
  });
}

async function runDkimCheck(tool: string, title: string, params: Record<string, string | number | boolean>): Promise<ToolResult> {
  const selector = validateDnsPrefix(textParam(params, "selector", "default"), "DKIM selector");
  const domain = normalizeHostname(textParam(params, "domain"));
  const lookupName = `${selector}._domainkey.${domain}`;
  const records = flattenTxt(await dns.resolveTxt(lookupName).catch(() => []));
  const dkim = records.find((record) => /(^|;\s*)v=dkim1/i.test(record) || /(^|;\s*)p=/i.test(record));

  return result({
    tool,
    title,
    target: lookupName,
    status: dkim ? "ok" : "warning",
    summary: dkim ? `${lookupName} publishes a DKIM signing record.` : `${lookupName} does not return a DKIM record.`,
    details: [
      { label: "DKIM record", value: dkim || "Missing" },
      { label: "TXT records", value: records.length ? records.slice(0, 5) : "No TXT records found" },
      { label: "Recommendation", value: dkim ? "Confirm selector ownership and key rotation process." : "Confirm the active mail platform selector and publish the DKIM TXT record." }
    ]
  });
}

async function runDmarcAnalyzer(tool: string, title: string, input: string): Promise<ToolResult> {
  const host = normalizeHostname(input);
  const records = flattenTxt(await dns.resolveTxt(`_dmarc.${host}`).catch(() => []));
  const dmarc = records.find((record) => record.toLowerCase().startsWith("v=dmarc1"));
  const tags = parseTagRecord(dmarc);
  const policy = String(tags.p || "missing").toLowerCase();
  const enforced = ["quarantine", "reject"].includes(policy);

  return result({
    tool,
    title,
    target: `_dmarc.${host}`,
    status: dmarc ? (enforced ? "ok" : "warning") : "error",
    summary: dmarc ? `${host} DMARC policy is ${policy}.` : `${host} does not publish a DMARC policy record.`,
    details: [
      { label: "DMARC record", value: dmarc || "Missing" },
      {
        label: "Parsed policy",
        value: dmarc
          ? [
              {
                policy,
                subdomainPolicy: String(tags.sp || "not set"),
                percentage: String(tags.pct || "100"),
                aggregateReports: String(tags.rua || "not set"),
                forensicReports: String(tags.ruf || "not set"),
                dkimAlignment: String(tags.adkim || "relaxed"),
                spfAlignment: String(tags.aspf || "relaxed")
              }
            ]
          : "No DMARC tags found"
      },
      {
        label: "Recommendation",
        value: enforced ? "Policy is in enforcement mode. Keep monitoring reports and alignment." : "Use aggregate reporting, then move from none toward quarantine or reject."
      }
    ]
  });
}

async function runBimiCheck(tool: string, title: string, input: string): Promise<ToolResult> {
  const host = normalizeHostname(input);
  const lookupName = `default._bimi.${host}`;
  const records = flattenTxt(await dns.resolveTxt(lookupName).catch(() => []));
  const bimi = records.find((record) => record.toLowerCase().startsWith("v=bimi1"));
  const tags = parseTagRecord(bimi);

  return result({
    tool,
    title,
    target: lookupName,
    status: bimi && tags.l ? "ok" : bimi ? "warning" : "warning",
    summary: bimi ? `${host} publishes a BIMI record.` : `${host} does not publish a default BIMI record.`,
    details: [
      { label: "BIMI record", value: bimi || "Missing" },
      {
        label: "Parsed BIMI",
        value: bimi
          ? [
              {
                version: String(tags.v || "BIMI1"),
                logo: String(tags.l || "not set"),
                authorityCertificate: String(tags.a || "not set")
              }
            ]
          : "No BIMI tags found"
      },
      { label: "Recommendation", value: "BIMI typically depends on DMARC enforcement and a valid SVG logo/VMC process." }
    ]
  });
}

async function runReverseDns(tool: string, title: string, input: string): Promise<ToolResult> {
  const ip = normalizeHostname(input);
  if (!net.isIP(ip)) throw new Error("Enter one public IP address for reverse DNS lookup.");
  const records = await dns.reverse(ip).catch(() => []);

  return result({
    tool,
    title,
    target: ip,
    status: records.length ? "ok" : "warning",
    summary: records.length ? `${ip} has ${records.length} PTR record(s).` : `${ip} does not return a PTR record.`,
    details: [
      { label: "IP address", value: ip },
      { label: "PTR records", value: records.length ? records : "No PTR records found" },
      {
        label: "Operational note",
        value: records.length
          ? "Reverse DNS is present. Confirm it matches the service, mail, or provider ownership expectation."
          : "Missing PTR can affect mail reputation, provider identification, and some allowlisting workflows."
      }
    ]
  });
}

async function runCaaCheck(tool: string, title: string, input: string): Promise<ToolResult> {
  const host = normalizeHostname(input);
  const records = await dns.resolveCaa(host).catch(() => []);
  const rows = records.flatMap((record) => {
    const values: Record<string, string | number | boolean>[] = [];
    const tags = ["issue", "issuewild", "iodef", "contactemail", "contactphone"] as const;
    for (const tag of tags) {
      const value = record[tag];
      if (value) values.push({ tag, value, critical: record.critical });
    }
    return values;
  });

  return result({
    tool,
    title,
    target: host,
    status: rows.length ? "ok" : "warning",
    summary: rows.length
      ? `${host} publishes ${rows.length} CAA authorization signal(s).`
      : `${host} does not publish CAA records.`,
    details: [
      { label: "CAA records", value: rows.length ? rows : "No CAA records found" },
      {
        label: "Recommendation",
        value: rows.length
          ? "Confirm the listed certificate authorities match your certificate governance and renewal process."
          : "Consider CAA records to reduce unexpected certificate issuance risk."
      }
    ]
  });
}

async function runRedirectChain(tool: string, title: string, input: string): Promise<ToolResult> {
  let currentUrl = new URL(/^https?:\/\//i.test(input.trim()) ? input.trim() : `https://${input.trim()}`);
  if (!["http:", "https:"].includes(currentUrl.protocol)) throw new Error("Only HTTP and HTTPS URLs are supported.");

  const hops: Record<string, string | number | boolean>[] = [];
  const visited = new Set<string>();
  let downgraded = false;

  for (let index = 0; index < 8; index += 1) {
    const host = normalizeHostname(currentUrl.href, { allowUrl: true });
    await assertPublicResolvedHost(host);
    if (visited.has(currentUrl.href)) throw new Error("Redirect loop detected.");
    visited.add(currentUrl.href);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    try {
      const response = await fetch(currentUrl, {
        method: "GET",
        redirect: "manual",
        signal: controller.signal,
        headers: { "user-agent": "QuantumCrafters-Network-Tool/1.0" }
      });
      const location = response.headers.get("location") || "";
      hops.push({
        hop: index + 1,
        status: response.status,
        url: currentUrl.href,
        location: location || "Final response"
      });

      if (response.status >= 300 && response.status < 400 && location) {
        const nextUrl = new URL(location, currentUrl);
        if (currentUrl.protocol === "https:" && nextUrl.protocol === "http:") downgraded = true;
        currentUrl = nextUrl;
        continue;
      }
      break;
    } finally {
      clearTimeout(timer);
    }
  }

  const finalUrl = String(hops[hops.length - 1]?.url || currentUrl.href);
  const longChain = hops.length > 4;
  const status = downgraded || longChain ? "warning" : "ok";

  return result({
    tool,
    title,
    target: finalUrl,
    status,
    summary: `Observed ${hops.length} HTTP response hop(s). Final URL: ${finalUrl}`,
    details: [
      { label: "Redirect hops", value: hops },
      { label: "Long chain", value: longChain },
      { label: "HTTPS to HTTP downgrade", value: downgraded },
      {
        label: "Recommendation",
        value: downgraded
          ? "Remove HTTPS-to-HTTP downgrades and keep the landing path encrypted."
          : longChain
            ? "Shorten redirects to reduce latency, crawl waste, and troubleshooting ambiguity."
            : "Redirect path is concise from this diagnostic edge."
      }
    ]
  });
}

async function runSubnetCalculator(tool: string, title: string, input: string): Promise<ToolResult> {
  const [ipRaw, prefixRaw] = input.trim().split("/");
  const parts = ipv4Parts(ipRaw || "");
  const prefix = Number(prefixRaw);
  if (!parts || !Number.isInteger(prefix) || prefix < 0 || prefix > 32) {
    throw new Error("Enter IPv4 CIDR notation such as 192.168.10.0/24.");
  }

  const ip = ipv4ToInt(parts);
  const mask = prefix === 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0;
  const wildcard = (~mask) >>> 0;
  const network = (ip & mask) >>> 0;
  const broadcast = (network | wildcard) >>> 0;
  const total = 2 ** (32 - prefix);
  const usable = prefix === 32 ? 1 : prefix === 31 ? 2 : Math.max(total - 2, 0);
  const firstHost = prefix >= 31 ? network : network + 1;
  const lastHost = prefix >= 31 ? broadcast : broadcast - 1;

  return result({
    tool,
    title,
    target: `${intToIpv4(network)}/${prefix}`,
    status: "ok",
    summary: `${input.trim()} maps to network ${intToIpv4(network)}/${prefix} with ${usable} usable host address(es).`,
    details: [
      { label: "Network address", value: intToIpv4(network) },
      { label: "Subnet mask", value: intToIpv4(mask) },
      { label: "Wildcard mask", value: intToIpv4(wildcard) },
      { label: "Broadcast address", value: intToIpv4(broadcast) },
      { label: "Usable host range", value: `${intToIpv4(firstHost)} - ${intToIpv4(lastHost)}` },
      { label: "Total addresses", value: total },
      { label: "Usable host addresses", value: usable },
      { label: "Private, loopback, multicast, or reserved", value: isPrivateIpv4(intToIpv4(network)) }
    ]
  });
}

async function runHttpHeaders(tool: string, title: string, input: string): Promise<ToolResult> {
  const inputUrl = new URL(/^https?:\/\//i.test(input.trim()) ? input.trim() : `https://${input.trim()}`);
  if (!["http:", "https:"].includes(inputUrl.protocol)) throw new Error("Only HTTP and HTTPS URLs are supported.");
  const host = normalizeHostname(inputUrl.href, { allowUrl: true });
  await assertPublicResolvedHost(host);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch(inputUrl, {
      method: "GET",
      redirect: "follow",
      signal: controller.signal,
      headers: { "user-agent": "QuantumCrafters-Network-Tool/1.0" }
    });
    const wanted = [
      "strict-transport-security",
      "content-security-policy",
      "x-frame-options",
      "x-content-type-options",
      "referrer-policy",
      "permissions-policy"
    ];
    const observed = wanted.map((name) => ({ header: name, value: response.headers.get(name) || "Missing" }));
    const missing = observed.filter((item) => item.value === "Missing").map((item) => item.header);

    return result({
      tool,
      title,
      target: inputUrl.href,
      status: missing.length ? "warning" : "ok",
      summary: missing.length
        ? `${missing.length} important security header(s) were not observed.`
        : "Core HTTP security headers were observed.",
      details: [
        { label: "HTTP status", value: response.status },
        { label: "Final URL", value: response.url },
        { label: "Security headers", value: observed },
        { label: "Server", value: response.headers.get("server") || "Not disclosed" }
      ]
    });
  } finally {
    clearTimeout(timer);
  }
}

async function runHttpStatus(tool: string, title: string, input: string): Promise<ToolResult> {
  const inputUrl = normalizeHttpUrl(input);
  const host = normalizeHostname(inputUrl.href, { allowUrl: true });
  await assertPublicResolvedHost(host);
  const response = await fetchWithTimeout(inputUrl, { method: "GET", redirect: "manual" });
  const redirectLocation = response.headers.get("location") || "";

  return result({
    tool,
    title,
    target: inputUrl.href,
    status: response.status < 400 ? "ok" : response.status < 500 ? "warning" : "error",
    summary: `${inputUrl.href} returned HTTP ${response.status}.`,
    details: [
      { label: "HTTP status", value: response.status },
      { label: "Status text", value: response.statusText || "No status text" },
      { label: "Redirect location", value: redirectLocation || "No redirect location" },
      { label: "Server", value: response.headers.get("server") || "Not disclosed" },
      { label: "Cache-Control", value: response.headers.get("cache-control") || "Not set" }
    ]
  });
}

async function runWebsiteAvailability(tool: string, title: string, input: string): Promise<ToolResult> {
  const inputUrl = normalizeHttpUrl(input);
  const host = normalizeHostname(inputUrl.href, { allowUrl: true });
  await assertPublicResolvedHost(host);
  const started = Date.now();
  const response = await fetchWithTimeout(inputUrl, { method: "GET", redirect: "follow" }, 10_000);
  const elapsedMs = Date.now() - started;
  const available = response.status >= 200 && response.status < 400;

  return result({
    tool,
    title,
    target: inputUrl.href,
    status: available ? "ok" : response.status < 500 ? "warning" : "error",
    summary: available ? `${inputUrl.href} responded in ${elapsedMs} ms.` : `${inputUrl.href} returned HTTP ${response.status} in ${elapsedMs} ms.`,
    details: [
      { label: "HTTP status", value: response.status },
      { label: "Elapsed milliseconds", value: elapsedMs },
      { label: "Final URL", value: response.url },
      { label: "Content-Type", value: response.headers.get("content-type") || "Not disclosed" },
      { label: "Availability signal", value: available ? "Reachable with a successful response." : "Reachable, but the response should be reviewed." }
    ]
  });
}

async function runHstsReadiness(tool: string, title: string, input: string): Promise<ToolResult> {
  const host = normalizeHostname(input, { allowUrl: true });
  await assertPublicResolvedHost(host);
  const url = new URL(`https://${host}/`);
  const response = await fetchWithTimeout(url, { method: "GET", redirect: "follow" });
  const hsts = response.headers.get("strict-transport-security") || "";
  const maxAge = Number(hsts.match(/max-age=(\d+)/i)?.[1] || 0);
  const includeSubDomains = /includesubdomains/i.test(hsts);
  const preload = /preload/i.test(hsts);
  const ready = maxAge >= 31_536_000 && includeSubDomains;

  return result({
    tool,
    title,
    target: url.href,
    status: ready ? "ok" : hsts ? "warning" : "error",
    summary: hsts ? `${host} sends HSTS with max-age ${maxAge}.` : `${host} does not send an HSTS header.`,
    details: [
      { label: "HSTS header", value: hsts || "Missing" },
      { label: "Max age seconds", value: maxAge },
      { label: "includeSubDomains", value: includeSubDomains },
      { label: "preload flag", value: preload },
      {
        label: "Recommendation",
        value: ready ? "HSTS is strong enough for many production baselines." : "Use HTTPS everywhere first, then set long max-age with includeSubDomains when safe."
      }
    ]
  });
}

async function runRobotsTxt(tool: string, title: string, input: string): Promise<ToolResult> {
  const url = normalizeHttpUrl(input, "/robots.txt");
  const host = normalizeHostname(url.href, { allowUrl: true });
  await assertPublicResolvedHost(host);
  const response = await fetchWithTimeout(url, { method: "GET", redirect: "follow" });
  const text = response.ok ? await response.text() : "";
  const disallowCount = (text.match(/^disallow:/gim) || []).length;
  const sitemapCount = (text.match(/^sitemap:/gim) || []).length;

  return result({
    tool,
    title,
    target: url.href,
    status: response.ok ? "ok" : "warning",
    summary: response.ok ? `${host} publishes robots.txt with ${disallowCount} disallow rule(s).` : `${host} returned HTTP ${response.status} for robots.txt.`,
    details: [
      { label: "HTTP status", value: response.status },
      { label: "File size bytes", value: text.length },
      { label: "Disallow rules", value: disallowCount },
      { label: "Sitemap references", value: sitemapCount },
      { label: "Recommendation", value: response.ok ? "Review crawl rules before SEO migrations, staging exposure checks, or sensitive path reviews." : "Publish robots.txt when crawl guidance is required." }
    ]
  });
}

async function runSecurityTxt(tool: string, title: string, input: string): Promise<ToolResult> {
  const base = normalizeHttpUrl(input, "/");
  const host = normalizeHostname(base.href, { allowUrl: true });
  await assertPublicResolvedHost(host);
  const candidates = [new URL("/.well-known/security.txt", base), new URL("/security.txt", base)];
  const attempts = [];
  let foundText = "";
  let foundUrl = "";

  for (const candidate of candidates) {
    const response = await fetchWithTimeout(candidate, { method: "GET", redirect: "follow" }).catch(() => null);
    attempts.push({ url: candidate.href, status: response?.status || "fetch failed" });
    if (response?.ok) {
      foundText = await response.text();
      foundUrl = candidate.href;
      break;
    }
  }

  const directives = ["Contact", "Expires", "Encryption", "Policy", "Hiring", "Preferred-Languages", "Canonical"];
  const parsed = directives
    .map((name) => ({ field: name, value: foundText.match(new RegExp(`^${name}:\\s*(.+)$`, "im"))?.[1]?.slice(0, 180) || "Missing" }))
    .filter((item) => item.value !== "Missing");

  return result({
    tool,
    title,
    target: foundUrl || candidates[0].href,
    status: foundText ? "ok" : "warning",
    summary: foundText ? `${host} publishes security.txt metadata.` : `${host} does not publish security.txt at the standard paths checked.`,
    details: [
      { label: "Checked paths", value: attempts },
      { label: "Security.txt fields", value: parsed.length ? parsed : "No fields found" },
      { label: "File size bytes", value: foundText.length },
      { label: "Recommendation", value: foundText ? "Confirm contact, expiry, policy, and encryption values are current." : "Publish /.well-known/security.txt for responsible disclosure routing." }
    ]
  });
}

async function runSslCertificate(tool: string, title: string, input: string): Promise<ToolResult> {
  const host = normalizeHostname(input, { allowUrl: true });
  await assertPublicResolvedHost(host);

  const certificate = await new Promise<tls.PeerCertificate & { protocol?: string; cipher?: string }>((resolve, reject) => {
    const socket = tls.connect({
      host,
      port: 443,
      servername: host,
      rejectUnauthorized: false,
      timeout: 8000
    });

    socket.once("secureConnect", () => {
      const cert = socket.getPeerCertificate();
      const cipher = socket.getCipher();
      resolve({ ...cert, protocol: socket.getProtocol() || "", cipher: cipher?.name || "" });
      socket.end();
    });
    socket.once("timeout", () => {
      socket.destroy();
      reject(new Error("TLS connection timed out."));
    });
    socket.once("error", reject);
  });

  if (!certificate.valid_to) throw new Error("No peer certificate was returned.");
  const expiresAt = new Date(certificate.valid_to);
  const daysRemaining = Math.ceil((expiresAt.getTime() - Date.now()) / 86_400_000);
  const altNames =
    certificate.subjectaltname
      ?.split(",")
      .map((item) => item.trim().replace(/^DNS:/, ""))
      .slice(0, 12) || [];

  return result({
    tool,
    title,
    target: host,
    status: daysRemaining > 30 ? "ok" : daysRemaining > 0 ? "warning" : "error",
    summary:
      daysRemaining > 0
        ? `${host} certificate expires in ${daysRemaining} day(s).`
        : `${host} certificate appears to be expired.`,
    details: [
      { label: "Subject", value: certificate.subject?.CN || host },
      { label: "Issuer", value: certificate.issuer?.CN || "Unknown issuer" },
      { label: "Valid from", value: certificate.valid_from || "Unknown" },
      { label: "Valid to", value: certificate.valid_to || "Unknown" },
      { label: "Days remaining", value: daysRemaining },
      { label: "TLS protocol", value: certificate.protocol || "Unknown" },
      { label: "Cipher", value: certificate.cipher || "Unknown" },
      { label: "Subject alternative names", value: altNames.length ? altNames : "Not available" }
    ]
  });
}

async function testTlsVersion(host: string, version: tls.SecureVersion) {
  return new Promise<Record<string, string | number | boolean>>((resolve) => {
    const socket = tls.connect({
      host,
      port: 443,
      servername: host,
      minVersion: version,
      maxVersion: version,
      ALPNProtocols: ["h2", "http/1.1"],
      rejectUnauthorized: false,
      timeout: 8000
    });

    socket.once("secureConnect", () => {
      const cipher = socket.getCipher();
      resolve({
        version,
        supported: true,
        negotiatedProtocol: socket.getProtocol() || version,
        alpn: socket.alpnProtocol || "not negotiated",
        cipher: cipher?.name || "not disclosed"
      });
      socket.end();
    });
    socket.once("timeout", () => {
      socket.destroy();
      resolve({ version, supported: false, error: "timeout" });
    });
    socket.once("error", (error) => {
      resolve({ version, supported: false, error: error.message.slice(0, 120) });
    });
  });
}

async function runTlsVersionCheck(tool: string, title: string, input: string): Promise<ToolResult> {
  const host = normalizeHostname(input, { allowUrl: true });
  await assertPublicResolvedHost(host);
  const checks = await Promise.all([testTlsVersion(host, "TLSv1.3"), testTlsVersion(host, "TLSv1.2")]);
  const supports13 = checks.some((check) => check.version === "TLSv1.3" && check.supported);
  const supports12 = checks.some((check) => check.version === "TLSv1.2" && check.supported);

  return result({
    tool,
    title,
    target: `${host}:443`,
    status: supports13 ? "ok" : supports12 ? "warning" : "error",
    summary: supports13 ? `${host} supports TLS 1.3.` : supports12 ? `${host} supports TLS 1.2 but TLS 1.3 was not confirmed.` : `${host} did not negotiate TLS 1.2 or TLS 1.3.`,
    details: [
      { label: "TLS checks", value: checks },
      { label: "Recommendation", value: supports13 ? "Modern TLS support is present. Review certificate, ciphers, and headers for the full exposure picture." : "Review TLS configuration and platform support for modern protocol readiness." }
    ]
  });
}

async function runPortCheck(tool: string, title: string, input: string, port?: number): Promise<ToolResult> {
  const host = normalizeHostname(input);
  const checkedPort = port || 443;
  await assertPublicResolvedHost(host);

  const open = await checkTcpPort(host, checkedPort);

  return result({
    tool,
    title,
    target: `${host}:${checkedPort}`,
    status: open ? "ok" : "warning",
    summary: open ? `${host}:${checkedPort} is reachable over TCP.` : `${host}:${checkedPort} was not reachable over TCP.`,
    details: [
      { label: "Host", value: host },
      { label: "Port", value: checkedPort },
      { label: "Reachable from QCS edge", value: open },
      { label: "Note", value: "This checks one public TCP port only; it is not a vulnerability scan." }
    ]
  });
}

async function runCommonPortExposure(tool: string, title: string, input: string): Promise<ToolResult> {
  const host = normalizeHostname(input);
  await assertPublicResolvedHost(host);
  const ports = [
    { port: 21, service: "FTP" },
    { port: 22, service: "SSH" },
    { port: 25, service: "SMTP" },
    { port: 53, service: "DNS" },
    { port: 80, service: "HTTP" },
    { port: 110, service: "POP3" },
    { port: 143, service: "IMAP" },
    { port: 443, service: "HTTPS" },
    { port: 445, service: "SMB" },
    { port: 3389, service: "RDP" },
    { port: 8080, service: "HTTP alternate" },
    { port: 8443, service: "HTTPS alternate" }
  ];
  const rows = await Promise.all(
    ports.map(async (item) => ({
      ...item,
      reachable: await checkTcpPort(host, item.port, 1800)
    }))
  );
  const openRows = rows.filter((item) => item.reachable);
  const highRiskOpen = rows.filter((item) => item.reachable && [21, 22, 23, 25, 445, 3389].includes(item.port));

  return result({
    tool,
    title,
    target: host,
    status: highRiskOpen.length ? "warning" : "ok",
    summary: openRows.length ? `${host} has ${openRows.length} common TCP port(s) reachable from QCS edge.` : `${host} did not respond on the common TCP ports checked.`,
    details: [
      { label: "Port checks", value: rows },
      { label: "High-review ports open", value: highRiskOpen.length ? highRiskOpen.map((item) => `${item.port}/${item.service}`) : "None observed" },
      { label: "Note", value: "This is a limited reachability check, not a vulnerability scan." }
    ]
  });
}

async function runWildcardCalculator(tool: string, title: string, input: string): Promise<ToolResult> {
  const [ipRaw, prefixRaw] = input.trim().split("/");
  const parts = ipv4Parts(ipRaw || "");
  const prefix = Number(prefixRaw);
  if (!parts || !Number.isInteger(prefix) || prefix < 0 || prefix > 32) {
    throw new Error("Enter IPv4 CIDR notation such as 192.168.10.0/24.");
  }

  const ip = ipv4ToInt(parts);
  const mask = prefix === 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0;
  const wildcard = (~mask) >>> 0;
  const network = (ip & mask) >>> 0;
  const broadcast = (network | wildcard) >>> 0;
  const firstHost = prefix >= 31 ? network : network + 1;
  const lastHost = prefix >= 31 ? broadcast : broadcast - 1;

  return result({
    tool,
    title,
    target: `${intToIpv4(network)}/${prefix}`,
    status: "ok",
    summary: `${intToIpv4(network)}/${prefix} uses wildcard mask ${intToIpv4(wildcard)}.`,
    details: [
      { label: "Network address", value: intToIpv4(network) },
      { label: "Subnet mask", value: intToIpv4(mask) },
      { label: "Wildcard mask", value: intToIpv4(wildcard) },
      { label: "Usable host range", value: `${intToIpv4(firstHost)} - ${intToIpv4(lastHost)}` },
      { label: "Cisco ACL example", value: `permit ip ${intToIpv4(network)} ${intToIpv4(wildcard)} any` },
      { label: "Broadcast address", value: intToIpv4(broadcast) }
    ]
  });
}

async function runRpkiValidator(tool: string, title: string, params: Record<string, string | number | boolean>): Promise<ToolResult> {
  const prefix = parseIpv4Cidr(textParam(params, "prefix")).input;
  const asn = normalizeAsn(textParam(params, "asn"));
  const url = `https://stat.ripe.net/data/rpki-validation/data.json?resource=${encodeURIComponent(asn)}&prefix=${encodeURIComponent(prefix)}`;
  const payload = (await fetchJson(url).catch((error) => ({ error: errorMessage(error) }))) as { data?: Record<string, unknown>; error?: string };
  const data = payload.data || {};
  const status = String(data.status || data.validation_status || (payload.error ? "remote check unavailable" : "unknown"));
  const rows = [
    {
      prefix,
      asn,
      validation: status,
      checkedBy: "RIPEstat RPKI validation API"
    }
  ];
  const ok = /valid/i.test(status) && !/invalid/i.test(status);
  const invalid = /invalid/i.test(status);

  return result({
    tool,
    title,
    target: `${prefix} ${asn}`,
    status: invalid ? "error" : ok ? "ok" : "warning",
    summary: invalid ? `${prefix} is RPKI invalid for ${asn}.` : ok ? `${prefix} appears RPKI valid for ${asn}.` : `RPKI status for ${prefix} and ${asn}: ${status}.`,
    details: [
      { label: "Route-origin validation", value: rows },
      { label: "Remote source note", value: payload.error || "Validated through public routing intelligence." },
      { label: "Next action", value: invalid ? "Treat this as urgent. Verify ROA, origin ASN, prefix length, and route announcements." : "Confirm ROA coverage, maxLength, and expected origin before route changes." }
    ]
  });
}

async function runAsnIntelligence(tool: string, title: string, input: string): Promise<ToolResult> {
  const resource = /^as/i.test(input.trim()) || /^\d+$/.test(input.trim()) ? normalizeAsn(input) : normalizeHostname(input);
  const encoded = encodeURIComponent(resource);
  const [networkInfo, prefixes] = await Promise.all([
    fetchJson(`https://stat.ripe.net/data/network-info/data.json?resource=${encoded}`).catch((error) => ({ error: errorMessage(error) })),
    fetchJson(`https://stat.ripe.net/data/announced-prefixes/data.json?resource=${encoded}`).catch((error) => ({ error: errorMessage(error) }))
  ]);
  const infoData = ((networkInfo as { data?: Record<string, unknown> }).data || {}) as Record<string, unknown>;
  const prefixData = ((prefixes as { data?: { prefixes?: unknown[] } }).data?.prefixes || []) as unknown[];
  const rows = toDetailRows(prefixData.slice(0, 12));

  return result({
    tool,
    title,
    target: resource,
    status: prefixData.length || Object.keys(infoData).length ? "ok" : "warning",
    summary: prefixData.length ? `${resource} has ${prefixData.length} announced prefix signal(s) in RIPEstat.` : `Collected public ASN/routing context for ${resource}.`,
    details: [
      { label: "Network context", value: toDetailRows([infoData]).length ? toDetailRows([infoData]) : "No network info returned" },
      { label: "Announced prefixes sample", value: rows.length ? rows : "No announced prefix sample returned" },
      { label: "Evidence links", value: [`https://stat.ripe.net/${resource}`, `https://bgp.he.net/${resource}`] }
    ]
  });
}

async function runBgpRouteAnomaly(tool: string, title: string, input: string): Promise<ToolResult> {
  const target = input.trim().toUpperCase();
  if (!target) throw new Error("Enter an ASN or prefix.");
  const resource = target.includes("/") ? parseIpv4Cidr(target).input : normalizeAsn(target);
  const encoded = encodeURIComponent(resource);
  const visibility = await fetchJson(`https://stat.ripe.net/data/routing-status/data.json?resource=${encoded}`).catch((error) => ({ error: errorMessage(error) }));
  const data = ((visibility as { data?: Record<string, unknown> }).data || {}) as Record<string, unknown>;

  return result({
    tool,
    title,
    target: resource,
    status: (visibility as { error?: string }).error ? "warning" : "ok",
    summary: `Prepared BGP anomaly review for ${resource}.`,
    details: [
      { label: "Routing status", value: Object.keys(data).length ? toDetailRows([data]) : "No live routing-status payload returned" },
      {
        label: "Review checklist",
        value: [
          "Compare current origin ASN with expected origin and ROA.",
          "Check recent path changes, new upstreams, and unexpected more-specific announcements.",
          "Validate route filters, IRR objects, RPKI maxLength, and provider announcements.",
          "Escalate with prefix, ASN, first-seen time, affected regions, and traceroute evidence."
        ]
      },
      { label: "Evidence links", value: [`https://stat.ripe.net/${resource}`, `https://radar.cloudflare.com/routing/${resource}`] }
    ]
  });
}

async function runGlobalTraceroutePlanner(tool: string, title: string, input: string): Promise<ToolResult> {
  const host = normalizeHostname(input);
  await assertPublicResolvedHost(host);
  const probes = [
    { region: "India", city: "Mumbai / Delhi", command: `traceroute ${host}` },
    { region: "Singapore", city: "Singapore", command: `traceroute ${host}` },
    { region: "Middle East", city: "Dubai", command: `traceroute ${host}` },
    { region: "Europe", city: "Frankfurt / London", command: `traceroute ${host}` },
    { region: "US", city: "Ashburn / Dallas", command: `traceroute ${host}` }
  ];

  return result({
    tool,
    title,
    target: host,
    status: "ok",
    summary: `Created a multi-region traceroute evidence plan for ${host}.`,
    details: [
      { label: "Regional probes", value: probes },
      { label: "Linux/macOS command", value: [`traceroute ${host}`, `mtr -rwzc 100 ${host}`] },
      { label: "Windows command", value: [`tracert ${host}`, `pathping ${host}`] },
      { label: "Evidence to capture", value: ["source region", "source ISP/cloud", "timestamp with timezone", "packet loss per hop", "last responding hop", "application symptom"] }
    ]
  });
}

async function runGlobalLatencyPlanner(tool: string, title: string, input: string): Promise<ToolResult> {
  const host = normalizeHostname(input);
  await assertPublicResolvedHost(host);
  const regions = [
    { region: "India", target: host, threshold: "Business apps: <120 ms, voice: <80 ms preferred" },
    { region: "Singapore", target: host, threshold: "APAC SaaS and cloud benchmark" },
    { region: "Europe", target: host, threshold: "EU user and CDN path benchmark" },
    { region: "US East", target: host, threshold: "US SaaS/cloud benchmark" },
    { region: "Middle East", target: host, threshold: "Gulf user and branch benchmark" }
  ];

  return result({
    tool,
    title,
    target: host,
    status: "ok",
    summary: `Created a global latency measurement plan for ${host}.`,
    details: [
      { label: "Regional latency plan", value: regions },
      { label: "Commands", value: [`ping -c 20 ${host}`, `mtr -rwzc 100 ${host}`, `curl -w '%{time_connect} %{time_starttransfer} %{time_total}\\n' -o /dev/null -s https://${host}`] },
      { label: "Interpretation", value: ["Track latency, jitter, loss, DNS time, TCP connect, TLS handshake, and first byte separately.", "Compare user regions against cloud/SASE/VPN egress location."] }
    ]
  });
}

async function runDnsPropagation(tool: string, title: string, params: Record<string, string | number | boolean>): Promise<ToolResult> {
  const domain = normalizeHostname(textParam(params, "domain"));
  const recordType = textParam(params, "recordType", "A").toUpperCase();
  const resolvers = [
    { name: "Google DNS", url: `https://dns.google/resolve?name=${domain}&type=${recordType}` },
    { name: "Cloudflare DNS", url: `https://cloudflare-dns.com/dns-query?name=${domain}&type=${recordType}` },
    { name: "Quad9 DNS", url: `https://dns.quad9.net:5053/dns-query?name=${domain}&type=${recordType}` }
  ];
  const rows = await Promise.all(
    resolvers.map(async (resolver) => {
      const response = await fetchWithTimeout(new URL(resolver.url), { headers: { accept: "application/dns-json" } }).catch(() => null);
      const data = response?.ok ? ((await response.json().catch(() => ({}))) as { Status?: number; Answer?: { data?: string; TTL?: number }[] }) : {};
      return {
        resolver: resolver.name,
        status: data.Status ?? "failed",
        answers: data.Answer?.map((answer) => answer.data).join(", ") || "No answer",
        lowestTtl: data.Answer?.reduce((min, answer) => Math.min(min, answer.TTL || min), Number.POSITIVE_INFINITY) || 0
      };
    })
  );
  const uniqueAnswers = new Set(rows.map((row) => row.answers));

  return result({
    tool,
    title,
    target: `${domain} ${recordType}`,
    status: uniqueAnswers.size <= 1 ? "ok" : "warning",
    summary: uniqueAnswers.size <= 1 ? `${domain} ${recordType} answers are consistent across checked resolvers.` : `${domain} ${recordType} answers differ across public resolvers.`,
    details: [
      { label: "Resolver comparison", value: rows },
      { label: "Propagation signal", value: uniqueAnswers.size <= 1 ? "Consistent among checked resolvers." : "Resolver drift observed. Confirm TTL, recent changes, and authoritative records." }
    ]
  });
}

async function runStartTlsMail(tool: string, title: string, input: string): Promise<ToolResult> {
  const host = normalizeHostname(input);
  const mxRecords = await dns.resolveMx(host).then((items) => items.sort((left, right) => left.priority - right.priority)).catch(() => []);
  const checks = await Promise.all(
    mxRecords.slice(0, 3).map(async (mx) => ({
      mx: mx.exchange,
      priority: mx.priority,
      port25Reachable: await checkTcpPort(mx.exchange, 25, 4000)
    }))
  );

  return result({
    tool,
    title,
    target: host,
    status: mxRecords.length && checks.some((check) => check.port25Reachable) ? "ok" : "warning",
    summary: mxRecords.length ? `${host} has ${mxRecords.length} MX record(s); checked port 25 reachability for the first ${checks.length}.` : `${host} does not publish MX records.`,
    details: [
      { label: "MX STARTTLS pre-check", value: checks.length ? checks : "No MX records found" },
      { label: "STARTTLS review steps", value: ["Confirm EHLO advertises STARTTLS.", "Validate TLS certificate name and expiry.", "Check MTA-STS, TLS-RPT, and DANE where required.", "Capture SMTP transcript during an approved troubleshooting window."] }
    ]
  });
}

async function runDaneTlsa(tool: string, title: string, params: Record<string, string | number | boolean>): Promise<ToolResult> {
  const host = normalizeHostname(textParam(params, "hostname"));
  const port = Number(textParam(params, "port", "25"));
  const protocol = textParam(params, "protocol", "_tcp") === "_udp" ? "_udp" : "_tcp";
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("Enter a valid TLS port.");
  const lookupName = `_${port}.${protocol}.${host}`;
  const records = (await dns.resolveTlsa(lookupName).catch(() => [])) as unknown[];
  const rows = toDetailRows(records);

  return result({
    tool,
    title,
    target: lookupName,
    status: rows.length ? "ok" : "warning",
    summary: rows.length ? `${lookupName} publishes ${rows.length} TLSA record(s).` : `${lookupName} does not publish TLSA records.`,
    details: [
      { label: "TLSA records", value: rows.length ? rows : "No TLSA records found" },
      { label: "Recommendation", value: rows.length ? "Confirm DNSSEC validation, certificate rollover process, and service binding." : "DANE requires DNSSEC-signed TLSA records and compatible client/server policy." }
    ]
  });
}

async function runMtaStsTlsRpt(tool: string, title: string, input: string): Promise<ToolResult> {
  const host = normalizeHostname(input);
  const [mtaTxt, tlsRptTxt] = await Promise.all([
    dns.resolveTxt(`_mta-sts.${host}`).then(flattenTxt).catch(() => []),
    dns.resolveTxt(`_smtp._tls.${host}`).then(flattenTxt).catch(() => [])
  ]);
  const policyUrl = new URL(`https://mta-sts.${host}/.well-known/mta-sts.txt`);
  const policyResponse = await fetchWithTimeout(policyUrl, { method: "GET", redirect: "follow" }, 8000).catch(() => null);
  const policyText = policyResponse?.ok ? await policyResponse.text() : "";
  const mode = policyText.match(/^mode:\s*(.+)$/im)?.[1]?.trim() || "missing";
  const mxRules = (policyText.match(/^mx:\s*(.+)$/gim) || []).map((line) => line.replace(/^mx:\s*/i, ""));

  return result({
    tool,
    title,
    target: host,
    status: mtaTxt.length && tlsRptTxt.length && policyText ? "ok" : "warning",
    summary: `MTA-STS mode for ${host}: ${mode}. TLS-RPT record ${tlsRptTxt.length ? "found" : "missing"}.`,
    details: [
      { label: "MTA-STS TXT", value: mtaTxt.length ? mtaTxt : "Missing" },
      { label: "TLS-RPT TXT", value: tlsRptTxt.length ? tlsRptTxt : "Missing" },
      { label: "Policy file", value: policyText ? policyText.slice(0, 1200) : "Missing or unreachable" },
      { label: "MX policy rules", value: mxRules.length ? mxRules : "No mx rules found" },
      { label: "Recommendation", value: mode === "enforce" ? "Policy is enforcing. Monitor TLS-RPT reports and certificate changes." : "Use testing mode before enforce and verify all MX hosts support valid TLS." }
    ]
  });
}

async function runDeepMxHealth(tool: string, title: string, input: string): Promise<ToolResult> {
  const host = normalizeHostname(input);
  const [mx, txt, dmarcTxt, mtaTxt, tlsRptTxt] = await Promise.all([
    dns.resolveMx(host).then((items) => items.sort((left, right) => left.priority - right.priority)).catch(() => []),
    dns.resolveTxt(host).then(flattenTxt).catch(() => []),
    dns.resolveTxt(`_dmarc.${host}`).then(flattenTxt).catch(() => []),
    dns.resolveTxt(`_mta-sts.${host}`).then(flattenTxt).catch(() => []),
    dns.resolveTxt(`_smtp._tls.${host}`).then(flattenTxt).catch(() => [])
  ]);
  const spf = txt.find((record) => record.toLowerCase().startsWith("v=spf1"));
  const dmarc = dmarcTxt.find((record) => record.toLowerCase().startsWith("v=dmarc1"));
  const mxRows = await Promise.all(
    mx.slice(0, 5).map(async (record) => {
      const addresses = await dns.lookup(record.exchange, { all: true }).catch(() => []);
      const ptr = addresses[0]?.address ? await dns.reverse(addresses[0].address).catch(() => []) : [];
      return { priority: record.priority, exchange: record.exchange, address: addresses[0]?.address || "unresolved", ptr: ptr[0] || "missing" };
    })
  );
  const score = [mx.length > 0, Boolean(spf), Boolean(dmarc), mtaTxt.length > 0, tlsRptTxt.length > 0].filter(Boolean).length;

  return result({
    tool,
    title,
    target: host,
    status: score >= 4 ? "ok" : score >= 2 ? "warning" : "error",
    summary: `${host} mail health score: ${score}/5 core signals present.`,
    details: [
      { label: "MX hosts", value: mxRows.length ? mxRows : "No MX records found" },
      { label: "SPF", value: spf || "Missing" },
      { label: "DMARC", value: dmarc || "Missing" },
      { label: "MTA-STS", value: mtaTxt.length ? mtaTxt : "Missing" },
      { label: "TLS-RPT", value: tlsRptTxt.length ? tlsRptTxt : "Missing" },
      { label: "Priority fixes", value: ["MX reachability", "SPF correctness", "DMARC reporting/enforcement", "MTA-STS policy", "TLS-RPT visibility", "PTR alignment for sending IPs"] }
    ]
  });
}

async function runIpReputation(tool: string, title: string, input: string): Promise<ToolResult> {
  const ip = normalizeHostname(input);
  if (!net.isIP(ip)) throw new Error("Enter one public IP address.");
  const reversed = ip.split(".").reverse().join(".");
  const lists = [
    { name: "Spamhaus ZEN", query: `${reversed}.zen.spamhaus.org` },
    { name: "Spamcop", query: `${reversed}.bl.spamcop.net` }
  ];
  const rows = await Promise.all(
    lists.map(async (list) => ({
      list: list.name,
      listed: Boolean((await dns.resolve4(list.query).catch(() => [])).length)
    }))
  );
  const listed = rows.filter((row) => row.listed);

  return result({
    tool,
    title,
    target: ip,
    status: listed.length ? "warning" : "ok",
    summary: listed.length ? `${ip} appears on ${listed.length} DNSBL-style list(s) checked.` : `${ip} was not listed on the DNSBL-style checks run.`,
    details: [
      { label: "DNSBL-style checks", value: rows },
      { label: "Evidence links", value: [`https://check.spamhaus.org/listed/?searchterm=${ip}`, `https://www.abuseipdb.com/check/${ip}`] },
      { label: "Recommendation", value: listed.length ? "Confirm sending source, abuse reports, compromised hosts, and delisting requirements." : "Continue monitoring reputation if mail delivery or abuse complaints are involved." }
    ]
  });
}

type CloudRange = {
  provider: string;
  cidr: string;
  service: string;
  region: string;
};

async function loadCloudRanges(provider: string): Promise<CloudRange[]> {
  if (provider === "aws") {
    const data = (await fetchJson("https://ip-ranges.amazonaws.com/ip-ranges.json")) as { prefixes?: { ip_prefix?: string; service?: string; region?: string }[] };
    return (data.prefixes || []).map((item) => ({
      provider: "AWS",
      cidr: item.ip_prefix || "",
      service: item.service || "unknown",
      region: item.region || "GLOBAL"
    })).filter((item) => item.cidr);
  }

  if (provider === "gcp") {
    const data = (await fetchJson("https://www.gstatic.com/ipranges/cloud.json")) as { prefixes?: { ipv4Prefix?: string; service?: string; scope?: string }[] };
    return (data.prefixes || []).map((item) => ({
      provider: "Google Cloud",
      cidr: item.ipv4Prefix || "",
      service: item.service || "cloud",
      region: item.scope || "GLOBAL"
    })).filter((item) => item.cidr);
  }

  const [v4] = await Promise.all([fetchWithTimeout(new URL("https://www.cloudflare.com/ips-v4")).then((response) => response.text())]);
  return textLines(v4).map((cidr) => ({ provider: "Cloudflare", cidr, service: "Cloudflare edge", region: "GLOBAL" }));
}

async function runCloudIpRangeLookup(tool: string, title: string, params: Record<string, string | number | boolean>): Promise<ToolResult> {
  const provider = textParam(params, "provider", "aws");
  const ip = textParam(params, "ip");
  if (!ipv4Parts(ip)) throw new Error("Enter a public IPv4 address for cloud range lookup.");
  const ranges = await loadCloudRanges(provider);
  const matches = ranges.filter((range) => ipv4InRange(ip, range.cidr)).slice(0, 20);

  return result({
    tool,
    title,
    target: `${provider} ${ip}`,
    status: matches.length ? "ok" : "warning",
    summary: matches.length ? `${ip} matched ${matches.length} ${matches[0].provider} public range(s).` : `${ip} did not match the selected provider ranges.`,
    details: [
      { label: "Matching ranges", value: matches.length ? matches : "No provider range match" },
      { label: "Ranges checked", value: ranges.length },
      { label: "Recommendation", value: matches.length ? "Use provider metadata to confirm firewall allowlist, logging, and ownership." : "Try another provider or confirm whether this IP is customer-owned, CDN, ISP, or another cloud." }
    ]
  });
}

function formatAllowlist(vendor: string, ranges: CloudRange[]) {
  if (vendor === "cisco") {
    return ["object-group network QCS_CLOUD_ALLOWLIST", ...ranges.map((range) => ` network-object ${range.cidr}`)];
  }
  if (vendor === "fortigate") {
    return ranges.flatMap((range, index) => [`config firewall address`, ` edit "qcs_cloud_${index + 1}"`, `  set subnet ${range.cidr}`, " next", "end"]);
  }
  if (vendor === "paloalto") {
    return ranges.map((range, index) => `<entry name="qcs-cloud-${index + 1}"><ip-netmask>${range.cidr}</ip-netmask></entry>`);
  }
  return ranges.map((range) => `${range.cidr} # ${range.provider} ${range.service} ${range.region}`);
}

async function runCloudAllowlist(tool: string, title: string, params: Record<string, string | number | boolean>): Promise<ToolResult> {
  const provider = textParam(params, "provider", "aws");
  const region = textParam(params, "region").toLowerCase();
  const service = textParam(params, "service").toLowerCase();
  const vendor = textParam(params, "vendor", "generic");
  const limit = Math.min(50, Math.max(1, Number(textParam(params, "limit", "12")) || 12));
  const ranges = (await loadCloudRanges(provider))
    .filter((range) => !region || range.region.toLowerCase().includes(region))
    .filter((range) => !service || range.service.toLowerCase().includes(service))
    .slice(0, limit);

  return result({
    tool,
    title,
    target: `${provider} ${region || "all-regions"} ${service || "all-services"}`,
    status: ranges.length ? "ok" : "warning",
    summary: ranges.length ? `Generated ${ranges.length} ${vendor} allowlist item(s).` : "No matching cloud ranges found for the selected filters.",
    details: [
      { label: "Matched ranges", value: ranges.length ? ranges : "No ranges matched" },
      { label: "Generated allowlist", value: ranges.length ? formatAllowlist(vendor, ranges) : "Adjust provider, region, or service filters." },
      { label: "Change-control note", value: "Validate provider JSON timestamp, object naming, rule direction, and business owner before deploying." }
    ]
  });
}

function runCidrOverlap(tool: string, title: string, params: Record<string, string | number | boolean>): ToolResult {
  const ranges = parseCidrList(textParam(params, "cidrs"));
  const overlaps: Record<string, string | number | boolean>[] = [];
  for (let i = 0; i < ranges.length; i += 1) {
    for (let j = i + 1; j < ranges.length; j += 1) {
      const left = ranges[i];
      const right = ranges[j];
      if (left.start <= right.end && right.start <= left.end) {
        overlaps.push({ left: left.input, right: right.input, overlapStart: intToIpv4(Math.max(left.start, right.start)), overlapEnd: intToIpv4(Math.min(left.end, right.end)) });
      }
    }
  }

  return result({
    tool,
    title,
    target: `${ranges.length} CIDR ranges`,
    status: overlaps.length ? "warning" : "ok",
    summary: overlaps.length ? `Found ${overlaps.length} overlapping CIDR pair(s).` : "No overlapping IPv4 CIDR ranges were found.",
    details: [
      { label: "Normalized ranges", value: ranges.map((range) => ({ cidr: range.input, start: intToIpv4(range.start), end: intToIpv4(range.end) })) },
      { label: "Overlaps", value: overlaps.length ? overlaps : "No overlaps detected" },
      { label: "Planning note", value: "Resolve overlaps before VPN, VPC/VNet peering, route exchange, or firewall object migration." }
    ]
  });
}

function runCidrSummarizer(tool: string, title: string, params: Record<string, string | number | boolean>): ToolResult {
  const ranges = parseCidrList(textParam(params, "cidrs")).sort((left, right) => left.start - right.start);
  const merged: { start: number; end: number }[] = [];
  for (const range of ranges) {
    const last = merged[merged.length - 1];
    if (last && range.start <= last.end + 1) last.end = Math.max(last.end, range.end);
    else merged.push({ start: range.start, end: range.end });
  }
  const summarized = merged.flatMap((range) => rangeToCidrs(range.start, range.end));

  return result({
    tool,
    title,
    target: `${ranges.length} input ranges`,
    status: "ok",
    summary: `Reduced ${ranges.length} input range(s) into ${summarized.length} summarized CIDR range(s).`,
    details: [
      { label: "Summarized CIDRs", value: summarized },
      { label: "Merged ranges", value: merged.map((range) => ({ start: intToIpv4(range.start), end: intToIpv4(range.end) })) },
      { label: "Review note", value: "Only deploy summaries when every address in the aggregate is owned and intended for the same route or policy." }
    ]
  });
}

function runIpv6Subnet(tool: string, title: string, input: string): ToolResult {
  const parsed = parseIpv6Cidr(input);
  const count = parsed.hostBits > 64n ? `2^${parsed.hostBits.toString()}` : (1n << parsed.hostBits).toString();

  return result({
    tool,
    title,
    target: `${formatIpv6(parsed.network)}/${parsed.prefix}`,
    status: "ok",
    summary: `IPv6 prefix /${parsed.prefix} contains ${count} address(es).`,
    details: [
      { label: "Network address", value: formatIpv6(parsed.network) },
      { label: "Last address", value: formatIpv6(parsed.last) },
      { label: "Prefix length", value: parsed.prefix },
      { label: "Address count", value: count },
      { label: "Planning note", value: parsed.prefix <= 48 ? "Suitable for organization-level allocation planning." : parsed.prefix <= 64 ? "Common LAN/VLAN subnet size." : "Host or point-to-point style allocation." }
    ]
  });
}

function runMtuMss(tool: string, title: string, params: Record<string, string | number | boolean>): ToolResult {
  const baseMtu = Math.min(9216, Math.max(576, Number(textParam(params, "baseMtu", "1500")) || 1500));
  const encapsulation = textParam(params, "encapsulation", "ipsec-nat-t");
  const extra = Math.min(400, Math.max(0, Number(textParam(params, "extraOverhead", "0")) || 0));
  const overheads: Record<string, number> = {
    "ipsec-nat-t": 74,
    ipsec: 58,
    "gre-ipsec": 82,
    vxlan: 50,
    wireguard: 80,
    pppoe: 8,
    custom: 0
  };
  const overhead = (overheads[encapsulation] ?? 0) + extra;
  const effectiveMtu = Math.max(576, baseMtu - overhead);
  const tcpMss = Math.max(536, effectiveMtu - 40);

  return result({
    tool,
    title,
    target: `${baseMtu} MTU ${encapsulation}`,
    status: effectiveMtu >= 1280 ? "ok" : "warning",
    summary: `Estimated effective MTU is ${effectiveMtu}; recommended IPv4 TCP MSS is ${tcpMss}.`,
    details: [
      { label: "Calculation", value: [{ baseMtu, encapsulation, overheadBytes: overhead, effectiveMtu, recommendedTcpMss: tcpMss }] },
      { label: "Troubleshooting note", value: "Confirm with DF-bit ping, PMTUD behavior, tunnel vendor overhead, and application packet captures before changing MSS clamp." }
    ]
  });
}

async function runHttp3Quic(tool: string, title: string, input: string): Promise<ToolResult> {
  const url = normalizeHttpUrl(input);
  const host = normalizeHostname(url.href, { allowUrl: true });
  await assertPublicResolvedHost(host);
  const response = await fetchWithTimeout(url, { method: "GET", redirect: "follow" });
  const altSvc = response.headers.get("alt-svc") || "";
  const httpsRecords = (await dns.resolve(host, "HTTPS").catch(() => [])) as unknown[];
  const h3 = /h3/i.test(altSvc) || JSON.stringify(httpsRecords).toLowerCase().includes("h3");

  return result({
    tool,
    title,
    target: url.href,
    status: h3 ? "ok" : "warning",
    summary: h3 ? `${host} advertises HTTP/3 or QUIC readiness signals.` : `${host} did not expose HTTP/3 signals in the checks run.`,
    details: [
      { label: "Alt-Svc header", value: altSvc || "Missing" },
      { label: "HTTPS/SVCB DNS records", value: httpsRecords.length ? toDetailRows(httpsRecords) : "No HTTPS/SVCB records returned" },
      { label: "Recommendation", value: h3 ? "Confirm CDN/browser telemetry and fallback behavior." : "Enable HTTP/3 at CDN/edge if it fits browser and application requirements." }
    ]
  });
}

async function runCspAnalyzer(tool: string, title: string, input: string): Promise<ToolResult> {
  const url = normalizeHttpUrl(input);
  const host = normalizeHostname(url.href, { allowUrl: true });
  await assertPublicResolvedHost(host);
  const response = await fetchWithTimeout(url, { method: "GET", redirect: "follow" });
  const csp = response.headers.get("content-security-policy") || "";
  const lower = csp.toLowerCase();
  const findings = [
    !csp && "Missing Content-Security-Policy header.",
    lower.includes("'unsafe-inline'") && "unsafe-inline is present.",
    lower.includes("'unsafe-eval'") && "unsafe-eval is present.",
    /(^|;)\s*default-src\s+[^;]*\*/i.test(csp) && "default-src includes wildcard.",
    !/frame-ancestors/i.test(csp) && "frame-ancestors directive is missing.",
    !/report-uri|report-to/i.test(csp) && "CSP reporting endpoint is missing."
  ].filter(Boolean) as string[];

  return result({
    tool,
    title,
    target: url.href,
    status: !csp || findings.length ? "warning" : "ok",
    summary: csp ? `CSP found with ${findings.length} review finding(s).` : "No CSP header was found.",
    details: [
      { label: "CSP header", value: csp || "Missing" },
      { label: "Findings", value: findings.length ? findings : "No common CSP issues detected" },
      { label: "Recommendation", value: "Tune CSP in report-only mode first, then enforce after testing critical user journeys." }
    ]
  });
}

async function runCorsChecker(tool: string, title: string, input: string): Promise<ToolResult> {
  const url = normalizeHttpUrl(input);
  const host = normalizeHostname(url.href, { allowUrl: true });
  await assertPublicResolvedHost(host);
  const testOrigin = "https://qcs-cors-test.example";
  const response = await fetchWithTimeout(url, { method: "GET", redirect: "manual", headers: { origin: testOrigin } });
  const allowOrigin = response.headers.get("access-control-allow-origin") || "";
  const allowCredentials = response.headers.get("access-control-allow-credentials") || "";
  const reflected = allowOrigin === testOrigin;
  const wildcard = allowOrigin === "*";
  const risky = reflected || (wildcard && /true/i.test(allowCredentials));

  return result({
    tool,
    title,
    target: url.href,
    status: risky ? "warning" : "ok",
    summary: risky ? "CORS policy needs review for reflected or credentialed exposure." : "No high-risk CORS pattern was observed in this simple check.",
    details: [
      { label: "CORS headers", value: [{ allowOrigin: allowOrigin || "missing", allowCredentials: allowCredentials || "missing", vary: response.headers.get("vary") || "missing" }] },
      { label: "Finding", value: risky ? "Review origin allowlist and credential behavior." : "Simple origin reflection was not observed." },
      { label: "Note", value: "This is a non-invasive header check, not a full API authorization test." }
    ]
  });
}

function runFirewallShadow(tool: string, title: string, params: Record<string, string | number | boolean>): ToolResult {
  const lines = textLines(textParam(params, "rules"));
  const seen = new Map<string, number>();
  const findings: Record<string, string | number | boolean>[] = [];
  lines.forEach((line, index) => {
    const normalized = line.toLowerCase().replace(/\s+/g, " ");
    if (seen.has(normalized)) findings.push({ line: index + 1, severity: "medium", finding: `Duplicate of line ${seen.get(normalized)}` });
    seen.set(normalized, index + 1);
    if (/\b(any\s+any|0\.0\.0\.0\/0|permit\s+ip\s+any\s+any|allow\s+all)\b/i.test(line)) findings.push({ line: index + 1, severity: "high", finding: "Broad any-any or allow-all pattern" });
    if (/\bdisabled\b|\bunused\b/i.test(line)) findings.push({ line: index + 1, severity: "low", finding: "Disabled/unused marker found" });
  });

  return result({
    tool,
    title,
    target: `${lines.length} rule line(s)`,
    status: findings.some((item) => item.severity === "high") ? "warning" : "ok",
    summary: `Analyzed ${lines.length} rule line(s) and found ${findings.length} cleanup signal(s).`,
    details: [
      { label: "Findings", value: findings.length ? findings : "No duplicate or broad-rule patterns detected" },
      { label: "Cleanup priorities", value: ["Review broad allow rules first.", "Group duplicate objects and services.", "Confirm hit counts before removal.", "Keep rollback and evidence for every policy change."] }
    ]
  });
}

function runVpnIpsec(tool: string, title: string, params: Record<string, string | number | boolean>): ToolResult {
  const ikeVersion = textParam(params, "ikeVersion", "ikev2");
  const encryption = textParam(params, "encryption", "aes-256").toLowerCase();
  const integrity = textParam(params, "integrity", "sha256").toLowerCase();
  const dhGroup = Number(textParam(params, "dhGroup", "14"));
  const pfs = textParam(params, "pfs", "yes");
  const lifetime = Number(textParam(params, "lifetimeSeconds", "3600"));
  const findings = [
    ikeVersion === "ikev1" && "IKEv1 is legacy; use IKEv2 where possible.",
    /3des|des|md5|sha1/.test(`${encryption} ${integrity}`) && "Legacy crypto detected.",
    dhGroup < 14 && "DH group below 14 should be reviewed.",
    pfs !== "yes" && "PFS is disabled.",
    (lifetime < 900 || lifetime > 28800) && "Phase 2 lifetime is outside common operational ranges."
  ].filter(Boolean) as string[];

  return result({
    tool,
    title,
    target: `${ikeVersion} ${encryption} ${integrity} DH${dhGroup}`,
    status: findings.length ? "warning" : "ok",
    summary: findings.length ? `Found ${findings.length} VPN/IPsec proposal review item(s).` : "VPN/IPsec proposal looks reasonable for common modern baselines.",
    details: [
      { label: "Proposal", value: [{ ikeVersion, encryption, integrity, dhGroup, pfs, lifetimeSeconds: lifetime }] },
      { label: "Findings", value: findings.length ? findings : "No common proposal risks detected" },
      { label: "Evidence to collect", value: ["IKE SA details", "IPsec SA counters", "NAT-T status", "proxy IDs/selectors", "logs around negotiation time", "packet capture if selectors or NAT are suspected"] }
    ]
  });
}

function captureFilter(protocol: string, sourceIp: string, destinationIp: string, port?: number) {
  const parts: string[] = [];
  if (protocol !== "ip") parts.push(protocol);
  if (sourceIp && destinationIp) parts.push(`host ${sourceIp} and host ${destinationIp}`);
  else if (sourceIp) parts.push(`src host ${sourceIp}`);
  else if (destinationIp) parts.push(`dst host ${destinationIp}`);
  if ((protocol === "tcp" || protocol === "udp") && port) parts.push(`port ${port}`);
  return parts.length ? parts.join(" and ") : "ip";
}

function runPacketCaptureFilter(tool: string, title: string, params: Record<string, string | number | boolean>): ToolResult {
  const sourceIp = textParam(params, "sourceIp");
  const destinationIp = textParam(params, "destinationIp");
  if (sourceIp && !net.isIP(sourceIp)) throw new Error("Source IP must be valid.");
  if (destinationIp && !net.isIP(destinationIp)) throw new Error("Destination IP must be valid.");
  const protocol = textParam(params, "protocol", "tcp");
  const portRaw = textParam(params, "port");
  const port = portRaw ? Number(portRaw) : undefined;
  if (port && (!Number.isInteger(port) || port < 1 || port > 65535)) throw new Error("Port must be 1-65535.");
  const iface = textParam(params, "interfaceName", "<interface>");
  const bpf = captureFilter(protocol, sourceIp, destinationIp, port);

  return result({
    tool,
    title,
    target: bpf,
    status: !sourceIp && !destinationIp ? "warning" : "ok",
    summary: `Generated capture filters for: ${bpf}.`,
    details: [
      { label: "BPF / tcpdump", value: [`tcpdump -ni ${iface} '${bpf}'`] },
      { label: "Wireshark display filter", value: [bpf.replace(/\band\b/g, "&&").replace(/\bhost\s+/g, "ip.addr == ").replace(/\bport\s+(\d+)/g, "tcp.port == $1 || udp.port == $1")] },
      { label: "FortiGate sniffer", value: [`diagnose sniffer packet ${iface} '${bpf}' 4 100 a`] },
      { label: "Cisco ACL capture filter", value: [`permit ${protocol} ${sourceIp ? `host ${sourceIp}` : "any"} ${destinationIp ? `host ${destinationIp}` : "any"}${port ? ` eq ${port}` : ""}`] },
      { label: "Safety note", value: "Keep filters narrow and treat packet captures as sensitive evidence." }
    ]
  });
}

function runSdwanSla(tool: string, title: string, params: Record<string, string | number | boolean>): ToolResult {
  const app = textParam(params, "appProfile", "voice");
  const latency = Number(textParam(params, "latencyMs", "80"));
  const jitter = Number(textParam(params, "jitterMs", "10"));
  const loss = Number(textParam(params, "lossPercent", "0.5"));
  const profiles: Record<string, { latency: number; jitter: number; loss: number }> = {
    voice: { latency: 150, jitter: 30, loss: 1 },
    video: { latency: 180, jitter: 40, loss: 1 },
    saas: { latency: 250, jitter: 80, loss: 2 },
    erp: { latency: 180, jitter: 50, loss: 1 },
    bulk: { latency: 400, jitter: 150, loss: 3 }
  };
  const target = profiles[app] || profiles.saas;
  const score = Math.max(0, Math.round(100 - (latency / target.latency) * 35 - (jitter / target.jitter) * 30 - (loss / target.loss) * 35));

  return result({
    tool,
    title,
    target: app,
    status: score >= 75 ? "ok" : score >= 50 ? "warning" : "error",
    summary: `${app.toUpperCase()} path score is ${score}/100.`,
    details: [
      { label: "Measured metrics", value: [{ latencyMs: latency, jitterMs: jitter, lossPercent: loss, score }] },
      { label: "Recommended policy", value: score >= 75 ? "Eligible for preferred path." : score >= 50 ? "Use as secondary path or monitor closely." : "Avoid for this application unless no better path exists." },
      { label: "Tuning notes", value: ["Measure both directions if possible.", "Separate underlay loss from tunnel loss.", "Track DNS, TCP, TLS, and application response separately for SaaS."] }
    ]
  });
}

function runDmarcXmlAnalyzer(tool: string, title: string, params: Record<string, string | number | boolean>): ToolResult {
  const xml = textParam(params, "xml");
  if (!xml.includes("<feedback")) throw new Error("Paste a DMARC aggregate XML report.");
  const org = xml.match(/<org_name>([\s\S]*?)<\/org_name>/i)?.[1]?.trim() || "Unknown reporter";
  const domain = xml.match(/<policy_published>[\s\S]*?<domain>([\s\S]*?)<\/domain>[\s\S]*?<\/policy_published>/i)?.[1]?.trim() || "Unknown domain";
  const records = Array.from(xml.matchAll(/<record>([\s\S]*?)<\/record>/gi)).slice(0, 200);
  const rows = records.map((match) => {
    const block = match[1];
    const sourceIp = block.match(/<source_ip>([\s\S]*?)<\/source_ip>/i)?.[1]?.trim() || "unknown";
    const count = Number(block.match(/<count>([\s\S]*?)<\/count>/i)?.[1]?.trim() || 0);
    const disposition = block.match(/<disposition>([\s\S]*?)<\/disposition>/i)?.[1]?.trim() || "unknown";
    const dkim = block.match(/<dkim>([\s\S]*?)<\/dkim>/i)?.[1]?.trim() || "unknown";
    const spf = block.match(/<spf>([\s\S]*?)<\/spf>/i)?.[1]?.trim() || "unknown";
    return { sourceIp, count, disposition, dkim, spf };
  });
  const total = rows.reduce((sum, row) => sum + row.count, 0);
  const failed = rows.filter((row) => row.dkim !== "pass" && row.spf !== "pass").reduce((sum, row) => sum + row.count, 0);

  return result({
    tool,
    title,
    target: domain,
    status: failed ? "warning" : "ok",
    summary: `Parsed ${records.length} DMARC row(s) from ${org}; ${failed}/${total} message(s) failed both DKIM and SPF alignment signals.`,
    details: [
      { label: "Report summary", value: [{ reporter: org, domain, rows: records.length, totalMessages: total, failedBoth: failed }] },
      { label: "Source rows", value: rows.length ? rows.slice(0, 30) : "No record rows found" },
      { label: "Recommendation", value: failed ? "Investigate failing sources before moving DMARC toward reject." : "Use report trend data to move policy toward stronger enforcement." }
    ]
  });
}

const passwordWords = [
  "atlas",
  "brisk",
  "cipher",
  "delta",
  "ember",
  "frost",
  "harbor",
  "ion",
  "juniper",
  "kernel",
  "lumen",
  "matrix",
  "nebula",
  "orbit",
  "packet",
  "quartz",
  "relay",
  "signal",
  "tunnel",
  "uplink",
  "vector",
  "warden",
  "zenith",
  "anchor",
  "bridge",
  "cobalt",
  "domain",
  "fabric",
  "gateway",
  "helium",
  "isotope",
  "keystone",
  "lattice",
  "meridian",
  "nimbus",
  "operator",
  "prefix",
  "radius",
  "segment",
  "topology"
];

function chooseRandom(chars: string) {
  return chars[randomInt(0, chars.length)];
}

function shuffled(value: string[]) {
  const items = [...value];
  for (let index = items.length - 1; index > 0; index -= 1) {
    const swapIndex = randomInt(0, index + 1);
    [items[index], items[swapIndex]] = [items[swapIndex], items[index]];
  }
  return items;
}

function runStrongPasswordGenerator(tool: string, title: string, params: Record<string, string | number | boolean>): ToolResult {
  const mode = textParam(params, "mode", "password");
  const length = Math.min(80, Math.max(12, Number(textParam(params, "length", "20")) || 20));
  const quantity = Math.min(20, Math.max(1, Number(textParam(params, "quantity", "5")) || 5));
  const words = Math.min(8, Math.max(4, Number(textParam(params, "words", "5")) || 5));
  const includeSymbols = textParam(params, "includeSymbols", "yes") !== "no";
  const excludeAmbiguous = textParam(params, "excludeAmbiguous", "yes") !== "no";
  const ambiguous = /[Il1O0]/g;
  const lower = excludeAmbiguous ? "abcdefghijkmnopqrstuvwxyz" : "abcdefghijklmnopqrstuvwxyz";
  const upper = excludeAmbiguous ? "ABCDEFGHJKLMNPQRSTUVWXYZ" : "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const numbers = excludeAmbiguous ? "23456789" : "0123456789";
  const symbols = "!@#$%^&*()-_=+[]{};:,.?";
  const pools = [lower, upper, numbers, includeSymbols ? symbols : ""].filter(Boolean);
  const fullPool = pools.join("");

  if (mode === "passphrase") {
    const outputs = Array.from({ length: quantity }, () => {
      const selected = Array.from({ length: words }, () => passwordWords[randomInt(0, passwordWords.length)]);
      return `${selected.join("-")}-${randomInt(10, 99)}${includeSymbols ? chooseRandom(symbols) : ""}`;
    });
    const entropy = Math.round(words * Math.log2(passwordWords.length) + Math.log2(90) + (includeSymbols ? Math.log2(symbols.length) : 0));
    return result({
      tool,
      title,
      target: `Generated ${quantity} passphrase(s)`,
      status: entropy >= 70 ? "ok" : "warning",
      summary: `Generated ${quantity} memorable passphrase(s) with about ${entropy} bits of estimated entropy each.`,
      details: [
        { label: "Generated passphrases", value: outputs },
        { label: "Estimated entropy bits", value: entropy },
        { label: "Safe handling notes", value: ["Generate passwords only on trusted devices.", "Use a password manager.", "Do not reuse generated passwords across accounts.", "Rotate shared handover credentials after first use."] }
      ]
    });
  }

  const outputs = Array.from({ length: quantity }, () => {
    const required = pools.map((pool) => chooseRandom(pool));
    const remaining = Array.from({ length: Math.max(0, length - required.length) }, () => chooseRandom(fullPool));
    const password = shuffled([...required, ...remaining]).join("");
    return excludeAmbiguous ? password.replace(ambiguous, () => chooseRandom(fullPool.replace(ambiguous, ""))) : password;
  });
  const entropy = Math.round(length * Math.log2(fullPool.length));

  return result({
    tool,
    title,
    target: `Generated ${quantity} password(s)`,
    status: entropy >= 90 ? "ok" : entropy >= 70 ? "warning" : "error",
    summary: `Generated ${quantity} strong random password(s) with about ${entropy} bits of estimated entropy each.`,
    details: [
      { label: "Generated passwords", value: outputs },
      { label: "Character pool size", value: fullPool.length },
      { label: "Estimated entropy bits", value: entropy },
      { label: "Safe handling notes", value: ["Generate passwords only on trusted devices.", "Use a password manager.", "Do not send passwords over chat or email.", "Use unique passwords for every account, VPN, Wi-Fi, and service credential."] }
    ]
  });
}

function runVendorTaskGenerator(tool: string, title: string, params: Record<string, string | number | boolean>): ToolResult {
  const generated = generateVendorTaskScript(params);
  return result({
    tool,
    title,
    target: generated.target,
    status: generated.status,
    summary: generated.summary,
    details: generated.details
  });
}

async function runTool(tool: string, title: string, target: string, port?: number, params: Record<string, string | number | boolean> = {}) {
  switch (tool) {
    case "vendor-task-script-generator":
      return runVendorTaskGenerator(tool, title, params);
    case "strong-password-generator":
      return runStrongPasswordGenerator(tool, title, params);
    case "rpki-roa-validator":
      return runRpkiValidator(tool, title, params);
    case "asn-intelligence-tool":
      return runAsnIntelligence(tool, title, target);
    case "bgp-route-anomaly-check":
      return runBgpRouteAnomaly(tool, title, target);
    case "global-traceroute-planner":
      return runGlobalTraceroutePlanner(tool, title, target);
    case "global-latency-map-planner":
      return runGlobalLatencyPlanner(tool, title, target);
    case "dns-propagation-checker":
      return runDnsPropagation(tool, title, params);
    case "starttls-mail-checker":
      return runStartTlsMail(tool, title, target);
    case "dane-tlsa-checker":
      return runDaneTlsa(tool, title, params);
    case "mta-sts-tls-rpt-checker":
      return runMtaStsTlsRpt(tool, title, target);
    case "deep-mx-health-analyzer":
      return runDeepMxHealth(tool, title, target);
    case "ip-reputation-abuse-check":
      return runIpReputation(tool, title, target);
    case "cloud-ip-range-lookup":
      return runCloudIpRangeLookup(tool, title, params);
    case "cloud-allowlist-generator":
      return runCloudAllowlist(tool, title, params);
    case "cidr-overlap-checker":
      return runCidrOverlap(tool, title, params);
    case "cidr-summarizer":
      return runCidrSummarizer(tool, title, params);
    case "ipv6-subnet-calculator":
      return runIpv6Subnet(tool, title, target);
    case "mtu-mss-vpn-calculator":
      return runMtuMss(tool, title, params);
    case "http3-quic-checker":
      return runHttp3Quic(tool, title, target);
    case "csp-analyzer":
      return runCspAnalyzer(tool, title, target);
    case "cors-misconfiguration-checker":
      return runCorsChecker(tool, title, target);
    case "firewall-rule-shadow-analyzer":
      return runFirewallShadow(tool, title, params);
    case "vpn-ipsec-config-checker":
      return runVpnIpsec(tool, title, params);
    case "packet-capture-filter-generator":
      return runPacketCaptureFilter(tool, title, params);
    case "sdwan-sla-calculator":
      return runSdwanSla(tool, title, params);
    case "dmarc-xml-report-analyzer":
      return runDmarcXmlAnalyzer(tool, title, params);
    case "dns-lookup":
      return runDnsLookup(tool, title, target);
    case "a-record-lookup":
      return runDnsRecordLookup(tool, title, target, "A");
    case "aaaa-record-lookup":
      return runDnsRecordLookup(tool, title, target, "AAAA");
    case "cname-lookup":
      return runDnsRecordLookup(tool, title, target, "CNAME");
    case "ns-lookup":
      return runDnsRecordLookup(tool, title, target, "NS");
    case "txt-record-lookup":
      return runDnsRecordLookup(tool, title, target, "TXT");
    case "soa-lookup":
      return runSoaLookup(tool, title, target);
    case "srv-record-lookup":
      return runSrvLookup(tool, title, params);
    case "dnssec-ds-check":
      return runDnssecDsCheck(tool, title, target);
    case "mx-lookup":
      return runMxLookup(tool, title, target);
    case "spf-dmarc-check":
      return runSpfDmarc(tool, title, target);
    case "dkim-record-check":
      return runDkimCheck(tool, title, params);
    case "dmarc-policy-analyzer":
      return runDmarcAnalyzer(tool, title, target);
    case "bimi-record-check":
      return runBimiCheck(tool, title, target);
    case "reverse-dns-lookup":
      return runReverseDns(tool, title, target);
    case "caa-record-check":
      return runCaaCheck(tool, title, target);
    case "http-redirect-chain":
      return runRedirectChain(tool, title, target);
    case "ipv4-subnet-calculator":
      return runSubnetCalculator(tool, title, target);
    case "ipv4-wildcard-mask-calculator":
      return runWildcardCalculator(tool, title, target);
    case "http-header-check":
      return runHttpHeaders(tool, title, target);
    case "hsts-readiness-check":
      return runHstsReadiness(tool, title, target);
    case "http-status-check":
      return runHttpStatus(tool, title, target);
    case "website-availability-check":
      return runWebsiteAvailability(tool, title, target);
    case "robots-txt-check":
      return runRobotsTxt(tool, title, target);
    case "security-txt-check":
      return runSecurityTxt(tool, title, target);
    case "ssl-certificate-check":
      return runSslCertificate(tool, title, target);
    case "tls-version-check":
      return runTlsVersionCheck(tool, title, target);
    case "port-check":
      return runPortCheck(tool, title, target, port);
    case "common-port-exposure-check":
      return runCommonPortExposure(tool, title, target);
    default:
      throw new Error("Unsupported network tool.");
  }
}

export async function POST(request: Request) {
  const startedAt = Date.now();
  const limited = rateLimit(request, { keyPrefix: "network-tools", max: 30, windowMs: 60_000 });
  if (limited) return limited;

  const body = await readJsonBody(request);
  if (!body.ok) return body.response;

  const parsed = networkToolSchema.safeParse(body.data);
  if (!parsed.success) {
    return jsonError(parsed.error.flatten(), 400);
  }

  const payload = parsed.data;
  const tool = getNetworkUtilityTool(payload.tool);
  if (!tool) return jsonError("Unknown network tool.", 404);

  try {
    const output = await runTool(tool.slug, tool.title, payload.target, payload.port, payload.params);

    if (payload.consent.analytics) {
      await createEvent(
        {
          name: "network_tool_run",
          sessionId: payload.sessionId,
          metadata: {
            tool: tool.slug,
            category: tool.category,
            status: output.status,
            target: output.target,
            durationMs: Date.now() - startedAt
          },
          consent: payload.consent
        },
        await requestContext()
      );
    }

    return NextResponse.json({ ok: true, result: output });
  } catch (error) {
    if (payload.consent.analytics) {
      await createEvent(
        {
          name: "network_tool_error",
          sessionId: payload.sessionId,
          metadata: {
            tool: tool.slug,
            category: tool.category,
            error: errorMessage(error),
            durationMs: Date.now() - startedAt
          },
          consent: payload.consent
        },
        await requestContext()
      );
    }

    return jsonError(errorMessage(error), 400);
  }
}
