import { z } from "zod";
import type { Finding, ToolkitOptions, ToolkitResult } from "./types";
import { cidrSchema, parseComparison, parseNetwork, requireEmptyComparisonOptions } from "./comparisons-validation";

const encryptionSchema = z.enum(["aes128-cbc", "aes192-cbc", "aes256-cbc", "aes128-gcm16", "aes192-gcm16", "aes256-gcm16"]);
const integritySchema = z.enum(["none", "hmac-sha1-96", "hmac-sha256-128", "hmac-sha384-192", "hmac-sha512-256"]);
const prfSchema = z.enum(["hmac-sha1", "hmac-sha256", "hmac-sha384", "hmac-sha512"]);
const choices = <T extends z.ZodType>(schema: T) => z.array(schema).min(1).max(16);
const proposalFields = {
  encryption: choices(encryptionSchema),
  integrity: choices(integritySchema).optional(),
  dhGroups: choices(z.number().int().min(1).max(65535)).optional(),
};
type CipherProposal = { encryption: string[]; integrity?: string[] };
function checkCipher(proposal: CipherProposal, ctx: z.RefinementCtx) {
  const aead = proposal.encryption.some((cipher) => cipher.endsWith("-gcm16"));
  const separate = proposal.encryption.some((cipher) => cipher.endsWith("-cbc"));
  if (aead && separate) ctx.addIssue({ code: "custom", message: "Use separate proposals for AEAD and CBC." });
  if (aead && proposal.integrity?.some((algorithm) => algorithm !== "none")) {
    ctx.addIssue({ code: "custom", message: "AEAD supplies integrity; separate integrity is not applicable." });
  }
  if (separate && proposal.integrity?.includes("none")) {
    ctx.addIssue({ code: "custom", message: "This CBC profile requires separate integrity." });
  }
}
const ikeProposalSchema = z.strictObject({ ...proposalFields, prf: choices(prfSchema).optional() }).superRefine(checkCipher);
const childProposalSchema = z.strictObject({
  ...proposalFields,
  dhGroups: choices(z.number().int().min(0).max(65535)).optional(),
  esn: choices(z.enum(["no-esn", "esn"])).optional(),
}).superRefine(checkCipher);
const portsSchema = z.strictObject({ start: z.number().int().min(0).max(65535), end: z.number().int().min(0).max(65535) })
  .refine((range) => range.start <= range.end);
const selectorSchema = z.strictObject({
  localCIDR: cidrSchema,
  remoteCIDR: cidrSchema,
  protocol: z.enum(["any", "tcp", "udp"]).optional(),
  localPorts: portsSchema.optional(),
  remotePorts: portsSchema.optional(),
}).superRefine((selector, ctx) => {
  if (parseNetwork(selector.localCIDR).family !== parseNetwork(selector.remoteCIDR).family) {
    ctx.addIssue({ code: "custom", message: "A selector pair must use one IP family." });
  }
  if (selector.protocol === "any" && [selector.localPorts, selector.remotePorts].some((range) => range && (range.start !== 0 || range.end !== 65535))) {
    ctx.addIssue({ code: "custom", message: "The any-protocol profile supports only full port ranges." });
  }
});
const lifetime = z.number().int().positive().max(Number.MAX_SAFE_INTEGER);
const peerSchema = z.strictObject({
  ikeVersion: z.literal(2).optional(),
  ikeProposals: choices(ikeProposalSchema).optional(),
  childProposals: choices(childProposalSchema).optional(),
  selectors: choices(selectorSchema).optional(),
  ikeLifetimeSeconds: lifetime.optional(),
  childLifetimeSeconds: lifetime.optional(),
});
const vpnSchema = z.strictObject({ peerA: peerSchema.optional(), peerB: peerSchema.optional() });
type Proposal = z.infer<typeof ikeProposalSchema> | z.infer<typeof childProposalSchema>;
type Selector = z.infer<typeof selectorSchema>;
type State = "common" | "disjoint" | "unknown";
type Check = { state: State; detail: string };

function intersection(a: readonly (string | number)[] | undefined, b: readonly (string | number)[] | undefined, label: string): Check {
  if (!a || !b) return { state: "unknown", detail: `${label}: unknown (missing evidence)` };
  const common = [...new Set(a)].filter((value) => b.includes(value));
  return { state: common.length ? "common" : "disjoint", detail: `${label}: ${common.length ? common.join(", ") : "no common alternative"}` };
}
function combine(checks: Check[]): Check {
  return { state: checks.some((check) => check.state === "disjoint") ? "disjoint" : checks.some((check) => check.state === "unknown") ? "unknown" : "common", detail: checks.map((check) => check.detail).join("; ") };
}
function proposalCheck(a: Proposal, b: Proposal, child: boolean, rekey = false): Check {
  // RFC 7296 sections 2.7 and 3.3: intersect transform alternatives within one proposal pair.
  const integrity = (proposal: Proposal) => proposal.encryption.every((cipher) => cipher.endsWith("-gcm16")) ? ["none"] : proposal.integrity;
  const checks = [intersection(a.encryption, b.encryption, "Encryption"), intersection(integrity(a), integrity(b), "Integrity")];
  if (!child) {
    checks.push(intersection("prf" in a ? a.prf : undefined, "prf" in b ? b.prf : undefined, "PRF"));
    checks.push(intersection(a.dhGroups, b.dhGroups, "DH group identifier"));
  } else {
    checks.push(intersection("esn" in a ? a.esn : undefined, "esn" in b ? b.esn : undefined, "Extended sequence numbers"));
    if (rekey) checks.push(intersection(a.dhGroups, b.dhGroups, "Separate CHILD key exchange (0 = none)"));
  }
  return combine(checks);
}
function rangeCheck(a: { start: number | bigint; end: number | bigint } | undefined, b: { start: number | bigint; end: number | bigint } | undefined, label: string): Check {
  if (!a || !b) return { state: "unknown", detail: `${label}: unknown (missing range)` };
  const overlaps = a.start <= b.end && b.start <= a.end;
  return { state: overlaps ? "common" : "disjoint", detail: `${label}: ${!overlaps ? "disjoint" : a.start === b.start && a.end === b.end ? "equal range" : "overlap; narrowing may be needed"}` };
}
function selectorCheck(a: Selector, b: Selector): Check {
  const al = parseNetwork(a.localCIDR), ar = parseNetwork(a.remoteCIDR);
  const bl = parseNetwork(b.localCIDR), br = parseNetwork(b.remoteCIDR);
  if (al.family !== br.family || ar.family !== bl.family) return { state: "disjoint", detail: "Different IP families." };
  const protocol: Check = !a.protocol || !b.protocol
    ? { state: "unknown", detail: "Protocol: unknown (missing evidence)" }
    : { state: a.protocol === "any" || b.protocol === "any" || a.protocol === b.protocol ? "common" : "disjoint", detail: `Protocol: ${a.protocol} / ${b.protocol}` };
  return combine([rangeCheck(al, br, "A local / B remote"), rangeCheck(ar, bl, "A remote / B local"), protocol,
    rangeCheck(a.localPorts, b.remotePorts, "A local / B remote ports"), rangeCheck(a.remotePorts, b.localPorts, "A remote / B local ports")]);
}

type Matrix = { state: State; common: number; unknown: number; rows: ToolkitResult["rows"] };
function matrix<T>(area: string, a: T[] | undefined, b: T[] | undefined, check: (a: T, b: T) => Check, versionKnown: boolean): Matrix {
  if (!a || !b || !versionKnown) return { state: "unknown", common: 0, unknown: 1, rows: [{ Area: area, PeerA: a ? `${a.length} supplied` : "unknown", PeerB: b ? `${b.length} supplied` : "unknown", Comparison: "unknown", Detail: "Both IKEv2 versions and both sets of configured evidence are needed." }] };
  const rows: ToolkitResult["rows"] = [];
  let common = 0, unknown = 0;
  a.forEach((left, ai) => b.forEach((right, bi) => {
    const result = check(left, right);
    if (result.state === "common") common++;
    if (result.state === "unknown") unknown++;
    rows.push({ Area: area, PeerA: ai + 1, PeerB: bi + 1, Comparison: result.state, Detail: result.detail });
  }));
  return { state: common ? "common" : unknown ? "unknown" : "disjoint", common, unknown, rows };
}

export function analyzeVpn(input: string, options: ToolkitOptions = {}): ToolkitResult {
  requireEmptyComparisonOptions(options, "VPN");
  const value = parseComparison(input, vpnSchema, "VPN profile");
  const a = value.peerA, b = value.peerB;
  const known = a?.ikeVersion === 2 && b?.ikeVersion === 2;
  const ike = matrix("IKE proposals", a?.ikeProposals, b?.ikeProposals, (left, right) => proposalCheck(left, right, false), known);
  const initial = matrix("Initial CHILD proposals (IKE_AUTH)", a?.childProposals, b?.childProposals, (left, right) => proposalCheck(left, right, true), known);
  const rekey = matrix("CHILD proposals (CREATE_CHILD_SA)", a?.childProposals, b?.childProposals, (left, right) => proposalCheck(left, right, true, true), known);
  const selectors = matrix("Selector pairs", a?.selectors, b?.selectors, selectorCheck, known);
  const parts = [
    ["IKE proposals", ike, "Internet Key Exchange (IKE) protects tunnel setup. This counts proposal pairs sharing encryption, integrity, key-derivation and Diffie-Hellman alternatives."],
    ["Initial CHILD proposals", initial, "A CHILD security association protects data traffic. This counts matching encryption/integrity and sequence-number alternatives for its initial creation."],
    ["CHILD separate key exchange", rekey, "A later data-security association can use a separate Diffie-Hellman key exchange. This count also requires common explicitly supplied key-exchange alternatives."],
    ["Reversed selector pairs", selectors, "Traffic selectors describe protected address, protocol and port ranges. This counts overlapping pairs after reversing the peers' local/remote perspectives, not all permitted traffic."],
  ] as const;
  const findings: Finding[] = parts.map(([title, result]) => ({
    level: result.state === "common" ? "info" : "review", title: `${title}: ${result.state}`,
    detail: result.state === "common" ? "At least one supplied pair has common alternatives. This is configured compatibility only, not an accepted proposal or negotiated selector."
      : result.state === "disjoint" ? "No common pair exists in the supplied supported fields. Check the complete profiles and negotiation evidence before diagnosing failure."
        : "Missing peer, version or transform/selector evidence leaves this comparison unknown; no vendor default was inserted.",
  }));
  const rows = parts.flatMap(([, result]) => result.rows);
  for (const key of ["ikeLifetimeSeconds", "childLifetimeSeconds"] as const) {
    const av = a?.[key], bv = b?.[key];
    rows.push({ Area: key === "ikeLifetimeSeconds" ? "IKE lifetime (seconds)" : "CHILD lifetime (seconds)", PeerA: av ?? "unknown", PeerB: bv ?? "unknown", Comparison: av === undefined || bv === undefined ? "unknown" : av === bv ? "equal configured values" : "different configured values", Detail: "IKEv2 lifetimes are independently enforced, not negotiated; equality is not required." });
  }
  findings.push({ level: "info", title: "Authentication and live state are unknown", detail: "No identities, credentials, authentication exchanges, accepted transforms, routes, policies or packet counters are validated. Do not submit pre-shared keys or private keys." });
  return {
    title: "Configured IKEv2 peer comparison",
    summary: `Configured evidence only. IKE: ${ike.state}; initial CHILD: ${initial.state}; separate CHILD key exchange: ${rekey.state}; selectors: ${selectors.state}. Tunnel establishment and application delivery remain unknown.`,
    evidence: "imported",
    metrics: parts.map(([label, result, meaning]) => ({ label: `${label}: common pairs`, value: result.state === "unknown" ? "unknown" : result.common, unit: "pairs", meaning: `${meaning} Not security strength, tunnel health or a count of negotiated associations.` })),
    rows, findings,
    caveats: [
      "RFC 7296 sections 2.7, 2.8, 2.9, 2.17 and 3.3 support this limited IKEv2/ESP configured-profile comparison. It is not a device configuration parser or security recommendation.",
      "Supported encryption names include key size and mode; gcm16 means a 16-octet authentication tag. Authenticated encryption (AEAD) supplies integrity but IKE still needs a pseudorandom function (PRF) for key derivation. CBC needs separate integrity. Alternatives from different proposal objects are never combined.",
      "DH group numbers are identifiers, not an ordinal strength scale. Only equality/intersection is checked; registry status, algorithm suitability and implementation support are not assessed.",
      "The first CHILD SA in IKE_AUTH derives keys from the IKE exchange; no separate CHILD DH exchange occurs there. The CREATE_CHILD_SA comparison separately checks supplied DH alternatives (0 means explicitly no separate key exchange); success at establishment does not establish rekey success.",
      "Selector objects represent paired local/remote CIDRs with TCP/UDP port ranges or any protocol with full ranges. Host bits are normalized as CIDR ranges. Arbitrary address ranges, ICMP type/code selectors, transport-mode NAT changes and full vendor policy granularity are unsupported.",
      "Peer A local is compared to Peer B remote and vice versa. Overlap can permit narrowing, not all configured traffic. Even equal sets do not prove acceptance; responder policy can require separate SAs. Missing protocol/port ranges remain unknown.",
      "Lifetimes need not match. Missing fields are unknown; omission of AEAD integrity alone means not applicable, as determined by the explicit cipher. Authentication, IKE extensions and device defaults are outside scope.",
      "FortiOS exact-version phase1/phase2 references were blocked in the source register. No Fortinet defaults or version-specific behavior are inferred; the selector note is excerpt-only.",
    ],
    sourceIds: ["ike", "forti-selectors", "forti-p1", "forti-p2"],
  };
}

const fullPorts = { start: 0, end: 65535 };
export const vpnSample = JSON.stringify({
  peerA: {
    ikeVersion: 2,
    ikeProposals: [{ encryption: ["aes256-gcm16", "aes128-gcm16"], integrity: ["none"], prf: ["hmac-sha256"], dhGroups: [19, 14] }],
    childProposals: [{ encryption: ["aes256-gcm16"], integrity: ["none"], dhGroups: [19], esn: ["no-esn"] }],
    selectors: [{ localCIDR: "192.0.2.0/24", remoteCIDR: "198.51.100.0/24", protocol: "any", localPorts: fullPorts, remotePorts: fullPorts }],
    ikeLifetimeSeconds: 28800, childLifetimeSeconds: 3600,
  },
  peerB: {
    ikeVersion: 2,
    ikeProposals: [{ encryption: ["aes256-gcm16"], integrity: ["none"], prf: ["hmac-sha256", "hmac-sha384"], dhGroups: [19] }],
    childProposals: [{ encryption: ["aes256-gcm16"], integrity: ["none"], dhGroups: [19], esn: ["no-esn"] }],
    selectors: [{ localCIDR: "198.51.100.0/25", remoteCIDR: "192.0.2.0/24", protocol: "any", localPorts: fullPorts, remotePorts: fullPorts }],
    ikeLifetimeSeconds: 14400, childLifetimeSeconds: 1800,
  },
}, null, 2);
