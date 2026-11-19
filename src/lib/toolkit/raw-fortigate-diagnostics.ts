import { parseAddress } from "./network-core.ts";
import type { ToolkitResult } from "./types.ts";

type Profile = "fortigate-session-stat" | "fortigate-flow" | "fortigate-ike";
type Row = Record<string, string | number>;
type Counts = { parsed: number; unparsed: number; partial: number; omitted: number; metadata: number };
const names: Record<Profile, string> = { "fortigate-session-stat": "Session aggregate snapshot", "fortigate-flow": "Observed debug-flow events", "fortigate-ike": "IKE gateway snapshot" };
const sourceIds: Record<Profile, string> = { "fortigate-session-stat": "raw-fortigate-session", "fortigate-flow": "raw-fortigate-flow", "fortigate-ike": "raw-fortigate-ike" };
const commands: Record<Profile, string> = { "fortigate-session-stat": "diagnose sys session stat", "fortigate-flow": "diagnose debug flow trace", "fortigate-ike": "diagnose vpn ike gateway list" };
const token = "[A-Za-z0-9][A-Za-z0-9_.-]{0,63}";
const ipv4Token = "[0-9.]{7,15}";
const numberToken = "[0-9]{1,16}";
const unknown = "unknown";
const prompt = /^(?:[A-Za-z0-9][A-Za-z0-9_.-]{0,63}(?:[ \t]+\([A-Za-z0-9_.-]{1,64}\))?[ \t]+)?#[ \t]*(.*)$/;

function fail(message = "Malformed or unsupported diagnostic record; supply one supported snapshot."): never { throw new Error(message); }
function uint(text: string, max = Number.MAX_SAFE_INTEGER): number {
  if (!/^[0-9]{1,16}$/.test(text)) fail();
  const value = Number(text);
  if (!Number.isSafeInteger(value) || value > max) fail();
  return value;
}
function counter(text: string): number | string {
  if (!/^[0-9]{1,20}$/.test(text)) fail();
  const value = BigInt(text);
  if (value > 18_446_744_073_709_551_615n) fail("Counter exceeds the supported exact-integer bound.");
  return value <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(value) : value.toString();
}
function address4(text: string): string {
  const value = parseAddress(text);
  if (value.kind() !== "ipv4") fail("This diagnostic address layout supports IPv4 only.");
  return value.toString();
}
function once(seen: Set<string>, key: string): void {
  if (seen.has(key)) fail("Duplicate records or mixed snapshots are ambiguous and are not merged.");
  seen.add(key);
}

const sessionFields: Record<string, [string, string]> = {
  session_count: ["sessions", "Reported current session total across protocols; not an individual-session inventory."],
  setup_rate: ["sessions/s", "Device-reported current session creation rate; no browser timing or capacity threshold is applied."],
  exp_count: ["expectations", "Reported session expectations, not an application-reachability count."],
  clash: ["events", "Reported cumulative session tuple clashes since reboot; not proof of a current application problem."],
  memory_tension_drop: ["sessions", "Reported cumulative session removals associated with memory pressure; the reset boundary is unverified here. Not proof of current pressure or conserve mode."],
  removeable: ["sessions", "Reported sessions marked removable; not a count of sessions already removed."],
  ha_scan: ["sessions", "Reported count of sessions handled by proxy in the documented layout."],
};
const tcpStates = new Set(["NONE", "ESTABLISHED", "SYN_SENT", "SYN_RECV", "FIN_WAIT", "TIME_WAIT", "CLOSE", "CLOSE_WAIT"]);

function sessionParser(rows: Row[], counts: Counts) {
  let header = false, section = "counters";
  const seen = new Set<string>();
  return {
    line(line: string, lineNumber: number) {
      const isHeader = line.startsWith("misc info:");
      if (isHeader) { if (header) fail("Repeated session headers indicate multiple snapshots."); header = true; }
      if (!header) { counts.unparsed++; return; }
      if (line === "TCP sessions:") { once(seen, "tcp-header"); section = "tcp"; counts.metadata++; return; }
      if (/^[A-Za-z][A-Za-z -]{0,50}:/.test(line) && !isHeader) {
        section = "unsupported";
        if (line === "firewall error stat:" || line === "tcp reset stat:") counts.metadata++;
        else counts.unparsed++;
        return;
      }
      if (section === "tcp") {
        const match = /^([0-9]{1,20}) in ([A-Z_]{1,16}) state$/.exec(line);
        if (!match || !tcpStates.has(match[2])) { counts.unparsed++; return; }
        const value = counter(match[1]);
        once(seen, `tcp.${match[2]}`);
        rows.push({ metric: `tcp.${match[2]}`, value, unit: "sessions", meaning: `Count in the reported ${match[2]} TCP state; not a per-session or application-health result.`, line: lineNumber });
        counts.parsed++; return;
      }
      if (section !== "counters") { counts.unparsed++; return; }
      const body = isHeader ? line.slice("misc info:".length).trim() : line;
      const fields = body.split(/[ \t]+/);
      if (!fields.length || fields.length > 32) fail();
      const pending: Row[] = [];
      const local = new Set<string>();
      let omitted = 0;
      for (const field of fields) {
        const match = /^([a-z][a-z0-9_]{0,39})=([0-9]{1,20}(?:\/[0-9]{1,20})?),?$/.exec(field);
        if (!match) { if (isHeader || /^(?:memory_tension_drop|removeable|ha_scan)=/.test(body)) fail(); counts.unparsed++; return; }
        const [, key, raw] = match;
        once(local, key);
        if (!Object.hasOwn(sessionFields, key)) { omitted++; continue; }
        const value = counter(raw);
        const [unit, meaning] = sessionFields[key];
        pending.push({ metric: key, value, unit, meaning, line: lineNumber });
      }
      if (isHeader && ["session_count", "setup_rate", "exp_count", "clash"].some(key => !local.has(key))) fail("Session aggregate header is incomplete.");
      for (const row of pending) once(seen, String(row.metric));
      counts.omitted += omitted;
      if (!pending.length) { counts.unparsed++; return; }
      rows.push(...pending); counts.parsed++;
      if (omitted) counts.partial++;
    },
    finish() { if (!header) fail("A supported session aggregate header is required."); },
  };
}

const envelope = new RegExp(`^(?:[0-9]{4}-[0-9]{2}-[0-9]{2} [0-9]{2}:[0-9]{2}:[0-9]{2}(?:\\.[0-9]{1,6})? )?(?:id=(${numberToken}) )?(?:pri=emergency )?trace_id=(${numberToken})(?: func=[A-Za-z_][A-Za-z0-9_]{0,63} line=${numberToken})? msg="([^"\\r\\n]*)"$`);
const received = new RegExp(`^vd-(${token})(?::(${numberToken}))? received a packet ?\\(proto=([0-9]{1,3}),[ \\t]*(${ipv4Token}):([0-9]{1,5})->(${ipv4Token}):([0-9]{1,5})\\)(?: len=([0-9]{1,5}))?(?: tun_id=(${ipv4Token}))? from (${token})\\.(?: flag \\[([FSRPAUEC.]{1,8})\\], seq ([0-9]{1,10}), ack ([0-9]{1,10}), win ([0-9]{1,5})| type=([0-9]{1,3}), code=([0-9]{1,3}), id=([0-9]{1,5}), seq=([0-9]{1,5})\\.)?$`);
const flowMeanings: Record<string, string> = {
  "packet-received": "This trace reports receipt of the displayed packet tuple; this does not establish forwarding or delivery.",
  "policy-allowed": "This event reports permission at a policy check, not final delivery or success through later inspection.",
  "policy-denied": "This event reports a forward-policy denial; the underlying reason is not established by this line alone.",
  "reverse-path-drop": "This event reports a reverse-path check drop; the trace alone does not identify a configuration fault or spoofing.",
  "iprope-drop": "This event reports an iprope check drop; the precise cause needs matching policy and traffic evidence.",
  "selector-drop": "This event reports no matching IPsec selector and a drop, not a diagnosis of either peer.",
  "quota-denied": "This event reports a quota-check denial; the relevant limit and current configuration are not provided.",
  "session-direction": "The session lookup explicitly reports original or reply direction; session identifiers are omitted.",
};

function flowParser(rows: Row[], counts: Counts) {
  const contexts = new Map<string, Row>();
  const maxima = new Map<string, number>();
  const seenEvents = new Set<string>();
  return {
    line(line: string, lineNumber: number) {
      const match = envelope.exec(line);
      if (!match) {
        if (line.includes("received a packet")) fail("Unsupported packet anchor; trace context cannot be established safely.");
        counts.unparsed++; return;
      }
      const debugId = match[1] === undefined ? unknown : uint(match[1]);
      const traceId = uint(match[2]);
      const message = match[3].trim();
      const key = `${debugId}|${traceId}`;
      const packet = received.exec(message);
      if (packet) {
        if (contexts.has(key) || traceId < (maxima.get(String(debugId)) ?? -1)) fail("Repeated or restarted trace IDs are ambiguous; import a single ordered trace context.");
        const protocol = uint(packet[3], 255);
        if (![1, 6, 17].includes(protocol)) fail("Only documented IPv4 ICMP, TCP and UDP packet anchors are supported.");
        const sourceIP = address4(packet[4]), destinationIP = address4(packet[6]);
        const sourcePort = uint(packet[5], 65535), destinationPort = uint(packet[7], 65535);
        if (packet[8]) uint(packet[8], 65535);
        if (packet[9]) address4(packet[9]);
        if (packet[11]) {
          if (protocol !== 6) fail();
          uint(packet[12], 4294967295); uint(packet[13], 4294967295); uint(packet[14], 65535);
        }
        if (packet[15]) {
          if (protocol !== 1) fail();
          uint(packet[15], 255); uint(packet[16], 255); uint(packet[17], 65535); uint(packet[18], 65535);
        }
        const row: Row = { traceId, debugId, vdom: packet[1], vrf: packet[2] === undefined ? unknown : uint(packet[2]), event: "packet-received", sourceIP, destinationIP, sourcePort: protocol === 1 ? "not applicable" : sourcePort, destinationPort: protocol === 1 ? "not applicable" : destinationPort, protocol, direction: unknown, policyId: unknown, meaning: flowMeanings["packet-received"], line: lineNumber };
        contexts.set(key, row); maxima.set(String(debugId), traceId);
        rows.push(row); counts.parsed++; return;
      }
      if (message.includes("received a packet")) fail("Malformed packet anchor; trace context cannot be reused.");
      const context = contexts.get(key);
      if (!context) { counts.unparsed++; return; }
      let event: string | undefined, policyId: number | string = unknown, direction = unknown;
      let eventMatch = /^Allowed by Policy-([0-9]{1,10}):(?: SNAT)?$/.exec(message);
      if (eventMatch) { event = "policy-allowed"; policyId = uint(eventMatch[1], 4294967295); }
      eventMatch = /^Denied by forward policy check(?: \(policy ([0-9]{1,10})\))?$/.exec(message);
      if (eventMatch) { event = "policy-denied"; if (eventMatch[1] !== undefined) policyId = uint(eventMatch[1], 4294967295); }
      eventMatch = /^iprope_in_check\(\) check failed(?: on policy ([0-9]{1,10}))?, drop$/.exec(message);
      if (eventMatch) { event = "iprope-drop"; if (eventMatch[1] !== undefined) policyId = uint(eventMatch[1], 4294967295); }
      if (message === "reverse path check fail, drop") event = "reverse-path-drop";
      if (message === "No matching IPsec selector, drop") event = "selector-drop";
      if (message === "Denied by quota check") event = "quota-denied";
      eventMatch = /^Find an existing session, id-[0-9a-fA-F]{1,16}, (original|reply) direction$/.exec(message);
      if (eventMatch) { event = "session-direction"; direction = eventMatch[1]; }
      if (!event) { counts.unparsed++; return; }
      once(seenEvents, `${key}|${event}|${policyId}|${direction}`);
      rows.push({ ...context, event, direction, policyId, meaning: flowMeanings[event], line: lineNumber }); counts.parsed++;
    },
    finish() { if (!contexts.size) fail("A supported received-packet anchor is required; isolated outcomes are not assigned a context."); },
  };
}

const ikeVdom = new RegExp(`^vd: (${token})/(${numberToken})$`);
const ikeName = new RegExp(`^name: (${token})$`);
const ikeEndpoints = new RegExp(`^addr: (${ipv4Token}):([0-9]{1,5}) -> (${ipv4Token}):([0-9]{1,5})$`);

function ikeParser(rows: Row[], counts: Counts) {
  let current: Row | undefined;
  let fields = new Set<string>();
  const tunnels = new Set<string>();
  function finishBlock() {
    if (!current) return;
    if (current.tunnel === unknown || !["version", "addr", "status"].some(key => fields.has(key))) fail("Incomplete IKE block; identity and at least one supported observation are required.");
    once(tunnels, `${current.vdom}|${current.vdomId}|${current.tunnel}`);
    current.meaning = current.state === "established" ? "IKE Phase 1 is reported established; this does not establish Phase 2 or application reachability."
      : current.state === "connecting" ? "IKE is reported connecting; this observation alone does not identify why negotiation is incomplete."
        : "IKE state was not supplied in a supported status record; no state is inferred from other fields.";
    rows.push(current);
  }
  return {
    line(line: string, lineNumber: number) {
      if (/^vd\b/i.test(line)) {
        const match = ikeVdom.exec(line);
        if (!match) fail("Malformed IKE VDOM boundary; blocks cannot be merged safely.");
        finishBlock(); fields = new Set();
        current = { tunnel: unknown, vdom: match[1], vdomId: uint(match[2]), version: unknown, localIP: unknown, localPort: unknown, remoteIP: unknown, remotePort: unknown, tunnelId: unknown, state: unknown, direction: unknown, meaning: "", line: lineNumber };
        counts.metadata++; return;
      }
      if (!current) { counts.unparsed++; return; }
      const opaque = /^(id\/spi|cookies?|serial)\s*[:=]/i.exec(line);
      if (opaque) {
        // Marker repetition can indicate multiple SAs; values remain uninspected.
        once(fields, `omitted:${opaque[1].toLowerCase().replace(/cookies?/, "cookie")}`);
        counts.omitted++; return;
      }
      const field = /^(name|version|addr|tun_id|direction|status)\b/i.exec(line)?.[1].toLowerCase();
      if (!field) { counts.unparsed++; return; }
      once(fields, field);
      if (field === "name") {
        const match = ikeName.exec(line);
        if (!match) fail("Unsupported IKE tunnel identifier.");
        current.tunnel = match[1];
      } else if (field === "version") {
        const match = /^version: ([12])$/.exec(line);
        if (!match) fail();
        current.version = uint(match[1]);
      } else if (field === "addr") {
        const match = ikeEndpoints.exec(line);
        if (!match) fail("Unsupported IKE endpoint layout; only strict IPv4 endpoints are supported.");
        current.localIP = address4(match[1]); current.localPort = uint(match[2], 65535);
        current.remoteIP = address4(match[3]); current.remotePort = uint(match[4], 65535);
      } else if (field === "tun_id") {
        const match = /^tun_id: ([0-9.]{7,15})\/([0-9a-fA-F:.]{2,45})$/.exec(line);
        if (!match) fail("Unsupported IKE tunnel-ID layout.");
        const v4 = address4(match[1]), v6 = parseAddress(match[2]);
        if (v6.kind() !== "ipv6") fail();
        current.tunnelId = `${v4}/${v6.toString()}`;
      } else if (field === "direction") {
        const match = /^direction: (initiator|responder)$/.exec(line);
        if (!match) fail();
        current.direction = match[1];
      } else {
        const established = /^status: established ([0-9]{1,16})-([0-9]{1,16})s ago = ([0-9]{1,16})ms$/.exec(line);
        const connecting = /^status: connecting, state ([0-9]{1,16}), started ([0-9]{1,16})s ago$/.exec(line);
        if (!established && !connecting) fail("Unsupported IKE status layout; no state was guessed.");
        for (const value of (established ?? connecting)!.slice(1)) uint(value);
        current.state = established ? "established" : "connecting";
      }
      counts.parsed++;
    },
    finish: finishBlock,
  };
}

const caveats: Record<Profile, string[]> = {
  "fortigate-session-stat": [
    "Aggregates are not an inventory of individual sessions, users or applications. TCP state counts are a subset of an all-protocol total and are not required to equal it.",
    "No health thresholds, rates computed from cumulative counters, or attack/conserve-mode diagnoses are inferred. Missing metrics are unknown, not zero.",
    "Only documented scalar counters and selected TCP states are interpreted. Slash-pairs, flush/delete, unknown keys, offload counters and error-stat internals remain unsupported and counted; reset semantics are not guessed.",
    "Counter values up to the parser's unsigned-64 bound are exact; values above JavaScript's safe-integer range are decimal strings. This is a parser bound, not a claim about device counter width.",
  ],
  "fortigate-flow": [
    "Each row is a reported event, not a captured hop or whole-path verdict. Policy permission is not proof of final delivery; absence of a drop is not proof of success.",
    "Endpoints and protocol on later rows refer only to their received-packet anchor. NAT translations, routes, inspection completion, offloaded traffic and return-path delivery are not reconstructed.",
    "VDOM names and optional VRF suffixes come from packet anchors. Missing debug ID or VRF stays unknown. Orphan events are unparsed; reused, duplicate or decreasing anchor trace IDs are rejected, including potentially legitimate reordered captures.",
    "Only strict IPv4 TCP/UDP/ICMP anchors and listed outcomes are supported. ICMP tuple numbers are not exposed as transport ports. Chassis prefixes, other IP families and unknown messages are unsupported.",
  ],
  "fortigate-ike": [
    "IKE Phase 1 state is not proof of Phase 2, selector compatibility, current packet delivery or application reachability. No algorithm, lifetime or device-fault diagnosis is inferred.",
    "Only explicit VDOM/tunnel blocks and documented version, strict IPv4 endpoints, tunnel-ID pair, direction and status layouts are returned. Missing fields remain unknown.",
    "Cookies, SPIs and serials are omitted. Any recognized key-material dump fails closed. Multiple states/rekey records in one block, duplicate tunnel identities and repeated command snapshots are rejected rather than merged.",
  ],
};

/** Parses previously collected text only. Never contacts a device or executes commands. */
export function analyzeFortigateDiagnostics(input: string, profile: string): ToolkitResult {
  if (typeof profile !== "string" || !Object.hasOwn(names, profile)) fail("Select a supported FortiGate diagnostic profile.");
  if (typeof input !== "string" || !input.trim() || input.length > 1_048_576 || new TextEncoder().encode(input).byteLength > 1_048_576) fail("Supply nonempty diagnostic text within the 1 MiB limit.");
  if (/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(input)) fail("Terminal control characters are unsupported.");
  const lines = input.split("\n");
  if (lines.length > 20_000) fail("Diagnostic text exceeds the 20000-line limit.");
  const selected = profile as Profile, rows: Row[] = [];
  const counts: Counts = { parsed: 0, unparsed: 0, partial: 0, omitted: 0, metadata: 0 };
  const parser = selected === "fortigate-session-stat" ? sessionParser(rows, counts) : selected === "fortigate-flow" ? flowParser(rows, counts) : ikeParser(rows, counts);
  let commandSeen = false, closed = false, contentSeen = false;
  for (let index = 0; index < lines.length; index++) {
    let line = lines[index].replace(/\r$/, "").trim();
    if (!line) continue;
    if (line.length > 4096 || line.includes("\r")) fail("A diagnostic line exceeds the supported layout bound.");
    if (/\b(?:key|keymat|key[-_ ]?material|skeyid(?:_[ade])?|sk_[a-z]{1,4}|private[-_ ]?key)\s*[:=]|\bpsksecret\b|-----BEGIN [^-]*PRIVATE KEY-----/i.test(line)) fail("Key material and detailed key dumps are unsupported; no input was returned.");
    if (/--\s*more\s*--|\[truncated\]|<output truncated>|\.{3}|\u2026/i.test(line)) fail("Paged or truncated diagnostic output is unsupported.");
    if (/^(?:Command fail|Unknown action|Permission denied|parse error|command parse error)\b/i.test(line)) fail("The supplied text contains failed-command evidence.");
    if (closed) fail("Multiple command snapshots or content after a closing prompt are unsupported.");
    const prefixed = prompt.exec(line);
    if (prefixed) {
      line = prefixed[1].trim();
      if (!line) { counts.metadata++; closed = contentSeen; continue; }
    }
    if (/^(?:diagnose|diag|execute|config|get|show)(?:[ \t]|$)/.test(line)) {
      const flowCommand = selected === "fortigate-flow" && /^diagnose debug flow trace start [0-9]{1,6}$/.test(line);
      if ((line !== commands[selected] && !flowCommand) || commandSeen || contentSeen) fail("Mixed, repeated or unsupported command transcript.");
      commandSeen = true; counts.metadata++; continue;
    }
    if ((selected !== "fortigate-flow" && /\btrace_id=/.test(line)) || (selected !== "fortigate-session-stat" && /^(?:misc info:|TCP sessions:|memory_tension_drop=)/.test(line)) || (selected !== "fortigate-ike" && /^(?:vd:|name:|IKE SA:|IPsec SA:)/.test(line)) || /^(?:CPU[0-9]* states:|Routing table|session info:)/.test(line) || line.includes("selectors(total,up):")) fail("Mixed diagnostic formats do not match the selected profile.");
    contentSeen = true;
    parser.line(line, index + 1);
    if (rows.length > 20_000) fail("Diagnostic result exceeds the 20000-row limit.");
  }
  parser.finish();
  if (!rows.length) fail("No supported diagnostic observations were found.");
  const findings: ToolkitResult["findings"] = [{ level: "info", title: "Limited imported evidence", detail: "Collection time, device identity and completeness are unverified. If an application problem is being investigated, correlate independently collected evidence from the same context and time window." }];
  if (counts.unparsed || counts.partial || counts.omitted) findings.push({ level: "review", title: "Fields excluded", detail: `${counts.unparsed} lines were unparsed, ${counts.partial} lines only partly interpreted, and ${counts.omitted} fields/lines deliberately omitted. Their text is not returned. If a missing field matters, verify its release-specific format before relying on this excerpt.` });
  if (selected === "fortigate-session-stat") findings.push({ level: "info", title: "Aggregate counts only", detail: "These observations describe reported totals and states, not particular users or failed connections. If trends matter, compare separately collected snapshots with known elapsed time, uptime and reset behavior; no trend is inferred here." });
  if (selected === "fortigate-flow") {
    const permitted = rows.filter(row => row.event === "policy-allowed").length;
    const drops = rows.filter(row => /drop|denied/.test(String(row.event))).length;
    findings.push({ level: "info", title: "Observed policy and drop events", detail: `${permitted} policy-permission events and ${drops} drop/denial events were parsed. These are stage observations, not final packet outcomes. If delivery is in question, correlate matching packet captures and traffic/security logs; if a drop is under review, compare the matching policy/routing context without assuming its cause.` });
  }
  if (selected === "fortigate-ike") findings.push({ level: "info", title: "IKE state is not application state", detail: "Only explicit established/connecting states are interpreted. If application traffic is in question, obtain matching Phase 2/selector, traffic-counter and packet evidence from both peers. An absent state remains unknown; no peer or configuration fault is inferred." });
  return {
    title: names[selected], summary: `${rows.length} supported observations; ${counts.unparsed} unparsed lines. Completeness is unverified; no health or end-to-end reachability verdict.`, evidence: "imported", rows, findings,
    metrics: [
      { label: "Parsed data lines", value: counts.parsed, meaning: "Lines contributing an allowlisted observation; not evidence of successful collection." },
      { label: "Unparsed lines", value: counts.unparsed, meaning: "Nonempty lines with no supported observation; their text is not echoed." },
      { label: "Partially parsed lines", value: counts.partial, meaning: "Lines containing both supported scalar counters and omitted fields." },
      { label: "Omitted fields or lines", value: counts.omitted, meaning: "Unsupported numeric fields or deliberately excluded sensitive identifiers; never treated as zero." },
      { label: "Metadata lines", value: counts.metadata, meaning: "Recognized commands, prompts or section/context headers, not measurements." },
      { label: "Completeness", value: "unverified", meaning: "An excerpt cannot prove complete collection, and boundary-free concatenation cannot always be detected." },
    ], caveats: [...caveats[selected]], sourceIds: [sourceIds[selected]],
  };
}

/** Synthetic, secret-free examples using documentation address ranges. */
export const fortigateDiagnosticSamples: Readonly<Record<Profile, string>> = Object.freeze({
  "fortigate-session-stat": `diagnose sys session stat
misc info: session_count=42 setup_rate=3 exp_count=1 clash=0
memory_tension_drop=0 ephemeral=0/10000 removeable=0 ha_scan=0
TCP sessions:
24 in ESTABLISHED state
2 in SYN_SENT state
1 in CLOSE_WAIT state`,
  "fortigate-flow": `id=65308 trace_id=10 func=print_pkt_detail line=6019 msg="vd-root:0 received a packet(proto=6, 192.0.2.10:50123->198.51.100.20:443) tun_id=0.0.0.0 from port1. flag [S], seq 100, ack 0, win 64240"
id=65308 trace_id=10 func=fw_forward_handler line=1002 msg="Allowed by Policy-7:"
id=65308 trace_id=11 func=print_pkt_detail line=6019 msg="vd-root:0 received a packet(proto=17, 192.0.2.11:53000->198.51.100.53:53) from port1."
id=65308 trace_id=11 func=fw_forward_handler line=1002 msg="Denied by forward policy check (policy 0)"`,
  "fortigate-ike": `diagnose vpn ike gateway list
vd: root/0
name: branch-a
version: 2
addr: 192.0.2.1:500 -> 198.51.100.1:500
tun_id: 198.51.100.1/::198.51.100.1
direction: initiator
status: established 120-120s ago = 0ms
vd: root/0
name: branch-b
version: 1
addr: 192.0.2.1:500 -> 203.0.113.1:500
direction: responder
status: connecting, state 3, started 15s ago`,
});
