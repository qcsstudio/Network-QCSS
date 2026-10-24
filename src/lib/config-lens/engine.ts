import { getProfile, LENS_VERSION, type Selection } from "./catalog";
import { maskConfiguration } from "./masking";
import { ciscoRule, fortiRule, type Category } from "./rules";

export type Explanation = { line: number; text: string; context: string; category: Category; status: "explained" | "context" | "unknown" | "masked"; explanation: string };
export type Entity = { id: string; name: string; kind: string; scope: string; lines: number[]; settings: { key: string; value: string; line: number }[] };
export type Relationship = { from: string; to?: string; target: string; kind: string; line: number; scope: string };
export type Finding = { level: "review" | "information"; title: string; explanation: string; lines: number[] };
export type Analysis = {
  engine: string; selection: Selection; lines: Explanation[]; entities: Entity[]; relationships: Relationship[];
  findings: Finding[]; maskedSource: string; maskedCount: number;
  coverage: { explained: number; context: number; unknown: number; masked: number; total: number };
};
const words = (value: string) => Array.from(value.matchAll(/"([^"\n]*)"|'([^'\n]*)'|([^\s]+)/g), match => match[1] ?? match[2] ?? match[3]);
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

export function analyzeConfiguration(input: string, selection: Selection): Analysis {
  const profile = getProfile(selection.profileId);
  if (!profile || ![...profile.versions, "Other / unknown"].includes(selection.version) || !["running", "saved", "candidate", "unknown"].includes(selection.configType) || !/^[\w.() /-]{0,60}$/.test(selection.build)) throw new Error("Select a valid device family, OS train and configuration type.");
  const masked = maskConfiguration(input);
  checkDialect(input, profile.id);
  const explanations: Explanation[] = [], entities: Entity[] = [], relationships: Relationship[] = [], findings: Finding[] = [];
  const byId = new Map<string, Entity>();
  function entity(kind: string, name: string, scope: string, line: number) {
    const id = JSON.stringify([scope, kind, name]);
    let e = byId.get(id);
    if (!e) { e = { id, kind, name, scope, lines: [], settings: [] }; byId.set(id, e); entities.push(e); }
    if (!e.lines.includes(line)) e.lines.push(line);
    return e;
  }
  function relation(from: Entity, target: string, kind: string, line: number) {
    relationships.push({ from: from.id, target, kind, line, scope: from.scope });
  }
  function add(line: number, text: string, context: string, category: Category, status: Explanation["status"], explanation: string) {
    explanations.push({ line, text, context, category, status, explanation });
  }
  findings.push({ level: "information", title: "Configuration, not live state", explanation: "This is a read-only explanation of supplied statements. It does not test packets, infer physical cabling, verify security compliance, check current vulnerabilities or prove any link, route, policy or VPN works.", lines: [] });
  if (selection.configType !== "running") findings.push({ level: "review", title: "Not confirmed as running configuration", explanation: "Saved, candidate or unknown exports may differ from the device's active settings. Confirm the export type before relying on this report.", lines: [] });
  if (selection.version === "Other / unknown") findings.push({ level: "review", title: "OS version is unverified", explanation: "Only recognizable syntax is explained. No defaults or version-specific security conclusions are inferred.", lines: [] });
  if (profile.dialect === "ftd") findings.push({ level: "review", title: "FTD diagnostic output is partial", explanation: profile.scope, lines: [] });
  if (profile.dialect === "fortiweb") findings.push({ level: "review", title: "WAF scope and operating mode", explanation: profile.scope, lines: [] });
  const fortiVersion = input.match(/^#config-version=[^\r\n]*?-(\d+\.\d+\.\d+)-/m)?.[1];
  if (fortiVersion && !selection.version.includes("unknown") && !fortiVersion.startsWith(selection.version.match(/\d+\.\d+/)?.[0] || "unmatched")) findings.push({ level: "review", title: "Export version differs from selection", explanation: "The Fortinet version header does not match the selected OS train. Select the matching train and analyze again; version-dependent behavior has not been evaluated.", lines: [] });
  let current: Entity | undefined, context = "Global", scope = "default";
  type Frame = { type: "config" | "edit"; name: string; entity?: Entity };
  const stack: Frame[] = [];
  for (let index = 0; index < masked.lines.length; index++) {
    const text = masked.lines[index], line = index + 1, t = text.trim();
    if (!t) continue;
    if (masked.maskedLines.has(line)) {
      add(line, text, context, "Structure", "masked", "Sensitive or free-text content has been removed. Masked lines are not semantically evaluated.");
      continue;
    }
    if (profile.vendor === "fortinet") {
      const configs = () => stack.filter(f => f.type === "config").map(f => f.name);
      const currentSection = () => configs().filter(n => !["vdom", "global"].includes(n)).join(" ");
      const vdomIndex = stack.findIndex(f => f.type === "config" && f.name === "vdom");
      scope = vdomIndex >= 0 ? `VDOM ${stack.slice(vdomIndex + 1).find(f => f.type === "edit")?.name || "unselected"}` : configs().includes("global") ? "global" : "default";
      if (t.startsWith("config ")) {
        if (stack.length >= 32) throw new Error("Configuration nesting exceeds the supported depth.");
        stack.push({ type: "config", name: t.slice(7) });
        context = `${scope} / ${currentSection() || "context"}`;
        add(line, text, context, "Structure", "context", "Opens a configuration section. Its settings are interpreted only within this context."); continue;
      }
      if (t.startsWith("edit ")) {
        if (stack.length >= 32 || stack.at(-1)?.type !== "config") throw new Error("Unbalanced Fortinet edit/config structure. Supply a complete scoped export.");
        const name = words(t.slice(5)).join(" "), section = currentSection();
        const e = fortiKinds[section] ? entity(fortiKinds[section], name, scope, line) : undefined;
        stack.push({ type: "edit", name, entity: e });
        context = `${scope} / ${section} / ${name}`;
        add(line, text, context, "Structure", "context", `Selects the named entry ${name} in this section. Entry identifiers are not device identities.`); continue;
      }
      if (t === "next" || t === "end") {
        const expected = t === "next" ? "edit" : "config";
        if (stack.at(-1)?.type !== expected) throw new Error("Unbalanced Fortinet next/end structure. Supply a complete scoped export.");
        stack.pop(); context = `${scope} / ${currentSection() || "context"}`;
        add(line, text, context, "Structure", "context", "Closes the current entry or configuration section."); continue;
      }
      const setting = t.match(/^(set|unset|append|unselect) (\S+)(?:\s+(.*))?$/);
      if (setting) {
        const [, operation, key, rawValue = ""] = setting, value = words(rawValue).join(", ");
        const section = currentSection(), rule = fortiRule(section, key, profile.dialect);
        current = [...stack].reverse().find(f => f.entity)?.entity;
        if (current && stack.at(-1)?.entity === current && operation === "set") {
          current.settings.push({ key, value, line }); current.lines.push(line);
          const referenceKinds: Record<string, string> = { srcintf: "interface", dstintf: "interface", device: "interface", interface: "interface", srcaddr: "address", dstaddr: "address", service: "service", phase1name: "VPN peer", vserver: "virtual server", "server-pool": "server pool" };
          const kind = referenceKinds[key] || (key === "member" ? current.kind : "");
          if (kind) for (const target of words(rawValue)) relation(current, target, kind, line);
        }
        const summary = operation === "unset" ? "Removes an explicit setting; the version-specific default is not inferred." : operation !== "set" ? "Modifies an existing list; the final list is not calculated." : `${fieldMeaning[key] || key}: ${value}.`;
        add(line, text, context, rule?.category || "Structure", rule ? "explained" : "unknown", rule ? `${summary} ${rule.explanation}` : "This field or context is not covered by the current parser. Do not infer its effect from another product's syntax.");
        continue;
      }
    } else {
      if (/^(?:end|exit|exit-address-family)$/.test(t)) { current = undefined; context = "Global"; add(line, text, context, "Structure", "context", "Closes a configuration context."); continue; }
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
        current = entity(kind, name, scope, line); context = t;
        add(line, text, context, "Structure", "context", `Opens the ${kind} named ${name}. Following settings belong to this configuration context.`); continue;
      }
      if (!/^\s/.test(text)) { current = undefined; context = "Global"; }
      if (/^access-list (\S+)/.test(t)) { current = entity("ACL", t.split(/\s+/)[1], scope, line); }
      if (/^(?:ip|ipv6) route\s|^route\s/.test(t)) current = entity("route", `Static route at L${line}`, scope, line);
      if (current) { current.lines.push(line); current.settings.push({ key: t.split(/\s+/)[0], value: t, line }); }
      if (current?.kind === "interface") {
        if ((match = t.match(/^ip access-group (\S+)/))) relation(current, match[1], "ACL", line);
        if ((match = t.match(/^switchport access vlan (\d+)/))) relation(current, match[1], "VLAN", line);
        if ((match = t.match(/^(?:ip vrf forwarding|vrf forwarding|vrf member) (\S+)/))) relation(current, match[1], "VRF", line);
      }
      const rule = ciscoRule(t, context);
      add(line, text, context, rule?.category || "Structure", rule ? "explained" : "unknown", rule?.explanation || "This statement or context is not covered by this parser. It remains visible for vendor-documentation review.");
    }
  }
  if (stack.length) throw new Error("The Fortinet export ends inside a configuration block. Include its closing next/end lines before analysis.");
  for (const r of relationships) {
    const matches = entities.filter(e => e.kind === r.kind && e.name === r.target && e.scope === r.scope);
    if (matches.length === 1) r.to = matches[0].id;
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
  return [`QCS Config Lens ${result.engine}`, `${profile.name} / ${result.selection.version} / ${result.selection.configType}`, "Private local analysis. Review identifiers and unrecognized secrets before sharing.", "No runtime, vulnerability, compliance or reachability verification performed.", "", ...result.findings.map(f => `${f.title}: ${f.explanation}`), "", ...result.lines.map(l => `L${l.line} [${l.status}] ${l.text}\n${l.context}: ${l.explanation}`)].join("\n");
}
