import dns from "node:dns/promises";
import net from "node:net";
import tls from "node:tls";
import { domainToASCII } from "node:url";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getNetworkUtilityTool } from "@/lib/network-tools";
import { requestContext } from "@/lib/security";
import { createEvent } from "@/lib/store";

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

async function runPortCheck(tool: string, title: string, input: string, port?: number): Promise<ToolResult> {
  const host = normalizeHostname(input);
  const checkedPort = port || 443;
  await assertPublicResolvedHost(host);

  const open = await new Promise<boolean>((resolve) => {
    const socket = net.connect({ host, port: checkedPort, timeout: 5000 });
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

async function runTool(tool: string, title: string, target: string, port?: number) {
  switch (tool) {
    case "dns-lookup":
      return runDnsLookup(tool, title, target);
    case "mx-lookup":
      return runMxLookup(tool, title, target);
    case "spf-dmarc-check":
      return runSpfDmarc(tool, title, target);
    case "http-header-check":
      return runHttpHeaders(tool, title, target);
    case "ssl-certificate-check":
      return runSslCertificate(tool, title, target);
    case "port-check":
      return runPortCheck(tool, title, target, port);
    default:
      throw new Error("Unsupported network tool.");
  }
}

export async function POST(request: Request) {
  const startedAt = Date.now();
  const parsed = networkToolSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: parsed.error.flatten() }, { status: 400 });
  }

  const payload = parsed.data;
  const tool = getNetworkUtilityTool(payload.tool);
  if (!tool) return NextResponse.json({ ok: false, error: "Unknown network tool." }, { status: 404 });

  try {
    const output = await runTool(tool.slug, tool.title, payload.target, payload.port);

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

    return NextResponse.json({ ok: false, error: errorMessage(error) }, { status: 400 });
  }
}
