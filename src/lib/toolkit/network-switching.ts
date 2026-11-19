import { z } from "zod";
import type { Finding, ToolkitOperation } from "./types.ts";
import { checked, collectionState, emptyOptions, identifier, networkLimits, readJson } from "./network-core.ts";

const vlan = z.number().int().min(1).max(4094);
const endpointShape = {
  mode: z.enum(["access", "trunk", "unknown"]),
  accessVlan: vlan.nullable().optional(),
  nativeVlan: vlan.nullable().optional(),
  nativeTagged: z.boolean().nullable().optional(),
  allowedVlans: z.array(vlan).max(networkLimits.allowedVlans).refine(values => new Set(values).size === values.length).nullable().optional(),
};
type Endpoint = z.infer<ReturnType<typeof endpointObject>>;
function endpointObject() { return z.object(endpointShape).strict(); }
function modeFieldsValid(endpoint: Endpoint): boolean {
  if (endpoint.mode === "access") return endpoint.nativeVlan === undefined && endpoint.nativeTagged === undefined && endpoint.allowedVlans === undefined;
  if (endpoint.mode === "trunk") return endpoint.accessVlan === undefined;
  return endpoint.accessVlan === undefined && endpoint.nativeVlan === undefined && endpoint.nativeTagged === undefined && endpoint.allowedVlans === undefined;
}
const endpointSchema = endpointObject().refine(modeFieldsValid);
const interfaceSchema = z.object({ id: identifier, ...endpointShape, peer: endpointSchema.optional() }).strict().refine(modeFieldsValid);
const switchingSchema = z.object({ collectionState, interfaces: z.array(interfaceSchema).max(networkLimits.interfaces) }).strict()
  .refine(data => new Set(data.interfaces.map(port => port.id)).size === data.interfaces.length);

function endpointUnknown(endpoint: Endpoint): boolean {
  if (endpoint.mode === "unknown") return true;
  if (endpoint.mode === "access") return endpoint.accessVlan == null;
  return endpoint.nativeVlan == null || endpoint.nativeTagged == null || endpoint.allowedVlans == null;
}

function comparePeers(local: Endpoint, peer: Endpoint): { status: string; details: string[] } {
  if (local.mode === "unknown" || peer.mode === "unknown") return { status: "Unknown", details: ["A peer mode is unknown."] };
  if (local.mode !== peer.mode) return { status: "Mixed modes: review", details: ["Access/trunk mode differs; native tagging and platform behavior require a manual review."] };
  const details: string[] = [];
  if (local.mode === "access") {
    if (local.accessVlan != null && peer.accessVlan != null && local.accessVlan !== peer.accessVlan) details.push("Access VLAN identifiers differ.");
  } else {
    if (local.nativeVlan != null && peer.nativeVlan != null && local.nativeVlan !== peer.nativeVlan) details.push("Native VLAN identifiers differ.");
    if (local.nativeTagged != null && peer.nativeTagged != null && local.nativeTagged !== peer.nativeTagged) details.push("Native VLAN tagging evidence differs.");
    if (local.allowedVlans != null && peer.allowedVlans != null) {
      const a = new Set(local.allowedVlans);
      const b = new Set(peer.allowedVlans);
      const onlyLocal = [...a].filter(v => !b.has(v)).length;
      const onlyPeer = [...b].filter(v => !a.has(v)).length;
      if (onlyLocal || onlyPeer) details.push(`Allowed VLAN sets differ: ${onlyLocal} local-only and ${onlyPeer} peer-only VLANs.`);
    }
  }
  const unknown = endpointUnknown(local) || endpointUnknown(peer);
  if (unknown) details.push("Some VLAN or native-tagging evidence is missing; no defaults were assumed.");
  return { status: details.length ? (unknown && details.length === 1 ? "Unknown" : "Differences: review") : "Supplied fields agree", details };
}

export const switchingOperation: ToolkitOperation = {
  id: "switching", name: "VLAN evidence comparison",
  description: "Review imported per-interface access/trunk VLAN evidence and optional explicitly supplied peer settings.",
  inputLabel: "Interface evidence JSON",
  format: `Strict JSON: collectionState (complete, partial, failed), interfaces (maximum ${networkLimits.interfaces}). Each interface requires a unique id (1-64 letters/digits/_.:/-, starting with a letter/digit) and mode (access, trunk, unknown). Access: optional accessVlan. Trunk: optional nativeVlan, nativeTagged boolean, allowedVlans integer array (maximum ${networkLimits.allowedVlans} entries). VLAN IDs: 1-4094, no duplicates. Omitted/null values are unknown; [] explicitly allows no VLANs. Optional peer uses the same mode/VLAN fields without id. Mode-inapplicable fields are rejected. Maximum 262144 characters.`,
  sample: JSON.stringify({ collectionState: "complete", interfaces: [
    { id: "port1", mode: "access", accessVlan: 20, peer: { mode: "access", accessVlan: 20 } },
    { id: "port2", mode: "trunk", nativeVlan: 99, nativeTagged: false, allowedVlans: [20, 30, 99],
      peer: { mode: "trunk", nativeVlan: 99, nativeTagged: false, allowedVlans: [20, 99] } },
  ] }, null, 2),
  fields: [],
  analyze(input, options) {
    checked(emptyOptions, options, "Switching options are not supported.");
    const data = readJson(switchingSchema, input, `Invalid switching JSON. Check collectionState, unique interface IDs, mode-specific VLAN fields, and the ${networkLimits.interfaces}-interface limit.`, "interfaces");
    const findings: Finding[] = [{ level: "review", title: "Operational state unknown", detail: "Imported VLAN fields do not prove link state, negotiated tagging, spanning-tree state, or packet forwarding. Only explicit peer evidence is compared." }];
    if (data.collectionState !== "complete" || !data.interfaces.length) findings.push({ level: "review", title: "Insufficient collection", detail: "The interface collection is empty, partial, or failed. No overall operational success is established." });
    let compared = 0;
    let different = 0;
    let unknown = 0;
    const rows = data.interfaces.map((port, index) => {
      const reference = `Interface ${index + 1}`;
      let peerCheck = "Not supplied";
      if (data.collectionState === "failed") {
        peerCheck = "Not evaluated";
        unknown++;
      } else {
        const missing = endpointUnknown(port);
        if (missing) findings.push({ level: "review", title: `${reference}: incomplete VLAN evidence`, detail: "Mode, access VLAN, allowed VLANs, native VLAN, or native tagging is unknown. No default VLAN or allow-all set was substituted." });
        if (missing || !port.peer || endpointUnknown(port.peer)) unknown++;
        for (const [endpoint, label] of [[port, "Local"], [port.peer, "Peer"]] as const) {
          if (endpoint?.mode !== "trunk" || endpoint.allowedVlans == null) continue;
          if (!endpoint.allowedVlans.length) findings.push({ level: "review", title: `${reference}: ${label.toLowerCase()} allowed set is empty`, detail: "The supplied allowed-VLAN set explicitly contains no VLANs. This is not a healthy-forwarding finding." });
          if (endpoint.nativeVlan != null && !endpoint.allowedVlans.includes(endpoint.nativeVlan)) findings.push({ level: "review", title: `${reference}: ${label.toLowerCase()} native VLAN outside allowed set`, detail: "The supplied native VLAN is absent from the allowed list. This can be intentional; exact platform behavior must be checked." });
        }
        if (port.peer) {
          compared++;
          const comparison = comparePeers(port, port.peer);
          peerCheck = comparison.status;
          if (comparison.status.includes("review")) different++;
          if (comparison.details.length) findings.push({ level: "review", title: `${reference}: peer comparison`, detail: comparison.details.join(" ") });
        }
      }
      const inapplicable = port.mode === "unknown" ? "Unknown" : "Not applicable";
      return { reference, mode: port.mode, accessVlan: port.mode === "access" ? port.accessVlan ?? "Unknown" : inapplicable,
        nativeVlan: port.mode === "trunk" ? port.nativeVlan ?? "Unknown" : inapplicable,
        nativeTagged: port.mode !== "trunk" ? inapplicable : port.nativeTagged == null ? "Unknown" : port.nativeTagged ? "Yes" : "No",
        allowedVlanCount: port.mode === "trunk" ? port.allowedVlans?.length ?? "Unknown" : inapplicable, peerCheck };
    });
    if (unknown) findings.push({ level: "review", title: "Peer coverage incomplete", detail: `${unknown} interface rows lack complete local/peer evidence or could not be evaluated.` });
    return {
      title: "Imported VLAN evidence", evidence: "imported",
      summary: data.collectionState === "failed" ? "Collection failed; no VLAN compatibility comparison was performed." : `${data.interfaces.length} interface rows; ${compared} explicit peer comparisons; ${different} comparisons require review. Operational forwarding remains unknown.`,
      metrics: [
        { label: "Collection state", value: data.collectionState, meaning: "Importer-declared collection status. Complete does not establish that a configuration is active." },
        { label: "Interface rows", value: data.interfaces.length, meaning: "The number of supplied interface records, not a discovered device or link count." },
        { label: "Peer comparisons", value: data.collectionState === "failed" ? "Unknown" : compared, meaning: "Comparisons made only where an explicit peer record was supplied; no physical links are inferred." },
        { label: "Comparisons requiring review", value: data.collectionState === "failed" ? "Unknown" : different, meaning: "Known field differences or mixed modes needing investigation, not a count of proven outages." },
        { label: "Incomplete interface evidence", value: data.collectionState === "failed" ? "Unknown" : unknown, meaning: "Rows with missing local fields or peer evidence. Missing VLAN data is never interpreted as VLAN 1 or an empty list." },
      ], rows, findings,
      caveats: [
        "No spanning-tree topology, root election, loop diagnosis, VLAN existence, link state, LACP negotiation, or physical topology is inferred.",
        "Peer association is asserted by the importer. Matching fields do not prove the interfaces are connected or forwarding.",
        "Native VLAN and tagging behavior is platform-specific; allowed-set differences can be intentional.",
        "Interface identifiers and full allowed-VLAN lists are omitted from report rows; input row numbers identify evidence.",
      ], sourceIds: ["stp"],
    };
  },
};
