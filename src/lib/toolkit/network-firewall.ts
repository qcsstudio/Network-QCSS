import { z } from "zod";
import type { Finding, ToolkitOperation, ToolkitResult } from "./types.ts";
import { addressSchema, checked, collectionState, matches, networkLimits, networkPrefixSchema, parseAddress, parsePrefix, readJson } from "./network-core.ts";
import type { Address } from "./network-core.ts";

const portNumber = z.number().int().min(0).max(65535);
const portRange = z.object({ from: portNumber, to: portNumber }).strict().refine(range => range.from <= range.to);
const ports = z.union([portNumber, portRange, z.literal("any")]).nullable();
const addressSet = z.union([networkPrefixSchema, z.literal("any")]).nullable();
const protocol = z.enum(["tcp", "udp", "icmp", "icmpv6", "any"]);
const action = z.enum(["allow", "deny"]);
const ruleSchema = z.object({
  enabled: z.boolean().nullable(), action: action.nullable(),
  source: addressSet, destination: addressSet, protocol: protocol.nullable(),
  sourcePorts: ports, destinationPorts: ports,
}).strict().superRefine((rule, context) => {
  if (["any", "icmp", "icmpv6"].includes(rule.protocol ?? "") && (rule.sourcePorts !== "any" || rule.destinationPorts !== "any")) {
    context.addIssue({ code: "custom", message: "Port criteria require TCP, UDP, or unknown protocol." });
  }
  const families = [rule.source, rule.destination].filter((value): value is string => value !== null && value !== "any").map(value => parsePrefix(value).family);
  if (new Set(families).size > 1 || (rule.protocol === "icmp" && families.includes("ipv6")) || (rule.protocol === "icmpv6" && families.includes("ipv4"))) {
    context.addIssue({ code: "custom", message: "Incompatible rule address families or ICMP protocol." });
  }
});
const policySchema = z.object({ collectionState, defaultAction: action.nullable(), rules: z.array(ruleSchema).max(networkLimits.rules) }).strict();
const flowAddress = z.union([addressSchema, z.literal("unknown"), z.literal("")]).optional()
  .transform(value => value === undefined || value === "unknown" || value === "" ? null : parseAddress(value));
const flowPort = z.string().max(7).refine(value => value === "unknown" || value === "" || (/^(0|[1-9][0-9]{0,4})$/.test(value) && Number(value) <= 65535)).optional()
  .transform(value => value === undefined || value === "unknown" || value === "" ? null : Number(value));
const flowSchema = z.object({
  sourceAddress: flowAddress,
  destinationAddress: flowAddress,
  protocol: z.enum(["tcp", "udp", "icmp", "icmpv6", "unknown", ""]).optional()
    .transform(value => value === undefined || value === "unknown" || value === "" ? null : value),
  sourcePort: flowPort,
  destinationPort: flowPort,
}).strict().superRefine((flow, context) => {
  const families = [flow.sourceAddress?.kind(), flow.destinationAddress?.kind()].filter(Boolean);
  if (new Set(families).size > 1 || (flow.protocol === "icmp" && families.includes("ipv6")) || (flow.protocol === "icmpv6" && families.includes("ipv4"))) {
    context.addIssue({ code: "custom", message: "Incompatible flow address families or ICMP protocol." });
  }
  if ((flow.protocol === "icmp" || flow.protocol === "icmpv6") && (flow.sourcePort !== null || flow.destinationPort !== null)) {
    context.addIssue({ code: "custom", message: "ICMP does not use transport ports." });
  }
});
type Rule = z.infer<typeof ruleSchema>;
type Flow = z.infer<typeof flowSchema>;
type Match = true | false | null;

function addressMatch(set: Rule["source"], address: Address | null): Match {
  if (set === "any") return true;
  if (set === null || address === null) return null;
  return matches(address, parsePrefix(set));
}
function portMatch(set: Rule["sourcePorts"], port: number | null): Match {
  if (set === "any") return true;
  if (set === null || port === null) return null;
  return typeof set === "number" ? set === port : port >= set.from && port <= set.to;
}
function ruleMatch(rule: Rule, flow: Flow): Match {
  if (rule.enabled === false) return false;
  const conditions: Match[] = [
    rule.enabled,
    addressMatch(rule.source, flow.sourceAddress), addressMatch(rule.destination, flow.destinationAddress),
    rule.protocol === "any" ? true : rule.protocol === null || flow.protocol === null ? null : rule.protocol === flow.protocol,
    portMatch(rule.sourcePorts, flow.sourcePort), portMatch(rule.destinationPorts, flow.destinationPort),
  ];
  // A definite non-match defeats unknown conditions within a conjunctive rule;
  // an unknown earlier rule still blocks a later definite first-match decision.
  return conditions.includes(false) ? false : conditions.includes(null) ? null : true;
}

export const firewallOperation: ToolkitOperation = {
  id: "firewall", name: "Stateless policy simulation",
  description: "Step through a simplified ordered CIDR/protocol/port policy for one flow, preserving unknown evidence.",
  inputLabel: "Simplified policy JSON",
  format: `Strict JSON: collectionState (complete, partial, failed), defaultAction (allow/deny/null), rules (maximum ${networkLimits.rules}). Every rule requires enabled (boolean/null), action (allow/deny/null), source and destination (canonical CIDR/any/null), protocol (tcp/udp/icmp/icmpv6/any/null), sourcePorts and destinationPorts (0-65535, {from,to}, any, or null). Null means unknown, not any. Protocol any/icmp/icmpv6 requires both port fields to be any. Flow blanks mean unknown; ICMP ports must be blank. Unknown fields, NAT, zones, state, objects, identity, schedules and vendor syntax are rejected. Maximum 262144 characters.`,
  sample: JSON.stringify({ collectionState: "complete", defaultAction: "deny", rules: [
    { enabled: true, action: "deny", source: "192.0.2.50/32", destination: "any", protocol: "tcp", sourcePorts: "any", destinationPorts: 443 },
    { enabled: true, action: "allow", source: "192.0.2.0/24", destination: "198.51.100.0/24", protocol: "tcp", sourcePorts: "any", destinationPorts: 443 },
    { enabled: true, action: "deny", source: "any", destination: "any", protocol: "any", sourcePorts: "any", destinationPorts: "any" },
  ] }, null, 2),
  fields: [
    { key: "sourceAddress", label: "Source IP address", type: "text", initial: "192.0.2.10", meaning: "The packet's source address at this policy stage; blank or unknown means not supplied." },
    { key: "destinationAddress", label: "Destination IP address", type: "text", initial: "198.51.100.20", meaning: "The packet's destination at the same policy stage; IPv4 and IPv6 are not interchangeable." },
    { key: "protocol", label: "IP protocol", type: "select", initial: "tcp", options: [
      { value: "tcp", label: "TCP" }, { value: "udp", label: "UDP" }, { value: "icmp", label: "ICMP (IPv4)" },
      { value: "icmpv6", label: "ICMPv6" }, { value: "unknown", label: "Unknown" },
    ], meaning: "TCP/UDP use transport ports. ICMP and ICMPv6 do not; their type and code are outside this model." },
    { key: "sourcePort", label: "Source port", type: "text", initial: "51000", meaning: "A TCP/UDP source port from 0 to 65535. Blank is unknown, not zero or any." },
    { key: "destinationPort", label: "Destination port", type: "text", initial: "443", meaning: "A TCP/UDP destination port from 0 to 65535. Blank is unknown, not zero or any." },
  ],
  analyze(input, options) {
    const flow = checked(flowSchema, options, "Invalid firewall flow options. Check IP family, protocol, port range, and supported field names.");
    const policy = readJson(policySchema, input, `Invalid simplified policy JSON. Check required rule fields, canonical CIDRs, protocol/ports, collectionState, and the ${networkLimits.rules}-rule limit.`, "rules");
    let decision: "Allow" | "Deny" | "Unknown" = "Unknown";
    let decisionSource = "Unknown";
    let unknownMatches = 0;
    let evaluated = 0;
    let terminal = false;
    const canEvaluate = policy.collectionState !== "failed" && policy.rules.length > 0;
    const rows: ToolkitResult["rows"] = policy.rules.map((rule, index) => {
      const reference = `Rule ${index + 1}`;
      const row = { reference, enabled: rule.enabled === null ? "Unknown" : rule.enabled ? "Yes" : "No", match: "Not evaluated", trace: "Not evaluated" };
      if (!canEvaluate) return row;
      if (terminal) return { ...row, trace: "Not reached for this flow" };
      evaluated++;
      if (rule.enabled === false) return { ...row, match: "No", trace: "Disabled" };
      const match = ruleMatch(rule, flow);
      if (match === false) return { ...row, match: "No", trace: "Continue" };
      if (match === null) {
        unknownMatches++;
        return { ...row, match: "Unknown", trace: "Possible earlier match" };
      }
      terminal = true;
      if (unknownMatches || rule.action === null) return { ...row, match: "Yes", trace: unknownMatches ? "Earlier match unresolved" : "Action unknown" };
      decision = rule.action === "allow" ? "Allow" : "Deny";
      decisionSource = reference;
      return { ...row, match: "Yes", trace: "First supplied match" };
    });
    if (canEvaluate && !terminal && !unknownMatches && policy.defaultAction !== null) {
      decision = policy.defaultAction === "allow" ? "Allow" : "Deny";
      decisionSource = "Explicit default";
    }
    if (policy.collectionState !== "complete") { decision = "Unknown"; decisionSource = "Unknown"; }
    const findings: Finding[] = [{ level: "review", title: "Simulation, not vendor runtime", detail: "This result applies only to the explicit simplified stateless model. It is not device packet-tracer output, observed traffic, a security assurance, or proof of application delivery." }];
    if (!policy.rules.length) findings.push({ level: "review", title: "Empty policy evidence", detail: "No rule evidence was supplied. A permissive default alone is not reported as an established allow decision." });
    if (policy.collectionState !== "complete") findings.push({ level: "review", title: "Incomplete collection", detail: policy.collectionState === "failed" ? "Policy collection failed; rules were not evaluated." : "The policy is partial. Missing earlier rules can change the decision, so the overall result remains unknown." });
    if (decision === "Unknown") findings.push({ level: "review", title: "Decision is unknown", detail: "Missing flow fields, unresolved matching rules/actions, missing default, or insufficient collection prevents a definite ordered-policy decision. Unknown never means allow." });
    else findings.push({ level: "info", title: "Simplified first-match decision", detail: `${decision} follows ${decisionSource.toLowerCase()} for the supplied flow under this model only.` });
    const incompleteFlow = flow.sourceAddress === null || flow.destinationAddress === null || flow.protocol === null || ((flow.protocol === "tcp" || flow.protocol === "udp") && (flow.sourcePort === null || flow.destinationPort === null));
    if (incompleteFlow) findings.push({ level: "review", title: "Flow evidence incomplete", detail: "Some flow fields are unknown. A decision is possible only when those fields do not affect the reached rule conditions." });
    return {
      title: "Simplified stateless policy simulation", evidence: "simulated",
      summary: `${decision} in the simplified model. No vendor runtime, NAT, connection state, or application delivery is evaluated.`,
      metrics: [
        { label: "Simulated decision", value: decision, meaning: "The first matching rule action or explicit default in this simplified model. Unknown is not a permit." },
        { label: "Decision source", value: decisionSource, meaning: "The original one-based rule position or explicit default responsible for a definite simulated decision." },
        { label: "Collection state", value: policy.collectionState, meaning: "Importer-declared completeness of policy evidence. Failed and partial input cannot establish a decision." },
        { label: "Supplied rules", value: policy.rules.length, meaning: "The number of ordered rule records supplied; omitted vendor policy is not inferred." },
        { label: "Rules considered", value: canEvaluate ? evaluated : "Unknown", meaning: "Rule positions visited up to the first definite match, including disabled entries." },
        { label: "Unresolved earlier matches", value: canEvaluate ? unknownMatches : "Unknown", meaning: "Earlier rules that might match; these prevent a later match from proving a first-match decision." },
      ], rows, findings,
      caveats: [
        "Only ordered terminal allow/deny, single CIDR or any per address, protocol, and inclusive single port/range criteria are modeled. All rule conditions are conjunctive.",
        "No NAT, stateful sessions, fragments, extensions, ICMP type/code, zones, application/user identity, schedules, address groups, or dynamic objects are supported.",
        "An unreached rule is not proven shadowed for all traffic. No full or partial semantic shadowing analysis or automatic remediation is performed.",
        "IPv4 and IPv6 are kept distinct, including mapped IPv6. Mixed-family flows and incompatible ICMP families are rejected.",
        "Flow addresses, ports, and rule match configuration are omitted from report rows; only positional references and derived match states are included.",
      ], sourceIds: ["ftd", "cidr", "ipv6"],
    };
  },
};
