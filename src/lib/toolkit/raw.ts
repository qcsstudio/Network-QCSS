import { analyzeCiscoOutput } from "./raw-cisco";
import { analyzeFortigateOutput } from "./raw-fortigate";
import { analyzeCiscoAdvancedOutput } from "./raw-cisco-advanced";
import { analyzeFortigateDiagnostics } from "./raw-fortigate-diagnostics";
import { diagnosticProfiles } from "./raw-diagnostic-catalog";
import { RawOutputError, rawInputLimit, rawProfiles } from "./raw-catalog";
import type { ToolkitOperation, ToolkitResult } from "./types";

export function prepareRawOutput(input: string): string {
  if (new TextEncoder().encode(input).byteLength > rawInputLimit) throw new RawOutputError("size");
  const text = input.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n").replace(/\x1b\[[0-9;]*m/g, "");
  const lines = text.split("\n");
  if (lines.length > 20000) throw new RawOutputError("size");
  // Independent token checks avoid scanning the remainder at every enc:/dec: token.
  const keyDump = lines.some(line => /\bkey=/i.test(line) && /\b(?:enc|dec):|\bah=\w+/i.test(line));
  if (/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(text) || /-----BEGIN [^-]*PRIVATE KEY-----/i.test(text) || keyDump) throw new RawOutputError("unsafe");
  if (!text.trim() || /--\s*more\s*--|<output truncated>|\[truncated\]|\.\.\.|\u2026/i.test(text)) throw new RawOutputError("format");
  return text;
}

function diagram(result: ToolkitResult, profile: string): ToolkitResult["visual"] {
  const diagnostic = diagnosticDiagram(result, profile);
  if (diagnostic) return diagnostic;
  const route = profile.endsWith("-route"), vpn = profile === "fortigate-vpn", performance = profile === "fortigate-performance";
  const value = (row: Record<string, string | number>, key: string) => String(row[key] ?? "Not supplied");
  const rows = result.rows.slice(0, 6);
  return {
    title: route ? "Reported route relationships" : vpn ? "Reported tunnel selectors" : performance ? "Performance snapshot" : "Interface state inventory",
    caption: `${rows.length} of ${result.rows.length} parsed records shown. ${route ? "Arrows connect fields from a route entry, not a captured packet path or verified physical topology." : "Only supplied measurements are shown; this is not a health score or live topology."} All parsed records remain in the evidence table.`,
    flow: route,
    items: rows.map((row, index) => ({ label: `Record ${index + 1}${route ? ` | ${profile === "fortigate-route" ? `VRF ${value(row, "vrf")}` : `Routing context: ${value(row, "context")}`}` : ""}`, steps: route
      ? [{ label: "Destination prefix", value: value(row, "prefix") }, { label: "Reported next hop", value: value(row, "nextHop") }, { label: "Reported interface", value: value(row, "interface") }]
      : vpn ? [{ label: "Tunnel", value: value(row, "tunnel") }, { label: "Selectors up / total", value: `${value(row, "selectorsUp")} / ${value(row, "selectorsTotal")}` }, { label: "Peer", value: value(row, "peer") }]
      : performance ? [{ label: "Measurement", value: value(row, "metric") }, { label: "Reported value", value: `${value(row, "value")} ${row.unit ?? ""}` }, { label: "Scope and window", value: `${value(row, "scope")} | ${typeof row.windowMinutes === "number" ? `${row.windowMinutes} minutes` : "Time window not supplied"}` }]
      : [{ label: "Interface", value: value(row, "interface") }, { label: "Interface state", value: value(row, "interfaceState") }, { label: "Line protocol", value: value(row, "protocolState") }]
    }))
  };
}

function diagnosticDiagram(result: ToolkitResult, profile: string): ToolkitResult["visual"] | undefined {
  if (!diagnosticProfiles.some(item => item.id === profile)) return undefined;
  const v = (row: Record<string, string | number>, key: string) => String(row[key] ?? "Not supplied");
  const rows = result.rows.slice(0, 6);
  const views: Record<string, { title: string; fields: [string, string][]; context: (r: Record<string, string | number>) => string }> = {
    "cisco-vlan": { title: "Local VLAN inventory", fields: [["Local status", "status"], ["Listed ports", "listedPorts"], ["Reported interfaces", "interfaces"]], context: r => `VLAN ${v(r, "vlan")}` },
    "cisco-trunk": { title: "Trunk VLAN evidence", fields: [["Allowed VLANs", "allowedVlans"], ["Allowed and active", "activeVlans"], ["STP forwarding, not pruned", "forwardingVlans"]], context: r => `${v(r, "interface")} | ${v(r, "status")} | Native VLAN ${v(r, "nativeVlan")}` },
    "cisco-stp": { title: "Per-VLAN spanning-tree evidence", fields: [["Interface", "interface"], ["Port role / state", "roleState"], ["Reported port cost", "cost"]], context: r => `VLAN ${v(r, "vlan")} | Root ${v(r, "rootBridge")} (${v(r, "rootPriority")}) | Local bridge ${v(r, "localBridge")} (${v(r, "bridgePriority")})` },
    "cisco-ospf": { title: "OSPF neighbour observations", fields: [["Neighbour ID", "neighborId"], ["State / role", "roleState"], ["Dead timer", "deadTime"]], context: r => `${v(r, "interface")} | Neighbour address ${v(r, "address")} | Process, area and VRF not supplied` },
    "cisco-bgp": { title: "BGP peer observations", fields: [["Neighbour", "neighbor"], ["Session state", "state"], ["Received prefixes", "prefixesReceived"]], context: r => `Router ID ${v(r, "routerId")} | Local AS ${v(r, "localAs")} | Peer AS ${v(r, "remoteAs")}` },
    "fortigate-session-stat": { title: "Session-statistic observations", fields: [["Counter", "metric"], ["Reported value", "value"], ["Unit", "unit"]], context: r => `Input line ${v(r, "line")} | Device/VDOM collection context not verified` },
    "fortigate-flow": { title: "Flow events, not a packet path", fields: [["Packet anchor source", "sourceEndpoint"], ["Packet anchor destination", "destinationEndpoint"], ["Reported event / policy", "eventPolicy"]], context: r => `Debug ${v(r, "debugId")} | Trace ${v(r, "traceId")} | VDOM ${v(r, "vdom")} | VRF ${v(r, "vrf")} | Protocol ${v(r, "protocol")} | Input line ${v(r, "line")}` },
    "fortigate-ike": { title: "IKE control-connection evidence", fields: [["Local endpoint", "localEndpoint"], ["Remote endpoint", "remoteEndpoint"], ["IKE version / state", "versionState"]], context: r => `VDOM ${v(r, "vdom")}/${v(r, "vdomId")} | Tunnel ${v(r, "tunnel")} | ${v(r, "direction")}` },
  };
  const view = views[profile];
  return {
    title: view.title, flow: false,
    caption: `${rows.length} of ${result.rows.length} parsed records shown. Each record keeps its own reported context. These are field relationships, not verified topology or end-to-end delivery. All parsed records remain in the evidence table.`,
    items: rows.map((row, index) => {
      const endpoint = (ip: string, port: string) => `${v(row, ip)}${row[port] === "not applicable" ? " (ICMP, no transport port)" : `:${v(row, port)}`}`;
      const expanded = { ...row,
        roleState: profile === "cisco-stp" ? `${v(row, "role")} / ${v(row, "state")}` : `${v(row, "state")} / ${v(row, "neighborRole")}`,
        sourceEndpoint: endpoint("sourceIP", "sourcePort"), destinationEndpoint: endpoint("destinationIP", "destinationPort"),
        eventPolicy: `${v(row, "event")} | Policy ${v(row, "policyId")}`,
        localEndpoint: endpoint("localIP", "localPort"), remoteEndpoint: endpoint("remoteIP", "remotePort"),
        versionState: `IKE ${v(row, "version")} | ${v(row, "state")}`,
      };
      return { label: `Record ${index + 1} | ${view.context(row)}`, steps: view.fields.map(([label, key]) => ({ label, value: v(expanded, key) })) };
    }),
  };
}

export const rawOperation: ToolkitOperation = {
  id: "device", name: "Device Output Lens", description: "Read selected Cisco and FortiGate command snapshots with plain-English interpretation and evidence diagrams.",
  inputLabel: "Raw command output", format: "One command snapshot as plain UTF-8 text, up to 1 MiB and 20,000 lines. Unsupported rows and fields are not guessed. Hostnames, addresses and identifiers can remain; review before sharing.",
  sample: rawProfiles[0].sample, fields: [],
  analyze(input, options) {
    const profile = rawProfiles.find(item => item.id === (options.profile ?? rawProfiles[0].id));
    if (!profile) throw new RawOutputError("format");
    const prepared = prepareRawOutput(input);
    try {
      const advanced = diagnosticProfiles.some(item => item.id === profile.id);
      const result = profile.vendor === "cisco"
        ? (advanced ? analyzeCiscoAdvancedOutput : analyzeCiscoOutput)(prepared, profile.id)
        : (advanced ? analyzeFortigateDiagnostics : analyzeFortigateOutput)(prepared, profile.id);
      const corroboratingSources: Record<string, string[]> = {
        "cisco-ospf": ["raw-cisco-ospf-2way"], "cisco-bgp": ["raw-cisco-bgp-zero"],
        "fortigate-session-stat": ["raw-fortigate-session-memory", "raw-fortigate-session-tcp"],
        "fortigate-flow": ["raw-fortigate-flow-context", "raw-fortigate-flow-permission"],
        "fortigate-ike": ["raw-fortigate-ike-connecting"],
      };
      return { ...result, sourceIds: [...result.sourceIds, ...(corroboratingSources[profile.id] ?? [])], provenance: { parserVersion: "2026-11-04-raw2", profile: profile.id, command: profile.command, scope: profile.scope }, visual: diagram(result, profile.id) };
    } catch (error) {
      if (error instanceof RawOutputError) throw error;
      throw new RawOutputError("format");
    }
  }
};
