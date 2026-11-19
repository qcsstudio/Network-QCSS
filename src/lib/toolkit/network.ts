import { z } from "zod";
import type { Finding, ToolkitOperation, ToolkitResult } from "./types.ts";
import {
  addressSchema, checked, collectionState, emptyOptions, exactUnion, formatAddress,
  identifier, matches, networkLimits, networkPrefixSchema, overlaps, parseAddress, parsePrefix,
  prefixSchema, readJson,
} from "./network-core.ts";
import { firewallOperation } from "./network-firewall.ts";
import { switchingOperation } from "./network-switching.ts";

const subnetSchema = z.object({ prefixes: z.array(prefixSchema).min(1).max(networkLimits.prefixes) }).strict();
const subnetOperation: ToolkitOperation = {
  id: "subnet",
  name: "Subnet ranges and exact union",
  description: "Calculate IPv4 and IPv6 address ranges, overlap, and an exact CIDR union locally.",
  inputLabel: "CIDR set JSON",
  format: `Strict JSON: {"prefixes":["192.0.2.10/25","192.0.2.128/25","2001:db8::/64"]}. Maximum ${networkLimits.prefixes} prefixes and 262144 characters. Host bits are explicitly normalized.`,
  sample: JSON.stringify({ prefixes: ["192.0.2.10/25", "192.0.2.64/26", "192.0.2.128/25", "2001:db8::/64"] }, null, 2),
  fields: [],
  analyze(input, options) {
    checked(emptyOptions, options, "Subnet options are not supported.");
    const data = readJson(subnetSchema, input, `Invalid subnet JSON. Supply only prefixes with 1-${networkLimits.prefixes} valid CIDRs.`, "prefixes");
    const prefixes = data.prefixes.map(parsePrefix);
    const union = exactUnion(prefixes);
    let pairs = 0;
    const rows: ToolkitResult["rows"] = prefixes.map((p, i) => {
      const related = prefixes.flatMap((other, j) => {
        if (i === j || !overlaps(p, other)) return [];
        if (i < j) pairs++;
        return [`Prefix ${j + 1}`];
      });
      return { type: "Input range", reference: `Prefix ${i + 1}`, family: p.family,
        canonical: p.canonical, first: formatAddress(p.first, p.width), last: formatAddress(p.last, p.width),
        addresses: p.count.toString(), hostBitsCleared: p.hostBits ? "Yes" : "No",
        overlaps: related.join(", ") || "None in supplied set" };
    });
    rows.push(...union.map((p, i) => ({ type: "Exact union", reference: `Union ${i + 1}`,
      family: p.family, canonical: p.canonical, first: formatAddress(p.first, p.width),
      last: formatAddress(p.last, p.width), addresses: p.count.toString(), hostBitsCleared: "Not applicable", overlaps: "Disjoint union" })));
    const normalized = prefixes.filter(p => p.hostBits).length;
    return {
      title: "Exact subnet calculation", evidence: "calculated",
      summary: `${prefixes.length} supplied prefixes form ${union.length} exact union prefixes; ${pairs} overlapping pairs. No additional addresses were included.`,
      metrics: [
        { label: "Input prefixes", value: prefixes.length, meaning: "The number of CIDR entries supplied, including duplicates." },
        { label: "Overlapping pairs", value: pairs, meaning: "Two entries overlap when they contain at least one identical address in the same address family." },
        { label: "Exact union prefixes", value: union.length, meaning: "A non-overlapping CIDR set covering exactly the input addresses, with no added gaps." },
        ...(["ipv4", "ipv6"] as const).map(family => ({ label: `${family === "ipv4" ? "IPv4" : "IPv6"} unique addresses`,
          value: union.filter(p => p.family === family).reduce((total, p) => total + p.count, 0n).toString(), unit: "addresses",
          meaning: "Exact mathematical address count after removing overlap; not a usable-host or available-address count." })),
      ], rows,
      findings: [
        { level: pairs ? "review" : "info", title: "Address-set overlap", detail: pairs ? `${pairs} overlapping pairs are identified by input position. Overlap is not automatically a conflict across separate routing contexts.` : "No overlapping prefixes occur in this supplied set." },
        { level: normalized ? "review" : "info", title: "Host-bit normalization", detail: `${normalized} input prefixes had host bits cleared; each change is marked in the range rows.` },
      ],
      caveats: [
        "Counts include every address: /31 has two and /32 has one. Address usability depends on topology and allocation policy.",
        "IPv6 has no broadcast address. No subtraction for network or broadcast addresses is applied to either family.",
        "IPv4-mapped IPv6 remains IPv6; it is not merged with IPv4. Zone identifiers are unsupported.",
        "Calculated address ranges are intentionally visible in this result; review them before export. No raw input document is included.",
        "No allocation, device state, route installation, or reachability has been checked.",
      ], sourceIds: ["cidr", "ipv6"],
    };
  },
};

const routeSchema = z.object({
  context: identifier,
  prefix: networkPrefixSchema,
  installed: z.boolean().nullable(),
  nextHop: addressSchema.nullable().optional(),
  interface: identifier.nullable().optional(),
  nextHopResolved: z.boolean().nullable().optional(),
  administrativeDistance: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER).nullable().optional(),
  metric: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER).nullable().optional(),
  protocol: z.enum(["connected", "static", "ospf", "bgp", "rip", "isis", "eigrp", "other", "unknown"]).optional(),
}).strict().refine(route => route.nextHopResolved == null || route.nextHop != null || route.interface != null);
const routingSchema = z.object({ collectionState, routes: z.array(routeSchema).max(networkLimits.routes) }).strict();
const routingOptions = z.object({ destination: addressSchema, context: identifier }).strict();

const routingOperation: ToolkitOperation = {
  id: "routing", name: "Installed-route lookup",
  description: "Find the longest matching prefix among supplied installed routes in one routing context.",
  inputLabel: "Route-table JSON",
  format: `Strict JSON: collectionState (complete, partial, failed) and routes (maximum ${networkLimits.routes}). Each route requires context, canonical prefix, installed (true/false/null). Optional nextHop, interface, nextHopResolved, administrativeDistance, metric, protocol. Null or omitted optional evidence remains unknown. Context and interface identifiers: 1-64 letters/digits/_.:/-, starting with a letter/digit. Maximum 262144 characters.`,
  sample: JSON.stringify({ collectionState: "complete", routes: [
    { context: "lab", prefix: "0.0.0.0/0", installed: true, nextHop: "192.0.2.1", administrativeDistance: 1, metric: 0 },
    { context: "lab", prefix: "198.51.100.0/24", installed: true, nextHop: "192.0.2.2", administrativeDistance: 110, metric: 20 },
    { context: "other", prefix: "198.51.100.20/32", installed: true, interface: "port3" },
  ] }, null, 2),
  fields: [
    { key: "destination", label: "Destination IP address", meaning: "The single address to look up; it is not a prefix or hostname.", type: "text", initial: "198.51.100.20" },
    { key: "context", label: "Routing context", meaning: "Only routes with this exact context identifier are compared. A context can represent one virtual routing table.", type: "text", initial: "lab" },
  ],
  analyze(input, options) {
    const query = checked(routingOptions, options, "Invalid routing options. Supply only a valid destination address and context identifier.");
    const data = readJson(routingSchema, input, `Invalid route-table JSON. Check collectionState, route fields, canonical CIDRs, and the ${networkLimits.routes}-route limit.`, "routes");
    const destination = parseAddress(query.destination);
    const evaluated = data.routes.map((route, index) => {
      const prefix = parsePrefix(route.prefix);
      return { route, prefix, index, matching: route.context === query.context && matches(destination, prefix) };
    });
    const candidates = data.collectionState === "failed" ? [] : evaluated.filter(r => r.matching && r.route.installed === true);
    const best = candidates.length ? Math.max(...candidates.map(r => r.prefix.bits)) : null;
    const selected = candidates.filter(r => r.prefix.bits === best);
    const uncertain = evaluated.filter(r => r.matching && r.route.installed === null && (best === null || r.prefix.bits >= best));
    const indeterminate = data.collectionState !== "complete" || uncertain.length > 0;
    const selection = indeterminate ? "Indeterminate" : selected.length ? "Longest supplied match" : "No supplied match";
    const findings: Finding[] = [{ level: "review", title: "Forwarding is unverified", detail: "This is a destination lookup over an imported installed-route snapshot, not BGP best-path selection or proof of packet delivery. Next-hop recursion and forwarding-table programming are not tested." }];
    if (data.collectionState !== "complete") findings.push({ level: "review", title: "Incomplete collection", detail: data.collectionState === "failed" ? "Collection failed; no supplied route is used to select a path." : "The snapshot is partial; an omitted route could change the selection." });
    if (!data.routes.length || !candidates.length) findings.push({ level: "review", title: "No supplied installed match", detail: "No usable matching installed route was established from this input. This does not establish that the live device lacks a route." });
    if (uncertain.length) findings.push({ level: "review", title: "Installation state unknown", detail: `${uncertain.length} matching entries with unknown installation state could change or add to the longest-prefix result.` });
    if (selected.length > 1) findings.push({ level: "review", title: "Equal-prefix candidates retained", detail: `${selected.length} supplied installed entries share the longest matching prefix. They are not ranked by distance or metric; ECMP and per-flow selection are not verified.` });
    if (selected.some(r => r.route.nextHopResolved !== true)) findings.push({ level: "review", title: "Next-hop evidence incomplete", detail: "At least one candidate has missing or negative next-hop resolution evidence. No recursive resolution is performed here." });
    return {
      title: "Installed-route lookup", evidence: "imported",
      summary: `${selection}. The lookup is scoped to the supplied context and destination address family.`,
      metrics: [
        { label: "Collection state", value: data.collectionState, meaning: "The collection status asserted by the importer, not independently verified by this tool." },
        { label: "Selection", value: selection, meaning: "The longest prefix is the most specific supplied installed address range containing the destination." },
        { label: "Longest supplied prefix", value: best ?? "Unknown", unit: "bits", meaning: "More prefix bits mean a smaller, more specific matching address range. Unknown is not a /0 default route." },
        { label: "Equal-prefix candidates", value: data.collectionState === "failed" ? "Unknown" : selected.length, meaning: "All supplied installed entries at the longest matching prefix, without inventing a tie-breaker." },
      ],
      rows: evaluated.map(({ route, prefix, index, matching }) => ({ reference: `Route ${index + 1}`,
        family: prefix.family, prefixLength: prefix.bits, context: route.context === query.context ? "Selected context" : "Other context",
        installed: route.installed === null ? "Unknown" : route.installed ? "Yes" : "No",
        lookup: data.collectionState === "failed" ? "Not evaluated" : !matching ? "Not matching" : route.installed === null ? "Installation unknown" : !route.installed ? "Not installed" : prefix.bits === best ? "Longest supplied match" : "Less specific match",
        administrativeDistance: route.administrativeDistance ?? "Unknown", metric: route.metric ?? "Unknown",
        nextHop: route.nextHop ? "Supplied (redacted)" : "Unknown", interface: route.interface ? "Supplied (redacted)" : "Unknown",
        nextHopResolution: route.nextHopResolved == null ? "Unknown" : route.nextHopResolved ? "Reported resolved" : "Reported unresolved" })),
      findings,
      caveats: [
        "No protocol convergence, BGP path selection, administrative-distance ranking, policy routing, or ECMP hashing is simulated.",
        "Route installation is importer-supplied evidence. A resolved next hop is still not proof of live forwarding.",
        "IPv4 and IPv6 are distinct, including mapped IPv6. Zone-scoped addresses are unsupported; next-hop reachability is not inferred from address family.",
        "Destination, context identifiers, route prefixes, next-hop addresses and interface names are omitted from report rows; original row positions remain available.",
      ], sourceIds: ["route", "cidr", "ipv6"],
    };
  },
};

export const networkOperations: ToolkitOperation[] = [subnetOperation, routingOperation, switchingOperation, firewallOperation];
