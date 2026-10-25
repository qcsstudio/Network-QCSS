import type { Category } from "./categories";
import type { Dialect, Selection } from "./catalog";
import type { CommandReference } from "./references";
import { fortinetWords } from "./fortinet-syntax";

export type DocumentedRule = { category: Category; explanation: string; reference: CommandReference };
type Check = (values: string[]) => boolean;
type Field = { explanation: string; check: Check; list?: boolean };
type Section = { category: Category; reference: CommandReference; entry: boolean; fields: Record<string, Field> };
const one: Check = values => values.length === 1 && values[0].length > 0;
const choices = (...allowed: string[]): Check => values => values.length === 1 && allowed.includes(values[0]);
const integer = (min: number, max: number): Check => values => values.length === 1 && /^\d+$/.test(values[0]) && Number(values[0]) >= min && Number(values[0]) <= max;
const ipv4 = (value: string) => /^(?:\d{1,3}\.){3}\d{1,3}$/.test(value) && value.split(".").every(n => Number(n) <= 255);
const address: Check = values => values.length === 1 && ipv4(values[0]);
const addresses: Check = values => values.length > 0 && values.every(ipv4);
const toggle = choices("enable", "disable");
const field = (explanation: string, check: Check = one, list = false): Field => ({ explanation, check, list });

// Exact sections are intentional: identical field names mean different things in nested tables.
export const fortiosSections: Record<string, Section> = {
  "firewall policy": { category: "Firewall", reference: "fortiPolicy", entry: true, fields: {
    "internet-service": field("Controls Internet Service Database matching for the destination. When enabled, ordinary destination-address and service conditions are not used; inspect the selected Internet Services.", toggle),
    "tcp-mss-sender": field("Sets the sender-side TCP maximum segment size, a limit on TCP data per segment. This is not interface MTU or a bandwidth limit.", integer(1, 65535)),
    "tcp-mss-receiver": field("Sets the receiver-side TCP maximum segment size. Path suitability is not measured; this differs from the sender-side setting.", integer(1, 65535)),
    "session-ttl": field("Configured session lifetime in seconds for this policy, not the IP packet's hop limit. Effective timers and active sessions require separate checks.", integer(1, 604800)),
    "auto-asic-offload": field("Controls eligible hardware acceleration on supported FortiGate models. It neither enables a security profile nor proves traffic is offloaded.", toggle),
  } },
  "system dhcp server": { category: "Network services", reference: "fortiDhcp", entry: true, fields: {
    status: field("Controls this DHCP address service; it does not confirm any client received settings.", toggle),
    interface: field("The connection on which this DHCP server offers clients their network settings."),
    "default-gateway": field("The router address offered to clients for reaching other networks.", address),
    netmask: field("The network-size mask offered to DHCP clients.", address),
    "dns-service": field("DNS finds addresses from names. local offers this interface; default offers system DNS; specify uses explicit DNS entries.", choices("local", "default", "specify")),
    "dns-server1": field("First explicitly configured DNS address offered to clients when dns-service is specify.", address),
    "dns-server2": field("Second explicitly configured DNS address offered to clients when dns-service is specify.", address),
    "lease-time": field("Address borrowing time, in seconds; zero means unlimited. This does not show current leases.", values => values[0] === "0" && values.length === 1 || integer(300, 8640000)(values)),
    domain: field("The domain suffix offered to clients, not ownership of that domain."),
  } },
  "system dhcp server ip-range": { category: "Network services", reference: "fortiDhcp", entry: true, fields: {
    "start-ip": field("First address in this configured DHCP allocation range.", address),
    "end-ip": field("Last address in this configured DHCP allocation range; exclusions and reservations still matter.", address),
  } },
  "system dhcp server reserved-address": { category: "Network services", reference: "fortiDhcp", entry: true, fields: {
    ip: field("Address specified for this reservation; its matching type and action must also be checked.", address),
    mac: field("Client hardware-address identifier for a MAC-based reservation; this is not authentication.", values => values.length === 1 && /^(?:[\da-f]{2}:){5}[\da-f]{2}$/i.test(values[0])),
  } },
  "system dns": { category: "Network services", reference: "fortiDns", entry: false, fields: {
    primary: field("A DNS resolver address used by the FortiGate itself to look up names, not a DHCP client assignment.", address),
    secondary: field("Another resolver address for the FortiGate's own name lookups; successful resolution is not measured.", address),
    protocol: field("DNS transport choices: cleartext is unencrypted; dot uses TLS; doh uses HTTPS. Successful encryption is not verified.", values => values.length > 0 && values.every(v => ["cleartext", "dot", "doh"].includes(v)), true),
    "server-hostname": field("DNS server hostname configured for encrypted DNS; the certificate and connection are not checked."),
    "source-ip": field("Local source IPv4 address selected for DNS requests, not the resolver's address.", address),
    "interface-select-method": field("How DNS requests choose an exit: auto, SD-WAN rules, or an explicitly specified interface.", choices("auto", "sdwan", "specify")),
    interface: field("Explicit outgoing interface for DNS when interface-select-method is specify."),
    "server-select-method": field("least-rtt prefers measured response time; failover uses primary then secondary. No response times are measured here.", choices("least-rtt", "failover")),
  } },
  "system ntp": { category: "Network services", reference: "fortiNtp", entry: false, fields: {
    ntpsync: field("Controls clock synchronization using Network Time Protocol (NTP), not proof the clock is accurate.", toggle),
    type: field("Chooses FortiGuard time servers or custom servers from the ntpserver table.", choices("fortiguard", "custom")),
    syncinterval: field("Time between clock synchronization attempts, in minutes.", integer(1, 1440)),
    "server-mode": field("Controls providing NTP time service to other devices; this is distinct from synchronizing this firewall's clock.", toggle),
    interface: field("Interfaces that listen for clients when NTP server mode is enabled.", values => values.length > 0 && values.every(Boolean), true),
    "source-ip": field("Local IPv4 source for requests to the time server.", address),
  } },
  "system ntp ntpserver": { category: "Network services", reference: "fortiNtp", entry: true, fields: {
    server: field("Address or hostname of a custom time server, not evidence that synchronization succeeded."),
    "interface-select-method": field("Selects automatic, SD-WAN, or explicitly specified egress for reaching this time server.", choices("auto", "sdwan", "specify")),
  } },
  "system sdwan members": { category: "SD-WAN", reference: "fortiSdwan", entry: true, fields: {
    interface: field("The existing interface included as this SD-WAN member. SD-WAN selects among configured network paths."),
    zone: field("The logical group containing this member; zones can be referenced by firewall policies."),
    gateway: field("Configured next router for this member; dynamically supplied gateways require runtime confirmation.", address),
    cost: field("Preference for cost-based SD-WAN selection, not a monetary charge or measured link quality.", integer(0, 4294967295)),
    priority: field("Member preference used in route and SD-WAN selection, not bandwidth. Other rules and health still matter.", integer(1, 65535)),
  } },
  "system sdwan health-check": { category: "SD-WAN", reference: "fortiHealth", entry: true, fields: {
    server: field("Target addresses or names for the path-health test; these are not measured results.", values => values.length > 0 && values.every(Boolean), true),
    protocol: field("Method used to test the path. Ping sends echo probes; success does not prove every application works.", choices("ping", "http", "dns", "tcp-echo", "udp-echo")),
    interval: field("Time between health-check probes, in milliseconds.", integer(20, 3600000)),
    members: field("Configured member numbers participating in this check. No health status is inferred.", values => values.length > 0 && values.every(v => integer(1, 4294967295)([v])), true),
  } },
  "log syslogd setting": { category: "Logging", reference: "fortiLogs", entry: false, fields: {
    status: field("Controls remote syslog logging, which sends event records to a collector. Delivery is not confirmed.", toggle),
    server: field("Destination collector for remote syslog records, not a source of network traffic rules."),
    format: field("Record format expected by the collector. Matching formats do not establish successful delivery.", choices("default", "csv", "cef", "rfc5424", "json")),
  } },
  "log syslogd filter": { category: "Logging", reference: "fortiLogs", entry: false, fields: {
    severity: field("Minimum importance threshold for logs sent to this target; not a vulnerability severity score.", choices("emergency", "alert", "critical", "error", "warning", "notification", "information", "debug")),
    "forward-traffic": field("Controls logging of traffic passing through the FortiGate, not permission to pass traffic.", toggle),
    "local-traffic": field("Controls logs for traffic to or from the FortiGate itself, not a firewall allow rule.", toggle),
  } },
  "system ha": { category: "High availability", reference: "fortiPickup", entry: false, fields: {
    "session-pickup": field("Controls sharing TCP connection state between FGCP cluster units to help resume connections after failover. Uninterrupted service is not guaranteed.", toggle),
    "session-pickup-connectionless": field("Adds UDP and ICMP session synchronization when session-pickup is enabled. This setting alone does not prove cluster health.", toggle),
  } },
};

export type FortiCommand = { version: string; operation: string; rawValue: string; entry: boolean };
export function documentedFortiRule(section: string, key: string, dialect: string, command?: FortiCommand): DocumentedRule | null | undefined {
  const definition = Object.hasOwn(fortiosSections, section) ? fortiosSections[section] : undefined;
  const setting = definition && Object.hasOwn(definition.fields, key) ? definition.fields[key] : undefined;
  if (!setting) return undefined;
  // null reserves a recognized field that failed validation: never fall back to a broader rule.
  if (!definition || dialect !== "fortios" || command?.version !== "FortiOS 7.4" || definition.entry !== command.entry) return null;
  const values = fortinetWords(command.rawValue);
  if (command.operation === "unset") {
    if (values.length) return null;
  } else {
    const supportedOperation = command.operation === "set" || setting.list && ["append", "unselect"].includes(command.operation);
    if (!supportedOperation || !setting.check(values)) return null;
  }
  return { category: definition.category, reference: definition.reference, explanation: setting.explanation };
}

type CiscoDefinition = DocumentedRule & { pattern: RegExp; context: RegExp; switchOnly?: boolean; check?: (match: RegExpMatchArray) => boolean };
export const documentedCiscoRules: CiscoDefinition[] = [
  { pattern: /^ip ospf cost (\d+)$/, context: /^interface /, category: "Routing", reference: "ciscoOspf", check: m => integer(1, 65535)([m[1]]), explanation: "OSPF exchanges routes between routers. This sets the interface's route cost, not money or link speed; it does not prove which route wins." },
  { pattern: /^ip ospf hello-interval (\d+)$/, context: /^interface /, category: "Routing", reference: "ciscoOspf", check: m => integer(1, 65535)([m[1]]), explanation: "Seconds between OSPF hello messages used to discover and maintain neighbours. Peers need compatible settings; no adjacency is verified." },
  { pattern: /^ip ospf dead-interval (\d+)$/, context: /^interface /, category: "Routing", reference: "ciscoOspf", check: m => integer(1, 65535)([m[1]]), explanation: "Seconds without an OSPF hello before a neighbour is declared down. This is not an application timeout or proof of a failed link." },
  { pattern: /^ip ospf priority (\d+)$/, context: /^interface /, category: "Routing", reference: "ciscoOspf", check: m => integer(0, 255)([m[1]]), explanation: "Priority used in OSPF designated-router selection on applicable networks, not a route cost. The current election result is unknown." },
  { pattern: /^ip dhcp pool \S+$/, context: /^ip dhcp pool \S+$/, category: "Network services", reference: "ciscoDhcp", explanation: "Defines a named DHCP pool: settings offered to devices requesting an address. It does not show current leases." },
  { pattern: /^network (\S+) (\S+)$/, context: /^ip dhcp pool /, category: "Network services", reference: "ciscoDhcp", check: m => ipv4(m[1]) && ipv4(m[2]), explanation: "The subnet from which this DHCP pool can allocate addresses, not a routing-protocol advertisement." },
  { pattern: /^default-router (.+)$/, context: /^ip dhcp pool /, category: "Network services", reference: "ciscoDhcp", check: m => addresses(m[1].split(/\s+/)), explanation: "Router addresses offered to DHCP clients for reaching other networks; this does not install a route on this device." },
  { pattern: /^dns-server (.+)$/, context: /^ip dhcp pool /, category: "Network services", reference: "ciscoDhcp", check: m => addresses(m[1].split(/\s+/)), explanation: "DNS resolver addresses offered to clients. DNS translates names to addresses; resolution is not tested." },
  { pattern: /^domain-name \S+$/, context: /^ip dhcp pool /, category: "Network services", reference: "ciscoDhcp", explanation: "Domain suffix offered to clients in this pool, not proof of domain ownership." },
  { pattern: /^lease (?:infinite|\d+(?: \d+){0,2})$/, context: /^ip dhcp pool /, category: "Network services", reference: "ciscoDhcp", explanation: "How long a client borrows an address: days, optionally hours and minutes; infinite has no expiry. Not a current lease record." },
  { pattern: /^ip dhcp excluded-address (\S+)(?: (\S+))?$/, context: /^Global$/, category: "Network services", reference: "ciscoDhcp", check: m => ipv4(m[1]) && (!m[2] || ipv4(m[2])), explanation: "Keeps one address or an inclusive address range out of automatic DHCP allocation. It is not a traffic block." },
  { pattern: /^ip name-server (.+)$/, context: /^Global$/, category: "Network services", reference: "ciscoDns", check: m => addresses(m[1].split(/\s+/)), explanation: "DNS resolvers for this device's own name lookups, not addresses offered to DHCP clients." },
  { pattern: /^ip domain(?:-| )name \S+$/, context: /^Global$/, category: "Network services", reference: "ciscoDns", explanation: "Suffix used to complete unqualified names for this device. It does not register or transfer a domain." },
  { pattern: /^(?:no )?ip domain(?:-| )lookup$/, context: /^Global$/, category: "Network services", reference: "ciscoDns", explanation: "Controls this device's DNS name lookup. The no form disables lookup; neither form establishes whether DNS servers are reachable." },
  { pattern: /^spanning-tree portfast(?: edge)?$/, context: /^interface /, switchOnly: true, category: "Switching", reference: "ciscoStp", explanation: "Enables faster transition to forwarding for an end-device port. This is not loop protection; incorrect use on switch links can create loops." },
  { pattern: /^spanning-tree bpduguard enable$/, context: /^interface /, switchOnly: true, category: "Switching", reference: "ciscoStp", explanation: "BPDU guard disables this port if it receives a spanning-tree control message (BPDU). This does not show whether it has triggered." },
  { pattern: /^spanning-tree bpdufilter enable$/, context: /^interface /, switchOnly: true, category: "Switching", reference: "ciscoStp", explanation: "Suppresses sending and receiving spanning-tree control messages on this port. It can permit switching loops; it is not BPDU guard." },
];

export function documentedCiscoRule(text: string, context: string, dialect: Dialect, selection?: Selection): DocumentedRule | null | undefined {
  // DHCP network syntax overlaps routing protocols, so it is claimed only inside its pool.
  const found = documentedCiscoRules.find(rule => rule.pattern.test(text) && (!/^network /.test(text) || context.startsWith("ip dhcp pool ")));
  if (!found) return /^ip ospf (?:cost|hello-interval|dead-interval|priority)\b/.test(text) ? null : undefined;
  if (dialect !== "ios" || selection?.version !== "IOS XE 17.x" || found.switchOnly && selection.profileId !== "cisco-switch" || !found.context.test(context)) return null;
  const match = text.match(found.pattern)!;
  if (found.check && !found.check(match)) return null;
  return { category: found.category, explanation: found.explanation, reference: found.reference };
}
