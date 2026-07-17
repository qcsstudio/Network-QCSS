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
