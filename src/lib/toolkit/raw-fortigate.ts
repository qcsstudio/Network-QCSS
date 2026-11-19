import { parseAddress, parsePrefix } from "./network-core.ts";
import type { ToolkitResult } from "./types.ts";

type Row = Record<string, string | number>;
type Profile = "fortigate-performance" | "fortigate-route" | "fortigate-vpn";
type LineParser = (line: string, lineNumber: number) => Row[] | null;

const commands: Record<Profile, string> = {
  "fortigate-performance": "get system performance status",
  "fortigate-route": "get router info routing-table all",
  "fortigate-vpn": "get vpn ipsec tunnel summary",
};
const integer = "([0-9]{1,16})";
const percent = "([0-9]{1,3}(?:\\.[0-9]{1,3})?)";
const identifier = "[A-Za-z0-9][A-Za-z0-9_.:-]{0,63}";
const promptPattern = /^(?:[A-Za-z0-9][A-Za-z0-9_.-]{0,63}(?:[ \t]+\([A-Za-z0-9_.-]{1,64}\))?[ \t]+)?#[ \t]*(.*)$/;

function uint(text: string, max = Number.MAX_SAFE_INTEGER): number {
  if (!/^[0-9]{1,16}$/.test(text)) throw new Error("Invalid numeric field.");
  const value = Number(text);
  if (!Number.isSafeInteger(value) || value > max) throw new Error("Invalid numeric field.");
  return value;
}

function percentage(text: string): number {
  const value = Number(text);
  if (!Number.isFinite(value) || value < 0 || value > 100) throw new Error("Invalid percentage field.");
  return value;
}

function ipv4(text: string): string {
  const address = parseAddress(text);
  if (address.kind() !== "ipv4") throw new Error("Only IPv4 is supported in this record.");
  return address.toString();
}

function unique(seen: Set<string>, key: string): void {
  if (seen.has(key)) throw new Error("Duplicate records or multiple snapshots are not supported. Supply one command output.");
  seen.add(key);
}

const cpuNames = ["user", "system", "nice", "idle", "iowait", "irq", "softirq"] as const;
const cpuMeanings = [
  "CPU time spent in user-space programs.", "CPU time spent in kernel-space work.",
  "CPU time attributed to the nice category.", "CPU time reported idle.",
  "CPU time waiting for input/output.", "CPU time servicing hardware interrupts.",
  "CPU time servicing software interrupts.",
];
const cpuPattern = new RegExp(`^CPU([0-9]{1,4})? states: ${cpuNames.map(name => `${percent}% ${name}`).join(" ")}$`);
const memoryPattern = new RegExp(`^Memory: ${integer}k total, ${integer}k used \\(${percent}%\\), ${integer}k free \\(${percent}%\\)(?:, ${integer}k freeable \\(${percent}%\\))?$`);
const seriesPattern = /^(Average|Maximal) (network usage|sessions|session setup rate|NPU sessions|nTurbo sessions): (.+)$/;
const networkWindow = new RegExp(`^${integer} / ${integer} kbps in (1 minute|10 minutes|30 minutes)$`);
const sessionWindow = new RegExp(`^${integer} sessions in (1 minute|10 minutes|30 minutes)$`);
const offloadWindow = new RegExp(`^${integer} sessions in last (1 minute|10 minutes|30 minutes)$`);
const setupWindow = new RegExp(`^${integer} sessions per second in last (1 minute|10 minutes|30 minutes)$`);

function performanceParser(seen: Set<string>): LineParser {
  return (line, lineNumber) => {
    const row = (metric: string, value: number, unit: string, meaning: string, scope = "aggregate", windowMinutes: number | string = "unknown"): Row =>
      ({ metric, value, unit, meaning, scope, windowMinutes, line: lineNumber });
    let match = cpuPattern.exec(line);
    if (match) {
      const scope = match[1] === undefined ? "aggregate" : `cpu${uint(match[1])}`;
      const values = match.slice(2).map(percentage);
      unique(seen, `cpu:${scope}`);
      return values.map((value, index) => row(`cpu.${cpuNames[index]}`, value, "%", cpuMeanings[index], scope));
    }
    match = memoryPattern.exec(line);
    if (match) {
      const total = uint(match[1]);
      const used = uint(match[2]);
      const free = uint(match[4]);
      const usedPercent = percentage(match[3]);
      const freePercent = percentage(match[5]);
      const freeable = match[6] === undefined ? undefined : uint(match[6]);
      const freeablePercent = match[7] === undefined ? undefined : percentage(match[7]);
      if (total === 0 || used > total || free > total || (freeable ?? 0) > total) throw new Error("Invalid memory field.");
      unique(seen, "memory");
      const rows = [
        row("memory.total", total, "k", "Total memory in the device's reported k units; no byte conversion applied."),
        row("memory.used", used, "k", "Memory reported used; distinct from freeable cache."),
        row("memory.usedPercent", usedPercent, "%", "Device-reported used-memory percentage, not a health threshold."),
        row("memory.free", free, "k", "Memory reported free; distinct from freeable cache."),
        row("memory.freePercent", freePercent, "%", "Device-reported free-memory percentage."),
      ];
      if (freeable !== undefined && freeablePercent !== undefined) rows.push(
        row("memory.freeable", freeable, "k", "Cached memory reported separately as reclaimable."),
        row("memory.freeablePercent", freeablePercent, "%", "Device-reported freeable-memory percentage."),
      );
      return rows;
    }
    match = seriesPattern.exec(line);
    if (match) {
      const [, statistic, kind, payload] = match;
      const parts = payload.split(", ");
      if (parts.length !== 3) return null;
      const network = kind === "network usage";
      const pattern = network ? networkWindow : kind === "sessions" ? sessionWindow : kind === "session setup rate" ? setupWindow : offloadWindow;
      const names: Record<string, string> = { "network usage": "network", sessions: "sessions", "session setup rate": "sessionSetup", "NPU sessions": "npuSessions", "nTurbo sessions": "nTurboSessions" };
      const rows: Row[] = [];
      for (let index = 0; index < parts.length; index++) {
        const item = pattern.exec(parts[index]);
        const windowMinutes = [1, 10, 30][index];
        if (!item || Number(item[network ? 3 : 2].split(" ")[0]) !== windowMinutes) return null;
        const key = `${names[kind]}.${statistic === "Average" ? "average" : "maximum"}`;
        if (network) {
          rows.push(row(`${key}.inbound`, uint(item[1]), "kbps", `${statistic} inbound traffic rate over the stated window.`, "aggregate", windowMinutes));
          rows.push(row(`${key}.outbound`, uint(item[2]), "kbps", `${statistic} outbound traffic rate over the stated window.`, "aggregate", windowMinutes));
        } else {
          rows.push(row(key, uint(item[1]), kind === "session setup rate" ? "sessions/s" : "sessions", `${statistic} ${kind} reported over the stated window; not a capacity verdict.`, "aggregate", windowMinutes));
        }
      }
      unique(seen, `${statistic}:${kind}`);
      return rows;
    }
    match = /^(Virus caught|IPS attacks blocked): ([0-9]{1,16}) total in 1 minute$/.exec(line);
    if (match) {
      const value = uint(match[2]);
      unique(seen, match[1]);
      return [row(match[1] === "Virus caught" ? "security.virusCaught" : "security.ipsBlocked", value, "events", "Reported event count for one minute; zero does not establish absence of threats.", "aggregate", 1)];
    }
    match = /^Uptime: ([0-9]{1,16}) days?,[ \t]+([0-9]{1,2}) hours?,[ \t]+([0-9]{1,2}) minutes?$/.exec(line);
    if (match) {
      const days = uint(match[1]);
      const hours = uint(match[2], 23);
      const minutes = uint(match[3], 59);
      unique(seen, "uptime");
      return [row("uptime.days", days, "days", "Whole days in the displayed uptime."), row("uptime.hours", hours, "hours", "Hours component of displayed uptime, not total hours."), row("uptime.minutes", minutes, "minutes", "Minutes component of displayed uptime, not total minutes.")];
    }
    return null;
  };
}

const routeLegends = new Set([
  "Codes: K - kernel, C - connected, S - static, R - RIP, B - BGP",
  "O - OSPF, IA - OSPF inter area",
  "N1 - OSPF NSSA external type 1, N2 - OSPF NSSA external type 2",
  "E1 - OSPF external type 1, E2 - OSPF external type 2",
  "i - IS-IS, L1 - IS-IS level-1, L2 - IS-IS level-2, ia - IS-IS inter area",
  "* - candidate default",
]);
const protocols: Record<string, string> = { K: "kernel", C: "connected", S: "static", R: "RIP", B: "BGP", O: "OSPF", "O IA": "OSPF inter area", "O N1": "OSPF NSSA external type 1", "O N2": "OSPF NSSA external type 2", "O E1": "OSPF external type 1", "O E2": "OSPF external type 2", i: "IS-IS", "i L1": "IS-IS level-1", "i L2": "IS-IS level-2", "i ia": "IS-IS inter area" };
const routeHead = /^(K|C|S|R|B|O(?:[ \t]+(?:IA|N1|N2|E1|E2))?|i(?:[ \t]+(?:L1|L2|ia))?)(\*)?[ \t]+([0-9.]{7,15}\/[0-9]{1,2})[ \t]+(.+)$/;
const directRoute = new RegExp(`^is directly connected, (${identifier})$`);
const nextHopRoute = new RegExp(`^\\[${integer}/${integer}\\] via ([0-9.]{7,15}), (${identifier})(?:, ([0-9]{2}:[0-9]{2}:[0-9]{2}|[0-9]{1,6}d[0-9]{1,2}h[0-9]{1,2}m))?(?:, \\[${integer}/${integer}\\])?$`);

function routeParser(): LineParser {
  let vrf: number | string = "unknown";
  const vrfs = new Set<string>();
  const records = new Set<string>();
  const legends = new Set<string>();
  return (line, lineNumber) => {
    const normalized = line.replace(/[ \t]+/g, " ");
    if (routeLegends.has(normalized)) {
      unique(legends, normalized);
      return [];
    }
    // Never carry a previous VRF across a malformed or unsupported table header.
    if (/^Routing[ \t]+table\b/i.test(line)) vrf = "unknown";
    const header = /^Routing table for VRF=([0-9]{1,16})$/.exec(line);
    if (header) {
      vrf = uint(header[1]);
      unique(vrfs, String(vrf));
      return [];
    }
    const match = routeHead.exec(line);
    if (!match) return null;
    const protocolCode = match[1].replace(/[ \t]+/g, " ");
    const prefix = parsePrefix(match[3]);
    if (prefix.family !== "ipv4" || prefix.hostBits) throw new Error("Invalid IPv4 network prefix.");
    const direct = directRoute.exec(match[4]);
    const routed = nextHopRoute.exec(match[4]);
    let row: Row;
    if (direct && protocolCode === "C" && !match[2]) {
      row = { prefix: prefix.canonical, nextHop: "directly connected", interface: direct[1], distance: "unknown", metric: "unknown", age: "unknown", trailingPair: "absent" };
    } else if (routed && protocolCode !== "C") {
      const age = routed[5] ?? "unknown";
      if (age.includes(":")) {
        const [hours, minutes, seconds] = age.split(":");
        uint(hours, 23); uint(minutes, 59); uint(seconds, 59);
      } else if (age !== "unknown") {
        const parts = /^([0-9]+)d([0-9]+)h([0-9]+)m$/.exec(age)!;
        uint(parts[2], 23); uint(parts[3], 59);
      }
      row = { prefix: prefix.canonical, nextHop: ipv4(routed[3]), interface: routed[4], distance: uint(routed[1], 255), metric: uint(routed[2]), age, trailingPair: routed[6] === undefined ? "absent" : `${uint(routed[6])}/${uint(routed[7])}` };
    } else return null;
    row = { ...row, protocol: protocols[protocolCode], vrf, candidateDefault: match[2] ? "yes" : "no", line: lineNumber };
    // Include path/context, not just prefix: separate ECMP next hops and VRFs are valid.
    unique(records, JSON.stringify({ ...row, line: 0, age: "omitted" }));
    return [row];
  };
}

const vpnPattern = new RegExp(`^'(${identifier})'[ \\t]+([0-9.]{7,15}):${integer}[ \\t]+selectors\\(total,up\\): ${integer}/${integer}[ \\t]+rx\\(pkt,err\\): ${integer}/${integer}[ \\t]+tx\\(pkt,err\\): ${integer}/${integer}$`);

function vpnParser(): LineParser {
  const seen = new Set<string>();
  return (line, lineNumber) => {
    const match = vpnPattern.exec(line);
    if (!match) return null;
    const [, tunnel, address] = match;
    const peer = ipv4(address);
    const peerPort = uint(match[3], 65535);
    const [selectorsTotal, selectorsUp, rxPackets, rxErrors, txPackets, txErrors] = match.slice(4).map(value => uint(value));
    if (selectorsUp > selectorsTotal) throw new Error("Invalid selector counts.");
    unique(seen, `${tunnel}|${peer}|${peerPort}`);
    return [{ tunnel, peer, selectorsTotal, selectorsUp, rxPackets, rxErrors, txPackets, txErrors, peerPort, line: lineNumber }];
  };
}

const caveats: Record<Profile, string[]> = {
  "fortigate-performance": [
    "One imported snapshot is not causal proof, a capacity assessment, or a health verdict. No model-specific thresholds are applied.",
    "Each average/maximum belongs to its explicit 1, 10, or 30 minute window. CPU and memory sampling intervals are unknown here; per-core rows are not additional aggregate usage.",
    "Missing fields are unknown, not zero. Freeable memory is separate from free/used; k units and reported percentages are preserved without recomputing them.",
  ],
  "fortigate-route": [
    "An IPv4 routing-table snapshot does not establish end-to-end forwarding, firewall permission, next-hop reachability, or the forwarding table (FIB). No route or failover path is selected.",
    "VRF is unknown without a parsed header; device, VDOM, collection time and collection completeness are unverified. A missing row does not prove route absence.",
    "Only one-line connected and via-next-hop records are supported. IPv6, recursive/wrapped paths, blackhole routes and other layouts are counted as unparsed, not reconstructed.",
    "The asterisk is a candidate-default marker, not a traffic guarantee. The optional trailing numeric pair is preserved as uninterpreted metadata; distance/metric are unknown on connected records that omit them.",
  ],
  "fortigate-vpn": [
    "Selectors reported up do not prove application reachability, negotiated cryptographic details, or end-to-end traffic delivery. No tunnel health verdict is inferred.",
    "RX/TX packet and error counters are copied independently. Their accumulation/reset interval is unknown; no rate, loss percentage or error-to-packet subset relationship is inferred.",
    "Only IPv4-peer summary rows with constrained ASCII tunnel identifiers are supported. Missing rows/counters are unknown, not zero; detailed diagnose output and secrets are outside scope.",
  ],
};

/** Browser-local parsing only. Errors and unparsed-line reports never include input text. */
export function analyzeFortigateOutput(input: string, profile: string): ToolkitResult {
  if (typeof profile !== "string" || !Object.hasOwn(commands, profile)) throw new Error("Select a supported FortiGate output profile.");
  if (typeof input !== "string" || !input.trim() || input.length > 1_048_576) throw new Error("Supply nonempty FortiGate output within the 1 MiB input limit.");
  if (new TextEncoder().encode(input).length > 1_048_576) throw new Error("FortiGate output exceeds the 1 MiB input limit.");
  if (/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(input)) throw new Error("Terminal control characters are unsupported; supply plain command output.");
  if (/-----BEGIN [^-]*PRIVATE KEY-----/i.test(input)) throw new Error("Private keys and detailed key dumps are unsupported.");
  const lines = input.split("\n");
  if (lines.length > 20_000) throw new Error("FortiGate output exceeds the 20000-line input limit.");
  const selected = profile as Profile;
  const seen = new Set<string>();
  const parse = selected === "fortigate-performance" ? performanceParser(seen) : selected === "fortigate-route" ? routeParser() : vpnParser();
  const rows: Row[] = [];
  let dataLines = 0, metadataLines = 0, unparsedLines = 0, commandSeen = false, closed = false;
  for (let index = 0; index < lines.length; index++) {
    const line = lines[index].replace(/\r$/, "").trim();
    if (!line) continue;
    if (closed) throw new Error("Content after a closing prompt is not a single command snapshot.");
    if (line.length > 4096 || line.includes("\r")) {
      if (selected === "fortigate-route" && /^Routing[ \t]+table\b/i.test(line)) throw new Error("Unsupported routing-table header; routing context is ambiguous.");
      unparsedLines++; continue;
    }
    if ((/\b(?:enc|dec):/i.test(line) && /\bkey=/i.test(line)) || /\bah=\w+[ \t]+key=/i.test(line)) throw new Error("Private keys and detailed key dumps are unsupported.");
    const prompt = promptPattern.exec(line);
    const command = prompt ? prompt[1].trim() : line;
    if (prompt && !command) { metadataLines++; closed = dataLines > 0; continue; }
    if (prompt || /^(?:get|diagnose|execute|config|show)(?:[ \t]|$)/.test(command)) {
      if (command !== commands[selected] || commandSeen || dataLines > 0) throw new Error("Mixed, repeated, or unsupported commands. Supply one output matching the selected profile.");
      commandSeen = true; metadataLines++; continue;
    }
    const fingerprint = /^(?:CPU[0-9]* states:|Memory:|(?:Average|Maximal) (?:network usage|sessions|session setup rate|NPU sessions|nTurbo sessions):|Uptime:)/.test(line) ? "fortigate-performance"
      : /^(?:Routing table for VRF=|Codes:)|^[A-Za-z* \t]{1,10}[ \t]+[0-9a-fA-F:.]+\/[0-9]+[ \t]/.test(line) ? "fortigate-route"
        : line.includes("selectors(total,up):") ? "fortigate-vpn" : null;
    if (fingerprint && fingerprint !== selected) throw new Error("Mixed output formats do not match the selected FortiGate profile.");
    let parsed: Row[] | null;
    try { parsed = parse(line, index + 1); }
    catch (error) {
      if (error instanceof Error && error.message.startsWith("Duplicate records")) throw error;
      // A malformed record is excluded atomically, never converted into plausible data.
      unparsedLines++; continue;
    }
    if (parsed === null) { unparsedLines++; continue; }
    if (parsed.length === 0) { metadataLines++; continue; }
    if (rows.length + parsed.length > 20_000) throw new Error("Parsed output exceeds the 20000-row result limit.");
    rows.push(...parsed); dataLines++;
  }
  if (!rows.length) throw new Error("No supported data records found. Output may be empty, malformed, truncated, or from an unsupported command/version.");
  const findings: ToolkitResult["findings"] = [{ level: "info", title: "Imported snapshot only", detail: "Collection success, time, device identity, and completeness are unverified. Even fully recognized text can be an incomplete excerpt; concatenated outputs without boundaries cannot always be detected." }];
  if (unparsedLines) findings.push({ level: "review", title: "Partial parse", detail: `${unparsedLines} nonempty lines were unsupported or malformed and excluded. This includes any truncation markers. Their content is not echoed; do not treat these rows as a complete inventory.` });
  if (selected === "fortigate-performance") {
    const missing = ["cpu:aggregate", "memory", "uptime"].filter(key => !seen.has(key)).length;
    if (missing) findings.push({ level: "review", title: "Missing performance sections", detail: `${missing} of aggregate CPU, memory, and uptime sections are absent or invalid. Missing measurements remain unknown.` });
  }
  return {
    title: selected === "fortigate-performance" ? "FortiGate performance snapshot" : selected === "fortigate-route" ? "FortiGate IPv4 route snapshot" : "FortiGate IPsec summary snapshot",
    summary: `${dataLines} data lines parsed; ${unparsedLines} nonempty lines unparsed. Snapshot completeness is unverified; no health or reachability verdict.`,
    evidence: "imported",
    metrics: [
      { label: "Parsed data lines", value: dataLines, meaning: "Whole input lines accepted by the selected documented grammar." },
      { label: "Unparsed lines", value: unparsedLines, meaning: "Nonempty lines excluded because their format or values were unsupported; contents are not echoed." },
      { label: "Metadata lines", value: metadataLines, meaning: "Recognized command, prompt, routing legend, or VRF-header lines; not measurements." },
      { label: "Parsed rows", value: rows.length, meaning: "Displayed records or metric rows, not a health score or proof of completeness." },
      { label: "Completeness", value: "unverified", meaning: "The text alone cannot prove successful, complete collection of one snapshot." },
    ],
    rows, findings, caveats: [...caveats[selected]], sourceIds: [`raw-${selected}`],
  };
}

/** Synthetic documentation-range examples, not captured device evidence. */
export const fortigateOutputSamples: Readonly<Record<Profile, string>> = Object.freeze({
  "fortigate-performance": `get system performance status
CPU states: 4% user 2% system 0% nice 94% idle 0% iowait 0% irq 0% softirq
CPU0 states: 4% user 2% system 0% nice 94% idle 0% iowait 0% irq 0% softirq
Memory: 4000000k total, 1200000k used (30%), 2400000k free (60%), 400000k freeable (10%)
Average network usage: 120 / 30 kbps in 1 minute, 100 / 25 kbps in 10 minutes, 90 / 20 kbps in 30 minutes
Maximal network usage: 200 / 70 kbps in 1 minute, 240 / 80 kbps in 10 minutes, 300 / 100 kbps in 30 minutes
Average sessions: 42 sessions in 1 minute, 40 sessions in 10 minutes, 38 sessions in 30 minutes
Maximal sessions: 60 sessions in 1 minute, 64 sessions in 10 minutes, 70 sessions in 30 minutes
Average session setup rate: 1 sessions per second in last 1 minute, 1 sessions per second in last 10 minutes, 0 sessions per second in last 30 minutes
Maximal session setup rate: 3 sessions per second in last 1 minute, 4 sessions per second in last 10 minutes, 5 sessions per second in last 30 minutes
Average NPU sessions: 20 sessions in last 1 minute, 19 sessions in last 10 minutes, 18 sessions in last 30 minutes
Maximal NPU sessions: 30 sessions in last 1 minute, 32 sessions in last 10 minutes, 34 sessions in last 30 minutes
Average nTurbo sessions: 2 sessions in last 1 minute, 2 sessions in last 10 minutes, 1 sessions in last 30 minutes
Maximal nTurbo sessions: 4 sessions in last 1 minute, 5 sessions in last 10 minutes, 6 sessions in last 30 minutes
Virus caught: 0 total in 1 minute
IPS attacks blocked: 0 total in 1 minute
Uptime: 2 days, 3 hours, 4 minutes`,
  "fortigate-route": `get router info routing-table all
Routing table for VRF=0
S* 0.0.0.0/0 [10/0] via 192.0.2.1, port1, [1/0]
C 192.0.2.0/24 is directly connected, port1
B 198.51.100.0/24 [20/100] via 192.0.2.2, port1, 2d03h04m`,
  "fortigate-vpn": `get vpn ipsec tunnel summary
'branch-a' 192.0.2.10:0 selectors(total,up): 2/2 rx(pkt,err): 1250/0 tx(pkt,err): 900/2
'branch-b' 198.51.100.20:4500 selectors(total,up): 1/0 rx(pkt,err): 0/0 tx(pkt,err): 0/0`,
});
