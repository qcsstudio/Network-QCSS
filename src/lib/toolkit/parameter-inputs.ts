import ipaddr from "ipaddr.js";
import type { CaptureFilterOptions } from "./comparisons-filters";
import type { ToolkitResult, WorkspaceId } from "./types";

export type ParameterField = {
  key: string; label: string; meaning: string; type?: "text" | "number" | "select";
  unit?: string; initial?: string; choices?: { value: string; label: string }[];
};
export type ParameterGroup = { key: string; label: string; fields: ParameterField[]; minRows?: number; maxRows: number };
export type ParameterForm = { id: WorkspaceId; title: string; description: string; fields: ParameterField[]; groups: ParameterGroup[]; submitLabel: string };
export type ParameterState = { values: Record<string, string>; rows: Record<string, Record<string, string>[]> };
export type PreparedParameterInput =
  | { kind: "analyze"; id: WorkspaceId; input: string; options: Record<string, string> }
  | { kind: "filters"; filters: CaptureFilterOptions }
  | { kind: "result"; result: ToolkitResult };

const field = (key: string, label: string, meaning: string, unit?: string): ParameterField => ({ key, label, meaning, type: "text", ...(unit ? { unit } : {}) });
const numberField = (key: string, label: string, meaning: string, unit?: string, initial?: string): ParameterField => ({ ...field(key, label, meaning, unit), type: "number", ...(initial !== undefined ? { initial } : {}) });
const select = (key: string, label: string, meaning: string, entries: [string, string][], initial: string): ParameterField => ({ key, label, meaning, type: "select", choices: entries.map(([value, name]) => ({ value, label: name })), initial });
const unknownBoolean = (key: string, label: string, meaning: string) => select(key, label, meaning, [["unknown", "Unknown"], ["true", "Yes"], ["false", "No"]], "unknown");
const collection = () => select("collectionState", "Supplied set completeness", "Your assertion about this input: partial means omitted records might change the comparison. Complete does not verify a live device.", [["partial", "Partial / not established"], ["complete", "Complete supplied set"], ["failed", "Collection failed"]], "partial");
const protocols: [string, string][] = [["unknown", "Unknown"], ["tcp", "TCP"], ["udp", "UDP"], ["icmp", "ICMP (IPv4)"], ["icmpv6", "ICMPv6"]];
const protocolField = (key: string, rule = false) => select(key, "Protocol", "TCP/UDP have transport ports; ICMP does not. Unknown is not any protocol.", rule ? [...protocols, ["any", "Any protocol"]] : protocols, "unknown");
const group = (key: string, label: string, fields: ParameterField[], maxRows: number, minRows = 1): ParameterGroup => ({ key, label, fields, maxRows, minRows });
const portMeaning = "Single port 0-65535, inclusive range such as 1000-2000, or any. Blank means unknown, not zero or any.";
const endpointFields = (prefix = ""): ParameterField[] => {
  const key = (name: string) => prefix ? prefix + name[0].toUpperCase() + name.slice(1) : name;
  const label = prefix ? "Peer " : "Local ";
  return [
    select(key("mode"), `${label}mode`, "Access carries one VLAN; trunk can carry several. Unknown makes no assumption about device defaults.", [["unknown", "Unknown"], ["access", "Access"], ["trunk", "Trunk"]], "unknown"),
    numberField(key("accessVlan"), `${label}access VLAN`, "Only for access mode; VLAN identifier 1-4094. Blank is unknown."),
    numberField(key("nativeVlan"), `${label}native VLAN`, "Only for trunk mode; VLAN identifier 1-4094. Handling of untagged frames is platform-specific; blank is unknown."),
    unknownBoolean(key("nativeTagged"), `${label}native VLAN tagged`, "Only for trunk mode. Enter known configuration; no tagging default is assumed."),
    field(key("allowedVlans"), `${label}allowed VLANs`, "Only for trunk mode. Comma-separated IDs/ranges, for example 10,20-22; 1-4094. Type none for an explicitly empty set; blank means unknown. Duplicates are rejected."),
  ];
};
const encryptionNames = ["aes128-cbc", "aes192-cbc", "aes256-cbc", "aes128-gcm16", "aes192-gcm16", "aes256-gcm16"];
const integrityNames = ["none", "hmac-sha1-96", "hmac-sha256-128", "hmac-sha384-192", "hmac-sha512-256"];
const prfNames = ["hmac-sha1", "hmac-sha256", "hmac-sha384", "hmac-sha512"];
const proposalFields = (child: boolean): ParameterField[] => [
  field("encryption", "Encryption alternatives", `Comma-separated configured alternatives: ${encryptionNames.join(", ")}. Keep CBC and GCM in separate proposal rows. These are supported comparison names, not algorithm recommendations.`),
  field("integrity", "Integrity alternatives", `Comma-separated ${integrityNames.join(", ")}. Blank is unknown for CBC; GCM provides integrity itself and permits only none or blank.`),
  field("dhGroups", child ? "CHILD separate key-exchange groups" : "IKE Diffie-Hellman groups", `Comma-separated numeric group identifiers ${child ? "0" : "1"}-65535, not a strength ranking. ${child ? "0 explicitly means no separate CHILD key exchange. " : ""}Blank is unknown.`),
  child ? field("esn", "Extended sequence numbers", "Comma-separated no-esn and/or esn as configured. Blank remains unknown; no device default is inserted.") : field("prf", "Pseudorandom function alternatives", `Comma-separated ${prfNames.join(", ")}. IKE uses this for key derivation, including with GCM. Blank is unknown.`),
];
const selectorFields: ParameterField[] = [
  field("localCIDR", "Local protected subnet", "CIDR from this peer's perspective. Must share the remote address family; host bits are normalized by the existing engine."),
  field("remoteCIDR", "Remote protected subnet", "CIDR at the opposite site. Peer A local is compared with Peer B remote; no reverse selector is invented."),
  select("protocol", "Selector protocol", "Unknown leaves the comparison unresolved. Any protocol permits only full port ranges when supplied.", [["unknown", "Unknown"], ["any", "Any protocol"], ["tcp", "TCP"], ["udp", "UDP"]], "unknown"),
  field("localPorts", "Local selector ports", portMeaning), field("remotePorts", "Remote selector ports", portMeaning),
];
const sdwanMetrics = [
  { key: "latency", json: "latencyMs", label: "Latency", unit: "ms", max: 604800000, meaning: "Delay using a named method; round-trip and one-way delay differ." },
  { key: "loss", json: "lossPct", label: "Loss", unit: "%", max: 100, meaning: "Missing packets/responses using a stated denominator, not automatically application loss." },
  { key: "jitter", json: "jitterMs", label: "Jitter", unit: "ms", max: 604800000, meaning: "Delay variation using a named algorithm; RTT deviation and UDP jitter differ." },
] as const;

export const parameterForms: Partial<Record<WorkspaceId, ParameterForm>> = {
  subnet: {
    id: "subnet", title: "Calculate address ranges", description: "Calculated address sets only, not allocation or reachability measurements.", fields: [],
    groups: [group("prefixes", "Address ranges", [field("prefix", "IP address / prefix length", "IPv4 /0-32 or IPv6 /0-128 CIDR. Host bits are explicitly normalized; counts are all addresses, not available hosts.")], 128)], submitLabel: "Calculate ranges",
  },
  routing: {
    id: "routing", title: "Compare user-supplied routes", description: "Destination lookup over explicitly supplied route installation evidence. Configured routes alone do not establish installation or forwarding.",
    fields: [field("destination", "Destination IP", "One literal IPv4 or IPv6 address, not a hostname or subnet."), field("context", "Lookup context", "Exact routing-table or VRF identifier to compare; 1-64 letters/digits/_.:/-, starting with a letter or digit."), collection()],
    groups: [group("routes", "Supplied routes", [
      field("context", "Route context", "The routing table containing this route. Must be explicitly supplied; other contexts are kept separate."),
      field("prefix", "Route network / prefix length", "Canonical network CIDR with host bits cleared. A longer matching installed prefix is more specific."),
      unknownBoolean("installed", "Reported installed", "Select Yes only from actual installation evidence. A configured route is not necessarily installed; unknown is retained."),
      field("nextHop", "Next-hop IP", "Optional literal address of the next router. Blank stays unknown; reachability is not inferred."),
      field("interface", "Outgoing interface", "Optional interface identifier, not discovered by this tool. Use 1-64 letters/digits/_.:/-."),
      unknownBoolean("nextHopResolved", "Reported next-hop resolved", "Requires a supplied next hop or interface. This is your assertion, not a live probe or proof of delivery."),
      numberField("administrativeDistance", "Administrative distance", "Optional nonnegative integer. Kept as context; this lookup does not rank routes by distance."),
      numberField("metric", "Routing metric", "Optional nonnegative integer with protocol-specific meaning. Blank remains unknown; no cross-protocol ranking."),
      select("protocol", "Route origin", "Protocol reported for this route, not independently detected.", ["unknown", "connected", "static", "ospf", "bgp", "rip", "isis", "eigrp", "other"].map(v => [v, v.toUpperCase()]), "unknown"),
    ], 512)], submitLabel: "Compare supplied routes",
  },
  switching: {
    id: "switching", title: "Compare configured VLAN settings", description: "User-supplied local/peer settings only. Matching settings do not prove a link exists or forwards traffic.", fields: [collection()],
    groups: [group("interfaces", "Interface settings", [field("id", "Interface identifier", "Unique identifier per row; 1-64 letters/digits/_.:/-, starting with a letter or digit."), ...endpointFields(),
      select("includePeer", "Peer settings supplied", "Include a peer only when you know the association. This tool does not discover physical links.", [["no", "No peer evidence"], ["yes", "Explicit peer supplied"]], "no"), ...endpointFields("peer")], 128)], submitLabel: "Compare VLAN settings",
  },
  firewall: {
    id: "firewall", title: "Simulate a simplified firewall policy", description: "Configured, ordered, stateless CIDR/protocol/port rules only. No vendor runtime, NAT, state, zones or application delivery is simulated.",
    fields: [collection(), select("defaultAction", "Explicit policy default", "Action after all supplied rules. Unknown is not deny or allow; no vendor default is assumed.", [["unknown", "Unknown"], ["allow", "Allow"], ["deny", "Deny"]], "unknown"),
      field("sourceAddress", "Flow source IP", "Literal IP at this policy stage; blank means unknown, not any."), field("destinationAddress", "Flow destination IP", "Literal IP at the same policy stage. Must share the source address family when both are supplied."), protocolField("protocol"),
      numberField("sourcePort", "Flow source port", "TCP/UDP port 0-65535. Blank is unknown. Leave blank for ICMP."), numberField("destinationPort", "Flow destination port", "TCP/UDP port 0-65535. Blank is unknown. Leave blank for ICMP.")],
    groups: [group("rules", "Rules in evaluation order", [unknownBoolean("enabled", "Rule enabled", "Unknown prevents a definite match where this rule might apply."), select("action", "Rule action", "A matched terminal action in this simplified model, not a vendor policy verdict.", [["unknown", "Unknown"], ["allow", "Allow"], ["deny", "Deny"]], "unknown"),
      field("source", "Source subnet", "Canonical network CIDR or explicit any. Blank means unknown."), field("destination", "Destination subnet", "Canonical network CIDR or explicit any. Blank means unknown."), protocolField("protocol", true),
      field("sourcePorts", "Source port criteria", `${portMeaning} For any/ICMP protocols enter any.`), field("destinationPorts", "Destination port criteria", `${portMeaning} For any/ICMP protocols enter any.`)], 512)], submitLabel: "Simulate policy",
  },
  vpn: {
    id: "vpn", title: "Compare configured IKEv2 peers", description: "Compare only supplied proposal alternatives and protected ranges. No credentials, tunnel-health verdict or vendor defaults. Empty optional proposal/selector rows are omitted; partial rows must be completed.",
    fields: ["A", "B"].flatMap(peer => [
      select(`peer${peer}Version`, `Peer ${peer} IKE version`, "Only IKEv2 is supported. Unknown keeps compatibility unresolved; do not substitute IKEv1.", [["unknown", "Unknown"], ["2", "IKEv2"]], "unknown"),
      numberField(`peer${peer}IkeLifetime`, `Peer ${peer} IKE lifetime`, "Optional positive integer. IKEv2 lifetimes are independently enforced and need not match.", "seconds"),
      numberField(`peer${peer}ChildLifetime`, `Peer ${peer} CHILD lifetime`, "Optional positive integer for data security associations. Not a negotiated lifetime or tunnel uptime.", "seconds"),
    ]),
    groups: ["A", "B"].flatMap(peer => [group(`peer${peer}Ike`, `Peer ${peer} IKE proposals`, proposalFields(false), 16, 0), group(`peer${peer}Child`, `Peer ${peer} CHILD / ESP proposals`, proposalFields(true), 16, 0), group(`peer${peer}Selectors`, `Peer ${peer} protected selectors`, selectorFields, 16, 0)]), submitLabel: "Compare configured peers",
  },
  sdwan: {
    id: "sdwan", title: "Compare entered link samples", description: "Operator-defined limits and user-entered samples, not measurements made here. Methods and window durations must match for comparison; missing values remain unknown. No path is selected.",
    fields: sdwanMetrics.flatMap(m => [numberField(`${m.key}Max`, `${m.label} limit`, `${m.meaning} Required operator-defined maximum, 0-${m.max}; no universal default.`, m.unit),
      select(`${m.key}Comparison`, `${m.label} boundary`, "Choose whether equality with your entered limit passes.", [["lte", "Less than or equal"], ["lt", "Strictly less than"]], "lte"),
      field(`${m.key}Method`, `${m.label} required method`, "Required exact method label (1-120 characters). Matching labels do not independently verify an algorithm."),
      numberField(`${m.key}WindowSeconds`, `${m.label} required window`, "Required positive duration up to 604800 seconds (seven days).", "seconds")]),
    groups: [group("samples", "Samples grouped by exact link name", [
      field("link", "Link name", "Required 1-120 character label; identical names group rows into one link. Up to 16 links and 64 samples per link."),
      select("origin", "Sample origin", "User-entered is not a live measurement. Choose observed only for an actual observation you supply; this is not independently verified.", [["user-entered", "User-entered (not measured here)"], ["observed", "Observed (user-declared)"]], "user-entered"),
      field("start", "Window start", "Optional ISO timestamp with Z or explicit timezone offset, for example YYYY-MM-DDTHH:mm:ssZ; supply both endpoints or neither."),
      field("end", "Window end", "Must be after start, at most seven days later. No current time or duration is invented."),
      numberField("sampleCount", "Reported sample count", "Optional integer 1-1000000000. Missing does not become zero.", "samples"),
      field("target", "Probe target", "Optional 1-120 character target label; the tool does not contact it."), field("vantagePoint", "Observation point", "Optional 1-120 character collector/location label. No collector is inferred."),
      ...sdwanMetrics.flatMap(m => [numberField(`${m.key}Value`, `${m.label} entered value`, `${m.meaning} Optional 0-${m.max}; blank stays unknown and explicit zero is retained.`, m.unit), field(`${m.key}SampleMethod`, `${m.label} sample method`, "Optional exact method label used for this sample. Not copied from the requirement; blank stays unknown.")]),
    ], 1024)], submitLabel: "Compare entered samples",
  },
  packet: {
    id: "packet", title: "Prepare capture filters", description: "Build a capture/display filter request only. No packets are captured and no traffic observations are fabricated.",
    fields: [field("sourceIP", "Source IP", "Optional literal IP, not a hostname or CIDR. Blank adds no source restriction."), field("destinationIP", "Destination IP", "Optional literal IP of the same family. Blank adds no destination restriction."),
      select("protocol", "Protocol", "Any with a port means TCP or UDP only. ICMP has no transport ports.", [["any", "Any IP protocol"], ["tcp", "TCP"], ["udp", "UDP"], ["icmp", "ICMP (IPv4)"], ["icmp6", "ICMPv6"]], "any"),
      numberField("port", "Either endpoint port", "Optional TCP/UDP port 0-65535. Blank adds no restriction; zero is a literal port, not missing."),
      select("direction", "Endpoint direction", "Relative to the supplied endpoints, not interface ingress/egress. Both preserves paired endpoints.", [["forward", "Source to destination"], ["reverse", "Destination to source"], ["both", "Both directions"]], "both"),
      select("ipFamily", "IP family", "No family restriction still covers only IPv4/IPv6, not ARP. Supplied addresses and ICMP variant must agree.", [["any", "IPv4 or IPv6"], ["ipv4", "IPv4 only"], ["ipv6", "IPv6 only"]], "any")], groups: [], submitLabel: "Prepare filters",
  },
  performance: {
    id: "performance", title: "Plan an authorized throughput test", description: "Instructional plan, not test output. No traffic is sent. An authorized local runner or operator must execute a real test before throughput can be reported.",
    fields: [field("target", "Authorized server", "Required literal IP or DNS hostname without a URL, port or credentials. The server must be under your authorization."),
      select("protocol", "Transport", "TCP estimates achieved throughput; UDP sends a configured offered rate. Neither establishes circuit capacity by itself.", [["tcp", "TCP"], ["udp", "UDP"]], "tcp"),
      numberField("serverPort", "Server port", "Configured listening port, 1-65535; this plan does not check for a listener.", "port", "5201"),
      numberField("durationSeconds", "Planned duration", "Planned traffic duration, 1-300 seconds. This is not an elapsed observation.", "seconds", "10"),
      numberField("parallelStreams", "Parallel streams", "1-16 planned streams; additional streams increase offered load and may change the result.", "streams", "1"),
      select("direction", "Data direction", "Forward means client sends; reverse means server sends. Sender/receiver reports must remain separate.", [["forward", "Client to server"], ["reverse", "Server to client"]], "forward"),
      numberField("udpRateMbps", "UDP offered rate per stream", "Required for UDP, greater than 0 and at most 1000 Mbit/s per stream. Plan limits are not a safety guarantee; agree a maintenance window. Leave blank for TCP.", "Mbit/s")], groups: [], submitLabel: "Prepare test plan",
  },
};

export class ParameterInputError extends Error {}
const error = (label: string, reason: string): never => { throw new ParameterInputError(`${label}: ${reason}`); };
function formFor(id: WorkspaceId): ParameterForm {
  if (!Object.hasOwn(parameterForms, id)) throw new Error("No parameter form is available for this workspace.");
  return parameterForms[id]!;
}
const initialFields = (fields: ParameterField[]) => Object.fromEntries(fields.map(f => [f.key, f.initial ?? ""]));
export function initialParameterState(id: WorkspaceId): ParameterState {
  const form = formFor(id);
  return { values: initialFields(form.fields), rows: Object.fromEntries(form.groups.map(g => [g.key, Array.from({ length: Math.max(1, g.minRows ?? 0) }, () => initialFields(g.fields))])) };
}

// Keep this boundary small and browser-safe: the worker still owns analyzer/schema validation.
function plainRecord(value: unknown, allowed: string[], label: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return error(label, "expected named fields.");
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) return error(label, "unsupported object shape.");
  for (const key of Reflect.ownKeys(value)) {
    if (typeof key !== "string" || !allowed.includes(key) || !Object.hasOwn(Object.getOwnPropertyDescriptor(value, key)!, "value")) return error(label, "unsupported field.");
  }
  return value as Record<string, unknown>;
}
function prepareState(form: ParameterForm, values: ParameterState["values"], rows: ParameterState["rows"]): ParameterState {
  let characters = 0;
  const normalize = (value: unknown, fields: ParameterField[], label: string): Record<string, string> => {
    const record = plainRecord(value, fields.map(f => f.key), label);
    return Object.fromEntries(fields.map(f => {
      const raw = Object.hasOwn(record, f.key) ? record[f.key] : f.initial ?? "";
      if (typeof raw !== "string" || raw.length > 24576 || /[\u0000-\u001f\u007f]/.test(raw)) return error(f.label, "use a bounded single-line text value.");
      characters += raw.length;
      if (characters > 262144) return error("Parameters", "input exceeds the local form budget.");
      const text = raw.trim();
      if (/-----BEGIN [^-]*PRIVATE KEY-----|\b(?:password|passwd|psk|secret|token|authorization|api[-_ ]?key)[\s"']*[:=]/i.test(text)) return error(f.label, "do not enter credentials or secret assignments.");
      if (f.type === "select" && !f.choices?.some(c => c.value === text)) return error(f.label, "select a supported value.");
      return [f.key, text];
    }));
  };
  const normalizedValues = normalize(values, form.fields, "Parameters");
  const suppliedRows = plainRecord(rows, form.groups.map(g => g.key), "Groups");
  const normalizedRows = Object.fromEntries(form.groups.map(g => {
    const entries = Object.hasOwn(suppliedRows, g.key) ? suppliedRows[g.key] : [];
    if (!Array.isArray(entries) || entries.length < (g.minRows ?? 0) || entries.length > g.maxRows) return error(g.label, `supply ${g.minRows ?? 0}-${g.maxRows} rows.`);
    return [g.key, Array.from(entries, (r, i) => normalize(r, g.fields, `${g.label} row ${i + 1}`))];
  }));
  return { values: normalizedValues, rows: normalizedRows };
}
function required(value: string, label: string, max = 120): string {
  if (!value || value.length > max) return error(label, `supply 1-${max} characters.`);
  return value;
}
function numeric(value: string, label: string, min: number, max: number, integer = true, mandatory = false): number | undefined {
  if (!value) { if (mandatory) return error(label, "a number is required."); return undefined; }
  if (!(integer ? /^(0|[1-9][0-9]*)$/ : /^(?:0|[1-9][0-9]*)(?:\.[0-9]+)?$/).test(value)) return error(label, integer ? "use a whole decimal number." : "use a finite nonnegative decimal number.");
  const number = Number(value);
  if (!Number.isFinite(number) || number < min || number > max || (integer && !Number.isSafeInteger(number))) return error(label, `use a number from ${min} to ${max}.`);
  return number;
}
const bool = (value: string) => value === "unknown" ? null : value === "true";
const known = (value: string) => value === "unknown" || !value ? null : value;
function identifier(value: string, label: string): string {
  if (!/^[A-Za-z0-9][A-Za-z0-9_.:/-]{0,63}$/.test(value)) return error(label, "use a 1-64 character identifier starting with a letter or digit.");
  return value;
}
function address(value: string, label: string) {
  try {
    if (!value || value.length > 45 || !/^[0-9a-fA-F:.]+$/.test(value)) throw new Error();
    const v4 = (v: string) => /^(0|[1-9][0-9]{0,2})(\.(0|[1-9][0-9]{0,2})){3}$/.test(v) && ipaddr.IPv4.isValidFourPartDecimal(v);
    if (!value.includes(":")) { if (!v4(value)) throw new Error(); }
    else {
      const groups = value.split(":");
      if (value.includes(".") && !v4(groups.pop()!)) throw new Error();
      if (groups.some(g => !/^[0-9a-f]{0,4}$/i.test(g))) throw new Error();
    }
    // Preserve IPv4-compatible IPv6 bits instead of ipaddr's mapped-address rewrite.
    return ipaddr.parse(/^::[0-9.]+$/.test(value) ? `::0:${value.slice(2)}` : value);
  } catch { return error(label, "use a literal dotted-decimal IPv4 or IPv6 address without a zone."); }
}
function cidr(value: string, label: string, canonical = false): string {
  const parts = value.split("/");
  if (parts.length !== 2) return error(label, "supply an address with a prefix length.");
  const ip = address(parts[0], label);
  const width = ip.kind() === "ipv4" ? 32 : 128;
  const bits = numeric(parts[1], label, 0, width, true, true)!;
  if (canonical) {
    const bytes = ip.toByteArray().reduce((n, b) => (n << 8n) | BigInt(b), 0n);
    if (bytes % (1n << BigInt(width - bits)) !== 0n) return error(label, "use a canonical network prefix with host bits cleared.");
  }
  return value;
}
function compatibleFamily(source: string, destination: string, protocol: string, label: string, family = "any") {
  const families = [source ? address(source.split("/")[0], label).kind() : undefined, destination ? address(destination.split("/")[0], label).kind() : undefined,
    family === "any" ? undefined : family, protocol === "icmp" ? "ipv4" : ["icmpv6", "icmp6"].includes(protocol) ? "ipv6" : undefined].filter(Boolean);
  if (new Set(families).size > 1) return error(label, "address families and protocol must agree.");
}
function range(value: string, label: string): { start: number; end: number } | undefined {
  if (!value) return undefined;
  if (value === "any") return { start: 0, end: 65535 };
  const parts = value.split("-");
  if (parts.length > 2) return error(label, "use a single port, an inclusive range, or any.");
  const start = numeric(parts[0].trim(), label, 0, 65535, true, true)!;
  const end = parts.length === 1 ? start : numeric(parts[1].trim(), label, 0, 65535, true, true)!;
  if (end < start) return error(label, "range end must not be below its start.");
  return { start, end };
}
function vlans(value: string): number[] | undefined {
  if (!value) return undefined;
  if (value === "none") return [];
  const result = new Set<number>();
  const parts = value.split(",");
  if (parts.length > 4094) return error("Allowed VLANs", "too many entries.");
  for (const part of parts) {
    const limits = part.trim().split("-");
    if (limits.length > 2) return error("Allowed VLANs", "use comma-separated IDs or ranges.");
    const start = numeric(limits[0].trim(), "Allowed VLANs", 1, 4094, true, true)!;
    const end = limits.length === 1 ? start : numeric(limits[1].trim(), "Allowed VLANs", 1, 4094, true, true)!;
    if (end < start) return error("Allowed VLANs", "range end must not be below its start.");
    for (let id = start; id <= end; id++) {
      if (result.has(id)) return error("Allowed VLANs", "duplicate or overlapping entries are unsupported.");
      result.add(id);
    }
  }
  return [...result];
}
function endpoint(row: Record<string, string>, prefix = "") {
  const get = (name: string) => row[prefix ? prefix + name[0].toUpperCase() + name.slice(1) : name];
  const mode = get("mode");
  const accessVlan = numeric(get("accessVlan"), "Access VLAN", 1, 4094);
  const nativeVlan = numeric(get("nativeVlan"), "Native VLAN", 1, 4094);
  const allowedVlans = vlans(get("allowedVlans"));
  const nativeTagged = bool(get("nativeTagged"));
  if (mode !== "access" && accessVlan !== undefined || mode !== "trunk" && (nativeVlan !== undefined || nativeTagged !== null || allowedVlans !== undefined)) return error("VLAN settings", "clear fields that do not apply to the selected mode.");
  return { mode, ...(accessVlan !== undefined ? { accessVlan } : {}), ...(nativeVlan !== undefined ? { nativeVlan } : {}), ...(allowedVlans !== undefined ? { allowedVlans } : {}), ...(nativeTagged !== null ? { nativeTagged } : {}) };
}
function commaList(value: string, label: string): string[] | undefined {
  if (!value) return undefined;
  const entries = value.split(",").map(v => v.trim());
  if (entries.length > 16 || entries.some(v => !v)) return error(label, "supply 1-16 comma-separated alternatives without empty entries.");
  if (new Set(entries).size !== entries.length) return error(label, "remove duplicate alternatives.");
  return entries;
}
function alternatives(value: string, allowed: string[], label: string): string[] | undefined {
  const entries = commaList(value, label);
  if (entries?.some(v => !allowed.includes(v))) return error(label, "use the supported configured names listed in this field.");
  return entries;
}
const activeRows = (rows: Record<string, string>[]) => rows.filter(row => Object.entries(row).some(([key, value]) => value !== "" && !(key === "protocol" && value === "unknown")));
function proposal(row: Record<string, string>, child: boolean) {
  const encryption = alternatives(row.encryption, encryptionNames, "Encryption");
  if (!encryption) return error("Encryption", "supply encryption alternatives for each nonempty proposal.");
  const integrity = alternatives(row.integrity, integrityNames, "Integrity");
  const aead = encryption.some(e => e.endsWith("-gcm16"));
  const cbc = encryption.some(e => e.endsWith("-cbc"));
  if (aead && cbc || aead && integrity?.some(i => i !== "none") || cbc && integrity?.includes("none")) return error("Proposal", "separate CBC and GCM; CBC requires separate integrity, while GCM permits none or blank.");
  const dhGroups = commaList(row.dhGroups, "DH groups")?.map(v => numeric(v, "DH groups", child ? 0 : 1, 65535, true, true)!);
  const esn = child ? alternatives(row.esn, ["no-esn", "esn"], "ESN") : undefined;
  const prf = child ? undefined : alternatives(row.prf, prfNames, "PRF");
  return { encryption, ...(integrity ? { integrity } : {}), ...(dhGroups ? { dhGroups } : {}), ...(esn ? { esn } : {}), ...(prf ? { prf } : {}) };
}
function selector(row: Record<string, string>) {
  const localCIDR = cidr(row.localCIDR, "Local protected subnet");
  const remoteCIDR = cidr(row.remoteCIDR, "Remote protected subnet");
  compatibleFamily(localCIDR, remoteCIDR, row.protocol, "Selector");
  const localPorts = range(row.localPorts, "Local selector ports"), remotePorts = range(row.remotePorts, "Remote selector ports");
  if (row.protocol === "any" && [localPorts, remotePorts].some(r => r && (r.start !== 0 || r.end !== 65535))) return error("Selector", "any protocol supports only full port ranges when supplied.");
  return { localCIDR, remoteCIDR, ...(row.protocol !== "unknown" ? { protocol: row.protocol } : {}), ...(localPorts ? { localPorts } : {}), ...(remotePorts ? { remotePorts } : {}) };
}
function timestamp(value: string, label: string): number {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(Z|[+-]\d{2}:?\d{2})$/.exec(value);
  const milliseconds = Date.parse(value);
  if (!match || !Number.isFinite(milliseconds)) return error(label, "use a valid ISO timestamp with seconds and timezone.");
  const [, year, month, day, hour, minute, second, zone] = match;
  const y = Number(year), m = Number(month), d = Number(day);
  const leap = y % 4 === 0 && (y % 100 !== 0 || y % 400 === 0);
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  if (m < 1 || m > 12 || d < 1 || d > days[m - 1] || Number(hour) > 23 || Number(minute) > 59 || Number(second) > 59 || zone !== "Z" && (Number(zone.slice(1, 3)) > 23 || Number(zone.slice(-2)) > 59)) return error(label, "timestamp components are out of range.");
  return milliseconds;
}
function analyzeRequest(id: WorkspaceId, value: unknown, options: Record<string, string> = {}): PreparedParameterInput {
  const input = JSON.stringify(value);
  const max = id === "vpn" || id === "sdwan" ? 131072 : 262144;
  if (input.length > max) return error("Parameters", "prepared document exceeds this analyzer's local input budget; reduce the supplied set.");
  return { kind: "analyze", id, input, options };
}

export function prepareParameterInput(workspace: WorkspaceId, values: ParameterState["values"], rows: ParameterState["rows"]): PreparedParameterInput {
  const state = prepareState(formFor(workspace), values, rows);
  const v = state.values, r = state.rows;
  if (workspace === "subnet") return analyzeRequest(workspace, { prefixes: r.prefixes.map(row => cidr(row.prefix, "Address range")) });
  if (workspace === "routing") {
    address(v.destination, "Destination IP"); identifier(v.context, "Lookup context");
    const routes = r.routes.map(row => {
      identifier(row.context, "Route context"); cidr(row.prefix, "Route prefix", true);
      if (row.nextHop) address(row.nextHop, "Next-hop IP");
      if (row.interface) identifier(row.interface, "Interface");
      if (row.nextHopResolved !== "unknown" && !row.nextHop && !row.interface) return error("Next-hop resolution", "supply a next hop or interface before asserting resolution.");
      const administrativeDistance = numeric(row.administrativeDistance, "Administrative distance", 0, Number.MAX_SAFE_INTEGER);
      const metric = numeric(row.metric, "Routing metric", 0, Number.MAX_SAFE_INTEGER);
      return { context: row.context, prefix: row.prefix, installed: bool(row.installed),
        ...(row.nextHop ? { nextHop: row.nextHop } : {}), ...(row.interface ? { interface: row.interface } : {}),
        ...(row.nextHopResolved !== "unknown" ? { nextHopResolved: bool(row.nextHopResolved) } : {}),
        ...(administrativeDistance !== undefined ? { administrativeDistance } : {}), ...(metric !== undefined ? { metric } : {}), protocol: row.protocol };
    });
    return analyzeRequest(workspace, { collectionState: v.collectionState, routes }, { destination: v.destination, context: v.context });
  }
  if (workspace === "switching") {
    const seen = new Set<string>();
    const interfaces = r.interfaces.map(row => {
      const id = identifier(row.id, "Interface identifier");
      if (seen.has(id)) return error("Interface identifier", "each row must have a unique identifier.");
      seen.add(id);
      const local = endpoint(row), peer = endpoint(row, "peer");
      if (row.includePeer === "no" && (peer.mode !== "unknown" || Object.keys(peer).length > 1)) return error("Peer settings", "enable explicit peer evidence or clear the peer fields.");
      return { id, ...local, ...(row.includePeer === "yes" ? { peer } : {}) };
    });
    return analyzeRequest(workspace, { collectionState: v.collectionState, interfaces });
  }
  if (workspace === "firewall") {
    if (!r.rules.some(row => Object.values(row).some(value => value !== "" && value !== "unknown"))) return error("Policy rules", "supply at least one rule field; empty placeholder rows are not policy evidence.");
    for (const key of ["sourceAddress", "destinationAddress"]) if (v[key]) address(v[key], "Flow IP");
    for (const key of ["sourcePort", "destinationPort"]) numeric(v[key], "Flow port", 0, 65535);
    compatibleFamily(v.sourceAddress, v.destinationAddress, v.protocol, "Flow");
    if (["icmp", "icmpv6"].includes(v.protocol) && (v.sourcePort || v.destinationPort)) return error("Flow ports", "ICMP does not use transport ports; leave them blank.");
    const rules = r.rules.map(row => {
      const source = row.source ? row.source === "any" ? "any" : cidr(row.source, "Rule source", true) : null;
      const destination = row.destination ? row.destination === "any" ? "any" : cidr(row.destination, "Rule destination", true) : null;
      compatibleFamily(source === "any" ? "" : source ?? "", destination === "any" ? "" : destination ?? "", row.protocol, "Rule");
      const ports = (value: string) => {
        const parsed = range(value, "Rule ports");
        return value === "any" ? "any" : !parsed ? null : parsed.start === parsed.end ? parsed.start : { from: parsed.start, to: parsed.end };
      };
      const sourcePorts = ports(row.sourcePorts), destinationPorts = ports(row.destinationPorts);
      if (["any", "icmp", "icmpv6"].includes(row.protocol) && (sourcePorts !== "any" || destinationPorts !== "any")) return error("Rule ports", "enter any for both port criteria when using any/ICMP protocol.");
      return { enabled: bool(row.enabled), action: known(row.action), source, destination, protocol: known(row.protocol), sourcePorts, destinationPorts };
    });
    return analyzeRequest(workspace, { collectionState: v.collectionState, defaultAction: known(v.defaultAction), rules }, Object.fromEntries(["sourceAddress", "destinationAddress", "protocol", "sourcePort", "destinationPort"].map(key => [key, v[key]])));
  }
  if (workspace === "vpn") {
    const peers = Object.fromEntries(["A", "B"].map(peer => {
      const key = `peer${peer}`;
      const ikeProposals = activeRows(r[`${key}Ike`]).map(row => proposal(row, false));
      const childProposals = activeRows(r[`${key}Child`]).map(row => proposal(row, true));
      const selectors = activeRows(r[`${key}Selectors`]).map(selector);
      const ikeLifetimeSeconds = numeric(v[`${key}IkeLifetime`], "IKE lifetime", 1, Number.MAX_SAFE_INTEGER);
      const childLifetimeSeconds = numeric(v[`${key}ChildLifetime`], "CHILD lifetime", 1, Number.MAX_SAFE_INTEGER);
      return [key, { ...(v[`${key}Version`] === "2" ? { ikeVersion: 2 } : {}), ...(ikeProposals.length ? { ikeProposals } : {}), ...(childProposals.length ? { childProposals } : {}), ...(selectors.length ? { selectors } : {}), ...(ikeLifetimeSeconds !== undefined ? { ikeLifetimeSeconds } : {}), ...(childLifetimeSeconds !== undefined ? { childLifetimeSeconds } : {}) }];
    }));
    if (!Object.values(peers).some(peer => Object.keys(peer).length)) return error("VPN settings", "supply at least one configured peer field; empty input is not evidence.");
    return analyzeRequest(workspace, peers);
  }
  if (workspace === "sdwan") {
    const thresholds = Object.fromEntries(sdwanMetrics.map(m => {
      const windowSeconds = numeric(v[`${m.key}WindowSeconds`], `${m.label} required window`, 0, 604800, false, true)!;
      if (windowSeconds === 0) return error("Required window", "duration must be greater than zero.");
      return [m.json, { max: numeric(v[`${m.key}Max`], `${m.label} limit`, 0, m.max, false, true), comparison: v[`${m.key}Comparison`], method: required(v[`${m.key}Method`], `${m.label} required method`), windowSeconds }];
    }));
    const links = new Map<string, Record<string, unknown>[]>();
    for (const row of r.samples) {
      const name = required(row.link, "Link name");
      const sample: Record<string, unknown> = { origin: row.origin };
      if (row.start || row.end) {
        const duration = (timestamp(row.end, "Window end") - timestamp(row.start, "Window start")) / 1000;
        if (duration <= 0 || duration > 604800) return error("Sample window", "end must be after start and no more than seven days later.");
        sample.window = { start: row.start, end: row.end };
      }
      const sampleCount = numeric(row.sampleCount, "Sample count", 1, 1000000000);
      if (sampleCount !== undefined) sample.sampleCount = sampleCount;
      for (const key of ["target", "vantagePoint"]) if (row[key]) sample[key] = required(row[key], "Sample metadata");
      for (const m of sdwanMetrics) {
        const value = numeric(row[`${m.key}Value`], `${m.label} value`, 0, m.max, false);
        const method = row[`${m.key}SampleMethod`];
        if (method) required(method, `${m.label} sample method`);
        if (value !== undefined || method) sample[m.json] = { ...(value !== undefined ? { value } : {}), ...(method ? { method } : {}) };
      }
      const samples = links.get(name) ?? [];
      samples.push(sample); links.set(name, samples);
      if (samples.length > 64 || links.size > 16) return error("Samples", "use at most 16 distinct links and 64 samples per link.");
    }
    return analyzeRequest(workspace, { thresholds, links: [...links].map(([name, samples]) => ({ name, samples })) });
  }
  if (workspace === "packet") {
    if (v.sourceIP) address(v.sourceIP, "Source IP");
    if (v.destinationIP) address(v.destinationIP, "Destination IP");
    compatibleFamily(v.sourceIP, v.destinationIP, v.protocol, "Capture filter", v.ipFamily);
    const port = numeric(v.port, "Capture port", 0, 65535);
    if (["icmp", "icmp6"].includes(v.protocol) && port !== undefined) return error("Capture port", "ICMP has no transport port.");
    return { kind: "filters", filters: { protocol: v.protocol as CaptureFilterOptions["protocol"], direction: v.direction as CaptureFilterOptions["direction"], ipFamily: v.ipFamily as CaptureFilterOptions["ipFamily"], ...(v.sourceIP ? { sourceIP: v.sourceIP } : {}), ...(v.destinationIP ? { destinationIP: v.destinationIP } : {}), ...(port !== undefined ? { port } : {}) } };
  }
  if (workspace === "performance") {
    required(v.target, "Authorized server", 253);
    if (v.target.includes(":") || /^[0-9.]+$/.test(v.target)) address(v.target, "Authorized server");
    else if (!v.target.split(".").every(label => /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i.test(label))) return error("Authorized server", "use a literal IP or hostname without URL syntax, credentials or shell characters.");
    const port = numeric(v.serverPort, "Server port", 1, 65535, true, true)!;
    const duration = numeric(v.durationSeconds, "Duration", 1, 300, true, true)!;
    const streams = numeric(v.parallelStreams, "Parallel streams", 1, 16, true, true)!;
    const rate = numeric(v.udpRateMbps, "UDP offered rate", 0, 1000, false, v.protocol === "udp");
    if (v.protocol === "udp" && rate === 0) return error("UDP offered rate", "rate must be greater than zero.");
    if (v.protocol === "tcp" && rate !== undefined) return error("UDP offered rate", "leave blank for a TCP plan.");
    const forward = v.direction === "forward";
    return { kind: "result", result: {
      title: "Planned throughput test (not executed)", evidence: "simulated",
      summary: `User-configured ${v.protocol.toUpperCase()} plan only. No connection, packets, throughput, loss or jitter have been measured.`,
      metrics: [{ label: "Planned duration", value: duration, unit: "seconds", meaning: "Requested traffic duration, not a measured elapsed interval." }, { label: "Planned streams", value: streams, meaning: "Configured parallel streams; not observed connections." }, { label: "Measured throughput", value: "Unknown", unit: "Mbit/s", meaning: "No test has run. Unknown is not zero throughput." }],
      rows: [{ step: "Authorize", action: "Confirm ownership/permission for both endpoints and agree a traffic window and rate budget." },
        { step: "Prepare", action: `Use a compatible iperf3 client/server pair. Configured server: ${v.target}, port ${port}. A listener and path have not been verified.` },
        { step: "Execute separately", action: `${forward ? "Client sends to server" : "Server sends to client"}; ${v.protocol.toUpperCase()}, ${streams} stream(s), ${duration} seconds.${rate !== undefined ? ` UDP offered rate is ${rate} Mbit/s per stream (${rate * streams} Mbit/s planned total), not achieved throughput.` : " TCP offered load is not capped by this plan."}` },
        { step: "Collect", action: "Save the actual unidirectional iperf3 -J report. Keep sender/receiver summaries separate and retain collection errors, warm-up omissions and test conditions." }],
      findings: [{ level: "review", title: "Instructional plan only", detail: "No runner was invoked. Throughput testing can saturate links; confirm explicit authorization and a suitable traffic budget before execution." }],
      caveats: ["Planning limits are UI guardrails, not proof of a safe load or device capacity.", "No test software or version is claimed to be installed. Use actual output in optional analysis after execution; never substitute this plan for measurement evidence."],
      sourceIds: ["iperf"], visual: { title: "Planned data direction", caption: "Configured roles only; this diagram does not depict live packet movement or measured delivery.", flow: false, items: [{ label: "Authorized test (not run)", steps: [{ label: forward ? "Client" : "Server", value: "Planned sender" }, { label: "Path", value: "Unverified" }, { label: forward ? "Server" : "Client", value: "Planned receiver" }] }] },
    } };
  }
  throw new Error("No parameter adapter is available for this workspace.");
}
