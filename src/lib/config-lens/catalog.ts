export const LENS_VERSION = "1.1.0";
export const CATALOG_REVIEWED = "2026-10-24";
export const LENS_PATH = "/network-tools/network-configuration-explainer";
export type Vendor = "cisco" | "fortinet";
export type Dialect = "ios" | "nxos" | "asa" | "ftd" | "fortios" | "fortiweb" | "fortiswitch";
export type DeviceProfile = {
  id: string; vendor: Vendor; name: string; os: string; dialect: Dialect;
  versions: string[]; source: string; scope: string; exportHint: string;
};
export const profiles: DeviceProfile[] = [
  { id: "cisco-router", vendor: "cisco", name: "Router", os: "IOS / IOS XE", dialect: "ios", versions: ["IOS XE 17.x", "IOS XE 16.x", "IOS 15.x"], source: "https://www.cisco.com/c/en/us/support/ios-nx-os-software/ios-xe-17/series.html", scope: "Common interface, static route, routing-protocol, ACL, NAT, VPN and management statements. No routing convergence or reachability simulation.", exportHint: "Use a plain-text running configuration obtained by an authorized operator. Include its version header. Never upload a binary backup or credentials." },
  { id: "cisco-switch", vendor: "cisco", name: "Catalyst switch", os: "IOS / IOS XE", dialect: "ios", versions: ["IOS XE 17.x", "IOS XE 16.x", "IOS 15.x"], source: "https://www.cisco.com/c/en/us/support/ios-nx-os-software/ios-xe-17/series.html", scope: "Common VLAN, access/trunk port, spanning-tree, port-channel, SVI, routing and management statements. Unsupported features remain visible.", exportHint: "Use a plain-text running configuration, not live command output or a screenshot. Port status and physical neighbours require separate operational evidence." },
  { id: "cisco-nexus", vendor: "cisco", name: "Nexus switch", os: "NX-OS", dialect: "nxos", versions: ["NX-OS 10.x", "NX-OS 9.x"], source: "https://www.cisco.com/c/en/us/support/switches/nexus-9000-series-switches/series.html", scope: "Common interface, VLAN, VRF, static route and routing declarations. vPC, VXLAN/EVPN and feature-specific defaults are not evaluated.", exportHint: "Supply text running configuration with the NX-OS version header. This is not a fabric controller or full vPC/EVPN validator." },
  { id: "cisco-asa", vendor: "cisco", name: "ASA firewall", os: "ASA", dialect: "asa", versions: ["ASA 9.x"], source: "https://www.cisco.com/c/en/us/support/security/asa-5500-series-next-generation-firewalls/series.html", scope: "Common interfaces, objects, ACL entries/bindings, static routes and NAT declarations. NAT precedence and effective access are not simulated.", exportHint: "Use text running configuration from one security context. Multi-context exports need separate analysis per context." },
  { id: "cisco-ftd", vendor: "cisco", name: "Secure Firewall / FTD", os: "Threat Defense", dialect: "ftd", versions: ["FTD 10.x", "FTD 7.x"], source: "https://www.cisco.com/c/en/us/td/docs/security/firepower/command_ref/b_Command_Reference_for_Firepower_Threat_Defense/s_7.html", scope: "Partial diagnostic CLI only. Cisco states that running-config contains ASA-style settings, not the complete FMC/FDM policy. No verdict on Snort, intrusion prevention, URL filtering or full access control.", exportHint: "Only plain-text show running-config diagnostic output is supported. Review full policy in FMC/FDM. Manager archives and JSON exports are not supported in version 1." },
  { id: "fortigate", vendor: "fortinet", name: "FortiGate firewall", os: "FortiOS", dialect: "fortios", versions: ["FortiOS 7.6", "FortiOS 7.4", "FortiOS 7.2"], source: "https://docs.fortinet.com/product/fortigate", scope: "Interfaces, VDOM context, address objects/groups, firewall policy, VIPs, static routes, routing declarations, VPN and selected management settings. No implicit defaults or effective traffic verdicts.", exportHint: "Use a password-masked plain-text FortiOS configuration. Global and VDOM scopes stay separate. Encrypted backups and YAML are not supported." },
  { id: "fortiweb", vendor: "fortinet", name: "FortiWeb application firewall", os: "FortiWeb OS", dialect: "fortiweb", versions: ["FortiWeb 7.6", "FortiWeb 7.4"], source: "https://docs.fortinet.com/product/fortiweb", scope: "Interfaces, server-policy policy, virtual-server and server-pool declarations. WAF protection profiles and operating-mode behavior require vendor review; no protection-effectiveness verdict.", exportHint: "Use a plain-text CLI configuration. FortiWeb is an application firewall, not a FortiOS packet-firewall configuration." },
  { id: "fortiswitch", vendor: "fortinet", name: "FortiSwitch switch", os: "FortiSwitchOS", dialect: "fortiswitch", versions: ["FortiSwitchOS 7.6", "FortiSwitchOS 7.4", "FortiSwitchOS 7.2"], source: "https://docs.fortinet.com/product/fortiswitch", scope: "Standalone switch interface, native/allowed VLAN and selected management declarations. FortiLink controller intent and live switch state are not reconstructed.", exportHint: "Use a standalone switch text configuration. FortiGate switch-controller settings are not a complete standalone FortiSwitch export." }
];
export function getProfile(id: string) { return profiles.find(p => p.id === id); }
export type Selection = { profileId: string; version: string; build: string; configType: "running" | "saved" | "candidate" | "unknown" };
export const glossary = [
  ["Interface", "A physical port or logical connection on a device. A configuration does not prove that its cable or link is working."],
  ["VLAN", "A numbered group that separates a switched network into logical networks. Communication between groups generally needs routing."],
  ["Subnet", "A range of IP addresses treated as one network. A mask or prefix length identifies that range."],
  ["Route", "An instruction for where to send traffic for a destination network. A configured route is not proof it is installed or usable."],
  ["ACL / policy", "Rules that match traffic and apply an action. Order, attachment, direction, state and other policies can change the final result."],
  ["NAT", "Network address translation changes an address, and sometimes a port, as traffic crosses a device. It is not itself a security guarantee."],
  ["VPN", "A mechanism for carrying traffic between peers, often with encryption. Configuration alone cannot prove a tunnel is established."],
  ["VRF / VDOM", "Separate routing or virtual firewall contexts. Identical names or addresses in different contexts need not refer to the same thing."],
  ["WAF", "A web application firewall examines application traffic. A referenced protection profile does not prove every attack is blocked."],
  ["Running / candidate", "Running settings are intended to be active. Candidate settings are proposed changes that may not have been applied."],
  ["DHCP / lease", "DHCP offers a device its IP settings. A lease is how long it may borrow an address; configuration is not a list of current borrowers."],
  ["DNS", "A service that looks up addresses for names. A device's own DNS settings are different from DNS settings it offers to clients."],
  ["NTP", "Network Time Protocol synchronizes clocks. Being configured to use a time server does not prove the clock is synchronized."],
  ["SD-WAN / health check", "SD-WAN selects network paths using configured rules and measurements. A health check tests a target, not every application on that path."],
  ["HA / FGCP", "High availability groups devices for redundancy. FGCP is Fortinet's cluster protocol. Settings alone cannot show whether a peer is healthy or failover will succeed."],
  ["BPDU", "A spanning-tree control message exchanged by switches. BPDU guard and BPDU filtering have different effects; neither is a general firewall rule."]
] as const;
