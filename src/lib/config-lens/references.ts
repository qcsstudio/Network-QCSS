export const RULES_REVIEWED = "2026-10-26";
export const commandReferences = {
  ciscoDhcp: { title: "Cisco IOS XE 17.x: DHCP server", url: "https://www.cisco.com/c/en/us/td/docs/routers/ios/config/17-x/ip-addressing/b-ip-addressing/m_config-dhcp-server-xe.html" },
  ciscoDhcp16: { title: "Cisco IOS XE 16.11: DHCP server", url: "https://www.cisco.com/c/en/us/td/docs/ios-xml/ios/ipaddr_dhcp/configuration/xe-16-11/dhcp-xe-16-11-book/config-dhcp-server-xe.html" },
  ciscoDhcp15: { title: "Cisco IOS 15M&T: DHCP server", url: "https://www.cisco.com/c/en/us/td/docs/ios-xml/ios/ipaddr_dhcp/configuration/15-mt/dhcp-15-mt-book/config-dhcp-server.html" },
  ciscoIpServices: { title: "Cisco IOS XE 17.x: interface IP services", url: "https://www.cisco.com/c/en/us/td/docs/routers/ios/config/17-x/sec-vpn/b-security-vpn/m_sec-autosecure-0.html" },
  ciscoDns: { title: "Cisco IOS XE 17.x: DNS", url: "https://www.cisco.com/c/en/us/td/docs/routers/ios/config/17-x/ip-addressing/b-ip-addressing/m_configuring_dns.html" },
  ciscoStp: { title: "Catalyst IOS XE 17.15: spanning-tree protections", url: "https://www.cisco.com/c/en/us/td/docs/switches/lan/catalyst9200/software/release/17-15/configuration_guide/lyr2/b_1715_lyr2_9200_cg/configuring_optional_spanning_tree_features.html" },
  ciscoOspf: { title: "Cisco IOS XE 17.x: OSPF interfaces", url: "https://www.cisco.com/c/en/us/td/docs/routers/ios/config/17-x/ip-routing/b-ip-routing/m_iro-cfg-0.html" },
  ciscoLayer2: { title: "Catalyst 9200 IOS XE 17.15: link aggregation and STP", url: "https://www.cisco.com/c/en/us/td/docs/switches/lan/catalyst9200/software/release/17-15/command_reference/b_1715_9200_cr/layer_2_3_commands.html" },
  ciscoZone: { title: "Cisco IOS XE 17.x: zone-based firewall", url: "https://www.cisco.com/c/en/us/td/docs/routers/ios/config/17-x/sec-vpn/b-security-vpn/m_sec-zone-pol-fw-xe.html" },
  ciscoIkev2: { title: "Cisco IOS XE 17.x: IKEv2 negotiation", url: "https://www.cisco.com/c/en/us/td/docs/routers/ios/config/17-x/sec-vpn/b-security-vpn/m_sec-cfg-ikev2-flex.html" },
  fortiBgp: { title: "FortiOS 7.4.9: BGP", url: "https://docs.fortinet.com/document/fortigate/7.4.9/cli-reference/225427711/config-router-bgp" },
  fortiPolicyCli: { title: "FortiOS 7.4.9: firewall policy CLI", url: "https://docs.fortinet.com/document/fortigate/7.4.9/cli-reference/333889629/config-firewall-policy" },
  fortiPhase1: { title: "FortiOS 7.4.9: IPsec phase 1 interface", url: "https://docs.fortinet.com/document/fortigate/7.4.9/cli-reference/305883427/config-vpn-ipsec-phase1-interface" },
  fortiPhase2: { title: "FortiOS 7.4.9: IPsec phase 2 interface", url: "https://docs.fortinet.com/document/fortigate/7.4.9/cli-reference/252893715/config-vpn-ipsec-phase2-interface" },
  fortiPolicy: { title: "FortiOS 7.4.7: firewall policy options", url: "https://docs.fortinet.com/document/fortigate/7.4.7/administration-guide/656084" },
  fortiDhcp: { title: "FortiOS 7.4.9: DHCP server", url: "https://docs.fortinet.com/document/fortigate/7.4.9/cli-reference/121865377/config-system-dhcp-server" },
  fortiDns: { title: "FortiOS 7.4.9: DNS commands", url: "https://docs.fortinet.com/document/fortigate/7.4.9/cli-reference/190194324/config-system-dns" },
  fortiDns72: { title: "FortiOS 7.2.11: DNS commands", url: "https://docs.fortinet.com/document/fortigate/7.2.11/cli-reference/190194324/config-system-dns" },
  fortiDns76: { title: "FortiOS 7.6.4: DNS commands", url: "https://docs.fortinet.com/document/fortigate/7.6.4/cli-reference/190194324/config-system-dns" },
  fortiDhcp72: { title: "FortiOS 7.2.11: DHCP server", url: "https://docs.fortinet.com/document/fortigate/7.2.11/cli-reference/121865377/config-system-dhcp-server" },
  fortiDhcp76: { title: "FortiOS 7.6.4: DHCP server", url: "https://docs.fortinet.com/document/fortigate/7.6.4/cli-reference/121865377/config-system-dhcp-server" },
  fortiInterface: { title: "FortiOS 7.4.9: interface settings", url: "https://docs.fortinet.com/document/fortigate/7.4.9/cli-reference/317104469/config-system-interface" },
  fortiInterface72: { title: "FortiOS 7.2.11: interface settings", url: "https://docs.fortinet.com/document/fortigate/7.2.11/cli-reference/317104469/config-system-interface" },
  fortiInterface76: { title: "FortiOS 7.6.4: interface settings", url: "https://docs.fortinet.com/document/fortigate/7.6.4/cli-reference/317104469/config-system-interface" },
  fortiNtp: { title: "FortiOS 7.4.4: system time", url: "https://docs.fortinet.com/document/fortigate/7.4.4/administration-guide/512210/setting-the-system-time" },
  fortiSdwan: { title: "FortiOS 7.4.5: SD-WAN members and zones", url: "https://docs.fortinet.com/document/fortigate/7.4.5/administration-guide/942095" },
  fortiHealth: { title: "FortiOS 7.4.9: link health monitor", url: "https://docs.fortinet.com/document/fortigate/7.4.9/administration-guide/580649/link-health-monitor" },
  fortiLogs: { title: "FortiOS 7.4.9: log targets and filters", url: "https://docs.fortinet.com/document/fortigate/7.4.9/administration-guide/250999/log-settings-and-targets" },
  fortiPickup: { title: "FortiOS 7.4.7: HA session pickup", url: "https://docs.fortinet.com/document/fortigate/7.4.7/administration-guide/955521/session-pickup" },
} as const;
export type CommandReference = keyof typeof commandReferences;

// Only families checked against separate release documentation are shared.
const additionalTrains: Partial<Record<CommandReference, Record<string, CommandReference>>> = {
  ciscoDhcp: { "IOS 15.x": "ciscoDhcp15", "IOS XE 16.x": "ciscoDhcp16" },
  fortiDns: { "FortiOS 7.2": "fortiDns72", "FortiOS 7.6": "fortiDns76" },
  fortiDhcp: { "FortiOS 7.2": "fortiDhcp72", "FortiOS 7.6": "fortiDhcp76" },
  fortiInterface: { "FortiOS 7.2": "fortiInterface72", "FortiOS 7.6": "fortiInterface76" },
};
export function referenceForTrain(reference: CommandReference, version: string): CommandReference | undefined {
  const baseline = reference.startsWith("cisco") ? "IOS XE 17.x" : "FortiOS 7.4";
  if (version === baseline) return reference;
  const alternatives = additionalTrains[reference];
  return alternatives && Object.hasOwn(alternatives, version) ? alternatives[version] : undefined;
}
