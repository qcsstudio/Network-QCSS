import { getProfile, LENS_VERSION, type Selection } from "./catalog";
import { maskConfiguration } from "./masking";
import { fortinetWords as words } from "./fortinet-syntax";
import { ciscoRule, fortiRule, type Category } from "./rules";
import { categoryCatalog, categoryOrder, classifyCategory } from "./categories";
import { commandReferences, RULES_REVIEWED, type CommandReference } from "./references";

export type Explanation = { line: number; text: string; context: string; category: Category; section: string; scope: string; blockLine: number; entry: string; entityId?: string; status: "explained" | "context" | "unknown" | "masked"; explanation: string; reference?: CommandReference };
export type Entity = { id: string; name: string; kind: string; scope: string; lines: number[]; settings: { key: string; value: string; line: number }[] };
export type Relationship = { from: string; to?: string; target: string; kind: string; role?: string; line: number; scope: string };
export type Finding = { level: "review" | "information"; title: string; explanation: string; lines: number[] };
export type Analysis = {
  engine: string; selection: Selection; lines: Explanation[]; entities: Entity[]; relationships: Relationship[];
  findings: Finding[]; maskedSource: string; maskedCount: number;
  coverage: { explained: number; context: number; unknown: number; masked: number; total: number };
};
const fortiKinds: Record<string, string> = {
  "system interface": "interface", "switch interface": "interface", "switch vlan": "VLAN", "router static": "route", "router static6": "route",
  "firewall policy": "policy", "firewall policy6": "policy", "firewall address": "address", "firewall address6": "address", "firewall addrgrp": "address", "firewall addrgrp6": "address",
  "firewall service custom": "service", "firewall service group": "service", "firewall vip": "VIP", "firewall ippool": "NAT pool",
  "vpn ipsec phase1-interface": "VPN peer", "vpn ipsec phase2-interface": "VPN selector",
  "server-policy policy": "web policy", "server-policy server-pool": "server pool", "server-policy vserver": "virtual server", "server-policy virtual-server": "virtual server"
};
const fieldMeaning: Record<string, string> = {
  ip: "Interface IP address and mask", srcintf: "Incoming interface match", dstintf: "Outgoing interface match", srcaddr: "Source address match", dstaddr: "Destination address match",
  action: "Configured policy action", service: "Service match or service reference", schedule: "Active schedule reference", nat: "Policy NAT setting", status: "Configured administrative state",
  dst: "Destination network", gateway: "Next-hop address", device: "Exit interface reference", member: "Group members", subnet: "Object network address and mask",
  allowaccess: "Interface management protocols", "phase1name": "Parent VPN peer", "remote-gw": "Remote VPN gateway", "server-pool": "Backend pool reference", vserver: "Virtual server reference",
  "web-protection-profile": "Application protection profile reference", "native-vlan": "Native VLAN", "allowed-vlans": "Allowed VLANs", vlanid: "VLAN identifier"
};

function checkDialect(input: string, profileId: string) {
  const p = getProfile(profileId)!;
  const forti = /^\s*config (?:system|firewall|router|server-policy|switch|vpn|vdom|global)\b/m.test(input);
  const cisco = /^(?:interface\s|router (?:bgp|ospf)|ASA Version|version \d|hostname\s)/m.test(input);
  if (forti && cisco) throw new Error("Mixed vendor exports detected. Analyze one device configuration at a time.");
  if (p.vendor === "cisco" && forti || p.vendor === "fortinet" && cisco) throw new Error("The configuration syntax does not match the selected vendor.");
  if (p.dialect !== "fortiweb" && /^\s*config server-policy\b/m.test(input)) throw new Error("This looks like FortiWeb. Select Fortinet > FortiWeb application firewall.");
  if (p.dialect === "fortiweb" && /^\s*config (?:firewall policy|vpn ipsec)\b/m.test(input)) throw new Error("FortiOS firewall syntax is not a FortiWeb policy. Check the device family.");
  if (["ios", "nxos"].includes(p.dialect) && /^(?:ASA Version|NGFW Version|FTD Version)|^\s*nameif\s/m.test(input)) throw new Error("This is ASA/FTD-style configuration. Select the corresponding firewall family.");
  if (p.dialect === "asa" && /^(?:NGFW|FTD) Version/m.test(input)) throw new Error("Threat Defense diagnostic output requires the FTD profile and its partial-policy warning.");
  if (p.dialect !== "nxos" && /NXOS: version|NX-OS|^version \d+\.\d+\(\d+\).*N\d/m.test(input)) throw new Error("NX-OS detected. Select Cisco > Nexus switch.");
}

export type AnalysisProgress = { phase: "masking" | "explaining" | "references"; completed: number; total: number };

export function analyzeConfiguration(input: string, selection: Selection, progress?: (value: AnalysisProgress) => void): Analysis {
  const profile = getProfile(selection.profileId);
  if (!profile || ![...profile.versions, "Other / unknown"].includes(selection.version) || !["running", "saved", "candidate", "unknown"].includes(selection.configType) || !/^[\w.() /-]{0,60}$/.test(selection.build)) throw new Error("Select a valid device family, OS train and configuration type.");
  progress?.({ phase: "masking", completed: 0, total: 0 });
  const masked = maskConfiguration(input, profile.vendor);
  checkDialect(profile.vendor === "fortinet" ? masked.lines.join("\n") : input, profile.id);
  const explanations: Explanation[] = [], entities: Entity[] = [], relationships: Relationship[] = [], findings: Finding[] = [];
  let current: Entity | undefined, context = "Global", scope = "default", ciscoBlockLine = 0;
  type Frame = { type: "config" | "edit"; name: string; line: number; entity?: Entity };
  const stack: Frame[] = [];
  const configs = () => stack.filter(f => f.type === "config").map(f => f.name);
  const currentSection = () => configs().filter(n => !["vdom", "global"].includes(n)).join(" ");
  function fortinetScope() {
    const vdomIndex = stack.findIndex(f => f.type === "config" && f.name === "vdom");
    return vdomIndex >= 0 ? `VDOM ${stack.slice(vdomIndex + 1).find(f => f.type === "edit")?.name || "unselected"}` : configs().includes("global") ? "global" : "default";
  }
  const byId = new Map<string, Entity>();
  function entity(kind: string, name: string, scope: string, line: number) {
    const id = JSON.stringify([scope, kind, name]);
    let e = byId.get(id);
    if (!e) { e = { id, kind, name, scope, lines: [], settings: [] }; byId.set(id, e); entities.push(e); }
    if (e.lines.at(-1) !== line) e.lines.push(line);
    return e;
  }
  function relation(from: Entity, target: string, kind: string, line: number, role?: string) {
    relationships.push({ from: from.id, target, kind, role, line, scope: from.scope });
  }
  function add(line: number, text: string, context: string, category: Category, status: Explanation["status"], explanation: string, reference?: CommandReference) {
    const fortinet = profile!.vendor === "fortinet";
    const section = fortinet ? currentSection() || "Global" : context;
    const frame = stack.at(-1);
    const owner = fortinet ? [...stack].reverse().find(f => f.entity)?.entity : current;
    const entry = fortinet ? frame?.type === "edit" ? frame.name : "" : current?.name || "";
    explanations.push({ line, text, context, category: classifyCategory(profile!.vendor, text, section, category), section, scope: fortinet ? fortinetScope() : scope, blockLine: fortinet ? frame?.line || 0 : current?.lines[0] || ciscoBlockLine, entry, entityId: owner?.id, status, explanation, reference });
  }
  findings.push({ level: "information", title: "Configuration, not live state", explanation: "This is a read-only explanation of supplied statements. It does not test packets, infer physical cabling, verify security compliance, check current vulnerabilities or prove any link, route, policy or VPN works.", lines: [] });
  if (selection.configType !== "running") findings.push({ level: "review", title: "Not confirmed as running configuration", explanation: "Saved, candidate or unknown exports may differ from the device's active settings. Confirm the export type before relying on this report.", lines: [] });
  if (selection.version === "Other / unknown") findings.push({ level: "review", title: "OS version is unverified", explanation: "Only recognizable syntax is explained. No defaults or version-specific security conclusions are inferred.", lines: [] });
  if (profile.dialect === "ftd") findings.push({ level: "review", title: "FTD diagnostic output is partial", explanation: profile.scope, lines: [] });
  if (profile.dialect === "fortiweb") findings.push({ level: "review", title: "WAF scope and operating mode", explanation: profile.scope, lines: [] });
  const fortiVersion = input.match(/^#config-version=[^\r\n]*?-(\d+\.\d+\.\d+)-/m)?.[1];
  const fortiVersionMismatch = !!fortiVersion && !fortiVersion.startsWith(selection.version.match(/\d+\.\d+/)?.[0] || "unmatched");
  const ciscoVersion = input.match(/^version (\d+)\./m)?.[1];
  const ciscoVersionMismatch = profile.dialect === "ios" && !!ciscoVersion && ciscoVersion !== selection.version.match(/\d+/)?.[0];
  if (ciscoVersionMismatch) findings.push({ level: "review", title: "Export version differs from selection", explanation: "Select the OS train matching the export. Version-scoped explanations are withheld for this mismatch.", lines: [] });
  const ruleSelection = ciscoVersionMismatch ? { ...selection, version: "Other / unknown" } : selection;
  if (fortiVersion && !selection.version.includes("unknown") && !fortiVersion.startsWith(selection.version.match(/\d+\.\d+/)?.[0] || "unmatched")) findings.push({ level: "review", title: "Export version differs from selection", explanation: "The Fortinet version header does not match the selected OS train. Select the matching train and analyze again; version-dependent behavior has not been evaluated.", lines: [] });
  for (let index = 0; index < masked.lines.length; index++) {
    if (index % 1000 === 0) progress?.({ phase: "explaining", completed: index, total: masked.lines.length });
    const text = masked.lines[index], line = index + 1, t = text.trim();
    if (!t) continue;
    if (masked.maskedLines.has(line) && !masked.structuralLines.has(line)) {
      add(line, text, context, "Structure", "masked", "Sensitive or free-text content has been removed. Masked lines are not semantically evaluated.");
      continue;
    }
    if (profile.vendor === "fortinet") {
      scope = fortinetScope();
      const structuralStatus = masked.structuralLines.has(line) ? "masked" : "context";
      if (/^config\s+/.test(t)) {
        if (stack.length >= 32) throw new Error("Configuration nesting exceeds the supported depth.");
        stack.push({ type: "config", name: t.slice(6).trim().replace(/\s+/g, " "), line });
        context = `${scope} / ${currentSection() || "context"}`;
        add(line, text, context, "Structure", structuralStatus, "Opens a configuration section. Its settings are interpreted only within this context."); continue;
      }
      if (/^edit\s+/.test(t)) {
        if (stack.length >= 32 || stack.at(-1)?.type !== "config") throw new Error(`Unbalanced Fortinet edit/config structure at line ${line}. An edit entry must be inside a config section with the previous entry closed.`);
        const name = words(t.slice(4).trim()).join(" "), section = currentSection();
        const e = fortiKinds[section] ? entity(fortiKinds[section], name, scope, line) : undefined;
        stack.push({ type: "edit", name, line, entity: e });
        context = `${scope} / ${section} / ${name}`;
        add(line, text, context, "Structure", structuralStatus, structuralStatus === "masked" ? "The entry name is redacted. Its structural boundary is retained; references to its original name are not inferred." : `Selects the named entry ${name} in this section. Entry identifiers are not device identities.`); continue;
      }
      if (t === "next" || t === "end") {
        // Keep the closing line with its original block, then leave the active table.
        const closeEntry = t === "end" && stack.at(-1)?.type === "edit";
        const expected = t === "next" ? "edit" : "config";
        if (stack.at(closeEntry ? -2 : -1)?.type !== expected) throw new Error(`Unbalanced Fortinet next/end structure at line ${line}. ${t === "next" ? "No open edit entry matches this next." : "No open config section matches this end."} Check the export around that line; no partial analysis was produced.`);
        add(line, text, context, "Structure", "context", "Closes the current entry or configuration section.");
        if (closeEntry) stack.pop();
        stack.pop(); context = `${scope} / ${currentSection() || "context"}`;
        continue;
      }
      const setting = t.match(/^(set|unset|append|unselect)\s+(\S+)(?:\s+(.*))?$/);
      if (setting) {
        const [, operation, key, rawValue = ""] = setting, value = words(rawValue).join(", ");
        const section = currentSection(), rule = fortiRule(section, key, profile.dialect, { version: fortiVersionMismatch ? "Other / unknown" : selection.version, operation, rawValue, entry: stack.at(-1)?.type === "edit" });
        current = [...stack].reverse().find(f => f.entity)?.entity;
        if (current && stack.at(-1)?.entity === current && operation === "set") {
          current.settings.push({ key, value, line }); current.lines.push(line);
          const referenceKinds: Record<string, string> = { srcintf: "interface", dstintf: "interface", device: "interface", interface: "interface", srcaddr: "address", dstaddr: "address", service: "service", phase1name: "VPN peer", vserver: "virtual server", "server-pool": "server pool" };
          const kind = referenceKinds[key] || (key === "member" ? current.kind : "");
          if (kind && rule) for (const target of words(rawValue)) relation(current, target, kind, line, key);
        }
        const summary = operation === "unset" ? "Removes an explicit setting; the version-specific default is not inferred." : operation !== "set" ? "Modifies an existing list; the final list is not calculated." : `${fieldMeaning[key] || key}: ${value}.`;
        add(line, text, context, rule?.category || "Structure", rule ? "explained" : "unknown", rule ? `${summary} ${rule.explanation}` : "This field, value, operation, context or selected OS train is not covered by the current parser. Do not infer its effect from another product's syntax.", rule?.reference);
        continue;
      }
    } else {
      if (/^(?:end|exit|exit-address-family)$/.test(t)) { current = undefined; context = "Global"; ciscoBlockLine = 0; add(line, text, context, "Structure", "context", "Closes a configuration context."); continue; }
      let match: RegExpMatchArray | null;
      let kind = "", name = "";
      if ((match = t.match(/^interface (.+)$/))) { kind = "interface"; name = match[1]; }
      else if ((match = t.match(/^vlan ([\d,-]+)$/))) { kind = "VLAN"; name = match[1]; }
      else if ((match = t.match(/^router (.+)$/))) { kind = "routing process"; name = match[1]; }
      else if ((match = t.match(/^(?:ip|ipv6) access-list (?:standard |extended )?(.+)$/))) { kind = "ACL"; name = match[1]; }
      else if ((match = t.match(/^(?:object|object-group) (?:network|service) (\S+)(?: .*)?$/))) { kind = "object"; name = match[1]; }
      else if (!/^\s/.test(text) && (match = t.match(/^(?:ip vrf|vrf definition|vrf context) (\S+)$/))) { kind = "VRF"; name = match[1]; }
      else if ((match = t.match(/^line (.+)$/))) { kind = "management line"; name = match[1]; }
      if (kind) {
        current = entity(kind, name, scope, line); context = t; ciscoBlockLine = line;
        add(line, text, context, "Structure", "context", `Opens the ${kind} named ${name}. Following settings belong to this configuration context.`); continue;
      }
      if (!/^\s/.test(text)) {
        current = undefined; context = "Global"; ciscoBlockLine = 0;
        // Preserve functional grouping for unsupported blocks without claiming to interpret them.
        if (/^(?:ip dhcp pool|crypto (?:map|ikev2|isakmp|ipsec)|aaa group server|route-map)\b/.test(t)) { context = t; ciscoBlockLine = line; }
      }
      if (/^access-list (\S+)/.test(t)) { current = entity("ACL", t.split(/\s+/)[1], scope, line); }
      if (/^(?:ip|ipv6) route\s|^route\s/.test(t)) current = entity("route", `Static route at L${line}`, scope, line);
      if (current) { if (current.lines.at(-1) !== line) current.lines.push(line); current.settings.push({ key: t.split(/\s+/)[0], value: t, line }); }
      if (current?.kind === "interface") {
        if ((match = t.match(/^ip access-group (\S+)/))) relation(current, match[1], "ACL", line, "access-list attachment");
        if ((match = t.match(/^switchport access vlan (\d+)/))) relation(current, match[1], "VLAN", line, "access VLAN");
        if ((match = t.match(/^(?:ip vrf forwarding|vrf forwarding|vrf member) (\S+)/))) relation(current, match[1], "VRF", line, "routing context");
      }
      const rule = ciscoRule(t, context, profile.dialect, ruleSelection);
      add(line, text, context, rule?.category || "Structure", rule ? "explained" : "unknown", rule?.explanation || "This statement, value, context or selected OS train is not covered by this parser. It remains visible for vendor-documentation review.", rule?.reference);
    }
  }
  if (stack.length) throw new Error(`The Fortinet export ends inside a configuration block opened at line ${stack.at(-1)!.line}. Include its closing next/end lines before analysis.`);
  progress?.({ phase: "references", completed: masked.lines.length, total: masked.lines.length });
  // The same scoped identity used for declarations avoids rescanning every object per reference.
  for (const r of relationships) {
    const target = byId.get(JSON.stringify([r.scope, r.kind, r.target]));
    if (target) r.to = target.id;
  }
  const unknown = explanations.filter(l => l.status === "unknown");
  if (unknown.length) findings.push({ level: "review", title: `${unknown.length} statement(s) need vendor review`, explanation: "Unsupported syntax remains in Source. Recognizing other statements is not evidence that these statements are safe or irrelevant.", lines: unknown.map(l => l.line) });
  const broad = explanations.filter(l => /^(?:\s*set (?:allowaccess .*\b(?:http|telnet)\b|service "?ALL"?|srcaddr "?all"?|dstaddr "?all"?)|\s*transport input .*\btelnet\b|\s*ip http server\s*$)/i.test(l.text));
  if (broad.length) findings.push({ level: "review", title: "Broad scope or clear-text management setting", explanation: "Review the cited statements and their full policy context. They may be intentional; this is not a finding of public exposure or a verified vulnerability.", lines: broad.map(l => l.line) });
  const unresolved = relationships.filter(r => !r.to);
  if (unresolved.length) findings.push({ level: "information", title: "Some references have no declared node", explanation: "A reference may be built-in, a wildcard, in another export or unsupported. Missing diagram nodes are not automatically configuration errors.", lines: [...new Set(unresolved.map(r => r.line))] });
  const coverage = { explained: 0, context: 0, unknown: 0, masked: 0, total: explanations.length };
  for (const line of explanations) coverage[line.status]++;
  if (!coverage.explained && !entities.length) throw new Error("No supported configuration statements found. Check the family and export format. This tool does not guess meanings for arbitrary text.");
  return { engine: LENS_VERSION, selection: { ...selection }, lines: explanations, entities, relationships, findings, maskedSource: masked.lines.join("\n"), maskedCount: masked.count, coverage };
}

export function reportText(result: Analysis) {
  const profile = getProfile(result.selection.profileId)!;
  const grouped = new Map<Category, Explanation[]>();
  for (const line of result.lines) { const lines = grouped.get(line.category) || []; lines.push(line); grouped.set(line.category, lines); }
  return [`QCS Config Lens ${result.engine}`, `${profile.name} / ${result.selection.version} / ${result.selection.configType}`, "Private local analysis. Review identifiers and unrecognized secrets before sharing.", "No runtime, vulnerability, compliance or reachability verification performed.", "Classification is not a claim of supported semantics. Needs-review and masked statements remain unevaluated.", "", ...result.findings.map(f => `${f.title}: ${f.explanation}`), ...categoryOrder.flatMap(category => {
    const lines = grouped.get(category);
    return lines ? ["", `## ${categoryCatalog[category].label} (${lines.length} statements)`, categoryCatalog[category].purpose, ...lines.map(l => `L${l.line} [${l.status}] ${l.text}\n${l.scope} / ${l.section}${l.entry ? ` / ${l.entry}` : ""}: ${l.explanation}${l.reference ? `\nVendor reference: ${commandReferences[l.reference].title} (${RULES_REVIEWED}) ${commandReferences[l.reference].url}` : ""}`)] : [];
  })].join("\n");
}
