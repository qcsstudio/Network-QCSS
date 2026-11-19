import { parseAddress } from "./network-core";
import type { ToolkitResult } from "./types";

type Profile = "cisco-vlan" | "cisco-trunk" | "cisco-stp" | "cisco-ospf" | "cisco-bgp";
type Row = Record<string, string | number>;
type Line = { text: string; number: number };
type Coverage = { parsed: number; excluded: number; skipped: number };
const unavailable = "unavailable";
const commands: Record<Profile, string> = {
  "cisco-vlan": "show vlan brief", "cisco-trunk": "show interfaces trunk",
  "cisco-stp": "show spanning-tree", "cisco-ospf": "show ip ospf neighbor", "cisco-bgp": "show ip bgp summary",
};

export const ciscoAdvancedSourceIds: Record<Profile, string> = {
  "cisco-vlan": "raw-cisco-vlan", "cisco-trunk": "raw-cisco-trunk", "cisco-stp": "raw-cisco-stp",
  "cisco-ospf": "raw-cisco-ospf", "cisco-bgp": "raw-cisco-bgp",
};

// Synthetic, documentation-shaped fixtures; these are not live device observations.
export const ciscoAdvancedSamples: Record<Profile, string> = {
  "cisco-vlan": `show vlan brief
VLAN Name                             Status    Ports
---- -------------------------------- --------- -------------------------------
1    default                          active    Gi1/0/1, Gi1/0/2
10   EXAMPLE                          active    Gi1/0/3
20   EXAMPLE_PAUSED                    suspend
1002 fddi-default                     act/unsup`,
  "cisco-trunk": `show interfaces trunk
Port        Mode         Encapsulation  Status        Native vlan
Gi1/0/1     on           802.1q         trunking      1
Port        Vlans allowed on trunk
Gi1/0/1     1,10,20-22
Port        Vlans allowed and active in management domain
Gi1/0/1     1,10,20
Port        Vlans in spanning tree forwarding state and not pruned
Gi1/0/1     1,10`,
  "cisco-stp": `show spanning-tree
VLAN0010
  Spanning tree enabled protocol rstp
  Root ID    Priority    32778
             Address     0200.0000.0010
             This bridge is the root
             Hello Time 2 sec Max Age 20 sec Forward Delay 15 sec
  Bridge ID  Priority    32778 (priority 32768 sys-id-ext 10)
             Address     0200.0000.0010
             Hello Time 2 sec Max Age 20 sec Forward Delay 15 sec
             Aging Time 300 sec
Interface           Role Sts Cost      Prio.Nbr Type
------------------- ---- --- --------- -------- --------------------------------
Gi1/0/1             Desg FWD 20000     128.1    P2p
Gi1/0/2             Desg FWD 20000     128.2    P2p Edge`,
  "cisco-ospf": `show ip ospf neighbor
Neighbor ID     Pri   State           Dead Time   Address         Interface
192.0.2.2         1   FULL/DR         00:00:32    198.51.100.2    GigabitEthernet1/0/1
192.0.2.3         1   2WAY/DROTHER    00:00:34    198.51.100.3    GigabitEthernet1/0/1`,
  "cisco-bgp": `show ip bgp summary
BGP router identifier 192.0.2.1, local AS number 4200000000
BGP table version is 7, main routing table version 7
Neighbor        V          AS MsgRcvd MsgSent TblVer InQ OutQ Up/Down State/PfxRcd
192.0.2.2       4  4200000001      12      13      7   0    0 00:04:20 0
192.0.2.3       4       64512       0       0      0   0    0 never Active`,
};

const headers: Partial<Record<Profile, RegExp>> = {
  "cisco-vlan": /^VLAN\s+Name\s+Status\s+Ports$/,
  "cisco-trunk": /^Port\s+Mode\s+Encapsulation\s+Status\s+Native vlan$/,
  "cisco-ospf": /^Neighbor ID\s+Pri\s+State\s+Dead Time\s+Address\s+Interface$/,
  "cisco-bgp": /^Neighbor\s+V\s+AS\s+MsgRcvd\s+MsgSent\s+TblVer\s+InQ\s+OutQ\s+Up\/Down\s+State\/PfxRcd$/,
};
const families = [
  ["Ethernet", "Et", "Eth"], ["FastEthernet", "Fa"], ["GigabitEthernet", "Gi"],
  ["TenGigabitEthernet", "Te"], ["TwentyFiveGigE", "Twe"], ["FortyGigabitEthernet", "Fo"],
  ["FiftyGigE", "Fif"], ["HundredGigE", "Hu"], ["TwoGigabitEthernet", "Tw"],
  ["Port-channel", "Po"], ["Loopback", "Lo"], ["Vlan", "Vl"], ["Tunnel", "Tu"],
  ["Serial", "Se"], ["Fddi", "FD"], ["BDI"], ["AppGigabitEthernet", "Ap"],
];
const aliases = new Map(families.flatMap(([full, ...short]) => [full, ...short].map((name) => [name.toLowerCase(), full])));
const interfacePattern = /^([A-Za-z-]{2,24})((?:0|[1-9]\d{0,5})(?:\/(?:0|[1-9]\d{0,5})){0,3}(?:\.(?:0|[1-9]\d{0,5}))?)$/;
function invalid(message: string): never { throw new Error(message); }
function iface(value: string): string | undefined {
  const m = interfacePattern.exec(value), family = m && aliases.get(m[1].toLowerCase());
  return m && family ? family + m[2] : undefined;
}
function uint(value: string, max = Number.MAX_SAFE_INTEGER, min = 0): number | undefined {
  if (!/^(?:0|[1-9]\d{0,15})$/.test(value)) return undefined;
  const n = Number(value);
  return Number.isSafeInteger(n) && n >= min && n <= max ? n : undefined;
}
function counter(value: string): number | string | undefined {
  if (!/^(?:0|[1-9]\d{0,19})$/.test(value)) return undefined;
  const n = BigInt(value);
  if (n > 18_446_744_073_709_551_615n) return undefined;
  return n <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(value) : value;
}
function ipv4(value: string): string | undefined {
  if (!/^(?:0|[1-9]\d{0,2})(?:\.(?:0|[1-9]\d{0,2})){3}$/.test(value)) return undefined;
  try { const parsed = parseAddress(value); return parsed.kind() === "ipv4" ? parsed.toString() : undefined; }
  catch { return undefined; }
}
function asn(value: string): number | undefined {
  const parts = value.split(".");
  if (parts.length === 1) return uint(value, 4_294_967_295, 1);
  if (parts.length !== 2) return undefined;
  const hi = uint(parts[0], 65535), lo = uint(parts[1], 65535);
  return hi !== undefined && lo !== undefined && hi * 65536 + lo > 0 ? hi * 65536 + lo : undefined;
}
function clockSeconds(value: string): number | undefined {
  const m = /^(\d{1,3}):([0-5]\d):([0-5]\d)$/.exec(value);
  return m ? Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]) : undefined;
}
function duplicate(seen: Set<string>, key: string): void {
  if (seen.has(key)) invalid("Duplicate observations or repeated context fields are unsupported. Import one snapshot only.");
  seen.add(key);
}
function hasPrivateKeyMarker(text: string): boolean {
  // Two ordered literal scans avoid retrying a remainder match at every BEGIN marker.
  const lower = text.toLowerCase(), begin = "-----begin ";
  const offset = lower.indexOf(begin);
  return offset !== -1 && lower.indexOf("private key-----", offset + begin.length) !== -1;
}
function readLines(input: string, profile: Profile): Line[] {
  if (typeof input !== "string" || !input.trim()) invalid("Supply one nonempty Cisco command output.");
  if (input.length > 1_048_576 || new TextEncoder().encode(input).length > 1_048_576) invalid("Cisco import exceeds the 1 MiB UTF-8 limit.");
  if (/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(input)) invalid("Unsupported terminal controls. Import plain text after the shared ANSI-SGR guard.");
  const raw = input.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n").split("\n");
  if (raw.length - (raw.at(-1) === "" ? 1 : 0) > 20_000) invalid("Cisco import exceeds the 20000-line limit.");
  const lines: Line[] = [];
  let commandSeen = false, ended = false;
  for (let i = 0; i < raw.length; i++) {
    const text = raw[i].trim().replace(/[ \t]+/g, " ");
    if (!text) continue;
    if (/--More--|(?:output|text)\s+(?:is\s+)?(?:truncated|omitted)|^\.{1,3}$|^\[\.\.\.\]$/i.test(text)) invalid("Truncated or paginated output is unsupported. Import one complete, unfiltered command output.");
    if (/^%|^(?:username|enable secret|password|snmp-server community)\b/i.test(text) || hasPrivateKeyMarker(text)) invalid("CLI diagnostics or sensitive configuration material is unsupported.");
    const prompt = /^[A-Za-z0-9_.:()-]{1,128}[>#]\s*(.*)$/.exec(text);
    if (prompt && !prompt[1]) {
      if (!lines.length || ended) invalid("Unexpected prompt or multiple command transcripts.");
      ended = true; continue;
    }
    if (ended) invalid("Content follows the closing prompt. Multiple transcripts are unsupported.");
    const command = prompt ? prompt[1] : text;
    if (prompt || /^(?:sh(?:ow)?|do|ping|traceroute|configure|enable|terminal)\b/i.test(command)) {
      if (commandSeen || lines.length) invalid("Multiple or mixed command transcripts are unsupported.");
      if (command.replace(/\s+/g, " ").toLowerCase() !== commands[profile]) invalid("Command does not match this profile. Use the exact show command without filters or suffixes.");
      commandSeen = true; continue;
    }
    if (/^[^\s]+[>#]/.test(text)) invalid("Unsupported terminal prompt or command transcript.");
    for (const [other, header] of Object.entries(headers)) {
      if (other !== profile && header.test(text)) invalid("Mixed command output formats are unsupported.");
    }
    if (profile !== "cisco-stp" && /^(?:VLAN\d+|Spanning tree enabled|Root ID|Bridge ID)\b/.test(text) ||
        profile !== "cisco-bgp" && /^BGP router identifier\b/.test(text) ||
        /^(?:Interface\s+IP-Address|Codes:|Gateway of last resort|Routing Table:|\S+ is .*, line protocol is)/.test(text) ||
        /^(?:For address family:|Address family:|VRF[: ]|Routing Process|MST\d+|Spanning tree \d+ is)/i.test(text)) {
      invalid("Mixed output or an unsupported OS, address-family, VRF or spanning-tree layout is present.");
    }
    lines.push({ text, number: i + 1 });
  }
  if (!lines.length) invalid("No command output was supplied.");
  return lines;
}
function base(profile: Profile, lines: Line[], rows: Row[], c: Coverage): ToolkitResult {
  if (!rows.length) invalid("No supported data rows. The output is empty, malformed, incomplete or outside this profile.");
  return {
    title: `Imported Cisco ${commands[profile].slice(5)}`, evidence: "imported", rows, sourceIds: [ciscoAdvancedSourceIds[profile]],
    summary: `${rows.length} supported rows; ${c.skipped} data lines skipped; ${c.excluded} header/metadata lines excluded. Original transcript completeness is not verified.`,
    metrics: [
      { label: "Parsed rows", value: rows.length, meaning: "Supported records in this snapshot, not a verified device inventory." },
      { label: "Parsed data lines", value: c.parsed, meaning: "Lines consumed as allowlisted observations or context." },
      { label: "Skipped data lines", value: c.skipped, meaning: "Malformed or unsupported lines, including failed rows. Their raw content is withheld." },
      { label: "Excluded metadata lines", value: c.excluded, meaning: "Recognized headings and out-of-scope metadata." },
      { label: "Input data lines", value: lines.length, meaning: "Nonempty lines excluding the optional command echo and closing prompt." },
    ],
    findings: [{ level: c.skipped ? "review" : "info", title: "Parser coverage", detail: c.skipped ? "Some lines could not be interpreted. Review the original export locally before drawing conclusions; skipped rows are not healthy, absent or zero." : "Only allowlisted fields were extracted. Zero skipped lines does not prove the export is complete or every vendor field was interpreted." }],
    caveats: [
      "Browser-local imported snapshot only; no live command, reachability check, topology discovery or root-cause test. Collection time, device identity and authenticity are not verified.",
      "Documented Cisco IOS/IOS XE layouts only, not every platform or release. No NX-OS, IOS XR or ASA support claim. Use one exact unfiltered command; 1 MiB UTF-8 / 20000 lines maximum.",
      "Mixed commands, duplicates, explicit truncation and unsafe context are rejected. Silent omission at a line boundary cannot be detected. Missing evidence is unavailable, never zero.",
      "Prompts, hostnames, VLAN names, descriptions and arbitrary free text are excluded. Validated addresses and interface identifiers can still be sensitive; review them before sharing.",
    ],
  };
}
function finding(out: ToolkitResult, level: "info" | "review", title: string, detail: string): void { out.findings.push({ level, title, detail }); }
function start(lines: Line[], profile: Profile): Coverage {
  if (!headers[profile]?.test(lines[0].text)) invalid("Unsupported table header. Supply the documented complete header and data rows for this profile.");
  return { parsed: 0, excluded: 1, skipped: 0 };
}

function parseVlan(lines: Line[]): ToolkitResult {
  const c = start(lines, "cisco-vlan"), rows: Row[] = [], seen = new Set<string>();
  let current: Row | undefined;
  let ports: string[] = [], portSet = new Set<string>();
  const updatePorts = () => { if (current) { current.interfaces = ports.length ? ports.join(", ") : "none listed"; current.listedPorts = ports.length; } };
  for (const line of lines.slice(1)) {
    if (headers["cisco-vlan"]!.test(line.text)) invalid("Repeated VLAN headers are unsupported.");
    if (/^-+(?:\s+-+)+$/.test(line.text)) { c.excluded++; continue; }
    if (/^(?:VLAN Type|Remote SPAN VLANs|Primary Secondary)/.test(line.text)) invalid("Full show vlan or private-VLAN output is unsupported. Use show vlan brief.");
    const m = /^(\d{1,4})\s+(.{1,32}?)\s+(active|suspend|act\/unsup)(?:\s+(.+))?$/.exec(line.text);
    if (m) {
      updatePorts();
      current = undefined;
      const vlan = uint(m[1], 4094, 1);
      const names = m[4] ? m[4].split(",").map((p) => iface(p.trim())) : [];
      if (vlan === undefined || names.some((p) => !p)) { c.skipped++; continue; }
      duplicate(seen, String(vlan));
      ports = names as string[]; portSet = new Set(ports);
      if (portSet.size !== ports.length) invalid("Duplicate VLAN port observations are unsupported.");
      current = { sourceLine: line.number, vlan, status: m[3], interfaces: "none listed", listedPorts: 0 };
      rows.push(current); updatePorts(); c.parsed++; continue;
    }
    const names = line.text.split(",").map((p) => iface(p.trim()));
    if (current && names.every((p) => p !== undefined)) {
      for (const name of names as string[]) { duplicate(portSet, name); ports.push(name); }
      c.parsed++; continue;
    }
    // An unrecognized continuation can conceal ports; do not present the earlier subset as complete.
    if (current && !/^\d/.test(line.text)) { current.interfaces = unavailable; current.listedPorts = unavailable; }
    else updatePorts();
    current = undefined; c.skipped++;
  }
  updatePorts();
  // Finalize completed VLANs without repeatedly joining growing continuation lists.
  const out = base("cisco-vlan", lines, rows, c);
  const suspended = rows.some((r) => r.status === "suspend");
  finding(out, "info", "VLAN state is local evidence", "Active means the VLAN is reported active locally, not that its ports, trunks or applications can communicate. For an affected VLAN, compare its interface state and the separate trunk allowed/active/forwarding lists.");
  if (suspended) finding(out, "review", "Suspended VLAN observed", "A parsed VLAN is reported suspended. If service on it is expected, compare the intended VLAN configuration and change history; this snapshot does not establish why it was suspended.");
  if (rows.some((r) => r.status === "act/unsup")) finding(out, "info", "Unsupported media status observed", "An act/unsup entry is reported. Legacy VLAN/media entries can use this label; it is not proof of a failed physical port. Check the platform's VLAN support before acting.");
  if (rows.some((r) => r.listedPorts === 0)) finding(out, "info", "No ports listed for a VLAN", "An empty Ports column means no ports were listed in that row. It does not prove the VLAN is unused or absent from trunks; use the trunk output if that distinction matters.");
  out.caveats.push("One row per VLAN. VLAN names are discarded. Supported port continuations are folded into interfaces; unknown continuation text invalidates that row's port list. Listed ports are not inferred topology.");
  return out;
}

const trunkSections = [
  /^Port\s+Mode\s+Encapsulation\s+Status\s+Native vlan$/,
  /^Port\s+Vlans allowed on trunk$/,
  /^Port\s+Vlans allowed and active in management domain$/,
  /^Port\s+Vlans in spanning tree forwarding state and not pruned$/,
];
const vlanFields = ["", "allowedVlans", "activeVlans", "forwardingVlans"];
function vlanList(value: string): string | undefined {
  if (value === "none") return "none";
  if (!/^[0-9,-]+$/.test(value)) return undefined;
  let last = 0;
  const parts = value.split(",");
  for (const part of parts) {
    const range = part.split("-");
    if (range.length > 2) return undefined;
    const low = uint(range[0], 4094, 1), high = uint(range.at(-1)!, 4094, 1);
    if (low === undefined || high === undefined || low <= last || high < low) return undefined;
    last = high;
  }
  return value;
}
function parseTrunk(lines: Line[]): ToolkitResult {
  const c = start(lines, "cisco-trunk"), rows: Row[] = [], byInterface = new Map<string, Row>(), seen = new Set<string>();
  const sections = new Set<number>([0]);
  let section = 0;
  for (const line of lines.slice(1)) {
    const next = trunkSections.findIndex((p) => p.test(line.text));
    if (next >= 0) {
      if (sections.has(next) || next <= section) invalid("Repeated or out-of-order trunk sections are unsupported.");
      sections.add(next); section = next; c.excluded++; continue;
    }
    if (/^Port(?:\s|$)/.test(line.text)) invalid("Unsupported trunk section header. VLAN-list context cannot be assigned safely.");
    if (/^[\d,-]+$/.test(line.text)) invalid("Wrapped trunk VLAN lists are unsupported. Export wider, unwrapped rows; no partial VLAN list is accepted.");
    if (section === 0) {
      const m = /^(\S+)\s+(on|off|auto|desirable|routed)\s+(802\.1q|n-802\.1q|isl|n-isl|negotiate)\s+(trunking|not-trunking|routed)\s+(\d{1,4})$/.exec(line.text);
      const name = m && iface(m[1]), vlan = m ? uint(m[5], 4094, 1) : undefined;
      if (!m || !name || vlan === undefined) { c.skipped++; continue; }
      duplicate(seen, name);
      const row = { sourceLine: line.number, interface: name, mode: m[2], encapsulation: m[3], status: m[4], nativeVlan: vlan, allowedVlans: unavailable, activeVlans: unavailable, forwardingVlans: unavailable };
      rows.push(row); byInterface.set(name, row); c.parsed++; continue;
    }
    const m = /^(\S+)\s+(\S+)$/.exec(line.text), name = m && iface(m[1]);
    if (name) duplicate(seen, `${section}:${name}`);
    const value = m && vlanList(m[2]), row = name && byInterface.get(name);
    if (!row || value === undefined || value === null) { c.skipped++; continue; }
    row[vlanFields[section]] = value; c.parsed++;
  }
  const out = base("cisco-trunk", lines, rows, c);
  finding(out, "info", "Three different VLAN observations", "Allowed is the configured permission list; active is the allowed-and-active list; forwarding is the reported STP-forwarding and not-pruned list. None is an explicit empty list; unavailable means it was not parsed. Compare the affected VLAN across all three before investigating further.");
  if (rows.some((r) => r.status === "trunking")) finding(out, "info", "Trunking is not end-to-end delivery", "A port is reported trunking locally. If traffic still fails, compare both ends' native VLAN and allowed VLAN evidence plus the affected VLAN's STP state; this import does not observe the remote end.");
  if (rows.some((r) => r.status !== "trunking")) finding(out, "review", "Non-trunking or routed entry observed", "A parsed port is not reported trunking. This may be intentional. If a trunk is expected, compare the intended port mode and peer-side output before changing configuration.");
  if (rows.some((r) => [r.allowedVlans, r.activeVlans, r.forwardingVlans].includes(unavailable))) finding(out, "review", "VLAN-list evidence is incomplete", "At least one section or per-port VLAN list is missing or unsupported. Obtain the complete unwrapped output; missing lists cannot be treated as empty or equivalent to another section.");
  out.caveats.push("One row per supported port. Unwrapped, increasing, non-overlapping VLAN lists from 1 through 4094 or literal none only. Wrapped lists are rejected rather than partially interpreted. No remote-port or topology inference.");
  return out;
}

type StpBlock = { context: Row; rows: Row[]; seen: Set<string>; section?: "root" | "bridge"; table: boolean };
function parseStp(lines: Line[]): ToolkitResult {
  const c: Coverage = { parsed: 0, excluded: 0, skipped: 0 }, rows: Row[] = [], vlans = new Set<string>();
  let block: StpBlock | undefined;
  const finish = () => {
    if (!block) return;
    const ctx = block.context;
    if (!["protocol", "rootBridge", "rootPriority", "localBridge", "bridgePriority"].every((key) => ctx[key] !== undefined) || !block.table || !block.rows.length) invalid("Incomplete or unsupported STP VLAN block. Root, bridge, protocol and at least one supported port row are required.");
    if (ctx.isRoot === "yes" && (ctx.rootBridge !== ctx.localBridge || ctx.rootPriority !== ctx.bridgePriority)) invalid("Contradictory STP root and bridge context is unsupported.");
    for (const row of block.rows) rows.push({ ...ctx, ...row });
  };
  for (const line of lines) {
    const vlan = /^VLAN(\d{1,4})$/.exec(line.text);
    if (vlan) {
      finish();
      const id = Number(vlan[1]);
      if (id < 1 || id > 4094) invalid("Invalid STP VLAN context.");
      duplicate(vlans, String(id));
      block = { context: { vlan: id, isRoot: unavailable }, rows: [], seen: new Set(), table: false };
      c.parsed++; continue;
    }
    if (!block || /^VLAN|^MST/.test(line.text)) invalid("Unsupported or missing STP VLAN context. Only VLAN-based Role/Sts tables are supported.");
    let m: RegExpExecArray | null;
    if ((m = /^Spanning tree enabled protocol (ieee|rstp)$/i.exec(line.text))) {
      if (block.table) invalid("STP context appears after its port table.");
      duplicate(block.seen, "protocol"); block.context.protocol = m[1].toLowerCase(); c.parsed++; continue;
    }
    if ((m = /^(Root|Bridge) ID\s+Priority\s+(\d{1,5})(?:\s+\(priority (\d{1,5}) sys-id-ext (\d{1,4})\))?$/.exec(line.text))) {
      if (block.table) invalid("STP context appears after its port table.");
      const priority = uint(m[2], 65535), basePriority = m[3] ? uint(m[3], 61440) : undefined, extension = m[4] ? uint(m[4], 4094, 1) : undefined;
      if (priority === undefined || m[3] && (basePriority === undefined || extension !== block.context.vlan || basePriority % 4096 !== 0 || basePriority + extension !== priority)) invalid("Invalid STP bridge priority context.");
      const key = m[1] === "Root" ? "rootPriority" : "bridgePriority";
      duplicate(block.seen, key); block.context[key] = priority; block.section = m[1] === "Root" ? "root" : "bridge"; c.parsed++; continue;
    }
    if ((m = /^Address\s+([a-fA-F0-9]{4}\.[a-fA-F0-9]{4}\.[a-fA-F0-9]{4})$/.exec(line.text))) {
      if (!block.section || block.table) invalid("STP bridge address has no unambiguous context.");
      const key = block.section === "root" ? "rootBridge" : "localBridge";
      duplicate(block.seen, key); block.context[key] = m[1].toLowerCase(); c.parsed++; continue;
    }
    if (line.text === "This bridge is the root") {
      if (block.section !== "root" || block.table) invalid("Misplaced STP root marker.");
      duplicate(block.seen, "isRoot"); block.context.isRoot = "yes"; c.parsed++; continue;
    }
    if (/^Interface\s+Role\s+Sts\s+Cost\s+Prio\.Nbr\s+Type$/.test(line.text)) {
      duplicate(block.seen, "table"); block.table = true; block.section = undefined; c.excluded++; continue;
    }
    if (/^(?:Root ID|Bridge ID|Address\b|Spanning tree enabled|Interface\b|This bridge)/.test(line.text)) invalid("Malformed or unsupported STP context/header. No earlier context will be reused.");
    if (/^-+(?:\s+-+)+$/.test(line.text) || /^Hello Time\s+\d{1,3} sec\s+Max Age\s+\d{1,3} sec\s+Forward Delay\s+\d{1,3} sec$/.test(line.text) || /^Aging Time\s+\d{1,7}(?: sec)?$/.test(line.text)) { c.excluded++; continue; }
    if (!block.table && (/^Cost\s+\d{1,10}$/.test(line.text) || /^Port\s+\d{1,6}\s+\([A-Za-z-]+[\d/.]+\)$/.test(line.text))) { c.excluded++; continue; }
    m = /^(\S+)\s+(Root|Desg|Altn|Back|Boun)\s+(FWD|BLK|LRN|LTN|DWN|LBK|BKN\*)\s+(\d{1,10})\s+(\d{1,3})\.(\d{1,6})\s+(?:P2p|Shr)(?: Edge)?(?: Peer\(STP\))?(?: \*(?:ROOT|LOOP|PVID|TYPE)_Inc)?$/.exec(line.text);
    const name = m && iface(m[1]), cost = m ? uint(m[4], 200_000_000) : undefined;
    if (!block.table || !m || !name || cost === undefined || uint(m[5], 240) === undefined || Number(m[5]) % 16 !== 0 || uint(m[6], 65535, 1) === undefined) { c.skipped++; continue; }
    duplicate(block.seen, `port:${name}`);
    block.rows.push({ sourceLine: line.number, interface: name, role: m[2], state: m[3], cost }); c.parsed++;
  }
  finish();
  const out = base("cisco-stp", lines, rows, c);
  finding(out, "info", "Per-VLAN roles and states", "Root is a port role toward the root bridge; Desg is designated for its segment. FWD reports STP forwarding for this VLAN, not end-to-end reachability. Compare the same VLAN and capture time on other devices before inferring a path.");
  if (rows.some((r) => r.state === "BLK" || r.role === "Altn" || r.role === "Back")) finding(out, "info", "A redundant path may be non-forwarding", "Alternate/backup roles or BLK can be expected loop prevention, not a failed link. If the chosen path is unexpected, compare the reported root ID, port costs and intended design for this VLAN.");
  if (rows.some((r) => !["FWD", "BLK"].includes(String(r.state)))) finding(out, "review", "Transitional, disabled or inconsistent state observed", "A port has a state other than forwarding/blocking. Obtain another timestamped snapshot and relevant STP/interface diagnostics if the state persists; this table alone cannot identify a cause or justify disabling loop protection.");
  if (rows.some((r) => r.isRoot === "yes")) finding(out, "info", "Local root declaration", "The output explicitly reports this bridge as root for a parsed VLAN. Compare that VLAN's intended root placement if unexpected. VLANs without that declaration retain unavailable, rather than an inferred root claim.");
  out.caveats.push("Only VLAN-based ieee/rstp Role/Sts port tables are supported; MST, legacy Designated/Port-ID tables, detail and summary variants are not. Required root/bridge context must be complete. Port type, timers and non-port root-path details are not analyzed.");
  return out;
}

function parseOspf(lines: Line[]): ToolkitResult {
  const c = start(lines, "cisco-ospf"), rows: Row[] = [], seen = new Set<string>();
  for (const line of lines.slice(1)) {
    if (headers["cisco-ospf"]!.test(line.text)) invalid("Repeated OSPF headers are unsupported.");
    const m = /^(\S+)\s+(\d{1,3})\s+(DOWN|ATTEMPT|INIT|2WAY|EXSTART|EXCHANGE|LOADING|FULL)\s*\/\s*(DR|BDR|DROTHER|-)\s+(\S+)\s+(\S+)\s+(\S+)$/.exec(line.text);
    const neighbor = m && ipv4(m[1]), priority = m ? uint(m[2], 255) : undefined, dead = m ? clockSeconds(m[5]) : undefined, address = m && ipv4(m[6]), name = m && iface(m[7]);
    if (!m || !neighbor || priority === undefined || dead === undefined || !address || !name) { c.skipped++; continue; }
    duplicate(seen, `${neighbor}:${address}:${name}`);
    rows.push({ sourceLine: line.number, neighborId: neighbor, priority, state: m[3], neighborRole: m[4], deadTime: m[5], deadSeconds: dead, address, interface: name }); c.parsed++;
  }
  const out = base("cisco-ospf", lines, rows, c);
  if (rows.some((r) => r.state === "FULL")) finding(out, "info", "Full adjacency observed", "FULL reports completed OSPF database exchange with that neighbor at capture time. It does not prove a particular route is installed or traffic succeeds; obtain the relevant route entry if that is the question.");
  if (rows.some((r) => r.state === "2WAY")) finding(out, "info", "Two-way is not automatically a fault", "2WAY means bidirectional neighbor communication was recognized. DROTHER peers on a broadcast network normally need not become FULL with each other. If full adjacency was expected, obtain interface network-type and DR/BDR evidence before diagnosing a problem.");
  if (rows.some((r) => !["FULL", "2WAY"].includes(String(r.state)))) finding(out, "review", "Adjacency formation state observed", "A neighbor is reported in DOWN, ATTEMPT, INIT or a database-exchange stage rather than FULL/2WAY. A single snapshot can catch a transition. If it persists, compare timestamped neighbor output, interface timers/network type and both ends' diagnostics; no cause is established here.");
  finding(out, "info", "Dead timer is a snapshot", "Dead Time is the reported remaining neighbor timer, not latency or uptime. Even zero is preserved as observed rather than interpreted as a confirmed failure. Compare a later timestamped capture if expiration is suspected.");
  out.caveats.push("Only IPv4 Neighbor ID/Pri/State/Dead Time/Address/Interface rows with h:mm:ss dead timers are supported. Router IDs identify OSPF speakers, not verified reachable addresses. Process, area, VRF and interface network type are not established by this table.");
  return out;
}

function bgpDuration(value: string): boolean {
  return value === "never" || clockSeconds(value) !== undefined || /^(?:\d{1,5}d(?:[01]?\d|2[0-3])h|\d{1,5}w[0-6]d|\d{1,5}y(?:[0-4]?\d|5[0-2])w)$/.test(value);
}
function parseBgp(lines: Line[]): ToolkitResult {
  const c: Coverage = { parsed: 0, excluded: 0, skipped: 0 }, rows: Row[] = [], seen = new Set<string>();
  let table = false, routerId = unavailable, localAs: string | number = unavailable;
  for (const line of lines) {
    if (headers["cisco-bgp"]!.test(line.text)) { duplicate(seen, "header"); table = true; c.excluded++; continue; }
    let m: RegExpExecArray | null;
    if ((m = /^BGP router identifier (\S+), local AS number (\S+)$/.exec(line.text))) {
      if (table) invalid("BGP context appears after its neighbor table.");
      duplicate(seen, "router");
      const address = ipv4(m[1]), as = asn(m[2]);
      if (!address || as === undefined) invalid("Invalid BGP router identifier or local AS context.");
      routerId = address; localAs = as; c.parsed++; continue;
    }
    if (/^BGP router identifier|^Neighbor\b/.test(line.text)) invalid("Unsupported or incomplete BGP header/context.");
    if (/^BGP table version is \d{1,20}, main routing table version \d{1,20}$/.test(line.text)) { duplicate(seen, "version"); if (table) invalid("Repeated BGP metadata after the neighbor table is unsupported."); c.excluded++; continue; }
    if (!table && /^(?:\d+(?:\/\d+)? (?:network|path|BGP path\/bestpath attribute|BGP AS-PATH|BGP community|BGP extended community|BGP route-map cache|BGP filter-list cache) entries using \d+ bytes of memory|BGP using \d+ total bytes of memory|BGP activity \d+\/\d+ prefixes, \d+\/\d+ paths, scan interval \d+ secs)$/.test(line.text)) { c.excluded++; continue; }
    if (table && /^(?:\* Dynamically created based on a listen range command|Dynamically created neighbors: \d+\/\(\d+ max\), Subnet ranges: \d+)$/.test(line.text)) { c.excluded++; continue; }
    if (!table) invalid("Unsupported BGP preamble. Supply one IPv4 summary with its exact neighbor header.");
    m = /^(\*?)(\S+)\s+4\s+(\S+)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\S+)\s+(\d+|Idle(?: \(Admin\))?|Active|Connect|OpenSent|OpenConfirm|PfxRcd)$/.exec(line.text);
    const neighbor = m && ipv4(m[2]), remoteAs = m ? asn(m[3]) : undefined, counters = m ? m.slice(4, 9).map(counter) : [];
    if (!m || !neighbor || remoteAs === undefined || counters.some((v) => v === undefined) || !bgpDuration(m[9])) { c.skipped++; continue; }
    const prefixes = counter(m[10]), numeric = /^\d+$/.test(m[10]);
    if (numeric && prefixes === undefined) { c.skipped++; continue; }
    duplicate(seen, neighbor);
    rows.push({ sourceLine: line.number, neighbor, remoteAs, state: numeric ? "Established" : m[10], prefixesReceived: numeric ? prefixes! : unavailable, upDown: m[9], msgReceived: counters[0]!, msgSent: counters[1]!, tableVersion: counters[2]!, inQueue: counters[3]!, outQueue: counters[4]!, routerId, localAs, dynamic: m[1] ? "yes" : "not marked" }); c.parsed++;
  }
  if (!table) invalid("Missing BGP neighbor table header.");
  const out = base("cisco-bgp", lines, rows, c);
  if (rows.some((r) => r.state === "Established")) finding(out, "info", "Numeric prefix count means Established", "A numeric State/PfxRcd value reports an established session; zero is still Established with zero received prefixes. It does not prove advertised routes, installed routes or traffic delivery. If a route is expected, compare the relevant BGP/installed route evidence and intended policy.");
  if (rows.some((r) => r.state !== "Established")) finding(out, "review", "Non-established session state observed", "Idle, Active, Connect and Open states are BGP session stages, not health labels; Active does not mean established. Idle (Admin) reports administrative shutdown, while PfxRcd is a prefix-limit indicator. If establishment is intended, compare both ends' neighbor details and timestamped logs before assigning a cause.");
  if (rows.some((r) => r.inQueue !== 0 || r.outQueue !== 0)) finding(out, "review", "Queued messages observed", "A parsed input or output queue is nonzero. This is a snapshot count, not a rate or proof of congestion. Compare another timestamped summary and neighbor diagnostics if the queue remains elevated.");
  if (routerId === unavailable) finding(out, "review", "Local BGP context unavailable", "The router-identifier/local-AS line was absent. Neighbor rows are retained, but local session context cannot be inferred; obtain the full summary if it matters.");
  out.caveats.push("IPv4 single-line BGP version-4 neighbor rows only; wrapped rows are skipped, and wrapped headers, VRF/address-family blocks and detail output are unsupported. AS numbers accept asplain or asdot and are normalized to exact 32-bit asplain numbers. Unsigned counters above the safe integer limit remain decimal strings.", "Message counts are absolute, not rates. Up/Down is the reported duration string, not a timestamp. Prefix counts describe received evidence only, not advertisements, best-path selection or forwarding.");
  return out;
}

export function analyzeCiscoAdvancedOutput(input: string, profile: string): ToolkitResult {
  if (!Object.hasOwn(commands, profile)) invalid("Unsupported Cisco advanced profile.");
  const selected = profile as Profile, lines = readLines(input, selected);
  switch (selected) {
    case "cisco-vlan": return parseVlan(lines);
    case "cisco-trunk": return parseTrunk(lines);
    case "cisco-stp": return parseStp(lines);
    case "cisco-ospf": return parseOspf(lines);
    case "cisco-bgp": return parseBgp(lines);
  }
}
