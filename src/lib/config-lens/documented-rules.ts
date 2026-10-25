import type { Category } from "./categories";
import type { Dialect, Selection } from "./catalog";
import { referenceForTrain, type CommandReference } from "./references";
import { fortinetWords } from "./fortinet-syntax";

export type DocumentedRule = { category: Category; explanation: string; reference: CommandReference };
type Check = (values: string[]) => boolean;
type Field = { explanation: string; check: Check; list?: boolean; reference?: CommandReference };
type Section = { category: Category; reference: CommandReference; entry: boolean; fields: Record<string, Field> };
const one: Check = values => values.length === 1 && values[0].length > 0;
const choices = (...allowed: string[]): Check => values => values.length === 1 && allowed.includes(values[0]);
const integer = (min: number, max: number): Check => values => values.length === 1 && /^\d+$/.test(values[0]) && Number(values[0]) >= min && Number(values[0]) <= max;
const ipv4 = (value: string) => /^(?:\d{1,3}\.){3}\d{1,3}$/.test(value) && value.split(".").every(n => Number(n) <= 255);
const address: Check = values => values.length === 1 && ipv4(values[0]);
const addresses: Check = values => values.length > 0 && values.every(ipv4);
const mask = (value: string) => ipv4(value) && /^1*0*$/.test(value.split(".").map(n => Number(n).toString(2).padStart(8, "0")).join(""));
const toggle = choices("enable", "disable");
const field = (explanation: string, check: Check = one, list = false): Field => ({ explanation, check, list });

// Exact sections are intentional: identical field names mean different things in nested tables.
export const fortiosSections: Record<string, Section> = {
  "system interface": { category: "Interfaces", reference: "fortiInterface", entry: true, fields: {
    "lacp-mode": field("Link Aggregation Control Protocol (LACP) negotiates a bundle of ports. active starts negotiation; passive waits; static does not use LACP. No working bundle is confirmed.", choices("active", "passive", "static")),
    "lacp-speed": field("LACP control-message timing: fast is one second; slow is 30 seconds. This is not the bundle's traffic speed.", choices("fast", "slow")),
    "min-links": field("Minimum active member ports required for an aggregate. It is a configured threshold, not a count of currently working links.", integer(1, 32)),
    "min-links-down": field("How an aggregate is marked down below min-links: operational changes its operational state; administrative changes its administrative state.", choices("operational", "administrative")),
    defaultgw: field("Controls learning a gateway from DHCP or PPPoE, which supply connection settings. A learned gateway or installed default route is not confirmed.", toggle),
    "dns-server-override": field("Controls using DNS servers learned by this interface through DHCP or PPPoE. This is not a DNS server offered to LAN clients.", toggle),
    "dhcp-relay-service": field("Controls relaying clients' DHCP address requests to a server elsewhere. A relay forwards requests; it does not allocate addresses itself.", toggle),
    "dhcp-relay-ip": field("Destination DHCP server addresses for relayed requests. Successful replies and client address assignments are not verified.", addresses, true),
    distance: field("Preference for routes learned through DHCP or PPPoE; lower values are preferred when comparing administrative distance. It is not physical distance or speed.", integer(1, 255)),
    "device-identification": field("Controls passive collection of information about devices on this connection. Identification does not authenticate or allow those devices.", toggle),
    "secondary-IP": field("Controls additional IPv4 addresses on this interface. Their addresses belong in the secondaryip table; this is not another physical port.", toggle),
    "lldp-reception": field("Controls receiving Link Layer Discovery Protocol neighbour announcements. vdom inherits the virtual firewall's setting. No neighbours have been discovered by this tool.", choices("enable", "disable", "vdom")),
    "lldp-transmission": field("Controls sending Link Layer Discovery Protocol announcements to neighbours. vdom inherits the virtual firewall's setting; this is not packet forwarding permission.", choices("enable", "disable", "vdom")),
    "estimated-upstream-bandwidth": field("Configured estimate of outgoing capacity in kilobits per second, used to estimate utilization. It is neither a speed test nor a traffic limit.", integer(0, 4294967295)),
    "estimated-downstream-bandwidth": field("Configured estimate of incoming capacity in kilobits per second. Actual throughput and enforcement are not established by this estimate.", integer(0, 4294967295)),
  } },
  "system interface secondaryip": { category: "Interfaces", reference: "fortiInterface", entry: true, fields: {
    ip: field("An additional IPv4 address and network mask on the parent interface. Its use depends on secondary-IP; no extra physical connection is inferred.", values => values.length === 2 && ipv4(values[0]) && mask(values[1])),
    allowaccess: field("Management protocols allowed at this secondary address by this setting. These reach the FortiGate itself; other management restrictions still apply.", values => values.length > 0 && values.every(v => ["ping", "https", "ssh", "snmp", "http", "telnet"].includes(v)), true),
  } },
  "firewall policy": { category: "Firewall", reference: "fortiPolicy", entry: true, fields: {
    "srcaddr-negate": { ...field("When enabled, the source condition excludes the listed source addresses. This reverses a match, not the policy's allow/deny action.", toggle), reference: "fortiPolicyCli" },
    "dstaddr-negate": { ...field("When enabled, the destination condition excludes the listed destination addresses. Rule order and every other condition still matter.", toggle), reference: "fortiPolicyCli" },
    "service-negate": { ...field("When enabled, matches services outside the listed service definitions. This does not change those definitions or independently allow traffic.", toggle), reference: "fortiPolicyCli" },
    fixedport: { ...field("Prevents source NAT from changing the connection's source port when applicable. It is not destination port forwarding or permission to pass traffic.", toggle), reference: "fortiPolicyCli" },
    "logtraffic-start": { ...field("Controls recording a log when a connection starts. Logging settings and destinations still matter; no delivery is confirmed.", toggle), reference: "fortiPolicyCli" },
    "match-vip": { ...field("Controls matching traffic whose destination was translated by a virtual IP (VIP). It neither creates a VIP nor proves traffic is allowed.", toggle), reference: "fortiPolicyCli" },
    "send-deny-packet": { ...field("Controls sending a reply when this policy denies or blocks a connection. It is not an allow rule.", toggle), reference: "fortiPolicyCli" },
    "internet-service": field("Controls Internet Service Database matching for the destination. When enabled, ordinary destination-address and service conditions are not used; inspect the selected Internet Services.", toggle),
    "tcp-mss-sender": field("Sets the sender-side TCP maximum segment size, a limit on TCP data per segment. This is not interface MTU or a bandwidth limit.", integer(1, 65535)),
    "tcp-mss-receiver": field("Sets the receiver-side TCP maximum segment size. Path suitability is not measured; this differs from the sender-side setting.", integer(1, 65535)),
    "session-ttl": field("Configured session lifetime in seconds for this policy, not the IP packet's hop limit. Effective timers and active sessions require separate checks.", integer(1, 604800)),
    "auto-asic-offload": field("Controls eligible hardware acceleration on supported FortiGate models. It neither enables a security profile nor proves traffic is offloaded.", toggle),
  } },
  "router bgp": { category: "Routing", reference: "fortiBgp", entry: false, fields: {
    "ebgp-multipath": field("Controls using multiple eligible external BGP paths, learned across routing organizations. It does not guarantee equal traffic sharing.", toggle),
    "ibgp-multipath": field("Controls multiple eligible internal BGP paths within one routing organization. Installed routes and active paths are not measured.", toggle),
    "log-neighbour-changes": field("Controls recording BGP neighbour changes. A configured neighbour is not proof of an established session.", toggle),
    "graceful-restart": field("Controls BGP graceful-restart capability, which helps peers retain routing information during a restart. Uninterrupted forwarding is not guaranteed.", toggle),
  } },
  "router bgp neighbor": { category: "Routing", reference: "fortiBgp", entry: true, fields: {
    "prefix-list-in": field("Names the IPv4 prefix filter for route updates received from this neighbour. It is not a packet-filter rule.", values => one(values) && values[0].length <= 35),
    "prefix-list-out": field("Names the IPv4 prefix filter for route updates sent to this neighbour, not a list of current advertised routes.", values => one(values) && values[0].length <= 35),
    "route-map-in": field("Names the inbound IPv4 route policy for this neighbour. Its separate rules must be inspected; accepted routes are not calculated.", values => one(values) && values[0].length <= 35),
    "route-map-out": field("Names the outbound IPv4 route policy for this neighbour. This does not show which routes the peer received.", values => one(values) && values[0].length <= 35),
  } },
  "vpn ipsec phase1-interface": { category: "VPN", reference: "fortiPhase1", entry: true, fields: {
    dpd: field("Dead Peer Detection checks the VPN peer: disable turns it off; on-idle checks during idle periods; on-demand checks when sent traffic gets no peer reply. No peer was tested here.", choices("disable", "on-idle", "on-demand")),
    "dpd-retrycount": field("Number of Dead Peer Detection retry attempts, not a count of lost data packets.", integer(0, 10)),
    nattraversal: field("NAT traversal carries IPsec through address translation using UDP encapsulation. enable permits it, forced requests it regardless of detected NAT, and disable turns it off. No tunnel is verified.", choices("enable", "disable", "forced")),
    fragmentation: field("Controls fragmenting IKE negotiation messages on retransmission. This is not a general setting for fragmenting application traffic.", toggle),
    "negotiate-timeout": field("Maximum wait in seconds for IKE security-association negotiation. A security association is the peers' agreed protection state; success is not confirmed.", integer(1, 300)),
    reauth: field("Controls authenticating again when the IKE security association expires. This does not verify either peer's identity.", toggle),
    "add-route": field("Controls adding a route toward the peer's destination selector. This is not proof of a route in the active routing table.", toggle),
  } },
  "vpn ipsec phase2-interface": { category: "VPN", reference: "fortiPhase2", entry: true, fields: {
    pfs: field("Perfect Forward Secrecy requests a fresh key exchange for IPsec keys. Both peers need compatible settings; security is not verified.", toggle),
    replay: field("Controls detecting reused IPsec packets. This is replay protection, not session recording.", toggle),
    "auto-negotiate": field("Controls automatic negotiation of the IPsec security association. Enabled does not mean the tunnel is up.", toggle),
    "keylife-type": field("Chooses a key lifetime measured in seconds, kilobytes of traffic (kbs), or both. This is not a bandwidth limit.", choices("seconds", "kbs", "both")),
    keylifeseconds: field("Phase 2 key lifetime in seconds, when selected by keylife-type. Actual negotiation and expiry are not observed.", integer(120, 172800)),
    keylifekbs: field("Phase 2 key lifetime in kilobytes of traffic, when selected by keylife-type. It does not measure throughput.", integer(5120, 4294967295)),
    protocol: field("IP protocol-number condition for the traffic selector; zero means all protocols. It is not a TCP/UDP port number.", integer(0, 255)),
    "src-port": field("Source-port condition in this VPN selector; zero means all ports. The protocol condition and firewall policies still apply.", integer(0, 65535)),
    "dst-port": field("Destination-port condition in this VPN selector; zero means all ports. This does not open a listening service.", integer(0, 65535)),
  } },
  "system dhcp server": { category: "Network services", reference: "fortiDhcp", entry: true, fields: {
    status: field("Controls this DHCP address service; it does not confirm any client received settings.", toggle),
    interface: field("The connection on which this DHCP server offers clients their network settings."),
    "default-gateway": field("The router address offered to clients for reaching other networks.", address),
    netmask: field("The network-size mask offered to DHCP clients.", values => values.length === 1 && mask(values[0])),
    "dns-service": field("DNS finds addresses from names. local offers this interface; default offers system DNS; specify uses explicit DNS entries.", choices("local", "default", "specify")),
    "dns-server1": field("First explicitly configured DNS address offered to clients when dns-service is specify.", address),
    "dns-server2": field("Second explicitly configured DNS address offered to clients when dns-service is specify.", address),
    "dns-server3": field("Third explicitly configured DNS address offered to DHCP clients when dns-service is specify.", address),
    "conflicted-ip-timeout": field("Seconds to wait before reusing an address removed from the pool after a conflict. A conflict means another device may already use the address; none is detected here.", integer(60, 8640000)),
    "ntp-service": field("How clients receive clock servers: local offers this interface, default offers the FortiGate's NTP servers, and specify uses explicit entries. Client synchronization is not verified.", choices("local", "default", "specify")),
    "ntp-server1": field("First explicit time-server address offered to DHCP clients when ntp-service is specify, not the firewall's own clock configuration.", address),
    "ntp-server2": field("Second explicit time-server address offered to DHCP clients when ntp-service is specify.", address),
    "timezone-option": field("Whether DHCP offers no time zone (disable), the firewall's zone (default), or an explicitly selected zone (specify). It does not set the firewall's clock.", choices("disable", "default", "specify")),
    "lease-time": field("Address borrowing time, in seconds; zero means unlimited. This does not show current leases.", values => values[0] === "0" && values.length === 1 || integer(300, 8640000)(values)),
    domain: field("The domain suffix offered to clients, not ownership of that domain."),
  } },
  "system dhcp server ip-range": { category: "Network services", reference: "fortiDhcp", entry: true, fields: {
    "start-ip": field("First address in this configured DHCP allocation range.", address),
    "end-ip": field("Last address in this configured DHCP allocation range; exclusions and reservations still matter.", address),
  } },
  "system dhcp server reserved-address": { category: "Network services", reference: "fortiDhcp", entry: true, fields: {
    action: field("reserved assigns the reserved address; assign treats the client normally; block prevents this DHCP server assigning its settings. block is not a firewall traffic-deny rule.", choices("reserved", "assign", "block")),
    ip: field("Address specified for this reservation; its matching type and action must also be checked.", address),
    mac: field("Client hardware-address identifier for a MAC-based reservation; this is not authentication.", values => values.length === 1 && /^(?:[\da-f]{2}:){5}[\da-f]{2}$/i.test(values[0])),
  } },
  "system dhcp server exclude-range": { category: "Network services", reference: "fortiDhcp", entry: true, fields: {
    "start-ip": field("First address withheld from DHCP allocation in this exclusion range. This does not block traffic from that address.", address),
    "end-ip": field("Last address withheld from DHCP allocation in this exclusion range, not a firewall destination rule.", address),
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
    timeout: field("Seconds to wait for a DNS query response. A timeout setting does not show whether the resolver is working.", integer(1, 10)),
    retry: field("Number of retries for DNS requests, not the number of DNS servers.", integer(0, 5)),
    "dns-cache-limit": field("Maximum number of DNS records kept in the cache, a temporary store of lookup answers. This is not a byte or traffic limit.", integer(0, 4294967295)),
    "dns-cache-ttl": field("Seconds DNS information can remain in the cache. This is a storage lifetime, not a packet's hop limit.", integer(60, 86400)),
    "fqdn-cache-ttl": field("Cache lifetime in seconds for fully qualified domain name address records. Per-address settings can override it; this does not verify current resolved addresses.", integer(0, 86400)),
    "fqdn-min-refresh": field("Minimum time between refreshing fully qualified domain name records, in seconds. No lookup or refresh is performed by this tool.", integer(10, 3600)),
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
  const reference = command && definition && referenceForTrain(setting.reference || definition.reference, command.version);
  if (!definition || dialect !== "fortios" || !reference || !command || definition.entry !== command.entry) return null;
  const values = fortinetWords(command.rawValue);
  if (command.operation === "unset") {
    if (values.length) return null;
  } else {
    const supportedOperation = command.operation === "set" || setting.list && ["append", "unselect"].includes(command.operation);
    if (!supportedOperation || !setting.check(values)) return null;
  }
  return { category: definition.category, reference, explanation: setting.explanation };
}

type CiscoDefinition = DocumentedRule & { pattern: RegExp; context: RegExp; switchOnly?: boolean; routerOnly?: boolean; check?: (match: RegExpMatchArray) => boolean };
export const documentedCiscoRules: CiscoDefinition[] = [
  { pattern: /^log-adjacency-changes(?: detail)?$/, context: /^router ospf \d+(?: vrf \S+)?$/, category: "Routing", reference: "ciscoOspf", explanation: "Records OSPF neighbour up/down changes; detail records each state change. It does not enable OSPF or prove a neighbour is reachable." },
  { pattern: /^auto-cost reference-bandwidth (\d+)$/, context: /^router ospf \d+(?: vrf \S+)?$/, category: "Routing", reference: "ciscoOspf", check: m => integer(1, 4294967)([m[1]]), explanation: "Reference bandwidth in megabits per second for automatic OSPF cost calculation. It is not a speed setting; manual interface costs and other routes still matter." },
  { pattern: /^channel-protocol (?:lacp|pagp)$/, context: /^interface /, switchOnly: true, category: "Switching", reference: "ciscoLayer2", explanation: "Restricts port-bundle negotiation to LACP or Cisco PAgP. The channel-group settings and peer configuration are still required; a working bundle is not confirmed." },
  { pattern: /^lacp rate (?:fast|normal)$/, context: /^interface /, switchOnly: true, category: "Switching", reference: "ciscoLayer2", explanation: "LACP controls link-bundle negotiation. fast requests one-second control messages; normal uses 30 seconds. This is not data-transfer speed." },
  { pattern: /^switchport nonegotiate$/, context: /^interface /, switchOnly: true, category: "Switching", reference: "ciscoLayer2", explanation: "Stops Dynamic Trunking Protocol (DTP) negotiation messages. Use with a configured access or trunk mode; it does not itself establish a trunk." },
  { pattern: /^spanning-tree guard (?:root|loop|none)$/, context: /^interface /, switchOnly: true, category: "Switching", reference: "ciscoLayer2", explanation: "root prevents this port becoming a path to the spanning-tree root; loop guards against missing control messages; none selects neither guard. Current blocking state is unknown." },
  { pattern: /^zone-member security \S+$/, context: /^interface /, routerOnly: true, category: "Firewall", reference: "ciscoZone", explanation: "Assigns this interface to a firewall security zone. Inter-zone traffic needs appropriate zone-pair policies; membership alone is not permission or a packet verdict." },
  { pattern: /^encryption ((?:aes-cbc-(?:128|192|256))(?: aes-cbc-(?:128|192|256))*)$/, context: /^crypto ikev2 proposal \S+$/, routerOnly: true, category: "VPN", reference: "ciscoIkev2", explanation: "AES-CBC encryption choices for IKEv2 negotiation, with key sizes in bits. This protects negotiation, not proof of the data tunnel's negotiated encryption." },
  { pattern: /^integrity ((?:sha256|sha384|sha512)(?: (?:sha256|sha384|sha512))*)$/, context: /^crypto ikev2 proposal \S+$/, routerOnly: true, category: "VPN", reference: "ciscoIkev2", explanation: "SHA-2 integrity choices detect changes to IKEv2 messages. They are not encryption; separate integrity is incompatible with AES-GCM proposals. Compatibility is not validated here." },
  { pattern: /^group ((?:14|15|16|19|20|24)(?: (?:14|15|16|19|20|24))*)$/, context: /^crypto ikev2 proposal \S+$/, routerOnly: true, category: "VPN", reference: "ciscoIkev2", explanation: "Diffie-Hellman group choices for agreeing key material with the peer. Group numbers are identifiers, not tunnel counts or proof of a secure connection." },
  { pattern: /^proposal \S+$/, context: /^crypto ikev2 policy \S+$/, routerOnly: true, category: "VPN", reference: "ciscoIkev2", explanation: "References a named IKEv2 proposal in this negotiation policy. Its algorithms and the peer's settings must be checked separately." },
  { pattern: /^set ikev2-profile \S+$/, context: /^crypto ipsec profile \S+$/, routerOnly: true, category: "VPN", reference: "ciscoZone", explanation: "Connects this IPsec profile to a named IKEv2 profile for peer negotiation. It does not expose keys or establish a working tunnel." },
  { pattern: /^tunnel protection ipsec profile \S+$/, context: /^interface (?:Tunnel\S+|Virtual-Template\S+ type tunnel)$/i, routerOnly: true, category: "VPN", reference: "ciscoIkev2", explanation: "Attaches an IPsec protection profile to this tunnel interface. Profile definitions, routing and peer agreement still matter; encryption is not measured." },
  { pattern: /^(?:no )?ip redirects$/, context: /^interface /, category: "Interfaces", reference: "ciscoIpServices", explanation: "Controls sending ICMP redirect messages that tell a sender about another next hop. The no form disables them; this is not a firewall rule or proof of the route used." },
  { pattern: /^(?:no )?ip unreachables$/, context: /^interface /, category: "Interfaces", reference: "ciscoIpServices", explanation: "Controls ICMP unreachable error messages; the no form disables them. These messages can help troubleshooting and path-MTU discovery. This does not control whether all traffic is reachable." },
  { pattern: /^(?:no )?ip proxy-arp$/, context: /^interface /, category: "Interfaces", reference: "ciscoIpServices", explanation: "Controls answering ARP address-resolution requests on behalf of other hosts. The no form disables proxy ARP here. Routing and reachability are not verified." },
  { pattern: /^ip ospf cost (\d+)$/, context: /^interface /, category: "Routing", reference: "ciscoOspf", check: m => integer(1, 65535)([m[1]]), explanation: "OSPF exchanges routes between routers. This sets the interface's route cost, not money or link speed; it does not prove which route wins." },
  { pattern: /^ip ospf hello-interval (\d+)$/, context: /^interface /, category: "Routing", reference: "ciscoOspf", check: m => integer(1, 65535)([m[1]]), explanation: "Seconds between OSPF hello messages used to discover and maintain neighbours. Peers need compatible settings; no adjacency is verified." },
  { pattern: /^ip ospf dead-interval (\d+)$/, context: /^interface /, category: "Routing", reference: "ciscoOspf", check: m => integer(1, 65535)([m[1]]), explanation: "Seconds without an OSPF hello before a neighbour is declared down. This is not an application timeout or proof of a failed link." },
  { pattern: /^ip ospf priority (\d+)$/, context: /^interface /, category: "Routing", reference: "ciscoOspf", check: m => integer(0, 255)([m[1]]), explanation: "Priority used in OSPF designated-router selection on applicable networks, not a route cost. The current election result is unknown." },
  { pattern: /^ip dhcp pool \S+$/, context: /^ip dhcp pool \S+$/, category: "Network services", reference: "ciscoDhcp", explanation: "Defines a named DHCP pool: settings offered to devices requesting an address. It does not show current leases." },
  { pattern: /^network (\S+) (\S+)$/, context: /^ip dhcp pool /, category: "Network services", reference: "ciscoDhcp", check: m => ipv4(m[1]) && (mask(m[2]) || /^\/(?:[0-9]|[12][0-9]|3[0-2])$/.test(m[2])), explanation: "The subnet from which this DHCP pool can allocate addresses, not a routing-protocol advertisement. A slash prefix counts the network bits; a dotted mask expresses the same boundary." },
  { pattern: /^default-router (.+)$/, context: /^ip dhcp pool /, category: "Network services", reference: "ciscoDhcp", check: m => m[1].split(/\s+/).length <= 8 && addresses(m[1].split(/\s+/)), explanation: "Router addresses offered to DHCP clients for reaching other networks; this does not install a route on this device." },
  { pattern: /^dns-server (.+)$/, context: /^ip dhcp pool /, category: "Network services", reference: "ciscoDhcp", check: m => m[1].split(/\s+/).length <= 8 && addresses(m[1].split(/\s+/)), explanation: "DNS resolver addresses offered to clients. DNS translates names to addresses; resolution is not tested." },
  { pattern: /^bootfile \S+$/, context: /^ip dhcp pool /, category: "Network services", reference: "ciscoDhcp", explanation: "Name of the boot image offered to DHCP clients. It describes what a client may load, not a firmware upgrade for this network device." },
  { pattern: /^next-server (.+)$/, context: /^ip dhcp pool /, category: "Network services", reference: "ciscoDhcp", check: m => m[1].split(/\s+/).length <= 8 && addresses(m[1].split(/\s+/)), explanation: "Boot-server addresses offered to DHCP clients for the next stage of startup. These are not default gateways or proof that a boot image exists." },
  { pattern: /^netbios-name-server (.+)$/, context: /^ip dhcp pool /, category: "Network services", reference: "ciscoDhcp", check: m => m[1].split(/\s+/).length <= 8 && addresses(m[1].split(/\s+/)), explanation: "WINS/NetBIOS name-server addresses offered to clients for legacy Windows name lookup. This is separate from DNS." },
  { pattern: /^netbios-node-type (?:b-node|p-node|m-node|h-node)$/, context: /^ip dhcp pool /, category: "Network services", reference: "ciscoDhcp", explanation: "Specifies a legacy NetBIOS name-resolution method offered to Microsoft DHCP clients. It does not change this device's routing or DNS service." },
  { pattern: /^utilization mark (?:high|low) (\d+)(?: log)?$/, context: /^ip dhcp pool /, category: "Network services", reference: "ciscoDhcp", check: m => integer(0, 100)([m[1]]), explanation: "A high or low percentage threshold for DHCP pool use; log requests a message when its threshold condition occurs. It does not limit traffic or show current pool use." },
  { pattern: /^import all$/, context: /^ip dhcp pool /, category: "Network services", reference: "ciscoDhcp", explanation: "Imports DHCP options learned by the device into this pool. This does not import a configuration file or establish which options were actually learned." },
  { pattern: /^(?:no )?service dhcp$/, context: /^Global$/, category: "Network services", reference: "ciscoDhcp", explanation: "Controls DHCP server and relay services. The no form disables both services; enabling them alone does not prove a pool or relay is operating." },
  { pattern: /^ip dhcp bootp ignore$/, context: /^Global$/, category: "Network services", reference: "ciscoDhcp", explanation: "Tells this DHCP server not to answer legacy BOOTP requests. It applies across its pools, not as a general network traffic filter." },
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
  if (!found) return /^(?:no )?(?:channel-protocol|lacp rate|switchport nonegotiate|spanning-tree guard|zone-member security|log-adjacency-changes|auto-cost reference-bandwidth|set ikev2-profile|tunnel protection ipsec profile)\b/.test(text) || /^crypto ikev2 proposal /.test(context) && /^(?:encryption|integrity|group)\b/.test(text) || /^ip ospf (?:cost|hello-interval|dead-interval|priority)\b/.test(text) || context.startsWith("ip dhcp pool ") && /^(?:network|bootfile|next-server|netbios-name-server|netbios-node-type|utilization|import)\b/.test(text) || /^(?:no )?service dhcp\b/.test(text) ? null : undefined;
  const reference = selection && referenceForTrain(found.reference, selection.version);
  if (dialect !== "ios" || !reference || !selection || found.switchOnly && selection.profileId !== "cisco-switch" || found.routerOnly && selection.profileId !== "cisco-router" || !found.context.test(context)) return null;
  const match = text.match(found.pattern)!;
  if (found.check && !found.check(match)) return null;
  return { category: found.category, explanation: found.explanation, reference };
}
