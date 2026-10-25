import type { Category } from "./categories";
import type { Dialect, Selection } from "./catalog";
import type { CommandReference } from "./references";
import { documentedCiscoRule, documentedFortiRule, type FortiCommand } from "./documented-rules";
export type { Category } from "./categories";
export type RuleMatch = { category: Category; explanation: string; reference?: CommandReference };
export type Rule = RuleMatch & { pattern: RegExp; caution?: string };
export const ciscoRules: Rule[] = [
  { pattern: /^(?:no )?shutdown$/, category: "Interfaces", explanation: "Controls whether this interface is administratively disabled. 'no shutdown' removes that administrative disable; it does not prove the link is up." },
  { pattern: /^ip address\s/, category: "Interfaces", explanation: "Assigns an IPv4 address and mask, or requests an address dynamically, on this interface. An address identifies the connection in its network." },
  { pattern: /^ipv6 address\s/, category: "Interfaces", explanation: "Configures an IPv6 address on this interface. The prefix length identifies the IPv6 network." },
  { pattern: /^(?:no )?switchport$/, category: "Switching", explanation: "Selects switched-port behavior, or removes it for a routed interface where supported. Check the platform's port capabilities." },
  { pattern: /^switchport mode\s/, category: "Switching", explanation: "Selects how this port participates in VLAN switching. Access is normally one VLAN; trunk carries VLAN-tagged traffic according to its VLAN settings." },
  { pattern: /^switchport access vlan\s/, category: "Switching", explanation: "Selects the access VLAN for this port. This setting alone does not establish the port's operational mode." },
  { pattern: /^switchport trunk (?:allowed|native) vlan\s/, category: "Switching", explanation: "Sets trunk VLAN membership or the native VLAN. 'add', 'remove' and 'except' modify the list differently; this is not proof of the final active VLAN set." },
  { pattern: /^switchport voice vlan\s/, category: "Switching", explanation: "Specifies the voice VLAN used with supported phone access arrangements. The phone and port must negotiate or be configured appropriately." },
  { pattern: /^(?:no )?spanning-tree\s/, category: "Switching", explanation: "Configures a spanning-tree option. Spanning tree helps prevent switching loops; root selection and live forwarding state are not known from this statement." },
  { pattern: /^channel-group\s/, category: "Switching", explanation: "Assigns this port to a logical bundle. Matching settings and compatible peer negotiation are needed; membership does not prove the bundle is operational." },
  { pattern: /^(?:ip )?vrf forwarding\s|^vrf member\s/, category: "Routing", explanation: "Places this interface into a separate routing context. Routes in another context are not automatically available here." },
  { pattern: /^(?:ip|ipv6) route\s|^route\s/, category: "Routing", explanation: "Declares a static route: a destination network and an intended next hop or exit interface. Tracking, distance, context and next-hop reachability determine whether it is used." },
  { pattern: /^(?:ip routing|ipv6 unicast-routing)$/, category: "Routing", explanation: "Enables the platform's IP forwarding function where supported. Interfaces, routes and policies still determine actual forwarding." },
  { pattern: /^network\s/, category: "Routing", explanation: "A routing-process network statement. In OSPF it can select interfaces; in BGP it requests origination of a matching route. Exact meaning depends on this routing context." },
  { pattern: /^neighbor\s/, category: "Routing", explanation: "Sets a routing-neighbor property or policy. The neighbour is a configured relationship, not evidence that a session is established." },
  { pattern: /^(?:no )?passive-interface\s/, category: "Routing", explanation: "Controls routing-protocol participation on an interface. The effect depends on the protocol; it is not a general traffic-blocking rule." },
  { pattern: /^(?:ip ospf|area|router-id|redistribute|default-information originate|address-family)\s/, category: "Routing", explanation: "Sets a routing-process property. Redistribution can import routes between sources; policy and protocol details must be checked before predicting routes." },
  { pattern: /^access-list\s/, category: "Firewall", explanation: "Defines a numbered or named access-list entry. Permit/deny is meaningful within the list and its attachment; the entry alone does not establish access through the device." },
  { pattern: /^(?:\d+\s+)?(?:permit|deny|remark)\s/, category: "Firewall", explanation: "Adds an entry to this access list. Matching and order matter. A list may filter traffic or classify it for another feature; check its references." },
  { pattern: /^ip access-group\s|^ipv6 traffic-filter\s|^access-group\s/, category: "Firewall", explanation: "Attaches an access list to a traffic direction or context. Inbound means traffic entering that interface; outbound means traffic leaving it." },
  { pattern: /^(?:ip nat|nat|global)\s/, category: "Firewall", explanation: "Declares address-translation behavior or a NAT role. Rule order, matching, routing and the platform's NAT model require separate evaluation; NAT does not guarantee access." },
  { pattern: /^(?:host|subnet|range|network-object|group-object|service-object|port-object|object-group|fqdn)\s/, category: "Firewall", explanation: "Defines a reusable address/service object or a member reference. Objects affect traffic only where another rule or feature uses them." },
  { pattern: /^nameif\s/, category: "Interfaces", explanation: "Gives this firewall interface a logical name used by policies and routes. The name is not proof of its physical connection." },
  { pattern: /^security-level\s/, category: "Firewall", explanation: "Sets an ASA-style interface trust value. Effective access also depends on ACLs, same-security settings, routing and platform behavior." },
  { pattern: /^(?:crypto (?:map|ipsec|ikev1|ikev2|isakmp)|tunnel-group|tunnel (?:source|destination|mode)|group-policy)\b/, category: "VPN", explanation: "Declares VPN, cryptographic or tunnel settings. Peers must agree and the path must work; this configuration does not prove encryption is active or the tunnel is up." },
  { pattern: /^encapsulation dot1[qQ]\s/, category: "Switching", explanation: "Associates this subinterface with an 802.1Q VLAN tag. The connected port must carry the corresponding VLAN." },
  { pattern: /^ip helper-address\s/, category: "Network services", explanation: "Configures a destination for relayed broadcasts, including DHCP requests. This does not prove a reachable DHCP server will answer; forwarding depends on protocol settings." },
  { pattern: /^(?:hostname|version|boot system|feature|name|mtu|speed|duplex)\s/, category: "Management", explanation: "Sets an identity, software, feature or link property. A configuration declaration is not a live hardware or software inventory." },
  { pattern: /^(?:no )?(?:ip http|ip ssh|ssh|http|telnet|transport input|login|aaa|snmp-server|ntp|logging|service)\b/, category: "Management", explanation: "Controls a management, authentication, time or logging service. Exposure depends on bindings, policy and reachability; verify access before making changes." }
];

export function ciscoRule(text: string, context: string, dialect: Dialect = "ios", selection?: Selection): RuleMatch | undefined {
  const documented = documentedCiscoRule(text, context, dialect, selection);
  if (documented !== undefined) return documented || undefined;
  const found = ciscoRules.find(rule => rule.pattern.test(text));
  if (!found) return;
  if (/^(?:(?:no )?shutdown|ip address|ipv6 address|(?:no )?switchport|channel-group|nameif|security-level|encapsulation dot1[qQ]|ip helper-address)\b/.test(text) && !/^interface /.test(context)) return;
  if (/^ip helper-address\b/.test(text) && dialect !== "ios") return;
  if (/^network\s|^neighbor\s|^(?:no )?passive-interface\s/.test(text) && !/^router /.test(context)) return;
  if (/^(?:\d+\s+)?(?:permit|deny|remark)\s/.test(text) && !/access-list/.test(context)) return;
  if (/^(?:host|subnet|range|network-object|group-object|service-object|port-object|fqdn)\s/.test(text) && !/^object/.test(context)) return;
  return found;
}

type FieldDefinition = { section: RegExp; fields: string[]; category: Category; explanation: string };
const fortiFields: FieldDefinition[] = [
  { section: /^(system interface|switch interface)$/, fields: ["ip", "ip6-address", "mode", "type", "interface", "vlanid", "status", "mtu", "mtu-override", "speed", "role", "vdom", "member"], category: "Interfaces", explanation: "Sets an interface address, state, type or relationship. Configured membership is not proof of a physical connection or a working link." },
  { section: /^(system interface|switch interface)$/, fields: ["allowaccess", "ip6-allowaccess"], category: "Management", explanation: "Lists management protocols permitted on this interface by this setting. Trusted hosts and local-in policies can further restrict access; public exposure is not established." },
  { section: /^switch (?:interface|vlan)$/, fields: ["native-vlan", "allowed-vlans", "untagged-vlans", "stp-state", "edge-port", "vlanid"], category: "Switching", explanation: "Sets VLAN membership or spanning-tree behavior on a switch. Native, allowed and untagged VLAN lists have different meanings; peer configuration still matters." },
  { section: /^router static6?$/, fields: ["dst", "gateway", "device", "distance", "priority", "status", "vrf", "blackhole", "dynamic-gateway", "comment"], category: "Routing", explanation: "Sets a static route's destination, next hop, exit interface or selection property. A disabled, unreachable or less-preferred route may not forward traffic." },
  { section: /^router (?:bgp|ospf|ospf6|rip)(?: .*)?$/, fields: ["as", "router-id", "remote-as", "prefix", "network", "area", "interface", "neighbor", "redistribute", "status"], category: "Routing", explanation: "Configures a dynamic-routing parameter. Session establishment, learned routes and convergence require operational output, not just this declaration." },
  { section: /^firewall (?:policy|policy6)$/, fields: ["name", "srcintf", "dstintf", "srcaddr", "dstaddr", "service", "schedule", "action", "status", "nat", "ippool", "poolname", "logtraffic", "utm-status", "ssl-ssh-profile", "av-profile", "webfilter-profile", "ips-sensor", "application-list", "inspection-mode"], category: "Firewall", explanation: "Sets one part of an ordered firewall policy. Interface, address, service, schedule, action and security-profile references work together. No final traffic or protection verdict is inferred." },
  { section: /^firewall (?:address6?|addrgrp6?|service custom|service group|vip6?|ippool)$/, fields: ["subnet", "type", "fqdn", "start-ip", "end-ip", "member", "associated-interface", "extip", "mappedip", "extintf", "portforward", "extport", "mappedport", "protocol", "tcp-portrange", "udp-portrange", "startip", "endip"], category: "Firewall", explanation: "Defines an address, service, group or translation object. It affects behavior only when used; referenced members and rule placement need checking." },
  { section: /^vpn (?:ipsec|ssl)(?: .*)?$/, fields: ["interface", "remote-gw", "ike-version", "proposal", "dhgrp", "phase1name", "src-subnet", "dst-subnet", "keylife", "type", "peertype", "net-device", "auto-negotiate", "mode", "status"], category: "VPN", explanation: "Sets VPN peer, negotiation or traffic-selector properties. Agreement at both ends and runtime state are required before calling the tunnel working or secure." },
  { section: /^server-policy (?:policy|server-pool|vserver|virtual-server|server-pool pserver-list)$/, fields: ["vserver", "server-pool", "web-protection-profile", "service", "protocol", "ip", "interface", "port", "status", "deployment-mode", "operation-mode", "http-service", "https-service", "ssl", "certificate", "health", "lb-algo", "server-balance", "type", "domain"], category: "Application firewall", explanation: "Sets a web-policy, virtual endpoint or backend-pool property. Operating mode changes forwarding behavior; a profile reference alone does not prove application protection or backend health." },
  { section: /^system (?:global|settings|dns|ntp|admin|snmp.*|ha|central-management)$/, fields: ["hostname", "opmode", "vdom-mode", "central-nat", "primary", "secondary", "ntpsync", "server", "syncinterval", "accprofile", "trusthost1", "trusthost2", "trusthost3", "admin-sport", "admin-ssh-port", "mode", "group-name", "hbdev", "session-pickup", "override", "priority", "type"], category: "Management", explanation: "Sets a system, management, DNS, clock or availability property. Defaults, permissions and live peer state must be verified against this OS version." }
];
const systemFields: Record<string, string[]> = {
  "system global": ["hostname", "vdom-mode", "admin-sport", "admin-ssh-port"],
  "system settings": ["opmode", "central-nat"],
  "system dns": ["primary", "secondary"],
  "system ntp": ["ntpsync", "type", "syncinterval"],
  "system admin": ["accprofile", "trusthost1", "trusthost2", "trusthost3"],
  "system ha": ["mode", "group-name", "hbdev", "session-pickup", "override", "priority"],
  "system central-management": ["type"],
};
export function fortiRule(section: string, field: string, dialect: string, command?: FortiCommand): RuleMatch | undefined {
  const documented = documentedFortiRule(section, field, dialect, command);
  if (documented !== undefined) return documented || undefined;
  if (dialect !== "fortiweb" && section.startsWith("server-policy")) return;
  if (dialect !== "fortios" && /^(?:firewall|vpn|router)/.test(section)) return;
  if (dialect === "fortios" && section.startsWith("switch ")) return;
  if (dialect === "fortios" && section === "system interface" && ["snmp-index", "ip-managed-by-fortiipam"].includes(field)) {
    return { category: "Interfaces" as const, explanation: field === "snmp-index" ? "An identifier used by SNMP monitoring to distinguish this interface. This is not an IP address or an SNMP access permission." : "Controls whether IP address management (IPAM) manages this interface's address. inherit-global defers to the system IPAM setting; enable and disable explicitly select participation. It does not prove an address was allocated." };
  }
  const rule = fortiFields.find(def => def.section.test(section) && def.fields.includes(field));
  if (!rule) return;
  // Previously one combined field list incorrectly explained DNS fields as HA and vice versa.
  if (Object.hasOwn(systemFields, section) && !systemFields[section].includes(field)) return;
  const detail = fortiFieldDetail(section, field);
  return detail ? { ...rule, explanation: detail } : rule;
}

function fortiFieldDetail(section: string, field: string): string | undefined {
  if (section === "system interface") return ({
    ip: "The first value is this connection's IPv4 address; the mask describes its network size. Assignment does not prove that the connection is reachable.",
    mode: "Selects how the interface obtains its address, for example a static assignment or DHCP. DHCP asks an address server for settings; a lease is not confirmed here.",
    role: "Labels the interface's intended role, such as LAN or WAN. A LAN role does not by itself allow traffic or prove which devices are connected.",
    type: "Declares the kind of connection, such as a physical port, VLAN or tunnel. This is configuration, not an inventory of connected equipment.",
    interface: "Names the parent interface for this logical connection. This reference is not a physical cable discovered by the tool.",
    vlanid: "Identifies the VLAN tag associated with this logical interface. The peer must carry the corresponding VLAN.",
    status: "Controls the configured administrative state. An enabled interface can still have a disconnected cable or an operational fault.",
    allowaccess: "Names management protocols this interface allows by this setting. These access the FortiGate itself, not traffic passing through it; other management restrictions still apply.",
    vdom: "Assigns the interface to a virtual firewall context. VDOMs separate configuration and traffic-processing contexts.",
    mtu: "The configured maximum transmission unit is a packet-size limit. Whether an override applies and whether the path supports that size need checking."
  } as Record<string, string>)[field];
  if (/^firewall policy6?$/.test(section)) return ({
    srcintf: "The incoming interface condition: where matching traffic enters the firewall.",
    dstintf: "The outgoing interface condition: the interface selected for forwarding must match this policy condition.",
    srcaddr: "Reusable source address names used by this rule. Inspect their definitions to understand the actual networks.",
    dstaddr: "Reusable destination address names used by this rule. An object name alone does not identify every matching destination.",
    service: "Service definitions identify protocol/port conditions. A familiar service name does not verify application traffic.",
    action: "The configured action for a matching policy. This is not a prediction for a packet: rule order, routing and other conditions still matter.",
    nat: "Controls this policy's source address translation setting. Central NAT mode and other NAT rules must also be checked.",
    schedule: "References the time schedule used by the rule. The current time and schedule definition are not evaluated.",
    status: "Enables or disables this configured policy. Enabled is not proof that a particular connection is allowed.",
    logtraffic: "Selects the policy's traffic-logging behavior. It does not show actual log events or prove they reach a collector."
  } as Record<string, string>)[field];
  if (/^router static6?$/.test(section)) return ({
    dst: "The destination network this route describes. A default route is a fallback when no more-specific eligible route is selected.",
    gateway: "The next router address this route points toward. The next hop must still be reachable.",
    device: "The configured exit interface or tunnel for this route, not proof that it is operational.",
    distance: "An administrative preference used when comparing route sources. This is not link speed or physical distance.",
    priority: "A route-selection preference, not a bandwidth or response-time measurement.",
    blackhole: "A blackhole route discards matching traffic when selected instead of forwarding it to another device.",
    status: "Whether this static route is administratively enabled. Its presence in the active routing table is not known."
  } as Record<string, string>)[field];
  if (/^vpn ipsec/.test(section)) return ({
    interface: "The local connection used for the VPN peer relationship. No tunnel state has been measured.",
    "remote-gw": "The configured remote peer address for negotiation. Reachability and successful authentication are not established.",
    "ike-version": "The Internet Key Exchange version proposed for negotiating the VPN. Both peers need compatible settings.",
    phase1name: "Links this traffic-selector definition to its parent VPN peer configuration.",
    "src-subnet": "The local-side network condition in this VPN selector; routing and firewall rules still apply.",
    "dst-subnet": "The remote-side network condition in this VPN selector; it is not proof that remote hosts are reachable."
  } as Record<string, string>)[field];
}
