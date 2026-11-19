import { z } from "zod";
import { SubjectAlternativeNameExtension, X509Certificate } from "@peculiar/x509";
import { XMLParser, XMLValidator } from "fast-xml-parser";
import type { ToolkitOperation } from "./types";
import { boundInput, boundTree, display, fail, integer, MAX_RECORDS, num, optionalRecord, record, result, safeAnalyze, text, timestamp, unknown } from "./imports-common";

// Synthetic self-signed public certificate. Its ephemeral private key was discarded.
const publicCertificate = `-----BEGIN CERTIFICATE-----
MIIBmzCCAUKgAwIBAgIBATAKBggqhkjOPQQDAjBBMR8wHQYDVQQDExZzeW50aGV0
aWMuZXhhbXBsZS50ZXN0MR4wHAYDVQQKExVRQ1MgU3ludGhldGljIEZpeHR1cmUw
HhcNMjYwMTAxMDAwMDAwWhcNMjcwMTAxMDAwMDAwWjBBMR8wHQYDVQQDExZzeW50
aGV0aWMuZXhhbXBsZS50ZXN0MR4wHAYDVQQKExVRQ1MgU3ludGhldGljIEZpeHR1
cmUwWTATBgcqhkjOPQIBBggqhkjOPQMBBwNCAAQ9irY3pspGUnkWzihpDJ6V+uLR
ySFSdquFq3t7oKzHvn5aVyHHqA36ehm643gwmzgpSYrwnH+EjMD+2xdpH0Y9oysw
KTAnBgNVHREEIDAeghZzeW50aGV0aWMuZXhhbXBsZS50ZXN0hwTAAAIKMAoGCCqG
SM49BAMCA0cAMEQCIAblSeZ7dg++fKhzoLHVNiZRgPM1MoT4Dh44GzqmXVmXAiAt
7byjGa97XEW64drtsVaxm3Fb4KAHT3jjy2B7/Q2pqw==
-----END CERTIFICATE-----`;
const certificateSchema = z.object({ subject: text, issuer: text, serial: text, notBefore: timestamp, notAfter: timestamp,
  sans: z.array(z.object({ type: text, value: text }).strict()).max(200) }).strict();

export const tlsOperation: ToolkitOperation = {
  id: "tls", name: "Public certificate inspection", description: "Parse a local public PEM certificate and inspect declared identity and validity dates.",
  inputLabel: "One public X.509 PEM certificate",
  fields: [{ key: "asOf", label: "Evaluation time", type: "text", initial: "", meaning: "ISO 8601 timestamp with Z or offset and at most 3 fractional-second digits. Blank uses the browser clock; this is a date comparison only." }],
  format: "Exactly one -----BEGIN CERTIFICATE----- ... -----END CERTIFICATE----- public X.509 certificate, base64 PEM, at most 32768 UTF-8 bytes. No private keys, certificate bundles, CSR, DER binary, curl JSON or TLS transcript. Optional evaluation time uses ISO 8601 with timezone and at most 3 fractional-second digits; finer precision is rejected.",
  sample: publicCertificate,
  analyze: safeAnalyze((input, options) => {
    boundInput(input, 32_768);
    if (/PRIVATE KEY/.test(input)) fail("Private keys are not accepted. Supply only one public certificate.");
    if (!/^-----BEGIN CERTIFICATE-----\s+[A-Za-z0-9+/=\s]+\s+-----END CERTIFICATE-----$/.test(input.trim())) fail("Expected exactly one public PEM CERTIFICATE block; bundles and other PEM types are unsupported.");
    const base64 = input.trim().slice("-----BEGIN CERTIFICATE-----".length, -"-----END CERTIFICATE-----".length).replace(/\s/g, "");
    if (!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(base64)) fail("Malformed certificate base64.");
    const cert = new X509Certificate(input.trim());
    const sans = cert.getExtension(SubjectAlternativeNameExtension)?.names.items ?? [];
    const data = certificateSchema.parse({ subject: cert.subject, issuer: cert.issuer, serial: cert.serialNumber,
      notBefore: cert.notBefore.toISOString(), notAfter: cert.notAfter.toISOString(), sans: sans.map((s) => ({ type: s.type, value: s.value })) });
    const asOf = timestamp.parse(options.asOf?.trim() || new Date().toISOString());
    const time = Date.parse(asOf), start = Date.parse(data.notBefore), end = Date.parse(data.notAfter);
    if (end < start) fail("Certificate validity dates are inconsistent.");
    const state = time < start ? "not yet within declared validity" : time > end ? "past declared validity" : "within declared validity window";
    const out = result("Imported public certificate", ["openssl"]);
    out.summary = `One public certificate parsed; ${state} at the stated evaluation time. Handshake, signature, chain trust and hostname matching were not verified.`;
    out.metrics = [{ label: "Declared validity", value: state, meaning: "Date-window comparison only; not a trusted/valid-certificate verdict." },
      { label: "Evaluation time", value: new Date(time).toISOString(), meaning: options.asOf?.trim() ? "Explicit operator-supplied time." : "Browser clock; synchronization is not verified." },
      { label: "Days until notAfter", value: (end - time) / 86_400_000, unit: "days", meaning: "Signed duration to certificate expiry, using 86400 seconds per day; negative means elapsed." },
      { label: "Subject alternative names", value: data.sans.length, meaning: "Parsed SAN entries; absence does not trigger Common Name fallback or hostname verification." }];
    out.rows = [{ field: "Subject", value: data.subject }, { field: "Issuer", value: data.issuer }, { field: "Serial", value: data.serial }, { field: "Not before (UTC)", value: data.notBefore }, { field: "Not after (UTC)", value: data.notAfter },
      ...data.sans.map((san) => ({ field: `SAN (${san.type})`, value: san.value }))];
    if (time < start || time > end) out.findings.push({ level: "review", title: "Outside declared date window", detail: "Compare the imported certificate dates and evaluation clock with the certificate actually served by the intended endpoint." });
    out.findings.push({ level: "info", title: "Parsing is not trust validation", detail: "Issuer and subject are certificate assertions. No signature verification, chain building, trust store, revocation, name matching, remote collection, TLS negotiation or HTTP check has run." });
    out.caveats.push("Parsed locally with @peculiar/x509; browser-compatible PEM inspection only, 32 KiB certificate limit and 200 SAN entries. Unsupported ASN.1/extensions may be rejected.", "The bundled example is a synthetic self-signed public certificate, not a production trust anchor. No private key is retained or needed.");
    return out;
  }),
};

const scanState = z.enum(["open", "closed", "filtered", "unfiltered", "open|filtered", "closed|filtered"]);
const portSchema = z.object({ protocol: z.enum(["tcp", "udp", "sctp"]), port: integer.max(65535), state: scanState,
  reason: text.nullable(), service: text.nullable(), product: text.nullable(), version: text.nullable() }).strict();
const asArray = (value: unknown): unknown[] => value === undefined ? [] : Array.isArray(value) ? value : [value];
const xmlPredefined: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };
function decodeXmlAttribute(value: string) {
  // Decode once after XML tokenization; decoded quotes/markup must remain data.
  return value.replace(/&(amp|lt|gt|quot|apos|#\d+|#x[\da-fA-F]+);/g, (_match, name: string) => {
    if (!name.startsWith("#")) return xmlPredefined[name];
    const codePoint = name.startsWith("#x") ? Number.parseInt(name.slice(2), 16) : Number.parseInt(name.slice(1), 10);
    const valid = codePoint === 9 || codePoint === 10 || codePoint === 13 ||
      codePoint >= 0x20 && codePoint <= 0xd7ff || codePoint >= 0xe000 && codePoint <= 0xfffd ||
      codePoint >= 0x10000 && codePoint <= 0x10ffff;
    if (!valid) fail("XML numeric reference is not a permitted XML 1.0 character.");
    return String.fromCodePoint(codePoint);
  });
}
const hostSchema = z.object({ state: z.enum(["up", "down", "unknown"]).nullable(), addresses: z.array(z.object({
  type: z.enum(["ipv4", "ipv6", "mac"]), value: text,
}).strict().refine((a) => a.type === "ipv4" ? z.ipv4().safeParse(a.value).success : a.type === "ipv6" ? z.ipv6().safeParse(a.value).success : /^(?:[\dA-Fa-f]{2}:){5}[\dA-Fa-f]{2}$/.test(a.value))).max(32) }).strict();

export const exposureOperation: ToolkitOperation = {
  id: "exposure", name: "Nmap scan-state evidence", description: "Read authorized Nmap XML observations without declaring vulnerabilities or running a scan.",
  inputLabel: "Nmap XML export without DTD/custom entities", fields: [],
  format: '<nmaprun scanner="nmap" version="7.95"><host><status state="up"/><address addr="192.0.2.10" addrtype="ipv4"/><ports><port protocol="tcp" portid="443"><state state="open" reason="syn-ack"/><service name="https" product="example" version="1"/></port></ports></host></nmaprun>. Supports host/status/address, ports/port/state/service and ports/extraports counts. Attribute references amp/lt/gt/quot/apos and decimal/hex numeric XML 1.0 characters are decoded once after parsing. Rejects custom entities and every DOCTYPE/ENTITY declaration, even a standard Nmap DTD. Only TCP/UDP/SCTP port states, not IP-protocol scans. Scripts, banners, command arguments and OS guesses are not reported.',
  sample: '<nmaprun scanner="nmap" version="7.95" start="1793786400"><host><status state="up"/><address addr="192.0.2.10" addrtype="ipv4"/><ports><port protocol="tcp" portid="443"><state state="open" reason="syn-ack"/><service name="https" product="Synthetic service" version="1.0"/></port><port protocol="tcp" portid="22"><state state="filtered" reason="no-response"/></port><extraports state="closed" count="998"/></ports></host><runstats><finished exit="success"/></runstats></nmaprun>',
  analyze: safeAnalyze((input) => {
    boundInput(input);
    if (/<!\s*(?:DOCTYPE|ENTITY)\b/i.test(input)) fail("XML DOCTYPE and ENTITY declarations are not accepted, including standard Nmap DTDs.");
    if (/&(?!amp;|lt;|gt;|quot;|apos;|#\d+;|#x[\da-fA-F]+;)/.test(input)) fail("XML custom or malformed entity references are unsupported.");
    if (XMLValidator.validate(input) !== true) fail("Malformed XML. Supply a complete Nmap XML document without DTD or entity declarations.");
    const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "@_", parseTagValue: false, parseAttributeValue: false,
      ignoreDeclaration: true, ignorePiTags: true, processEntities: false, maxNestedTags: 24,
      attributeValueProcessor: (_name, value) => decodeXmlAttribute(value) });
    const parsed: unknown = parser.parse(input);
    boundTree(parsed);
    const root = record(parsed);
    if (Object.keys(root).some((k) => k !== "nmaprun")) fail("Expected a single nmaprun XML root.");
    const scan = record(root.nmaprun);
    if (scan["@_scanner"] !== "nmap") fail("Only Nmap XML scanner=nmap is supported.");
    const hosts = asArray(scan.host);
    if (hosts.length > MAX_RECORDS) fail("Nmap import exceeds 2000 hosts.");
    const out = result("Imported Nmap scan states", ["nmap"]);
    let explicit = 0, open = 0, aggregate = 0;
    hosts.forEach((raw, index) => {
      const h = record(raw);
      const status = optionalRecord(h.status);
      const host = hostSchema.parse({ state: status["@_state"] ?? null, addresses: asArray(h.address).map((a) => { const addr = record(a); return { type: addr["@_addrtype"], value: addr["@_addr"] }; }) });
      const base = { host: index + 1, addresses: host.addresses.map((a) => `${a.type}:${a.value}`).join(", ") || unknown, hostState: display(host.state) };
      const ports = optionalRecord(h.ports);
      const rows = asArray(ports.port);
      rows.forEach((rawPort) => {
        const p = record(rawPort), state = record(p.state), service = optionalRecord(p.service);
        const port = portSchema.parse({ protocol: p["@_protocol"], port: num(p["@_portid"]), state: state["@_state"], reason: state["@_reason"] ?? null,
          service: service["@_name"] ?? null, product: service["@_product"] ?? null, version: service["@_version"] ?? null });
        explicit++;
        if (port.state === "open") open++;
        out.rows.push({ ...base, protocol: port.protocol, port: port.port, scanState: port.state, count: 1, reason: display(port.reason), service: display(port.service), product: display(port.product), version: display(port.version) });
      });
      const extra = asArray(ports.extraports);
      extra.forEach((rawExtra) => {
        const p = record(rawExtra);
        const group = z.object({ state: scanState, count: integer.max(196608) }).strict().parse({ state: p["@_state"], count: num(p["@_count"]) });
        aggregate += group.count;
        out.rows.push({ ...base, protocol: "unspecified aggregate", port: "not individually listed", scanState: group.state, count: group.count, reason: unknown, service: unknown, product: unknown, version: unknown });
      });
      if (!rows.length && !extra.length) out.rows.push({ ...base, protocol: unknown, port: unknown, scanState: "no port observations", count: 0, reason: unknown, service: unknown, product: unknown, version: unknown });
      if (out.rows.length > MAX_RECORDS) fail("Nmap output exceeds 2000 rows. Export a smaller host/port scope.");
    });
    const finished = optionalRecord(optionalRecord(scan.runstats).finished);
    const completion = z.enum(["success", "error"]).nullable().parse(finished["@_exit"] ?? null);
    out.summary = `${hosts.length} reported hosts; ${explicit} individually reported ports (${open} open) and ${aggregate} aggregate port observations. Scan states are not vulnerability findings.`;
    out.metrics = [{ label: "Reported hosts", value: hosts.length, meaning: "Hosts present in this XML; absent hosts are not proven down." },
      { label: "Individually reported open ports", value: open, unit: "ports", meaning: "Only explicit open port entries. open|filtered is not counted as open; aggregate groups stay separate." },
      { label: "Scan completion", value: display(completion), meaning: "Imported runstats finished exit, not independent verification of scan coverage." }];
    out.findings.push({ level: "info", title: "State is scoped to the scan", detail: "Open, closed, filtered, unfiltered, open|filtered and closed|filtered describe this scanner's observations. Service names and version banners are unverified hints, not vulnerability or exploitation evidence." });
    if (completion !== "success") out.findings.push({ level: "review", title: "Completion not established", detail: "The report is incomplete, reports an error, or lacks completion metadata. Do not interpret absent ports or hosts as confirmed safe or closed." });
    out.caveats.push("Parsed with fast-xml-parser with general entity processing disabled and depth limited. Only predefined and numeric XML 1.0 attribute references are decoded, once after parsing. DTDs and custom entities are rejected; no external references are resolved. Additional native metadata is ignored.", "No active scan, advisory matching, CVSS score, vulnerability verdict or OS identification. IP-protocol scans and other scanner formats are unsupported. Raw scripts, banner output, scan arguments and comments are not echoed.", "Service product/version fields are attacker-controlled observations. Scanner vantage, permissions, scan type, time and filtering can change states; no current-state claim is made.");
    return out;
  }),
};
