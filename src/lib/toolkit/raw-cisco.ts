import { parseAddress, parsePrefix } from "./network-core";
import type { ToolkitResult } from "./types";

type Profile = "cisco-ip-brief" | "cisco-interfaces" | "cisco-route";
type Row = Record<string, string | number>;
type Line = { text: string; number: number };
type Transcript = { lines: Line[]; commandPresent: boolean };
type Coverage = { parsed: number; excluded: number; skipped: number };
const unavailable = "unavailable";
const profiles: Record<Profile, { command: string; title: string; source: string }> = {
  "cisco-ip-brief": { command: "show ip interface brief", title: "Imported Cisco IPv4 interface brief", source: "raw-cisco-brief" },
  "cisco-interfaces": { command: "show interfaces", title: "Imported Cisco interface states and counters", source: "raw-cisco-interfaces" },
  "cisco-route": { command: "show ip route", title: "Imported Cisco IPv4 installed route rows", source: "raw-cisco-route" },
};
const interfaceFamilies = ["Ethernet", "FastEthernet", "GigabitEthernet", "TenGigabitEthernet", "TwentyFiveGigE", "FortyGigabitEthernet", "HundredGigE", "TwoGigabitEthernet", "Port-channel", "Loopback", "Vlan", "Tunnel", "Serial", "Null", "Dialer", "BDI"];
const familyNames = new Map(interfaceFamilies.map((name) => [name.toLowerCase(), name]));
const interfacePattern = new RegExp(`^(${interfaceFamilies.join("|")})((?:0|[1-9]\\d{0,5})(?:/(?:0|[1-9]\\d{0,5})){0,3}(?:\\.(?:0|[1-9]\\d{0,5}))?)$`, "i");
const briefHeader = /^Interface\s+IP-Address\s+OK\?\s+Method\s+Status\s+Protocol$/i;
const interfaceHeader = /^(\S+) is (administratively down|up|down), line protocol is (up|down)(?: \((connected|notconnect|disabled|err-disabled)\))?$/i;

function invalid(message: string): never { throw new Error(message); }
function interfaceName(value: string): string | undefined {
  const match = interfacePattern.exec(value);
  if (!match) return undefined;
  return `${familyNames.get(match[1].toLowerCase())}${match[2]}`;
}
function ipv4(value: string): string | undefined {
  if (!/^(?:0|[1-9]\d{0,2})(?:\.(?:0|[1-9]\d{0,2})){3}$/.test(value)) return undefined;
  try { const address = parseAddress(value); return address.kind() === "ipv4" ? address.toString() : undefined; }
  catch { return undefined; }
}
function prefix(value: string): string | undefined {
  const slash = value.indexOf("/");
  if (slash < 0 || !ipv4(value.slice(0, slash))) return undefined;
  try { const parsed = parsePrefix(value); return parsed.family === "ipv4" && !parsed.hostBits ? parsed.canonical : undefined; }
  catch { return undefined; }
}
function counter(value: string): string | number | undefined {
  if (!/^(?:0|[1-9]\d{0,19})$/.test(value)) return undefined;
  const integer = BigInt(value);
  if (integer > 18_446_744_073_709_551_615n) return undefined;
  return integer <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(value) : value;
}

function readTranscript(input: string, profile: Profile): Transcript {
  if (typeof input !== "string" || !input.trim()) invalid("Supply one nonempty Cisco command output.");
  if (input.length > 1_048_576 || new TextEncoder().encode(input).length > 1_048_576) invalid("Cisco import exceeds the 1 MiB UTF-8 limit.");
  if (/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(input)) invalid("Terminal control characters are unsupported. Export plain text without ANSI escapes or pager controls.");
  const raw = input.replace(/\r\n?/g, "\n").split("\n");
  if (raw.length - (raw.at(-1) === "" ? 1 : 0) > 20_000) invalid("Cisco import exceeds the 20000-line limit.");
  const lines: Line[] = [];
  let commandPresent = false, ended = false;
  for (let index = 0; index < raw.length; index++) {
    const text = raw[index].trim();
    if (!text) continue;
    if (/--More--|(?:output|text)\s+(?:is\s+)?(?:truncated|omitted)|^\.{3}$|^\[\.\.\.\]$/i.test(text)) invalid("Truncated or paginated output is unsupported. Import a complete, unfiltered command output.");
    if (/^%/.test(text)) invalid("CLI error or asynchronous diagnostic text is present. Import one successful command output only.");
    const prompt = /^[A-Za-z0-9_.:-]{1,128}[>#]\s*(.*)$/.exec(text);
    if (prompt && !prompt[1]) {
      if (!lines.length || ended) invalid("Unexpected prompt or multiple transcripts. Import one command output only.");
      ended = true;
      continue;
    }
    if (ended) invalid("Content follows a closing prompt. Multiple command transcripts are unsupported.");
    const command = prompt ? prompt[1] : text;
    if (prompt || /^(?:sh(?:ow)?|do|ping|traceroute|configure|enable|terminal)\b/i.test(command)) {
      if (commandPresent || lines.length) invalid("Multiple or mixed command transcripts are unsupported. Import one command output only.");
      const normalized = command.replace(/\s+/g, " ");
      let accepted = normalized.toLowerCase() === profiles[profile].command;
      if (profile === "cisco-interfaces" && /^show interfaces /i.test(normalized)) {
        const target = normalized.slice("show interfaces ".length).replace(/^([A-Za-z-]+) (\d)/, "$1$2");
        accepted = interfaceName(target) !== undefined;
      }
      if (!accepted) invalid("Command does not match this profile. Use the full supported show command without filters, VRF, detail or other suffixes.");
      commandPresent = true;
      continue;
    }
    if (/^[^\s]+[>#]/.test(text)) invalid("Unsupported terminal prompt or command transcript.");
    if (profile !== "cisco-ip-brief" && briefHeader.test(text) ||
      profile !== "cisco-interfaces" && /^\S+ is .*, line protocol is\b/.test(text) ||
      profile !== "cisco-route" && /^(?:Codes:|Gateway of last resort|Routing (?:Table|entry))/.test(text)) {
      invalid("Mixed output formats are unsupported. Select one command transcript and its matching profile.");
    }
    lines.push({ text, number: index + 1 });
  }
  if (!lines.length) invalid("The transcript contains no command output.");
  return { lines, commandPresent };
}

function result(profile: Profile, transcript: Transcript, rows: Row[], coverage: Coverage): ToolkitResult {
  const output: ToolkitResult = {
    title: profiles[profile].title, evidence: "imported", rows, sourceIds: [profiles[profile].source],
    summary: `${rows.length} supported rows from the supplied snapshot; ${coverage.skipped} data lines skipped as malformed or unsupported; ${coverage.excluded} header/metadata lines excluded. Transcript completeness is not verified.`,
    metrics: [
      { label: "Parsed rows", value: rows.length, meaning: "Supported interface or route records only; not the device's total inventory." },
      { label: "Parsed data lines", value: coverage.parsed, meaning: "Allowlisted state, address, route or counter lines consumed by this parser." },
      { label: "Skipped data lines", value: coverage.skipped, meaning: "Malformed or unsupported nonempty lines, including failed rows; their content is withheld, not silently treated as parsed." },
      { label: "Excluded metadata lines", value: coverage.excluded, meaning: "Recognized headings and out-of-scope metadata, including descriptions; their content is not returned." },
      { label: "Input data lines", value: transcript.lines.length, meaning: "Nonempty lines after removing the optional command echo and closing prompt. Original line numbers remain on parsed rows." },
    ],
    findings: [{ level: coverage.skipped ? "review" : "info", title: "Bounded parser coverage", detail: coverage.skipped ? "Some supplied lines were not parsed. Review the original export locally; no missing field or skipped row is assumed healthy or zero." : "Only allowlisted fields were extracted. Zero skipped lines is not proof that the original transcript is complete or that every vendor field was interpreted." }],
    caveats: [
      "Browser-local snapshot parsing only: no live device commands, network tests, upload or persistence. Device identity, collection time and authenticity are not verified.",
      "Supports the documented Cisco IOS/IOS XE text layouts only, not every release, platform, interface family or command variant. No NX-OS, IOS XR, ASA or other-OS compatibility claim.",
      "One unfiltered command output per import; 1 MiB UTF-8 and 20000 lines maximum. Explicit truncation/pager markers, mixed commands and duplicate observations are rejected. Silent omission at a line boundary cannot be detected.",
      "Only allowlisted interface identifiers, IPv4 addresses, enums and numeric fields are returned. Prompts, hostnames, descriptions, banners and other free text are withheld. Addresses and interface IDs still need export review.",
    ],
  };
  return output;
}

function parseBrief(transcript: Transcript): ToolkitResult {
  if (!briefHeader.test(transcript.lines[0].text)) invalid("Unsupported interface brief layout. Expected the Interface/IP-Address/OK?/Method/Status/Protocol header.");
  const coverage: Coverage = { parsed: 0, excluded: 1, skipped: 0 };
  const rows: Row[] = [], seen = new Set<string>();
  const pattern = /^(\S+)\s+(\S+)\s+(YES|NO)\s+(RARP|SLARP|BOOTP|TFTP|manual|NVRAM|IPCP|DHCP|unset|other)\s+(administratively down|up|down)\s+(up|down)$/i;
  for (const line of transcript.lines.slice(1)) {
    if (briefHeader.test(line.text)) invalid("Repeated brief headers indicate multiple transcripts or an unsupported paginated export.");
    const match = pattern.exec(line.text);
    const name = match && interfaceName(match[1]);
    const address = match && (match[2].toLowerCase() === "unassigned" ? "unassigned" : ipv4(match[2]));
    if (!match || !name || !address) { coverage.skipped++; continue; }
    if (seen.has(name)) invalid("Duplicate interface observations are unsupported. Import one snapshot only.");
    seen.add(name);
    rows.push({ sourceLine: line.number, interface: name, address, interfaceState: match[5].toLowerCase(), protocolState: match[6].toLowerCase(), addressCheck: match[3].toUpperCase(), addressMethod: match[4].toLowerCase() });
    coverage.parsed++;
  }
  if (!rows.length) invalid("No supported interface brief rows. The data is empty, malformed, truncated or outside this profile.");
  const output = result("cisco-ip-brief", transcript, rows, coverage);
  output.metrics.push({ label: "Reported up/up", value: rows.filter((r) => r.interfaceState === "up" && r.protocolState === "up").length, meaning: "Both interface and line-protocol states are reported up; this does not prove end-to-end or application reachability." });
  output.caveats.push("Status is the reported interface state; protocolState is the reported line-protocol state. Administratively down differs from operational down. Address 'unassigned' does not mean all Layer-3 functions or secondary addresses are absent.", "The OK? column is the device's address-status flag, not a test of reachability. Method describes reported address assignment, not an independently verified configuration.");
  return output;
}

type CounterPattern = { pattern: RegExp; fields: string[] };
const counterPatterns: CounterPattern[] = [
  { pattern: /^(\d+) packets input, (\d+) bytes(?:, (\d+) no buffer)?$/, fields: ["inputPackets", "inputBytes", "noBuffer"] },
  { pattern: /^(\d+) packets output, (\d+) bytes(?:, (\d+) underruns)?$/, fields: ["outputPackets", "outputBytes", "underruns"] },
  { pattern: /^(\d+) input errors, (\d+) CRC, (\d+) frame, (\d+) overrun, (\d+) ignored(?:, (\d+) abort)?$/, fields: ["inputErrors", "crc", "frameErrors", "overruns", "ignored", "aborts"] },
  { pattern: /^(\d+) output errors, (?:(\d+) collisions, )?(\d+) interface resets$/, fields: ["outputErrors", "collisions", "interfaceResets"] },
  { pattern: /^(\d+) runts, (\d+) giants, (\d+) throttles$/, fields: ["runts", "giants", "throttles"] },
  { pattern: /^(\d+) unknown protocol drops$/, fields: ["unknownProtocolDrops"] },
];
const metadata = /^(?:Hardware is |Description:|Internet address is |MTU |reliability |Encapsulation |Keepalive |Full-duplex|Half-duplex|Auto-duplex|input flow-control |output flow-control |ARP type:|Last input |Last clearing of |Queueing strategy:|Input queue:|Output queue\s*:|\d+ (?:minute|second) (?:input|output) rate |Received \d+ broadcasts)/;

function parseInterfaces(transcript: Transcript): ToolkitResult {
  const rows: Row[] = [], seen = new Set<string>();
  const coverage: Coverage = { parsed: 0, excluded: 0, skipped: 0 };
  let current: Row | undefined, fields = new Set<string>(), counterLines = 0;
  for (const line of transcript.lines) {
    const header = interfaceHeader.exec(line.text);
    if (header) {
      const name = interfaceName(header[1]);
      if (!name) { current = undefined; coverage.skipped++; continue; }
      if (seen.has(name)) invalid("Duplicate interface blocks are unsupported. Import one snapshot only.");
      seen.add(name);
      current = { sourceLine: line.number, interface: name, address: unavailable, interfaceState: header[2].toLowerCase(), protocolState: header[3].toLowerCase(), inputErrors: unavailable, crc: unavailable, outputErrors: unavailable, counterCoverage: "state only; counters unavailable", skippedLines: 0 };
      rows.push(current);
      fields = new Set();
      coverage.parsed++;
      continue;
    }
    // A broken or unsupported header ends attribution to the previous interface.
    if (/^\S+ is /.test(line.text) && !metadata.test(line.text)) { current = undefined; coverage.skipped++; continue; }
    if (!current) { coverage.skipped++; continue; }
    let matched = false;
    for (const rule of counterPatterns) {
      const match = rule.pattern.exec(line.text);
      if (!match) continue;
      const parsed: Row = {};
      let valid = true;
      for (let index = 0; index < rule.fields.length; index++) {
        if (match[index + 1] === undefined) continue;
        const value = counter(match[index + 1]);
        if (value === undefined) { valid = false; break; }
        parsed[rule.fields[index]] = value;
      }
      if (!valid) break;
      if (Object.keys(parsed).some((key) => fields.has(key))) invalid("Repeated counter fields in one interface block are ambiguous. Import one observation only.");
      for (const [key, value] of Object.entries(parsed)) { current[key] = value; fields.add(key); }
      current.counterCoverage = "supported counters only; missing fields unavailable";
      coverage.parsed++;
      counterLines++;
      matched = true;
      break;
    }
    if (matched) continue;
    if (metadata.test(line.text)) { coverage.excluded++; continue; }
    coverage.skipped++;
    current.skippedLines = Number(current.skippedLines) + 1;
  }
  if (!rows.length || !transcript.commandPresent && !counterLines) invalid("No identifiable supported show interfaces output. Include the exact command echo or supported counter lines with interface headers.");
  const output = result("cisco-interfaces", transcript, rows, coverage);
  output.metrics.push({ label: "State-only interfaces", value: rows.filter((row) => row.counterCoverage === "state only; counters unavailable").length, meaning: "Interface headers without supported counters; missing counters are unavailable, not zero. This can be partial output." });
  if (rows.some((row) => [row.inputErrors, row.crc, row.outputErrors].includes(unavailable))) output.findings.push({ level: "review", title: "Counter evidence is incomplete", detail: "At least one parsed interface lacks supported input-error, CRC or output-error values. This may be a partial capture or unsupported layout; unavailable counters are not zero." });
  output.findings.push({ level: "info", title: "Absolute counters, not rates or root causes", detail: "Counters are cumulative imported observations. Changes require comparable snapshots and reset/wrap context; error subcounters may overlap and must not be added into a fabricated total." });
  output.caveats.push("Only interface state and the explicitly recognized packet/byte/error counter lines are parsed. Addresses, descriptions, hardware, rates, queue details and clearing-time text are excluded; unsupported counter lines are counted as skipped.", "Counter values up to unsigned 64-bit maximum are preserved exactly; values above JavaScript's safe-integer range are decimal strings. Missing counters remain unavailable. No error-rate, bandwidth, cable-fault, duplex-mismatch or root-cause inference is made.", "An up/up interface is not an end-to-end connectivity guarantee. Counter implementations, clearing behavior and visibility vary by Cisco platform and release.");
  return output;
}

const routeSources: Record<string, string> = { C: "connected", L: "local", S: "static", R: "RIP", B: "BGP", D: "EIGRP", DEX: "EIGRP external", O: "OSPF", OIA: "OSPF inter-area", OE1: "OSPF external type 1", OE2: "OSPF external type 2", ON1: "OSPF NSSA type 1", ON2: "OSPF NSSA type 2", i: "IS-IS", iL1: "IS-IS level 1", iL2: "IS-IS level 2", ia: "IS-IS inter-area" };
const routeAge = /^(?:\d{1,4}:[0-5]\d:[0-5]\d|\d{1,6}w(?:\d{1,6}d)?|\d{1,6}d(?:\d{1,6}h)?|\d{1,6}h(?:\d{1,6}m)?)$/;
function routeRow(line: Line): Row | undefined {
  const match = /^([A-Za-z0-9* ]{1,12})\s+(\S+)\s+(.+)$/.exec(line.text);
  if (!match) return undefined;
  const code = match[1].replace(/\s/g, ""), sourceKey = code.replace("*", "");
  const source = Object.hasOwn(routeSources, sourceKey) ? routeSources[sourceKey] : undefined;
  const network = prefix(match[2]);
  if (!source || (code.match(/\*/g)?.length ?? 0) > 1 || !network) return undefined;
  const base: Row = { sourceLine: line.number, prefix: network, source, code, context: "not independently verified", nextHop: unavailable, interface: unavailable, administrativeDistance: unavailable, routeMetric: unavailable, rowCoverage: "one explicit installed-route line" };
  const connected = /^is directly connected, (\S+)$/.exec(match[3]);
  if (connected) {
    const name = interfaceName(connected[1]);
    if (!name || !["C", "L", "S"].includes(code.replace("*", ""))) return undefined;
    return { ...base, nextHop: "directly connected", interface: name };
  }
  const via = /^\[(\d{1,3})\/(\d{1,20})\] via (\S+?)(?:, (.+))?$/.exec(match[3]);
  if (!via || ["C", "L"].includes(code.replace("*", ""))) return undefined;
  const nextHop = ipv4(via[3]), metric = counter(via[2]);
  const distance = Number(via[1]);
  if (!nextHop || metric === undefined || distance > 255) return undefined;
  const tail = via[4]?.split(/,\s*/) ?? [];
  let name: string | undefined;
  if (tail.length > 2) return undefined;
  if (tail.length === 2) {
    if (!routeAge.test(tail[0])) return undefined;
    name = interfaceName(tail[1]);
    if (!name) return undefined;
  } else if (tail.length === 1) {
    name = interfaceName(tail[0]);
    if (!name && !routeAge.test(tail[0])) return undefined;
  }
  return { ...base, nextHop, interface: name ?? unavailable, administrativeDistance: distance, routeMetric: metric };
}

function parseRoutes(transcript: Transcript): ToolkitResult {
  const rows: Row[] = [], seen = new Set<string>();
  const coverage: Coverage = { parsed: 0, excluded: 0, skipped: 0 };
  let legends = 0, gateways = 0, legend = false, previous: Row | undefined;
  for (const line of transcript.lines) {
    if (/^(?:Routing Table:|Routing entry for|IPv6 Routing Table)/i.test(line.text)) invalid("VRF, address-specific detail and IPv6 route layouts are unsupported by this IPv4 table profile.");
    if (/^Codes:/.test(line.text)) {
      if (++legends > 1 || rows.length) invalid("Multiple route tables or repeated route legends are unsupported.");
      coverage.excluded++; legend = true; previous = undefined; continue;
    }
    if (legend && /^(?:[A-Za-z*+%&][A-Za-z0-9]* - )/.test(line.text)) { coverage.excluded++; continue; }
    legend = false;
    if (/^Gateway of last resort/.test(line.text)) {
      if (++gateways > 1 || rows.length) invalid("Multiple route tables or misplaced gateway headers are unsupported.");
      if (!/^Gateway of last resort is not set$/.test(line.text)) {
        const gateway = /^Gateway of last resort is (\S+) to network (\S+)$/.exec(line.text);
        if (!gateway || !ipv4(gateway[1]) || !ipv4(gateway[2])) { coverage.skipped++; continue; }
      }
      coverage.excluded++; previous = undefined; continue;
    }
    const group = /^(\S+) is (?:variably )?subnetted, \d+ subnets?(?:, \d+ masks?)?$/.exec(line.text);
    if (group) {
      if (prefix(group[1])) coverage.excluded++; else coverage.skipped++;
      previous = undefined; continue;
    }
    const row = routeRow(line);
    if (!row) {
      coverage.skipped++;
      if (/^\[/.test(line.text) && previous) previous.rowCoverage = "partial: additional next-hop line skipped";
      else previous = undefined;
      continue;
    }
    const key = JSON.stringify([row.prefix, row.source, row.nextHop, row.interface]);
    if (seen.has(key)) invalid("Duplicate route observations are unsupported. Import one route table snapshot only.");
    seen.add(key); rows.push(row); previous = row; coverage.parsed++;
  }
  if (!rows.length) invalid("No supported IPv4 installed route rows. Explicit CIDR prefixes and supported connected/next-hop syntax are required; inherited masks and wrapped rows are unsupported.");
  const output = result("cisco-route", transcript, rows, coverage);
  output.metrics.push({ label: "Explicit prefixes", value: new Set(rows.map((row) => row.prefix)).size, meaning: "Distinct explicitly parsed CIDRs only, not the complete routing table or a forwarding-path count." });
  output.caveats.push("Only explicit IPv4 CIDRs with supported C/L/S/R/B/D/O/IS-IS source codes and connected or [distance/metric] via-address lines are supported. Classful/inherited masks, wrapped rows, additional next-hop lines, repair paths, tags and unsupported suffixes are skipped, not reconstructed.", "Administrative distance is the reported source preference; routeMetric is protocol-specific and is not comparable across protocols. A routing-table entry does not prove hardware FIB programming, resolved adjacency, policy/NAT decisions or application delivery.", "The '*' marker is retained as an imported code character, not used to infer current packet selection. No route lookup, topology inference, route recommendation or best-path simulation runs.");
  return output;
}

export function analyzeCiscoOutput(input: string, profile: string): ToolkitResult {
  if (!Object.hasOwn(profiles, profile)) invalid("Unsupported Cisco profile. Select cisco-ip-brief, cisco-interfaces or cisco-route.");
  const selected = profile as Profile;
  const transcript = readTranscript(input, selected);
  if (selected === "cisco-ip-brief") return parseBrief(transcript);
  if (selected === "cisco-interfaces") return parseInterfaces(transcript);
  return parseRoutes(transcript);
}
